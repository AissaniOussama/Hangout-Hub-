// PollResource + PollService
import { Hono } from "hono";
import { type Db, NOW, one, pool, query, tx } from "../db.js";
import {
  type Env,
  HttpError,
  badRequest,
  body,
  conflict,
  forbidden,
  idParam,
  notFound,
  oneOf,
  optDate,
  optDateTime,
  requireNonBlank,
  requireUser,
} from "../http.js";
import { canEdit, canView, findEventRowOrThrow, notifyEventParticipants, requireExistingUser } from "../model.js";

export const pollRoutes = new Hono<Env>();

const VOTE_MODES = ["SINGLE_CHANGEABLE", "SINGLE_LOCKED", "MULTIPLE"] as const;
const OPTION_TYPES = ["TEXT", "DATE"] as const;

type PollRow = {
  id: number;
  event_id: number;
  question: string;
  vote_mode: (typeof VOTE_MODES)[number];
  created_at: string;
  closes_at: string | null;
  closed: boolean;
  is_closed: boolean;
};

const POLL_SELECT = `SELECT p.*, (p.closed OR (p.closes_at IS NOT NULL AND ${NOW} > p.closes_at)) AS is_closed FROM polls p`;

async function pollsJson(polls: PollRow[], requesterId: number, db: Db = pool) {
  if (polls.length === 0) return [];
  const ids = polls.map((p) => p.id);
  const options = await query(
    `SELECT id, poll_id, option_type, text, date_value FROM poll_options WHERE poll_id = ANY($1::bigint[]) ORDER BY id`,
    [ids],
    db,
  );
  const votes = await query(
    `SELECT v.poll_option_id, v.user_id, u.username
       FROM poll_votes v JOIN poll_options o ON o.id = v.poll_option_id JOIN users u ON u.id = v.user_id
      WHERE o.poll_id = ANY($1::bigint[]) ORDER BY v.id`,
    [ids],
    db,
  );
  return polls.map((p) => ({
    id: p.id,
    question: p.question,
    voteMode: p.vote_mode,
    createdAt: p.created_at,
    closesAt: p.closes_at,
    closed: p.is_closed,
    options: options
      .filter((o) => o.poll_id === p.id)
      .map((o) => {
        const voters = votes
          .filter((v) => v.poll_option_id === o.id)
          .map((v) => ({ userId: v.user_id, username: v.username }));
        return {
          id: o.id,
          optionType: o.option_type,
          text: o.text,
          dateValue: o.date_value,
          voteCount: voters.length,
          votedByMe: voters.some((v) => v.userId === requesterId),
          voters,
        };
      }),
  }));
}

async function pollJson(pollId: number, requesterId: number, db: Db = pool) {
  const p = await one<PollRow>(`${POLL_SELECT} WHERE p.id = $1`, [pollId], db);
  return (await pollsJson([p!], requesterId, db))[0];
}

async function findPollOrThrow(eventId: number, pollId: number, db: Db) {
  const poll = await one<PollRow>(`${POLL_SELECT} WHERE p.id = $1`, [pollId], db);
  if (!poll) throw notFound("Poll not found");
  if (poll.event_id !== eventId) throw notFound("Poll not found for this event");
  return poll;
}

async function findOptionOrThrow(eventId: number, pollId: number, optionId: number, db: Db) {
  const poll = await findPollOrThrow(eventId, pollId, db);
  const opt = await one("SELECT id FROM poll_options WHERE id = $1 AND poll_id = $2", [optionId, pollId], db);
  if (!opt) throw notFound("Option not found for this poll");
  return poll;
}

async function requireView(eventId: number, userId: number, db: Db) {
  const event = await findEventRowOrThrow(eventId, db);
  if (!(await canView(event, userId, db))) throw forbidden("You do not have access to this event's polls");
  return event;
}

pollRoutes.get("/events/:eventId{[0-9]+}/polls", async (c) => {
  const userId = requireUser(c);
  const eventId = idParam(c, "eventId");
  await requireExistingUser(userId);
  await requireView(eventId, userId, pool);
  const polls = await query<PollRow>(`${POLL_SELECT} WHERE p.event_id = $1 ORDER BY p.id`, [eventId]);
  return c.json(await pollsJson(polls, userId));
});

pollRoutes.post("/events/:eventId{[0-9]+}/polls", async (c) => {
  const userId = requireUser(c);
  const eventId = idParam(c, "eventId");
  const b = await body(c);
  const question = requireNonBlank(b.question, "question");
  const voteMode = oneOf(b.voteMode, VOTE_MODES, "voteMode");
  const closesAt = optDateTime(b.closesAt, "closesAt");
  if (!Array.isArray(b.options) || b.options.length === 0) throw badRequest("options must not be empty");

  const pollId = await tx(async (db) => {
    const user = await requireExistingUser(userId, db);
    const event = await findEventRowOrThrow(eventId, db);
    if (!(await canEdit(eventId, user.id, db))) throw forbidden("Only the event owner or editors can create polls");
    if (closesAt != null) {
      const past = await one<{ past: boolean }>(`SELECT $1::timestamp < ${NOW} AS past`, [closesAt], db);
      if (past!.past) throw badRequest("closesAt must be in the future");
    }
    const poll = await one<{ id: number }>(
      `INSERT INTO polls (event_id, question, vote_mode, closes_at, created_at) VALUES ($1, $2, $3, $4, ${NOW}) RETURNING id`,
      [eventId, question, voteMode, closesAt],
      db,
    );
    for (const o of b.options) {
      if (!o || typeof o !== "object") throw badRequest("invalid option");
      const type = oneOf(o.optionType, OPTION_TYPES, "optionType");
      let text: string | null = null;
      let date: string | null = null;
      if (type === "TEXT") {
        if (typeof o.text !== "string" || o.text.trim() === "") throw badRequest("Text options require non-blank text");
        text = o.text;
      } else {
        date = optDate(o.dateValue, "dateValue");
        if (date == null) throw badRequest("Date options require a date");
      }
      await query(
        "INSERT INTO poll_options (poll_id, option_type, text, date_value) VALUES ($1, $2, $3, $4)",
        [poll!.id, type, text, date],
        db,
      );
    }
    await notifyEventParticipants(
      db,
      eventId,
      userId,
      "POLL_CREATED",
      `A new poll was created for "${event.title}": ${question}`,
      `/events/${eventId}`,
    );
    return poll!.id;
  });
  c.header("Location", `/api/events/${eventId}/polls/${pollId}`);
  return c.json(await pollJson(pollId, userId), 201);
});

pollRoutes.post("/events/:eventId{[0-9]+}/polls/:pollId{[0-9]+}/options/:optionId{[0-9]+}/vote", async (c) => {
  const userId = requireUser(c);
  const eventId = idParam(c, "eventId");
  const pollId = idParam(c, "pollId");
  const optionId = idParam(c, "optionId");
  const result = await tx(async (db) => {
    const user = await requireExistingUser(userId, db);
    const poll = await findOptionOrThrow(eventId, pollId, optionId, db);
    const event = await requireView(poll.event_id, userId, db);
    if (poll.is_closed) throw conflict("This poll is closed");

    let voted = false;
    if (poll.vote_mode === "MULTIPLE") {
      const del = await query("DELETE FROM poll_votes WHERE user_id = $1 AND poll_option_id = $2 RETURNING id", [userId, optionId], db);
      if (del.length === 0) {
        await query("INSERT INTO poll_votes (user_id, poll_option_id) VALUES ($1, $2)", [userId, optionId], db);
        voted = true;
      }
    } else if (poll.vote_mode === "SINGLE_LOCKED") {
      const existing = await one(
        `SELECT 1 FROM poll_votes v JOIN poll_options o ON o.id = v.poll_option_id WHERE v.user_id = $1 AND o.poll_id = $2`,
        [userId, pollId],
        db,
      );
      if (existing) throw new HttpError(409, "You have already voted and votes cannot be changed for this poll");
      await query("INSERT INTO poll_votes (user_id, poll_option_id) VALUES ($1, $2)", [userId, optionId], db);
      voted = true;
    } else {
      await query(
        `DELETE FROM poll_votes WHERE user_id = $1 AND poll_option_id IN (SELECT id FROM poll_options WHERE poll_id = $2)`,
        [userId, pollId],
        db,
      );
      await query("INSERT INTO poll_votes (user_id, poll_option_id) VALUES ($1, $2)", [userId, optionId], db);
      voted = true;
    }

    if (voted) {
      await notifyEventParticipants(
        db,
        event.id,
        userId,
        "POLL_VOTE",
        `${user.username} voted in poll "${poll.question}" for "${event.title}"`,
        `/events/${event.id}`,
      );
    }
    return pollJson(pollId, userId, db);
  });
  return c.json(result);
});

pollRoutes.delete("/events/:eventId{[0-9]+}/polls/:pollId{[0-9]+}/options/:optionId{[0-9]+}/vote", async (c) => {
  const userId = requireUser(c);
  const eventId = idParam(c, "eventId");
  const pollId = idParam(c, "pollId");
  const optionId = idParam(c, "optionId");
  const result = await tx(async (db) => {
    await requireExistingUser(userId, db);
    const poll = await findOptionOrThrow(eventId, pollId, optionId, db);
    await requireView(poll.event_id, userId, db);
    if (poll.is_closed) throw conflict("This poll is closed");
    if (poll.vote_mode === "SINGLE_LOCKED") throw forbidden("Votes cannot be retracted for this poll");
    await query("DELETE FROM poll_votes WHERE user_id = $1 AND poll_option_id = $2", [userId, optionId], db);
    return pollJson(pollId, userId, db);
  });
  return c.json(result);
});

pollRoutes.post("/events/:eventId{[0-9]+}/polls/:pollId{[0-9]+}/close", async (c) => {
  const userId = requireUser(c);
  const eventId = idParam(c, "eventId");
  const pollId = idParam(c, "pollId");
  const result = await tx(async (db) => {
    await requireExistingUser(userId, db);
    const poll = await findPollOrThrow(eventId, pollId, db);
    if (!(await canEdit(poll.event_id, userId, db))) throw forbidden("Only the event owner or editors can close polls");
    if (poll.closed) throw badRequest("Poll is already closed");
    await query("UPDATE polls SET closed = true WHERE id = $1", [pollId], db);
    return pollJson(pollId, userId, db);
  });
  return c.json(result);
});

pollRoutes.delete("/events/:eventId{[0-9]+}/polls/:pollId{[0-9]+}", async (c) => {
  const userId = requireUser(c);
  const eventId = idParam(c, "eventId");
  const pollId = idParam(c, "pollId");
  await requireExistingUser(userId);
  const poll = await findPollOrThrow(eventId, pollId, pool);
  if (!(await canEdit(poll.event_id, userId))) throw forbidden("Only the event owner or editors can delete polls");
  await query("DELETE FROM polls WHERE id = $1", [pollId]);
  return c.body(null, 204);
});

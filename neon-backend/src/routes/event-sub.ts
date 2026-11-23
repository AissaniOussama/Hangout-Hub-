// RsvpResource, InvitationResource, ChatResource, BringListResource
import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { query, tx, one, type Db, pool } from "../db.js";
import { type Env, body, conflict, forbidden, idParam, notFound, oneOf, requireNonBlank, requireUser } from "../http.js";
import {
  RSVP_STATUSES,
  type EventJson,
  type UserJson,
  createNotification,
  eventJson,
  findEventRowOrThrow,
  notifyEventParticipants,
  requireExistingUser,
} from "../model.js";

export const eventSubRoutes = new Hono<Env>();

const userJson = (id: number | null, username: string | null, email: string | null): UserJson | null =>
  id != null && username != null ? { id, username, email: email! } : null;

// ── RSVP ─────────────────────────────────────────────────────────────────────

async function rsvpsJson(where: string, params: unknown[], event: EventJson, db: Db = pool) {
  const rows = await query(
    `SELECT r.id, r.status, r.updated_at, u.id AS u_id, u.username, u.email
       FROM rsvps r JOIN users u ON u.id = r.user_id WHERE ${where} ORDER BY r.id`,
    params,
    db,
  );
  return rows.map((r) => ({
    id: r.id,
    event,
    user: userJson(r.u_id, r.username, r.email),
    status: r.status,
    updatedAt: r.updated_at,
  }));
}

eventSubRoutes.get("/events/:eventId{[0-9]+}/rsvp", async (c) => {
  requireUser(c);
  const eventId = idParam(c, "eventId");
  await findEventRowOrThrow(eventId);
  return c.json(await rsvpsJson("r.event_id = $1", [eventId], await eventJson(eventId)));
});

eventSubRoutes.put("/events/:eventId{[0-9]+}/rsvp", async (c) => {
  const userId = requireUser(c);
  const eventId = idParam(c, "eventId");
  const b = await body(c);
  const result = await tx(async (db) => {
    await findEventRowOrThrow(eventId, db);
    await requireExistingUser(userId, db);
    const status = oneOf(b.status, RSVP_STATUSES, "status");
    const row = await one<{ id: number }>(
      `INSERT INTO rsvps (event_id, user_id, status, updated_at)
       VALUES ($1, $2, $3, now() AT TIME ZONE 'Europe/Berlin')
       ON CONFLICT (event_id, user_id) DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at
       RETURNING id`,
      [eventId, userId, status],
      db,
    );
    return (await rsvpsJson("r.id = $1", [row!.id], await eventJson(eventId, db), db))[0];
  });
  return c.json(result);
});

// ── Einladungen ──────────────────────────────────────────────────────────────

async function invitationsJson(where: string, params: unknown[], db: Db = pool) {
  const rows = await query(
    `SELECT i.id, i.event_id, i.invite_code, i.status, i.created_at, u.id AS u_id, u.username, u.email
       FROM invitations i LEFT JOIN users u ON u.id = i.invited_user_id WHERE ${where} ORDER BY i.id`,
    params,
    db,
  );
  const events = new Map<number, EventJson>();
  for (const r of rows) if (!events.has(r.event_id)) events.set(r.event_id, await eventJson(r.event_id, db));
  return rows.map((r) => ({
    id: r.id,
    event: events.get(r.event_id),
    invitedUser: userJson(r.u_id, r.username, r.email),
    inviteCode: r.invite_code,
    status: r.status,
    createdAt: r.created_at,
  }));
}

eventSubRoutes.get("/events/:eventId{[0-9]+}/invitations", async (c) => {
  requireUser(c);
  const eventId = idParam(c, "eventId");
  await findEventRowOrThrow(eventId);
  return c.json(await invitationsJson("i.event_id = $1", [eventId]));
});

eventSubRoutes.post("/events/:eventId{[0-9]+}/invitations", async (c) => {
  requireUser(c);
  const eventId = idParam(c, "eventId");
  await findEventRowOrThrow(eventId);
  const code = randomUUID().replace(/-/g, "");
  const row = await one<{ id: number }>(
    `INSERT INTO invitations (event_id, invite_code, created_at)
     VALUES ($1, $2, now() AT TIME ZONE 'Europe/Berlin') RETURNING id`,
    [eventId, code],
  );
  c.header("Location", `/api/invitations/${code}`);
  return c.json((await invitationsJson("i.id = $1", [row!.id]))[0], 201);
});

// oeffentlich (PermitAll)
eventSubRoutes.get("/events/:eventId{[0-9]+}/invitations/accept/:code", async (c) => {
  const row = await one<{ id: number }>(
    "UPDATE invitations SET status = 'ACCEPTED' WHERE invite_code = $1 RETURNING id",
    [c.req.param("code")],
  );
  if (!row) throw notFound("Invitation not found");
  return c.json((await invitationsJson("i.id = $1", [row.id]))[0]);
});

// ── Chat ─────────────────────────────────────────────────────────────────────

async function messagesJson(where: string, params: unknown[], event: EventJson, db: Db = pool) {
  const rows = await query(
    `SELECT m.id, m.content, m.sent_at, u.id AS u_id, u.username, u.email
       FROM messages m LEFT JOIN users u ON u.id = m.sender_id WHERE ${where} ORDER BY m.sent_at ASC, m.id ASC`,
    params,
    db,
  );
  return rows.map((r) => ({
    id: r.id,
    event,
    sender: userJson(r.u_id, r.username, r.email),
    content: r.content,
    sentAt: r.sent_at,
  }));
}

eventSubRoutes.get("/events/:eventId{[0-9]+}/messages", async (c) => {
  requireUser(c);
  const eventId = idParam(c, "eventId");
  await findEventRowOrThrow(eventId);
  return c.json(await messagesJson("m.event_id = $1", [eventId], await eventJson(eventId)));
});

eventSubRoutes.post("/events/:eventId{[0-9]+}/messages", async (c) => {
  const userId = requireUser(c);
  const eventId = idParam(c, "eventId");
  const b = await body(c);
  const msg = await tx(async (db) => {
    const event = await findEventRowOrThrow(eventId, db);
    const sender = await requireExistingUser(userId, db);
    const content = requireNonBlank(b.content, "content");
    const row = await one<{ id: number }>(
      `INSERT INTO messages (event_id, sender_id, content, sent_at)
       VALUES ($1, $2, $3, now() AT TIME ZONE 'Europe/Berlin') RETURNING id`,
      [eventId, userId, content],
      db,
    );
    await notifyEventParticipants(
      db,
      eventId,
      userId,
      "NEW_MESSAGE",
      `${sender.username} posted in "${event.title}"`,
      `/events/${eventId}/chat`,
    );
    return (await messagesJson("m.id = $1", [row!.id], await eventJson(eventId, db), db))[0];
  });
  return c.json(msg, 201);
});

// ── Mitbringliste ────────────────────────────────────────────────────────────

async function bringItemsJson(where: string, params: unknown[], db: Db = pool) {
  const rows = await query(
    `SELECT b.id, b.event_id, b.description, b.reminder_sent, u.id AS u_id, u.username, u.email
       FROM bring_items b LEFT JOIN users u ON u.id = b.claimed_by_id WHERE ${where} ORDER BY b.id`,
    params,
    db,
  );
  const events = new Map<number, EventJson>();
  for (const r of rows) if (!events.has(r.event_id)) events.set(r.event_id, await eventJson(r.event_id, db));
  return rows.map((r) => ({
    id: r.id,
    event: events.get(r.event_id),
    description: r.description,
    claimedBy: userJson(r.u_id, r.username, r.email),
    reminderSent: r.reminder_sent,
  }));
}

async function requireOrganizer(eventId: number, userId: number, db: Db = pool) {
  const event = await findEventRowOrThrow(eventId, db);
  await requireExistingUser(userId, db);
  if (event.organizer_id !== userId) throw forbidden("Only the organizer can manage bring-list items");
  return event;
}

async function findItemOrThrow(itemId: number, db: Db = pool) {
  const item = await one<{ id: number; claimed_by_id: number | null }>(
    "SELECT id, claimed_by_id FROM bring_items WHERE id = $1",
    [itemId],
    db,
  );
  if (!item) throw notFound("Item not found");
  return item;
}

eventSubRoutes.get("/events/:eventId{[0-9]+}/bring-items", async (c) => {
  requireUser(c);
  const eventId = idParam(c, "eventId");
  await findEventRowOrThrow(eventId);
  return c.json(await bringItemsJson("b.event_id = $1", [eventId]));
});

eventSubRoutes.post("/events/:eventId{[0-9]+}/bring-items", async (c) => {
  const userId = requireUser(c);
  const eventId = idParam(c, "eventId");
  const b = await body(c);
  const description = requireNonBlank(b.description, "description");
  await requireOrganizer(eventId, userId);
  const row = await one<{ id: number }>(
    "INSERT INTO bring_items (event_id, description) VALUES ($1, $2) RETURNING id",
    [eventId, description],
  );
  c.header("Location", `/api/events/${eventId}/bring-items/${row!.id}`);
  return c.json((await bringItemsJson("b.id = $1", [row!.id]))[0], 201);
});

eventSubRoutes.post("/events/:eventId{[0-9]+}/bring-items/remind", async (c) => {
  const userId = requireUser(c);
  const eventId = idParam(c, "eventId");
  const notified = await tx(async (db) => {
    const event = await findEventRowOrThrow(eventId, db);
    await requireExistingUser(userId, db);
    if (event.organizer_id !== userId) throw forbidden("Only the organizer can send bring-item reminders");
    const targets = await query<{ user_id: number }>(
      `SELECT r.user_id FROM rsvps r
        WHERE r.event_id = $1 AND r.status = 'ATTENDING'
          AND r.user_id NOT IN (SELECT claimed_by_id FROM bring_items WHERE event_id = $1 AND claimed_by_id IS NOT NULL)
        ORDER BY r.id`,
      [eventId],
      db,
    );
    for (const t of targets) {
      await createNotification(db, {
        userId: t.user_id,
        message: `Reminder: please claim a bring item for "${event.title}"`,
        type: "BRING_ITEM_REMINDER",
        eventId,
        link: `/events/${eventId}?openBringList=1`,
      });
    }
    return targets.length;
  });
  return c.json({ notified });
});

eventSubRoutes.delete("/events/:eventId{[0-9]+}/bring-items/:itemId{[0-9]+}", async (c) => {
  const userId = requireUser(c);
  const eventId = idParam(c, "eventId");
  const itemId = idParam(c, "itemId");
  await requireOrganizer(eventId, userId);
  await findItemOrThrow(itemId);
  await query("DELETE FROM bring_items WHERE id = $1", [itemId]);
  return c.body(null, 204);
});

eventSubRoutes.post("/events/:eventId{[0-9]+}/bring-items/:itemId{[0-9]+}/claim", async (c) => {
  const userId = requireUser(c);
  const itemId = idParam(c, "itemId");
  await requireExistingUser(userId);
  // atomar: nur setzen, wenn noch frei (verhindert Doppel-Claims)
  const row = await one("UPDATE bring_items SET claimed_by_id = $1 WHERE id = $2 AND claimed_by_id IS NULL RETURNING id", [
    userId,
    itemId,
  ]);
  if (!row) {
    await findItemOrThrow(itemId);
    throw conflict("Item already claimed");
  }
  return c.json((await bringItemsJson("b.id = $1", [itemId]))[0]);
});

eventSubRoutes.delete("/events/:eventId{[0-9]+}/bring-items/:itemId{[0-9]+}/claim", async (c) => {
  requireUser(c);
  const itemId = idParam(c, "itemId");
  await findItemOrThrow(itemId);
  await query("UPDATE bring_items SET claimed_by_id = NULL WHERE id = $1", [itemId]);
  return c.json((await bringItemsJson("b.id = $1", [itemId]))[0]);
});

/** Taeglicher Job (BringListReminderScheduler): Events in 3 Tagen mit Mitbringliste. */
export async function remindUpcomingEvents(): Promise<number> {
  return tx(async (db) => {
    const targets = await query<{ user_id: number; event_id: number; title: string }>(
      `SELECT r.user_id, e.id AS event_id, e.title
         FROM events e
         JOIN rsvps r ON r.event_id = e.id AND r.status = 'ATTENDING'
        WHERE e.has_bring_list = true
          AND e.start_time >= (now() AT TIME ZONE 'Europe/Berlin')::date + 3
          AND e.start_time <  (now() AT TIME ZONE 'Europe/Berlin')::date + 4
          AND r.user_id NOT IN (SELECT claimed_by_id FROM bring_items WHERE event_id = e.id AND claimed_by_id IS NOT NULL)
          AND NOT EXISTS (SELECT 1 FROM notifications n
                           WHERE n.user_id = r.user_id AND n.event_id = e.id AND n.type = 'BRING_ITEM_REMINDER')`,
      [],
      db,
    );
    for (const t of targets) {
      await createNotification(db, {
        userId: t.user_id,
        message: `"${t.title}" is in 3 days and you haven't signed up for anything on the bring list yet!`,
        type: "BRING_ITEM_REMINDER",
        eventId: t.event_id,
        link: `/events/${t.event_id}?openBringList=1`,
      });
    }
    return targets.length;
  });
}

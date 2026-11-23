// EventResource + EventService + IcsGenerator
import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { type Db, NOW, one, pool, query, tx } from "../db.js";
import {
  type Env,
  badRequest,
  body,
  forbidden,
  idParam,
  notFound,
  oneOf,
  optBool,
  optDateTime,
  optInt,
  optString,
  requireNonBlank,
  requireUser,
} from "../http.js";
import {
  EVENT_ROLES,
  type EventRole,
  canDelete,
  canEdit,
  canView,
  eventJson,
  eventRoleOf,
  eventsJsonOrdered,
  findEventRowOrThrow,
  findUser,
  groupRoleOf,
  requireExistingUser,
} from "../model.js";

export const eventRoutes = new Hono<Env>();

// ── Liste ────────────────────────────────────────────────────────────────────

eventRoutes.get("/events", async (c) => {
  const userId = c.get("userId");
  const q = c.req.query("q");
  const groupIdRaw = c.req.query("groupId");
  const range = c.req.query("range") ?? "";
  const page = c.req.query("page");
  const size = c.req.query("size");

  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  let where: string;
  if (userId != null) {
    // oeffentlich ODER Event einer meiner Gruppen ODER ich habe eine Event-Rolle
    const u = p(userId);
    where = `e.start_time >= ${NOW} AND (e.is_public = true
      OR e.group_id IN (SELECT group_id FROM group_members WHERE user_id = ${u})
      OR EXISTS (SELECT 1 FROM event_roles er WHERE er.event_id = e.id AND er.user_id = ${u}))`;
  } else {
    where = `e.start_time >= ${NOW} AND e.is_public = true`;
  }
  if (q != null && q.trim() !== "") where += ` AND LOWER(e.title) LIKE ${p("%" + q.toLowerCase() + "%")}`;
  if (groupIdRaw != null && groupIdRaw !== "") {
    const gid = Number(groupIdRaw);
    if (!Number.isSafeInteger(gid)) throw notFound("Not found");
    where += ` AND e.group_id = ${p(gid)}`;
  }
  if (range === "week") where += ` AND e.start_time <= ${NOW} + interval '1 week'`;
  if (range === "month") where += ` AND e.start_time <= ${NOW} + interval '1 month'`;

  const countParams = [...params];
  let paging = "";
  if (size != null && size !== "") {
    const s = Number(size);
    const pg = page != null && page !== "" ? Number(page) : 0;
    if (!Number.isInteger(s) || !Number.isInteger(pg) || s < 0 || pg < 0) throw notFound("Not found");
    paging = ` LIMIT ${p(s)} OFFSET ${p(pg * s)}`;
  }

  const ids = await query<{ id: number }>(
    `SELECT e.id FROM events e WHERE ${where} ORDER BY e.start_time ASC, e.id ASC${paging}`,
    params,
  );
  const total = await one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM events e WHERE ${where}`, countParams);
  return c.json({ items: await eventsJsonOrdered(ids.map((r) => r.id)), totalItems: total!.n });
});

// ── Einladungslink (vor /events/:id, damit "join" nicht als ID gilt) ─────────

eventRoutes.get("/events/join/:token", async (c) => {
  requireUser(c);
  const ev = await one("SELECT id, title FROM events WHERE invite_token = $1", [c.req.param("token")]);
  if (!ev) throw notFound("Invalid invite token");
  return c.json(ev);
});

eventRoutes.post("/events/join/:token", async (c) => {
  const userId = requireUser(c);
  const id = await tx(async (db) => {
    const ev = await one<{ id: number }>("SELECT id FROM events WHERE invite_token = $1", [c.req.param("token")], db);
    if (!ev) throw notFound("Invalid invite token");
    await query(
      "INSERT INTO event_roles (event_id, user_id, role) VALUES ($1, $2, 'VIEWER') ON CONFLICT (event_id, user_id) DO NOTHING",
      [ev.id, userId],
      db,
    );
    return ev.id;
  });
  return c.json(await eventJson(id));
});

// ── CRUD ─────────────────────────────────────────────────────────────────────

eventRoutes.get("/events/:id{[0-9]+}", async (c) => {
  const id = idParam(c, "id");
  const row = await findEventRowOrThrow(id);
  if (!(await canView(row, c.get("userId")))) throw forbidden("You do not have access to this private event");
  return c.json(await eventJson(id));
});

type EventFields = {
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  location: string | null;
  admissionFee: number | null;
  groupId: number | null;
  minParticipants: number | null;
  maxParticipants: number | null;
  isPublic: boolean;
  seriesParentId: number | null;
  hasBringList: boolean;
};

function parseEventRequest(b: Record<string, any>): EventFields {
  const title = requireNonBlank(b.title, "title");
  const startTime = optDateTime(b.startTime, "startTime");
  if (!startTime) throw badRequest("startTime must not be null");
  const f: EventFields = {
    title,
    description: optString(b.description, "description"),
    startTime,
    endTime: optDateTime(b.endTime, "endTime"),
    location: optString(b.location, "location"),
    admissionFee: optInt(b.admissionFee, "admissionFee"),
    groupId: optInt(b.groupId, "groupId"),
    minParticipants: optInt(b.minParticipants, "minParticipants"),
    maxParticipants: optInt(b.maxParticipants, "maxParticipants"),
    isPublic: optBool(b.isPublic, "isPublic") ?? true,
    seriesParentId: optInt(b.seriesParentId, "seriesParentId"),
    hasBringList: optBool(b.hasBringList, "hasBringList") ?? false,
  };
  if (f.minParticipants != null && f.maxParticipants != null && f.maxParticipants < f.minParticipants) {
    throw badRequest("maxParticipants must be >= minParticipants");
  }
  return f;
}

/** Gruppe + Serien-Parent pruefen (applyFields im Java-Code). */
async function checkRefs(f: EventFields, requesterId: number, db: Db) {
  if (f.groupId != null) {
    if (!(await one("SELECT 1 FROM groups WHERE id = $1", [f.groupId], db))) {
      throw notFound(`Group not found: ${f.groupId}`);
    }
    const role = await groupRoleOf(f.groupId, requesterId, db);
    if (role !== "OWNER" && role !== "ADMIN") {
      throw forbidden("Only group owners and admins can create events for a group");
    }
  }
  if (f.seriesParentId != null) await findEventRowOrThrow(f.seriesParentId, db);
}

const FIELD_VALUES = (f: EventFields) => [
  f.title,
  f.description,
  f.startTime,
  f.endTime,
  f.location,
  f.admissionFee,
  f.groupId,
  f.minParticipants,
  f.maxParticipants,
  f.isPublic,
  f.seriesParentId,
  f.hasBringList,
];

eventRoutes.post("/events", async (c) => {
  const userId = requireUser(c);
  const f = parseEventRequest(await body(c));
  const id = await tx(async (db) => {
    await requireExistingUser(userId, db).catch(() => {
      throw notFound("Authenticated user not found");
    });
    await checkRefs(f, userId, db);
    const ev = await one<{ id: number }>(
      `INSERT INTO events (title, description, start_time, end_time, location, admission_fee, group_id,
                           min_participants, max_participants, is_public, series_id, has_bring_list, organizer_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [...FIELD_VALUES(f), userId],
      db,
    );
    await query("INSERT INTO event_roles (event_id, user_id, role) VALUES ($1, $2, 'OWNER')", [ev!.id, userId], db);
    if (f.groupId != null) {
      // Gruppenmitglieder bekommen VIEWER
      await query(
        `INSERT INTO event_roles (event_id, user_id, role)
         SELECT $1, user_id, 'VIEWER' FROM group_members WHERE group_id = $2 AND user_id <> $3
         ON CONFLICT (event_id, user_id) DO NOTHING`,
        [ev!.id, f.groupId, userId],
        db,
      );
    }
    return ev!.id;
  });
  c.header("Location", `/api/events/${id}`);
  return c.json(await eventJson(id), 201);
});

eventRoutes.put("/events/:id{[0-9]+}", async (c) => {
  const userId = requireUser(c);
  const id = idParam(c, "id");
  const b = await body(c);
  await tx(async (db) => {
    await requireExistingUser(userId, db).catch(() => {
      throw notFound("Authenticated user not found");
    });
    await findEventRowOrThrow(id, db);
    if (!(await canEdit(id, userId, db))) throw forbidden("Only the event owner or editors can edit this event");
    const f = parseEventRequest(b);
    await checkRefs(f, userId, db);
    await query(
      `UPDATE events SET title=$1, description=$2, start_time=$3, end_time=$4, location=$5, admission_fee=$6,
              group_id=$7, min_participants=$8, max_participants=$9, is_public=$10, series_id=$11,
              has_bring_list=$12
        WHERE id=$13`,
      [...FIELD_VALUES(f), id],
      db,
    );
  });
  return c.json(await eventJson(id));
});

eventRoutes.delete("/events/:id{[0-9]+}", async (c) => {
  const userId = requireUser(c);
  const id = idParam(c, "id");
  await findEventRowOrThrow(id);
  if (!(await canDelete(id, userId))) throw forbidden("Only the event owner can delete this event");
  await query("DELETE FROM events WHERE id = $1", [id]);
  return c.body(null, 204);
});

// ── ICS-Export ───────────────────────────────────────────────────────────────

function icsDate(localDateTime: string): string {
  // 2026-12-31T20:00:00(.123) -> 20261231T200000
  return localDateTime.slice(0, 19).replace(/[-:]/g, "");
}

function escapeIcs(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n").replace(/\r/g, "");
}

eventRoutes.get("/events/:id{[0-9]+}/export.ics", async (c) => {
  const id = idParam(c, "id");
  const e = await findEventRowOrThrow(id);
  const now = await one<{ now: string }>(`SELECT ${NOW} AS now`);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HangoutHub//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${randomUUID()}@hangouthub`,
    `DTSTAMP:${icsDate(now!.now)}`,
    `DTSTART:${icsDate(e.start_time)}`,
  ];
  if (e.end_time) lines.push(`DTEND:${icsDate(e.end_time)}`);
  lines.push(`SUMMARY:${escapeIcs(e.title)}`);
  if (e.description && e.description.trim() !== "") lines.push(`DESCRIPTION:${escapeIcs(e.description)}`);
  const override = c.req.query("location");
  const location = override && override.trim() !== "" ? override : e.location;
  if (location && location.trim() !== "") lines.push(`LOCATION:${escapeIcs(location)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return c.body(lines.join("\r\n") + "\r\n", 200, {
    "Content-Type": "text/calendar",
    "Content-Disposition": `attachment; filename="event-${id}.ics"`,
  });
});

// ── Teilnehmer ───────────────────────────────────────────────────────────────

type Participant = { userId: number; username: string; rsvpStatus: string | null; eventRole: EventRole | null };

function summarize(myEventRole: EventRole | null, participants: Participant[]) {
  return {
    myEventRole,
    attending: participants.filter((p) => p.rsvpStatus === "ATTENDING").length,
    maybe: participants.filter((p) => p.rsvpStatus === "MAYBE").length,
    participants,
  };
}

/** Teilnehmerliste auf Basis der Event-Rollen (buildParticipantsResponse / private Events). */
async function roleBasedParticipants(eventId: number, db?: Db): Promise<Participant[]> {
  return query<Participant>(
    `SELECT er.user_id AS "userId", COALESCE(u.username, 'Unknown') AS username,
            r.status AS "rsvpStatus", er.role AS "eventRole"
       FROM event_roles er
       LEFT JOIN users u ON u.id = er.user_id
       LEFT JOIN rsvps r ON r.event_id = er.event_id AND r.user_id = er.user_id
      WHERE er.event_id = $1
      ORDER BY er.ctid`,
    [eventId],
    db,
  );
}

eventRoutes.get("/events/:id{[0-9]+}/participants", async (c) => {
  const id = idParam(c, "id");
  const e = await findEventRowOrThrow(id);
  const currentId = c.get("userId");
  let myRole = await eventRoleOf(id, currentId);

  if (!e.is_public && myRole == null) {
    const isOrganizer = currentId != null && currentId === e.organizer_id;
    if (!isOrganizer) throw forbidden("You do not have access to this private event");
    myRole = "OWNER";
  }

  let participants: Participant[];
  if (e.is_public) {
    participants = await query<Participant>(
      `SELECT r.user_id AS "userId", u.username, r.status AS "rsvpStatus", er.role AS "eventRole"
         FROM rsvps r
         JOIN users u ON u.id = r.user_id
         LEFT JOIN event_roles er ON er.event_id = r.event_id AND er.user_id = r.user_id
        WHERE r.event_id = $1 AND r.status IN ('ATTENDING', 'MAYBE')
        ORDER BY r.id`,
      [id],
    );
  } else {
    participants = await roleBasedParticipants(id);
    if (!participants.some((p) => p.userId === e.organizer_id)) {
      const org = await findUser(e.organizer_id);
      if (org) {
        const rsvp = await one<{ status: string }>("SELECT status FROM rsvps WHERE event_id = $1 AND user_id = $2", [
          id,
          org.id,
        ]);
        participants.unshift({ userId: org.id, username: org.username, rsvpStatus: rsvp?.status ?? null, eventRole: "OWNER" });
      }
    }
  }
  return c.json(summarize(myRole, participants));
});

// ── Rollenverwaltung (nur OWNER) ─────────────────────────────────────────────

async function requireOwner(eventId: number, userId: number, db: Db) {
  if (!(await canDelete(eventId, userId, db))) throw forbidden("Event owner access required");
}

eventRoutes.put("/events/:id{[0-9]+}/roles/:targetId{[0-9]+}", async (c) => {
  const currentId = requireUser(c);
  const id = idParam(c, "id");
  const targetId = idParam(c, "targetId");
  const b = await c.req.json().catch(() => ({}));
  const result = await tx(async (db) => {
    await findEventRowOrThrow(id, db);
    await requireOwner(id, currentId, db);
    if (targetId === currentId) throw badRequest("Cannot change your own role");
    if (!(await findUser(targetId, db))) throw notFound(`User not found: ${targetId}`);
    const targetRole = await eventRoleOf(id, targetId, db);
    if (targetRole === "OWNER") throw badRequest("Cannot change the event owner's role");
    const role = oneOf(b?.role, EVENT_ROLES, "role");
    if (role === "OWNER") throw badRequest("Cannot assign OWNER role");
    await query(
      `INSERT INTO event_roles (event_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (event_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [id, targetId, role],
      db,
    );
    return summarize(await eventRoleOf(id, currentId, db), await roleBasedParticipants(id, db));
  });
  return c.json(result);
});

eventRoutes.delete("/events/:id{[0-9]+}/roles/:targetId{[0-9]+}", async (c) => {
  const currentId = requireUser(c);
  const id = idParam(c, "id");
  const targetId = idParam(c, "targetId");
  await tx(async (db) => {
    await findEventRowOrThrow(id, db);
    await requireOwner(id, currentId, db);
    if (targetId === currentId) throw badRequest("Cannot remove yourself");
    if ((await eventRoleOf(id, targetId, db)) === "OWNER") throw badRequest("Cannot remove the event owner");
    await query("DELETE FROM event_roles WHERE event_id = $1 AND user_id = $2", [id, targetId], db);
  });
  return c.body(null, 204);
});

eventRoutes.post("/events/:id{[0-9]+}/invite/regenerate", async (c) => {
  const currentId = requireUser(c);
  const id = idParam(c, "id");
  await findEventRowOrThrow(id);
  await requireOwner(id, currentId, pool);
  const token = randomUUID();
  await query("UPDATE events SET invite_token = $1 WHERE id = $2", [token, id]);
  return c.json({ inviteToken: token });
});

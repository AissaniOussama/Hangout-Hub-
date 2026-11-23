// Laden + Serialisieren der Entities im gleichen JSON-Format wie Jackson im Quarkus-Backend.
import { type Db, NOW, one, pool, query } from "./db.js";
import { notFound } from "./http.js";

function notFoundOr<T>(v: T | null, message: string): T {
  if (v == null) throw notFound(message);
  return v;
}

export type EventRole = "OWNER" | "EDITOR" | "VIEWER";
export type GroupRole = "OWNER" | "ADMIN" | "MEMBER";
export const EVENT_ROLES = ["OWNER", "EDITOR", "VIEWER"] as const;
export const RSVP_STATUSES = ["ATTENDING", "NOT_ATTENDING", "MAYBE"] as const;

export type UserJson = { id: number; username: string; email: string };

export async function findUser(id: number, db: Db = pool): Promise<UserJson | null> {
  return one<UserJson>("SELECT id, username, email FROM users WHERE id = $1", [id], db);
}

/** Wie currentUser() im Java-Code: Token gueltig, User muss aber existieren. */
export async function requireExistingUser(id: number, db: Db = pool): Promise<UserJson> {
  return notFoundOr(await findUser(id, db), "User not found");
}

// ── Events ───────────────────────────────────────────────────────────────────

type EventRow = {
  id: number;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  location: string | null;
  admission_fee: number | null;
  organizer_id: number;
  group_id: number | null;
  min_participants: number | null;
  max_participants: number | null;
  is_public: boolean;
  has_bring_list: boolean;
  series_id: number | null;
  invite_token: string | null;
};

export type EventJson = {
  id: number;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  location: string | null;
  admissionFee: number | null;
  organizer: UserJson | null;
  group: { id: number; name: string } | null;
  minParticipants: number | null;
  maxParticipants: number | null;
  isPublic: boolean;
  hasBringList: boolean;
  seriesParent: EventJson | null;
};

export async function findEventRow(id: number, db: Db = pool): Promise<EventRow | null> {
  return one<EventRow>("SELECT * FROM events WHERE id = $1", [id], db);
}

export async function findEventRowOrThrow(id: number, db: Db = pool): Promise<EventRow> {
  const row = await findEventRow(id, db);
  if (!row) throw notFound(`Event not found: ${id}`);
  return row;
}

/** Serialisiert Events inkl. organizer, group und (rekursiv) seriesParent. */
export async function eventsJson(ids: number[], db: Db = pool, depth = 0): Promise<Map<number, EventJson>> {
  const out = new Map<number, EventJson>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return out;
  const rows = await query<EventRow & { o_username: string | null; o_email: string | null; g_name: string | null }>(
    `SELECT e.*, u.username AS o_username, u.email AS o_email, g.name AS g_name
       FROM events e
       LEFT JOIN users u ON u.id = e.organizer_id
       LEFT JOIN groups g ON g.id = e.group_id
      WHERE e.id = ANY($1::bigint[])`,
    [unique],
    db,
  );
  const parentIds = rows.map((r) => r.series_id).filter((x): x is number => x != null);
  const parents = depth < 5 ? await eventsJson(parentIds, db, depth + 1) : new Map();
  for (const r of rows) {
    out.set(r.id, {
      id: r.id,
      title: r.title,
      description: r.description,
      startTime: r.start_time,
      endTime: r.end_time,
      location: r.location,
      admissionFee: r.admission_fee,
      organizer: r.o_username != null ? { id: r.organizer_id, username: r.o_username, email: r.o_email! } : null,
      group: r.group_id != null ? { id: r.group_id, name: r.g_name! } : null,
      minParticipants: r.min_participants,
      maxParticipants: r.max_participants,
      isPublic: r.is_public,
      hasBringList: r.has_bring_list,
      seriesParent: r.series_id != null ? (parents.get(r.series_id) ?? null) : null,
    });
  }
  return out;
}

export async function eventJson(id: number, db: Db = pool): Promise<EventJson> {
  const ev = (await eventsJson([id], db)).get(id);
  if (!ev) throw notFound(`Event not found: ${id}`);
  return ev;
}

/** Sortiert Events in der Reihenfolge der IDs. */
export async function eventsJsonOrdered(ids: number[], db: Db = pool): Promise<EventJson[]> {
  const map = await eventsJson(ids, db);
  return ids.map((id) => map.get(id)!).filter(Boolean);
}

// ── Event-Rollen (Event.getEventRoleOf / canEdit / canDelete / canView) ─────

export async function eventRoleOf(eventId: number, userId: number | null, db: Db = pool): Promise<EventRole | null> {
  if (userId == null) return null;
  const r = await one<{ role: EventRole }>(
    "SELECT role FROM event_roles WHERE event_id = $1 AND user_id = $2",
    [eventId, userId],
    db,
  );
  return r?.role ?? null;
}

export async function canEdit(eventId: number, userId: number | null, db: Db = pool) {
  const role = await eventRoleOf(eventId, userId, db);
  return role === "OWNER" || role === "EDITOR";
}

export async function canDelete(eventId: number, userId: number | null, db: Db = pool) {
  return (await eventRoleOf(eventId, userId, db)) === "OWNER";
}

export async function canView(event: { id: number; is_public: boolean }, userId: number | null, db: Db = pool) {
  return event.is_public || (await eventRoleOf(event.id, userId, db)) != null;
}

// ── Gruppen ──────────────────────────────────────────────────────────────────

export async function groupRoleOf(groupId: number, userId: number | null, db: Db = pool): Promise<GroupRole | null> {
  if (userId == null) return null;
  const r = await one<{ role: GroupRole }>(
    "SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2",
    [groupId, userId],
    db,
  );
  return r?.role ?? null;
}

// ── Benachrichtigungen ──────────────────────────────────────────────────────

export type NotificationType =
  | "RSVP_CHANGED"
  | "NEW_MESSAGE"
  | "INVITATION_RECEIVED"
  | "EVENT_UPDATED"
  | "POLL_CREATED"
  | "POLL_VOTE"
  | "BRING_ITEM_REMINDER";

export async function createNotification(
  db: Db,
  n: { userId: number; message: string; type: NotificationType; eventId: number | null; link: string | null },
) {
  await query(
    `INSERT INTO notifications (user_id, message, type, event_id, link, created_at) VALUES ($1, $2, $3, $4, $5, ${NOW})`,
    [n.userId, n.message, n.type, n.eventId, n.link],
    db,
  );
}

/** Benachrichtigt alle User mit Event-Rolle ausser dem Ausloeser (wie notifyParticipants). */
export async function notifyEventParticipants(
  db: Db,
  eventId: number,
  actingUserId: number,
  type: NotificationType,
  message: string,
  link: string,
) {
  await query(
    `INSERT INTO notifications (user_id, message, type, event_id, link, created_at)
     SELECT er.user_id, $3, $4, $1, $5, ${NOW}
       FROM event_roles er JOIN users u ON u.id = er.user_id
      WHERE er.event_id = $1 AND er.user_id <> $2`,
    [eventId, actingUserId, message, type, link],
    db,
  );
}

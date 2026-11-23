// GroupResource + NotificationResource
import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { type Db, one, pool, query, tx } from "../db.js";
import { type Env, badRequest, body, forbidden, idParam, notFound, requireNonBlank, requireUser } from "../http.js";
import { type GroupRole, groupRoleOf, requireExistingUser } from "../model.js";

export const groupRoutes = new Hono<Env>();

type GroupRow = { id: number; name: string; invite_token: string };

async function findGroupOrThrow(id: number, db: Db = pool): Promise<GroupRow> {
  const g = await one<GroupRow>("SELECT id, name, invite_token FROM groups WHERE id = $1", [id], db);
  if (!g) throw notFound(`Group not found: ${id}`);
  return g;
}

const isModerator = (r: GroupRole | null) => r === "OWNER" || r === "ADMIN";

async function groupJson(group: GroupRow, currentUserId: number, db: Db = pool) {
  const members = await query<{ userId: number; username: string; role: GroupRole }>(
    `SELECT gm.user_id AS "userId", COALESCE(u.username, 'Unknown') AS username, gm.role
       FROM group_members gm LEFT JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = $1 ORDER BY gm.ctid`,
    [group.id],
    db,
  );
  const myRole = members.find((m) => m.userId === currentUserId)?.role ?? null;
  return {
    id: group.id,
    name: group.name,
    myRole,
    inviteToken: isModerator(myRole) ? group.invite_token : null,
    members,
  };
}

async function requireRole(groupId: number, userId: number, ok: (r: GroupRole | null) => boolean, msg: string, db: Db) {
  const role = await groupRoleOf(groupId, userId, db);
  if (!ok(role)) throw forbidden(msg);
  return role;
}
const requireMember = (g: number, u: number, db: Db = pool) =>
  requireRole(g, u, (r) => r != null, "You are not a member of this group", db);
const requireModerator = (g: number, u: number, db: Db = pool) =>
  requireRole(g, u, isModerator, "Owner or admin access required", db);
const requireOwner = (g: number, u: number, db: Db = pool) =>
  requireRole(g, u, (r) => r === "OWNER", "Owner access required", db);

groupRoutes.get("/groups", async (c) => {
  const userId = requireUser(c);
  const groups = await query<GroupRow>(
    `SELECT g.id, g.name, g.invite_token FROM groups g
      WHERE EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = g.id AND m.user_id = $1) ORDER BY g.id`,
    [userId],
  );
  return c.json(await Promise.all(groups.map((g) => groupJson(g, userId))));
});

groupRoutes.post("/groups", async (c) => {
  const userId = requireUser(c);
  const name = requireNonBlank((await body(c)).name, "name");
  const group = await tx(async (db) => {
    await requireExistingUser(userId, db);
    const g = await one<GroupRow>(
      "INSERT INTO groups (name, invite_token) VALUES ($1, $2) RETURNING id, name, invite_token",
      [name, randomUUID()],
      db,
    );
    await query("INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'OWNER')", [g!.id, userId], db);
    return groupJson(g!, userId, db);
  });
  c.header("Location", `/api/groups/${group.id}`);
  return c.json(group, 201);
});

// Einladungslink (vor /groups/:id)
groupRoutes.get("/groups/join/:token", async (c) => {
  requireUser(c);
  const g = await one("SELECT id, name FROM groups WHERE invite_token = $1", [c.req.param("token")]);
  if (!g) throw notFound("Invalid invite token");
  return c.json(g);
});

groupRoutes.post("/groups/join/:token", async (c) => {
  const userId = requireUser(c);
  const result = await tx(async (db) => {
    const g = await one<GroupRow>("SELECT id, name, invite_token FROM groups WHERE invite_token = $1", [c.req.param("token")], db);
    if (!g) throw notFound("Invalid invite token");
    await query(
      "INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'MEMBER') ON CONFLICT (group_id, user_id) DO NOTHING",
      [g.id, userId],
      db,
    );
    return groupJson(g, userId, db);
  });
  return c.json(result);
});

groupRoutes.get("/groups/:id{[0-9]+}", async (c) => {
  const userId = requireUser(c);
  const g = await findGroupOrThrow(idParam(c, "id"));
  await requireMember(g.id, userId);
  return c.json(await groupJson(g, userId));
});

groupRoutes.put("/groups/:id{[0-9]+}", async (c) => {
  const userId = requireUser(c);
  const id = idParam(c, "id");
  const name = requireNonBlank((await body(c)).name, "name");
  await findGroupOrThrow(id);
  await requireModerator(id, userId);
  const g = await one<GroupRow>("UPDATE groups SET name = $1 WHERE id = $2 RETURNING id, name, invite_token", [name, id]);
  return c.json(await groupJson(g!, userId));
});

groupRoutes.delete("/groups/:id{[0-9]+}", async (c) => {
  const userId = requireUser(c);
  const id = idParam(c, "id");
  await findGroupOrThrow(id);
  await requireOwner(id, userId);
  await query("DELETE FROM groups WHERE id = $1", [id]);
  return c.body(null, 204);
});

groupRoutes.delete("/groups/:id{[0-9]+}/members/:targetId{[0-9]+}", async (c) => {
  const currentId = requireUser(c);
  const id = idParam(c, "id");
  const targetId = idParam(c, "targetId");
  const result = await tx(async (db) => {
    const g = await findGroupOrThrow(id, db);
    const myRole = await requireModerator(id, currentId, db);
    const targetRole = await groupRoleOf(id, targetId, db);
    if (targetRole === "OWNER") throw badRequest("Cannot kick the group owner");
    if (targetRole === "ADMIN" && myRole !== "OWNER") throw forbidden("Only the owner can remove admins");
    if (targetRole == null) throw notFound("User is not a member of this group");
    await query("DELETE FROM group_members WHERE group_id = $1 AND user_id = $2", [id, targetId], db);
    return groupJson(g, currentId, db);
  });
  return c.json(result);
});

async function setRole(groupId: number, targetId: number, role: GroupRole, db: Db) {
  const res = await query("UPDATE group_members SET role = $1 WHERE group_id = $2 AND user_id = $3 RETURNING user_id", [
    role,
    groupId,
    targetId,
  ], db);
  if (res.length === 0) throw notFound("User is not a member of this group");
}

groupRoutes.post("/groups/:id{[0-9]+}/members/:targetId{[0-9]+}/promote", async (c) => {
  const currentId = requireUser(c);
  const id = idParam(c, "id");
  const targetId = idParam(c, "targetId");
  const result = await tx(async (db) => {
    const g = await findGroupOrThrow(id, db);
    await requireOwner(id, currentId, db);
    await setRole(id, targetId, "ADMIN", db);
    return groupJson(g, currentId, db);
  });
  return c.json(result);
});

groupRoutes.post("/groups/:id{[0-9]+}/members/:targetId{[0-9]+}/demote", async (c) => {
  const currentId = requireUser(c);
  const id = idParam(c, "id");
  const targetId = idParam(c, "targetId");
  const result = await tx(async (db) => {
    const g = await findGroupOrThrow(id, db);
    await requireOwner(id, currentId, db);
    if ((await groupRoleOf(id, targetId, db)) === "OWNER") throw badRequest("Cannot demote the group owner");
    await setRole(id, targetId, "MEMBER", db);
    return groupJson(g, currentId, db);
  });
  return c.json(result);
});

groupRoutes.post("/groups/:id{[0-9]+}/invite/regenerate", async (c) => {
  const userId = requireUser(c);
  const id = idParam(c, "id");
  await findGroupOrThrow(id);
  await requireModerator(id, userId);
  const token = randomUUID();
  await query("UPDATE groups SET invite_token = $1 WHERE id = $2", [token, id]);
  return c.json({ inviteToken: token });
});

groupRoutes.delete("/groups/:id{[0-9]+}/leave", async (c) => {
  const userId = requireUser(c);
  const id = idParam(c, "id");
  await findGroupOrThrow(id);
  const role = await groupRoleOf(id, userId);
  if (role == null) throw notFound("You are not a member of this group");
  if (role === "OWNER") throw badRequest("Owner cannot leave the group — delete it or transfer ownership first");
  await query("DELETE FROM group_members WHERE group_id = $1 AND user_id = $2", [id, userId]);
  return c.body(null, 204);
});

// ── Benachrichtigungen ───────────────────────────────────────────────────────

async function notificationsJson(where: string, params: unknown[]) {
  const rows = await query(
    `SELECT n.id, n.message, n.type, n.is_read, n.created_at, n.event_id, n.link, u.id AS u_id, u.username, u.email
       FROM notifications n JOIN users u ON u.id = n.user_id WHERE ${where} ORDER BY n.created_at DESC, n.id DESC`,
    params,
  );
  return rows.map((r) => ({
    id: r.id,
    user: { id: r.u_id, username: r.username, email: r.email },
    message: r.message,
    type: r.type,
    isRead: r.is_read,
    createdAt: r.created_at,
    eventId: r.event_id,
    link: r.link,
  }));
}

groupRoutes.get("/notifications", async (c) => {
  const userId = requireUser(c);
  await requireExistingUser(userId);
  return c.json(await notificationsJson("n.user_id = $1", [userId]));
});

groupRoutes.get("/notifications/unread", async (c) => {
  const userId = requireUser(c);
  await requireExistingUser(userId);
  return c.json(await notificationsJson("n.user_id = $1 AND n.is_read = false", [userId]));
});

groupRoutes.patch("/notifications/read-all", async (c) => {
  const userId = requireUser(c);
  await requireExistingUser(userId);
  await query("UPDATE notifications SET is_read = true WHERE user_id = $1", [userId]);
  return c.body(null, 204);
});

groupRoutes.patch("/notifications/:id{[0-9]+}/read", async (c) => {
  const userId = requireUser(c);
  const id = idParam(c, "id");
  // nur eigene Benachrichtigungen (im Original fehlte die Pruefung)
  const row = await one("UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId]);
  if (!row) throw notFound("Notification not found");
  return c.json((await notificationsJson("n.id = $1", [id]))[0]);
});

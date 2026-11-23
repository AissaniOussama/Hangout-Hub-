// AuthResource + UserResource
import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { one, query } from "../db.js";
import { EMAIL, type Env, body, conflict, issueToken, requireUser } from "../http.js";
import { badRequest } from "../http.js";

export const authRoutes = new Hono<Env>();

function validEmail(v: unknown): string {
  if (typeof v !== "string" || v.trim() === "" || !EMAIL.test(v)) throw badRequest("email must be a valid email");
  return v;
}

authRoutes.post("/auth/register", async (c) => {
  const b = await body(c);
  const username = b.username;
  if (typeof username !== "string" || username.trim() === "" || username.length < 3 || username.length > 50) {
    throw badRequest("username must be between 3 and 50 characters");
  }
  const email = validEmail(b.email);
  const password = b.password;
  if (typeof password !== "string" || password.trim() === "" || password.length < 8) {
    throw badRequest("password must be at least 8 characters");
  }

  if (await one("SELECT 1 FROM users WHERE email = $1", [email])) throw conflict("Email already in use");
  if (await one("SELECT 1 FROM users WHERE username = $1", [username])) throw conflict("Username already taken");

  // $2a$ wie Quarkus BcryptUtil, damit bestehende und neue Hashes kompatibel bleiben
  const hash = (await bcrypt.hash(password, 10)).replace(/^\$2b\$/, "$2a$");
  const user = await one<{ id: number }>(
    "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
    [username, email, hash],
  ).catch((e) => {
    if (e?.code === "23505") throw conflict("Email or username already in use");
    throw e;
  });
  const id = user!.id;
  return c.json({ token: await issueToken({ id, email }), userId: id, username, email }, 201);
});

authRoutes.post("/auth/login", async (c) => {
  const b = await body(c);
  const email = validEmail(b.email);
  if (typeof b.password !== "string" || b.password.trim() === "") throw badRequest("password must not be blank");
  const user = await one<{ id: number; username: string; email: string; password_hash: string }>(
    "SELECT id, username, email, password_hash FROM users WHERE email = $1",
    [email],
  );
  if (!user || !(await bcrypt.compare(b.password, user.password_hash))) {
    return c.json({ error: "Invalid credentials" }, 401);
  }
  return c.json({ token: await issueToken(user), userId: user.id, username: user.username, email: user.email });
});

/** Suche nach Username-Prefix, max. 10 Treffer. */
authRoutes.get("/users/search", async (c) => {
  requireUser(c);
  const q = c.req.query("q");
  if (q == null || q.trim().length < 2) return c.json([]);
  const rows = await query("SELECT id, username FROM users WHERE LOWER(username) LIKE LOWER($1) LIMIT 10", [
    q.trim() + "%",
  ]);
  return c.json(rows);
});

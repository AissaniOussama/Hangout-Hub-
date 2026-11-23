// HTTP-Fehler, Auth und Validierung (Ersatz fuer JAX-RS-Exceptions, smallrye-jwt, Bean Validation).
import type { Context, MiddlewareHandler } from "hono";
import { sign, verify } from "hono/jwt";
import { createHash } from "node:crypto";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (m: string) => new HttpError(400, m);
export const forbidden = (m: string) => new HttpError(403, m);
export const notFound = (m: string) => new HttpError(404, m);
export const conflict = (m: string) => new HttpError(409, m);

// ── JWT ──────────────────────────────────────────────────────────────────────

const ISSUER = "https://hangouthub.de";

/**
 * Signierschluessel: JWT_SECRET falls gesetzt, sonst aus dem DB-Passwort abgeleitet.
 * So braucht das Deployment kein extra Secret; aendert sich das DB-Passwort,
 * muessen sich alle neu einloggen.
 */
function jwtSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const pw = new URL(process.env.DATABASE_URL ?? process.env.HANGOUTHUB_DATABASE_URL ?? "").password;
  if (!pw) throw new Error("Kein JWT-Secret verfuegbar");
  return createHash("sha256").update(`hangouthub-jwt:${pw}`).digest("hex");
}

export async function issueToken(user: { id: number; email: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    { iss: ISSUER, sub: String(user.id), upn: user.email, groups: ["user"], iat: now, exp: now + 24 * 3600 },
    jwtSecret(),
    "HS256",
  );
}

export type Env = { Variables: { userId: number | null } };

/**
 * Liest ein optionales Bearer-Token. Wie bei Quarkus (proaktive Auth) fuehrt ein
 * vorhandenes, aber ungueltiges Token zu 401 - auch bei oeffentlichen Endpunkten.
 */
export const auth: MiddlewareHandler<Env> = async (c, next) => {
  c.set("userId", null);
  const header = c.req.header("Authorization");
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = await verify(header.slice(7), jwtSecret(), "HS256");
      if (payload.iss !== ISSUER) throw new Error("issuer");
      const id = Number(payload.sub);
      if (!Number.isInteger(id)) throw new Error("sub");
      c.set("userId", id);
    } catch {
      return c.json({ error: "Invalid or expired token" }, 401);
    }
  }
  await next();
};

/** Entspricht @RolesAllowed("user"). */
export function requireUser(c: Context<Env>): number {
  const id = c.get("userId");
  if (id == null) throw new HttpError(401, "Authentication required");
  return id;
}

// ── Validierung ─────────────────────────────────────────────────────────────

export async function body(c: Context): Promise<Record<string, any>> {
  const b = await c.req.json().catch(() => null);
  if (!b || typeof b !== "object" || Array.isArray(b)) throw badRequest("JSON body expected");
  return b;
}

export const isBlank = (v: unknown) => typeof v !== "string" || v.trim() === "";

export function requireNonBlank(v: unknown, field: string): string {
  if (isBlank(v)) throw badRequest(`${field} must not be blank`);
  return v as string;
}

export function optString(v: unknown, field: string): string | null {
  if (v == null) return null;
  if (typeof v !== "string") throw badRequest(`${field} must be a string`);
  return v;
}

export function optInt(v: unknown, field: string): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isInteger(n)) throw badRequest(`${field} must be an integer`);
  return n;
}

export function optBool(v: unknown, field: string): boolean | null {
  if (v == null) return null;
  if (typeof v !== "boolean") throw badRequest(`${field} must be a boolean`);
  return v;
}

const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** LocalDateTime: Zeitzonen-Suffix wird wie bei Jackson ignoriert (Wanduhrzeit). */
export function optDateTime(v: unknown, field: string): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string" || !DATE_TIME.test(v)) throw badRequest(`${field} must be an ISO date-time`);
  return v.replace(/(Z|[+-]\d{2}:\d{2})$/, "");
}

export function optDate(v: unknown, field: string): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string" || !DATE.test(v)) throw badRequest(`${field} must be an ISO date`);
  return v;
}

export function oneOf<T extends string>(v: unknown, allowed: readonly T[], field: string): T {
  if (typeof v !== "string" || !allowed.includes(v as T)) {
    throw badRequest(`${field} must be one of ${allowed.join(", ")}`);
  }
  return v as T;
}

export const EMAIL = /^[^\s@]+@[^\s@]+$/;

/** Numerischer Pfadparameter; nicht-numerisch -> 404 wie bei JAX-RS. */
export function idParam(c: Context, name: string): number {
  const v = Number(c.req.param(name));
  if (!Number.isSafeInteger(v)) throw notFound("Not found");
  return v;
}

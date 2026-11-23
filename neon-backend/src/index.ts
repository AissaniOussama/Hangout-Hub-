// HangoutHub-Backend als Neon Function: REST-API (/api), Chat-WebSocket (/ws) und das gebaute
// Vue-Frontend unter derselben Adresse. Ersetzt das Quarkus-Backend 1:1 (gleiche Endpunkte/JSON).
import { Hono } from "hono";
import { upgradeWebSocket } from "@neon/functions/hono";
import { parseTriggerDelivery } from "@neon/functions/triggers";
import { HttpError, auth, type Env } from "./http.js";
import { authRoutes } from "./routes/auth.js";
import { eventRoutes } from "./routes/events.js";
import { eventSubRoutes, remindUpcomingEvents } from "./routes/event-sub.js";
import { pollRoutes } from "./routes/polls.js";
import { groupRoutes } from "./routes/groups.js";
import { STATIC_FILES } from "./static.generated.js";

const app = new Hono<Env>();

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status as any);
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

// ── API ──────────────────────────────────────────────────────────────────────

const api = new Hono<Env>();
api.use("*", auth);
api.route("/", authRoutes);
api.route("/", eventRoutes);
api.route("/", eventSubRoutes);
api.route("/", pollRoutes);
api.route("/", groupRoutes);
api.all("*", (c) => c.json({ error: "Not found" }, 404));
app.route("/api", api);

// ── Chat-WebSocket ───────────────────────────────────────────────────────────
// Wie ChatSocket.java: Begruessung beim Verbinden, eingehende Texte an alle
// Verbindungen desselben Events weiterleiten.

const chatRooms = new Map<string, Set<WebSocket>>();

app.get(
  "/ws/chat/:eventId",
  upgradeWebSocket((c) => {
    const eventId = c.req.param("eventId") ?? "";
    return {
      onOpen(_e, ws) {
        const room = chatRooms.get(eventId) ?? new Set();
        room.add(ws.raw as WebSocket);
        chatRooms.set(eventId, room);
        ws.send(JSON.stringify({ type: "connected", eventId }));
      },
      onMessage(e) {
        const data = typeof e.data === "string" ? e.data : String(e.data);
        for (const peer of chatRooms.get(eventId) ?? []) {
          if (peer.readyState === 1) peer.send(data);
        }
      },
      onClose(_e, ws) {
        const room = chatRooms.get(eventId);
        room?.delete(ws.raw as WebSocket);
        if (room && room.size === 0) chatRooms.delete(eventId);
      },
    };
  }),
);

// ── Taegliche Mitbringlisten-Erinnerung (Neon Function Trigger) ──────────────

app.post("/internal/cron/bring-reminder", async (c) => {
  const parsed = await parseTriggerDelivery(c.req.raw);
  if (!parsed.ok) return c.text(parsed.error, parsed.error === "invalid_body" ? 400 : 401);
  const notified = await remindUpcomingEvents();
  return c.json({ notified });
});

// ── Frontend (SPA) ───────────────────────────────────────────────────────────

function serveStatic(path: string) {
  const file = STATIC_FILES[path];
  if (!file) return null;
  const headers: Record<string, string> = { "Content-Type": file.type };
  headers["Cache-Control"] = path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache";
  return new Response(Buffer.from(file.data, "base64"), { headers });
}

app.get("*", (c) => {
  const path = c.req.path;
  return serveStatic(path) ?? serveStatic("/index.html") ?? c.text("Frontend not built", 404);
});

export default app;

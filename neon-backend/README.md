# HangoutHub auf Neon

Backend + Frontend laufen als **eine Neon Function** neben der Neon-Postgres-Datenbank:

**Live:** https://br-twilight-base-bdscf6vp-hangouthub.compute.c-8.us-east-2.aws.neon.tech

- `src/` – TypeScript-Port des Quarkus-Backends (Hono + node-postgres), gleiche Endpunkte und gleiches JSON,
  damit das Vue-Frontend unverändert bleibt.
- Das gebaute Frontend (`../frontend/dist`) wird beim Deploy eingebettet und unter derselben Adresse ausgeliefert
  (`/api`, `/ws` und die SPA teilen sich eine Origin – kein CORS, kein extra Hosting).
- Datenbank: `hangouthub` im Neon-Projekt (Schema = Flyway-Migrationen `V1`–`V8` aus `backend/`).
- Chat: WebSocket `/ws/chat/{eventId}` wie `ChatSocket.java`.
- Tägliche Mitbringlisten-Erinnerung: Neon Function Trigger (`neon.ts`, 08:00 UTC).
- JWT: HS256, Schlüssel aus `JWT_SECRET` oder – falls nicht gesetzt – aus dem DB-Passwort abgeleitet.

## Deployen

```bash
npm install
neon login            # oder API-Key-Profil
npm run deploy        # baut Frontend, bettet es ein, Typecheck, neon deploy
```

## Lokal

```bash
HANGOUTHUB_DATABASE_URL=postgresql://user:pw@localhost:5432/hangouthub JWT_SECRET=dev \
  neon dev --source src/index.ts --port 8787
```

Vorher `npm run build:frontend && npm run embed`, damit das Frontend eingebettet ist.

## Schema-Änderungen

Neue Migrationen weiterhin in `backend/src/main/resources/db/migration/` anlegen und auf der Neon-Datenbank
ausführen (z.B. `psql "$URL" -f V9__...sql`). Das Quarkus-Backend würde die bereits angewendeten Migrationen
ohne Flyway-Historie nicht erkennen – dafür `quarkus.flyway.baseline-on-migrate=true` und
`quarkus.flyway.baseline-version=8` setzen.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow rules

- Run tests before committing backend changes: `cd backend && mvn test`
- Every change must be its own commit (no bundling unrelated fixes)
- Always run `cd frontend && npm run build` before committing frontend changes to catch TypeScript errors
- Commit finished work without waiting to be asked each time — don't leave a completed change uncommitted at the end of a task. This still means splitting backend/frontend and unrelated changes into separate commits per the rules above, and never pushing or force-pushing without explicit approval.

## Commands

### Backend (Quarkus / Maven) — run from `backend/`

```bash
mvn quarkus:dev          # dev server with hot reload on :8080
mvn test                 # run all tests (requires Docker DB running)
mvn test -Dtest=EventResourceTest                    # run a single test class
mvn test -Dtest=EventResourceTest#listUpcoming_returnsOk  # run a single test method
mvn compile              # compile only
mvn package -DskipTests  # build fat JAR
```

### Frontend (Vite / Vue) — run from `frontend/`

```bash
npm run dev      # dev server on :5173 with proxy to :8080
npm run build    # TypeScript check + production build
npm run preview  # serve the production build locally
```

### Database

```bash
docker-compose up -d     # start PostgreSQL on localhost:5432
docker-compose down      # stop
docker-compose down -v   # stop and wipe all data (triggers fresh Flyway migration)
```

### First-time setup (after cloning)

```bash
# macOS / Linux / Git Bash on Windows
docker-compose up -d
bash scripts/generate-dev-keys.sh

# Windows (PowerShell, without Git Bash)
docker-compose up -d
.\scripts\generate-dev-keys.ps1

cd backend && mvn quarkus:dev
cd frontend && npm install && npm run dev
```

## Architecture

### Request flow

```
Browser (Vue, :5173)
  → Vite dev proxy /api/* and /ws/*
  → Quarkus (:8080)
  → Hibernate ORM / Panache
  → PostgreSQL (:5432)
```

In production, the proxy is replaced by a real reverse proxy. The CORS config in `application.properties` already allows `localhost:5173`.

### Backend package structure (`de.hangouthub`)

Each domain area is a self-contained package with its own entity, resource (JAX-RS), and optionally a service:

| Package        | Responsibility                                               |
|----------------|--------------------------------------------------------------|
| `user`         | `User` entity, `AuthResource` (register + login → JWT)      |
| `event`        | `Event` CRUD via `EventService` + `EventResource`           |
| `rsvp`         | RSVP upsert per event/user pair                             |
| `invitation`   | Shareable invite links with a UUID code                     |
| `chat`         | REST history (`ChatResource`) + live broadcast (`ChatSocket`) |
| `poll`         | Polls with options and vote counting                        |
| `bringlist`    | Bring-along items with claim/unclaim                        |
| `notification` | In-app notifications, mark read                             |

### Entity design

All entities extend `PanacheEntityBase` (not `PanacheEntity`) with an explicit:

```java
@Id
@GeneratedValue(strategy = GenerationType.IDENTITY)
public Long id;
```

`IDENTITY` maps to PostgreSQL's `BIGSERIAL` — do not switch to `SEQUENCE`, as the DB schema does not define Hibernate-style `{table}_seq` sequences.

The `CamelCaseToUnderscoresNamingStrategy` is active, so Java field names (`startTime`, `admissionFee`) map to snake_case columns (`start_time`, `admission_fee`). Keep Flyway SQL and Java fields consistent.

### Authentication

- `AuthResource` issues RS256-signed JWTs. The signing key (`privateKey.pem`) and verification key (`publicKey.pem`) live in `backend/src/main/resources/` and are **gitignored**.
- Protected endpoints use `@RolesAllowed("user")`. The current user is retrieved by reading `jwt.getSubject()` (which contains the user's database ID as a string) and doing a Panache lookup.
- Tests use pre-committed test keys in `src/test/resources/` and do a real register → login → action flow (no `@TestSecurity` mocking).

### Frontend state & API

- `src/services/api.ts` — single Axios instance; attaches `Authorization: Bearer <token>` from `localStorage` and redirects to `/login` on 401.
- `src/stores/authStore.ts` — Pinia store for session state; also exports Zod schemas (`LoginSchema`, `RegisterSchema`) used directly in view components.
- `src/stores/eventStore.ts` — exports `CreateEventSchema` for form validation.
- All domain types are in `src/types/index.ts` — update this when changing backend models.

### WebSocket (chat)

`ChatSocket.java` handles `/ws/chat/{eventId}`. On a text message it broadcasts to all connections filtered by the same `eventId` path param. The frontend (`ChatView.vue`) connects via `new WebSocket('/ws/chat/{id}')` — the Vite proxy forwards the WS upgrade automatically.

### Database migrations

Flyway runs automatically on startup (`quarkus.flyway.migrate-at-start=true`). Migration files go in `backend/src/main/resources/db/migration/` with the naming convention `V{n}__{description}.sql`. After changing the schema, wipe the dev DB with `docker-compose down -v && docker-compose up -d` to trigger a clean migration.

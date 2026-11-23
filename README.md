# HangoutHub

> Weil das Abhängen sich nicht an der Planung aufhängen sollte

**Modul:** Komponentenbasierte Entwicklung, SoSe 26
**Team:** Luca John Herzke, Oussama Badr-Eddine Aissani

---

## The Problem

A new chat group for every celebration.

You or someone in your circle of friends wants to celebrate, and almost every time the planning starts the same way: yet another WhatsApp group.

The location and time get lost somewhere in the chat history. RSVPs? Nobody really knows — you end up scrolling through endless messages just to find out who's coming. Halfway through planning, someone leaves the group, and the overview is gone again. Polls or bring-lists then require yet another app on top of that.

Planning feels like a second job, when it should be pure anticipation.

## Project Goal

One app, one link: the whole celebration organized.

- **One link** — invite instead of explain: friends join directly via a shared link, no app-store detour or account setup required to view an event.
- **Everything in one place** — RSVP, chat, polls, and bring-list all live inside the same event.
- **No chat chaos** — structure instead of endless group messages.

## What HangoutHub Is Today

HangoutHub is a web app for planning private events — birthdays, parties, potlucks, spontaneous meetups — without the chaos of messenger group chats. A user creates an event, shares an invite link, and everyone who joins can RSVP, chat, vote in polls, and claim items on a bring-list, all scoped to that one event.

Events can optionally belong to a **friend group** (e.g. "WG Nachbarn" or "Volleyball Team"), so recurring circles of friends don't have to re-share invite links for every new event. Groups have their own membership, roles (owner/admin/member), and invite links, independent of any single event.

Current capabilities:

- Email/password registration and login (JWT-based sessions)
- Create, edit, delete, and browse events — with search, date-range filters, and pagination
- Public vs. private events; private events are only visible to invited participants or group members
- Per-event roles (organizer, co-organizer, participant) and per-group roles (owner, admin, member)
- Shareable invite links for both events and groups, with regeneration support
- RSVP tracking (attending / maybe / declined) per event
- Simple forum chat
- Polls with multiple options and vote/retract-vote support
- Bring-along list with claim/unclaim and reminder notifications for unclaimed items
- In-app notifications (read/unread, mark-as-read)
- Calendar view of upcoming events with map preview (Leaflet + OpenStreetMap geocoding) for event locations
- `.ics` calendar export for any event
- Min/max participant limits on events

---

## Components

### Backend

| Package        | Responsibility                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| `user`         | `User` entity plus `AuthResource` (register/login → JWT) and user search                              |
| `event`        | `Event` CRUD, visibility rules, roles, invite links, `.ics` export (`EventService` + `EventResource`) |
| `group`        | Friend groups: membership, roles (owner/admin/member), invite links (`GroupResource`)                 |
| `rsvp`         | RSVP upsert (attending/maybe/declined) per event/user pair                                            |
| `invitation`   | Legacy shareable invite links with a UUID code, accepted via `/accept/{code}`                         |
| `chat`         | REST message history (`ChatResource`)                                                                 |
| `poll`         | Polls with options, voting, vote retraction, and closing                                              |
| `bringlist`    | Bring-along items with claim/unclaim and reminder notifications                                       |
| `notification` | In-app notifications, unread count, mark read / mark all read                                         |

### Frontend

| Area                 | Contents                                                                                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `views/`             | Page-level routes: `HomeView`, `CalendarView`, `EventDetailView`, `EventJoinView`, `GroupsView`, `GroupDetailView`, `GroupJoinView`, `ChatView`, `LoginView`, `RegisterView` |
| `components/event/`  | `EventForm`, `EventCard`, `EventBringList`, `EventPolls`, `LeafletMap` (location preview), `LocationAutocomplete`, `RouteButton`                                             |
| `components/layout/` | `AppHeader`, `AppLogo`, `NotificationBell`                                                                                                                                   |
| `stores/`            | Pinia state: `authStore` (session + `LoginSchema`/`RegisterSchema`), `eventStore` (`CreateEventSchema`)                                                                      |
| `services/`          | `api.ts` — single Axios instance, attaches JWT, redirects to `/login` on 401                                                                                                 |
| `types/`             | Shared TypeScript types mirroring the backend models                                                                                                                         |

---

## Tech Stack

| Layer      | Technology                                                     |
| ---------- | -------------------------------------------------------------- |
| Backend    | Java 21, Quarkus 3.15 (Maven)                                  |
| Frontend   | Vue 3, TypeScript, Vite                                        |
| UI         | PrimeVue 4 + Tailwind CSS v4                                   |
| Maps       | Leaflet + OpenStreetMap Nominatim (geocoding)                  |
| Database   | PostgreSQL 17, Flyway migrations                               |
| Auth       | JWT (RSA, via SmallRye JWT)                                    |
| State      | Pinia                                                          |
| Validation | Zod (frontend), Hibernate Validator (backend)                  |
| HTTP       | Axios                                                          |
| Testing    | JUnit 5, REST-assured (backend); Vitest, Playwright (frontend) |

---

## Prerequisites

- Java 21+
- Maven 3.9+
- Node.js 20+
- Docker (for the PostgreSQL dev container)
- OpenSSL (for key generation, usually pre-installed)

---

## Dev Setup

### 1. Start the database

```bash
docker-compose up -d
```

This starts a PostgreSQL 17 container on `localhost:5432` with database `hangouthub`.
Flyway runs the schema migration automatically on the first backend start.

### 2. Generate JWT keys (one-time)

**macOS / Linux / Git Bash on Windows**

```bash
bash scripts/generate-dev-keys.sh
```

**Windows (PowerShell)**

```powershell
.\scripts\generate-dev-keys.ps1
```

Both scripts produce `backend/src/main/resources/privateKey.pem` and `publicKey.pem`.
These files are **gitignored** — run the script once after cloning.

> The PowerShell script looks for OpenSSL on your `PATH` first, then falls back to the copy bundled with Git for Windows (`C:\Program Files\Git\usr\bin\openssl.exe`). If neither is found it prints install instructions.

### 3. Start the backend

```bash
cd backend
mvn quarkus:dev
```

The backend starts on **http://localhost:8080**.
Swagger UI is available at **http://localhost:8080/swagger-ui**.

Hot reload is enabled — changes to Java files are picked up automatically.

### 4. Start the frontend

```bash
cd frontend
npm install       # first time only
npm run dev
```

The frontend starts on **http://localhost:5173**.
All `/api` and `/ws` requests are proxied to the backend, so no CORS issues.

---

## Project Structure

```
hangouthub/
├── docker-compose.yml              # PostgreSQL dev container
├── scripts/
│   └── generate-dev-keys.sh        # One-time RSA key generation for JWT
├── backend/                        # Quarkus application
│   └── src/main/java/de/hangouthub/
│       ├── user/          User entity, register & login (JWT), user search
│       ├── event/         Event CRUD, visibility, roles, invites, ICS export
│       ├── group/         Friend groups: membership, roles, invite links
│       ├── rsvp/          RSVP management
│       ├── invitation/    Legacy invite links (UUID code)
│       ├── chat/          REST messages
│       ├── poll/          Polls & voting
│       ├── bringlist/     Bring-along list & reminders
│       └── notification/  In-app notifications
└── frontend/                       # Vue 3 application
    └── src/
        ├── views/         Page-level components
        ├── components/    Reusable UI components (event/, layout/)
        ├── stores/        Pinia state (auth, events)
        ├── services/      Axios API client
        └── types/         Shared TypeScript types
```

---

## API Overview

### Auth & users

| Method | Path                 | Auth | Description                           |
| ------ | -------------------- | ---- | ------------------------------------- |
| `POST` | `/api/auth/register` | —    | Register a new user                   |
| `POST` | `/api/auth/login`    | —    | Login, returns JWT                    |
| `GET`  | `/api/users/search`  | JWT  | Search users (e.g. to add to a group) |

### Events

| Method   | Path                                         | Auth | Description                                                                                 |
| -------- | -------------------------------------------- | ---- | ------------------------------------------------------------------------------------------- |
| `GET`    | `/api/events`                                | —    | List upcoming events (search, group, date range, pagination; more results if authenticated) |
| `GET`    | `/api/events/{id}`                           | —    | Get event details                                                                           |
| `POST`   | `/api/events`                                | JWT  | Create an event                                                                             |
| `PUT`    | `/api/events/{id}`                           | JWT  | Update an event (organizer)                                                                 |
| `DELETE` | `/api/events/{id}`                           | JWT  | Delete an event (organizer)                                                                 |
| `GET`    | `/api/events/{id}/export.ics`                | —    | Download event as `.ics` calendar file                                                      |
| `GET`    | `/api/events/{id}/participants`              | JWT  | List participants with RSVP + role                                                          |
| `PUT`    | `/api/events/{id}/roles/{targetId}`          | JWT  | Set a participant's event role                                                              |
| `DELETE` | `/api/events/{id}/roles/{targetId}`          | JWT  | Remove a participant's role                                                                 |
| `POST`   | `/api/events/{id}/invite/regenerate`         | JWT  | Regenerate the event's invite token                                                         |
| `GET`    | `/api/events/join/{token}`                   | —    | Preview an event via invite token                                                           |
| `POST`   | `/api/events/join/{token}`                   | JWT  | Join an event via invite token                                                              |
| `PUT`    | `/api/events/{id}/rsvp`                      | JWT  | Set RSVP status                                                                             |
| `GET`    | `/api/events/{id}/rsvp`                      | JWT  | List RSVPs for an event                                                                     |
| `POST`   | `/api/events/{id}/invitations`               | JWT  | Create a legacy invite link                                                                 |
| `GET`    | `/api/events/{id}/invitations/accept/{code}` | JWT  | Accept a legacy invite link                                                                 |

### Groups

| Method   | Path                                          | Auth | Description                         |
| -------- | --------------------------------------------- | ---- | ----------------------------------- |
| `GET`    | `/api/groups`                                 | JWT  | List the current user's groups      |
| `POST`   | `/api/groups`                                 | JWT  | Create a group                      |
| `GET`    | `/api/groups/{id}`                            | JWT  | Get group details                   |
| `PUT`    | `/api/groups/{id}`                            | JWT  | Rename a group                      |
| `DELETE` | `/api/groups/{id}`                            | JWT  | Delete a group                      |
| `DELETE` | `/api/groups/{id}/members/{targetId}`         | JWT  | Remove a member                     |
| `POST`   | `/api/groups/{id}/members/{targetId}/promote` | JWT  | Promote a member to admin           |
| `POST`   | `/api/groups/{id}/members/{targetId}/demote`  | JWT  | Demote an admin to member           |
| `POST`   | `/api/groups/{id}/invite/regenerate`          | JWT  | Regenerate the group's invite token |
| `GET`    | `/api/groups/join/{token}`                    | —    | Preview a group via invite token    |
| `POST`   | `/api/groups/join/{token}`                    | JWT  | Join a group via invite token       |
| `DELETE` | `/api/groups/{id}/leave`                      | JWT  | Leave a group                       |

### Chat, polls & bring-list

| Method   | Path                                                      | Auth | Description                        |
| -------- | --------------------------------------------------------- | ---- | ---------------------------------- |
| `GET`    | `/api/events/{id}/messages`                               | JWT  | Load chat history                  |
| `POST`   | `/api/events/{id}/messages`                               | JWT  | Send a chat message                |
| `GET`    | `/api/events/{id}/polls`                                  | JWT  | List polls for an event            |
| `POST`   | `/api/events/{id}/polls`                                  | JWT  | Create a poll                      |
| `POST`   | `/api/events/{id}/polls/{pollId}/options/{optionId}/vote` | JWT  | Vote on a poll option              |
| `DELETE` | `/api/events/{id}/polls/{pollId}/options/{optionId}/vote` | JWT  | Retract a vote                     |
| `POST`   | `/api/events/{id}/polls/{pollId}/close`                   | JWT  | Close a poll                       |
| `DELETE` | `/api/events/{id}/polls/{pollId}`                         | JWT  | Delete a poll                      |
| `GET`    | `/api/events/{id}/bring-items`                            | JWT  | List bring-along items             |
| `POST`   | `/api/events/{id}/bring-items`                            | JWT  | Add item to bring list             |
| `DELETE` | `/api/events/{id}/bring-items/{itemId}`                   | JWT  | Remove item from bring list        |
| `POST`   | `/api/events/{id}/bring-items/{itemId}/claim`             | JWT  | Claim an item                      |
| `DELETE` | `/api/events/{id}/bring-items/{itemId}/claim`             | JWT  | Unclaim an item                    |
| `POST`   | `/api/events/{id}/bring-items/remind`                     | JWT  | Send reminders for unclaimed items |

### Notifications

| Method  | Path                           | Auth | Description                    |
| ------- | ------------------------------ | ---- | ------------------------------ |
| `GET`   | `/api/notifications`           | JWT  | List notifications             |
| `GET`   | `/api/notifications/unread`    | JWT  | List unread notifications      |
| `PATCH` | `/api/notifications/{id}/read` | JWT  | Mark a notification as read    |
| `PATCH` | `/api/notifications/read-all`  | JWT  | Mark all notifications as read |

Full interactive docs: **http://localhost:8080/swagger-ui**

---

## Running Tests

```bash
cd backend
mvn test
```

Tests run against the local PostgreSQL container (must be running).
Test JWT keys are pre-committed in `src/test/resources/` and are used automatically.

```bash
cd frontend
npm run test      # unit tests (Vitest)
npm run test:e2e  # end-to-end tests (Playwright)
```

---

## Important Notes

**JWT keys are gitignored.**
`privateKey.pem` and `publicKey.pem` in `backend/src/main/resources/` must be generated locally with `scripts/generate-dev-keys.sh`. Never commit production keys.

**Database schema is managed by Flyway.**
Migration scripts live in `backend/src/main/resources/db/migration/`. Adding new migrations follows the `V{n}__description.sql` naming convention.

**Hibernate uses snake_case column names.**
The `CamelCaseToUnderscoresNamingStrategy` is active, so Java field `startTime` maps to column `start_time`. Keep the Flyway SQL and entity fields consistent.

**Frontend proxies all API calls.**
The Vite dev server proxies `/api/*` → `localhost:8080/api/*`. No CORS configuration is needed during development.

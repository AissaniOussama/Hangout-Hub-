# HangoutHub2 – Agent Instructions

This file documents the project architecture and the incremental feature extensions
added in the June 2026 sprint. Any AI agent working on this repository MUST read
this file before making changes.

---

## Project Stack

| Layer    | Technology                                      |
|----------|-------------------------------------------------|
| Backend  | Quarkus 3.15, Panache ORM, PostgreSQL, Flyway   |
| Frontend | Vue 3, Pinia, PrimeVue 4, Vite, TypeScript, Zod |
| Auth     | SmallRye JWT (single `user` role in token)      |

---

## Core Principles

- **Extend, do not rewrite.** Add new fields/classes; avoid touching unrelated code.
- All new DB columns go into a new Flyway migration (`V3__...sql`, `V4__...sql`, …).
- Frontend types live in `frontend/src/types/index.ts` – keep them in sync with the backend.
- Validation lives in two places: Zod schema in `eventStore.ts` (client) and Bean Validation / manual checks in `EventService.java` (server).

---

## Feature Map (added in V2 sprint)

### Feature 1 – Group System
- **Backend:** `de.hangouthub.group.Group` entity + `GroupResource` REST API
- **DB:** `groups` + `group_members` tables in `V2__groups_and_event_extensions.sql`
- **Event link:** `Event.group` (nullable `@ManyToOne`)
- **Visibility filter:** `Event.findUpcomingForUser(groupIds)` – public events OR events in user's groups

### Feature 2 – Location Map Preview
- **Frontend only:** `LeafletMap.vue` component (dynamic import of Leaflet)
- Geocodes via Nominatim (free, no API key)
- Graceful fallback if location is invalid or geocoding fails
- Used in `EventDetailView.vue`

### Feature 3 – Improved Event Data Structure
- New fields on `Event`: `minParticipants`, `maxParticipants`, `isPublic`, `seriesParent`
- Mirrored in `CreateEventRequest` record and `types/index.ts`

### Feature 4 – Edge Case Handling
- `maxParticipants >= minParticipants` validated in `EventService.validateParticipantLimits()`
- Duplicate RSVP prevention: existing `UNIQUE(event_id, user_id)` constraint in DB + upsert in `RsvpResource`
- Duplicate bring-item claim: HTTP 409 in `BringListResource.claim()`
- Empty location handled in `IcsGenerator` and `LeafletMap.vue`

### Feature 5 – ICS Export
- `IcsGenerator.java` – pure string generation (RFC 5545), no external library
- Endpoint: `GET /api/events/{id}/export.ics` (returns `text/calendar`)
- Frontend: download link in `EventDetailView.vue`

### Feature 6 – Potluck / Reminder
- `BringItem.reminderSent` flag (DB column `reminder_sent`)
- `POST /api/events/{eventId}/bring-items/remind` – organizer sends notifications to ATTENDING users without a claimed item
- New `NotificationType.BRING_ITEM_REMINDER`

### Feature 7 – Chat
- Already fully implemented (REST + WebSocket). No changes needed.
- `ChatResource` + `ChatSocket` + `ChatView.vue` cover the requirement.

### Feature 8 – Roles (Light Version)
- Roles: **organizer** (tracked via `events.organizer_id`) and **user**
- `EventService.update()` checks organizer before allowing updates
- Frontend: edit button in `EventDetailView.vue` shown only to the organizer (`canEdit` computed)

### Optional Nice-to-Have
- **Public/private flag:** `Event.isPublic` (default `true`), shown as badge in detail view
- **Event series:** `Event.seriesParent` self-referencing FK, shown as link in detail view
- **Guest mode / ESLint / Vitest:** see below

---

## Frontend Tooling

### ESLint
- Config: `frontend/eslint.config.js` (ESLint v9 flat config)
- Run: `pnpm lint`

### Vitest (replaces Jest for Vite projects)
- Config: `frontend/vitest.config.ts`
- Example tests: `frontend/src/__tests__/eventStore.spec.ts`
- Run: `pnpm test`

---

## Database Migrations

| File                                    | Contents                                      |
|-----------------------------------------|-----------------------------------------------|
| `V1__initial_schema.sql`                | Original schema (users, events, rsvps, …)     |
| `V2__groups_and_event_extensions.sql`   | Groups, group_members, event column additions |

---

## Adding New Features

1. Create a Flyway migration `Vn__description.sql`.
2. Update the JPA entity and `CreateEventRequest` record.
3. Update `types/index.ts` on the frontend.
4. Add/extend the Zod schema in `eventStore.ts` if new form fields are needed.
5. Update this `AGENTS.md`.

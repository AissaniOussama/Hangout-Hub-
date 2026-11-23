# HangoutHub2 – Feature Extension Summary

> Sprint: June 2026 | Approach: incremental, non-invasive additions

---

## Overview

All 8 features from the specification have been implemented as **minimal, modular additions** to the existing Quarkus + Vue 3 codebase. No existing logic was rewritten; every change either adds a new file or appends optional fields/methods to existing ones.

---

## Feature 1 – Group System

**Approach:** New entity + REST resource, optional FK on `events`.

| File | Action |
|------|--------|
| `backend/…/group/Group.java` | **NEW** – Panache entity with `id`, `name`, `members: List<Long>` |
| `backend/…/group/GroupResource.java` | **NEW** – `GET /api/groups`, `POST`, `POST /{id}/join`, `DELETE /{id}/leave` |
| `backend/…/event/Event.java` | **MODIFIED** – added `group`, `minParticipants`, `maxParticipants`, `isPublic`, `seriesParent`; new `findUpcomingForUser()` |
| `backend/…/event/EventService.java` | **MODIFIED** – `findUpcomingForUser()`, `applyFields()` helper, `assertCanEdit()` |
| `backend/…/event/EventResource.java` | **MODIFIED** – group-aware `listUpcoming()`, co-creator endpoints, ICS export |
| `V2__groups_and_event_extensions.sql` | **NEW** – `groups`, `group_members`, `event_co_creators` tables; new event columns |
| `frontend/src/types/index.ts` | **MODIFIED** – added `Group` interface; extended `Event`, `BringItem`, `Notification` |

**Why this approach:** Storing member IDs as an `@ElementCollection` avoids a heavy `@ManyToMany` with `User` objects while keeping the query simple. Visibility filtering is a single JPQL condition, not a middleware rewrite.

---

## Feature 2 – Location Map Preview

**Approach:** Frontend-only Vue component; dynamic Leaflet import to keep bundle size minimal.

| File | Action |
|------|--------|
| `frontend/src/components/event/LeafletMap.vue` | **NEW** – geocodes via Nominatim, renders Leaflet map, graceful fallback |
| `frontend/src/views/EventDetailView.vue` | **MODIFIED** – includes `<LeafletMap>` when `event.location` is set |
| `frontend/package.json` | **MODIFIED** – added `leaflet ^1.9.4`, `@types/leaflet ^1.9.14` |

**Why this approach:** Leaflet + OpenStreetMap requires no API key. Dynamic `import('leaflet')` ensures the ~150 KB library is only loaded on the event detail page.

---

## Feature 3 – Improved Event Data Structure

**Approach:** Additive fields only; backward-compatible record extension.

| File | Action |
|------|--------|
| `backend/…/event/CreateEventRequest.java` | **MODIFIED** – added `groupId`, `minParticipants`, `maxParticipants`, `isPublic`, `seriesParentId` (all optional) |
| `backend/…/event/Event.java` | **MODIFIED** – corresponding JPA fields |
| `frontend/src/stores/eventStore.ts` | **MODIFIED** – Zod schema extended with new optional fields |
| `frontend/src/components/event/EventForm.vue` | **MODIFIED** – added min/max participant inputs and public checkbox |

---

## Feature 4 – Edge Case Handling

**Approach:** Lightweight checks in existing service and resource classes.

| Validation | Location |
|------------|----------|
| `maxParticipants >= minParticipants` | `EventService.validateParticipantLimits()` (backend) + Zod `.refine()` (frontend) |
| Duplicate RSVP prevention | Existing `UNIQUE(event_id, user_id)` DB constraint + upsert in `RsvpResource` (unchanged) |
| Duplicate bring-item claim | HTTP 409 in `BringListResource.claim()` (already existed, confirmed correct) |
| Empty/invalid location | `IcsGenerator` skips blank location; `LeafletMap.vue` shows fallback message |
| Overbooking | `maxParticipants` field is now stored; enforcement can be added to `RsvpResource` in a future sprint |

---

## Feature 5 – ICS Export

**Approach:** Pure string generation (RFC 5545), no external library.

| File | Action |
|------|--------|
| `backend/…/event/IcsGenerator.java` | **NEW** – generates `VCALENDAR/VEVENT` string with title, description, location, dates |
| `backend/…/event/EventResource.java` | **MODIFIED** – `GET /api/events/{id}/export.ics` endpoint |
| `frontend/src/views/EventDetailView.vue` | **MODIFIED** – "Add to Calendar" download link |

**Why this approach:** No Maven dependency needed. The ICS format is simple enough to generate with a `StringBuilder`; the `IcsGenerator` class is self-contained and easy to unit-test.

---

## Feature 6 – Potluck / Reminder Extension

**Approach:** New `reminderSent` flag on `BringItem`; reminder logic in `BringListResource`.

| File | Action |
|------|--------|
| `backend/…/bringlist/BringItem.java` | **MODIFIED** – added `reminderSent` boolean + `findUnclaimedByEvent()` |
| `backend/…/bringlist/BringListResource.java` | **MODIFIED** – `POST /remind` endpoint; creates `Notification` for each unassigned attendee |
| `backend/…/notification/NotificationType.java` | **MODIFIED** – added `BRING_ITEM_REMINDER` |
| `frontend/src/types/index.ts` | **MODIFIED** – `BringItem.reminderSent`, `Notification.type` extended |

---

## Feature 7 – Chat (Minimal Implementation)

**Status: Already fully implemented.** The existing codebase already contains:
- `ChatResource.java` – REST API for persisted messages
- `ChatSocket.java` – WebSocket for live updates
- `ChatView.vue` – full chat UI

No changes were needed. The feature requirement is satisfied by the existing implementation.

---

## Feature 8 – Roles (Light Version)

**Approach:** Organizer tracked via existing `events.organizer_id`; co-creators in a new join table.

| File | Action |
|------|--------|
| `V2__groups_and_event_extensions.sql` | **NEW** – `event_co_creators(event_id, user_id)` table |
| `backend/…/event/EventService.java` | **MODIFIED** – `assertCanEdit()` checks organizer OR co-creator |
| `backend/…/event/EventResource.java` | **MODIFIED** – `POST/DELETE /api/events/{id}/co-creators/{userId}` |
| `frontend/src/views/EventDetailView.vue` | **MODIFIED** – `canEdit` computed; edit button shown only to organizer |

**Why this approach:** A full RBAC system would require JWT claim changes and middleware. Instead, the role check is a single native query in the service layer, keeping the JWT and auth flow untouched.

---

## Optional Nice-to-Have Features

| Feature | Status |
|---------|--------|
| Public/private flag | Implemented (`Event.isPublic`, badge in detail view) |
| Event series link | Implemented (`Event.seriesParent` self-FK, link in detail view) |
| Guest mode | Not implemented (requires auth flow changes; out of scope) |

---

## Frontend Tooling

### ESLint
- **Config:** `frontend/eslint.config.js` (ESLint v9 flat config, Vue 3 + TypeScript rules)
- **Run:** `pnpm lint`
- **New devDependencies:** `eslint`, `@eslint/js`, `eslint-plugin-vue`, `typescript-eslint`, `vue-eslint-parser`

### Vitest (replaces Jest for Vite projects)
- **Config:** `frontend/vitest.config.ts`
- **Example tests:** `frontend/src/__tests__/eventStore.spec.ts` (7 tests for schema validation)
- **Run:** `pnpm test`
- **New devDependencies:** `vitest`, `@vue/test-utils`, `jsdom`, `@vitest/coverage-v8`

> **Note:** Vitest is used instead of Jest because it integrates natively with Vite (shared config, faster HMR-aware test runs). The API is Jest-compatible (`describe`, `it`, `expect`).

---

## Files Added

```
backend/src/main/java/de/hangouthub/group/Group.java
backend/src/main/java/de/hangouthub/group/GroupResource.java
backend/src/main/java/de/hangouthub/event/IcsGenerator.java
backend/src/main/resources/db/migration/V2__groups_and_event_extensions.sql
frontend/src/components/event/LeafletMap.vue
frontend/src/__tests__/eventStore.spec.ts
frontend/eslint.config.js
frontend/vitest.config.ts
AGENTS.md
```

## Files Modified

```
backend/src/main/java/de/hangouthub/event/Event.java
backend/src/main/java/de/hangouthub/event/CreateEventRequest.java
backend/src/main/java/de/hangouthub/event/EventService.java
backend/src/main/java/de/hangouthub/event/EventResource.java
backend/src/main/java/de/hangouthub/bringlist/BringItem.java
backend/src/main/java/de/hangouthub/bringlist/BringListResource.java
backend/src/main/java/de/hangouthub/notification/NotificationType.java
frontend/src/types/index.ts
frontend/src/stores/eventStore.ts
frontend/src/components/event/EventForm.vue
frontend/src/views/EventDetailView.vue
frontend/package.json
```

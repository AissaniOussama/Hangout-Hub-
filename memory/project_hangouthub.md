---
name: project-hangouthub
description: HangoutHub project — tech stack, structure, setup steps, key decisions
metadata:
  type: project
---

HangoutHub is a private event planning platform (university project, SoSe 26, with Oussama Badr-Eddine Aissani).

**Why:** Replaces chaotic messenger group chats with a centralised platform for events, RSVPs, chat, polls, bring-along lists, and notifications.

**Tech stack:**
- Backend: Java 21, Quarkus 3.15.1 (Maven), `backend/`
- Frontend: Vue 3, TypeScript, Vite, PrimeVue 4 + Tailwind CSS v4, `frontend/`
- DB: PostgreSQL 17 (Docker Compose for dev)
- Auth: JWT via `quarkus-smallrye-jwt` + RSA keys (generate with `scripts/generate-dev-keys.sh`)
- State: Pinia; Routing: Vue Router; Validation: Zod; HTTP: Axios

**Backend packages (de.hangouthub):**
- `user` — User entity, AuthResource (register/login → JWT)
- `event` — Event CRUD, EventService, EventResource
- `rsvp` — Rsvp entity + RsvpResource
- `invitation` — Invitation entity + InvitationResource
- `chat` — Message entity, ChatResource (REST), ChatSocket (WS `/ws/chat/{eventId}`)
- `poll` — Poll + PollOption entities, PollResource
- `bringlist` — BringItem entity, BringListResource
- `notification` — Notification entity, NotificationResource

**Frontend views:** HomeView, LoginView, RegisterView, EventDetailView, CalendarView, ChatView

**Setup order:**
1. `docker-compose up -d` (start Postgres)
2. `bash scripts/generate-dev-keys.sh` (generate JWT keys — one-time)
3. `cd backend && mvn quarkus:dev` (backend on :8080)
4. `cd frontend && npm install && npm run dev` (frontend on :5173, proxied to :8080)

**How to apply:** Use this as baseline context when adding features, debugging, or extending the project.

-- Retroactive fix: ensure every event organizer has an OWNER row in event_roles.
-- Covers events created between V4 migration and new EventService.create() code being active.
INSERT INTO event_roles (event_id, user_id, role)
SELECT id, organizer_id, 'OWNER'
FROM events
WHERE organizer_id IS NOT NULL
ON CONFLICT (event_id, user_id) DO NOTHING;

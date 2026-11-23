-- Event-level roles (OWNER, EDITOR, VIEWER)
CREATE TABLE event_roles (
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id  BIGINT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    role     VARCHAR(10) NOT NULL,
    PRIMARY KEY (event_id, user_id)
);

-- Migrate: existing organizer becomes OWNER of their event
INSERT INTO event_roles (event_id, user_id, role)
SELECT id, organizer_id, 'OWNER'
FROM events
WHERE organizer_id IS NOT NULL;

-- Optional invite token per event (null = no invite link generated yet)
ALTER TABLE events ADD COLUMN invite_token VARCHAR(36);

-- ============================================================
-- V2: Groups system + Event model extensions
-- ============================================================

-- Groups table
CREATE TABLE groups (
    id   BIGSERIAL    PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- Group membership (simple list of user IDs per group)
CREATE TABLE group_members (
    group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id  BIGINT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    PRIMARY KEY (group_id, user_id)
);

-- ── Event extensions ──────────────────────────────────────────────────────

-- Feature 1: optional group association
ALTER TABLE events ADD COLUMN group_id BIGINT REFERENCES groups(id) ON DELETE SET NULL;

-- Feature 3: participant limits
ALTER TABLE events ADD COLUMN min_participants INTEGER;
ALTER TABLE events ADD COLUMN max_participants INTEGER;

-- Feature 7: visibility flag (public / private)
ALTER TABLE events ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT TRUE;

-- Feature 6: bring-item reminder flag per user
ALTER TABLE bring_items ADD COLUMN reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;

-- Feature 7 (optional): event series link
ALTER TABLE events ADD COLUMN series_id BIGINT REFERENCES events(id) ON DELETE SET NULL;

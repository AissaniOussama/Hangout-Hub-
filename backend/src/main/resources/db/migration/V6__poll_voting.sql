-- Poll voting modes and closing
ALTER TABLE polls ADD COLUMN vote_mode VARCHAR(20) NOT NULL DEFAULT 'SINGLE_CHANGEABLE';
ALTER TABLE polls ADD COLUMN closes_at TIMESTAMP;
ALTER TABLE polls ADD COLUMN closed BOOLEAN NOT NULL DEFAULT FALSE;

-- Poll option type (plain text or date) replaces the bare vote counter,
-- which is superseded by per-user rows in poll_votes.
ALTER TABLE poll_options ADD COLUMN option_type VARCHAR(10) NOT NULL DEFAULT 'TEXT';
ALTER TABLE poll_options ADD COLUMN date_value DATE;
ALTER TABLE poll_options ALTER COLUMN text DROP NOT NULL;
ALTER TABLE poll_options DROP COLUMN votes;

-- Give poll_votes a surrogate key so it can be mapped as a normal entity,
-- keeping the one-vote-per-user-per-option guarantee via a unique constraint.
ALTER TABLE poll_votes DROP CONSTRAINT poll_votes_pkey;
ALTER TABLE poll_votes ADD COLUMN id BIGSERIAL PRIMARY KEY;
ALTER TABLE poll_votes ADD CONSTRAINT uq_poll_votes_user_option UNIQUE (user_id, poll_option_id);

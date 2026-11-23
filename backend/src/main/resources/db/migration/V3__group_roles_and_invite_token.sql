-- Add role column to existing group_members; existing rows default to MEMBER
ALTER TABLE group_members ADD COLUMN role VARCHAR(10) NOT NULL DEFAULT 'MEMBER';

-- Promote the first-inserted member of each group (lowest user_id) to OWNER
UPDATE group_members
SET role = 'OWNER'
WHERE ctid IN (
    SELECT DISTINCT ON (group_id) ctid
    FROM group_members
    ORDER BY group_id, user_id
);

-- Add permanent invite token to each group (requires PostgreSQL 13+)
ALTER TABLE groups ADD COLUMN invite_token VARCHAR(36) NOT NULL DEFAULT gen_random_uuid()::text;

-- Let notifications point at the event/route they relate to, so the frontend can navigate on click
ALTER TABLE notifications ADD COLUMN event_id BIGINT;
ALTER TABLE notifications ADD COLUMN link VARCHAR(255);

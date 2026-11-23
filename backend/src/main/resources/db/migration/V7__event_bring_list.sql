-- Bring-along list ("Mitbringliste") toggle on events
ALTER TABLE events ADD COLUMN has_bring_list BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE users (
    id            BIGSERIAL    PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL
);

CREATE TABLE events (
    id            BIGSERIAL    PRIMARY KEY,
    title         VARCHAR(255) NOT NULL,
    description   TEXT,
    start_time    TIMESTAMP    NOT NULL,
    end_time      TIMESTAMP,
    location      VARCHAR(255),
    admission_fee INTEGER,
    organizer_id  BIGINT       NOT NULL REFERENCES users(id)
);

CREATE TABLE rsvps (
    id         BIGSERIAL   PRIMARY KEY,
    event_id   BIGINT      NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id    BIGINT      NOT NULL REFERENCES users(id),
    status     VARCHAR(20) NOT NULL,
    updated_at TIMESTAMP   NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, user_id)
);

CREATE TABLE invitations (
    id              BIGSERIAL    PRIMARY KEY,
    event_id        BIGINT       NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    invited_user_id BIGINT       REFERENCES users(id),
    invite_code     VARCHAR(64)  NOT NULL UNIQUE,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE messages (
    id        BIGSERIAL PRIMARY KEY,
    event_id  BIGINT    NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    sender_id BIGINT    NOT NULL REFERENCES users(id),
    content   TEXT      NOT NULL,
    sent_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE polls (
    id         BIGSERIAL    PRIMARY KEY,
    event_id   BIGINT       NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    question   VARCHAR(500) NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE poll_options (
    id      BIGSERIAL    PRIMARY KEY,
    poll_id BIGINT       NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    text    VARCHAR(255) NOT NULL,
    votes   INTEGER      NOT NULL DEFAULT 0
);

CREATE TABLE poll_votes (
    user_id        BIGINT NOT NULL REFERENCES users(id),
    poll_option_id BIGINT NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, poll_option_id)
);

CREATE TABLE bring_items (
    id             BIGSERIAL    PRIMARY KEY,
    event_id       BIGINT       NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    description    VARCHAR(255) NOT NULL,
    claimed_by_id  BIGINT       REFERENCES users(id)
);

CREATE TABLE notifications (
    id         BIGSERIAL    PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES users(id),
    message    TEXT         NOT NULL,
    type       VARCHAR(50)  NOT NULL,
    is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

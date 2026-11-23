package de.hangouthub.event;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import java.util.Objects;

@Embeddable
public class EventParticipant {

    @Column(name = "user_id", nullable = false)
    public Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 10)
    public EventRole role;

    public EventParticipant() {}

    public EventParticipant(Long userId, EventRole role) {
        this.userId = userId;
        this.role = role;
    }

    @Override
    public boolean equals(Object o) {
        if (!(o instanceof EventParticipant ep)) return false;
        return Objects.equals(userId, ep.userId);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(userId);
    }
}

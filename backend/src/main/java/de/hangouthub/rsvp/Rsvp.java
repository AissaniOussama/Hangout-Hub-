package de.hangouthub.rsvp;

import de.hangouthub.event.Event;
import de.hangouthub.user.User;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Entity
@Table(name = "rsvps", uniqueConstraints = @UniqueConstraint(columnNames = {"event_id", "user_id"}))
public class Rsvp extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne
    @JoinColumn(name = "event_id")
    public Event event;

    @ManyToOne
    @JoinColumn(name = "user_id")
    public User user;

    @Enumerated(EnumType.STRING)
    public RsvpStatus status;

    public LocalDateTime updatedAt = LocalDateTime.now();

    public static List<Rsvp> findByEvent(Event event) {
        return list("event", event);
    }

    public static Optional<Rsvp> findByEventAndUser(Event event, User user) {
        return find("event = ?1 and user = ?2", event, user).firstResultOptional();
    }
}

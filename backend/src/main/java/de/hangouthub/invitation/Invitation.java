package de.hangouthub.invitation;

import de.hangouthub.event.Event;
import de.hangouthub.user.User;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Entity
@Table(name = "invitations")
public class Invitation extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne
    @JoinColumn(name = "event_id")
    public Event event;

    @ManyToOne
    @JoinColumn(name = "invited_user_id")
    public User invitedUser;

    @Column(unique = true)
    public String inviteCode;

    @Enumerated(EnumType.STRING)
    public InvitationStatus status = InvitationStatus.PENDING;

    public LocalDateTime createdAt = LocalDateTime.now();

    public static List<Invitation> findByEvent(Event event) {
        return list("event", event);
    }

    public static Optional<Invitation> findByCode(String code) {
        return find("inviteCode", code).firstResultOptional();
    }
}

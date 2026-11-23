package de.hangouthub.bringlist;

import de.hangouthub.event.Event;
import de.hangouthub.user.User;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

@Entity
@Table(name = "bring_items")
public class BringItem extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne
    @JoinColumn(name = "event_id")
    public Event event;

    @NotBlank
    public String description;

    @ManyToOne
    @JoinColumn(name = "claimed_by_id")
    public User claimedBy;

    /**
     * Feature 6: Flag that tracks whether a reminder has been sent
     * to attendees who have not yet claimed an item.
     * Placeholder logic – actual scheduling is outside scope.
     */
    @Column(name = "reminder_sent", nullable = false)
    public boolean reminderSent = false;

    public static List<BringItem> findByEvent(Event event) {
        return list("event", event);
    }

    /** Returns all unclaimed items for an event (used for reminder logic). */
    public static List<BringItem> findUnclaimedByEvent(Event event) {
        return list("event = ?1 AND claimedBy IS NULL", event);
    }
}

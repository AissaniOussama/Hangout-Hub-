package de.hangouthub.chat;

import de.hangouthub.event.Event;
import de.hangouthub.user.User;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "messages")
public class Message extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne
    @JoinColumn(name = "event_id")
    public Event event;

    @ManyToOne
    @JoinColumn(name = "sender_id")
    public User sender;

    @NotBlank
    public String content;

    public LocalDateTime sentAt = LocalDateTime.now();

    public static List<Message> findByEvent(Event event) {
        return list("event = ?1 ORDER BY sentAt ASC", event);
    }
}

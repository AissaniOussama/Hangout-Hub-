package de.hangouthub.notification;

import de.hangouthub.user.User;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "notifications")
public class Notification extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne
    @JoinColumn(name = "user_id")
    public User user;

    public String message;

    @Enumerated(EnumType.STRING)
    public NotificationType type;

    public boolean isRead = false;

    public LocalDateTime createdAt = LocalDateTime.now();

    /** Event this notification relates to, if any. */
    @Column(name = "event_id")
    public Long eventId;

    /** Frontend route to open when the notification is clicked, if any. */
    public String link;

    public static List<Notification> findByUser(User user) {
        return list("user = ?1 ORDER BY createdAt DESC", user);
    }

    public static List<Notification> findUnreadByUser(User user) {
        return list("user = ?1 and isRead = false ORDER BY createdAt DESC", user);
    }
}

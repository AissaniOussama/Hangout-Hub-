package de.hangouthub.poll;

import de.hangouthub.event.Event;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "polls")
public class Poll extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne
    @JoinColumn(name = "event_id")
    public Event event;

    @NotBlank
    public String question;

    @Enumerated(EnumType.STRING)
    @Column(name = "vote_mode", nullable = false, length = 20)
    public VoteMode voteMode = VoteMode.SINGLE_CHANGEABLE;

    @Column(name = "closes_at")
    public LocalDateTime closesAt;

    /** Manually closed by an organizer/editor, independent of closesAt. */
    public boolean closed = false;

    public LocalDateTime createdAt = LocalDateTime.now();

    @OneToMany(mappedBy = "poll", cascade = CascadeType.ALL, orphanRemoval = true)
    public List<PollOption> options = new ArrayList<>();

    /** True once manually closed, or the closing deadline has passed. */
    public boolean isClosed() {
        return closed || (closesAt != null && LocalDateTime.now().isAfter(closesAt));
    }

    public static List<Poll> findByEvent(Event event) {
        return list("event", event);
    }
}

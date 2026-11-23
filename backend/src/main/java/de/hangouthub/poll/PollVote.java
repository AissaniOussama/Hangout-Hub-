package de.hangouthub.poll;

import de.hangouthub.user.User;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import java.util.List;

@Entity
@Table(name = "poll_votes")
public class PollVote extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne
    @JoinColumn(name = "user_id")
    public User user;

    @ManyToOne
    @JoinColumn(name = "poll_option_id")
    public PollOption pollOption;

    public static long countByOption(PollOption option) {
        return count("pollOption", option);
    }

    public static List<PollVote> findByOption(PollOption option) {
        return list("pollOption", option);
    }

    public static List<PollVote> findByUserAndPoll(User user, Poll poll) {
        return list("user = ?1 and pollOption.poll = ?2", user, poll);
    }

    public static PollVote findByUserAndOption(User user, PollOption option) {
        return find("user = ?1 and pollOption = ?2", user, option).firstResult();
    }
}

package de.hangouthub.poll;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "poll_options")
public class PollOption extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne
    @JoinColumn(name = "poll_id")
    public Poll poll;

    @Enumerated(EnumType.STRING)
    @Column(name = "option_type", nullable = false, length = 10)
    public PollOptionType optionType = PollOptionType.TEXT;

    /** Set when optionType == TEXT. */
    public String text;

    /** Set when optionType == DATE. */
    @Column(name = "date_value")
    public LocalDate dateValue;
}

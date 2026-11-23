package de.hangouthub.event;

import com.fasterxml.jackson.annotation.JsonIgnore;
import de.hangouthub.group.Group;
import de.hangouthub.user.User;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "events")
public class Event extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @NotBlank
    public String title;

    public String description;

    @NotNull
    public LocalDateTime startTime;

    public LocalDateTime endTime;

    public String location;

    public Integer admissionFee;

    @ManyToOne
    @JoinColumn(name = "organizer_id")
    public User organizer;

    @ManyToOne
    @JoinColumn(name = "group_id")
    public Group group;

    public Integer minParticipants;

    public Integer maxParticipants;

    @Column(name = "is_public", nullable = false)
    public boolean isPublic = true;

    /** Whether the organizer has enabled a bring-along list ("Mitbringliste") for this event. */
    @Column(name = "has_bring_list", nullable = false)
    public boolean hasBringList = false;

    @ManyToOne
    @JoinColumn(name = "series_id")
    public Event seriesParent;

    /** Invite token for joining this event; hidden from JSON serialization. */
    @JsonIgnore
    @Column(name = "invite_token")
    public String inviteToken;

    /** Per-event roles (OWNER, EDITOR, VIEWER); hidden from JSON serialization. */
    @JsonIgnore
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "event_roles", joinColumns = @JoinColumn(name = "event_id"))
    public List<EventParticipant> eventRoles = new ArrayList<>();

    // ── Permission helpers ────────────────────────────────────────────────────

    public EventRole getEventRoleOf(Long userId) {
        if (userId == null) return null;
        return eventRoles.stream()
                .filter(ep -> ep.userId.equals(userId))
                .map(ep -> ep.role)
                .findFirst()
                .orElse(null);
    }

    /** OWNER or EDITOR may edit. */
    public boolean canEdit(Long userId) {
        EventRole role = getEventRoleOf(userId);
        return role == EventRole.OWNER || role == EventRole.EDITOR;
    }

    /** Only OWNER may delete. */
    public boolean canDelete(Long userId) {
        return getEventRoleOf(userId) == EventRole.OWNER;
    }

    /** Public events are viewable by anyone; private events require an explicit role. */
    public boolean canView(Long userId) {
        return isPublic || getEventRoleOf(userId) != null;
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    public static List<Event> findByOrganizer(User organizer) {
        return list("organizer", organizer);
    }

    public static List<Event> findPublicUpcoming(String search, Long groupId, LocalDateTime until,
                                                   Integer page, Integer size) {
        boolean hasSearch = search != null && !search.isBlank();
        StringBuilder jpql = new StringBuilder("FROM Event e WHERE e.startTime >= :now AND e.isPublic = true");
        appendCommonFilters(jpql, hasSearch, groupId, until);
        jpql.append(" ORDER BY e.startTime ASC");

        var query = getEntityManager().createQuery(jpql.toString(), Event.class)
                .setParameter("now", LocalDateTime.now());
        bindCommonFilters(query, search, groupId, until, hasSearch);
        applyPaging(query, page, size);
        return query.getResultList();
    }

    public static long countPublicUpcoming(String search, Long groupId, LocalDateTime until) {
        boolean hasSearch = search != null && !search.isBlank();
        StringBuilder jpql = new StringBuilder("SELECT COUNT(e) FROM Event e WHERE e.startTime >= :now AND e.isPublic = true");
        appendCommonFilters(jpql, hasSearch, groupId, until);

        var query = getEntityManager().createQuery(jpql.toString(), Long.class)
                .setParameter("now", LocalDateTime.now());
        bindCommonFilters(query, search, groupId, until, hasSearch);
        return query.getSingleResult();
    }

    public static List<Event> findUpcomingForUser(List<Long> groupIds, Long userId,
                                                    String search, Long groupId, LocalDateTime until,
                                                    Integer page, Integer size) {
        boolean hasGroups = groupIds != null && !groupIds.isEmpty();
        boolean hasSearch = search != null && !search.isBlank();
        StringBuilder jpql = new StringBuilder("SELECT DISTINCT e FROM Event e LEFT JOIN e.eventRoles ep " +
                "WHERE e.startTime >= :now AND (e.isPublic = true" +
                (hasGroups ? " OR e.group.id IN :groupIds" : "") +
                " OR ep.userId = :userId)");
        appendCommonFilters(jpql, hasSearch, groupId, until);
        jpql.append(" ORDER BY e.startTime ASC");

        var query = getEntityManager().createQuery(jpql.toString(), Event.class)
                .setParameter("now", LocalDateTime.now())
                .setParameter("userId", userId);
        if (hasGroups) query.setParameter("groupIds", groupIds);
        bindCommonFilters(query, search, groupId, until, hasSearch);
        applyPaging(query, page, size);
        return query.getResultList();
    }

    public static long countUpcomingForUser(List<Long> groupIds, Long userId,
                                             String search, Long groupId, LocalDateTime until) {
        boolean hasGroups = groupIds != null && !groupIds.isEmpty();
        boolean hasSearch = search != null && !search.isBlank();
        StringBuilder jpql = new StringBuilder("SELECT COUNT(DISTINCT e) FROM Event e LEFT JOIN e.eventRoles ep " +
                "WHERE e.startTime >= :now AND (e.isPublic = true" +
                (hasGroups ? " OR e.group.id IN :groupIds" : "") +
                " OR ep.userId = :userId)");
        appendCommonFilters(jpql, hasSearch, groupId, until);

        var query = getEntityManager().createQuery(jpql.toString(), Long.class)
                .setParameter("now", LocalDateTime.now())
                .setParameter("userId", userId);
        if (hasGroups) query.setParameter("groupIds", groupIds);
        bindCommonFilters(query, search, groupId, until, hasSearch);
        return query.getSingleResult();
    }

    private static void appendCommonFilters(StringBuilder jpql, boolean hasSearch, Long groupId, LocalDateTime until) {
        if (hasSearch) jpql.append(" AND LOWER(e.title) LIKE :search");
        if (groupId != null) jpql.append(" AND e.group.id = :groupId");
        if (until != null) jpql.append(" AND e.startTime <= :until");
    }

    private static void bindCommonFilters(Query query, String search, Long groupId,
                                           LocalDateTime until, boolean hasSearch) {
        if (hasSearch) query.setParameter("search", "%" + search.toLowerCase() + "%");
        if (groupId != null) query.setParameter("groupId", groupId);
        if (until != null) query.setParameter("until", until);
    }

    private static void applyPaging(Query query, Integer page, Integer size) {
        if (size != null) {
            query.setFirstResult((page != null ? page : 0) * size);
            query.setMaxResults(size);
        }
    }
}

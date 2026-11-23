package de.hangouthub.group;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "groups")
public class Group extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @NotBlank
    public String name;

    /** Permanent invite token; hidden from event serialization via @JsonIgnore. */
    @JsonIgnore
    @Column(name = "invite_token", nullable = false)
    public String inviteToken;

    /** Members with their roles; hidden from event serialization. */
    @JsonIgnore
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "group_members", joinColumns = @JoinColumn(name = "group_id"))
    public List<GroupMember> members = new ArrayList<>();

    // ── Queries ───────────────────────────────────────────────────────────────

    public static List<Group> findByMember(Long userId) {
        return list("SELECT DISTINCT g FROM Group g JOIN g.members m WHERE m.userId = ?1", userId);
    }

    // ── Permission helpers (members are EAGER-loaded, no extra queries) ───────

    public GroupRole getRoleOf(Long userId) {
        return members.stream()
                .filter(m -> m.userId.equals(userId))
                .map(m -> m.role)
                .findFirst()
                .orElse(null);
    }

    public boolean isMember(Long userId) {
        return getRoleOf(userId) != null;
    }

    /** True when the user is OWNER or ADMIN. */
    public boolean canModerate(Long userId) {
        GroupRole role = getRoleOf(userId);
        return role == GroupRole.OWNER || role == GroupRole.ADMIN;
    }

    public boolean isOwner(Long userId) {
        return getRoleOf(userId) == GroupRole.OWNER;
    }
}

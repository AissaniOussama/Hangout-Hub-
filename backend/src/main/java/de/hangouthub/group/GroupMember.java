package de.hangouthub.group;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import java.util.Objects;

@Embeddable
public class GroupMember {

    @Column(name = "user_id", nullable = false)
    public Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 10)
    public GroupRole role = GroupRole.MEMBER;

    public GroupMember() {}

    public GroupMember(Long userId, GroupRole role) {
        this.userId = userId;
        this.role = role;
    }

    @Override
    public boolean equals(Object o) {
        if (!(o instanceof GroupMember gm)) return false;
        return Objects.equals(userId, gm.userId);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(userId);
    }
}

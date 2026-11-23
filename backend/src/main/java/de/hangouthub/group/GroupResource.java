package de.hangouthub.group;

import de.hangouthub.user.User;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import java.net.URI;
import java.util.List;
import java.util.UUID;

@Path("/api/groups")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed("user")
public class GroupResource {

    @Inject
    JsonWebToken jwt;

    // ── DTOs ─────────────────────────────────────────────────────────────────

    public record CreateGroupRequest(@NotBlank String name) {}
    public record RenameGroupRequest(@NotBlank String name) {}
    public record GroupMemberDto(Long userId, String username, GroupRole role) {}
    public record GroupResponse(Long id, String name, GroupRole myRole, String inviteToken, List<GroupMemberDto> members) {}
    public record InviteResponse(String inviteToken) {}
    public record GroupPreview(Long id, String name) {}

    // ── Endpoints ─────────────────────────────────────────────────────────────

    /** List all groups the current user belongs to. */
    @GET
    public List<GroupResponse> myGroups() {
        Long userId = currentUserId();
        return Group.findByMember(userId).stream()
                .map(g -> toResponse(g, userId))
                .toList();
    }

    /** Create a new group; the creator becomes OWNER. */
    @POST
    @Transactional
    public Response create(@Valid CreateGroupRequest req) {
        Long userId = currentUserId();
        var group = new Group();
        group.name = req.name();
        group.inviteToken = UUID.randomUUID().toString();
        group.members.add(new GroupMember(userId, GroupRole.OWNER));
        group.persist();
        return Response.created(URI.create("/api/groups/" + group.id))
                .entity(toResponse(group, userId))
                .build();
    }

    /** Get group detail. Current user must be a member. */
    @GET
    @Path("/{id}")
    public GroupResponse get(@PathParam("id") Long id) {
        Long userId = currentUserId();
        Group group = findOrThrow(id);
        requireMember(group, userId);
        return toResponse(group, userId);
    }

    /** Rename the group. Requires OWNER or ADMIN. */
    @PUT
    @Path("/{id}")
    @Transactional
    public GroupResponse rename(@PathParam("id") Long id, @Valid RenameGroupRequest req) {
        Long userId = currentUserId();
        Group group = findOrThrow(id);
        requireModerator(group, userId);
        group.name = req.name();
        return toResponse(group, userId);
    }

    /** Delete the group. Requires OWNER. */
    @DELETE
    @Path("/{id}")
    @Transactional
    public Response delete(@PathParam("id") Long id) {
        Long userId = currentUserId();
        Group group = findOrThrow(id);
        requireOwner(group, userId);
        group.delete();
        return Response.noContent().build();
    }

    /** Kick a member. Requires OWNER or ADMIN. Cannot kick OWNER or (for ADMINs) other ADMINs. */
    @DELETE
    @Path("/{id}/members/{targetId}")
    @Transactional
    public GroupResponse kickMember(@PathParam("id") Long id, @PathParam("targetId") Long targetId) {
        Long currentId = currentUserId();
        Group group = findOrThrow(id);
        requireModerator(group, currentId);
        if (group.isOwner(targetId)) {
            throw new BadRequestException("Cannot kick the group owner");
        }
        GroupRole targetRole = group.getRoleOf(targetId);
        if (targetRole == GroupRole.ADMIN && !group.isOwner(currentId)) {
            throw new ForbiddenException("Only the owner can remove admins");
        }
        if (targetRole == null) {
            throw new NotFoundException("User is not a member of this group");
        }
        group.members.removeIf(m -> m.userId.equals(targetId));
        return toResponse(group, currentId);
    }

    /** Promote a MEMBER to ADMIN. Requires OWNER. */
    @POST
    @Path("/{id}/members/{targetId}/promote")
    @Transactional
    public GroupResponse promote(@PathParam("id") Long id, @PathParam("targetId") Long targetId) {
        Long currentId = currentUserId();
        Group group = findOrThrow(id);
        requireOwner(group, currentId);
        setRole(group, targetId, GroupRole.ADMIN);
        return toResponse(group, currentId);
    }

    /** Demote an ADMIN to MEMBER. Requires OWNER. */
    @POST
    @Path("/{id}/members/{targetId}/demote")
    @Transactional
    public GroupResponse demote(@PathParam("id") Long id, @PathParam("targetId") Long targetId) {
        Long currentId = currentUserId();
        Group group = findOrThrow(id);
        requireOwner(group, currentId);
        if (group.isOwner(targetId)) {
            throw new BadRequestException("Cannot demote the group owner");
        }
        setRole(group, targetId, GroupRole.MEMBER);
        return toResponse(group, currentId);
    }

    /** Regenerate the invite token. Requires OWNER or ADMIN. */
    @POST
    @Path("/{id}/invite/regenerate")
    @Transactional
    public InviteResponse regenerateInvite(@PathParam("id") Long id) {
        Long userId = currentUserId();
        Group group = findOrThrow(id);
        requireModerator(group, userId);
        group.inviteToken = UUID.randomUUID().toString();
        return new InviteResponse(group.inviteToken);
    }

    /** Preview a group by its invite token, without joining. */
    @GET
    @Path("/join/{token}")
    public GroupPreview previewInvite(@PathParam("token") String token) {
        Group group = Group.<Group>find("inviteToken", token).firstResult();
        if (group == null) {
            throw new NotFoundException("Invalid invite token");
        }
        return new GroupPreview(group.id, group.name);
    }

    /** Join a group via its invite token. */
    @POST
    @Path("/join/{token}")
    @Transactional
    public GroupResponse joinViaToken(@PathParam("token") String token) {
        Long userId = currentUserId();
        Group group = Group.<Group>find("inviteToken", token).firstResult();
        if (group == null) {
            throw new NotFoundException("Invalid invite token");
        }
        if (!group.isMember(userId)) {
            group.members.add(new GroupMember(userId, GroupRole.MEMBER));
        }
        return toResponse(group, userId);
    }

    /** Leave a group. OWNER cannot leave — delete the group instead. */
    @DELETE
    @Path("/{id}/leave")
    @Transactional
    public Response leave(@PathParam("id") Long id) {
        Long userId = currentUserId();
        Group group = findOrThrow(id);
        if (!group.isMember(userId)) {
            throw new NotFoundException("You are not a member of this group");
        }
        if (group.isOwner(userId)) {
            throw new BadRequestException("Owner cannot leave the group — delete it or transfer ownership first");
        }
        group.members.removeIf(m -> m.userId.equals(userId));
        return Response.noContent().build();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private Long currentUserId() {
        return Long.parseLong(jwt.getSubject());
    }

    private Group findOrThrow(Long id) {
        return (Group) Group.findByIdOptional(id)
                .orElseThrow(() -> new NotFoundException("Group not found: " + id));
    }

    private void requireMember(Group group, Long userId) {
        if (!group.isMember(userId)) throw new ForbiddenException("You are not a member of this group");
    }

    private void requireModerator(Group group, Long userId) {
        if (!group.canModerate(userId)) throw new ForbiddenException("Owner or admin access required");
    }

    private void requireOwner(Group group, Long userId) {
        if (!group.isOwner(userId)) throw new ForbiddenException("Owner access required");
    }

    private void setRole(Group group, Long targetId, GroupRole newRole) {
        GroupMember member = group.members.stream()
                .filter(m -> m.userId.equals(targetId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("User is not a member of this group"));
        member.role = newRole;
    }

    private GroupResponse toResponse(Group group, Long currentUserId) {
        GroupRole myRole = group.getRoleOf(currentUserId);
        String token = group.canModerate(currentUserId) ? group.inviteToken : null;
        List<GroupMemberDto> members = group.members.stream()
                .map(m -> {
                    User user = User.findById(m.userId);
                    return new GroupMemberDto(m.userId, user != null ? user.username : "Unknown", m.role);
                })
                .toList();
        return new GroupResponse(group.id, group.name, myRole, token, members);
    }
}

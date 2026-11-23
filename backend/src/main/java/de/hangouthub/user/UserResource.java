package de.hangouthub.user;

import jakarta.annotation.security.RolesAllowed;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.util.List;

@Path("/api/users")
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed("user")
public class UserResource {

    public record UserDto(Long id, String username) {}

    /** Search users by username prefix. Returns at most 10 results. */
    @GET
    @Path("/search")
    public List<UserDto> search(@QueryParam("q") String q) {
        if (q == null || q.trim().length() < 2) return List.of();
        return User.<User>list("LOWER(username) LIKE LOWER(?1)", q.trim() + "%")
                .stream()
                .map(u -> new UserDto(u.id, u.username))
                .limit(10)
                .toList();
    }
}

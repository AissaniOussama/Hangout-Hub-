package de.hangouthub.user;

import io.quarkus.elytron.security.common.BcryptUtil;
import io.smallrye.jwt.build.Jwt;
import jakarta.annotation.security.PermitAll;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.util.Set;

@Path("/api/auth")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@PermitAll
public class AuthResource {

    @POST
    @Path("/register")
    @Transactional
    public Response register(@Valid RegisterRequest req) {
        if (User.findByEmail(req.email()).isPresent()) {
            return Response.status(Response.Status.CONFLICT)
                    .entity(new ErrorResponse("Email already in use"))
                    .build();
        }
        if (User.findByUsername(req.username()).isPresent()) {
            return Response.status(Response.Status.CONFLICT)
                    .entity(new ErrorResponse("Username already taken"))
                    .build();
        }

        var user = new User();
        user.username = req.username();
        user.email = req.email();
        user.passwordHash = BcryptUtil.bcryptHash(req.password());
        user.persist();

        return Response.status(Response.Status.CREATED)
                .entity(new TokenResponse(issueToken(user), user.id, user.username, user.email))
                .build();
    }

    @POST
    @Path("/login")
    public Response login(@Valid LoginRequest req) {
        return User.findByEmail(req.email())
                .filter(u -> BcryptUtil.matches(req.password(), u.passwordHash))
                .map(u -> Response.ok(new TokenResponse(issueToken(u), u.id, u.username, u.email)).build())
                .orElse(Response.status(Response.Status.UNAUTHORIZED)
                        .entity(new ErrorResponse("Invalid credentials"))
                        .build());
    }

    private static String issueToken(User user) {
        return Jwt.issuer("https://hangouthub.de")
                .upn(user.email)
                .subject(String.valueOf(user.id))
                .groups(Set.of("user"))
                .expiresIn(Duration.ofHours(24))
                .sign();
    }

    public record TokenResponse(String token, Long userId, String username, String email) {}

    public record ErrorResponse(String error) {}
}

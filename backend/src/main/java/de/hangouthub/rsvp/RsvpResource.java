package de.hangouthub.rsvp;

import de.hangouthub.event.EventService;
import de.hangouthub.user.User;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import java.time.LocalDateTime;
import java.util.List;

@Path("/api/events/{eventId}/rsvp")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed("user")
public class RsvpResource {

    @Inject
    EventService eventService;

    @Inject
    JsonWebToken jwt;

    @GET
    public List<Rsvp> listForEvent(@PathParam("eventId") Long eventId) {
        var event = eventService.findOrThrow(eventId);
        return Rsvp.findByEvent(event);
    }

    @PUT
    @Transactional
    public Rsvp upsert(@PathParam("eventId") Long eventId, RsvpRequest req) {
        var event = eventService.findOrThrow(eventId);
        var user = currentUser();

        Rsvp rsvp = Rsvp.findByEventAndUser(event, user).orElseGet(() -> {
            var r = new Rsvp();
            r.event = event;
            r.user = user;
            return r;
        });

        rsvp.status = req.status();
        rsvp.updatedAt = LocalDateTime.now();
        rsvp.persist();
        return rsvp;
    }

    private User currentUser() {
        Long userId = Long.parseLong(jwt.getSubject());
        return (User) User.findByIdOptional(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    public record RsvpRequest(RsvpStatus status) {}
}

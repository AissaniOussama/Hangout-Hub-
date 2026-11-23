package de.hangouthub.invitation;

import de.hangouthub.event.EventService;
import de.hangouthub.user.User;
import jakarta.annotation.security.PermitAll;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import java.net.URI;
import java.util.List;
import java.util.UUID;

@Path("/api/events/{eventId}/invitations")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed("user")
public class InvitationResource {

    @Inject
    EventService eventService;

    @Inject
    JsonWebToken jwt;

    @GET
    public List<Invitation> list(@PathParam("eventId") Long eventId) {
        return Invitation.findByEvent(eventService.findOrThrow(eventId));
    }

    @POST
    @Transactional
    public Response create(@PathParam("eventId") Long eventId) {
        var event = eventService.findOrThrow(eventId);

        var invitation = new Invitation();
        invitation.event = event;
        invitation.inviteCode = UUID.randomUUID().toString().replace("-", "");
        invitation.persist();

        return Response.created(URI.create("/api/invitations/" + invitation.inviteCode))
                .entity(invitation)
                .build();
    }

    @GET
    @Path("/accept/{code}")
    @Transactional
    @PermitAll
    public Response accept(@PathParam("eventId") Long eventId, @PathParam("code") String code) {
        Invitation inv = Invitation.findByCode(code)
                .orElseThrow(() -> new NotFoundException("Invitation not found"));
        inv.status = InvitationStatus.ACCEPTED;
        return Response.ok(inv).build();
    }
}

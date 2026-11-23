package de.hangouthub.chat;

import de.hangouthub.event.Event;
import de.hangouthub.event.EventService;
import de.hangouthub.notification.Notification;
import de.hangouthub.notification.NotificationType;
import de.hangouthub.user.User;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import java.util.List;

@Path("/api/events/{eventId}/messages")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed("user")
public class ChatResource {

    @Inject
    EventService eventService;

    @Inject
    JsonWebToken jwt;

    @GET
    public List<Message> list(@PathParam("eventId") Long eventId) {
        return Message.findByEvent(eventService.findOrThrow(eventId));
    }

    @POST
    @Transactional
    public Response send(@PathParam("eventId") Long eventId, @Valid SendMessageRequest req) {
        var event = eventService.findOrThrow(eventId);
        var sender = currentUser();

        var msg = new Message();
        msg.event = event;
        msg.sender = sender;
        msg.content = req.content();
        msg.persist();

        notifyParticipants(event, sender);

        return Response.status(Response.Status.CREATED).entity(msg).build();
    }

    private void notifyParticipants(Event event, User sender) {
        for (var ep : event.eventRoles) {
            if (ep.userId.equals(sender.id)) continue;
            User user = (User) User.findByIdOptional(ep.userId).orElse(null);
            if (user == null) continue;
            var notification = new Notification();
            notification.user = user;
            notification.message = sender.username + " posted in \"" + event.title + "\"";
            notification.type = NotificationType.NEW_MESSAGE;
            notification.eventId = event.id;
            notification.link = "/events/" + event.id + "/chat";
            notification.persist();
        }
    }

    private User currentUser() {
        Long userId = Long.parseLong(jwt.getSubject());
        return (User) User.findByIdOptional(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    public record SendMessageRequest(@jakarta.validation.constraints.NotBlank String content) {}
}

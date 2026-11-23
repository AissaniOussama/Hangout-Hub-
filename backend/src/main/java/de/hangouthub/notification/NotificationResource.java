package de.hangouthub.notification;

import de.hangouthub.user.User;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.jwt.JsonWebToken;
import java.util.List;

@Path("/api/notifications")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed("user")
public class NotificationResource {

    @Inject
    JsonWebToken jwt;

    @GET
    public List<Notification> list() {
        return Notification.findByUser(currentUser());
    }

    @GET
    @Path("/unread")
    public List<Notification> unread() {
        return Notification.findUnreadByUser(currentUser());
    }

    @PATCH
    @Path("/{id}/read")
    @Transactional
    public Notification markRead(@PathParam("id") Long id) {
        Notification notification = (Notification) Notification.findByIdOptional(id)
                .orElseThrow(() -> new NotFoundException("Notification not found"));
        notification.isRead = true;
        return notification;
    }

    @PATCH
    @Path("/read-all")
    @Transactional
    public void markAllRead() {
        Notification.update("isRead = true WHERE user = ?1", currentUser());
    }

    private User currentUser() {
        Long userId = Long.parseLong(jwt.getSubject());
        return (User) User.findByIdOptional(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }
}

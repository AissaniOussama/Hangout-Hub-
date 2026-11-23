package de.hangouthub.bringlist;

import de.hangouthub.event.Event;
import de.hangouthub.event.EventService;
import de.hangouthub.notification.Notification;
import de.hangouthub.notification.NotificationType;
import de.hangouthub.rsvp.Rsvp;
import de.hangouthub.rsvp.RsvpStatus;
import de.hangouthub.user.User;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import java.net.URI;
import java.util.List;

@Path("/api/events/{eventId}/bring-items")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed("user")
public class BringListResource {

    @Inject
    EventService eventService;

    @Inject
    JsonWebToken jwt;

    @GET
    public List<BringItem> list(@PathParam("eventId") Long eventId) {
        return BringItem.findByEvent(eventService.findOrThrow(eventId));
    }

    @POST
    @Transactional
    public Response add(@PathParam("eventId") Long eventId, @Valid AddItemRequest req) {
        Event event = eventService.findOrThrow(eventId);
        // Edge case: only the organizer may add items to the bring list
        requireOrganizer(event, currentUser());
        var item = new BringItem();
        item.event = event;
        item.description = req.description();
        item.persist();
        return Response.created(URI.create("/api/events/" + eventId + "/bring-items/" + item.id))
                .entity(item)
                .build();
    }

    @DELETE
    @Path("/{itemId}")
    @Transactional
    public Response delete(@PathParam("eventId") Long eventId, @PathParam("itemId") Long itemId) {
        Event event = eventService.findOrThrow(eventId);
        // Edge case: only the organizer may delete items from the bring list
        requireOrganizer(event, currentUser());
        BringItem item = findItemOrThrow(itemId);
        item.delete();
        return Response.noContent().build();
    }

    @POST
    @Path("/{itemId}/claim")
    @Transactional
    public BringItem claim(@PathParam("eventId") Long eventId, @PathParam("itemId") Long itemId) {
        BringItem item = findItemOrThrow(itemId);
        // Feature 4: prevent duplicate claims
        if (item.claimedBy != null) {
            throw new ClientErrorException("Item already claimed", Response.Status.CONFLICT);
        }
        item.claimedBy = currentUser();
        return item;
    }

    @DELETE
    @Path("/{itemId}/claim")
    @Transactional
    public BringItem unclaim(@PathParam("eventId") Long eventId, @PathParam("itemId") Long itemId) {
        BringItem item = findItemOrThrow(itemId);
        item.claimedBy = null;
        return item;
    }

    /**
     * Feature 6: Send a reminder notification to all ATTENDING users
     * who have not yet claimed any bring item for this event.
     * Only the organizer or a co-creator may trigger this.
     */
    @POST
    @Path("/remind")
    @Transactional
    public Response sendReminders(@PathParam("eventId") Long eventId) {
        Event event = eventService.findOrThrow(eventId);
        User requester = currentUser();

        // Only organizer may send reminders (lightweight role check)
        if (!event.organizer.id.equals(requester.id)) {
            throw new ForbiddenException("Only the organizer can send bring-item reminders");
        }

        // Find users attending but without a claimed item
        List<Rsvp> attending = Rsvp.list(
            "event = ?1 AND status = ?2", event, RsvpStatus.ATTENDING);

        List<Long> claimedUserIds = BringItem.findByEvent(event)
            .stream()
            .filter(i -> i.claimedBy != null)
            .map(i -> i.claimedBy.id)
            .toList();

        int notified = 0;
        for (Rsvp rsvp : attending) {
            if (!claimedUserIds.contains(rsvp.user.id)) {
                var notification = new Notification();
                notification.user    = rsvp.user;
                notification.message = "Reminder: please claim a bring item for \"" + event.title + "\"";
                notification.type    = NotificationType.BRING_ITEM_REMINDER;
                notification.eventId = event.id;
                notification.link    = "/events/" + event.id + "?openBringList=1";
                notification.persist();
                notified++;
            }
        }

        return Response.ok(new ReminderResult(notified)).build();
    }

    // ── helpers ───────────────────────────────────────────────────────────

    private BringItem findItemOrThrow(Long itemId) {
        return (BringItem) BringItem.findByIdOptional(itemId)
                .orElseThrow(() -> new NotFoundException("Item not found"));
    }

    private User currentUser() {
        Long userId = Long.parseLong(jwt.getSubject());
        return (User) User.findByIdOptional(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    /** Edge case (security): only the event organizer may add or delete bring-list items. */
    private void requireOrganizer(Event event, User requester) {
        if (event.organizer == null || !event.organizer.id.equals(requester.id)) {
            throw new ForbiddenException("Only the organizer can manage bring-list items");
        }
    }

    public record AddItemRequest(@jakarta.validation.constraints.NotBlank String description) {}
    public record ReminderResult(int notified) {}
}

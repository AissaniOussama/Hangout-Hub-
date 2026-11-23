package de.hangouthub.event;

import de.hangouthub.rsvp.Rsvp;
import de.hangouthub.rsvp.RsvpStatus;
import de.hangouthub.user.User;
import jakarta.annotation.security.PermitAll;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import java.net.URI;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Path("/api/events")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class EventResource {

    @Inject
    EventService eventService;

    @Inject
    JsonWebToken jwt;

    // ── DTOs ─────────────────────────────────────────────────────────────────

    public record ParticipantDto(Long userId, String username, RsvpStatus rsvpStatus, EventRole eventRole) {}
    public record ParticipantsResponse(EventRole myEventRole, long attending, long maybe, List<ParticipantDto> participants) {}
    public record SetRoleRequest(EventRole role) {}
    public record InviteResponse(String inviteToken) {}
    public record EventPreview(Long id, String title) {}
    public record EventsPage(List<Event> items, long totalItems) {}

    // ── Event CRUD ────────────────────────────────────────────────────────────

    @GET
    @PermitAll
    public EventsPage listUpcoming(@QueryParam("q") String q,
                                    @QueryParam("groupId") Long groupId,
                                    @QueryParam("range") String range,
                                    @QueryParam("page") Integer page,
                                    @QueryParam("size") Integer size) {
        LocalDateTime until = switch (range == null ? "" : range) {
            case "week" -> LocalDateTime.now().plusWeeks(1);
            case "month" -> LocalDateTime.now().plusMonths(1);
            default -> null;
        };
        if (jwt != null && jwt.getSubject() != null) {
            try {
                Long userId = Long.parseLong(jwt.getSubject());
                List<Event> items = eventService.findUpcomingForUser(userId, q, groupId, until, page, size);
                long total = eventService.countUpcomingForUser(userId, q, groupId, until);
                return new EventsPage(items, total);
            } catch (NumberFormatException ignored) {}
        }
        List<Event> items = eventService.findPublicUpcoming(q, groupId, until, page, size);
        long total = eventService.countPublicUpcoming(q, groupId, until);
        return new EventsPage(items, total);
    }

    @GET
    @Path("/{id}")
    @PermitAll
    public Event getById(@PathParam("id") Long id) {
        Event event = eventService.findOrThrow(id);
        if (!event.canView(currentUserIdOrNull())) {
            throw new ForbiddenException("You do not have access to this private event");
        }
        return event;
    }

    @POST
    @RolesAllowed("user")
    public Response create(@Valid CreateEventRequest req) {
        Event event = eventService.create(req, currentUser());
        return Response.created(URI.create("/api/events/" + event.id)).entity(event).build();
    }

    @PUT
    @Path("/{id}")
    @RolesAllowed("user")
    public Event update(@PathParam("id") Long id, @Valid CreateEventRequest req) {
        return eventService.update(id, req, currentUser());
    }

    @DELETE
    @Path("/{id}")
    @RolesAllowed("user")
    public Response delete(@PathParam("id") Long id) {
        eventService.delete(id, currentUser());
        return Response.noContent().build();
    }

    // ── ICS Export ────────────────────────────────────────────────────────────

    @GET
    @Path("/{id}/export.ics")
    @PermitAll
    @Produces("text/calendar")
    public Response exportIcs(@PathParam("id") Long id,
                              @QueryParam("location") String locationOverride) {
        Event event = eventService.findOrThrow(id);
        return Response.ok(IcsGenerator.generate(event, locationOverride))
                .header("Content-Disposition", "attachment; filename=\"event-" + id + ".ics\"")
                .build();
    }

    // ── Participants ──────────────────────────────────────────────────────────

    @GET
    @Path("/{id}/participants")
    @PermitAll
    public ParticipantsResponse getParticipants(@PathParam("id") Long id) {
        Event event = eventService.findOrThrow(id);

        Long currentId = currentUserIdOrNull();
        EventRole myRole = event.getEventRoleOf(currentId);

        if (!event.isPublic && myRole == null) {
            boolean isOrganizer = currentId != null && event.organizer != null
                    && currentId.equals(event.organizer.id);
            if (!isOrganizer) {
                throw new ForbiddenException("You do not have access to this private event");
            }
            myRole = EventRole.OWNER;
        }

        List<ParticipantDto> participants;

        if (event.isPublic) {
            participants = Rsvp.findByEvent(event).stream()
                    .filter(r -> r.status == RsvpStatus.ATTENDING || r.status == RsvpStatus.MAYBE)
                    .map(r -> new ParticipantDto(r.user.id, r.user.username, r.status,
                            event.getEventRoleOf(r.user.id)))
                    .toList();
        } else {
            Map<Long, RsvpStatus> rsvpMap = Rsvp.findByEvent(event).stream()
                    .collect(Collectors.toMap(r -> r.user.id, r -> r.status));
            List<ParticipantDto> list = event.eventRoles.stream()
                    .map(ep -> {
                        User u = User.findById(ep.userId);
                        return new ParticipantDto(ep.userId, u != null ? u.username : "Unknown",
                                rsvpMap.get(ep.userId), ep.role);
                    })
                    .collect(Collectors.toList());
            if (event.organizer != null
                    && list.stream().noneMatch(p -> p.userId().equals(event.organizer.id))) {
                list.add(0, new ParticipantDto(event.organizer.id, event.organizer.username,
                        rsvpMap.get(event.organizer.id), EventRole.OWNER));
            }
            participants = list;
        }

        long attending = participants.stream().filter(p -> p.rsvpStatus() == RsvpStatus.ATTENDING).count();
        long maybe     = participants.stream().filter(p -> p.rsvpStatus() == RsvpStatus.MAYBE).count();

        return new ParticipantsResponse(myRole, attending, maybe, participants);
    }

    // ── Role management (OWNER only) ──────────────────────────────────────────

    @PUT
    @Path("/{id}/roles/{targetId}")
    @RolesAllowed("user")
    @Transactional
    public ParticipantsResponse setRole(
            @PathParam("id") Long id,
            @PathParam("targetId") Long targetId,
            SetRoleRequest req) {

        Long currentId = currentUserId();
        Event event = eventService.findOrThrow(id);
        requireOwner(event, currentId);

        if (targetId.equals(currentId)) {
            throw new BadRequestException("Cannot change your own role");
        }

        User target = (User) User.findByIdOptional(targetId)
                .orElseThrow(() -> new NotFoundException("User not found: " + targetId));

        EventRole targetRole = event.getEventRoleOf(targetId);
        if (targetRole == EventRole.OWNER) {
            throw new BadRequestException("Cannot change the event owner's role");
        }
        if (req.role() == EventRole.OWNER) {
            throw new BadRequestException("Cannot assign OWNER role");
        }

        if (targetRole != null) {
            event.eventRoles.stream()
                    .filter(ep -> ep.userId.equals(targetId))
                    .findFirst()
                    .ifPresent(ep -> ep.role = req.role());
        } else {
            event.eventRoles.add(new EventParticipant(targetId, req.role()));
        }

        return buildParticipantsResponse(event, currentId);
    }

    @DELETE
    @Path("/{id}/roles/{targetId}")
    @RolesAllowed("user")
    @Transactional
    public Response removeRole(@PathParam("id") Long id, @PathParam("targetId") Long targetId) {
        Long currentId = currentUserId();
        Event event = eventService.findOrThrow(id);
        requireOwner(event, currentId);

        if (targetId.equals(currentId)) {
            throw new BadRequestException("Cannot remove yourself");
        }
        if (event.getEventRoleOf(targetId) == EventRole.OWNER) {
            throw new BadRequestException("Cannot remove the event owner");
        }

        event.eventRoles.removeIf(ep -> ep.userId.equals(targetId));
        return Response.noContent().build();
    }

    // ── Invite token ──────────────────────────────────────────────────────────

    @POST
    @Path("/{id}/invite/regenerate")
    @RolesAllowed("user")
    @Transactional
    public InviteResponse regenerateInvite(@PathParam("id") Long id) {
        Long currentId = currentUserId();
        Event event = eventService.findOrThrow(id);
        requireOwner(event, currentId);
        event.inviteToken = UUID.randomUUID().toString();
        return new InviteResponse(event.inviteToken);
    }

    @GET
    @Path("/join/{token}")
    @RolesAllowed("user")
    public EventPreview previewInvite(@PathParam("token") String token) {
        Event event = Event.<Event>find("inviteToken", token).firstResult();
        if (event == null) throw new NotFoundException("Invalid invite token");
        return new EventPreview(event.id, event.title);
    }

    @POST
    @Path("/join/{token}")
    @RolesAllowed("user")
    @Transactional
    public Event joinViaToken(@PathParam("token") String token) {
        Long userId = currentUserId();
        Event event = Event.<Event>find("inviteToken", token).firstResult();
        if (event == null) throw new NotFoundException("Invalid invite token");
        if (event.getEventRoleOf(userId) == null) {
            event.eventRoles.add(new EventParticipant(userId, EventRole.VIEWER));
        }
        return event;
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private Long currentUserId() {
        return Long.parseLong(jwt.getSubject());
    }

    private Long currentUserIdOrNull() {
        try {
            return jwt != null && jwt.getSubject() != null ? Long.parseLong(jwt.getSubject()) : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private User currentUser() {
        Long userId = currentUserId();
        return (User) User.findByIdOptional(userId)
                .orElseThrow(() -> new NotFoundException("Authenticated user not found"));
    }

    private void requireOwner(Event event, Long userId) {
        if (!event.canDelete(userId)) throw new ForbiddenException("Event owner access required");
    }

    private ParticipantsResponse buildParticipantsResponse(Event event, Long currentUserId) {
        Map<Long, RsvpStatus> rsvpMap = Rsvp.findByEvent(event).stream()
                .collect(Collectors.toMap(r -> r.user.id, r -> r.status));
        List<ParticipantDto> participants = event.eventRoles.stream()
                .map(ep -> {
                    User u = User.findById(ep.userId);
                    return new ParticipantDto(ep.userId, u != null ? u.username : "Unknown",
                            rsvpMap.get(ep.userId), ep.role);
                })
                .toList();
        long attending = participants.stream().filter(p -> p.rsvpStatus() == RsvpStatus.ATTENDING).count();
        long maybe     = participants.stream().filter(p -> p.rsvpStatus() == RsvpStatus.MAYBE).count();
        return new ParticipantsResponse(event.getEventRoleOf(currentUserId), attending, maybe, participants);
    }
}

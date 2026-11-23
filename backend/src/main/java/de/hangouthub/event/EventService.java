package de.hangouthub.event;

import de.hangouthub.group.Group;
import de.hangouthub.user.User;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.NotFoundException;
import java.time.LocalDateTime;
import java.util.List;

@ApplicationScoped
public class EventService {

    @Transactional
    public Event create(CreateEventRequest req, User organizer) {
        validateParticipantLimits(req);
        var event = new Event();
        applyFields(event, req, organizer.id);
        event.organizer = organizer;
        event.eventRoles.add(new EventParticipant(organizer.id, EventRole.OWNER));
        if (event.group != null) {
            for (var member : event.group.members) {
                if (!member.userId.equals(organizer.id)) {
                    event.eventRoles.add(new EventParticipant(member.userId, EventRole.VIEWER));
                }
            }
        }
        event.persist();
        return event;
    }

    @Transactional
    public Event update(Long id, CreateEventRequest req, User requester) {
        Event event = findOrThrow(id);
        if (!event.canEdit(requester.id)) {
            throw new ForbiddenException("Only the event owner or editors can edit this event");
        }
        validateParticipantLimits(req);
        applyFields(event, req, requester.id);
        return event;
    }

    @Transactional
    public void delete(Long id, User requester) {
        Event event = findOrThrow(id);
        if (!event.canDelete(requester.id)) {
            throw new ForbiddenException("Only the event owner can delete this event");
        }
        event.delete();
    }

    public Event findOrThrow(Long id) {
        return (Event) Event.findByIdOptional(id)
                .orElseThrow(() -> new NotFoundException("Event not found: " + id));
    }

    public List<Event> findPublicUpcoming(String search, Long groupId, LocalDateTime until, Integer page, Integer size) {
        return Event.findPublicUpcoming(search, groupId, until, page, size);
    }

    public long countPublicUpcoming(String search, Long groupId, LocalDateTime until) {
        return Event.countPublicUpcoming(search, groupId, until);
    }

    public List<Event> findUpcomingForUser(Long userId, String search, Long groupId, LocalDateTime until,
                                            Integer page, Integer size) {
        return Event.findUpcomingForUser(groupIdsOf(userId), userId, search, groupId, until, page, size);
    }

    public long countUpcomingForUser(Long userId, String search, Long groupId, LocalDateTime until) {
        return Event.countUpcomingForUser(groupIdsOf(userId), userId, search, groupId, until);
    }

    private List<Long> groupIdsOf(Long userId) {
        return Group.findByMember(userId).stream().map(g -> g.id).toList();
    }

    // ── private helpers ───────────────────────────────────────────────────────

    private void applyFields(Event event, CreateEventRequest req, Long requesterId) {
        event.title        = req.title();
        event.description  = req.description();
        event.startTime    = req.startTime();
        event.endTime      = req.endTime();
        event.location     = req.location();
        event.admissionFee = req.admissionFee();

        event.minParticipants = req.minParticipants();
        event.maxParticipants = req.maxParticipants();

        event.isPublic = req.isPublic() != null ? req.isPublic() : true;

        event.hasBringList = req.hasBringList() != null ? req.hasBringList() : false;

        if (req.groupId() != null) {
            Group group = (Group) Group.findByIdOptional(req.groupId())
                    .orElseThrow(() -> new NotFoundException("Group not found: " + req.groupId()));
            if (!group.canModerate(requesterId)) {
                throw new ForbiddenException("Only group owners and admins can create events for a group");
            }
            event.group = group;
        } else {
            event.group = null;
        }

        if (req.seriesParentId() != null) {
            event.seriesParent = findOrThrow(req.seriesParentId());
        } else {
            event.seriesParent = null;
        }
    }

    private void validateParticipantLimits(CreateEventRequest req) {
        if (req.minParticipants() != null && req.maxParticipants() != null
                && req.maxParticipants() < req.minParticipants()) {
            throw new BadRequestException("maxParticipants must be >= minParticipants");
        }
    }
}

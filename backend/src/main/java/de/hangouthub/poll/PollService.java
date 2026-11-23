package de.hangouthub.poll;

import de.hangouthub.event.Event;
import de.hangouthub.event.EventService;
import de.hangouthub.notification.Notification;
import de.hangouthub.notification.NotificationType;
import de.hangouthub.user.User;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.core.Response;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@ApplicationScoped
public class PollService {

    @Inject
    EventService eventService;

    // ── DTOs ─────────────────────────────────────────────────────────────────

    public record CreateOptionRequest(
            @jakarta.validation.constraints.NotNull PollOptionType optionType,
            String text,
            LocalDate dateValue
    ) {}

    public record CreatePollRequest(
            @jakarta.validation.constraints.NotBlank String question,
            @jakarta.validation.constraints.NotNull VoteMode voteMode,
            LocalDateTime closesAt,
            @jakarta.validation.constraints.NotEmpty List<CreateOptionRequest> options
    ) {}

    public record VoterInfo(Long userId, String username) {}

    public record PollOptionResponse(
            Long id, PollOptionType optionType, String text, LocalDate dateValue,
            long voteCount, boolean votedByMe, List<VoterInfo> voters
    ) {}

    public record PollResponse(
            Long id, String question, VoteMode voteMode, LocalDateTime createdAt,
            LocalDateTime closesAt, boolean closed, List<PollOptionResponse> options
    ) {}

    // ── Reads ────────────────────────────────────────────────────────────────

    public List<PollResponse> listForEvent(Long eventId, User requester) {
        Event event = eventService.findOrThrow(eventId);
        requireView(event, requester.id);
        return Poll.findByEvent(event).stream().map(p -> toResponse(p, requester)).toList();
    }

    // ── Create ───────────────────────────────────────────────────────────────

    @Transactional
    public PollResponse create(Long eventId, CreatePollRequest req, User requester) {
        Event event = eventService.findOrThrow(eventId);
        if (!event.canEdit(requester.id)) {
            throw new ForbiddenException("Only the event owner or editors can create polls");
        }
        if (req.closesAt() != null && req.closesAt().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("closesAt must be in the future");
        }

        var poll = new Poll();
        poll.event = event;
        poll.question = req.question();
        poll.voteMode = req.voteMode();
        poll.closesAt = req.closesAt();

        for (CreateOptionRequest optReq : req.options()) {
            var opt = new PollOption();
            opt.poll = poll;
            opt.optionType = optReq.optionType();
            if (optReq.optionType() == PollOptionType.TEXT) {
                if (optReq.text() == null || optReq.text().isBlank()) {
                    throw new BadRequestException("Text options require non-blank text");
                }
                opt.text = optReq.text();
            } else {
                if (optReq.dateValue() == null) {
                    throw new BadRequestException("Date options require a date");
                }
                opt.dateValue = optReq.dateValue();
            }
            poll.options.add(opt);
        }
        poll.persist();

        notifyParticipants(event, requester.id, NotificationType.POLL_CREATED,
                "A new poll was created for \"" + event.title + "\": " + poll.question);

        return toResponse(poll, requester);
    }

    // ── Voting ───────────────────────────────────────────────────────────────

    @Transactional
    public PollResponse vote(Long eventId, Long pollId, Long optionId, User requester) {
        PollOption option = findOptionOrThrow(eventId, pollId, optionId);
        Poll poll = option.poll;
        requireView(poll.event, requester.id);
        if (poll.isClosed()) {
            throw new ClientErrorException("This poll is closed", Response.Status.CONFLICT);
        }

        boolean voted;
        switch (poll.voteMode) {
            case MULTIPLE -> {
                PollVote existing = PollVote.findByUserAndOption(requester, option);
                if (existing != null) {
                    existing.delete();
                    voted = false;
                } else {
                    persistVote(requester, option);
                    voted = true;
                }
            }
            case SINGLE_LOCKED -> {
                if (!PollVote.findByUserAndPoll(requester, poll).isEmpty()) {
                    throw new ClientErrorException(
                            "You have already voted and votes cannot be changed for this poll",
                            Response.Status.CONFLICT);
                }
                persistVote(requester, option);
                voted = true;
            }
            case SINGLE_CHANGEABLE -> {
                PollVote.findByUserAndPoll(requester, poll).forEach(PollVote::delete);
                persistVote(requester, option);
                voted = true;
            }
            default -> voted = false;
        }

        if (voted) {
            notifyParticipants(poll.event, requester.id, NotificationType.POLL_VOTE,
                    requester.username + " voted in poll \"" + poll.question + "\" for \"" + poll.event.title + "\"");
        }

        return toResponse(poll, requester);
    }

    @Transactional
    public PollResponse retractVote(Long eventId, Long pollId, Long optionId, User requester) {
        PollOption option = findOptionOrThrow(eventId, pollId, optionId);
        Poll poll = option.poll;
        requireView(poll.event, requester.id);
        if (poll.isClosed()) {
            throw new ClientErrorException("This poll is closed", Response.Status.CONFLICT);
        }
        if (poll.voteMode == VoteMode.SINGLE_LOCKED) {
            throw new ForbiddenException("Votes cannot be retracted for this poll");
        }

        PollVote existing = PollVote.findByUserAndOption(requester, option);
        if (existing != null) {
            existing.delete();
        }

        return toResponse(poll, requester);
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────

    @Transactional
    public PollResponse close(Long eventId, Long pollId, User requester) {
        Poll poll = findPollOrThrow(eventId, pollId);
        if (!poll.event.canEdit(requester.id)) {
            throw new ForbiddenException("Only the event owner or editors can close polls");
        }
        if (poll.closed) {
            throw new BadRequestException("Poll is already closed");
        }
        poll.closed = true;
        return toResponse(poll, requester);
    }

    @Transactional
    public void delete(Long eventId, Long pollId, User requester) {
        Poll poll = findPollOrThrow(eventId, pollId);
        if (!poll.event.canEdit(requester.id)) {
            throw new ForbiddenException("Only the event owner or editors can delete polls");
        }
        poll.delete();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void requireView(Event event, Long userId) {
        if (!event.canView(userId)) {
            throw new ForbiddenException("You do not have access to this event's polls");
        }
    }

    private void persistVote(User user, PollOption option) {
        var vote = new PollVote();
        vote.user = user;
        vote.pollOption = option;
        vote.persist();
    }

    private Poll findPollOrThrow(Long eventId, Long pollId) {
        Poll poll = (Poll) Poll.findByIdOptional(pollId)
                .orElseThrow(() -> new NotFoundException("Poll not found"));
        if (!poll.event.id.equals(eventId)) {
            throw new NotFoundException("Poll not found for this event");
        }
        return poll;
    }

    private PollOption findOptionOrThrow(Long eventId, Long pollId, Long optionId) {
        Poll poll = findPollOrThrow(eventId, pollId);
        return poll.options.stream()
                .filter(o -> o.id.equals(optionId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Option not found for this poll"));
    }

    private void notifyParticipants(Event event, Long actingUserId, NotificationType type, String message) {
        for (var ep : event.eventRoles) {
            if (ep.userId.equals(actingUserId)) continue;
            User user = (User) User.findByIdOptional(ep.userId).orElse(null);
            if (user == null) continue;
            var notification = new Notification();
            notification.user = user;
            notification.message = message;
            notification.type = type;
            notification.eventId = event.id;
            notification.link = "/events/" + event.id;
            notification.persist();
        }
    }

    private PollOptionResponse toResponse(PollOption option, User requester) {
        boolean votedByMe = requester != null && PollVote.findByUserAndOption(requester, option) != null;
        List<VoterInfo> voters = PollVote.findByOption(option).stream()
                .map(v -> new VoterInfo(v.user.id, v.user.username))
                .toList();
        return new PollOptionResponse(option.id, option.optionType, option.text, option.dateValue,
                voters.size(), votedByMe, voters);
    }

    private PollResponse toResponse(Poll poll, User requester) {
        List<PollOptionResponse> options = poll.options.stream()
                .map(o -> toResponse(o, requester))
                .toList();
        return new PollResponse(poll.id, poll.question, poll.voteMode, poll.createdAt,
                poll.closesAt, poll.isClosed(), options);
    }
}

package de.hangouthub.poll;

import de.hangouthub.user.User;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import java.net.URI;
import java.util.List;

@Path("/api/events/{eventId}/polls")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed("user")
public class PollResource {

    @Inject
    PollService pollService;

    @Inject
    JsonWebToken jwt;

    @GET
    public List<PollService.PollResponse> list(@PathParam("eventId") Long eventId) {
        return pollService.listForEvent(eventId, currentUser());
    }

    @POST
    public Response create(@PathParam("eventId") Long eventId, @Valid PollService.CreatePollRequest req) {
        PollService.PollResponse poll = pollService.create(eventId, req, currentUser());
        return Response.created(URI.create("/api/events/" + eventId + "/polls/" + poll.id()))
                .entity(poll)
                .build();
    }

    @POST
    @Path("/{pollId}/options/{optionId}/vote")
    public PollService.PollResponse vote(@PathParam("eventId") Long eventId,
                                          @PathParam("pollId") Long pollId,
                                          @PathParam("optionId") Long optionId) {
        return pollService.vote(eventId, pollId, optionId, currentUser());
    }

    @DELETE
    @Path("/{pollId}/options/{optionId}/vote")
    public PollService.PollResponse retractVote(@PathParam("eventId") Long eventId,
                                                 @PathParam("pollId") Long pollId,
                                                 @PathParam("optionId") Long optionId) {
        return pollService.retractVote(eventId, pollId, optionId, currentUser());
    }

    @POST
    @Path("/{pollId}/close")
    public PollService.PollResponse close(@PathParam("eventId") Long eventId, @PathParam("pollId") Long pollId) {
        return pollService.close(eventId, pollId, currentUser());
    }

    @DELETE
    @Path("/{pollId}")
    public Response delete(@PathParam("eventId") Long eventId, @PathParam("pollId") Long pollId) {
        pollService.delete(eventId, pollId, currentUser());
        return Response.noContent().build();
    }

    private User currentUser() {
        Long userId = Long.parseLong(jwt.getSubject());
        return (User) User.findByIdOptional(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }
}

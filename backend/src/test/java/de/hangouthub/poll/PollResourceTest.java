package de.hangouthub.poll;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
class PollResourceTest {

    private record AuthedUser(String token, long userId, String username) {}

    private AuthedUser registerUser() {
        long unique = System.nanoTime();
        String username = "polltester_" + unique;
        String email = "poll_test_" + unique + "@hangouthub.de";

        long userId = given()
                .contentType(ContentType.JSON)
                .body(String.format("""
                    {"username":"%s","email":"%s","password":"password123"}
                    """, username, email))
                .when().post("/api/auth/register")
                .then().statusCode(201)
                .extract().jsonPath().getLong("userId");

        String token = given()
                .contentType(ContentType.JSON)
                .body(String.format("""
                    {"email":"%s","password":"password123"}
                    """, email))
                .when().post("/api/auth/login")
                .then().statusCode(200)
                .extract().path("token");

        return new AuthedUser(token, userId, username);
    }

    private long createEvent(String token, boolean isPublic) {
        return given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + token)
                .body(String.format("""
                    {"title":"Poll Test Event","startTime":"2026-08-01T18:00:00","isPublic":%b}
                    """, isPublic))
                .when().post("/api/events")
                .then().statusCode(201)
                .extract().jsonPath().getLong("id");
    }

    private Response createPoll(String token, long eventId, String voteMode, String optionsJson) {
        return given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + token)
                .body(String.format("""
                    {"question":"Which option?","voteMode":"%s","options":%s}
                    """, voteMode, optionsJson))
                .when().post("/api/events/" + eventId + "/polls");
    }

    private static final String TWO_TEXT_OPTIONS = """
        [{"optionType":"TEXT","text":"Option A"},{"optionType":"TEXT","text":"Option B"}]
        """;

    @Test
    void create_asOwner_returns201WithOptions() {
        var owner = registerUser();
        long eventId = createEvent(owner.token(), true);

        createPoll(owner.token(), eventId, "SINGLE_CHANGEABLE", TWO_TEXT_OPTIONS)
                .then()
                .statusCode(201)
                .body("question", equalTo("Which option?"))
                .body("options.size()", is(2))
                .body("options[0].voteCount", is(0));
    }

    @Test
    void create_asNonMemberOfPrivateEvent_returns403() {
        var owner = registerUser();
        var stranger = registerUser();
        long eventId = createEvent(owner.token(), false);

        createPoll(stranger.token(), eventId, "SINGLE_CHANGEABLE", TWO_TEXT_OPTIONS)
                .then()
                .statusCode(403);
    }

    @Test
    void vote_onPublicEventWithoutRole_isAllowed() {
        var owner = registerUser();
        var voter = registerUser();
        long eventId = createEvent(owner.token(), true);

        Response poll = createPoll(owner.token(), eventId, "SINGLE_CHANGEABLE", TWO_TEXT_OPTIONS)
                .then().statusCode(201).extract().response();
        long pollId = poll.jsonPath().getLong("id");
        long optionId = poll.jsonPath().getLong("options[0].id");

        voteFor(voter.token(), eventId, pollId, optionId)
                .then()
                .statusCode(200)
                .body("options[0].voteCount", is(1))
                .body("options[0].votedByMe", is(true));
    }

    @Test
    void listPolls_includesVoterUsernamesPerOption() {
        var owner = registerUser();
        var voter = registerUser();
        long eventId = createEvent(owner.token(), true);

        Response poll = createPoll(owner.token(), eventId, "SINGLE_CHANGEABLE", TWO_TEXT_OPTIONS)
                .then().statusCode(201).extract().response();
        long pollId = poll.jsonPath().getLong("id");
        long optionId = poll.jsonPath().getLong("options[0].id");

        voteFor(voter.token(), eventId, pollId, optionId).then().statusCode(200);

        given()
                .header("Authorization", "Bearer " + owner.token())
                .when().get("/api/events/" + eventId + "/polls")
                .then().statusCode(200)
                .body("[0].options[0].voters.size()", is(1))
                .body("[0].options[0].voters[0].userId", is((int) voter.userId()))
                .body("[0].options[0].voters[0].username", equalTo(voter.username()))
                .body("[0].options[1].voters.size()", is(0));
    }

    @Test
    void vote_singleChangeable_switchesVoteBetweenOptions() {
        var owner = registerUser();
        long eventId = createEvent(owner.token(), true);
        Response poll = createPoll(owner.token(), eventId, "SINGLE_CHANGEABLE", TWO_TEXT_OPTIONS)
                .then().statusCode(201).extract().response();
        long pollId = poll.jsonPath().getLong("id");
        long option1 = poll.jsonPath().getLong("options[0].id");
        long option2 = poll.jsonPath().getLong("options[1].id");

        voteFor(owner.token(), eventId, pollId, option1)
                .then().body("options[0].voteCount", is(1)).body("options[1].voteCount", is(0));

        voteFor(owner.token(), eventId, pollId, option2)
                .then().body("options[0].voteCount", is(0)).body("options[1].voteCount", is(1));
    }

    @Test
    void vote_singleLocked_rejectsSecondVoteForDifferentOption() {
        var owner = registerUser();
        long eventId = createEvent(owner.token(), true);
        Response poll = createPoll(owner.token(), eventId, "SINGLE_LOCKED", TWO_TEXT_OPTIONS)
                .then().statusCode(201).extract().response();
        long pollId = poll.jsonPath().getLong("id");
        long option1 = poll.jsonPath().getLong("options[0].id");
        long option2 = poll.jsonPath().getLong("options[1].id");

        voteFor(owner.token(), eventId, pollId, option1).then().statusCode(200);
        voteFor(owner.token(), eventId, pollId, option2).then().statusCode(409);
    }

    @Test
    void vote_multiple_togglesVoteOnRepeatedCalls() {
        var owner = registerUser();
        long eventId = createEvent(owner.token(), true);
        Response poll = createPoll(owner.token(), eventId, "MULTIPLE", TWO_TEXT_OPTIONS)
                .then().statusCode(201).extract().response();
        long pollId = poll.jsonPath().getLong("id");
        long option1 = poll.jsonPath().getLong("options[0].id");
        long option2 = poll.jsonPath().getLong("options[1].id");

        voteFor(owner.token(), eventId, pollId, option1).then().body("options[0].voteCount", is(1));
        voteFor(owner.token(), eventId, pollId, option2).then()
                .body("options[0].voteCount", is(1))
                .body("options[1].voteCount", is(1));
        voteFor(owner.token(), eventId, pollId, option1).then()
                .body("options[0].voteCount", is(0))
                .body("options[1].voteCount", is(1));
    }

    @Test
    void vote_onClosedPoll_returns409() {
        var owner = registerUser();
        long eventId = createEvent(owner.token(), true);
        Response poll = createPoll(owner.token(), eventId, "SINGLE_CHANGEABLE", TWO_TEXT_OPTIONS)
                .then().statusCode(201).extract().response();
        long pollId = poll.jsonPath().getLong("id");
        long option1 = poll.jsonPath().getLong("options[0].id");

        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + owner.token())
                .when().post("/api/events/" + eventId + "/polls/" + pollId + "/close")
                .then().statusCode(200)
                .body("closed", is(true));

        voteFor(owner.token(), eventId, pollId, option1).then().statusCode(409);
    }

    @Test
    void delete_asOwner_removesPollFromList() {
        var owner = registerUser();
        long eventId = createEvent(owner.token(), true);
        long pollId = createPoll(owner.token(), eventId, "SINGLE_CHANGEABLE", TWO_TEXT_OPTIONS)
                .then().statusCode(201).extract().jsonPath().getLong("id");

        given()
                .header("Authorization", "Bearer " + owner.token())
                .when().delete("/api/events/" + eventId + "/polls/" + pollId)
                .then().statusCode(204);

        given()
                .header("Authorization", "Bearer " + owner.token())
                .when().get("/api/events/" + eventId + "/polls")
                .then().statusCode(200)
                .body("findAll { it.id == " + pollId + " }.size()", is(0));
    }

    @Test
    void create_withDateOption_returnsDateValue() {
        var owner = registerUser();
        long eventId = createEvent(owner.token(), true);

        createPoll(owner.token(), eventId, "SINGLE_CHANGEABLE",
                """
                [{"optionType":"DATE","dateValue":"2026-09-01"},{"optionType":"DATE","dateValue":"2026-09-02"}]
                """)
                .then()
                .statusCode(201)
                .body("options[0].optionType", equalTo("DATE"))
                .body("options[0].dateValue", equalTo("2026-09-01"));
    }

    private Response voteFor(String token, long eventId, long pollId, long optionId) {
        return given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + token)
                .when().post("/api/events/" + eventId + "/polls/" + pollId + "/options/" + optionId + "/vote");
    }
}

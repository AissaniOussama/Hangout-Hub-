package de.hangouthub.event;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
class EventResourceTest {

    @Test
    void listUpcoming_returnsOk() {
        given()
            .when().get("/api/events")
            .then()
            .statusCode(200)
            .contentType(ContentType.JSON)
            .body("items", instanceOf(java.util.List.class))
            .body("totalItems", greaterThanOrEqualTo(0));
    }

    @Test
    void listUpcoming_paginates() {
        given()
            .when().get("/api/events?page=0&size=1")
            .then()
            .statusCode(200)
            .body("items.size()", lessThanOrEqualTo(1));
    }

    @Test
    void createEvent_withoutAuth_returns401() {
        given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Test Party",
                  "startTime": "2026-08-01T18:00:00"
                }
                """)
            .when().post("/api/events")
            .then()
            .statusCode(401);
    }

    @Test
    void createEvent_withAuth_returns201() {
        String email = "create_event_test_" + System.currentTimeMillis() + "@hangouthub.de";

        given()
            .contentType(ContentType.JSON)
            .body(String.format("""
                {"username":"testuser_%d","email":"%s","password":"password123"}
                """, System.currentTimeMillis(), email))
            .when().post("/api/auth/register")
            .then().statusCode(201);

        String token = given()
            .contentType(ContentType.JSON)
            .body(String.format("""
                {"email":"%s","password":"password123"}
                """, email))
            .when().post("/api/auth/login")
            .then().statusCode(200)
            .extract().path("token");

        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + token)
            .body("""
                {
                  "title": "Test Party",
                  "startTime": "2026-08-01T18:00:00"
                }
                """)
            .when().post("/api/events")
            .then()
            .statusCode(201)
            .body("title", equalTo("Test Party"));
    }

    private String registerAndLogin(String prefix) {
        String email = prefix + "_" + System.currentTimeMillis() + "@hangouthub.de";

        given()
            .contentType(ContentType.JSON)
            .body(String.format("""
                {"username":"%s_%d","email":"%s","password":"password123"}
                """, prefix, System.currentTimeMillis(), email))
            .when().post("/api/auth/register")
            .then().statusCode(201);

        return given()
            .contentType(ContentType.JSON)
            .body(String.format("""
                {"email":"%s","password":"password123"}
                """, email))
            .when().post("/api/auth/login")
            .then().statusCode(200)
            .extract().path("token");
    }

    private long createEvent(String token, boolean isPublic) {
        return ((Integer) given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + token)
            .body(String.format("""
                {
                  "title": "Visibility Test Event",
                  "startTime": "2026-08-01T18:00:00",
                  "isPublic": %b
                }
                """, isPublic))
            .when().post("/api/events")
            .then()
            .statusCode(201)
            .extract().path("id")).longValue();
    }

    @Test
    void getById_privateEvent_withoutAuth_returns403() {
        String token = registerAndLogin("private_owner");
        long eventId = createEvent(token, false);

        given()
            .when().get("/api/events/" + eventId)
            .then()
            .statusCode(403);
    }

    @Test
    void getById_publicEvent_withoutAuth_returns200() {
        String token = registerAndLogin("public_owner");
        long eventId = createEvent(token, true);

        given()
            .when().get("/api/events/" + eventId)
            .then()
            .statusCode(200)
            .body("id", equalTo((int) eventId));
    }

    @Test
    void getById_privateEvent_asOrganizer_returns200() {
        String token = registerAndLogin("private_organizer");
        long eventId = createEvent(token, false);

        given()
            .header("Authorization", "Bearer " + token)
            .when().get("/api/events/" + eventId)
            .then()
            .statusCode(200)
            .body("id", equalTo((int) eventId));
    }
}

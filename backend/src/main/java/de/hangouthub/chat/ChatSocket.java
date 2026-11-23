package de.hangouthub.chat;

import io.quarkus.websockets.next.OnClose;
import io.quarkus.websockets.next.OnOpen;
import io.quarkus.websockets.next.OnTextMessage;
import io.quarkus.websockets.next.WebSocket;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.inject.Inject;

/**
 * Live WebSocket endpoint for chat messages.
 * Path: /ws/chat/{eventId}
 *
 * Broadcasts incoming text to all connections subscribed to the same event.
 * TODO: validate JWT from query param before allowing connection.
 */
@WebSocket(path = "/ws/chat/{eventId}")
public class ChatSocket {

    @Inject
    WebSocketConnection connection;

    @OnOpen
    public String onOpen() {
        String eventId = connection.pathParam("eventId");
        return "{\"type\":\"connected\",\"eventId\":\"" + eventId + "\"}";
    }

    @OnTextMessage
    public void onMessage(String message) {
        String eventId = connection.pathParam("eventId");
        connection.broadcast()
                .filter(c -> eventId.equals(c.pathParam("eventId")))
                .sendTextAndAwait(message);
    }

    @OnClose
    public void onClose() {
        // cleanup if needed
    }
}

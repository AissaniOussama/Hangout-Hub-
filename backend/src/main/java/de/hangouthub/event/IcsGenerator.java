package de.hangouthub.event;

import java.time.format.DateTimeFormatter;
import java.util.UUID;

/**
 * Feature 5: Generates an iCalendar (.ics) string for a single event.
 * Pure string generation – no external library needed.
 *
 * Spec reference: RFC 5545
 */
public final class IcsGenerator {

    /** iCal datetime format (UTC-like, no timezone conversion for simplicity). */
    private static final DateTimeFormatter ICS_FMT =
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss");

    private IcsGenerator() {}

    public static String generate(Event event) {
        return generate(event, null);
    }

    public static String generate(Event event, String locationOverride) {
        var sb = new StringBuilder();

        sb.append("BEGIN:VCALENDAR\r\n");
        sb.append("VERSION:2.0\r\n");
        sb.append("PRODID:-//HangoutHub//EN\r\n");
        sb.append("CALSCALE:GREGORIAN\r\n");
        sb.append("METHOD:PUBLISH\r\n");

        sb.append("BEGIN:VEVENT\r\n");
        sb.append("UID:").append(UUID.randomUUID()).append("@hangouthub\r\n");
        sb.append("DTSTAMP:").append(ICS_FMT.format(java.time.LocalDateTime.now())).append("\r\n");
        sb.append("DTSTART:").append(ICS_FMT.format(event.startTime)).append("\r\n");

        if (event.endTime != null) {
            sb.append("DTEND:").append(ICS_FMT.format(event.endTime)).append("\r\n");
        }

        sb.append("SUMMARY:").append(escapeIcs(event.title)).append("\r\n");

        if (event.description != null && !event.description.isBlank()) {
            sb.append("DESCRIPTION:").append(escapeIcs(event.description)).append("\r\n");
        }

        String location = (locationOverride != null && !locationOverride.isBlank())
                ? locationOverride
                : event.location;
        if (location != null && !location.isBlank()) {
            sb.append("LOCATION:").append(escapeIcs(location)).append("\r\n");
        }

        sb.append("END:VEVENT\r\n");
        sb.append("END:VCALENDAR\r\n");

        return sb.toString();
    }

    /**
     * Escape special characters as required by RFC 5545:
     * backslash, semicolon, comma, and newline.
     */
    private static String escapeIcs(String value) {
        return value
                .replace("\\", "\\\\")
                .replace(";", "\\;")
                .replace(",", "\\,")
                .replace("\n", "\\n")
                .replace("\r", "");
    }
}

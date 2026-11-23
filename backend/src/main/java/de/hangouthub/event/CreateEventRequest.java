package de.hangouthub.event;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

/**
 * Request payload for creating or updating an event.
 * New optional fields are added at the end to stay backward-compatible.
 */
public record CreateEventRequest(
        @NotBlank String title,
        String description,
        @NotNull LocalDateTime startTime,
        LocalDateTime endTime,
        String location,
        Integer admissionFee,

        // Feature 1: optional group association
        Long groupId,

        // Feature 3: participant limits
        Integer minParticipants,
        Integer maxParticipants,

        // Feature 7 optional: visibility
        Boolean isPublic,

        // Feature 7 optional: series link
        Long seriesParentId,

        // Bring list ("Mitbringliste") toggle
        Boolean hasBringList
) {}

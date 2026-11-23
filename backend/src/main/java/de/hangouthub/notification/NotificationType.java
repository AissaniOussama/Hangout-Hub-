package de.hangouthub.notification;

public enum NotificationType {
    RSVP_CHANGED,
    NEW_MESSAGE,
    INVITATION_RECEIVED,
    EVENT_UPDATED,
    POLL_CREATED,
    POLL_VOTE,
    /** Feature 6: Reminder for attendees who haven't claimed a bring item yet. */
    BRING_ITEM_REMINDER
}

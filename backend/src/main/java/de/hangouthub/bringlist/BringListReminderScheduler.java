package de.hangouthub.bringlist;

import de.hangouthub.event.Event;
import de.hangouthub.notification.Notification;
import de.hangouthub.notification.NotificationType;
import de.hangouthub.rsvp.Rsvp;
import de.hangouthub.rsvp.RsvpStatus;
import de.hangouthub.user.User;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Daily job that reminds attendees who haven't claimed a bring-list item yet
 * for events happening in 3 days.
 */
@ApplicationScoped
public class BringListReminderScheduler {

    @Scheduled(cron = "0 0 9 * * ?")
    @Transactional
    public void remindUpcomingEvents() {
        LocalDateTime dayStart = LocalDate.now().plusDays(3).atStartOfDay();
        LocalDateTime dayEnd = dayStart.plusDays(1);

        List<Event> events = Event.list(
                "hasBringList = true AND startTime >= ?1 AND startTime < ?2", dayStart, dayEnd);

        for (Event event : events) {
            remindAttendeesWithoutClaim(event);
        }
    }

    private void remindAttendeesWithoutClaim(Event event) {
        List<Rsvp> attending = Rsvp.list("event = ?1 AND status = ?2", event, RsvpStatus.ATTENDING);

        List<Long> claimedUserIds = BringItem.findByEvent(event)
                .stream()
                .filter(i -> i.claimedBy != null)
                .map(i -> i.claimedBy.id)
                .toList();

        for (Rsvp rsvp : attending) {
            User user = rsvp.user;
            if (claimedUserIds.contains(user.id)) continue;
            if (alreadyReminded(user, event)) continue;

            var notification = new Notification();
            notification.user = user;
            notification.message = "\"" + event.title + "\" is in 3 days and you haven't signed up for anything on the bring list yet!";
            notification.type = NotificationType.BRING_ITEM_REMINDER;
            notification.eventId = event.id;
            notification.link = "/events/" + event.id + "?openBringList=1";
            notification.persist();
        }
    }

    private boolean alreadyReminded(User user, Event event) {
        return Notification.count(
                "user = ?1 AND eventId = ?2 AND type = ?3",
                user, event.id, NotificationType.BRING_ITEM_REMINDER) > 0;
    }
}

# EventMate – Private Events einfach planen und organisieren

AI wurde verwendet, um die folgenden Inhalte zu generieren.

## Kurzbeschreibung

EventMate ist eine webbasierte Anwendung zur Planung und Organisation privater Veranstaltungen. Nutzer können Events erstellen, verwalten und gezielt Freunde einladen. Für jedes Event lassen sich zentrale Parameter wie Ort, Zeit, Teilnehmerlimit und Eintrittskosten definieren. Darüber hinaus unterstützt die App kollaborative Funktionen wie Mitbringlisten (z. B. Essen, Getränke), Abstimmungen (z. B. Terminfindung), sowie Status-Tracking (z. B. Zusagen/Absagen).

Ziel ist es, die Koordination privater Events zu vereinfachen und typische Kommunikationsprobleme (z. B. unklare Zuständigkeiten oder fehlende Informationen) strukturiert zu lösen.

---

## Skizze der Komponentenarchitektur (konzeptionell)

### Frontend-Komponenten (React)

- `App` (Root-Komponente)
- `EventList` (Übersicht aller Events)
- `EventDetail` (Detailansicht eines Events)
- `EventForm` (Erstellen/Bearbeiten)
- `InviteManager` (Einladungen verwalten)
- `ItemList` (Mitbringliste)
- `RSVPComponent` (Teilnahmeverwaltung)
- `ChatComponent` (Kommunikation)

### Backend-Komponenten (Service-orientiert)

- **AuthService** (Login, Registrierung, Token-Verwaltung)
- **EventService** (CRUD für Events)
- **InvitationService** (Einladungslogik)
- **ListService** (Mitbringlisten-Verwaltung)
- **UserService** (Benutzerverwaltung)
- **ChatService** (Live Chat-Funktionalität)

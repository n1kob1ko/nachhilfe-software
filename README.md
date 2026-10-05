# Lernheft – Nachhilfe-Software

Web-App für Nachhilfelehrer: Schülerprofile, Dokumentation jeder Stunde, Übungs-Builder mit automatischen Lösungswegen, ein Schüler-Modus zum selbstständigen Üben, Fortschritt pro Fähigkeit, automatische Analyse und Übungsempfehlungen.

## Starten

Voraussetzung: Node.js 20 oder neuer.

```bash
npm install
npm run dev          # http://localhost:3000
```

Beim ersten Öffnen kannst du auf der Übersicht **„Mit Demo-Daten ausprobieren“** klicken (oder `npm run seed`). Dann gibt es vier Beispielschüler mit acht Wochen Verlauf.

Für den Dauerbetrieb: `npm run build && npm start`.

### KI (optional)

Lege eine Datei `.env.local` an:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Mit Schlüssel erstellt Claude (Modell `claude-opus-5-5`) Übungen zu jedem Thema und jeder Fähigkeit, inklusive Lösungsweg, gestuften Hilfen und typischen Fehlern, korrigiert Freitext-Antworten und schreibt auf Wunsch eine Einschätzung samt Stundenplan und Elternnotiz. Ohne Schlüssel funktioniert alles mit den eingebauten Generatoren (Mathematik prozedural, Deutsch und Englisch aus Aufgabenbanken); Freitext bewerten die Schüler dann selbst anhand der Musterlösung.

## Was die App kann

| Bereich | Wo |
|---|---|
| Schülerprofile (Schultyp und Klasse nach österreichischem System, Lehrer, Schule, Fächer, Themen, Stärken/Schwächen, Ziele, Notizen) | Schüler › Profil |
| Hausübungen und Testergebnisse (Note, Punkte, verknüpfte Fähigkeiten) | Profil › Hausübungen & Tests |
| Lehrer-Login: jeder Lehrer hat einen eigenen Account; Verwaltung (anlegen, zurücksetzen, deaktivieren) für Niko | Anmelden, Lehrer verwalten |
| Basis-Dokumentation: „Einheit starten“ protokolliert sofort Datum, Lehrer, Schüler, Start; „Einheit beenden“ Ende, Dauer, Status (gestartet / beendet / abgebrochen) | Profil, Übersicht › Heute, Einheiten |
| Lern-Dokumentation: entsteht beim Beenden automatisch aus allen Übungen der Einheit (Leistung, Fähigkeiten, Fehler, Hilfen, Zeit, Verlauf, Zusammenfassung). Der Lehrer ergänzt Beobachtungen, Konzentration, Motivation, Mitarbeit, Lernziel, Hausübung | Einheit › Ergänzen |
| Lernverlauf: alle Einheiten chronologisch, Gesamtauswertung (Stärken, Schwächen, größte Verbesserung, ohne Fortschritt, Fehler, Wiederholen) und Entwicklung pro Fähigkeit von Einheit zu Einheit | Profil › Lernverlauf |
| Selbstständiges Üben außerhalb einer Einheit wird automatisch als eigener Eintrag dokumentiert | Profil › Lernverlauf |
| Abrechnung: Tag, Lehrer, Schüler, Thema, Beobachtungen pro Monat, filterbar nach Lehrer und Schüler, Drucken und CSV für Excel. Nur stattgefundene Nachhilfestunden, keine selbstständigen Übungen | Abrechnung |
| Übungs-Builder (Fach, Schultyp und Klasse, Thema/Fähigkeiten, Schwierigkeit, Anzahl, Aufgabentyp) mit Lösungen, Druckansicht | Übungen › Übung erstellen |
| Schüler-Modus: jeder Schüler hat einen persönlichen Link, bearbeitet Aufgaben, bis zu 3 Versuche, Hilfen, Lösungsweg | Profil › Übungen › Zugang |
| Gespeichert pro Aufgabe: richtig/falsch, Versuche, Zeit, Hilfen, Lösung angesehen, erkannter Fehler | Profil › Übungen › Ergebnis |
| Fortschritt pro Fähigkeit (Fach › Thema › Fähigkeit) mit Verlauf | Profil › Fortschritt |
| Analyse: Probleme, Stärken, Trend, häufige Fehler, Wiederholen | Profil › Analyse & Empfehlungen |
| Empfehlungen mit einem Klick erstellen und zuweisen; nach erledigter Übung folgt automatisch die Überprüfung | Profil › Analyse, Übersicht |
| Dashboard: heutige Stunden, Trend und Problem je Schüler, fällige Hausübungen, zuletzt Bearbeitetes | Übersicht |

## Schultypen und Klassen

Volksschule 1–4, Mittelschule 1–4, Gymnasium 1–8 (Unter- und Oberstufe), HTL 1–5, HAK 1–5. Intern rechnet die App mit der durchgehenden Schulstufe (z. B. 2. Klasse Mittelschule = 6, 1. Klasse HTL = 9), damit eine Fähigkeit wie Bruchrechnung über Schultypen hinweg passt. Bestehende Daten werden beim Start automatisch umgestellt.

## Lehrer und Anmeldung

Zum Testen sind Niko (Verwaltung) und Thomas angelegt, Benutzernamen `niko` und `thomas`, Startpasswort `lernheft` (über `INITIAL_TEACHER_PASSWORD` änderbar). Beim ersten Login muss jeder ein eigenes Passwort wählen. Weitere Lehrer legt Niko unter „Lehrer verwalten“ an. Schüler brauchen keinen Account, sie üben über ihren persönlichen Link.

Im Produktionsmodus (`npm start`) wird das Login-Cookie nur über HTTPS gesendet. Wer die App ohne HTTPS betreibt, z. B. lokal im Netzwerk, startet sie mit `INSECURE_COOKIES=1`.

## Zwei Arten von Dokumentation

- **Basis-Dokumentation** (Tabelle `units`): entsteht sofort beim Starten einer Einheit und hängt nicht davon ab, dass später jemand etwas einträgt. Wird eine Einheit vergessen, beendet die App sie nach 3 Stunden ohne Aktivität selbst (Endzeit geschätzt, so vermerkt). „Abgebrochen“ bleibt im Protokoll, wird aber nicht abgerechnet.
- **Lern-Dokumentation** (Tabelle `lessons`, verknüpft über `unit_id`): Während der Einheit wird jede Antwort mit Versuchen, Hilfen, Zeit und aktiver Arbeitszeit der Einheit zugeordnet. Beim Beenden entsteht daraus ein Bericht (`lib/learning.ts`, als JSON mit Version gespeichert) und eine Zusammenfassung. Der Stand jeder Fähigkeit wird pro Einheit festgehalten (`skill_snapshots`), daraus entsteht der Verlauf „Einheit 1: 35 %, Einheit 2: 48 % …“.

## Einheiten im Alltag

- **Nie doppelt:** Pro Schüler läuft höchstens eine Einheit. Die Datenbank erzwingt das selbst (Index `idx_units_running`). Wer trotzdem „Einheit starten“ drückt (zweiter Tab, Doppelklick, Kollege), landet bei der laufenden Einheit und kann sie öffnen oder beenden.
- **Reload, Browser zu, Abmelden:** Die Einheit steht nur in der Datenbank, nicht im Browser. Oben in der App steht sie bei jedem Laden wieder: Schüler, Fach, Startzeit, Dauer, offene Übungen. Beim Abmelden fragt die App, ob die Einheit weiterlaufen oder enden soll.
- **Automatisch beendet:** Nach 3 Stunden ohne Aktivität. Gespeichert werden `ended_by = automatisch`, `end_estimated = 1` und der Grund mit der letzten Aktivität. Geprüft wird bei jedem Seitenaufruf, bei jeder Schülerantwort und alle 5 Minuten im Hintergrund (`instrumentation.ts`).
- **Selbstständiges Üben:** Ohne laufende Einheit werden Antworten trotzdem gespeichert, als „selbstständig geübt“ dokumentiert und nie abgerechnet.
- **Berechtigungen:** Eine Einheit beenden oder ihre Dokumentation ergänzen dürfen ihr Lehrer und die Verwaltung. Lehrer ohne Verwaltungsrecht sehen in der Abrechnung nur ihre eigenen Stunden. „Lehrer verwalten“ und „Datenexport“ sind nur für die Verwaltung.

## Whiteboard

Jede Einheit bekommt beim Starten automatisch eine Tafel (Tabelle `whiteboards`, eine Zeile pro Einheit, mit Schüler und Lehrer). Lehrer öffnen sie über „Whiteboard“ im Banner der laufenden Einheit, Schüler über die Karte „Tafel öffnen“ auf ihrer Seite.

- **Beide schreiben gleichzeitig.** Striche erscheinen beim anderen schon während des Zeichnens (gemessen: unter 50 ms nach dem Senden im lokalen Netz).
- **Touch und Stift:** Mit Finger schreibt man, solange kein Stift erkannt wurde. Sobald ein Stift benutzt wird, schreibt nur noch der Stift und der Finger verschiebt und zoomt.
- **Schüler** sehen nur die große Werkzeugleiste: Stift (4 Farben, 3 Stärken), Marker, Radierer, Text, Verschieben, Rückgängig, Wiederholen, Alles zeigen. Nach dem Ende der Einheit ist ihre Tafel nur noch zum Ansehen.
- **Lehrer** haben zusätzlich Auswählen, Linie, Pfeil, Rechteck, Kreis, Zeigen (Laserpointer), Seiten (neu, duplizieren, umbenennen, leeren, löschen, wechseln; der Schüler folgt) und „Einfügen“: Aufgaben aus den Übungen des Schülers, Lösungen, Text oder Erklärung im Kasten, Formel, Tabelle, Koordinatensystem, kariertes, liniertes oder leeres Blatt.
- **„Auf Whiteboard senden“** in jeder Übung schickt einzelne oder alle Aufgaben als Text auf die Tafel einer laufenden Einheit, mit Platz zum Rechnen darunter. Beide Geräte scrollen dorthin.
- **Nach der Einheit:** Die Tafel bleibt gespeichert. Im Lernverlauf und auf der Seite der Einheit stehen Vorschaubilder jeder Seite; ein Klick öffnet die Tafel wieder.

**Technik:** [Excalidraw](https://github.com/excalidraw/excalidraw) 0.18 (MIT-Lizenz) zeichnet; es versioniert jedes Element und ist für gemeinsames Arbeiten gebaut. tldraw wäre ähnlich gut, braucht für den Betrieb aber eine kostenpflichtige Lizenz. Synchronisiert wird ohne zusätzlichen Server: Jedes Gerät hört über Server-Sent Events (`/tafel/[unitId]/events`, `/lernen/[token]/tafel/events`) mit und schickt Änderungen per POST (`…/sync`). Pro Element gewinnt die höhere Version (`lib/whiteboard.ts`). Seiten liegen als JSON in `whiteboard_pages`; Änderungen werden im Speicher gesammelt und nach 400 ms geschrieben. Bricht die Verbindung ab, verbindet sich das Gerät neu und gleicht ab, was in der Zwischenzeit gezeichnet wurde. Die Schriften liefert die App selbst aus (`public/excalidraw-assets`, wird bei `npm install` kopiert).

Wichtig: Die Live-Verbindung setzt **einen** Server-Prozess voraus (so läuft `npm start`). Bei mehreren Instanzen hinter einem Load Balancer bräuchte es einen gemeinsamen Kanal, z. B. Redis.

## Datenexport

Unter „Datenexport“ (nur Verwaltung):

- **Vollständige Sicherung als JSON:** jede Tabelle mit allen Spalten und Zeilen, auch Tabellen späterer Versionen. Format `lernheft-backup`, Version 1. `restoreBackup()` in `lib/backup.ts` spielt sie in eine leere Datenbank zurück; ein Test prüft, dass danach jede Tabelle identisch ist. Passwörter und Sitzungen sind absichtlich nicht enthalten. Nach einer Wiederherstellung gilt für alle Lehrer das Startpasswort.
- **CSV für Excel** (Semikolon, UTF-8 mit BOM): Schüler und Profile, Lehrer, Einheiten, Nachhilfestunden, Lern-Dokumentationen, Lernverlauf, Beobachtungen und Lernziele, Fortschritt aktuell und pro Einheit, Fähigkeiten, alle Ergebnisse, Hausübungen und Schularbeiten, Abrechnungsdaten. Zellen, die Excel als Formel ausführen würde, werden entschärft.

## So rechnet die Analyse

- **Beherrschung einer Fähigkeit**: gewichteter Schnitt aus Aufgaben (1. Versuch ohne Hilfe = 100 %, 2. Versuch 70 %, 3. Versuch 50 %, jede Hilfe −15 Punkte, Lösung angesehen = 0), dem Verständnis aus Stunden (Gewicht 1,5) und Testergebnissen (Gewicht 2). Neuere Daten zählen mehr (Halbwertszeit 45 Tage).
- **Schwäche** unter 60 %, **sicher** ab 80 %.
- **Trend**: Veränderung gegenüber dem Stand vor 4 Wochen (±5 Punkte).
- **Häufige Fehler**: erkannte Fehlerbilder aus Aufgaben (z. B. „Kehrwert vergessen“) und die Fehlerzeilen aus der Stundendokumentation.
- **Empfehlung**: pro Schwäche 8–10 Aufgaben (leicht bis mittel je nach Stand). Ist die empfohlene Übung erledigt, schlägt die App eine Überprüfung mit 5 Aufgaben vor. Fähigkeiten, die sinken oder lange nicht geübt wurden, kommen zur Wiederholung.

## Technik

Next.js 16 (App Router, Server Actions), TypeScript, Tailwind CSS 4, SQLite über `better-sqlite3` (Datei `data/nachhilfe.db`), Anthropic SDK.

```
lib/curriculum.ts   Fächer, Themen und Fähigkeiten (erweiterbar unter „Fähigkeiten“)
lib/school.ts       Schultypen, Klassen und Schulstufe
lib/autodoc.ts      automatische Dokumentation aus der Schüleraktivität
lib/billing.ts      Abrechnungsliste und CSV
lib/backup.ts       vollständige JSON-Sicherung und Wiederherstellung
lib/exports.ts      CSV-Tabellen für den Datenexport
lib/auth.ts         Lehrer-Login und Sitzungen (proxy.ts leitet ohne Anmeldung zu /login)
lib/units.ts        Einheiten = Basis-Dokumentation
lib/learning.ts     Bericht, Zusammenfassung und Verlauf einer Einheit = Lern-Dokumentation
lib/generators.ts   eingebaute Aufgabengeneratoren mit Lösungswegen und Fehlerbildern
lib/ai.ts           Claude: Übungen, Freitext-Korrektur, Einschätzung
lib/analysis.ts     Beherrschung, Trends, Fehler, Empfehlungen
lib/service.ts      Übung bauen, Antwort prüfen und speichern
lib/whiteboard*.ts  Tafel: Speicher, Live-Verbindung, Rechte, Vorlagen
components/whiteboard/  Tafel im Browser (Excalidraw, Werkzeugleiste, Einfügen)
app/(tutor)/…       Oberfläche für die Nachhilfelehrkraft
app/lernen/…        Schüler-Modus
```

Tests: `npm test` (prüft u. a., dass jede generierte Aufgabe ihre eigene Lösung akzeptiert und typische Fehler erkennt).

## Noch offen

- Die Anmeldung ist für den Betrieb im eigenen Netz gedacht. Vor einem Betrieb im Internet: HTTPS und ein starkes Startpasswort. Nach 5 falschen Passwörtern ist ein Benutzername 10 Minuten gesperrt.
- Die JSON-Sicherung wird heruntergeladen, nicht automatisch angelegt. Eine Wiederherstellung über die Oberfläche gibt es noch nicht (nur `restoreBackup()` im Code).
- Schüler-Links sind geheime Links ohne Passwort.
- Bilder und PDFs auf der Tafel sind noch nicht eingebaut.

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
| Stundendokumentation (Datum, Lehrer, Fach, Thema, Dauer, Inhalte, Fehler, Verständnis 1–5, Beobachtungen, nächstes Mal) | Profil › Stunden, oder „Dokumentieren“ auf der Übersicht |
| Automatische Dokumentation: sobald ein Schüler eine Übung bearbeitet, entsteht ein Eintrag mit Ergebnis, Fehlern und Beobachtungen. Am selben Tag wird die Stundendoku damit vorausgefüllt | Profil › Stunden |
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

## Lehrer

Zum Testen sind Niko und Thomas angelegt. Jeder Schüler hat einen Lehrer; neue Stunden übernehmen ihn, er kann pro Stunde geändert werden.

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
lib/generators.ts   eingebaute Aufgabengeneratoren mit Lösungswegen und Fehlerbildern
lib/ai.ts           Claude: Übungen, Freitext-Korrektur, Einschätzung
lib/analysis.ts     Beherrschung, Trends, Fehler, Empfehlungen
lib/service.ts      Übung bauen, Antwort prüfen und speichern
app/(tutor)/…       Oberfläche für die Nachhilfelehrkraft
app/lernen/…        Schüler-Modus
```

Tests: `npm test` (prüft u. a., dass jede generierte Aufgabe ihre eigene Lösung akzeptiert und typische Fehler erkennt).

## Noch offen

- Lehrer lassen sich noch nicht in der Oberfläche anlegen (in `lib/db.ts` unter `DEFAULT_TEACHERS` bzw. direkt in der Tabelle `teachers`).
- Kein Login für die Lehrerseite: gedacht für den Betrieb auf dem eigenen Rechner. Vor einem Betrieb im Internet braucht es eine Anmeldung.
- Schüler-Links sind geheime Links ohne Passwort.

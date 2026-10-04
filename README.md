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
| Schülerprofile (Schulstufe, Schule/Schultyp, Fächer, Themen, Stärken/Schwächen, Ziele, Notizen) | Schüler › Profil |
| Hausübungen und Testergebnisse (Note, Punkte, verknüpfte Fähigkeiten) | Profil › Hausübungen & Tests |
| Stundendokumentation (Datum, Fach, Thema, Dauer, Inhalte, Fehler, Verständnis 1–5, Notizen, nächstes Mal) | Profil › Stunden, oder „Dokumentieren“ auf der Übersicht |
| Übungs-Builder (Fach, Schulstufe, Thema/Fähigkeiten, Schwierigkeit, Anzahl, Aufgabentyp) mit Lösungen, Druckansicht | Übungen › Übung erstellen |
| Schüler-Modus: jeder Schüler hat einen persönlichen Link, bearbeitet Aufgaben, bis zu 3 Versuche, Hilfen, Lösungsweg | Profil › Übungen › Zugang |
| Gespeichert pro Aufgabe: richtig/falsch, Versuche, Zeit, Hilfen, Lösung angesehen, erkannter Fehler | Profil › Übungen › Ergebnis |
| Fortschritt pro Fähigkeit (Fach › Thema › Fähigkeit) mit Verlauf | Profil › Fortschritt |
| Analyse: Probleme, Stärken, Trend, häufige Fehler, Wiederholen | Profil › Analyse & Empfehlungen |
| Empfehlungen mit einem Klick erstellen und zuweisen; nach erledigter Übung folgt automatisch die Überprüfung | Profil › Analyse, Übersicht |
| Dashboard: heutige Stunden, Trend und Problem je Schüler, fällige Hausübungen, zuletzt Bearbeitetes | Übersicht |

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
lib/generators.ts   eingebaute Aufgabengeneratoren mit Lösungswegen und Fehlerbildern
lib/ai.ts           Claude: Übungen, Freitext-Korrektur, Einschätzung
lib/analysis.ts     Beherrschung, Trends, Fehler, Empfehlungen
lib/service.ts      Übung bauen, Antwort prüfen und speichern
app/(tutor)/…       Oberfläche für die Nachhilfelehrkraft
app/lernen/…        Schüler-Modus
```

Tests: `npm test` (prüft u. a., dass jede generierte Aufgabe ihre eigene Lösung akzeptiert und typische Fehler erkennt).

## Noch offen

- Kein Login für die Lehrerseite: gedacht für den Betrieb auf dem eigenen Rechner. Vor einem Betrieb im Internet braucht es eine Anmeldung.
- Schüler-Links sind geheime Links ohne Passwort.

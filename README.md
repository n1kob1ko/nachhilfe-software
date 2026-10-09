# Lernheft – Nachhilfe-Software

Web-App für Nachhilfelehrer: Schülerprofile, Dokumentation jeder Stunde, Übungs-Builder mit automatischen Lösungswegen, ein Schüler-Modus zum selbstständigen Üben, Fortschritt pro Fähigkeit, automatische Analyse und Übungsempfehlungen.

## Starten

Voraussetzung: Node.js 20 oder neuer.

```bash
npm install
npm run dev          # http://localhost:3000
```

Beim ersten Öffnen kannst du auf der Übersicht **„Mit Demo-Daten ausprobieren“** klicken (oder `npm run seed`). Dann gibt es vier Beispielschüler mit acht Wochen Verlauf.

Für den Dauerbetrieb: `npm run build && npm start`. Online braucht die App einen Server mit festem Speicher (z. B. Docker auf Railway, Fly.io oder Render), nicht Vercel: siehe [docs/betrieb.md](docs/betrieb.md).

### KI (optional)

Lege eine Datei `.env.local` an:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Mit Schlüssel erstellt Claude Übungen zu jedem Thema und jeder Fähigkeit, inklusive Lösungsweg, gestuften Hilfen und typischen Fehlern, korrigiert Freitext-Antworten, schaut während einer Einheit auf Fehler und Hilfen (Hinweis im Live-Status, „Passende Aufgabe senden“) und schreibt auf Wunsch eine Einschätzung samt Stundenplan und Elternnotiz.

Alle KI-Aufrufe laufen über `lib/ai/router.ts`, der Anbieter steckt in einem Adapter (`lib/ai/providers`: Anthropic, OpenRouter, DeepSeek, weitere OpenAI-kompatible APIs). Anbieter und Modell sind je Bereich per Umgebungsvariable wählbar (z. B. `AI_REALTIME_PROVIDER=openrouter`, `AI_REALTIME_MODEL=...`), dazu Token-Limit und Zeitlimit je Funktion, Wiederverwendung gleicher Anfragen, Bündelung in der Einheit, Monatsbudget und ein Kostenlog ohne Namen (Mehr › KI-Kosten). Variablen: [docs/betrieb.md](docs/betrieb.md#umgebungsvariablen). Testlauf einer 60-Minuten-Einheit ohne Kosten: `npm run ai:simulate` (Bericht: [docs/ki-simulation.md](docs/ki-simulation.md)). Ohne Schlüssel funktioniert alles mit den eingebauten Generatoren (Mathematik prozedural, Deutsch und Englisch aus Aufgabenbanken); Freitext bewerten die Schüler dann selbst anhand der Musterlösung.

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
| Übungs-Builder in 6 Schritten, aus dem Schülerprofil vorausgefüllt, mit Vorschlägen, Entwurf und Vorschau vor der Freigabe, Vorlagen (siehe unten) | Übungen › Übung erstellen, Profil › Übung erstellen |
| Schüler-Modus: jeder Schüler hat einen persönlichen Link, bearbeitet Aufgaben, bis zu 3 Versuche, Hilfen, Lösungsweg | Profil › Übungen › Zugang |
| Gespeichert pro Aufgabe: richtig/falsch, Versuche, Zeit, Hilfen, Lösung angesehen, erkannter Fehler | Profil › Übungen › Ergebnis |
| Fortschritt pro Fähigkeit (Fach › Thema › Fähigkeit) mit Verlauf | Profil › Fortschritt |
| Analyse: Probleme, Stärken, Trend, häufige Fehler, Wiederholen | Profil › Analyse & Empfehlungen |
| Empfehlungen mit einem Klick erstellen und zuweisen; nach erledigter Übung folgt automatisch die Überprüfung | Profil › Analyse, Übersicht |
| Textkorrektur: abgegebene Texte selbst oder mit KI-Vorschlägen korrigieren (nur nach Freigabe, Namen werden ersetzt), Ansichten Original / Korrekturen / Endfassung, jede Stelle einzeln übernehmen oder ablehnen, Fehlerübersicht, A4-Druck ([docs/textkorrektur.md](docs/textkorrektur.md)) | Text › Korrigieren |
| Bildgeschichten: Bilder hochladen und sortieren, Aufgabe, Wortziel, Satzanfänge; der Schüler schreibt am Tablet oder Laptop mit den Bildern daneben und gibt ab; A4 als fertige Geschichte oder leeres Arbeitsblatt mit Linien; KI-Korrektur mit kurzen Bildbeschreibungen statt Bildern ([docs/bildgeschichte.md](docs/bildgeschichte.md)) | Einheit › Bildgeschichte erstellen |
| Abwechslungsreiche Übungen: Lückentext mit mehreren Lücken und weiteren richtigen Antworten, Fehler korrigieren (der Schüler schreibt den Text verbessert, die App vergleicht Wort für Wort), freie Antwort mit Lehrerbewertung (richtig, teilweise richtig, falsch); „Gemischte Aufgaben“ wählt passende Formate je Fähigkeit; KI hält das gewählte Format ein ([docs/uebungstypen.md](docs/uebungstypen.md)) | Übung erstellen › Aufgabentyp |
| Mathematik mit Rechenwegen: der Schüler schreibt jeden Schritt in eine Zeile (Brüche, Potenzen, Wurzeln ohne LaTeX, Zeichenleiste), die App prüft jede Zeile und das Ergebnis sicher ohne Codeausführung, akzeptiert andere richtige Wege und gleichwertige Ergebnisse; mehrteilige Sachaufgaben mit Folgefehlern; Unsicheres bewertet der Lehrer; A4 mit kariertem Rechenfeld ([docs/rechenwege.md](docs/rechenwege.md)) | Übung erstellen › Aufgabentyp |
| Leseverständnis mit längerem Text: eigener Text oder KI-Text, 7 Fragearten mit Musterlösung, Erwartungshorizont und Beleg, ungeeignete Fragen markiert; Text neben den Fragen am Laptop/iPad; offene Antworten bewertet der Lehrer; A4 Schüler/Lehrer ([docs/leseverstaendnis.md](docs/leseverstaendnis.md)) | Übung erstellen › Leseverständnis |
| Wortarten bestimmen: echte Bestimmungsaufgaben ohne KI (zuordnen, markiertes Wort, heraussuchen, sortieren, verbessern), Wortarten nach Schulstufe wählbar, KI-Aufgaben von der App geprüft (falsche Wortarten, Platzhalter, Adverb/Adjektiv) ([docs/wortarten.md](docs/wortarten.md)) | Übung erstellen › Wortarten bestimmen |
| Dashboard: heutige Stunden, Trend und Problem je Schüler, fällige Hausübungen, zuletzt Bearbeitetes | Übersicht |

## Schultypen und Klassen

Volksschule 1–4, Mittelschule 1–4, Gymnasium 1–8 (Unter- und Oberstufe), HTL 1–5, HAK 1–5. Intern rechnet die App mit der durchgehenden Schulstufe (z. B. 2. Klasse Mittelschule = 6, 1. Klasse HTL = 9), damit eine Fähigkeit wie Bruchrechnung über Schultypen hinweg passt. Bestehende Daten werden beim Start automatisch umgestellt.

## Lehrer und Anmeldung

Zum Testen sind Niko (Verwaltung) und Thomas angelegt, Benutzernamen `niko` und `thomas`, Startpasswort `lernheft` (über `INITIAL_TEACHER_PASSWORD` änderbar; auf dem Server mit `NODE_ENV=production` gilt `lernheft` nie, siehe `docs/betrieb.md`). Beim ersten Login muss jeder ein eigenes Passwort wählen. Weitere Lehrer legt Niko unter „Lehrer verwalten“ an. Schüler brauchen keinen Account, sie üben über ihren persönlichen Link.

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

## Übungs-Builder

Aus einem Schülerprofil geöffnet („Übung erstellen“) ist alles vorausgefüllt: Schüler, Schultyp, Klasse, Fach, aktuelle Themen, bekannte Schwächen, Lernziele, Lernstand und häufige Fehler. Darunter stehen Vorschläge (z. B. „Dividieren › Kehrwert korrekt bilden, Fehler ‚Kehrwert vergessen‘ 37× gemacht“); der erste ist schon ausgewählt.

1. **Schüler**: vorausgewählt, mit Kontext und Vorschlägen.
2. **Fach**: Mathematik, Deutsch, Englisch. Ein neues Fach braucht nur Fähigkeiten und optional eine Liste von Aufgabentypen in `lib/curriculum.ts` (`CATEGORIES`).
3. **Thema und Fähigkeit**: Fach › Thema › Fähigkeit › Teilfähigkeit, z. B. Mathematik › Bruchrechnung › Dividieren › Kehrwert korrekt bilden. Mit Suche und Lernstand pro Fähigkeit.
4. **Schwierigkeit**: sehr leicht bis sehr schwer, oder „automatisch an Schüler anpassen“ (aus dem Lernstand pro Fähigkeit).
5. **Anzahl**: 5, 10, 15, 20 oder benutzerdefiniert.
6. **Aufgabentyp** je Fach (Mathematik: direkte Rechnung, Textaufgabe, Lückentext, Multiple Choice, Fehler finden, Lösungsweg ordnen, offene Aufgabe; Deutsch und Englisch entsprechend). Mehrere möglich, ohne Auswahl gemischt.

„Übungen generieren“ schickt Claude den Kontext (nur den Vornamen) und bekommt strukturierte Aufgaben zurück: Aufgabenstellung, Aufgabentyp, Thema, Fähigkeiten, Schwierigkeit, Lösung, Lösungsweg, typische Fehler und 2–3 Hilfestufen (Denkanstoß, Regel, erster Schritt). Ohne API-Schlüssel kommen die Aufgaben aus den eingebauten Generatoren.

Das Ergebnis ist ein **Entwurf**, den Schüler nicht sehen. In der Vorschau kann man jede Aufgabe bearbeiten, löschen, verschieben, neu erstellen lassen, in einer anderen Schwierigkeit neu erstellen, neue Aufgaben anlegen oder aus früheren Übungen übernehmen. „Freigeben und an Max senden“ prüft jede Aufgabe auf Vollständigkeit und weist die Übung zu (mit der laufenden Einheit verknüpft). Jede Aufgabe hat außerdem „An Schüler senden“ und „Auf Whiteboard senden“.

Lösungen sind für den Schüler verborgen, bis er die Aufgabe abgeschlossen hat oder die Lehrkraft sie pro Zuweisung freigibt. Welche Hilfe ein Schüler geöffnet hat, wird pro Hilfe gespeichert und im Ergebnis angezeigt.

Wiederverwenden: für einen anderen Schüler kopieren, „Anpassen“ (eine schon bearbeitete Übung bleibt unverändert, die Kopie ist ein neuer Entwurf), einzelne Aufgaben übernehmen, als **Vorlage** speichern (mit festen Aufgaben oder nur den Einstellungen) und mit einem Klick für einen Schüler verwenden.

### Datenmodell

```
Fach › Thema › skills (parent_id = Teilfähigkeit)
                 ▲ task_skills (eine Aufgabe trainiert 1–n Fähigkeiten; tasks.skill_id = wichtigste)
worksheets (Übung: status entwurf|freigegeben, student_id, settings, source_worksheet_id)
  └─ tasks (type = Antwortformat, category = Aufgabentyp, hints[], error_map[], solution)
assignments (Übung → Schüler, unit_id = Nachhilfeeinheit, solutions_visible)
  ├─ attempts (Schülerantwort: task, skill, unit, Versuch, Zeit, Fehler)
  └─ hint_uses (welche Hilfe bei welcher Aufgabe, mit unit_id)
units (Nachhilfeeinheit)   worksheet_templates (Vorlagen)
```

Antworten auf eine Teilfähigkeit zählen in der Analyse auch für die übergeordnete Fähigkeit.

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

- **Vollständige Sicherung als JSON:** jede Tabelle mit allen Spalten und Zeilen, auch Tabellen späterer Versionen. Format `lernheft-backup`, Version 1. `restoreBackup()` in `lib/backup.ts` spielt sie in eine leere Datenbank zurück; ein Test prüft, dass danach jede Tabelle identisch ist. Passwörter und Sitzungen sind absichtlich nicht enthalten. Nach einer Wiederherstellung gilt für alle Lehrer das Startpasswort (`INITIAL_TEACHER_PASSWORD`). Zusätzlich sichert die App täglich Datenbank und Material auf dem Server, siehe `docs/betrieb.md`.
- **CSV für Excel** (Semikolon, UTF-8 mit BOM): Schüler und Profile, Lehrer, Einheiten, Nachhilfestunden, Lern-Dokumentationen, Lernverlauf, Beobachtungen und Lernziele, Fortschritt aktuell und pro Einheit, Fähigkeiten, alle Ergebnisse, Hausübungen und Schularbeiten, Abrechnungsdaten. Zellen, die Excel als Formel ausführen würde, werden entschärft.

## So rechnet die Analyse

- **Beherrschung einer Fähigkeit**: gewichteter Schnitt aus Aufgaben (1. Versuch ohne Hilfe = 100 %, 2. Versuch 70 %, 3. Versuch 50 %, jede Hilfe −15 Punkte, Lösung angesehen = 0), dem Verständnis aus Stunden (Gewicht 1,5) und Testergebnissen (Gewicht 2). Neuere Daten zählen mehr (Halbwertszeit 45 Tage).
- **Schwäche** unter 60 %, **sicher** ab 80 %.
- **Trend**: Veränderung gegenüber dem Stand vor 4 Wochen (±5 Punkte).
- **Häufige Fehler**: erkannte Fehlerbilder aus Aufgaben (z. B. „Kehrwert vergessen“) und die Fehlerzeilen aus der Stundendokumentation.
- **Empfehlung**: pro Schwäche 8–10 Aufgaben (leicht bis mittel je nach Stand). Ist eine Übung zu der Schwäche erledigt (auch eine aus dem Übungs-Builder), schlägt die App eine Überprüfung mit 5 Aufgaben vor. Fähigkeiten, die sinken oder lange nicht geübt wurden, kommen zur Wiederholung.

## Technik

Next.js 16 (App Router, Server Actions), TypeScript, Tailwind CSS 4, SQLite über `better-sqlite3` (Datei `data/nachhilfe.db`), Anthropic SDK und OpenAI-kompatible APIs über `fetch`.

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
lib/service.ts      Antwort prüfen und speichern, Analyse laden
lib/builder.ts      Übungs-Builder: Schülerkontext, Vorschläge, Entwurf, Prüfen, Freigeben, Vorlagen
lib/whiteboard*.ts  Tafel: Speicher, Live-Verbindung, Rechte, Vorlagen
components/whiteboard/  Tafel im Browser (Excalidraw, Werkzeugleiste, Einfügen)
app/(tutor)/…       Oberfläche für die Nachhilfelehrkraft
app/lernen/…        Schüler-Modus
```

Tests: `npm test` (prüft u. a., dass jede generierte Aufgabe ihre eigene Lösung akzeptiert und typische Fehler erkennt).

## Noch offen

- Anmeldung im Internet: nur über HTTPS, `lernheft` gilt auf dem Server nie, nach 5 falschen Passwörtern ist ein Benutzername 10 Minuten gesperrt, nach 20 Fehlversuchen einer Adresse diese 15 Minuten. Details in `docs/betrieb.md`.
- Die JSON-Sicherung wird heruntergeladen, nicht automatisch angelegt. Eine Wiederherstellung über die Oberfläche gibt es noch nicht (nur `restoreBackup()` im Code).
- Schüler-Links sind geheime Links ohne Passwort.
- Bilder und PDFs auf der Tafel sind noch nicht eingebaut.

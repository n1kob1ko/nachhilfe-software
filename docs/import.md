# CSV-Import

Mehr › Import übernimmt Daten aus einer CSV-Datei. Nur die Verwaltung darf importieren (D23).
Der Code steht in `lib/csv-import.ts` (Schüler, Lehrer) und `lib/doku-import.ts` (Dokumentation),
die Oberfläche in `components/ImportForm.tsx`.

## Für alle Arten gleich

- **Zwei Schritte.** „Vorschau“ liest und prüft jede Zeile und schreibt nichts. Erst
  „… jetzt importieren“ schreibt, und nur wenn keine Zeile einen Fehler hat (alles oder nichts, in
  einer Transaktion).
- **Spalten nach Namen.** Die erste Zeile enthält die Spaltennamen, die Reihenfolge ist egal,
  unbekannte Spalten werden übergangen.
- **Trennzeichen.** Semikolon (Datenexport, Excel und Numbers mit deutschen Einstellungen) oder
  Komma (Google Tabellen). Entschieden wird an der ersten Zeile (`separatorOf` in `lib/csv.ts`).
- **Formel-Zellen bleiben Text.** Eine Zelle, die mit `=`, `+`, `-` oder `@` beginnt, wird nie
  ausgeführt oder in eine Zahl verwandelt.
- **Dubletten werden übersprungen**, nie überschrieben.

## Schüler

Die Spalten des Exports „Schüler und Schülerprofile“. Pflicht ist nur der **Name**.

**Schulart und Klasse dürfen fehlen** (seit D27). Der Schüler wird trotzdem angelegt:

- `klasse` ist leer, `grade` ist 0 und `stufe_status` ist „unklar“;
- die Vorschau zeigt „Klasse fehlt“ oder „Schulart fehlt“;
- die Schülerliste zeigt ihn unter dem Filter „Klasse fehlt“;
- das Profil bittet darum, die Angaben nachzutragen.

Eine **Dublette** ist ein Schüler mit gleichem Namen und gleicher Klasse. Fehlt die Klasse auf einer
der beiden Seiten, reicht der gleiche Name. Groß- und Kleinschreibung und doppelte Leerzeichen
zählen dabei nicht. So entsteht niemand doppelt, der zuerst ohne und später mit Klasse kommt.

## Lehrer

Pflicht sind Name und Benutzername, dazu optional Verwaltung und Aktiv (ja/nein). Neue Konten
bekommen das Startpasswort der Installation und müssen es beim ersten Anmelden ändern.

## Dokumentation aus einem Formular (D27)

Für eine Tabelle, in der je **Einheit** eine Zeile steht, z. B. die Antworten des Google-Formulars
„Dokumentation 26/27“. So kommt die Dokumentation aus der Zeit vor der App in Lernverlauf,
Abrechnung und Tagesbriefing.

| Spalte im Formular | wird zu |
|---|---|
| Datum (Pflicht) | `lessons.starts_at` = Tag, `T00:00` |
| Lehrer (Pflicht) | `lessons.teacher_id` |
| Schüler (Pflicht) | `lessons.student_id`, wenn nötig ein neuer Schüler |
| Unterrichtsfach | `subject`, wie geschrieben (auch „Mathematik, Deutsch“) |
| Behandelte Themen | `topic` |
| Erteilte Hausaufgaben | `homework_note` |
| Planung für die nächste Einheit | `next_steps` |
| Beobachtung & Fortschritte des Schülers | `tutor_notes` |
| Mitarbeit & Engagement in dieser Einheit | `participation`, gedreht: 1 → 5, 2 → 4, 3 → 3, 4 → 2, 5 → 1 |
| Zeitstempel | wird nicht gelesen |

Die Regeln:

- **Mitarbeit.** Im Formular ist sie eine Schulnote, 1 ist sehr gut. In der App ist 5 „sehr aktiv“,
  deshalb wird die Zahl gedreht. So hat niko es am 2026-10-19 entschieden.
- **Lehrer** müssen in der App sein. Erkannt werden sie am Namen, am Benutzernamen oder am Vornamen,
  wenn ihn nur ein Lehrer hat. Ein unbekannter oder mehrdeutiger Lehrer ist ein Fehler in der
  Zeile.
- **Schüler, die es schon gibt,** werden am vollen Namen erkannt (Groß- und Kleinschreibung,
  Leerzeichen egal). Gibt es den Namen in der App mehrmals, ist das ein Fehler. Die Einheit könnte
  sonst beim falschen Kind landen.
- **Neue Schüler** werden angelegt mit:
  - Name;
  - den Fächern aus der Tabelle, das häufigste zuerst;
  - dem Lehrer mit den meisten Einheiten, bei Gleichstand dem zuerst genannten.

  Schulart und Klasse bleiben leer, siehe oben. Hat ein anderer Schüler denselben Vornamen, zeigt
  die Vorschau ihn als „ähnlicher Name“. Der Import rät nicht, ob es dasselbe Kind ist.
- **Uhrzeit und Dauer** stehen nicht in der Tabelle. Die Einheit bekommt die Dauer 0, das heißt
  „nicht erfasst“. Lernverlauf, Abrechnung, „Heute“ und Export zeigen dann nur das Datum
  („ohne Uhrzeit“). In der Abrechnung zählt sie als gehaltene Einheit.
- **Lernstand.** Er ändert sich nicht. Die Zeilen haben weder Verständnis noch Fähigkeiten, also
  entsteht keine Beobachtung je Fähigkeit.
- **Noch einmal importieren** ist sicher. Eine Einheit mit gleichem Schüler, Tag, Lehrer, Fach und
  Thema gibt es schon und wird übersprungen. Zwei Einträge am selben Tag mit anderem Fach oder Thema
  bleiben zwei Einheiten.
- **Tagesbriefing.** Das Briefing ohne KI nennt die Hausübung aus der letzten Dokumentation und
  setzt „Hausübung kontrollieren“ in den Plan, wenn keine offene Hausübung eingetragen ist.

Echte Tabellen mit Schülerdaten kommen nie ins Repository. Die Tests verwenden erfundene Zeilen im
selben Aufbau (`lib/doku-import.test.ts`).

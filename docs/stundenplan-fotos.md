# Stundenplan-Fotos: vom Foto in den Wochenplan

niko, 2026-10-19: „außerdem bekommen wir gerade den stundenplan so wie in den fotos hier ich möchte das
die app wenn ich das so hochlade zb es automatisch dann eingetragen wird.“ Dazu nannte er, welcher Buchstabe
welcher Lehrer ist. Das steht nicht im Code: die Verwaltung wählt es beim ersten Eintragen, die App merkt
es sich.

Ein **Stundenplan-Foto** ist das Foto vom Wochenplan **eines** Lehrers auf Papier oder am Bildschirm:
oben links ein Buchstabe für den Lehrer, Spalten Mo bis So, Zeilen sind nummerierte Stunden zu
50 Minuten ab 08:50 (Stunde 16 endet 22:10), farbige Felder mit Vornamen, ein Feld kann über mehrere
Stunden gehen, „Neu“ steht für einen neuen Schüler.

## Ablauf

1. **Planung › Stundenplan-Fotos** (nur die Verwaltung, D23). Fotos wählen (mehrere auf einmal), die
   Woche wählen und den Haken setzen: „Die KI darf die Fotos lesen, auch die Vornamen darauf.“
   niko hat das am 2026-10-19 so entschieden („Ja, nur Vornamen“). Ohne Haken geht kein Foto an die KI.
2. **Lesen.** Je Foto eine Anfrage an die KI (Funktion `stundenplan` im Router, Bereich `MATERIAL`,
   also derselbe Anbieter wie „Material erkennen“). Die Seite verkleinert das Foto vorher. Das Foto wird
   **nicht gespeichert**, weder als Datei noch in der Datenbank, und die Antwort wird nicht für eine
   Wiederholung aufgehoben (`reuseMs: 0`). An die KI geht nur das Foto, **keine Schülerliste**.
3. **Vorschau.** Je Foto:
   - **Lehrer:** der Buchstabe vom Foto, zugeordnet über die gespeicherte Zuordnung. Beim ersten Mal
     ist sie leer, dann wählt die Verwaltung den Lehrer; beim Eintragen merkt sich die App den
     Buchstaben (`app_settings.stundenplan_buchstaben`).
   - **Zeit:** aus dem Raster am Rand des Fotos, wenn die KI es stimmig gelesen hat, sonst aus dem
     Standardraster (08:50, je 50 Minuten). Jede Zeile hat Tag, Beginn und Ende zum Ändern.
   - **Schüler:** gesucht wird der Vorname zuerst unter den Schülern dieses Lehrers, dann unter allen.
     „Anna H.“ passt zu „Anna Huber“. Ein Buchstabe Unterschied (ab vier Buchstaben) ist „ähnlich“ und
     wird nur vorgeschlagen, wenn es genau einen solchen Schüler gibt. Passen mehrere, ist keiner
     gewählt („mehrere passen“). Unbekannte Namen und Felder nur mit „Neu“ sind nicht angehakt.
   - Was die KI nicht sicher lesen konnte, und Felder außerhalb des Rasters, stehen gelb über den Zeilen.
4. **Prüfen.** Jede Änderung wird gegen die Woche geprüft, ohne etwas zu speichern (dieselbe
   Überlappungsprüfung wie jeder Platz, in einer Transaktion, die zurückgerollt wird). Überschneidungen
   stehen rot bei der Zeile. Hat ein Lehrer der Fotos in dieser Woche schon Plätze und ist die Woche
   nicht veröffentlicht, kann die Verwaltung sie vorher löschen lassen („damit nur die Fotos gelten“).
5. **Eintragen.** Die angehakten Zeilen ohne Überschneidung kommen als **gesperrte** Plätze ohne Raum in
   die Woche: in eine leere Woche oder einen Entwurf als Entwurf, in eine veröffentlichte Woche
   veröffentlicht (dann sehen Lehrer und Schüler sie sofort; gelöscht wird dort nichts). Zwei Schüler
   zur selben Zeit beim selben Lehrer bekommen den Haken **gleichzeitig** (D26). Danach geht es zurück
   in den Wochenplan dieser Woche mit „N Plätze aus den Fotos eingetragen“.

Für die Wochen danach gilt wie bisher „Vorwoche übernehmen“; eine automatische Wiederholung gibt es
nicht (D24).

## Ohne KI

Ohne KI, oder wenn der eingestellte KI-Weg keine Fotos lesen kann (manueller Modus), sagt die Seite das
und führt zum Wochenplan. Plätze legt man dort wie bisher von Hand an.

## Technik

| Datei | Inhalt |
|---|---|
| `lib/planung/stundenplan-foto.ts` | Raster, Buchstaben, Namenssuche, Vorschlag (rein), Lesen, Prüfen und Eintragen |
| `lib/ai/features.ts` | `leseStundenplanFoto` mit `StundenplanSchema` und `STUNDENPLAN_SYSTEM` |
| `lib/ai/config.ts` | Funktion `stundenplan` (Bereich `MATERIAL`, Tarif standard, ohne Nachdenken, `reuseMs: 0`) |
| `app/(tutor)/planung/stundenplan/page.tsx` | die Seite; Wochen ab dieser, vorgewählt die aus dem Wochenplan |
| `app/(tutor)/planung/stundenplan/lesen/route.ts` | ein Foto lesen (Route Handler, Rechte und Haken geprüft) |
| `components/planung/StundenplanImport.tsx` | Fotos, Vorschau, Prüfen und Eintragen im Browser |
| `app/planung-actions.ts` | `stundenplanPruefenAction`, `stundenplanEintragenAction` |

Tests: `lib/planung/stundenplan-foto.test.ts`, mit erfundenen Namen und einer Ersatz-KI. Niemals echte
Fotos oder Namen in Tests oder im Repository.

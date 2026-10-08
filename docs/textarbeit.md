# Textarbeit: längere Texte schreiben, speichern, drucken (Lernheft Phase 1)

## Ablauf

1. **Starten.** In einer laufenden Einheit unter „Übungen für Max“ auf „Textarbeit starten“ tippen.
   - Eingaben: Titel, Fach, Textsorte und Aufgabenstellung.
   - „Gleich am Tablet von Max öffnen“ ist an, wenn ein Schüler-Tablet verbunden ist.
   - Ohne Tablet öffnet sich der Text am Lehrergerät (`/texte/<id>`).
2. **Schreiben.** Max schreibt am Tablet in einem schlichten Editor.
   - Werkzeuge: Text/Überschrift, Fett, Kursiv, Unterstrichen, Rückgängig, Wiederholen, Vollbild und Speichern.
   - Unter dem Text stehen Wort- und Zeichenanzahl.
   - Der Text wird laufend gespeichert. Der Zustand steht in der Werkzeugleiste („Gespeichert 14:32“, „Speichert …“, „Keine Verbindung“).
3. **Mitlesen.** Der Live-Status der Einheit zeigt Titel, Wörter und die letzte Speicherung.
   - „Mitlesen“ öffnet den Text am Laptop.
   - Was Max schreibt, erscheint dort ohne Neuladen.
   - Der Lehrer kann dort auch selbst schreiben, „Titel und Aufgabe ändern“ und frühere Fassungen zurückholen.
4. **Einheit beenden.** Der Abschluss-Bildschirm zeigt „Dokumente dieser Einheit“, zum Beispiel „Erlebniserzählung: Mein aufregender Ausflug – 246 Wörter“, mit Öffnen und PDF / Drucken.
   - Die Dokumentation erwähnt die Textarbeit: Titel, Textsorte und Wörter, nie den Text selbst.
5. **Später weiterschreiben.** In der nächsten Einheit stehen unfertige Texte unter „Textarbeiten“ mit „Am Tablet öffnen“.
   - Jede Einheit merkt sich, wie viele Wörter vorher und nachher da waren.
6. **Finden.** Im Lernverlauf gibt es den Abschnitt „Texte“ (unfertige zuerst). Jede Einheit verlinkt ihre Texte.
7. **Drucken.** „PDF / Drucken“ öffnet `/arbeitsblatt/text/<id>`. Die Seite nutzt dieselbe Technik wie die Arbeitsblätter:
   - A4 Hochformat mit 20 mm Rand links zum Lochen.
   - Optional: Name, Datum, Fach und Textsorte, Aufgabenstellung, Wortanzahl, Seitenzahlen.
   - Zeilenabstand „weit“ lässt Platz zum Korrigieren.
   - Absätze werden nie mit einer einzelnen Zeile getrennt (`orphans`/`widows`). Überschriften bleiben beim folgenden Text.

## Datenmodell

| Tabelle | Inhalt |
|---|---|
| `texts` | `student_id`, `teacher_id`, `unit_id` (begonnen in), `subject`, `topic` (Textsorte), `title`, `prompt`, `body`, `words`, `chars`, `version`, `status` (offen/fertig), `created_at`, `updated_at`, `completed_at` |
| `text_units` | Jede Einheit, in der am Text gearbeitet wurde: `words_before`, `words_after`, `first_at`, `last_at`. Daraus kommen „Dokumente dieser Einheit“ und die Dokumentation. |
| `text_revisions` | Frühere Fassungen: höchstens alle 5 Minuten, immer vor einem großen Löschen (≥ 30 % und ≥ 20 Wörter) und immer, wenn eine woanders geschriebene Fassung überschrieben wird. Die letzten 40 bleiben. |

Der Text wird als JSON gespeichert, nie als HTML (`lib/text-doc.ts`): Absätze und Überschriften, darin Läufe mit fett/kursiv/unterstrichen.
- Eingefügter Text kommt nur als reiner Text herein.
- Der Server prüft jede Speicherung (bekannte Felder, höchstens 200 000 Zeichen und 5 000 Absätze).

Die Tabellen sind Teil der Sicherung (`lib/backup.ts`).

## Kein Datenverlust

**Versionen**
- Jede Speicherung schickt die Version mit, von der sie ausgeht.
- Hat sich der Text inzwischen woanders geändert, kommt 409 zurück und der Editor fragt: „Meine Fassung behalten“ oder „Andere Fassung laden“.
- Die überschriebene Fassung landet in jedem Fall unter „Frühere Fassungen“.
- Dieselbe Anfrage zweimal (die Antwort ging verloren) ist kein Konflikt.

**Verbindungsprobleme**
- Der Editor sichert jede Änderung sofort im Gerät (`localStorage`) und speichert nach einer kurzen Pause, beim Tippen spätestens alle 8 Sekunden.
- Ohne Verbindung versucht er es immer wieder (2 s bis 30 s) und sofort, wenn das Gerät wieder online ist.

**Seite verlassen**
- Beim Verlassen der Seite (Tablet wechselt die Ansicht, Einheit endet, Tab wird geschlossen) wird der letzte Stand noch abgeschickt.
- Das Tablet darf bis 10 Minuten nach Einheitsende nachliefern.

**Neu laden**
- Gab es eine nicht gespeicherte Fassung auf dem Gerät, wird sie übernommen, wenn der Text inzwischen nicht woanders geändert wurde.
- Sonst wird sie zur Auswahl angeboten.

**Mitlesen**
- Der Lehrer-Laptop lädt neue Fassungen als Daten nach. Die Seite wird nicht neu geladen, so geht auch bei wackeliger Verbindung nichts verloren, was dort getippt wird.

## Zugriff

**Lehrer** (`/texte/<id>`, `/texte/<id>/speichern`, `/texte/<id>/events`, `/arbeitsblatt/text/<id>`)
- Angemeldete Lehrer. Schüler sind für alle Lehrer gemeinsam.

**Tablet** (`/geraet/text/<id>`)
- Nur das gekoppelte Tablet eines Lehrers.
- Nur Texte des Schülers, mit dem dieser Lehrer gerade eine Einheit hat, plus 10 Minuten nach deren Ende.
- Das Tablet zeigt nur Texte dieses Schülers (`unitText`).

**Allgemein**
- Speichern nur von den eigenen Seiten (`Sec-Fetch-Site`).
- Schüler-Laptops schreiben über `/mitmachen/text/<id>`, nur Texte ihres Schülers (siehe `schueler-laptop.md`).

## Wiederverwendet

| Bestehend | Für die Textarbeit |
|---|---|
| Einheit (`units.device_view`) | neue Ansicht `text:<id>` am Tablet |
| SSE-Hub (`lib/whiteboard-hub.ts`) | Kanal `text:<id>` zum Mitlesen; Tablet und Live-Status über die bestehenden Kanäle |
| Live-Status | zeigt die Textarbeit statt der Aufgabe |
| Lern-Dokumentation (`lib/learning.ts`) | `UnitReport.texts`, Zusammenfassung, „Was wurde gemacht“, Fach und Thema |
| Arbeitsblatt-Druck | `PageStyle` (A4, Ränder, Seitenzahlen) und `arbeitsblatt.css` |

## Grenzen (bewusst nicht in Phase 1)

- Keine KI-Korrektur.
- Keine Bildgeschichten oder neuen Aufgabenformate.
- Kein gleichzeitiges Schreiben mehrerer Personen: Wenn zwei Geräte gleichzeitig ändern, wird nachgefragt (siehe oben).

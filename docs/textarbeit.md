# Textarbeit: längere Texte schreiben, speichern, drucken (Lernheft Phase 1)

## Ablauf

1. **Starten.** In einer laufenden Einheit unter „Übungen für Max“ auf „Textarbeit starten“ tippen.
   - Eingaben: Titel, Fach, Textsorte und Aufgabenstellung. Die Textsorten zur Auswahl sind Vorschläge (darunter Bewerbungsschreiben und Lebenslauf), freie Eingabe geht auch.
   - „Wo schreibt Max?“: **Am Gerät** (Standard) oder **Auf Papier**. Auf Papier öffnet sich nach dem Start gleich „Vom Foto übernehmen“ (siehe unten), am Tablet öffnet sich nichts.
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

## Vom Papier übernehmen (handgeschriebene Texte)

Für Texte, die der Schüler mit der Hand auf Papier schreibt, etwa ein Bewerbungsschreiben für die Schularbeit. Nur für Lehrer: in der Textarbeit „Vom Foto übernehmen“ (`/texte/<id>/papier`), oder beim Starten „Auf Papier“ wählen.

1. **Fotografieren.** Bis zu 4 Fotos oder PDF-Seiten. Große Fotos werden im Browser verkleinert (dabei fallen auch die Kameradaten weg).
2. **Haken setzen.** „Auf den Fotos steht kein echter Name, auch nicht oben im Kopf des Blatts.“ Ohne Haken geht nichts hinaus.
3. **Mit KI lesen.** Neben dem Knopf steht die Schätzung, etwa „ca. 1 Cent je Seite“. Die KI schreibt den Text **wortgetreu** ab: jeder Rechtschreib-, Grammatik- und Beistrichfehler bleibt stehen, nichts wird verbessert. Absätze bleiben Absätze; eigene Zeilen (Absender, Datum, Anrede, Grußformel) stehen in eigenen Zeilen, Tabellenspalten (Lebenslauf) getrennt mit „ | “. Durchgestrichenes fällt weg, Unlesbares steht als `[?]` da. Gedruckte Aufgaben, der Kopf des Blatts und Korrekturzeichen einer Lehrkraft werden nicht abgeschrieben.
4. **Vergleichen.** Die Abschrift steht in einem Textfeld neben dem Foto (am Handy darunter). Der Lehrer verbessert nur, was die KI falsch gelesen hat, und ergänzt `[?]`. Die Seite zählt die noch offenen `[?]`.
5. **Übernehmen.** Erst „Als Text übernehmen“ speichert: als neue Fassung des Textes (`saveFromPaper` in `lib/texts.ts`). Was vorher da war, bleibt unter „Frühere Fassungen“. „Text als fertig markieren“ ist dabei vorausgewählt. Danach gehen Korrektur, Bewertung, Lernverlauf, Druck und Dokumentation wie bei jedem Text. Oben steht klein „von Papier übernommen“, nur für Lehrer.

**Ohne KI** (kein Schlüssel, manueller Modus, Budget oder Grenze je Schüler erreicht) steht statt des Knopfs der Grund, und der Lehrer tippt den Text in dasselbe Feld ab, mit den Fotos daneben.

**Datenschutz und Kosten.** Die Fotos werden nicht gespeichert; sie gehen nur beim Lesen an die KI (`/material/handschrift`, wie „Text vom Foto“ der Textinterpretation). Kein Name aus der App geht mit. Die Anfrage läuft über den Router (`runAI`, Funktion `handschrift`) mit der id des Schülers, zählt also für das Monatsbudget und die Grenze je Schüler. Dieselben Fotos werden eine Stunde lang nicht noch einmal bezahlt. Code: `lib/handschrift.ts`, `lib/handschrift-regeln.ts`, `components/text/HandschriftEinlesen.tsx`.

## Datenmodell

| Tabelle | Inhalt |
|---|---|
| `texts` | `student_id`, `teacher_id`, `unit_id` (begonnen in), `subject`, `topic` (Textsorte), `title`, `prompt`, `body`, `words`, `chars`, `version`, `status` (offen/fertig), `created_at`, `updated_at`, `completed_at`, `von_papier` (wann zuletzt von Papier übernommen; null = am Gerät geschrieben) |
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

**Lehrer** (`/texte/<id>`, `/texte/<id>/speichern`, `/texte/<id>/events`, `/texte/<id>/papier`, `/material/handschrift`, `/arbeitsblatt/text/<id>`)
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

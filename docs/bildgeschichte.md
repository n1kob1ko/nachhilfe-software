# Bildgeschichten (Lernheft Phase 4)

Der Schüler sieht eine Bilderfolge und schreibt dazu eine Geschichte. Eine Bildgeschichte ist eine normale Textarbeit mit der Textsorte „Bildgeschichte“ und hochgeladenen Bildern. Deshalb gilt alles, was für Texte gilt, auch hier: automatisches Speichern, frühere Fassungen, Mitlesen, Korrektur, Lernverlauf und A4-Druck.

## Ablauf

1. **Erstellen.** In einer laufenden Einheit auf „Bildgeschichte erstellen“ klicken (`/einheiten/<id>/bildgeschichte`).
   - Bilder hochladen: über „Bilder hinzufügen“ oder durch Hineinziehen. Erlaubt sind JPG, PNG und WebP, höchstens 12 Bilder.
   - Reihenfolge ändern: am Griff ziehen oder mit den Pfeilen.
   - Zu jedem Bild gibt es das optionale Feld „Was passiert?“. Das ist eine kurze Beschreibung für die KI-Korrektur. Der Schüler sieht sie nicht.
   - Weitere Felder: Titel, Fach, Schulart und Klasse, Aufgabenstellung, gewünschte Wortanzahl, Schreibplatz für Ausdrucke (½, 1, 1½ oder 2 Seiten), Satzanfänge (einer pro Zeile) und Hinweise.
   - Unter „Quelle und Nutzungsrechte der Bilder“ lassen sich Herkunft, Urheber und Lizenz festhalten.
   - Mit dem Haken „Gleich am Tablet/Laptop öffnen“ geht die Aufgabe sofort an den Schüler.
2. **Ändern.** In der Textarbeit führt „Bilder und Aufgabe“ zu `/texte/<id>/bilder`. Dort lassen sich Bilder neu ordnen, hinzufügen und entfernen. Der geschriebene Text bleibt dabei unverändert. Ein offenes Tablet oder ein offener Laptop zeigt die Änderung sofort.
3. **Schreiben.** Der Schüler sieht die Bilder in der richtigen Reihenfolge und schreibt im bekannten Texteditor.
   - **Breiter Bildschirm** (Laptop, iPad quer, ab etwa 800 px Breite des Schreibbereichs): Die Bilder stehen als Spalte neben dem Text.
   - **Schmaler Bildschirm** (iPad hoch, kleines Fenster): Die Bilder stehen als Leiste über dem Text. Die Leiste bleibt beim Scrollen oben stehen und lässt sich einklappen.
   - Ein Tipp auf ein Bild öffnet es groß, mit „Voriges Bild“ und „Nächstes Bild“.
   - Satzanfänge und Tipps liegen unter „Satzanfänge und Tipps“.
   - Die Wortanzahl steht unter dem Text, mit Ziel („Ziel: ca. 120“).
4. **Mitlesen.** Der Lehrer sieht den Text live in `/texte/<id>`, mit den Bildern daneben.
5. **Abgeben.** Am Tablet oder Laptop gibt es unter dem Text „Abgeben“ mit Rückfrage.
   - Vor dem Abgeben wird gespeichert. Die Abgabe gilt nur, wenn der Server genau die Fassung hat, die der Schüler sieht. So geht nichts verloren, das noch nicht gespeichert ist.
   - Ohne Verbindung wird die Abgabe abgelehnt, mit einem Hinweis. Der Text bleibt erhalten.
   - Danach ist der Text „fertig“. Der Lehrer kann ihn wieder öffnen.
6. **Korrigieren.** Das geht über „Korrigieren“ wie bei jedem Text (siehe [textkorrektur.md](textkorrektur.md)). Die Bilder stehen oben auf der Korrekturseite.
7. **Drucken.** „PDF / Drucken“ hat das Feld „Ausgabe“ mit zwei Möglichkeiten:
   - **Fertige Bildgeschichte:** Bilderfolge, Titel und der Text des Schülers mit Absätzen. Optional auch die korrigierte Fassung.
   - **Leeres Arbeitsblatt zum Schreiben:** Bilderfolge, Aufgabe, Satzanfänge und Tipps, die Zeile „Überschrift:“ und die gewählte Anzahl an Linien (9 mm).
   - Beide Ausgaben laufen über mehrere Seiten, mit Seitenzahlen. Bilder werden nicht über einen Seitenumbruch geteilt.

## KI-Korrektur

Gesendet werden nur der Text und die kurzen Bildbeschreibungen aus „Was passiert?“. Die Bilder selbst werden nicht gesendet. Namen werden auch in den Beschreibungen durch [Name] ersetzt. Die Freigabe zeigt die Beschreibungen vorher an.

Die KI bewertet die Textsorte Bildgeschichte nach diesen Punkten:
- Einleitung
- Handlungsablauf in der Reihenfolge der Bilder
- Zusammenhang mit den Bildern
- Spannung
- Wortwahl
- Schluss
- Überschrift
- Präteritum
- Rechtschreibung und Grammatik

Die KI darf nichts über die Bilder behaupten, das nicht in den Beschreibungen steht. Fehlen die Beschreibungen, beurteilt sie den Zusammenhang mit den Bildern gar nicht. Das steht dann auch im Prompt.

**Reichen Bildbeschreibungen?** Für den Zusammenhang reicht eine Zeile pro Bild, etwa „Der Hund schnappt sich den Ball.“. Das ist günstiger als Bilder zu senden, schützt die Privatsphäre (Handyfotos können Personen oder Orte zeigen) und gibt der KI keine Gelegenheit, Details zu erfinden. Mit einem echten KI-Modell ist das noch nicht geprüft.

## Speicherung

| Was | Wo |
|---|---|
| Text, Fassungen, Status | Tabellen `texts`, `text_revisions` (wie jede Textarbeit) |
| Einstellungen | Tabelle `picture_stories`, eine Zeile pro Text |
| Bilder (Reihenfolge, Beschreibung, Prüfsumme) | Tabelle `picture_story_images` |
| Bilddateien | `<UPLOADS_PATH>/bildgeschichten/<sha256>.<jpg/png/webp>`, auf Railway also `/data/uploads/bildgeschichten` |

- Jede Bildgeschichte gehört zu Schüler, Lehrer, Einheit und Fach. Die Textsorte ist „Bildgeschichte“, Schulart und Klasse stehen in `picture_stories`.
- Bilder und Text bleiben nach dem Ende der Einheit erhalten. Sie stehen unter „Dokumente dieser Einheit“ und im Lernverlauf.
- Dateien liegen im persistenten Volume. Die tägliche Sicherung kopiert den ganzen Upload-Ordner, die Bilder sind also mit gesichert. Die JSON-Sicherung enthält beide Tabellen.
- Gleiche Bilder werden nur einmal gespeichert. Eine Datei wird gelöscht, wenn keine Bildgeschichte sie mehr nutzt. Das gilt beim Entfernen eines Bildes und beim Löschen eines Schülers.
- Bilder werden **nicht** zu Material und kommen nicht in die Aufgabenbibliothek.

## Prüfung und Zugriff

- **Beim Hochladen** prüft der Server jedes Bild:
  - Der Typ wird aus den ersten Bytes erkannt, nicht aus dem Dateinamen. Eine HTML-Datei mit dem Namen `.png` wird abgelehnt.
  - Höchstens 10 MB pro Bild, 12 Bilder und 60 MB pro Anfrage.
  - Anfragen von fremden Seiten werden abgelehnt.
- **Im Browser** werden große Bilder (über 2000 px oder 1,5 MB) vor dem Senden verkleinert, jedes JPG wird ohne EXIF-Daten neu gespeichert. Ein Handyfoto mit 9 MB wird etwa 1 MB groß.
- **Bilder abrufen** ist nur mit Berechtigung möglich:

  | Wer | Adresse | Voraussetzung |
  |---|---|---|
  | Lehrer | `/material/bildgeschichte/bild/<id>` | angemeldet |
  | Tablet | `/geraet/bild/<id>` | das Tablet gehört zum Schüler der Bildgeschichte |
  | Laptop | `/mitmachen/bild/<id>` | Laptop-Zugang aktiv, gleicher Schüler |

  Ein anderer Schüler bekommt 403. Nach dem Ende der Einheit bekommt der Laptop 401.
- **Ausgeliefert** werden Bilder mit `nosniff` und einer strengen Content-Security-Policy.

## Grenzen

- Nur hochgeladene Bilder. Es gibt keine KI-Bilder und keine automatisch erzeugten Geschichten.
- Die Bilder werden auf dem Server nicht verkleinert. Der Browser zeichnet jedes JPG neu und entfernt dabei EXIF-Daten (Kamera, Ort, Zeit). PNG- und WebP-Dateien unter 1,5 MB bleiben unverändert. Wer Bilder ohne diese Seite an den Server schickt, umgeht das.
- „Abgeben“ gibt es nur bei Bildgeschichten.

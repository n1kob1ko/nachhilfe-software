# Stoffzettel

niko, 2026-10-19: „wenn ich jetzt einen schularbeitsstoff erhalte von einem schüler wie kann ich das
hochladen damit es eingetragen ist für den schüler“. Der Begriff steht in [CONTEXT.md](../CONTEXT.md):
**Stoffzettel**.

| Bereich | Ort |
|---|---|
| Prüfen, Lesen, an die Schularbeit hängen | `lib/stoffzettel.ts` (`stoffzettelLesbar`, `liesStoffzettel`, `vorschlagAusGelesen`, `stoffzettelFuer`) |
| KI-Anfrage | `lib/ai/features.ts` (`leseStoffzettel`), Funktion `stoffzettel` in `lib/ai/config.ts` |
| Hochladen und Lesen | `app/material/stoffzettel/route.ts` |
| Formular „Prüfung eintragen“ | `components/ExamForm.tsx`, Speichern in `app/curriculum-actions.ts` (`addExamAction`) |
| Link zum Zettel | Profil › Prüfungen (`app/(tutor)/schueler/[id]/page.tsx`), Vorbereitung (`.../pruefung/[testId]/page.tsx`) |
| Spalte | `tests.material_id` → `materials(id)`, beim Löschen des Materials `NULL` |

## Ablauf

1. Profil des Schülers › **Prüfungen** › im Formular **Stoffzettel**. Am Handy öffnet sich Kamera oder
   Galerie, am Laptop die Dateiauswahl. Ein Foto wird im Browser verkleinert (wie bei Foto vom Stoff), ein
   PDF geht so, wie es ist.
2. Mit KI: Haken „Auf dem Zettel steht kein Name (oder er ist abgedeckt)“, dann **Lesen und ausfüllen**.
   Der Zettel wird als **Material** des Schülers gespeichert (Titel „Stoffzettel“), die KI liest Art, Fach,
   Termin, Bezeichnung und Stoff. Das Formular wird damit gefüllt; ein gelber Kasten sagt „Von der KI
   ausgefüllt. Bitte prüfen.“ und nennt, was fehlt oder unsicher ist.
3. **Nur anhängen** (oder gleich **Eintragen**) speichert den Zettel, ohne dass die KI ihn liest. Ohne KI
   passiert das gleich nach dem Auswählen.
4. **Eintragen** speichert die Schularbeit wie bisher, mit dem Zettel. Ein gewählter, noch nicht
   gespeicherter Zettel geht dabei mit. Der Zettel heißt danach „Stoffzettel 2. Mathematik-Schularbeit“
   und hat Fach und Stoff der Schularbeit, damit er unter Material zu finden ist.
5. Der Zettel steht als Link **Stoffzettel** an der Schularbeit (geplant und bei den Ergebnissen) und auf
   der Seite „Vorbereitung“. Er öffnet sich in einem neuen Tab.

## Regeln

- Der Zettel geht nur nach dem Haken und nur auf Klick an die KI. Mit ihm gehen nur das heutige Datum
  (für einen Termin ohne Jahr) und die Fächer des Schülers (für die Schreibweise, „M“ → Mathematik),
  nie ein Name. Die KI soll Namen und Klassen nicht wiedergeben.
- Die App prüft die Antwort (`vorschlagAusGelesen`):
  - Art nur aus der Liste im Formular („2. Schularbeit“ → Schularbeit), sonst bleibt die Auswahl.
  - Fach nur, wenn es ein Schulfach ist (auch eines, das nicht im Profil steht, zum Beispiel Biologie);
    sonst bleibt die Auswahl und ein Hinweis sagt es.
  - Termin nur als echter Tag, höchstens 30 Tage zurück und ein Jahr voraus. Ohne Termin wird das
    Datumsfeld geleert (es ist Pflicht), weil „heute“ fast nie der Tag der Schularbeit ist.
  - Stoff: jedes Thema einzeln, ohne Aufzählungszeichen, ohne Doppelte, höchstens 12.
- Gespeichert wird erst mit „Eintragen“. Die KI ändert nichts am Lernstand und verknüpft keine
  Fähigkeiten: die Vorschläge kommen wie bisher aus dem Stoff und werden angehakt.
- Ein zweiter Leseversuch nach einem Fehler schickt die Nummer des gespeicherten Zettels, nicht die Datei.
- Fotos bis 5 MB und PDFs bis 10 MB kann die KI lesen; anhängen geht bis 20 MB.
- Ohne KI, im manuellen Modus oder mit DeepSeek gibt es kein Lesen (`aiReadsImages`); anhängen geht immer.
- Der Zettel bleibt Material des Schülers, auch wenn die Schularbeit gelöscht wird. Wird das Material
  gelöscht, bleibt die Schularbeit ohne Zettel.

## Kosten

Eine Anfrage pro Zettel (Bereich MATERIAL, Stufe standard, ohne Nachdenken, kurze Antwort), auf
Mehr › KI-Kosten als „Stoffzettel lesen“. Derselbe Zettel am selben Tag wird nicht noch einmal bezahlt.
Mit der echten KI ist das noch nicht gemessen.

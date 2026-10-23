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

## Vom Schüler eingetragen (Prüfliste)

niko, Plan 3.1: „Der Schüler fotografiert einen Stoffzettel und lädt ihn hoch. Danach soll die Verarbeitung
automatisch erfolgen. … Unklare Angaben sollen zur Überprüfung angeboten werden. Keine erfundenen Termine
automatisch eintragen.“

| Bereich | Ort |
|---|---|
| Regeln, Speichern, Lesen, Entscheiden | `lib/pruefliste.ts` |
| Schüler-App | `app/lernen/[token]/pruefung/page.tsx`, `components/PruefungEintragen.tsx`, Liste auf `app/lernen/[token]/page.tsx` |
| Hochladen, Verarbeiten | `app/lernen/[token]/pruefung/senden/route.ts`, `.../verarbeiten/route.ts` |
| Prüfliste | `components/Pruefliste.tsx`, `components/PrueflisteEintrag.tsx`, `app/pruefliste-actions.ts` |
| Tabellen | `pruefung_einreichungen`, `pruefung_einreichung_fotos`; Spalte `tests.quelle` |

1. In der Schüler-App **Prüfung eintragen**: Art, Fach, Datum (darf leer bleiben), Stoff, Notiz, bis zu
   4 Fotos oder PDFs. Ein Hinweis zur Datenverarbeitung steht immer beim Foto-Knopf.
2. Mit dem Haken „Auf den Fotos ist kein Name zu sehen“ werden die Fotos gleich nach dem Hochladen
   gelesen, ohne eigenen Knopf. Der Schüler sieht „Dokument wird verarbeitet.“, dann „Prüfungsstoff wurde
   eingetragen.“ Ohne Haken, ohne KI oder an der Grenze je Schüler wird nichts gelesen.
3. Ist alles klar, wird gleich eine Schularbeit eingetragen (`automatischMoeglich`): jedes Foto gelesen,
   Art, Fach und Datum widersprechen dem Schüler nicht, und das Datum liegt ab heute und höchstens ein Jahr
   voraus; ein Datum vom Foto zählt nicht, wenn beim Lesen etwas unsicher war. Sie steht im Profil mit
   „vom Schüler eingetragen“ und zählt für Erinnerung, Cockpit und „Warum heute“.
4. Sonst bleibt der Eintrag in der **Prüfliste** (Profil › Stoff & Prüfungen, „Zu erledigen“), ohne Termin.
   Ein leeres Feld wird mit dem Gelesenen vorgefüllt, ein anderer Wert steht als Hinweis da, ein unklares
   Datum bleibt leer. **Übernehmen** legt die Schularbeit an (Datum Pflicht), **Verwerfen** nicht.
5. Auch eine schon eingetragene steht in der Prüfliste, bis ein Lehrer sie **bestätigt** (Änderungen gehen in
   die Schularbeit) oder **verwirft** (die Schularbeit wird gelöscht, solange sie kein Ergebnis hat).
6. Nur die Lehrer des Schülers und der Admin. Der Schüler sieht eingereicht, eingetragen, übernommen oder
   nicht übernommen, nie Notizen oder Hinweise vom Lesen. Verworfene Fotos, die sonst nirgends hängen,
   werden gelöscht.

Jedes Foto wird höchstens einmal gelesen (auch nach einem Fehler), die Kosten zählen für den Schüler.
Ein Schüler kann höchstens 6 Einträge am Tag machen und 10 offene haben.

## Kosten

Eine Anfrage pro Zettel (Bereich MATERIAL, Stufe standard, ohne Nachdenken, kurze Antwort), auf
Mehr › KI-Kosten als „Stoffzettel lesen“. Derselbe Zettel am selben Tag wird nicht noch einmal bezahlt.
Mit der echten KI ist das noch nicht gemessen.

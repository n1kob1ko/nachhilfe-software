# Stoffzettel

niko, 2026-10-19: „wenn ich jetzt einen schularbeitsstoff erhalte von einem schüler wie kann ich das
hochladen damit es eingetragen ist für den schüler“. Der Begriff steht in [CONTEXT.md](../CONTEXT.md):
**Stoffzettel**.

| Bereich | Ort |
|---|---|
| Prüfen, Lesen, an die Schularbeit hängen | `lib/stoffzettel.ts` (`stoffzettelLesbar`, `liesStoffzettel`, `vorschlagAusGelesen`, `stoffzettelFuer`) |
| Alle Unterlagen zusammen lesen, prüfen, zuordnen | `lib/pruefungsstoff.ts` (`liesPruefungsstoff`, `lesungAusAntwort`, `ordneZu`, `stoffAusLesung`) |
| KI-Anfrage | `lib/ai/features.ts` (`lesePruefungsstoff`, `PRUEFUNGSSTOFF_SYSTEM`), Funktion `stoffzettel` in `lib/ai/config.ts` |
| Ansicht „Erkannt“ | `lib/erkannt.ts`, `app/(tutor)/schueler/[id]/pruefung/[testId]/stoff/page.tsx`, Bestätigen in `app/curriculum-actions.ts` (`bestaetigeStoffAction`) |
| Hochladen und Lesen | `app/material/stoffzettel/route.ts` |
| Formular „Prüfung eintragen“ | `components/ExamForm.tsx`, Speichern in `app/curriculum-actions.ts` (`addExamAction`) |
| Link zum Zettel | Profil › Prüfungen (`app/(tutor)/schueler/[id]/page.tsx`), Vorbereitung (`.../pruefung/[testId]/page.tsx`) |
| Spalten, Tabellen | `tests.material_id` → `materials(id)`, beim Löschen des Materials `NULL`; `tests.lesung_id` → `stoff_lesungen`; `pruefungsstoff` (je Punkt eine Zeile) |
| Beispiel (zwei echte Blätter, von Hand) | `lib/fixtures/stoff-englisch-more.ts`, Tests in `lib/pruefungsstoff.test.ts` |

## Ablauf

1. Profil des Schülers › **Prüfungen** › im Formular **Stoffzettel**. Am Handy öffnet sich Kamera oder
   Galerie, am Laptop die Dateiauswahl. Ein Foto wird im Browser verkleinert (wie bei Foto vom Stoff), ein
   PDF geht so, wie es ist. **Weiteres Blatt** fügt bis zu 8 Fotos oder PDFs hinzu, z. B. Stoffzettel und
   Inhaltsverzeichnis des Buchs; der Knopf heißt dann **Alle zusammen lesen**.
2. Mit KI: Haken „Auf dem Zettel steht kein Name (oder er ist abgedeckt)“, dann **Lesen und ausfüllen**.
   Der Zettel wird als **Material** des Schülers gespeichert (Titel „Stoffzettel“), die KI liest Art, Fach,
   Termin, Bezeichnung und Stoff. Das Formular wird damit gefüllt; ein gelber Kasten sagt „Von der KI
   ausgefüllt. Bitte prüfen.“ und nennt, was fehlt oder unsicher ist.
3. **Nur anhängen** (oder gleich **Eintragen**) speichert den Zettel, ohne dass die KI ihn liest. Ohne KI
   passiert das gleich nach dem Auswählen.
4. **Eintragen** speichert die Schularbeit wie bisher, mit dem Zettel. Wurde gelesen, geht es danach gleich zur
   Ansicht **Erkannt** (siehe unten). Ein gewählter, noch nicht
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
- Gespeichert wird erst mit „Eintragen“. Die KI ändert nichts am Lernstand. Fähigkeiten werden nur verknüpft,
  wenn KI und Wörter dieselbe nennen (eindeutig); alles andere kommt in „Erkannt“ zum kurzen Bestätigen.
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
   8 Fotos oder PDFs (z. B. Stoffzettel und Inhaltsverzeichnis), zusammen höchstens 40 MB. Ein Hinweis zur Datenverarbeitung steht immer beim Foto-Knopf.
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

Alle Fotos eines Eintrags gehen in **einer** Anfrage an die KI, wie beim Lehrer. Der Vorschlag steht am ersten
Foto, die Lesung am Eintrag (`pruefung_einreichungen.lesung_id`); wird daraus eine Prüfung, kommt ihr
Prüfungsstoff mit. Jedes Foto wird höchstens einmal gelesen (auch nach einem Fehler), die Kosten zählen für
den Schüler.
Ein Schüler kann höchstens 6 Einträge am Tag machen und 10 offene haben.

## Mehrere Unterlagen und „Erkannt“

niko, 25.10.2026: „Mehrere Fotos gemeinsam auswerten“, „Ich möchte das tatsächlich erkannte Ergebnis und die
zugeordneten Fähigkeiten sehen und mit den Originalen vergleichen“. Begriff: **Prüfungsstoff** (CONTEXT.md).

- **Eine Anfrage für alle Dateien** (höchstens 8). Die KI bestimmt je Datei die Rolle (Stoffzettel,
  Inhaltsverzeichnis, Erklärung, Aufgaben, sonstiges; seit 27.10.2026, Fassung `pruefungsstoff-2`) und liefert je Punkt: Gruppe (Umfang, Grammatik, Wortschatz, Schreiben, Lesen
  und Hören, Lektüre, Weiteres), Wortlaut, Lerninhalt, Unit, Quelle, Status (Prüfungsstoff, ausgeschlossen,
  noch zu klären) und eine Fähigkeit aus der Liste der App.
- **Die App prüft** (`lesungAusAntwort`): Der Stoffzettel legt den Umfang fest („More Units 1–3“): ein Punkt
  des Inhaltsverzeichnisses aus Unit 4 fällt weg. Was der Stoffzettel ausschließt („videos (Stones, Twins
  etc.), songs“), ist auch im Inhaltsverzeichnis ausgeschlossen („A song 4 U“, „The Twins 1“). Eine
  Überschrift („Unit 2: How embarrassing!“) ist Umfang und nie eine Fähigkeit. Doppeltes fällt weg, erfunden
  wird nichts. Eine Erklärung oder ein Blatt mit Aufgaben legt nie den Umfang fest: an der Prüfung sind ihre
  Punkte „noch zu klären“ (`fuerPruefung`), im Feld „Stoff“ stehen sie nicht. Die Rolle steht an der Datei
  (`materials.rolle`); ändert die Lehrkraft sie im Unterricht, gilt das ohne neue Anfrage auch hier.
- **Zuordnen** (`ordneZu`): KI und Wörter (`stoffVorschlag`, mit dem Gedächtnis der Lehrer) nennen dieselbe
  Fähigkeit → eindeutig, gleich verknüpft. Sie widersprechen sich oder nur die Wörter sprechen für eine im
  selben Bereich → kurz bestätigen. Sonst keine: der Punkt bleibt Prüfungsstoff ohne Fähigkeit. Die
  Lektüre bekommt nie von selbst eine. Neue Suchwörter gibt es nur für bestehende Fähigkeiten.
- **Erkannt** (Vorbereitung › „Erkannt: N Punkte aus den Unterlagen“): oben **Kurz bestätigen** (Vorschläge
  als Chips, nichts vorausgewählt, „Keine passt“) und **Noch zu klären** (Gehört dazu / Nicht dazu), dann
  **Für den Unterricht** (wofür ein geprüftes Lernpaket oder Übungen bereitliegen, was fehlt, mit Link zum
  Übungs-Builder), dann je Gruppe Wortlaut → Lerninhalt → Fähigkeit mit Lernstand, Quelle und Status, und
  die Blätter als Links zum Vergleichen.
- Die Fähigkeiten der Prüfung (`tests.skill_ids`) sind danach die eindeutigen und bestätigten der Punkte,
  die zur Prüfung gehören, plus was ein Lehrer sonst verknüpft hat. „Noch zu klären“ zählt erst nach
  „Gehört dazu“.

## Kosten

Eine Anfrage für alle Blätter einer Prüfung (Bereich MATERIAL, Stufe standard, ohne Nachdenken, bis 10 000
Tokens Antwort), auf Mehr › KI-Kosten als „Stoffzettel lesen“. Dieselben Dateien (sha256) mit derselben
Fassung des Prompts und denselben Fähigkeiten werden nie ein zweites Mal bezahlt: das Ergebnis steht in
`stoff_lesungen` und gilt auch, wenn die KI später aus ist. Geschätzt für Stoffzettel und Inhaltsverzeichnis
(73 Punkte): ≈ 10 000 Tokens hinein, ≈ 4 600 heraus, mit Sonnet 5.5 ≈ 6 Cent. Mit der echten KI ist das noch
nicht gemessen.

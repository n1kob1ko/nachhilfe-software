# Blätter erstellen (Druckblätter)

Phase 5 des Merges ([tommys-merge.md](../tommys-merge.md) §4). Das Fachliche kommt aus
*aufgaben_webseite* (`src/domain/**`, `src/renderers/screen/**`,
`src/features/{worksheet-generator,sentence-builder,letter-tracing}`); Stack, Sprache und Datenhaltung
sind die dieses Repos. Neu geschrieben wurde alles, was die Quelle anders gelöst hatte: kein Zustand
aus einem Store, keine i18n-Schicht, kein `/api/*`. Die Begriffe stehen in
[CONTEXT.md](../CONTEXT.md): **Druckblatt**, **Blätter erstellen**, **Vorlage**, **Lineatur**,
**Schulschrift**.

Ein **Druckblatt** ist ein Blatt zum Ausdrucken, das hier aus Einstellungen entsteht. Der bestehende
A4-Druck einer **Übung** (`/arbeitsblatt`) bleibt davon getrennt (D20): Dort wird eine gestellte
Übung gedruckt, hier ein Blatt erzeugt.

| Bereich | Ort |
|---|---|
| Fachlogik (rein, ohne React) | `lib/druckblatt/**` (Phase 5a/5b, portiert) |
| Zustand der drei Generatoren | `lib/druckblatt/state/*-state.ts` (je ein `useReducer`) |
| Darstellung und Bedienung | `components/druckblatt/**` |
| Seiten | `app/(tutor)/blaetter/{page,lesetabelle,satzbaukasten,nachmalblatt}` |
| Speichern und Zuweisen | `app/druckblatt-actions.ts` → `lib/materials.ts` |
| KI-Vorschläge | `lib/ai/features.ts` (Feature-Schlüssel `druckblatt`) → `app/druckblatt-actions.ts` |
| Druck-CSS | `app/(tutor)/blaetter/blaetter.css`, `components/druckblatt/PrintPageRule.tsx` |
| Schulschriften | `app/globals.css` (`@font-face`), `public/fonts/README.md` |

## Die drei Blätter

| Blatt | Route | Was es ist |
|---|---|---|
| **Lesetabelle** | `/blaetter/lesetabelle` | Silben oder Wörter in einem gleichmäßigen Raster, laut zu lesen. Silbenmatrix aus Anlauten und Vokalen oder eine eigene Wortliste; zwei Farben im Wechsel zeigen die Silbengrenzen. |
| **Satzbaukasten** | `/blaetter/satzbaukasten` | Spalten mit Wörtern oder Satzteilen, aus denen Sätze gebaut werden — darunter Schreibzeilen in der gewählten Lineatur. Bei Nomen steht das Geschlecht dabei („der Hund“); welcher Artikel daraus wird, rechnet die App aus Fall und Artikelart und meldet, was sie nicht sicher weiß. |
| **Nachmalblatt** | `/blaetter/nachmalblatt` | Buchstaben, Silben oder Wörter zum Nachspuren. Die Hilfe nimmt von Zeile zu Zeile ab (gleichmäßig, halb/halb oder gar nicht). Lineatur und Schulschrift sind einstellbar. |

Jeder Generator hat links die Einstellungen, rechts die A4-Vorschau, oben Zoom, Einpassen,
Zurücksetzen und Drucken. Die Vorschau **ist** das Druckergebnis.

**Geometrie ist Datum**: Die Millimeter des Blattes stehen inline im Markup, nicht als CSS-Klasse je
Maß. Farben und Schriften kommen aus den Tokens in `app/globals.css`. Diese Regel kommt aus der
Quelle und ist der Grund, warum Vorschau und Ausdruck nicht auseinanderlaufen können.

## Drucken: Browser statt PDF-Bibliothek (ADR 0001)

Die Entscheidung der Quelle (dort `docs/decisions/0001-browser-print-renderer.md`) gilt hier
unverändert: **Gedruckt wird über den Browser**, es gibt keine PDF-Bibliothek und keinen
Download-Knopf.

Warum:

- **Ein Renderer statt zwei.** Die Bildschirmvorschau ist der Ausdruck; es gibt keine zweite
  Layout-Engine, die auseinanderlaufen könnte, und keinen doppelten Testaufwand.
- **Kein Bundle-Zuwachs.** `@react-pdf/renderer` kostet 250–400 kB gzipped und bringt ein eigenes
  Flexbox-Subset ohne CSS mit — das Layout wäre zweimal zu bauen.
- **Keine Schrift-Einbettung.** Schulschriften sind lizenzrechtlich heikel einzubetten; der Browser
  löst das über eine installierte oder per `@font-face` geladene Schrift.
- **Barrierefrei und selektierbar.** Der Text bleibt echter Text im DOM.

Tragend ist die Kombination aus `@page { size: 210mm 297mm; margin: 0 }`
(`PrintPageRule.tsx`) und einem Satzspiegel, den das Layout-Modell absolut in Millimetern setzt.
Damit bestimmt **nicht der Browser** die Seitenränder, sondern das Blatt selbst. CSS kennt Millimeter
nativ: `35mm` sind auf dem Papier 35 mm, es wird nirgends in Pixel umgerechnet.

Der Preis, wie in der Quelle benannt: kein Stapel-Export, kein Versand per E-Mail, kein
serverseitiges Rendern; Browser können eigene Kopf-/Fußzeilen einfügen (im Druckdialog abschaltbar).
Reversibel bleibt es, weil nur der Renderer betroffen ist: `buildLayout` liefert fertige
Millimeter-Koordinaten und kennt weder CSS noch DOM.

## Speichern, Zuweisen, Wiederöffnen (D21)

Ein gespeichertes Druckblatt ist eine Zeile in **`materials`** — dieselbe Ablage wie Fotos, PDFs und
Arbeitsblätter, keine zweite Liste.

```sql
-- additive Spalte aus lib/db.ts (COLUMNS), nie in einem bestehenden CREATE TABLE geändert
ALTER TABLE materials ADD COLUMN definition TEXT;   -- JSON der Blattdefinition
```

Eine Zeile für ein Druckblatt:

| Spalte | Wert |
|---|---|
| `kind` | `'druckblatt'` |
| `definition` | die Blattdefinition als **JSON** |
| `topic` | die **Blattart** (`lesetabelle`, `satzbaukasten`, `nachmalblatt`) — damit die Zeile zu ihrer Route findet |
| `student_id` | `NULL` = Vorlage; gesetzt = einem Schüler zugewiesen |
| `status` | `'geprueft'` (das Blatt ist die eigene Arbeit der Lehrkraft, niemand muss es prüfen) |
| `file_name`, `mime`, `size`, `sha256`, `stored_path` | leer (siehe unten) |

### Warum die Dateispalten leer bleiben — und wie sie gelesen werden

Die Spalten sind in `materials` **NOT NULL** und ein Bestandteil des bestehenden Upload-Wegs. Sie
nachträglich optional zu machen hieße, die Tabelle neu zu bauen; das verbietet die Regel „Schema
änderungen nur additiv in `COLUMNS`".

Gewählt wurde deshalb der **saubere Weg über die Lese-Schicht**: `lib/materials.ts` schreibt für
`kind = 'druckblatt'` leere Platzhalter und macht daraus beim Lesen **`null`**
(`toMaterial`). Damit ist den Dateifeldern eines Druckblatts im ganzen Code anzusehen, dass es sie
nicht gibt, statt dass irgendwo eine halb gefüllte Dateizeile durchrutscht:

- `hatDatei(m)` sagt, ob es eine Datei gibt; `materialFile(m)` wirft für ein Druckblatt eine deutsche
  Meldung, statt über einen leeren `stored_path` den **Upload-Ordner selbst** zu benennen.
- `deleteMaterial` prüft die gemeinsame Datei und löscht eine Datei nur, wenn es eine gibt — ein
  Druckblatt zu löschen rührt den Upload-Ordner nicht an.
- Die Datei-Route (`/material/[id]/datei`) antwortet für ein Druckblatt mit 404, die
  Material-Detailseite leitet in den Generator um, und die Einordnungsmaske (`classifyMaterial`)
  lässt ein Druckblatt nicht in ein Foto umbenennen.
- Der Upload-Weg selbst ist unberührt: `saveUpload` hat weiterhin echte Werte in allen fünf Spalten
  (das prüft `lib/druckblatt-speichern.test.ts` mit).

### „Als Vorlage speichern" und „Einem Schüler zuweisen"

Beides sind **Einfügungen** (`speichereDruckblatt`), keine Änderung:

- **Als Vorlage speichern** — `student_id = NULL`. Für alle wiederverwendbar.
- **Einem Schüler zuweisen** — eine **Kopie** mit `student_id` und dessen Schulstufe. Die Vorlage
  bleibt bestehen: Wer ein Blatt für ein Kind anpasst, will es nicht dem Kind wegnehmen (D21).

Geprüft wird vor dem Speichern mit `pruefeJson(art, json)`: Ein ungültiger Stand wird mit einer
deutschen Meldung abgelehnt und nicht gespeichert.

### Wiederöffnen — und was bei einem alten oder kaputten Stand passiert

Der Link einer gespeicherten Zeile führt zurück in ihren Generator:
`/blaetter/<blattart>?blatt=<id>`. Die Server-Komponente lädt sie mit `ladeDruckblatt(id, art)` und
gibt die Definition erst dann an den Generator, wenn sie geprüft ist. Zwei Stufen, genau wie die
Grenze „Definition rein / Definition raus" es vorsieht:

1. **`pruefeJson(art, json)`** — vollständig gültig? Dann unverändert übernehmen.
2. **Sonst `mergeDefinition` / `mergeSentenceBox` / `mergeTracing`** — mit den Vorgaben ergänzen und
   alle Werte begrenzen, dazu ein **Hinweis** über der Vorschau: „Der gespeicherte Stand war
   unvollständig oder älter und wurde mit den Vorgaben dieser Blattart ergänzt." Unlesbares JSON
   ergibt die Vorgaben der Blattart mit Hinweis. Es gibt keinen Weg, auf dem eine gespeicherte Zeile
   die Seite zum Absturz bringt.
3. Eine **falsche Blattart** (ein Satzbaukasten über die Lesetabellen-Adresse) wird abgelehnt statt
   still umgebaut: „Das ist ein Satzbaukasten — bitte dort öffnen."

Im Generator kommt die Definition über die Reducer-Aktion **`laden`** an — dieselbe Grenze, die auch
das Drucken prüft. Der Reducer validiert noch einmal und setzt bei einem ungültigen Stand seinen
`fehler`, statt zu werfen.

### Wiederfinden

Es gibt **keine zweite Ablage**:

- **Mehr › Material** (`app/(tutor)/mehr/material/page.tsx`) listet Druckblätter in derselben Liste
  wie Fotos und PDFs, mit einer Plakette „Druckblatt" statt Status und Herkunft; der Klick führt in
  den Generator.
- **Blätter erstellen** (`app/(tutor)/blaetter/page.tsx`) zeigt darunter „Gespeicherte Blätter" mit
  Blattart, Schüler oder „Vorlage" und einem Löschen-Knopf.
- Die Material-Detailseite eines Druckblatts leitet in seinen Generator um.

## Vorschläge von der KI (Schritt 6)

Wortlisten (Lesetabelle) und Spalten (Satzbaukasten) kann die KI vorschlagen. Der Aufruf geht **nicht**
über `/api/*`, sondern über den Router dieses Repos:

```
components/druckblatt/KiVorschlag.tsx
  → app/druckblatt-actions.ts  (Server Action, requireTeacher)
    → lib/ai/features.ts       (Auftrag + Prüfung)
      → lib/ai/router.ts       (Feature-Schlüssel druckblatt, Tarif fast, Bereich EXERCISE)
```

Festgelegt ist:

1. **Der Vorschlag wird nie von selbst übernommen.** Er erscheint zur Ansicht, die Lehrkraft klickt
   „In das Blatt übernehmen" — dann geht die geprüfte Definition über die Aktion `laden` in den
   Reducer. Ein Modell, das unbemerkt Wörter auf ein Blatt schreibt, wäre im Nachhilfebetrieb ein
   Haftungsrisiko (die Quelle nennt denselben Grund).
2. **Die Antwort wird gegen das Blattschema geprüft.** `pruefeWoerterVorschlag` setzt die Wörter in
   die Lesetabelle ein und prüft mit `pruefeLesetabelle`; `pruefeSpaltenVorschlag` schreibt die
   Einträge nach Rolle in die **vorhandenen** Spalten (eine gelöschte kommt nicht zurück) und prüft
   mit `pruefeSatzbaukasten`. Was nicht durchkommt, wird mit einer deutschen Meldung abgelehnt und
   **nie angezeigt**.
3. **Es geht ohne KI.** Ohne Schlüssel oder Budget liefert der Router `{ ok: false, fehler }`; das
   Panel erklärt es („Es ist kein KI-Schlüssel hinterlegt. Die Einträge gibst du von Hand ein — das
   Blatt ist davon unabhängig vollständig nutzbar."), und der Generator ist unverändert bedienbar.
   Zusätzlich steht auf der Seite, ob ein Anbieter bereitsteht (`aiEnabled("druckblatt")`).
4. **Nichts wird erfunden.** Der Tarif `fast` reicht für kurze Listen; der Auftrag und die Prüfung
   sind ohne API-Aufruf testbar (`buildDruckblattWoerterPrompt`, `buildDruckblattSpaltenPrompt`,
   `pruefe*`), und die Tests stellen die Antwort über den Router (`lib/druckblatt-ki.test.ts`) —
   eine Modellantwort wird nirgends nachgebaut.

Die Prüfung „dieselbe Prüfkette wie bei einem Modellaufruf" ist damit auch hier erfüllt: JSON-Form
(zod-Schema am Transport), Blattschema (`pruefe*`), erst dann Anzeige.

**Manueller KI-Modus (ADR 0009)** kommt in Phase 6 (`lib/ai/providers/manual.ts`, `docs/ki-manuell.md`).
Die Begründung der Quelle gilt hier wörtlich: Ein Vorschlag ist ohne jede Infrastruktur nutzbar, die
Lehrkraft entscheidet, und von Hand eingefügt heißt nicht ungeprüft — die Prüfkette ist dieselbe.
Bis dahin ist der Fall „kein Anbieter" ausdrücklich vorgesehen und erklärt.

## Schulschriften und Lineatur (Schritt 7)

Die **Lineatur** (DIN 16552-1) ist Lerninhalt, nicht Papier: Aus ihrem Mittelband wird die
Schriftgröße gerechnet, damit ein Kleinbuchstabe genau zwischen Mittel- und Grundlinie sitzt
(`build-tracing-layout.ts`). Die **Schulschrift** ist die Auswahl unter vier Kennungen
(`lib/druckblatt/rendering/handwriting-scripts.ts`):

| Kennung | Schrift | Datei im Projekt | Lizenz |
|---|---|---|---|
| `druckschrift` | Druckschrift (Andika bzw. Systemschrift der App) | ja (über `--font-sans`) | Andika: SIL OFL |
| `va` | Vereinfachte Ausgangsschrift, „Gruenewald VA" (Peter Wiegel) | **nein** | SIL OFL |
| `sas` | Schulausgangsschrift, „Bienchen SAS" (Peter Wiegel) | **nein** | SIL OFL |
| `la` | Lateinische Ausgangsschrift | **nein** | **keine frei lizenzierte Fassung bekannt** |

**In diesem Projekt liegt keine einzige Schriftdatei** — auch in der Quelle lagen keine, dort gab es
nur die Anleitung. Portiert wurde `public/fonts/README.md`; es beschreibt, welche Datei wohin gehört,
welcher Familienname erwartet wird und welche Lizenzpflichten die SIL OFL mitbringt (die `OFL.txt`
gehört daneben; die Schrift darf weitergegeben, aber nicht einzeln verkauft werden).

Eingebunden ist trotzdem schon alles, was ohne Datei möglich ist:

- `app/globals.css` enthält die `@font-face`-Regeln für „Gruenewald VA" und „Bienchen SAS"
  (aus `public/fonts/{gruenewald-va.woff2,bienchen-sas.woff2}`). Für die Lateinische
  Ausgangsschrift steht dort **bewusst keine** Regel.
- `app/(tutor)/blaetter/blaetter.css` nennt in `.db-schrift-va` / `.db-schrift-sas` die Schriftfamilie
  zuerst und dahinter die Druckschrift.
- **Fehlt die Datei**, lädt der Browser sie nicht und setzt die nächste Familie der Kette — sichtbar
  die Druckschrift. Zusätzlich sagt das Panel „Schulschrift" über `fehlendeSchriftHinweis`
  (`lib/druckblatt/definition/schemas.ts`), welche Schrift gemeint war und warum sie fehlt. Es gibt
  keinen zweiten Mechanismus dafür: eine stille Ersetzung wäre hier besonders heikel, weil das Kind
  genau diese Formen nachmalen soll.

Es wird **nichts heruntergeladen und keine Schriftdatei erfunden**.

## Zurückstand: geplante Blätter

Der Katalog der Quelle (`src/catalog/generators.ts`) nannte neben den drei vorhandenen eine Liste
geplanter Generatoren. Sie steht in `app/(tutor)/blaetter/katalog.ts` als `GEPLANT` und auf der
Übersichtsseite als nicht anklickbare Karten; die Dokumentation hier ist ihr Anhang (Merge-Plan §3.2).
**Die Reihenfolge ist keine Zusage.**

| Blatt | Fach | Klasse | Idee |
|---|---|---|---|
| Schreiblinien | Deutsch | 1–4 | Leere Zeilen in der gewählten Lineatur, für freie Schreibübungen |
| Lückentext | Deutsch | 2–7 | Ein Text mit Lücken, die Wörter als Auswahl darüber |
| Wortarten | Deutsch | 3–6 | Nomen, Verben, Adjektive in einer Tabelle zum Zuordnen |
| Rechenpäckchen | Mathematik | 1–6 | Aufgabenreihen mit gleichbleibender Struktur zum Üben eines Rechenwegs |
| Einmaleins | Mathematik | 2–4 | Reihen des kleinen Einmaleins als Raster zum Ausfüllen |
| Zahlenmauern | Mathematik | 1–4 | Mauern aus additiven Nachbarn, mit und ohne Vorgaben |
| Größen und Einheiten | Mathematik | 3–7 | Umrechnen von Länge, Masse, Zeit und Volumen |
| Vokabelblatt | Englisch | 3–10 | Zwei Spalten zum Falten: Englisch und Deutsch nebeneinander |
| Irregular verbs | Englisch | 5–10 | Grundform, Vergangenheit und Partizip als Tabelle zum Ausfüllen |
| Wortsuchrätsel | Englisch | 2–8 | Wörter im Buchstabengitter wiederfinden |
| Stumme Karte | Sachkunde | 3–8 | Eine Karte ohne Beschriftung zum Eintragen |
| Beschriften | Sachkunde | 3–8 | Ein Schaubild mit leeren Feldern und einer Wortbank |
| Zeitleiste | Sachkunde | 5–10 | Ereignisse in der richtigen Reihenfolge eintragen |
| Zuordnung | Sachkunde | 2–10 | Begriffe und Bilder mit Linien verbinden |

Ein Eintrag wandert von `GEPLANT` nach `VERFUEGBAR`, sobald er eine Route und einen Generator hat
(so steht es im Kopf von `katalog.ts`).

## Tests

| Datei | Was sie festhält |
|---|---|
| `lib/druckblatt/**/*.test.ts` | die portierte Fachlogik (Phase 5a/5b, unverändert in der Sache) |
| `lib/druckblatt-speichern.test.ts` | Speichern und Zuweisen, die `definition`-Spalte, die leeren Dateispalten, `ladeDruckblatt` mit gültigem / altem / kaputtem / falschem Stand, das Löschen ohne Datei und der unveränderte Upload-Weg |
| `lib/druckblatt-ki.test.ts` | Feature-Schlüssel und Tarif, die Aufträge, die Prüfung gegen das Blattschema, der Weg über den Router mit gestellter Antwort und der Fall „kein Schlüssel" |

## Was bewusst nicht gemacht wurde

- **Keine PDF-Ausgabe** (ADR 0001) und kein Stapel-Export.
- **Keine zweite Ablage** für Druckblätter: `materials` ist die einzige Quelle; Blätter erscheinen in
  der Materialliste und in der Blätter-Übersicht.
- **Kein `generatorId`/`schemaVersion`-Feld** aus der Quelle (ADR 0010, Punkt 2). Stattdessen steht die
  Blattart als Kennung im `topic`, und die Prüfung beim Laden entscheidet, ob der Stand unverändert
  gilt oder mit den Vorgaben ergänzt werden muss. Ein Feld „Schemafassung" wäre eine zweite Wahrheit,
  die gepflegt werden müsste; die Prüfung selbst ist die Wahrheit. Wird das später nötig (ein
  Layouter ändert sich sichtbar), gehört es als additive Spalte neben `definition`.
- **Keine Schriftdateien** (siehe oben) und kein Herunterladen.
- **Kein manueller KI-Modus hier** — Phase 6, siehe `docs/ki-manuell.md`.

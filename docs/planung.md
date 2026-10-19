# Wochenplan und geplante Einheiten

Phase 4 des Merges ([tommys-merge.md](../tommys-merge.md) §4). Die Logik kommt aus dem
Wochenplan-Generator der *tutoring institute platform* (`src/lib/services/ScheduleGenerator.ts`,
`config/scheduling-rules.json`, `docs/SCHEDULING-WORKFLOW.md`); Datenmodell, Zeitzone und Sprache
sind die dieses Repos. Die Oberfläche (Wochenansicht mit Ziehen, Dialoge, A4-Druck) steht in
`components/planung/` und `app/(tutor)/planung/`; wie der Plan die echten **Einheiten** antreibt,
steht unten in *Einheiten verknüpfen*, *Was heute auf dem Dashboard steht* und
*lessons.status = 'geplant'*. Beide Teile sind hier beschrieben.

## Die zwei Zustände einer Woche

| Zustand | Wer sieht die Woche | Was möglich ist |
|---|---|---|
| **Entwurf** (`status = 'entwurf'`) | nur die Verwaltung | generieren, Plätze setzen/verschieben/sperren, Vorwoche übernehmen, veröffentlichen, Entwurf verwerfen |
| **veröffentlicht** (`status = 'veroeffentlicht'`) | Verwaltung, der Lehrer seine eigene Woche, der Schüler seine Termine | einzelne Plätze ändern; **kein** Neu generieren, **kein** Entwurf speichern |

Eine Woche ist entweder Entwurf oder veröffentlicht, nie beides. Beim Veröffentlichen wird
**niemand benachrichtigt** (D25) — es gibt keine E-Mail, keine Push-Nachricht, keinen Hinweis im
Schüler-Link. Entwürfe sind für Lehrer und Schüler unsichtbar.

## Wer darf was (D23)

| Handlung | Verwaltung (`is_admin`) | Lehrer |
|---|---|---|
| Woche generieren, Plätze setzen/verschieben/sperren, veröffentlichen | ja | nein |
| veröffentlichte Woche sehen | ja | nur die eigene |
| eigene Verfügbarkeit, Wochenziel, Raumwünsche | ja | ja |
| Verfügbarkeit eines anderen Lehrers | ja | nein |
| Planung eines Schülers (`students.teacher_id`) | ja | ja |
| Räume anlegen/ändern/deaktivieren | ja | nein (nur sehen) |

Die Rechteprüfungen stehen in `lib/planung/berechtigungen.ts`; die Server Actions rufen sie über
`lib/planung/aktionen.ts` auf. Diese Schicht hier prüft keine Rechte — sie prüft Eingaben und
Überlappungen.

## Datenmodell

```sql
CREATE TABLE geplante_einheiten (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start TEXT NOT NULL,                 -- Montag YYYY-MM-DD (Europe/Vienna)
  weekday INTEGER NOT NULL,                 -- ISO 1 = Montag … 7 = Sonntag
  start_min INTEGER NOT NULL,               -- Minuten ab Mitternacht, Vielfaches von 10
  geplante_dauer INTEGER NOT NULL,          -- 1–300
  teacher_id INTEGER NOT NULL REFERENCES teachers(id),
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  room_id INTEGER REFERENCES rooms(id),
  status TEXT NOT NULL DEFAULT 'entwurf',   -- entwurf | veroeffentlicht
  locked INTEGER NOT NULL DEFAULT 0,
  unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
  gleichzeitig INTEGER NOT NULL DEFAULT 0, -- 1 = zwei Schüler gleichzeitig erlaubt (D26)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Dazu drei Indizes: `idx_ge_week(week_start, status)`, `idx_ge_teacher(teacher_id, week_start)`,
`idx_ge_student(student_id, week_start)`.

Zwei Entscheidungen daran sind wichtig:

- **Zeiten sind lokales Datum + Minuten ab Mitternacht**, nie UTC-Zeitstempel (§6). Die
  Zeitumstellung im März und Oktober verschiebt deshalb keinen Platz. „Heute“, „jetzt“ und der
  Wochenanfang werden ausschließlich in `lib/planung/zeit.ts` in Europe/Vienna gerechnet; der
  Wochentag ist dort ISO (1 = Montag), während die Quell-Repos 0 = Sonntag zählen.
- **Überlappungen stehen nicht in der Datenbank.** Es gibt bewusst keine Eindeutigkeit auf
  Zeiträume: die geplante Dauer ist je Schüler verschieden (D3), das kann SQL nicht ausdrücken.
  Geprüft wird stattdessen bei **jedem** Schreiben in `lib/planung/repo.ts` (`pruefeUeberlappung`
  bzw. `pruefeUndNormiere`) für Lehrer, Schüler **und** Raum. Ein Platz, der sich überschneidet,
  wird mit einem deutschen Grund abgelehnt („Lehrer Niko ist am Montag 08:00–09:40 schon
  verplant.“) und nicht geschrieben; ein Stapel (Entwurf speichern, Vorwoche übernehmen) wird
  vorher komplett geprüft und sonst gar nicht geschrieben. Die einzige Ausnahme sind zwei Schüler
  gleichzeitig beim selben Lehrer (D26, unten).

## geplante Dauer und Dauer (D3, D16, D19)

| Begriff | Woher | Wofür |
|---|---|---|
| **geplante Dauer** | `students.geplante_dauer`, Vorgabe 100, erlaubt 1–300 | Länge des Platzes im Wochenplan: `ende = start + geplante Dauer` |
| **Dauer** | `units.started_at` → `units.ended_at` | die echte Zeit; **nur sie** wird abgerechnet |

Die geplante Dauer schreibt die echte Einheit nicht vor. Auf der Einheitenseite steht beides
nebeneinander („geplant 100 min · tatsächlich 85 min“). Startzeiten rasten auf **10 Minuten** ein;
das Ende wird **nicht** gerundet, sonst würde die eingestellte Dauer verfälscht.

## Der Ablauf

### 1. Verfügbarkeit pflegen

Die Zeiten, in denen jemand eingeplant werden darf, stehen als JSON an `teachers.availability` und
`students.availability` (`{ "1": [{ start, end }], … }`, ISO-Wochentag, Minuten ab Mitternacht).
Für eine einzelne Woche kann es eine **Abweichung** geben (`availability_overrides`), die dann die
Regelverfügbarkeit dieser Woche **ersetzt**. Der Generator liest immer
`verfuegbarkeitFuer(ownerType, ownerId, weekStart)` — also Abweichung, sonst Regel.

Dazu je Schüler: `einheiten_pro_woche` (Bedarf), `geplante_dauer`, `modus_wunsch`
(vor Ort / online / egal) und `erlaubte_lehrer`. Beim Lehrer: `weekly_target_min` (Wochenziel) und
`preferred_room_ids` (Wunschräume in Reihenfolge).

### 2. Generieren

`repo.neuGenerieren(weekStart, { seed?, zeitbudgetMs? })` lädt alles, was die Woche braucht
(`wochenEingaben`), ruft den reinen Generator (`lib/planung/generator.ts`) und speichert das
Ergebnis als Entwurf. Was der Generator tut:

1. **Bedarf (D18):** je Schüler `einheiten_pro_woche` Plätze; in Minuten
   `einheiten_pro_woche × geplante_dauer`. Bereits vorhandene **gesperrte** Plätze zählen mit —
   das sind die Ausnahmen, die von Hand gesetzt wurden.
2. **Reihenfolge:** Schüler mit der knappsten Verfügbarkeit zuerst; bei Gleichstand entscheidet der
   `seed` (gleicher Seed ⇒ gleiches Ergebnis). Ein Lauf ist also reproduzierbar.
3. **Startkandidaten:** auf dem 10-Minuten-Raster innerhalb der Verfügbarkeit des Schülers, aber nur
   dort, wo `start + geplante_dauer` noch hineinpasst.
4. **Harte Regeln:** höchstens eine Einheit je Schüler und Tag; Verfügbarkeit von Lehrer und
   Schüler; Lehrer-Wochenziel (wenn eingeschaltet); nur erlaubte Lehrer; nur Räume, die zum Modus
   des Schülers passen; keine Doppelbelegung von Lehrer, Schüler und Raum; ein Gebäude je Lehrer und
   Tag; Paarregeln mit `must`/`mustnt`; keine Lücken im Lehrertag (siehe unten).
5. **Bewertung:** Punkte für Restkapazität des Lehrers, Wunschlehrer, Anschluss an eine bestehende
   Einheit und dafür, dass ein Schüler überhaupt dazukommt (`penaltyLessPlannedLessonsOverall`,
   multipliziert mit der Knappheit `1/machbare Kandidaten`); Abzug für unnütze Lücken
   (`penaltyPer30MinGap`) und für Einzel-Einheiten-Tage des Lehrers. Der beste Kandidat gewinnt.
6. **Nicht eingeplante Schüler** kommen als Liste zurück (`offen`: bereits geplante Minuten,
   benötigte Minuten), damit die Oberfläche sie zeigt. Ohne Räume bricht der Lauf sofort ab und
   meldet „Keine Räume vorhanden.“ für jeden Schüler mit Bedarf.

### 3. Verfeinern

- **Platz setzen:** `repo.legePlatzAn({ week_start, weekday, start_min, geplante_dauer, teacher_id,
  student_id, room_id })` — rastet den Start auf 10 Minuten, prüft Überlappung, legt den Platz an.
  In einer veröffentlichten Woche wird er sofort mitveröffentlicht, damit er sichtbar ist.
- **Verschieben/umbesetzen:** `repo.aenderePlatz(id, änderung)` — dieselbe Prüfung, aber ohne sich
  selbst.
- **Sperren:** `repo.setzeGesperrt(id, true)`. Ein gesperrter Platz ist von Hand gesetzt und wird
  von „Neu generieren“ **nie** verschoben. Entsperren macht ihn wieder zum Vorschlag.
- **Löschen:** `repo.loeschePlatz(id)`.
- **Zwei Schüler gleichzeitig:** Haken „Gleichzeitig mit einem anderen Schüler“ im Platz-Dialog
  (`gleichzeitig: true`), siehe *Zwei Schüler gleichzeitig (D26)*.

### Zwei Schüler gleichzeitig (D26)

Manchmal hat ein Lehrer zwei Schüler zur selben Zeit. niko hat am 2026-10-19 entschieden: das ist
eine bewusste Ausnahme **pro Platz**, keine Einstellung je Lehrer.

- Ein Platz mit `gleichzeitig = 1` darf sich mit **einem** anderen Platz desselben Lehrers
  überschneiden. Es reicht, wenn einer der beiden den Haken trägt; der Partner kann danach
  verschoben werden, ohne selbst einen zu brauchen.
- Höchstens zwei zugleich: überschnitte ein dritter Platz dieselbe Minute, wird abgelehnt („Lehrer
  Niko hat am Montag 09:20–09:40 schon zwei Schüler gleichzeitig. Mehr als zwei gehen nicht.“).
  Nacheinander versetzt (A mit B, danach B mit C) geht.
- Die beiden dürfen im selben Raum sein. Ein anderer Lehrer im selben Raum bleibt verboten, ebenso
  derselbe Schüler zweimal.
- Ohne Haken bleibt alles wie bisher; die Absage nennt den Weg („… setz beim Platz den Haken …“).
- Nach dem Speichern sind **beide** Plätze gesperrt (`sperreZugleich` in `lib/planung/repo.ts`).
  Der Generator plant nie zwei Schüler zugleich; ohne Sperre löste „Neu generieren“ das Paar auf.
  „Vorwoche übernehmen“ nimmt den Haken mit und sperrt das Paar, alle anderen Kopien bleiben ohne
  Sperre (D24).
- Gezählt wird die **Lehrerzeit** einmal: Lehrerkachel, Wochenziel, Auslastung, Lücken und die
  Kapazität im Generator fassen überlappende Plätze zusammen (`zusammenfassen`, `belegteMinuten`
  in `lib/planung/generator.ts`). Die Summe aller Plätze und der Bedarf zählen weiter je Schüler.
- In der Wochenansicht stehen die beiden nebeneinander (`spurenFuer` in `WochenplanGitter.tsx`),
  mit einem Personen-Zeichen und „gleichzeitig mit …“ im Tooltip, im Dialog und im A4-Druck.
- Die echten Einheiten ändern sich nicht: beide Schüler bekommen ihre eigene Einheit. Das
  Lehrer-Tablet zeigt die zuletzt gestartete (`activeUnitForTeacher`); der andere Schüler arbeitet
  über „Eigenes Gerät verbinden“ (`docs/schueler-laptop.md`) oder auf Papier.

### 4. Veröffentlichen

`repo.veroeffentlicheWoche(weekStart)` setzt alle Entwürfe der Woche auf `veroeffentlicht`.
Ist die Woche schon veröffentlicht oder gibt es keinen Entwurf, kommt ein Grund zurück.
`repo.verwerfeEntwurf(weekStart)` wirft nur den Entwurf weg; `repo.loescheWoche(weekStart)` räumt
auch veröffentlichte Plätze einer Woche weg („alles zurücksetzen“).

### 5. Vorwoche übernehmen (D24)

`repo.uebernimmVorwoche(weekStart)` kopiert die **Vorwoche** in die Zielwoche, als Entwurf: ohne
Verknüpfung zur Einheit (`unit_id` leer) und **ohne Sperre** — die Kopie ist ein Vorschlag, den
„Neu generieren“ noch umbauen darf. Gibt es in der Vorwoche einen veröffentlichten Plan, wird der
übernommen, sonst deren Entwurf; die Zielwoche muss leer sein. Eine automatische Wiederholung gibt
es nicht (D24): ohne Klick passiert nichts. Ausnahme: zwei Schüler gleichzeitig (D26) kommen samt
Haken **gesperrt** mit.

### 6. Neu generieren (D24)

`repo.neuGenerieren(weekStart)` arbeitet auf dem Entwurf: gesperrte Plätze sind Eingabe und bleiben
stehen (`locked = 1`), alle übrigen Entwürfe werden ersetzt. Eine veröffentlichte Woche wird nicht
neu generiert — dort lassen sich einzelne Plätze ändern.

## Die Regeln und ihre Vorgaben

Die Regeln liegen in `app_settings` unter dem Schlüssel `planung_regeln` (JSON) und werden beim
Lesen mit zod geprüft (`lib/planung/regeln.ts`). Fehlt der Eintrag oder ist er kaputt, gelten die
Vorgaben — die Planung scheitert nie an einer kaputten Einstellung; `schreibeRegeln` lehnt
Ungültiges ab und schreibt nichts.

| Regel | Vorgabe | Bedeutung |
|---|---|---|
| `snapMinutes` | 10 | Raster der Startzeiten (Vielfache von 10, damit D19 gilt) |
| `gapUsefulMinutesThreshold` | 15 | Lücken unter dieser Länge gelten als unnütz (und sind erst ab hier ein „Bruch“, siehe unten) |
| `pointsPerMinuteRemainingCapacity` | 2 | Punkte je freier Minute des Lehrers |
| `pointsPreferredTeacher` | 0 | Punkte, wenn der Klassenlehrer übernimmt |
| `pointsAdjacentTeacher` | 0 | Punkte, wenn die Einheit an eine bestehende anschließt |
| `penaltyPer30MinGap` | 999 | Abzug je angefangene 30 Minuten neuer Lücke |
| `penaltySingleLessonTeacherDay` | 10 | Abzug für einen Lehrertag mit genau einer Einheit |
| `penaltyLessPlannedLessonsOverall` | 980 | Gewicht dafür, überhaupt einen Platz zu vergeben (× Knappheit) |
| `pointsStudentPairShouldSameTime` | 25 | Punkte für die Paarregel `should`; ab 999 wird sie hart |
| `penaltyStudentPairShouldntSameTime` | 25 | Abzug für `shouldnt`; ab 999 wird sie hart |
| `prioritizeMaxPlannedLessons` | an | in jeder Runde den global besten Kandidaten setzen |
| `enforceSingleLessonPerStudentPerDay` | an | höchstens eine Einheit je Schüler und Tag |
| `enforceTeacherAvailability` | an | Lehrer nur in seiner Verfügbarkeit |
| `enforceStudentAvailability` | an | Schüler nur in seiner Verfügbarkeit |
| `enforceTeacherRoomPreference` | an | nur Wunschräume, wenn welche eingetragen sind |
| `enforceNoTeacherBreaks` | an | keine Lücken im Lehrertag (Toleranz siehe unten) |
| `enforceTeacherCapacity` | aus | Wochenziel des Lehrers als Obergrenze |
| `enforceStudentWeekWeekendDistribution` | aus | ab 200 Minuten Bedarf je eine Einheit am Wochenende und unter der Woche, ab 400 je zwei |
| `studentPairTimingRules` | leer | Paare: `{ id, studentAId, studentBId, strength }` mit `must`, `should`, `shouldnt`, `mustnt` |

Drei Punkte sind gegenüber dem Quell-Repo geändert:

- Die Vorgaben sind die Werte seiner `config/scheduling-rules.json` (`enforceTeacherCapacity: false`,
  `snapMinutes: 10`, `enforceStudentWeekWeekendDistribution: false`), nicht die seiner
  `DEFAULT_SCHEDULING_RULES` (`true`, `20`, `true`).
- **Die Paarregeln nennen Schüler als ganze Zahl** (`studentAId: 3`), nicht als Text-Id.
- **Die Regel „keine Lücken“ hat eine Toleranz.** Im Quell-Repo war jede Lücke > 0 ein Bruch, weil
  dessen Einheiten immer 100 Minuten lang waren und damit auf dem 20-Minuten-Raster endeten. Hier
  ist die Dauer je Schüler verschieden: eine 45-Minuten-Einheit um 08:00 endet 08:45, die nächste
  dürfte frühestens 08:50 beginnen — mit „jede Lücke > 0“ wäre der restliche Lehrertag danach
  unbrauchbar, weil Startzeiten auf dem 10-Minuten-Raster liegen (D19). Deshalb zählt eine Lücke
  erst ab `gapUsefulMinutesThreshold` (Vorgabe 15 Minuten) als Bruch; kürzere Lücken sind laut
  denselben Regeln ohnehin „unnütz“ und werden auch nur mit `penaltyPer30MinGap` bewertet.

## Zeitbudget (§6)

Die Generierung ist synchrone Rechenarbeit im einzigen Prozess der App — in demselben Prozess
laufen die Whiteboard-Verbindungen (SSE). Deshalb hat der Lauf ein **Zeitbudget** (Vorgabe
`STANDARD_ZEITBUDGET_MS = 2000` ms, Parameter `zeitbudgetMs`). Ist es aufgebraucht, bricht die
Suche ab und gibt den **bis dahin besten Stand** zurück; das Ergebnis meldet
`zeitbudgetErreicht: true`, und die nicht eingeplanten Schüler stehen vollständig in `offen`.

## Einheiten verknüpfen (D16, D17)

- Startet der Lehrer eine Einheit (`lib/units.ts` → `startUnit`), verknüpft sie sich in derselben
  Sekunde mit ihrem heutigen **veröffentlichten** Platz: `verknuepfeMitHeutigemPlatz(unit, at)`
  sucht über `offenePlaetzeHeute(studentId, { teacherId, now })` (`lib/planung/heute.ts`).
- **Die Regel**, in dieser Reihenfolge:
  1. nur **veröffentlichte** Plätze von **heute** (Europe/Vienna) **ohne** `unit_id`;
  2. zuerst ein Platz **desselben Lehrers**, der die Einheit startet;
  3. gibt es keinen, ein Platz eines **anderen Lehrers**;
  4. innerhalb dieser Auswahl der Platz, dessen **Startzeit** „jetzt“ am nächsten liegt
     (bei Gleichstand die frühere, dann die kleinere Id).
  Findet sich kein Platz, läuft die Einheit wie bisher **ungeplant** — es fehlt nur die Soll-Seite.
- **Ein Platz wird einmal vergeben.** `verknuepfePlatz(id, unitId)` setzt `unit_id`; danach bietet
  `offenePlaetzeHeute` ihn nicht mehr an. Ein zweiter Start (nach dem Beenden der ersten Einheit,
  oder ein Doppelklick während sie läuft) verknüpft denselben Platz deshalb **nie** erneut: der
  laufende Fall schreibt gar nichts (`created = false`), der zweite nimmt den nächsten offenen
  Platz oder bleibt ungeplant.
- `verknuepfePlatz(id, null)` löst eine Verknüpfung wieder.
- Ein **vergangener veröffentlichter Platz** ohne `unit_id` gilt als **„nicht stattgefunden“**
  (`repo.istNichtStattgefunden` / `repo.nichtStattgefunden(weekStart, now)`): erst wenn die
  geplante Zeit vorbei ist, nicht schon während sie läuft. Sie steht so auf dem Schülerprofil
  (`app/(tutor)/schueler/[id]/page.tsx`), im Wochenplan (`components/planung/WochenplanGitter.tsx`,
  `WochenplanPanels.tsx`), im A4-Druck und auf dem Schüler-Link (`app/lernen/[token]/page.tsx`) —
  und hat **keine Abrechnungsfolge**.
- **Die Abrechnung liest weiterhin nur die Dokumentation abgeschlossener Einheiten**
  (`lib/billing.ts` → `repo.billingEntries`: `lessons.kind = 'stunde' AND status = 'abgeschlossen'`,
  verknüpft über `lessons.unit_id`). Ein Platz im Wochenplan, ob verknüpft oder ausgefallen, kommt
  in dieser Abfrage nicht vor; `lib/billing.ts` wurde in Phase 4 nicht angefasst.
- Auf der **Einheitenseite** (`app/(tutor)/einheiten/[id]/page.tsx`) steht bei einer verknüpften
  Einheit „geplant 100 min · tatsächlich 85 min“ (D16): die geplante Dauer kommt über
  `units.platzFuerEinheit(unit)` aus dem Platz, die tatsächliche aus `units.started_at` →
  `units.ended_at`. Ohne Platz steht nur die tatsächliche Dauer da.

## Was heute auf dem Dashboard steht

`lib/planung/heute.ts` liefert die **veröffentlichten** Plätze des heutigen Tages in Europe/Vienna,
mit Namen von Lehrer, Schüler und Raum, einer fertigen Zeitangabe („14:00–15:40“) und dem Vermerk
`nicht_stattgefunden`:

- `heutigeEinheiten(teacherId?, now?)` — ohne `teacherId` alle Lehrer (Verwaltung), sonst einer.
- `heutigeEinheitenFuerSchueler(studentId, now?)` — für den Schüler-Link und das Profil.
- `offenePlaetzeHeute(studentId, { teacherId?, now? })` — die noch nicht verknüpften Plätze.
- `heutigerWochentag(now?)`, `heutigerWochenstart(now?)`.

### Der Tagesplan

Der Abschnitt „Heute“ auf der Startseite (`app/(tutor)/page.tsx`) ist der **Tagesplan** und kommt
aus den veröffentlichten Plätzen von heute (`heutigeEinheiten(teacher.id)`), in der Reihenfolge des
Tages; gerendert wird er von `Tagesplan` in `components/Calendar.tsx`. Jede Zeile zeigt Zeit,
Schüler, Raum (bzw. „online“ oder „Raum noch offen“) und „*n* min geplant“ und bietet:

- **„Einheit starten“** (`startUnitAction`) — die Einheit entsteht und verknüpft sich mit ihrem
  Platz (siehe oben); der große Knopf oben bietet dafür den nächsten **offenen** Platz von heute an,
  sonst die nächste von Hand geplante Einheit;
- **„Zur Einheit“** mit Zustand, wenn der Platz schon eine (laufende oder beendete) Einheit hat;
- bei einem vergangenen Platz ohne Einheit den Vermerk **„nicht stattgefunden“** — startet der
  Lehrer doch noch, nimmt die Einheit den nächstgelegenen offenen Platz des Tages (ist der
  vergangene der einzige offene, genau diesen), und der Vermerk fällt weg.

Dazu kommen zwei Zeilen aus der alten Planung, damit nichts verloren geht: eine von Hand geplante
Einheit ohne Platz (`lessons.status = 'geplant'`) erscheint als Zeile **„ohne Wochenplan-Platz“**,
und was heute schon dokumentiert ist, als **„erledigt“** mit Link zur Einheit. Beides nur, solange
der Schüler heute **keinen** veröffentlichten Platz hat — sonst gilt der Platz, und die Zeile steht
weiterhin im Lernverlauf des Schülers unter „Geplant“.

## `lessons.status = 'geplant'` — Entscheidung (Phase 4)

Der Plan ließ offen, ob `lessons.status = 'geplant'` nach `geplante_einheiten` noch gebraucht wird
(tommys-merge.md §4, D17: „if not, migrate them … and stop creating them“). **Die Antwort lautet:
ja, er wird noch gebraucht — es wird nichts migriert und nichts eingestellt.** Beide Wege bleiben
nebeneinander bestehen. Die Gründe stehen im Code:

- **Es wird weiterhin erzeugt.** `app/actions.ts:84` (`saveLessonAction`, Formular
  `components/LessonForm.tsx`) schreibt `status = 'geplant'` als Vorgabe; erreichbar über
  „Einheit nachtragen oder planen“ im Lernverlauf
  (`components/Lernverlauf.tsx:72` → `app/(tutor)/schueler/[id]/stunden/neu`). Auch die Demo-Daten
  legen je Schüler zwei solche Zeilen an (`lib/demo.ts:325`, `lib/demo.ts:340`).
- **Es wird weiterhin gelesen.** `lib/learning.ts:335` (`plannedLessonFor`) nimmt die geplante Zeile
  des Tages als **Dokumentationszeile** der Einheit (`writeLearningDoc`, `lib/learning.ts:364`):
  die Einheit schreibt keine zweite Zeile, sondern füllt die vorhandene. `expectedSubject` nimmt
  daraus das Fach für den Start, `sweepIdleUnits` die geschätzte Dauer
  (`lib/learning.ts:341`, `lib/learning.ts:414`). `components/Lernverlauf.tsx:31` zeigt sie als
  „Geplant“, `app/(tutor)/schueler/[id]/page.tsx` als „Nächster Termin“.
- **Eine Migration würde Informationen verlieren und könnte lügen.** `geplante_einheiten` hat keine
  Spalten für `subject`, `topic`, `skill_ids` oder `notes` einer geplanten Zeile; eine umgehängte
  Zeile müsste die Dokumentationszeile löschen. Aus `starts_at` + `duration_min` entstünde ein
  Platz mit erfundener `week_start`/`weekday`-Zuordnung, der in einer schon **veröffentlichten**
  Woche entweder am Status scheitert oder als „nicht stattgefunden“ auftaucht — für Termine, die
  nie im Wochenplan standen.

Was stattdessen gilt: **Der Wochenplan ist die Quelle für den Tagesplan** (`geplante_einheiten`),
und die von Hand geplante Zeile bleibt der Weg für alles, was nicht im Wochenplan steht (und die
Dokumentationszeile der Einheit). Kommt eine Einheit mit beiden in Berührung, gewinnt keine von
beiden: sie verknüpft sich mit dem Platz **und** füllt die Zeile (`lib/learning.ts`). Sollte der
Alt-Weg später wirklich auslaufen, ist die Migration erst dann gefahrlos, wenn das Formular keine
`geplant`-Zeilen mehr erzeugt und `plannedLessonFor` verschwunden ist; beides ist heute nicht der
Fall. `lib/units-verknuepfung.test.ts` hält das fest: eine geplante Zeile wird von der Einheit
übernommen, es entsteht keine zweite, und abgerechnet wird sie erst als abgeschlossene Einheit.

## Der Code

| Datei | Inhalt |
|---|---|
| `lib/planung/generator.ts` | der reine Generator (`generiereWochenplan`): kein Datenbankzugriff, keine Uhr außer der übergebenen, gleicher `seed` ⇒ gleiches Ergebnis |
| `lib/planung/regeln.ts` | Regelschema, Vorgaben, Lesen/Schreiben in `app_settings` |
| `lib/planung/repo.ts` | alles Lesende und Schreibende am Wochenplan, inkl. der **einzigen** Überlappungsprüfung, plus `wochenEingaben` und `neuGenerieren` |
| `lib/planung/heute.ts` | „heute“ für Dashboard, Schüler-Link und den Start einer Einheit |
| `lib/planung/schueler-termine.ts` | die Termine der Schüler-App: nächster Termin, diese und die nächste Woche, nur veröffentlicht, ohne Namen |
| `lib/planung/zeit.ts` | die einzige Stelle für Wochentag, Woche und Zeitzone |
| `lib/planung/verfuegbarkeit.ts` | Verfügbarkeit als Wert und als JSON-Spalte |
| `lib/planung/schema.ts` | zod-Schemata der Formulare (Phase 3) |
| `lib/planung/berechtigungen.ts`, `lib/planung/aktionen.ts` | die Rechteprüfung (D23) |
| `lib/planung/uebersicht.ts` | die Sicht auf eine Woche (`wochenUebersicht`): Plätze mit Namen, Lehrerkacheln, offener Bedarf, Kennzahlen — für Oberfläche und A4-Druck |

Die Oberfläche dazu:

| Datei | Inhalt |
|---|---|
| `app/(tutor)/planung/page.tsx` | die Wochenansicht der Verwaltung: Filter, Wochenwahl, Meldungen, Dialoge |
| `app/(tutor)/planung/drucken/page.tsx` | A4-Druck der Woche |
| `app/planung-actions.ts` | alle Server Actions der Planung (generieren, veröffentlichen, Platz anlegen/ändern/sperren/löschen, Regeln, Räume) mit Rechteprüfung |
| `components/planung/Wochenplan.tsx` | der Rahmen: Wochenwahl und Werkzeuge, die Statuskarte mit den Knöpfen, die im Zustand gehen, Lehrer-Chips und Filter; ab 1024 px das Gitter mit Legende, darunter die Tagesliste |
| `components/planung/WochenplanGitter.tsx` | das Gitter (Computer): je Lehrer ein Band mit Kennzahlen, Spalten = Tage, der Tageskopf bleibt beim Scrollen oben, schraffiert = nicht verfügbar, Stundenlinien, das 10-Minuten-Raster erst beim Ziehen. Anklicken öffnet einen Platz, ziehen verschiebt, das Schloss erscheint beim Darüberfahren; ein Klick auf freie Zeit öffnet „Platz anlegen“ mit Lehrer, Tag und Uhrzeit vorbelegt |
| `components/planung/WochenplanTage.tsx` | die Ansicht für Telefon und Tablet (unter 1024 px): Tage zum Antippen (bleiben oben), darunter ein Tag als Liste je Lehrer mit Plätzen und Lücken; ein Tipp öffnet den Platz. Kein Ziehen, kein seitliches Scrollen |
| `components/planung/WochenplanPanels.tsx` | die Statuskarte (`WochenStatus`: Zustand, nächster Schritt, Kennzahlen; „… Schüler noch offen“ öffnet das Schubfach) und das Schubfach der offenen Schüler |
| `lib/planung/ansicht.ts` | was gezeigt wird: nur die Arbeitszeit (`anzeigeBereich`), Samstag/Sonntag nur mit Platz oder Verfügbarkeit (`sichtbareTage`), welcher Tag auf dem Telefon zuerst offen ist (`startTag`) und die Reihenfolge der Tagesliste (`tagesListe`) |
| `components/planung/PlatzDialog.tsx`, `RegelnDialog.tsx` | ein einzelner Platz (anlegen mit Vorgabe aus `?bei=&tag=&um=`, ändern, sperren, löschen; Escape schließt) und die Regeln |
| `components/planung/VerfuegbarkeitEditor.tsx`, `VerfuegbarkeitFormular.tsx`, `VerfuegbarkeitTabelle.tsx`, `WochenAbweichung.tsx` | Verfügbarkeit und Wochenabweichung (Phase 3) |
| `components/planung/RaumForm.tsx`, `RaumPraeferenzen.tsx`, `RaumAktionen.tsx` | Räume und Raumwünsche (Phase 3, D22) |
| `components/planung/PlanungFormular.tsx` | der Abschnitt „Planung“ einer Schülerin/eines Schülers (Phase 3) |
| `app/(tutor)/mehr/raeume/page.tsx`, `app/(tutor)/lehrer/page.tsx`, `app/(tutor)/schueler/[id]/bearbeiten/page.tsx` | die Seiten dazu |
| `app/(tutor)/page.tsx` (`?tab=woche` = „Meine Woche“), `app/lernen/[token]/page.tsx` | die veröffentlichte Woche des Lehrers und „Deine Termine“ des Schülers (diese und die nächste Woche, `lib/planung/schueler-termine.ts`, [schueler-app.md](schueler-app.md)) |

Und die Verknüpfung mit den echten Einheiten (dieser Teil):

| Datei | Inhalt |
|---|---|
| `lib/units.ts` | `startUnit` verknüpft beim Start (`verknuepfeMitHeutigemPlatz`, `platzFuerEinheit`) |
| `app/(tutor)/page.tsx`, `components/Calendar.tsx` | der Tagesplan (`Tagesplan`) aus den veröffentlichten Plätzen, jede Zeile mit „Einheit starten“ |
| `app/(tutor)/einheiten/[id]/page.tsx` | „geplant 100 min · tatsächlich 85 min“ (D16) |
| `app/(tutor)/schueler/[id]/page.tsx` | „Wochenplan-Termine“ dieser Woche, vergangene ohne Einheit als „nicht stattgefunden“ |
| `lib/billing.ts`, `lib/repo.ts` (`billingEntries`) | **unverändert**: Abrechnung nur aus abgeschlossenen Einheiten |

Die Tests dazu: `lib/planung/generator.test.ts` (Port von `ScheduleGenerator.test.ts` des
Quell-Repos plus variable Dauer, 10-Minuten-Raster, gesperrte Plätze, Zeitbudget),
`lib/planung/regeln.test.ts`, `lib/planung/repo.test.ts`, `lib/planung/heute.test.ts`,
`lib/planung/verfuegbarkeit.test.ts`, `lib/planung/aktionen.test.ts`,
`lib/planung/wochenplan-aktionen.test.ts`, `lib/planung/zeit.test.ts`,
`lib/planung/gleichzeitig.test.ts` (zwei Schüler gleichzeitig, D26),
`lib/units-verknuepfung.test.ts` (Verknüpfung, „nicht stattgefunden“ ohne Abrechnungsfolge, die
Entscheidung zu `lessons.status = 'geplant'`) und die Sicherung in `lib/robust.test.ts`.

## Was aus dem Quell-Repo nicht übernommen wurde

- `weekStartDate` im Eingabeobjekt („reserved for future date-based rules“, dort nie benutzt).
- Die zweite Ansicht „published vs. draft“ als getrennte Tabellen: hier unterscheidet nur `status`
  in einer Tabelle.
- Benachrichtigungen beim Veröffentlichen (D25).
- Die REST-Routen (`src/app/api/schedule/*`): hier werden Server Actions daraus.

# Wochenplan und geplante Einheiten

Phase 4 des Merges ([tommys-merge.md](../tommys-merge.md) §4). Die Logik kommt aus dem
Wochenplan-Generator der *tutoring institute platform* (`src/lib/services/ScheduleGenerator.ts`,
`config/scheduling-rules.json`, `docs/SCHEDULING-WORKFLOW.md`); Datenmodell, Zeitzone und Sprache
sind die dieses Repos. Die Oberfläche (Wochenansicht, Ziehen, Dialoge, A4-Druck) baut auf dieser
Schicht auf, steht aber nicht in diesem Dokument.

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
  vorher komplett geprüft und sonst gar nicht geschrieben.

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
es nicht (D24): ohne Klick passiert nichts.

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

## Einheiten verknüpfen (D17)

- Startet der Lehrer eine Einheit, sucht die App den passenden heutigen **veröffentlichten** Platz
  des Schülers (`lib/planung/heute.ts` → `offenePlaetzeHeute(studentId, { teacherId })`: ohne
  `unit_id`, bevorzugt derselbe Lehrer, sonst die Startzeit, die „jetzt“ am nächsten liegt) und
  setzt `geplante_einheiten.unit_id`. Findet sie keinen, läuft die Einheit wie bisher ungeplant.
- `repo.verknuepfePlatz(id, unitId)` schreibt die Verknüpfung, `verknuepfePlatz(id, null)` löst sie.
- Eine **vergangene veröffentlichte** Einheit ohne `unit_id` gilt als **„nicht stattgefunden“**
  (`repo.istNichtStattgefunden` / `repo.nichtStattgefunden(weekStart, now)`): erst wenn die
  geplante Zeit vorbei ist, nicht schon während sie läuft. Keine Abrechnungsfolge.
- Die Abrechnung (`lib/billing.ts`) liest weiterhin nur `units` — der Wochenplan ändert daran
  nichts.

## Was heute auf dem Dashboard steht

`lib/planung/heute.ts` liefert die **veröffentlichten** Plätze des heutigen Tages in Europe/Vienna,
mit Namen von Lehrer, Schüler und Raum, einer fertigen Zeitangabe („14:00–15:40“) und dem Vermerk
`nicht_stattgefunden`:

- `heutigeEinheiten(teacherId?, now?)` — ohne `teacherId` alle Lehrer (Verwaltung), sonst einer.
- `heutigeEinheitenFuerSchueler(studentId, now?)` — für den Schüler-Link und das Profil.
- `offenePlaetzeHeute(studentId, { teacherId?, now? })` — die noch nicht verknüpften Plätze.
- `heutigerWochentag(now?)`, `heutigerWochenstart(now?)`.

## Der Code

| Datei | Inhalt |
|---|---|
| `lib/planung/generator.ts` | der reine Generator (`generiereWochenplan`): kein Datenbankzugriff, keine Uhr außer der übergebenen, gleicher `seed` ⇒ gleiches Ergebnis |
| `lib/planung/regeln.ts` | Regelschema, Vorgaben, Lesen/Schreiben in `app_settings` |
| `lib/planung/repo.ts` | alles Lesende und Schreibende am Wochenplan, inkl. der **einzigen** Überlappungsprüfung, plus `wochenEingaben` und `neuGenerieren` |
| `lib/planung/heute.ts` | „heute“ für Dashboard, Schüler-Link und den Start einer Einheit |
| `lib/planung/zeit.ts` | die einzige Stelle für Wochentag, Woche und Zeitzone |
| `lib/planung/verfuegbarkeit.ts` | Verfügbarkeit als Wert und als JSON-Spalte |
| `lib/planung/schema.ts` | zod-Schemata der Formulare (Phase 3) |
| `lib/planung/berechtigungen.ts`, `lib/planung/aktionen.ts` | die Rechteprüfung (D23) |

Die Tests dazu: `lib/planung/generator.test.ts` (Port von `ScheduleGenerator.test.ts` des
Quell-Repos plus variable Dauer, 10-Minuten-Raster, gesperrte Plätze, Zeitbudget),
`lib/planung/regeln.test.ts`, `lib/planung/repo.test.ts`, `lib/planung/heute.test.ts` und die
Sicherung in `lib/robust.test.ts`.

## Was aus dem Quell-Repo nicht übernommen wurde

- `weekStartDate` im Eingabeobjekt („reserved for future date-based rules“, dort nie benutzt).
- Die zweite Ansicht „published vs. draft“ als getrennte Tabellen: hier unterscheidet nur `status`
  in einer Tabelle.
- Benachrichtigungen beim Veröffentlichen (D25).
- Die REST-Routen (`src/app/api/schedule/*`): hier werden Server Actions daraus.

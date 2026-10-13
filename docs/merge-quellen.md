# Woher der Code kommt — die drei Quell-Repositories

Diese Software entsteht aus drei bestehenden Werkzeugen, die auf demselben
Rechner neben diesem Repository liegen. Alles wird auf den Stack dieses
Repos umgeschrieben (Next.js 16, React 19, SQLite über `better-sqlite3`,
`zod` 4, `node:test`) — nichts wird unverändert übernommen. Der vollständige
Plan samt Begründung steht in [../tommys-merge.md](../tommys-merge.md); dieses
Dokument ist die kurze Antwort auf „woher kommt das eigentlich?“.

Die drei Quellen werden **eingefroren, nicht gelöscht** (D15): je eine
`MERGED.md` darin, danach **schreibgeschützt** — gelesen wird nur, geschrieben
nie. Nur **Artikel Trainer** ist ein Git-Repository mit Remote; dort ist die
`MERGED.md` committet und der Stand mit dem Tag `merged-into-lernheft`
festgehalten. Die beiden anderen Ordner haben **kein `.git`** und ließen sich
deshalb weder committen noch taggen noch archivieren; bei ihnen ist die
`MERGED.md` ein reiner Marker im Dateisystem. **Gepusht und archiviert ist
nichts** — diese Schritte sind remote und brauchen Zugang; die Befehle dafür
stehen ganz unten und sind noch auszuführen.

## Artikel Trainer (Flask)

Eine kleine Flask-App zum Üben von Deutsch-Grammatik: Artikel, Adjektiv­
deklination, Präpositionen, Zeiten, das/dass, Satzbau, dazu ein Auswendig-
Lern-Modus. Wertvoll sind hier die **Inhalte**, nicht die Oberfläche: rund
3 000 Fragen in JSON-Dateien, die es sonst nirgends gibt.

**Übernommen:** die Aufgabenbänke (`categories/articles`, `adjectiv_declension`,
`prepositions`, `past_tense`, `past_perfect_tense`, `das_dass`, `satzbau`) als
`data/banks/*.json`, dedupliziert, schema-geprüft und einmal durch den
KI-Qualitätstest gelaufen — sie werden zu Deutsch-Fähigkeiten (Phase 1). Aus dem
Auswendig-Modus wird die Aufgabenart **Auswendig schreiben** (Phase 2), aus dem
Satzbau-Bankteil die **Schnellrunde**. Die drei Prompts aus `AI_prompts.md`
werden zu Erzeugungs-Prompts für diese Fähigkeiten.

**Verworfen:** `app.py` mit Sitzungen und Klartext-Passwort `admin/start123`,
`database.db`, `logs/`, `init_student_logs.py`, die persönlichen
Auswendig-Dateien (D4 — es werden keine Altdaten migriert), die
Jinja-Vorlagen der Übungen (das Verhalten — eine Aufgabe nach der anderen,
sofortige Rückmeldung — gibt es hier schon). Aus `keyboard_logic.js` bleibt nur
die Idee einer Umlaut-Leiste für Textantworten.

## aufgaben_webseite (Vite + React, Fastify + Postgres)

Ein Arbeitsblatt-Generator für die Volksschule: aus einer Beschreibung wird ein
druckfertiges A4-Blatt gerechnet (Millimeter-Geometrie, Lineaturen,
Schulschriften) und über den Browser gedruckt.

**Übernommen — fast unverändert:** die reine Fachlogik aus `src/domain/`
(Rendering mit Layoutmodell, Lineatur und Geometrie, Inhaltsmodelle,
Silbentrennung und Nomenliste, Blattdefinition mit `zod`), nach `lib/druckblatt/`
(Phase 5). Dazu die Bildschirm-Darstellung als `components/druckblatt/` und die
drei Generatoren **Lesetabelle**, **Satzbaukasten**, **Nachmalblatt** unter
`app/(tutor)/blaetter/`. Aus `ManualExchange.tsx` und
`services/api/src/domain/manual-prompt.ts` wird der **manuelle KI-Modus**
(Phase 6), aus dem Katalog der geplanten Generatoren die Backlog-Liste in
`docs/druckblatt.md`. Die Begründung der Architektur-Entscheidungen 0001, 0009
und 0010 wandert als kurze Notiz in die `docs/`-Dateien.

**Verworfen:** die `teaching/*`-Entities und der Lernplan (D7 — Schüler,
Einheiten und Fähigkeiten gibt es hier schon; der Lernplan wird nicht portiert),
das flüchtige Wochenraster (ersetzt durch den Planer aus dem dritten Repo),
Anmeldung/Konten/Sessions samt `passwort.ts` und `sitzung.ts` (`lib/auth.ts`
deckt das ab), der Archiv-Bereich (geht in **Bibliothek** und **Vorlage** auf),
die KI-Werkstatt mit Layer-, Checks- und Modell-Editor (D8) und die
`i18n`-Schicht (deutsch bleibt deutsch). `AGENTS.md`, `tools/agentboard`, `.githooks`, `transfer_docs`,
`docker/`, `compose*.yaml`, `packages/contracts` und der REST-Teil von
`services/api` entfallen (D13). Schriften fehlen dort ohnehin: es wandert nur
die `public/fonts/README.md` als Anleitung mit, die Dateien kommen später von
Hand dazu.

## tutoring institute platform (Next 14 + Prisma + Postgres)

Ein Nachhilfe-Institut in Software: Schüler- und Lehrerprofile, Übungen mit
Versuchen, ein Microlearning-Widget und vor allem ein **Wochenplaner**, der
Termine aus Verfügbarkeiten, Räumen und Regeln erzeugt.

**Übernommen:** der Planer selbst — `ScheduleGenerator.ts` samt Tests wird zu
`lib/planung/generator.ts` mit variabler **geplanter Dauer** je Schüler statt
fest verdrahteter 100 Minuten, Startzeiten auf dem 10-Minuten-Raster,
gesperrte Plätze als Eingabe (Phase 4). Dazu die Regelverwaltung aus
`SchedulingRulesService.ts` und `config/scheduling-rules.json` (die Regeln
liegen künftig als JSON in `app_settings`), das Scheduling-Repository, die
Prisma-Modelle `Room`, `ScheduledLesson` und die beiden Availability-Overrides
als SQLite-Tabellen, die Oberflächen aus `components/scheduling/*` und
`components/schedule/*` (zu einer Wochenansicht verschmolzen, im Stil von
DESIGN.md) und der A4-Wochenausdruck. Aus
`components/admin/BulkUploadForm.tsx` wird der CSV-Import (Phase 7), aus
`components/microlearning/SatzbauMicroWidget.tsx` nur der **Ablauf** als
**Schnellrunde** (D11, Phase 2). `docs/SCHEDULING-WORKFLOW.md` wird zu
`docs/planung.md`, neu geschrieben auf die hiesigen Entscheidungen D3 und
D17–D25.

**Verworfen:** Nutzerkonten für Schüler, Mock-Auth und `bcryptjs` (Schüler
arbeiten über ihren Link), die Übungs-Entities mit `Assignment*`,
`LearningEvent`, `ExerciseAttempt`, `ProgressCalculator` und
`TeacherDashboardService` (hier gibt es Übungen, Aufgaben, `assignments`,
`attempts` und `lib/analysis.ts`), die Fehlerberichts- und Einstellungsseiten,
das Drag-and-Drop- und Multiple-Choice-Widget (D11), die Prisma-Migrationen,
`backups/*.dump`, `docker-compose.yml`, `.next`, `node_modules` und
`tsconfig.tsbuildinfo` (D4).

## Die lizenzierte Aufgabensammlung — mit Lizenz übernommen

Die lizenzierte Aufgabensammlung liegt als Kopie **außerhalb dieses
Repositories**. Die Inhalte dürfen **nur mit einer
unterschriebenen Lizenz** des Lizenzgebers verwendet werden. Diese Lizenz ist
unterschrieben und liegt **in privater Ablage**
(`C:\Users\niko\Desktop\Lizenzen\lizenzvertrag-2026-10-13.pdf`; digitale Signatur über
DigiSigner, 2026-10-13, je eine Signatur des Lizenzgebers und vom
Lizenznehmer) — das Repository enthält das Dokument **nicht**, sondern nur den
Nachweis darüber in `docs/lizenzen/README.md`.

Damit durfte die Kopie gelesen werden. Phase 9 hat **25 376 Aufgaben** als
Bibliothekseinträge übernommen; jede trägt die Frage-ID des Korpus als
`source_ref`, sodass der Inhalt wieder entfernt werden kann, wenn die Lizenz
endet. Alle Zahlen, Zuordnungen und das bewusst nicht Importierte stehen in
`docs/aufgabensammlung-import.md`. Die Qualitätsprüfung der übernommenen Aufgaben hat
**noch nicht** stattgefunden — ohne Schlüssel läuft sie nicht — und ist in
`docs/aufgabensammlung-pruefung.md` als offen vermerkt.

Ohne diese Lizenz gilt weiterhin: es stammt keine einzige Frage, kein Text, kein
Bild, kein Ton und kein Themenbaum daraus in dieses Repository.

## Einfrieren: was noch aussteht

Das Einfrieren ist bis auf die lokalen Schritte erledigt. Offen sind nur die
remote-Aktionen, die dieses Repository nicht ausführen kann (kein `gh`-CLI, kein
Push-Zugang). Die Befehle für **Artikel Trainer**
(`mc-dream-education/mc-web-app`):

```bash
git -C "C:\Users\niko\Desktop\Artikel Trainer" push origin main
git -C "C:\Users\niko\Desktop\Artikel Trainer" push origin merged-into-lernheft
gh repo archive mc-dream-education/mc-web-app
```

`aufgaben_webseite` und `tutoring institute platform` haben kein Git-Repository.
Für sie gibt es nichts zu pushen und nichts zu archivieren; ihre `MERGED.md`
bleibt als schreibgeschützter Marker liegen.
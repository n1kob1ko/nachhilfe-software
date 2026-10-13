# Tommy's merge — consolidating the tutoring tools into nachhilfe-software

Status: **umgesetzt am 2026-10-13.** Die Phasen 0–9 sind gebaut und in `main`. Dieses Dokument bleibt als Geschichte des Merges stehen (D15): es beschreibt weiterhin den Plan von 2026-10-12, nicht den heutigen Stand im Detail.

**Phase 9 (lizenzierte Aufgabensammlung) ist umgesetzt.** Die unterschriebene Lizenz von Lizenzgeber eG (DigiSigner, 2026-10-13, zwei Signaturen) liegt **in privater Ablage** (`C:\Users\niko\Desktop\Lizenzen\lizenzgeber-eg-lizenzvertrag.pdf`); im Repository steht nur der Nachweis darüber in `docs/lizenzen/README.md`. Damit war der Riegel offen. Der Import hat 25 376 Aufgaben als Bibliothekseinträge angelegt und trägt je Aufgabe die Frage-ID des Korpus als `source_ref` mit, sodass der Inhalt wieder entfernt werden kann, falls die Lizenz endet. Alle Zahlen, Zuordnungen und das bewusst nicht Importierte stehen in [docs/aufgabensammlung-import.md](docs/aufgabensammlung-import.md); die Qualitätsprüfung der importierten Aufgaben hat **noch nicht** stattgefunden (kein Schlüssel) und ist in [docs/aufgabensammlung-pruefung.md](docs/aufgabensammlung-pruefung.md) als offen vermerkt.

**Target:** this repo (`nachhilfe-software`, "Lernheft"). Everything ends up here, on this repo's stack.
**Sources:** `Artikel Trainer`, `aufgaben_webseite`, `tutoring institute platform` (all on the Desktop next to this repo).
**Gated:** `diebstahl/aufgabensammlung` — a scraped copy of aufgabensammlung.de (Lizenzgeber eG). Its content may only be used under a **signed** licence from Lizenzgeber eG. That licence is now signed and recorded in `docs/lizenzen/README.md` (the signed PDF itself is kept out of the repo), so the import in Phase 9 is allowed; without it, **no question, text, image, audio or topic tree from it may enter this repo.**

---

## 1. Target stack (non-negotiable)

Everything that is ported is rewritten to this, nothing else is added:

| Concern | Target | Replaces |
|---|---|---|
| Framework | Next.js 16 App Router, Server Components + Server Actions (`app/*-actions.ts`) | Flask (Artikel Trainer), Vite + React Router + Fastify (aufgaben_webseite), Next 14 + API routes (tutoring platform) |
| UI | React 19, Tailwind CSS 4, tokens from `app/globals.css` / `DESIGN.md`, icons `lucide-react` | Jinja + raw CSS, Tailwind 3, CSS modules |
| State | Server state in SQLite; client state with `useState`/`useReducer` in client components | Zustand, workspace store |
| DB | SQLite via `better-sqlite3`, schema in `lib/db.ts` (`CREATE TABLE IF NOT EXISTS` + `COLUMNS` list for additive changes) | Postgres + Prisma, Postgres + `pg` migrations, Flask sqlite |
| Validation | `zod` 4 | zod 3 (`@werkstatt/contracts`) |
| AI | `lib/ai/router.ts` + providers (`anthropic`, `openai-compatible`) | `services/api` prompt cascade + adapters |
| Auth | `lib/auth.ts` teacher accounts + `proxy.ts`; students via secret link `/lernen/[token]` and device pairing | Flask session + plaintext `admin/start123`, Fastify sessions + argon2, signed-token mock auth + bcrypt |
| Language | German only, strings inline in components | i18next + `de.json` |
| Tests | `node:test` via `tsx --test lib/*.test.ts` | vitest |
| Deploy | existing `Dockerfile` (one process, volume `/data`) | docker compose stacks (web/api/db/ollama), Postgres compose |

Consequences for every port: no new runtime dependency unless named in this plan; vitest tests are rewritten to `node:test` (`import { test } from "node:test"; import assert from "node:assert/strict"`); Prisma `Json` → `TEXT` column with zod parse on read; `cuid` ids → `INTEGER PRIMARY KEY AUTOINCREMENT`; `DateTime` → ISO `TEXT`.

---

## 2. Decisions (from the grilling session)

| # | Decision |
|---|---|
| D1 | Plan is written for Tommy and for AI coding agents: phases with exact paths and a "done when". |
| D2 | Port the full weekly scheduler from the tutoring platform (rooms, availability, weekly overrides, pair rules, draft → published, locked slots, gap scoring). |
| D3 | **geplante Dauer** per planned slot: default 100 min, allowed 1–300. It does not constrain the real Einheit. The real **Dauer** comes from `units` (start → end) as today. Billing uses only the real Dauer. |
| D4 | No migration of old data (no Postgres dump, no Artikel Trainer students/logs/`julia_eng_*.json`). Only content banks are ported. |
| D5 | Students get no accounts. Their schedule is shown behind the existing `/lernen/[token]` link. |
| D6 | Port the print generators (Lesetabelle, Satzbaukasten, Nachmalblatt). Drop i18n — German only. |
| D7 | aufgaben_webseite's Archiv folds into the existing Bibliothek/Vorlagen. The Lernplan board is **not** ported. |
| D8 | AI: keep `lib/ai/router.ts`. Add (a) manual mode (copy prompt / paste answer), (b) local models via the openai-compatible provider (Ollama), (c) a per-student "KI-Hinweise" field. Do not port the 4-level prompt editor or the output-check UI. |
| D9 | Import all Artikel Trainer banks as Deutsch skills, deduplicated, schema-validated and run once through the AI quality test. "memorize" becomes the task type **Auswendig schreiben**. |
| D10 | Noun gender colouring stays, but from DESIGN.md tile colours (m = flieder, f = pfirsich, n = mint) plus a letter marker; never red (red = errors only). |
| D11 | From the tutoring platform's exercises, only the Satzbau micro-widget *flow* is kept, as **Schnellrunde**. Drag-drop, article-gender exercise, text, MC are dropped (covered here). |
| D12 | Create `CONTEXT.md` (glossary) with this repo's terms; "Einheit" never "Stunde" where a tutoring appointment is meant. |
| D13 | Drop agentboard, zones, githooks, `transfer_docs`, `.cursorrules`. Keep the reasoning of ADR 0001/0009/0010 as short notes in `docs/`. |
| D14 | Port bulk upload as a CSV import of students (and teachers), mirroring the CSV export format. |
| D15 | Old repos are archived (tag + README note), not deleted. |
| D16 | Names: "geplante Dauer" (slot) vs "Dauer" (Einheit); Einheit page shows "geplant 100 min · tatsächlich 85 min". |
| D17 | New table `geplante_einheiten`; `lessons` stays the documentation record. Starting an Einheit from today's dashboard links the slot (`unit_id`). A past slot without Einheit is shown as "nicht stattgefunden". |
| D18 | Weekly need per student = `einheiten_pro_woche` × `geplante_dauer`. Exceptions = manually placed, locked slots. |
| D19 | Start times snap to 10 min; end = start + exact geplante Dauer. |
| D20 | New area **"Blätter erstellen"**; the saved result is a **Druckblatt**. Existing `/arbeitsblatt` (A4 print of an Übung) is untouched. |
| D21 | Druckblätter are stored in `materials` (`kind = 'druckblatt'`, new `definition` JSON column). Assigning = copy with `student_id`. |
| D22 | Port rooms (building, name, online/offline), teacher room preferences, student online/offline preference. Under Mehr › Räume. |
| D23 | Admin generates/edits/publishes. Teacher sees own published week and edits own availability. Student availability + weekly overrides: admin and the student's teacher. |
| D24 | "Vorwoche als Entwurf übernehmen" + "Neu generieren" (keeps locked slots). No automatic repetition. |
| D25 | No notifications on publish. |
| D26 | Phase order as in §4. |

---

## 3. Source inventory — what to take, what to drop

### 3.1 Artikel Trainer (Flask)

| Source | Take? | Target / how |
|---|---|---|
| `categories/articles/*.json` (Allgemein 1361, Einfach 793, Grusel 200, Tiere 202, charkteresierung 311; `Technik.json` is **empty**) | Yes | `data/banks/artikel.json`, deduplicated by `word` (2,867 rows → 1,926 distinct). One noun has two articles in different files → resolve by hand. Keep `translation` (en). Topic file name → `tags`. |
| `categories/adjectiv_declension/*.json` (3×100) | Yes | `data/banks/adjektivdeklination.json`. Two gaps (adjective ending + noun ending) → cloze with 2 gaps; `options1/2` → MC options per gap. Note: field `translation` is actually the full German solution sentence → rename `solution`. |
| `categories/prepositions/test.json` (100) | Yes | `data/banks/praepositionen.json`. Drop `noun_color` hex; compute gender colour from the noun (D10). Add `kasus` (Dativ/Akkusativ) — derive by AI pass or by hand. |
| `categories/past_tense/allgemein.json` (100) | Yes | `data/banks/praeteritum.json` → skill Präteritum. Merge with existing Präteritum items in `lib/generators.ts`, dedupe. |
| `categories/past_perfect_tense/test.json` (20) | Yes, **relabel** | It contains **Perfekt** ("hat … gekocht"), not Plusquamperfekt. → `data/banks/perfekt.json`, skill Perfekt. |
| `categories/das_dass/das_dass.json` (339, with explanations) | Yes | Merge into the existing `DAS_DASS` bank (`lib/generators.ts`, skill `deutsch.recht.dasdass`); move the whole bank to `data/banks/das-dass.json`. |
| `categories/satzbau/syntax_sentences.json` (HS/GS parts) | Yes | `data/banks/hauptsatz-gliedsatz.json`; new skill "Hauptsatz und Gliedsatz erkennen". Used by Schnellrunde (Phase 2). |
| `categories/memorize/*.json` | **No** (personal, D4) | Only the *mechanic* is ported → task type Auswendig schreiben (Phase 2). |
| `AI_prompts.md` | Partly | The three prompts become AI generation prompts for these skills in `lib/ai/` (so new items match the bank schema). |
| `templates/exercises/*.html` (articles, adjective, prepositions, past tense, das/dass, satzbau, memorize) | No (UI) | Only behaviour: one item at a time, immediate feedback, running score. Already how student mode works. |
| `static/js/keyboard_logic.js`, `keyboard.css` (on-screen keyboard with ä ö ü ß) | Idea only | Check `components/MathAnswer.tsx` Zeichenleiste; add a German Umlaut bar to text answers if missing. |
| `app.py`, `database.db`, `logs/`, `init_student_logs.py`, users/`lesson_logs` | No | Duplicates of auth/attempts here; plaintext password; personal data. |

### 3.2 aufgaben_webseite (Vite/React + Fastify/Postgres)

| Source | Take? | Target / how |
|---|---|---|
| `src/domain/rendering/*` (layout model, Lineatur, chunk, geometry, handwriting-scripts, sentence/tracing layouts) | **Yes, near 1:1** | `lib/druckblatt/rendering/`. Pure TS, no React. Only import paths change. |
| `src/domain/content/*` (matrix, sentence-box, tracing, word-list) | Yes 1:1 | `lib/druckblatt/content/` |
| `src/domain/language/syllables.ts`, `german-nouns.ts` | Yes 1:1 | `lib/druckblatt/language/`. `german-nouns.ts` is also used by the Artikel bank checks (gender → article). |
| `src/domain/worksheet/*` (types, defaults, constraints, sanitize) | Yes | `lib/druckblatt/definition/`. Replace zod 3 schemas with zod 4. |
| `src/domain/units.ts` (mm units) | Yes | `lib/druckblatt/units.ts`. Careful: name clash with `lib/units.ts` (Einheiten). Keep it inside `lib/druckblatt/` only. |
| `src/domain/teaching/*` (entities, schedule, learning-plan, archive, hierarchy) | **No** | Duplicates of students/units here; Lernplan dropped (D7); schedule replaced by tutoring platform scheduler. |
| `src/renderers/screen/*` (PageView, CellView, PrintPageRule, sentence-box) | Yes, rewrite | `components/druckblatt/`. Remove appearance context indirection where it only served theming; colours/fonts from `globals.css` tokens. Print via browser print (ADR 0001) — same as existing `app/arbeitsblatt/arbeitsblatt.css`; reuse its `@page` rules. |
| `src/features/worksheet-generator`, `sentence-builder`, `letter-tracing` (pages, panels, Zustand stores) | Yes, rewrite | `app/(tutor)/blaetter/lesetabelle`, `…/satzbaukasten`, `…/nachmalblatt` + `components/druckblatt/*Form.tsx`. Zustand slices → one `useReducer` per generator. `t('…')` → German literals. |
| `src/features/worksheet-generator/components/panels/AiSuggestPanel.tsx`, `SentenceAiPanel.tsx` | Yes, rewrite | Call a new server action that uses `lib/ai/router.ts` (new feature key `druckblatt`), not `/api/*`. |
| `src/features/archive/*`, `services/api/src/db/archive-repository.ts`, `domain/archive-slug.ts`, `domain/assign.ts` | Concept only | Save/assign = `materials` row (D21). Tag input → reuse Bibliothek filters. |
| `src/features/students/*`, `LearningPlanBoard.tsx`, `learning-plan-repository.ts`, migration `004_learning_plan.sql` | No (D7) | — |
| `src/features/schedule/*` (week grid, flüchtig) | No | Replaced by Phase 4. |
| `src/features/anmeldung`, `services/api` accounts/sessions, `005_accounts.sql`, `passwort.ts`, `sitzung.ts` | No | `lib/auth.ts` covers this. |
| `src/features/ai-workshop/*` (LayerEditor, ChecksEditor, ModelPicker, ModelProfilesPage, ManualExchange) | Only `ManualExchange` | → Phase 6. |
| `services/api/src/domain/manual-prompt.ts`, `json-extraction.ts`, `adapters/manual.ts` | Yes, rewrite | `lib/ai/providers/manual.ts` + reuse `lib/ai/providers/repair.ts` for JSON extraction. |
| `services/api/src/domain/pseudonyms.ts` | Compare only | This repo already replaces names (`lib/name-detection.ts`). Only take test cases that the current code fails. |
| `services/api/src/domain/prompt-cascade.ts`, `tasks/registry.ts`, `output-checks.ts` | No (D8) | Student layer → "KI-Hinweise" field instead. |
| `src/catalog/*` (tools/generators catalog with planned entries) | Concept only | Planned generators list (Rechenpäckchen, Einmaleins, Zahlenmauern, Vokabelblatt …) → appendix of `docs/druckblatt.md` as backlog. |
| `public/fonts/README.md` | Yes | `public/fonts/README.md`. No font files exist; Druckschrift = system fallback; Grünewald VA + Bienchen SAS (SIL OFL) must be added by hand with their `OFL.txt`; Lateinische Ausgangsschrift has no free version. |
| `CONTEXT.md` | Structure only | → Phase 0 glossary. |
| `docs/decisions/0001, 0009, 0010` | Reasoning only | → `docs/druckblatt.md`, `docs/ki-manuell.md`. |
| `AGENTS.md`, `tools/agentboard`, `.agentboard`, `.githooks`, `TODO.md`, `transfer_docs`, `_to_delete`, `docker/`, `compose*.yaml`, `packages/contracts`, `services/api` (rest) | No (D13) | — |

### 3.3 tutoring institute platform (Next 14 + Prisma/Postgres)

| Source | Take? | Target / how |
|---|---|---|
| `src/lib/services/ScheduleGenerator.ts` (+ `.test.ts`) | **Yes** | `lib/planung/generator.ts`. Pure function; replace hardcoded 100-min lessons with per-student `geplante_dauer` (D3, D18), snap start only (D19). Tests → `lib/planung/generator.test.ts` (node:test). |
| `src/lib/services/SchedulingRulesService.ts`, `config/scheduling-rules.json` | Yes | `lib/planung/regeln.ts`; rules stored in `app_settings` key `planung_regeln` (JSON, zod-validated), not a file. Pair rules reference student ids (INTEGER). |
| `src/lib/db/scheduling.ts` (+ test) | Yes, rewrite | `lib/planung/repo.ts` on `better-sqlite3`. |
| `prisma/schema.prisma` models `Room`, `ScheduledLesson`, `TeacherAvailabilityOverride`, `StudentAvailabilityOverride`, scheduling fields on `User`/`Student` | Yes, rewrite | SQLite tables, see Phase 3/4. |
| `src/components/scheduling/*` (ScheduleGrid, LessonBlock, Sidebar, UnassignedDrawer, WeekSelector, StatsFooter, ManualLessonModal, SchedulingRulesModal, SchedulePageClient) | Yes, restyle | `components/planung/*`. Restyle to DESIGN.md (pills, cards, subject colours). |
| `src/components/schedule/*` (AllSchedulesGrid, MyScheduleView, ViewSchedulesClient, PublishedSchedulesClient, LessonEditModal, OpenResourcesPanel, ScheduleFilter) | Yes, merge | Merge with the above; one week view with filters (teacher/room/student) instead of separate pages. |
| `src/app/api/schedule/*` (generate, publish, reset, lesson, manual-lesson, published, view, my, rules, delete-published) | Yes, rewrite | Server actions in `app/planung-actions.ts`. No REST routes. |
| `src/components/admin/AvailabilityEditor.tsx`, `AvailabilityTimetable.tsx`, `PreferredRoomsEditor.tsx`, `RoomForm.tsx`, `DeleteRoomButton.tsx` | Yes, restyle | `components/planung/Verfuegbarkeit*.tsx`, `components/planung/Raum*.tsx`. |
| `src/app/(dashboard)/dashboard/admin/schedules/print/page.tsx` | Yes | `app/(tutor)/planung/drucken/page.tsx` (A4 week print). |
| `src/components/admin/BulkUploadForm.tsx`, `modules/admin/server-actions.ts` (bulk part) | Yes, rewrite | Phase 7. |
| `src/components/microlearning/SatzbauMicroWidget.tsx` (+ `modules/microlearning-satzbau/*`) | Flow only | Phase 2 Schnellrunde. Its default exercises go into `data/banks/hauptsatz-gliedsatz.json` if not duplicate. |
| `docs/SCHEDULING-WORKFLOW.md` | Yes | → `docs/planung.md`, rewritten for D3/D17–D25. |
| Users/roles, mock auth, `bcryptjs`, Student accounts, `Exercise`/`Assignment*`/`LearningEvent`/`ExerciseAttempt`, `ProgressCalculator`, `TeacherDashboardService`, `ExerciseValidationService`, `components/exercises/*`, `MistakeReportTable`, settings/password page | No | All covered here (worksheets/tasks/assignments/attempts/hint_uses, analysis, auth). |
| `backups/*.dump`, `prisma/migrations`, `docker-compose.yml`, `.next`, `node_modules`, `tsconfig.tsbuildinfo` | No | D4. |

---

## 4. Phases

Each phase is one branch + PR, merged before the next starts. Every phase ends with `npm run typecheck && npm test && npm run build` green. Run the app once (`npm run dev`, demo data) and click through what the phase changed.

### Phase 0 — Glossary and naming

1. Create `CONTEXT.md` (glossary, same format as aufgaben_webseite's: term, definition, `_Avoid_`). Terms this repo already uses win: **Lehrer**, **Schüler**, **Einheit**, **Übung** (worksheet assigned), **Aufgabe** (single task), **Fähigkeit**, **Hausübung**, **Schularbeit**, **Material**, **Vorlage**, **Bibliothek**. New terms from this plan: **geplante Einheit**, **geplante Dauer**, **Dauer**, **Wochenplan**, **Entwurf/veröffentlicht** (Wochenplan), **gesperrt** (slot), **Raum**, **Verfügbarkeit**, **Druckblatt**, **Blätter erstellen**, **Lesetabelle**, **Satzbaukasten**, **Nachmalblatt**, **Lineatur**, **Schulschrift**, **Schnellrunde**, **Auswendig schreiben**, **KI-Hinweise**, **manueller KI-Modus**.
2. Rule in the glossary: "Stunde" only for clock hours. Find user-visible "Stunde/Stunden" that mean an Einheit (`grep -rn "Stunde" app components lib`), e.g. Abrechnung "Nachhilfestunden", README table "Dokumentation jeder Stunde", Dashboard "heutige Stunden" → "Einheiten". Do **not** rename DB identifiers (`lessons`, `kind = 'stunde'`) in this phase; list them in `CONTEXT.md` under "Altlasten im Code".
3. Add `docs/merge-quellen.md`: one paragraph per source repo, link to this plan.

Done when: `CONTEXT.md` exists; no user-visible "Stunde" meaning Einheit remains (grep list attached to PR).

### Phase 1 — Content banks from Artikel Trainer

1. New folder `data/banks/` with one JSON file per bank (list in §3.1) and `lib/banks.ts`: zod 4 schemas per bank type, a loader (read once, cache), and a `bankStats()` for Mehr › Datenqualität.
   - `artikel`: `{ word, article: "der"|"die"|"das", translation?, tags: string[] }`
   - `adjektivdeklination`: `{ prefix, stem, middle, suffix, options1, correct1, options2, correct2, solution }`
   - `praepositionen`: `{ prefix, noun, article: der|die|das (gender of noun), suffix, options, correct, kasus: "Dativ"|"Akkusativ", solution }`
   - `praeteritum` / `perfekt`: existing `ClozeItem` shape in `lib/generators.ts` (convert).
   - `das-dass`: `ClozeItem` + `explanation`.
   - `hauptsatz-gliedsatz`: `{ parts: { text, type: "HS"|"GS" }[] }`.
2. Conversion script `scripts/import-artikel-trainer.ts` (run once, output committed; script stays for reproducibility): reads the Flask JSON from a path argument, normalises, dedupes, writes `data/banks/*.json`, prints a report (counts, duplicates, conflicts, empty files). Merge existing inline banks (`DAS_DASS`, Präteritum/Perfekt items) into the same files and make `lib/generators.ts` read from `lib/banks.ts`.
3. Skills: add to `lib/curriculum.ts` / skills seed under Deutsch: `deutsch.grammatik.artikel` (Artikel bestimmen), `deutsch.grammatik.adjektivdeklination`, `deutsch.grammatik.praepositionen` (Präposition + Kasus), `deutsch.grammatik.praeteritum`, `deutsch.grammatik.perfekt`, `deutsch.satz.hauptsatz-gliedsatz`. Check against existing skill ids first (`deutsch.grammatik.zeiten`, `deutsch.recht.dasdass`) and link as Teilfähigkeit (`parent_id`) where it fits. Set `grade_min/grade_max` sensibly (Artikel 1–6 and DaF, Adjektivdeklination 5–10 …). Map to curriculum nodes via `skill_curriculum` where a RIS node exists.
4. Generators: one generator per skill in `lib/generators.ts` using existing formats only:
   - Artikel → `mc` with options der/die/das; error map "Genus verwechselt (der↔die)".
   - Adjektivdeklination → `cloze` with 2 gaps (`exact` mode).
   - Präpositionen → `cloze`, error map by Kasus ("Dativ statt Akkusativ").
   - Präteritum/Perfekt → existing `bankCloze`.
   - HS/GS → `mc` ("Welcher Teil ist der Gliedsatz?").
5. Gender colouring (D10): helper `genderTone(article)` next to `subjectTone` in `components/Calendar.tsx` (or a new `components/genus.ts`): m = flieder, f = pfirsich, n = mint, always with a small "m/f/n" badge. Used in task rendering where `data.genus` is set. No red.
6. AI generation for these skills: add the three prompts from `AI_prompts.md` as task-specific instructions in `lib/ai/` so AI items use the same shape; validate AI output with the bank zod schema; Artikel items are cross-checked with `german-nouns.ts` only when gender is given (never guessed).
7. Quality pass: run the existing AI quality test (`lib/ai/qualitaetstest.ts`) over all imported items once; write flagged items to `docs/banks-pruefung.md` for manual review. Items stay usable; flagged ones get `review: true` and are skipped by generators until cleared.
8. Tests (`lib/banks.test.ts`): every bank parses; no duplicate key; every generated task accepts its own solution and rejects one wrong option (same pattern as `lib/core.test.ts`).

Done when: the six skills appear in the Übungs-Builder, demo student can practise each, tests green, `docs/banks-pruefung.md` committed.

### Phase 2 — Schnellrunde and Auswendig schreiben

1. **Schnellrunde** (flow from `SatzbauMicroWidget.tsx`): student-mode variant of an Übung for `mc` tasks with ≤ 4 options: one tap, feedback visible ~1.2 s, then next task automatically; intro and outro screen; big tap targets for tablet. Implement as a `mode: "schnell"` on the assignment (new column `assignments.mode TEXT NOT NULL DEFAULT 'normal'` via `COLUMNS`) and a client component `components/StudentQuickRound.tsx` used by `app/lernen/[token]/[aid]/page.tsx`. Attempts, time and hints are stored exactly like normal mode (no separate tracking). Teacher picks "Als Schnellrunde senden" in the builder (step 6) for eligible Übungen.
2. **Auswendig schreiben** (from Artikel Trainer `memorize.html`): new `TaskType` `"memorize"` in `lib/tasks.ts`: `data.passage` = the text; the student first sees the text, then letters are progressively hidden (levels: full → every 3rd word hidden → first letters only → empty) and the student types it; check word by word with the existing diff from `lib/text-correction-diff.ts`. Mistake words are stored in the attempt `error` field (replaces Artikel Trainer's `lesson_logs.error_word`). Add to `CATEGORIES` for Deutsch and Englisch ("Auswendig schreiben", formats `["memorize"]`). Add to `docs/uebungstypen.md`.
3. Umlaut bar: if text answers lack ä ö ü ß Ä Ö Ü input on tablets, add a small bar (pattern of the Zeichenleiste in `MathAnswer.tsx`).
4. Tests: memorize checker (`lib/uebungstypen.test.ts`), quick-round eligibility.

Done when: a teacher can send an Artikel Übung as Schnellrunde and a short text as Auswendig schreiben; both show up in Ergebnis and Analyse like other tasks.

### Phase 3 — Rooms and availability

Schema additions in `lib/db.ts` (new tables + `COLUMNS` entries):

```sql
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  building TEXT NOT NULL DEFAULT 'Hauptgebäude',
  name TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'vor_ort',          -- vor_ort | online
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS availability_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_type TEXT NOT NULL,                       -- teacher | student
  owner_id INTEGER NOT NULL,
  week_start TEXT NOT NULL,                       -- Monday, YYYY-MM-DD
  availability TEXT NOT NULL,                     -- JSON, same shape as below
  UNIQUE(owner_type, owner_id, week_start)
);
```

`COLUMNS`:
- `teachers.availability TEXT` (JSON `{ "1": [{ start, end }], … }`, minutes from midnight, 1 = Monday … 7 = Sunday — **note:** the source uses 0 = Sunday; convert once in `lib/planung/zeit.ts` and use ISO weekday everywhere here)
- `teachers.weekly_target_min INTEGER`
- `teachers.preferred_room_ids TEXT NOT NULL DEFAULT '[]'`
- `students.availability TEXT`
- `students.einheiten_pro_woche INTEGER NOT NULL DEFAULT 0`
- `students.geplante_dauer INTEGER NOT NULL DEFAULT 100` (CHECK 1–300 in the server action, zod)
- `students.modus_wunsch TEXT NOT NULL DEFAULT 'egal'` (vor_ort | online | egal)
- `students.erlaubte_lehrer TEXT NOT NULL DEFAULT '[]'`

UI:
- Mehr › Räume: `app/(tutor)/mehr/raeume/page.tsx` (list, new, edit, deactivate — no hard delete once slots reference a room).
- Lehrer page (`app/(tutor)/lehrer/page.tsx`): availability editor, weekly target, room preferences. Teachers edit their own; admin all (D23).
- Student edit (`app/(tutor)/schueler/[id]/bearbeiten/page.tsx`): new section "Planung": Einheiten pro Woche, geplante Dauer, Modus, erlaubte Lehrer, availability. Editable by admin and the student's teacher (`students.teacher_id`).
- Weekly overrides: on both pages, "Diese Woche abweichend" with a week picker.
- Components ported from `AvailabilityEditor.tsx`, `AvailabilityTimetable.tsx`, `PreferredRoomsEditor.tsx`, `RoomForm.tsx`.

Tests: availability JSON round trip, weekday conversion, permission checks (teacher cannot edit another teacher's availability).

Done when: rooms and availability can be entered and survive a restart; backup/restore (`lib/backup.ts`) includes the new tables (its test covers "every table").

### Phase 4 — Wochenplan (scheduler) and geplante Einheiten

Schema:

```sql
CREATE TABLE IF NOT EXISTS geplante_einheiten (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start TEXT NOT NULL,                 -- Monday YYYY-MM-DD (Europe/Vienna)
  weekday INTEGER NOT NULL,                 -- 1 = Monday … 7 = Sunday
  start_min INTEGER NOT NULL,               -- minutes from midnight, multiple of 10
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
CREATE INDEX IF NOT EXISTS idx_ge_week ON geplante_einheiten(week_start, status);
CREATE INDEX IF NOT EXISTS idx_ge_teacher ON geplante_einheiten(teacher_id, week_start);
CREATE INDEX IF NOT EXISTS idx_ge_student ON geplante_einheiten(student_id, week_start);
```

No DB-level uniqueness on overlaps (variable durations); overlap is checked in `lib/planung/repo.ts` for teacher, student and room on every write.

Logic (`lib/planung/`):
- `generator.ts` — port of `ScheduleGenerator.ts`. Changes: lesson length per student from `geplante_dauer`; demand = `einheiten_pro_woche` slots; start candidates on a 10-min grid inside availability where `start + geplante_dauer` fits; keep all rules from `scheduling-rules.json` (one Einheit per student per day, teacher availability, room preference, no-break rule, pair must/shouldn't, gap penalties, week/weekend distribution); locked slots are inputs, never moved. Pure function, no DB, deterministic with a seed.
- `regeln.ts` — rules schema + defaults (values of the current `config/scheduling-rules.json` without the concrete pair ids) in `app_settings`.
- `repo.ts` — load inputs for a week (availability + overrides), write drafts, publish (entwurf → veroeffentlicht for the week), reset draft, copy previous week as draft (D24), regenerate keeping `locked = 1`.
- `heute.ts` — today's published slots per teacher, for the dashboard.

Linking with Einheiten (D17):
- `lib/units.ts` start: when an Einheit is started for a student, find today's published slot for that student (same teacher preferred, closest start time, `unit_id IS NULL`) and set `unit_id`. If there is none, the Einheit runs unplanned as today.
- Dashboard (`app/(tutor)/page.tsx`, `components/Calendar.tsx` Tagesplan): today's list comes from published `geplante_einheiten` (plus existing `lessons` with status `geplant` until those are retired — decide in Phase 4 review whether `lessons.status = 'geplant'` is still needed; if not, migrate them into `geplante_einheiten` and stop creating them). Each row: "Einheit starten" → starts and links.
- Past published slot with no `unit_id` → shown as "nicht stattgefunden" in the week view and on the student profile. No billing effect.
- Einheit page (`app/(tutor)/einheiten/[id]/page.tsx`): "geplant 100 min · tatsächlich 85 min" when linked (D16). Abrechnung (`lib/billing.ts`) is unchanged and reads only `units`.

UI (`app/(tutor)/planung/`, new nav entry "Planung" between Schüler and Übungen, or under Mehr if the bottom nav must stay at 5 items — check `components/Nav.tsx` mobile layout):
- `page.tsx` — week view, rows = teachers, columns = days, 10-min grid, gap shading, locked badge, draft border; drag & drop with invalid targets dimmed; sidebar teachers/students with "x/y Einheiten geplant"; Unassigned drawer; stats footer; buttons Generieren / Neu generieren / Vorwoche übernehmen / Veröffentlichen / Entwurf verwerfen; filters teacher/room/student. Admin only for editing.
- `drucken/page.tsx` — A4 week print.
- Teacher's own week: tab on the dashboard ("Meine Woche"), read-only, published only.
- Student: card "Deine Termine diese Woche" on `/lernen/[token]` (published only; no other names shown, room name shown, online/vor Ort shown).
- Actions in `app/planung-actions.ts`, all with admin/teacher permission checks via `lib/auth.ts`.

Tests: port `ScheduleGenerator.test.ts` cases + new ones for variable durations, 10-min snap, locked slots kept on regenerate, overlap rejection in repo, unit linking (start links the right slot; second start does not re-link), "nicht stattgefunden" detection, backup includes the table.

Docs: `docs/planung.md` (from `SCHEDULING-WORKFLOW.md`, rewritten).

Done when: admin can generate, adjust, publish a week with demo data (`lib/demo.ts` gets rooms, availability and einheiten_pro_woche for the demo students); starting an Einheit from the dashboard links the slot; billing unchanged.

### Phase 5 — Blätter erstellen (Lesetabelle, Satzbaukasten, Nachmalblatt)

1. Copy pure domain code (§3.2) into `lib/druckblatt/`; fix imports; port its vitest tests to node:test (`lib/druckblatt/*.test.ts`) — the tests come with the domain code and must pass unchanged in substance.
2. Screen renderer → `components/druckblatt/` (PageView, CellView, SentenceBox, TracingView). mm geometry stays inline from the layout model (rule "Geometrie ist Datum"); colours and fonts only from `globals.css` tokens.
3. Pages: `app/(tutor)/blaetter/page.tsx` (overview of the three, plus "geplant" list from the catalog as disabled cards), `…/lesetabelle`, `…/satzbaukasten`, `…/nachmalblatt`, each with settings panels left, live A4 preview right, print button (reuse `components/PrintButton.tsx` and `@page` CSS from `app/arbeitsblatt/arbeitsblatt.css`).
4. State: one reducer per generator (from the Zustand slices). Definition validated with zod 4 (`lib/druckblatt/definition/`).
5. Save (D21): `materials` gets `definition TEXT` (JSON) via `COLUMNS`; `kind = 'druckblatt'`, `file_name/mime/size/sha256/stored_path` set to empty/0 for this kind — or, cleaner, make those columns optional for `kind = 'druckblatt'` in `lib/materials.ts` reads. "Als Vorlage speichern" (no `student_id`) and "Einem Schüler zuweisen" (copy with `student_id`). Opening a saved Druckblatt reloads the definition into the generator.
6. AI suggestions (word lists, sentence columns): server action → `lib/ai/router.ts`, new feature `druckblatt` in `lib/ai/features.ts` (tier fast), output validated with the definition schema; works without AI.
7. Fonts: `public/fonts/README.md` from aufgaben_webseite; `@font-face` for Grünewald VA / Bienchen SAS in `globals.css` guarded so a missing file falls back visibly to Druckschrift with a note (behaviour already in `handwriting-scripts.ts`).
8. Docs: `docs/druckblatt.md` (includes ADR 0001 reasoning: browser print instead of PDF library; backlog of planned generators from `src/catalog/generators.ts`).

Done when: all three generators print correctly on A4 in Chrome and Safari; a Druckblatt can be saved, reopened and assigned; domain tests green.

### Phase 6 — AI additions

1. **Manueller KI-Modus** (ADR 0009, `ManualExchange.tsx`, `manual-prompt.ts`): provider `lib/ai/providers/manual.ts`. When selected (`AI_PROVIDER=manual` or per area, or a toggle on Mehr › KI-Kosten), a call does not go out: the UI shows the full prompt with a copy button and a paste field; the pasted answer runs through the same JSON repair/validation (`providers/repair.ts`) as API answers. No cost logged. Names are replaced before display exactly as before sending (`lib/name-detection.ts`). Supported first for: Übungs-Builder generation, Druckblatt suggestions, Leseverständnis text. Docs: `docs/ki-manuell.md`.
2. **Lokale Modelle (Ollama)**: no code beyond config if `openai-compatible.ts` already accepts a base URL; add `OLLAMA_BASE_URL` example to `.env.example` and `docs/ki-modelle.md`, zero price in `AI_PRICES_JSON` default for `ollama/*`. Verify with `npm run ai:simulate`.
3. **KI-Hinweise per student**: `students.ki_hinweise TEXT NOT NULL DEFAULT ''` via `COLUMNS`; field on the student edit page ("z. B. Legasthenie: kurze Sätze, keine Großbuchstaben-Wörter als Fehler werten"); appended to the system prompt of every student-specific call in `lib/ai/router.ts` (never sent with the student's name). Included in backup and CSV export.
4. Tests: manual provider round trip with a fixture answer; KI-Hinweise appear in the built prompt and never contain the name.

Done when: a full Übungs-Builder generation works in manual mode end to end; KI-Hinweise visibly change a generated Übung.

### Phase 7 — CSV import of students and teachers

1. `app/(tutor)/export/page.tsx` gets an "Import" section (admin only) or a new `app/(tutor)/mehr/import/page.tsx`.
2. Format = the existing CSV export of students (`lib/exports.ts`), semicolon, UTF-8 with or without BOM. Teachers: name, username, admin flag. Students: name, Schultyp, Klasse, Schule, Fächer, Lehrer (username), Einheiten pro Woche, geplante Dauer, Modus.
3. Two steps: upload → preview with per-row errors (zod) and duplicates (same name + Klasse) → confirm. New teachers get `must_change_password = 1` and the start password from `INITIAL_TEACHER_PASSWORD`. Students get a fresh `access_token`.
4. Tests: round trip export → import into an empty DB yields the same students; formula-injection cells stay text.

Done when: the export file of the demo data re-imports cleanly into an empty database.

### Phase 8 — Wrap-up and archive

1. Update `README.md` ("Was die App kann" table: Planung, Blätter erstellen, Schnellrunde, Auswendig schreiben, manueller KI-Modus, Import) and `PRODUCT.md`.
2. Delete this file's "Status: plan" line → "Status: umgesetzt am …", keep the file as history.
3. In each source repo: commit a `MERGED.md` ("Merged into nachhilfe-software on <date>, see tommys-merge.md there; read-only"), tag `merged-into-lernheft`, push, archive on GitHub (`gh repo archive`) where a remote exists (`Artikel Trainer` → `mc-dream-education/mc-web-app`). No deletion (D15). `aufgaben_webseite/.env` and `tutoring institute platform/.env` contain secrets — make sure they are not committed when tagging.
4. The corpus folder (`diebstahl/aufgabensammlung`) stays as is; it is only read by Phase 9.

### Phase 9 — import of the licensed Aufgabensammlung (BLOCKED until licence gate passes)


**Steps:**
1. `scripts/import-aufgabensammlung.ts`: reads the corpus following the corpus' `DATA_ARCHITECTURE.md` (§0 "what to use", §6 reference loader — port to TS): source of truth `raw/api/question/<id>/question.json` → `payload.appJson`; hierarchy from `state/path-tree.jsonl`; dedupe topics by `payload.id`; skip the 96 corrupt files and the 34 self-contradicting questions (DATA_ARCHITECTURE §3.3, §9).
2. Mapping of question types → this repo's `TaskType`: MultipleChoice → `mc`; CorrectWrong → `mc` (richtig/falsch); OrderedChoice → `order`; Associate → new format `match` (only if Phase 1/2 did not add one; otherwise drop); Vocabulary/KnowAWord → `grammar` with the answer as solution where present, else skip; Read → `reading` only with a usable text; Talk, MemorizePoints, ThinkAndReveal, CycleEnd, Sortable, MultiSelect → skip in the first import (report counts).
3. Mapping of school system: grundschule → VS (Klasse 1–4); hauptschule/realschule/gesamtschule Klasse 5–8 → MS 1–4; gymnasium Klasse 5–12 → Gymnasium 1–8; ausbildung/studium/daf → skip or tag only. Subjects: only Mathematik, Deutsch, Englisch in the first import (the subjects this app has); others reported, not imported. German → Austrian terms on import (Komma → Beistrich in rules texts, Klassenarbeit → Schularbeit, Hausaufgabe → Hausübung, Sachunterricht → Sachunterricht stays) via a replacement table in the script, reviewed by hand.
4. Target: tasks go into the existing Bibliothek as **Vorlagen** (`worksheets` with `status = 'vorlage'`, or the library tables used by `lib/library.ts`), one Vorlage per leaf topic, skills mapped via topic name → `skills` (unmapped topics get a new skill under the subject, flagged for review). Strip all source branding, URLs and HTML (stem is an HTML fragment); store a hidden `source_ref` (question id) per task for licence tracing and for removing content if Anlage 1 changes.
5. Media: only files actually stored in the mirror; no hotlinking to `node.aufgabensammlung.de`. Tasks whose media is missing are skipped.
6. Quality pass as in Phase 1 step 7 (sample-based: AI quality test on a stratified sample of 2,000, full run only for tasks that are assigned).
7. Tests: loader on fixtures copied from 20 real question files (all types), mapping table coverage, branding stripper (no "aufgabensammlung"/"Lizenzgeber" string survives), `source_ref` present on every imported task.

Done when:  the import report is committed as `docs/aufgabensammlung-import.md`, and imported Vorlagen are usable in the Übungs-Builder.

---

## 5. Duplicate map (one owner per feature after the merge)

| Feature | Exists in | Survives | Removed |
|---|---|---|---|
| Teacher login / sessions | all four | `lib/auth.ts` | Flask session, Fastify sessions, signed-token mock |
| Student access | link here, accounts in tutoring platform | `/lernen/[token]` + devices | student accounts |
| Students & teachers CRUD | here, tutoring platform, aufgaben_webseite (mock) | here (+ Phase 3 fields) | others |
| Exercises / tasks / assignments | here, tutoring platform, Artikel Trainer pages | `worksheets/tasks/assignments` | `Exercise/Assignment*`, Flask exercise pages |
| Attempt tracking / analytics | here, tutoring platform (`LearningEvent`), Artikel Trainer (txt logs) | `attempts`, `hint_uses`, `lib/analysis.ts` | others |
| Article gender | Artikel Trainer, tutoring platform `ARTICLE_GENDER`, `german-nouns.ts` | bank + `mc` generator (Phase 1); `german-nouns.ts` as checker | tutoring platform component, Flask page |
| das/dass | here (small bank), Artikel Trainer (339) | merged bank | Flask page |
| Satzbau | Artikel Trainer HS/GS, tutoring platform micro-widget, aufgaben_webseite Satzbaukasten | HS/GS bank + Schnellrunde; Satzbaukasten as Druckblatt (different thing: print sheet) | Flask page, widget component |
| Weekly schedule | tutoring platform (generator), aufgaben_webseite (flüchtig grid), here (`lessons` geplant) | `geplante_einheiten` + `lib/planung` | aufgaben_webseite schedule; `lessons` geplant reviewed in Phase 4 |
| Templates / archive | here (Vorlagen, Bibliothek, materials), aufgaben_webseite (Archiv) | here | Archiv |
| AI layer | here (router), aufgaben_webseite (cascade + adapters) | router + manual provider + KI-Hinweise | cascade, model-profile UI, output-check UI |
| Glossary | aufgaben_webseite `CONTEXT.md` | new `CONTEXT.md` here | — |
| Deploy | Dockerfile here, compose stacks there | Dockerfile here | compose, nginx, Ollama container |

---

## 6. Risks and checks

- **Bank quality:** all imported items were AI-written and never reviewed. Phase 1 step 7 is mandatory before Übungen with these skills are assigned.
- **Weekday convention:** source uses 0 = Sunday; this repo uses ISO 1 = Monday. Single conversion point `lib/planung/zeit.ts`; a test pins it.
- **Time zone:** week start and today's slots are computed in Europe/Vienna (DST changes in March/October). Store local date + minutes, never UTC timestamps, for planned slots.
- **Single process:** scheduler generation is synchronous CPU work; cap runtime (e.g. 2 s budget, return best so far) so it does not block the whiteboard SSE connections.
- **Backup:** every new table/column must appear in `lib/backup.ts` restore test and, where useful, in `lib/exports.ts`.
- **Permissions:** every new server action checks the teacher via `lib/auth.ts`; admin-only actions check `is_admin`.
- **Secrets:** source repos contain `.env` files and a hardcoded Flask secret/password; nothing from them is copied.
- **Copyright:** the scraped `diebstahl/aufgabensammlung` copy only after the Phase 9 licence gate (signed, signer authorised, recorded in `docs/lizenzen/README.md`). Fonts only under SIL OFL with licence file.

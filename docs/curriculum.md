# Lehrplan- und Fähigkeiten-Datenbank

Grundlage für Schülerprofile, Lernstand, automatisches Tracking, Übungserstellung, KI-Aufgaben,
Schularbeitsvorbereitung und Empfehlungen. Gebaut als Erweiterung der bestehenden Tabellen, nicht
als zweites System daneben.

## Stand der Daten (ehrlich)

| Quelle | Fassung | Dokument | in Kraft |
|---|---|---|---|
| RIS Volksschule, Anlage A | BGBl. Nr. 134/1963 idF BGBl. II Nr. 178/2025 | NOR40271469 | 01.09.2025 |
| RIS Mittelschule, Anlage 1 | BGBl. II Nr. 185/2012 idF BGBl. II Nr. 178/2025 | NOR40271471 | 01.09.2025 |
| RIS AHS, Anlage A | BGBl. Nr. 88/1985 idF BGBl. II Nr. 204/2024 | NOR40264238 | 01.09.2026 |
| RIS HTL, Anlage 1 | BGBl. II Nr. 262/2015 idF BGBl. II Nr. 383/2021 | NOR40237785 | 04.09.2021 |
| RIS HAK, Anlage A1 | BGBl. Nr. 895/1994 idF BGBl. II Nr. 250/2021 | NOR40234935 | 01.09.2021 |

| Was | Status |
|---|---|
| Wortlaut der Lehrpläne Deutsch, Englisch (Lebende Fremdsprache), Mathematik für VS, MS, AHS (Unter- und Oberstufe), HTL, HAK | **importierbar**: 15 Pakete `curriculum/ris-*.json`, aus den RIS-PDFs von niko (06.10.2026) |
| Verknüpfung Lehrplan-Eintrag ↔ Fähigkeit (`scripts/lehrplan_mapping.json`) | **eigene didaktische Zuordnung**, nicht Teil des Lehrplans |
| IQS (Kompetenzmodelle, iKM PLUS, Aufgabenpools) | nur als **Referenz** eingetragen, Inhalte werden nie übernommen |
| Fähigkeiten Mathematik, Deutsch, Englisch (Schulstufe 3–13) | **eigene Struktur** von Lernheft (Quelle „Lernheft – eigene Inhalte“) |
| Paket „Volksschule Mathematik und Deutsch“ (45 Fähigkeiten) | **eigene Struktur**, nicht der Lehrplantext |
| Paket „DEMO – Beispiel-Lehrplan“ | **erfundene Demo-Daten**, überall mit „DEMO“ gekennzeichnet, mit einem Klick wieder entfernbar |
| Voraussetzungen zwischen Fähigkeiten (`PREREQUISITES`) | eigene didaktische Entscheidung |

### Lehrplantext: wie er entsteht

`scripts/lehrplan_import.py` liest die Textfassungen der RIS-PDFs (VS, MS, AHS: RIS-Textexport;
HTL: `pdftotext -layout`; HAK: RIS-Textexport mit gesperrt gesetzten Überschriften) und schreibt die Pakete:

```
python3 scripts/lehrplan_import.py --vs vs.txt --ms ms.txt --ahs ahs.txt --htl htl-layout.txt --hak hak.txt [--dry]
```

- Bereinigt werden nur Seitenköpfe, Zeilenumbrüche, Silbentrennung und Fußnotenziffern; sonst
  bleibt der Wortlaut unverändert. Jeder Aufzählungspunkt der Quelle wird ein Eintrag (geprüft:
  Anzahl der Spiegelstriche je Abschnitt = Anzahl der Einträge).
- Gliederung: Fach › Klasse/Schulstufe/Jahrgang › (Semester) › Kompetenzbereich bzw. Thema ›
  Kompetenz › Inhalt (Präzisierung MS/AHS Mathematik) bzw. Anwendungsbereich, HTL: Lehrstoff.
- Codes sind stabil (z. B. `MS-MAT-2-B1-K3-I2`); ein neuer Lauf mit einer neuen Fassung ergibt
  beim Import eine Vorschau mit geänderten Einträgen.
- Grenzen: Formeln aus dem PDF-Text (Hochzahlen, Brüche, Summen) sind teils verstümmelt, z. B.
  „zB 3 4 von a“ statt ¾ von a. Im Zweifel gilt der Originaltext; jede Ansicht verlinkt das RIS.
- HAK: Überschriften wie „B e r e ic h Zu h ö r e n“ werden mit den Wörtern desselben Dokuments
  wieder zu Wörtern zusammengesetzt (Liste aller Fälle beim Bau geprüft). Ein Spiegelstrich, der im
  PDF mit der Sperrung verloren ging (II. Jahrgang Mathematik, „Sinus, Cosinus und Tangens …“),
  wird wieder als Kompetenz geführt. Lehrstoff-Absätze bleiben als Absätze erhalten.
- Volksschul-Verknüpfungen zeigen auf Fähigkeiten aus „Volksschule Mathematik und Deutsch“. Fehlen
  sie, werden sie übersprungen (Warnung) und können später per erneutem Import nachgetragen werden.
  Die Sammel-Vorschau importiert die eigene Struktur deshalb zuerst.

Ansicht: Mehr › Lehrplan › Übersicht › Fach-Chip → `/mehr/lehrplan/<key>`, je Klasse aufklappbar,
verknüpfte Fähigkeiten als Chips (öffnen den Übungs-Builder).

## Schulsystem

Anzeige wie gewohnt: „2. Klasse Mittelschule“. Intern zählt die Schulstufe 1–13
(`lib/school.ts`): VS 1–4 → 1–4, MS 1–4 und AHS 1–8 → 5–12, HTL/HAK 1–5 → 9–13.
`students.grade` ist die Schulstufe, `school_type` + `klasse` die Anzeige. `checkLevel()`
prüft, ob alles zusammenpasst; sonst steht `students.stufe_status = 'unklar'`, das Profil zeigt
„Schulstufe unklar“, und die Fähigkeiten werden nicht eingegrenzt (lieber alle als falsche).

## Tabellen (Migration in `lib/db.ts`)

Neu:

- `content_sources`: Quellenregister (key, name, source_type lehrplan|eigen|ki|oer|referenz|demo,
  url, author, publisher, license, license_url, attribution_text, commercial_use_allowed,
  derivatives_allowed, share_alike_required, copy_allowed, retrieved_at, modified, content_hash, notes)
- `source_items`: einzelne übernommene Elemente einer Quelle (item_id, item_url, Lizenz, Hash)
- `curricula`: eine Lehrplan-Fassung (country AT, name, school_type, subject, version, reference, valid_from/to)
- `curriculum_nodes`: Kompetenzbereich › Thema › Unterthema mit Wortlaut (`text`), Klasse, Schulstufe,
  competency/content/action_area, reference; stabiler `code` je Lehrplan
- `skill_curriculum`: welche Lehrplan-Einträge eine Fähigkeit abdeckt
- `skill_links`: `voraussetzung` und `weiter` zwischen Fähigkeiten
- `curriculum_imports`: jede Import-Vorschau mit Diff, Status vorschau → importiert / verworfen
- `skill_history`: frühere Fassung einer Fähigkeit vor einer Änderung durch einen Import
- `app_settings`: z. B. Erinnerungsschwellen

Erweitert (nur neue Spalten, nichts gelöscht):

- `skills`: code (stabil, z. B. `AT-MAT-05-BRUCHRECHNUNG-DIVIDIEREN`), subtopic, school_types,
  learning_objective, description, competency_area, content_area, action_area, source_id, version,
  valid_from, valid_to, status
- `students`: stufe_status
- `tasks`: source_type, source_id, source_item_id, level (1–5), solution_steps, estimated_time_sec
- `attempts`: teacher_id, level
- `tests`: title, topics, status (geplant|geschrieben|abgesagt), teacher_id, created_at

Hierarchie: Land (AT) → Schulart (`curricula.school_type`) → Klasse/Schulstufe → Fach →
Kompetenzbereich → Thema (`skills.area`) → Unterthema (`subtopic`) → Fähigkeit → Teilfähigkeit
(`parent_id`) → Lernziel (`learning_objective`). Fähigkeiten gelten schulartübergreifend nach
Schulstufe; `school_types` schränkt bei Bedarf ein (z. B. nur Volksschule).

## Import

Kein Scraper. Pakete sind JSON-Dateien im Ordner `curriculum/` oder werden unter
Mehr › Lehrplan › Importe hochgeladen (nur Verwaltung).

```json
{
  "format": "lernheft-curriculum/1",
  "label": "…",
  "source": { "key": "ris-ms", "name": "…", "source_type": "lehrplan", "url": "https://www.ris.bka.gv.at/…", "license": "amtliches Werk (§ 7 UrhG)" },
  "curriculum": { "key": "ris-ms-mathematik-2025", "name": "…", "school_type": "Mittelschule", "subject": "Mathematik", "version": "BGBl. II Nr. 178/2025", "valid_from": "2025-09-01" },
  "nodes": [{ "code": "MS-MAT-K2-…", "parent": "…", "kind": "kompetenzbereich|thema|…", "name": "…", "text": "Wortlaut", "klasse": 2, "schulstufe": 6 }],
  "skills": [{ "id": "mathe.thema.faehigkeit", "subject": "Mathematik", "area": "Thema", "name": "…", "grade_min": 6, "grade_max": 6, "nodes": ["MS-MAT-K2-…"], "prerequisites": ["…"], "next": ["…"] }],
  "skill_nodes": [["mathe.brueche.kuerzen", "MS-MAT-K2-…"]]
}
```

Ablauf (`lib/curriculum-import.ts`): Validierung → Vergleich mit der Datenbank → Vorschau
(„Neue Themen 10 · Neue Fähigkeiten 45 · Geänderte 0 · Dubletten · Konflikte …“) → erst nach
„Importieren“ wird in einer Transaktion geschrieben. Regeln:

- gleiche Fähigkeit unter anderer ID (Fach + Thema + Name + Elternfähigkeit) → Dublette, übersprungen
- Fähigkeit einer anderen Quelle → Konflikt, nie überschrieben
- Änderung → alte Fassung in `skill_history`
- identisches Paket (content_hash) → „schon importiert“, außer es kommen inzwischen neue Verknüpfungen dazu
- „Vorschau für alle offenen“ erstellt mehrere Vorschauen auf einmal; „Alle importieren“ wendet sie in Reihenfolge an
- Referenzquellen werden abgelehnt; nichts wird gelöscht (außer „Demo-Daten entfernen“)

## Seite „Fähigkeiten“

Eine Ebene nach der anderen: Fach › Schulart › Klasse/Jahrgang › Thema › Fähigkeiten, gesteuert über
`?fach=&schulart=&klasse=&thema=` (Server-Komponente, kein Client-State). Oben steht der Pfad, jede
Ebene ist anklickbar.

- Die Schularten stehen in `SCHOOL_BRANCHES` (`lib/school.ts`): wie `SCHOOL_TYPES`, aber das
  Gymnasium ist in AHS Unterstufe (1.–4.) und AHS Oberstufe (5.–8.) geteilt. HTL und HAK zählen in
  Jahrgängen (`klasseLabel`).
- Gefiltert wird mit den Daten, die es schon gibt: `browseSkills()` (`lib/lehrplan.ts`) prüft
  `skills.school_types` und die Schulstufe (`grade_min`/`grade_max`) gegen die Klasse der Schulart.
  Keine zweite Zuordnungstabelle, keine Dubletten: eine Fähigkeit erscheint in jeder Klasse, die ihr
  Bereich abdeckt, und je Ansicht genau einmal.
- Leere Ebenen werden weggelassen: nur Schularten, Klassen und Themen mit Fähigkeiten.
- Auf der Themen- und Fähigkeitsebene führt ein Link zum Lehrplan derselben Klasse
  (`curriculumFor()`), sofern der Lehrplantext importiert ist.
- Fähigkeit antippen → Übungs-Builder. IDs, Lehrplan-Verknüpfungen und Tracking bleiben unberührt.

## Datenqualität (eigene Korrekturen, `lib/datenqualitaet.ts`)

Offizielle Daten werden nie überschrieben: Die Tabellen `skills`, `curricula` und `curriculum_nodes`
schreibt nur der Import. Eigene Korrekturen liegen getrennt und lassen sich zurücksetzen:

- `skill_overrides`: Thema, Unterthema, Schulstufen, „in der Praxis oft früher/später“, Notiz,
  `merged_into`. Gespeichert wird nur, was vom Original abweicht; `SKILL_SELECT` legt es beim Lesen
  darüber. Eine Zeile ohne Abweichung wird gelöscht.
- `skill_curriculum`: Entfernen setzt `removed_at` (die Zeile bleibt, ein neuer Import mit
  `INSERT OR IGNORE` bringt sie nicht zurück); eigene Verknüpfungen haben `origin = 'lehrer'`.
- `skill_links`: Voraussetzungen nur über `addPrerequisite`/`removePrerequisite` (Kreisprüfung).
- `skill_history` mit `kind = 'korrektur'`: jede Korrektur mit vorherigem Zustand
  (`before` = `{ action, previous, detail }`) und Lehrer.

Mehr › Datenqualität: Dubletten (gleicher Name im selben Fach, Groß-/Kleinschreibung, Umlaute und
Satzzeichen egal; optional auch in anderen Themen), eigene Korrekturen mit „Zurücksetzen“,
Fähigkeiten in ein anderes Thema verschieben (Teilfähigkeiten im selben Thema wandern mit), die
Lernstand-Einstellung für Flüchtigkeitsfehler und die letzten Korrekturen. Auf der Seite einer
Fähigkeit: Einordnung, Lehrplan-Verknüpfungen, Voraussetzungen und Zusammenführen.

Zusammenführen ist immer eine Entscheidung der Lehrkraft, die App schlägt nur Paare vor. Die
Dublette verschwindet aus den Listen, ihre Antworten zählen über `skillAliases()` für die bleibende
Fähigkeit. Regeln gegen Ketten und Kreise: nicht in sich selbst, nur im selben Fach, nicht in eine
schon zusammengeführte Fähigkeit, nicht wenn schon andere in die Dublette zusammengeführt sind, und
erst wenn ihre Teilfähigkeiten zusammengeführt sind. Ihre aktiven Voraussetzungen (in beide
Richtungen) und Lehrplan-Verknüpfungen werden mit `origin = 'lehrer'` übernommen; Kreise,
vorhandene und von der Lehrkraft entfernte Verknüpfungen werden übersprungen. Rückgängig hebt nur die
Zusammenführung auf; übernommene Verknüpfungen bleiben sichtbar und entfernbar.

## Lizenzen (`lib/lehrplan.ts`)

`licenseTerms()` liest CC-Kurznamen, `taskBankAllowed()` entscheidet:

- erlaubt: CC0, CC BY, CC BY-SA (SA: Bearbeitungen unter gleicher Lizenz), eigene Inhalte,
  geprüfte KI-Aufgaben, amtliche Werke
- nie automatisch: NC, ND, unbekannte Lizenz
- nur Referenz: IQS, Matura, Schulbücher (copy_allowed = 0)

Jede Aufgabe trägt `source_type` und `source_id`; KI-Aufgaben zeigen auf die Quelle „KI-generiert
(Claude)“, generierte auf „Lernheft – eigene Inhalte“.

## Aufgaben ↔ Fähigkeiten

`tasks.skill_id` (Hauptfähigkeit) plus `task_skills` (alle). Eine Antwort zählt für die Fähigkeit
und ihre Elternfähigkeiten. Jede Antwort speichert Schüler, Lehrer, Einheit, Übung, Aufgabe,
Fähigkeit, Schwierigkeit 1–5, Zeit, Antwort, richtig, Versuch, Hilfen, Lösung angesehen, Fehlerart.
Empirische Schwierigkeit: `taskStats()` (Erfolgsquote, Median-Zeit, Hilfequote; ab 30 Antworten
ein Vorschlag 1–5, wird nicht automatisch übernommen).

## Lernstand

Siehe [lernstand.md](lernstand.md) und `lib/mastery.ts`.

## Prüfungen, Erinnerungen, Empfehlungen

- Schnelleintrag im Schülerprofil › Prüfungen: Art, Fach, Datum, Stoff. Zum Stoff erscheinen
  passende Fähigkeiten zum Antippen (`matchSkills`); verknüpft wird nur, was angehakt wird.
- Erinnerungen (`lib/exams.ts`): ≤ 14 Tage „Vorbereitung beginnen“, ≤ 7 „Vorbereitung wichtig“,
  ≤ 3 „Prüfung bald“; einstellbar unter Mehr › Lehrplan › Einstellungen. Nur in der App:
  Startseite (eigene Schüler) und Profil.
- „Vorbereitung starten“: Tage bis zur Prüfung, Stoff, Lernstand je Fähigkeit, nicht getestete
  Fähigkeiten, Plan nach Regeln (unsichere Voraussetzungen je 3, dann kritisch 5, üben 4, nicht
  getestet 3, gut 2, sicher 1) und „Übung erstellen“ mit vorbelegten Fähigkeiten.
- Empfehlungen (`lib/recommend.ts`), Reihenfolge: 1. Prüfungsstoff mit niedrigem Lernstand,
  2. unsichere Voraussetzungen, 3. häufige Fehler der letzten 14 Tage, 4. seit 30 Tagen nicht
  geübt, 5. nächste sinnvolle Fähigkeit.

## KI

Nur die Aufgabenerstellung, die Bewertung von Freitext-Antworten und die optionale
KI-Einschätzung nutzen Claude. An die KI gehen nur Lerndaten (`aiStudentData()` in
`lib/builder.ts`): Schulart, Klasse, Schulstufe, Fach, Thema, skill_id, Lernstand, Status,
typische Fehler, Tage bis zur Prüfung, Prüfungsstoff. Keine Namen, keine Freitext-Notizen aus dem
Profil. Die KI liefert zusätzlich `solution_steps` und `estimated_time_sec`.
Alles andere (Lernstand, Erinnerungen, Plan, Empfehlungen, Import, Lizenzen, Zuordnung) läuft ohne KI.

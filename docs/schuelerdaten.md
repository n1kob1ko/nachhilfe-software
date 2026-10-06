# Arbeiten mit echten Schülerdaten

Was die App seit dem Ausbau „Schülerdaten“ zusätzlich kann, wo es liegt und wie es rechnet.
Alles Messbare läuft ohne KI. Claude kommt nur dort vor, wo es unten ausdrücklich steht.

## Wo im Programm

| Funktion | Ort |
| --- | --- |
| Aktueller Stoff | Schülerprofil › Tab „Aktueller Stoff“, kurz in der Übersicht und auf der Startseite |
| Empfehlung „Was als Nächstes?“ | Schülerprofil (Übersicht und Lernstand), Startseite, Übungs-Builder |
| Voraussetzungen | Mehr › Themen und Fähigkeiten › eine Fähigkeit |
| Fehlerarten | Ergebnis einer Übung (pro falscher Antwort), Lernstand, Lernverlauf |
| Diagnose | Mehr › Diagnose, Ergebnis unter Schülerprofil › Lernstand |
| Aufgabenbibliothek | Übungen › Bibliothek, Mehr › Aufgabenbibliothek |
| Material | Mehr › Material |
| Zusammenfassung nach der Einheit | Abschluss einer Einheit und ihre Dokumentation |
| Statistik | Mehr › Statistik |
| Datenqualität | Mehr › Datenqualität |

Die Hauptnavigation bleibt bei fünf Punkten.

## Datenmodell

Bestehende Tabellen wurden erweitert, wo das sauber ging; neue Tabellen gibt es nur für neue Dinge.
Alle Migrationen laufen beim Start in `lib/db.ts` (neue Spalten mit Standardwerten, nichts wird gelöscht).

Neue Tabellen:

- `current_material`: aktueller Stoff pro Schüler und Fach (Thema, Unterthema, Fähigkeiten, seit,
  Priorität, Notiz, Quelle). Pro Fach höchstens ein aktiver Eintrag; ersetzte bleiben mit `ended_at`
  als Verlauf.
- `materials`: hochgeladene Fotos und PDFs mit Einordnung, Status, Herkunft (`source_id` →
  `content_sources`) und optionalem Erkennungsvorschlag (`analysis`, nur Vorschlag).
- `skill_overrides`: eigene Korrekturen einer Fähigkeit (Thema, Unterthema, Schulstufen, „in der Praxis
  früher/später“, Zusammenführung). Die Fähigkeit selbst und alle Lehrplandaten bleiben unverändert.
- `app_settings`: kleine Einstellungen (z. B. ob Flüchtigkeitsfehler milder zählen).

Neue Spalten:

- `attempts.error_type`, `error_type_source` (vorschlag | lehrer | ki), `error_type_suggested`,
  `error_type_suggested_source`, `error_type_by`, `error_type_at`: Fehlerart einer falschen Antwort,
  nachvollziehbar (auch was App oder Claude ursprünglich vorgeschlagen hatten).
- `skill_links.origin` (app | import | lehrer), `removed_at`, `changed_by`: Voraussetzungen mit
  Herkunft; entfernte Standard-Verknüpfungen bleiben entfernt.
- `skill_curriculum.origin`, `removed_at`, `changed_by`: eigene Korrekturen der Lehrplan-Verknüpfung.
- `skill_history.kind`, `teacher_id`: Korrekturen erscheinen in der Änderungsgeschichte.
- `worksheets.tags` und die Art `bibliothek` bzw. `diagnose` in `worksheets.kind`.
- `lessons.family_note`, `family_note_source`: Notiz für Eltern oder Schüler nach einer Einheit.

Diagnose, Bibliothek und Material nutzen die vorhandenen Tabellen `worksheets`, `tasks`,
`assignments`, `attempts`, `content_sources` und `source_items`. Es gibt keine zweite Tracking-Tabelle.

## Aktueller Stoff

Der offizielle Lehrplan bleibt, wie er ist. Der aktuelle Stoff ist eine Schicht pro Schüler darüber:
Fach, Thema, Unterthema, passende Fähigkeiten (zum Antippen vorgeschlagen, nie automatisch
verknüpft), seit wann, Priorität, Notiz und Quelle (Unterricht, Hausübung, Test, Schularbeit, eigene
Einschätzung). Im Profil steht kurz „Aktuell in Mathematik: Gleichungen mit Klammern“. Der Übungs-Builder
wählt den aktuellen Stoff vor.

## Empfehlung

Eine einzige Funktion, `nextSteps()` in `lib/recommend.ts`, regelbasiert und ohne KI. Reihenfolge:

1. bevorstehender Test oder Schularbeit
2. aktueller Stoff
3. schwache Fähigkeiten (mit schwacher Voraussetzung als möglicher Ursache)
4. wiederholte Fehler (gleiche Fehlerart oder gleicher Fehler)
5. notwendige Voraussetzungen
6. lange nicht geübte oder zuletzt gefallene Fähigkeiten
7. nächster sinnvoller Schritt im Thema

Jede Empfehlung nennt ihre Gründe, z. B. „Schularbeit in 8 Tagen · Lernstand 54 % · 3 Fehler zuletzt“,
und hat den Knopf „Übung erstellen“. Nach einer erledigten Übung schlägt sie eine kurze Überprüfung vor.

## Voraussetzungen

Eine Fähigkeit kann Voraussetzungen haben („Brüche dividieren braucht Kürzen, Multiplizieren, Kehrwert“).
Die App legt keine neuen Beziehungen selbst an: es gibt nur die mitgelieferten, die importierten und
die vom Lehrer gesetzten, jede mit Herkunft. Jede ist bei der Fähigkeit hinzufügbar und entfernbar.
Ist ein Schüler bei einer Fähigkeit schwach, prüft die Empfehlung, ob eine Voraussetzung schwach ist,
und nennt sie als mögliche Ursache.

## Fehlerarten

Rechenfehler, Vorzeichenfehler, Regel nicht verstanden, Flüchtigkeitsfehler, Aufgabe falsch gelesen,
falsche Formel, Einheitenfehler, Grammatikfehler, Rechtschreibfehler, Wortschatzproblem, unbekannt.

- Die App schlägt eine Fehlerart nur vor, wenn eine klare Regel passt (bekannter Fehler der Aufgabe,
  Vorzeichen, Einheit nur wenn eine Einheit vorkommt, vertauschte Ziffern; in Deutsch und Englisch
  Tippfehler oder falsche Endung). Zahlen bekommen nie eine Sprach-Kategorie, Sprachregeln gelten
  nur in Sprachfächern. Lieber kein Vorschlag als ein falscher.
- Freitext bewertet Claude (nur, wenn ein KI-Schlüssel hinterlegt ist); seine Fehlerart gilt als „KI“.
- Der Lehrer setzt oder ändert sie pro Antwort. Gespeichert werden Fehlerart, Quelle, der ursprüngliche
  Vorschlag (von der App oder von Claude), wer und wann. Der Export „Ergebnisse“ enthält Fehler,
  Fehlerart, Quelle und Vorschlag; Lernverlauf und Dokumentation der Einheit zeigen die Fehlerarten.
- Fehlerarten erscheinen im Lernstand, zählen für die Empfehlung (Regel 4), und auf Wunsch zählt ein
  Flüchtigkeitsfehler im Lernstand milder. Die Statistik wertet sie aus.

## Diagnose

Mehr › Diagnose: Schüler → Fach → Schulart/Klasse → ein oder mehrere Themen → Diagnose starten.
Die App stellt 5 bis 10 Aufgaben zusammen, von leicht bis schwer, über die Fähigkeiten der Themen
verteilt. Zuerst passen Aufgaben aus der Bibliothek, dann die eingebauten Generatoren; Claude nur auf
Wunsch und nur für Fähigkeiten ohne Generator. Die Diagnose ist eine normale Übung der Art
`diagnose`: die Antworten landen im normalen Tracking und sind darüber als Diagnose erkennbar.

Ergebnis je Fähigkeit (schwere Aufgaben zählen mehr): sicher (ab 75 %), unsicher, kritisch (unter
35 %), noch offen. Dazu mögliche Wissenslücken (schwache oder ungeprüfte Voraussetzungen der
unsicheren und kritischen Fähigkeiten) und die empfohlenen nächsten Übungen.

## Aufgabenbibliothek

Gute Aufgaben werden gespeichert und wiederverwendet: speichern (aus jeder Übung „In Bibliothek“),
bearbeiten, duplizieren, löschen, Tags, Fach, Schulart, Klasse, Thema, Fähigkeit, Schwierigkeit,
Aufgabentyp, Herkunft (eigene, KI-generiert, importiert) mit Quelle und Lizenz. Suche über
Aufgabentext, Titel, Thema, Tags und Lösung; Filter für alles Genannte. Ausgewählte Aufgaben werden
mit einem Klick eine neue Übung. Ein Eintrag ist intern eine Übung der Art `bibliothek` mit genau
einer Aufgabe.

Herkunft und Quelle setzt der Lehrer bei der Aufgabe (Quellen aus Mehr › Lehrplan › Quellen, auch die
von Material). Es gilt dieselbe Regel wie beim Material: importiert nur aus einer Quelle, deren Lizenz
das erlaubt, mit dieser Lizenz; aus Schulbuch, Verlag oder bei unklarer Lizenz nur in eigenen Worten,
dann als eigene Aufgabe mit der Quelle als Vorlage (`tasks.source_item_id`). Eine neu geschriebene
Aufgabe bekommt den Titel aus ihrem Text; „Neu erstellen“ gibt es in der Bibliothek nicht.

## Material

Mehr › Material: Foto (JPG, PNG, WebP) oder PDF hochladen, höchstens 20 MB.

- Der Dateityp wird am Inhalt erkannt, nicht am Namen. Gespeichert wird unter `data/uploads`
  (oder `UPLOADS_PATH`), benannt nach der Prüfsumme; dieselbe Datei zweimal ergibt dasselbe Material.
- Die Datei ist nur für angemeldete Lehrer abrufbar. PDFs erscheinen als Vorschau nur in dieser App.
- Einordnung: Fach, Schulart, Klasse, Thema, Fähigkeiten (Vorschläge aus dem Thema ohne KI).
- Herkunft und Lizenz: eigenes Material, Schule/Schulbuch/Verlag oder freie Lizenz (z. B. CC BY).
- Optional „Mit Claude erkennen“: nur mit KI-Schlüssel und nach der Bestätigung, dass keine Namen
  oder persönlichen Angaben auf dem Material stehen. Zurück kommen Vorschläge für Fach, Thema,
  Fähigkeiten und Aufgaben; gespeichert werden sie nur als Vorschlag.
- In die Bibliothek kommt eine Aufgabe nur, wenn der Lehrer sie geprüft hat. Aus Schulbuch, Verlag
  oder Schule nur in eigenen Worten (dann als eigene Aufgabe, mit dem Material als Vorlage vermerkt);
  aus eigenem oder frei lizenziertem Material mit dessen Lizenz.

## Zusammenfassung nach der Einheit

Beim Abschluss und in der Dokumentation einer Einheit beantwortet die App sechs Fragen aus der
Datenbank: Was wurde gemacht? Was ging gut? Wo gab es Schwierigkeiten? Welche Fehler kamen vor?
Was als Nächstes üben? Hausübung, Test, Schularbeit. Zeilen aus den Notizen des Lehrers sind als
solche markiert.

Daraus entsteht auf Knopfdruck eine Notiz für Eltern oder Schüler, „Aus den Fakten“ ohne KI. „Mit
Claude formulieren“ (nur mit KI-Schlüssel) schickt nur die Datenzeilen: keine Namen (auch aus dem Text
entfernt), keine Notizen des Lehrers, keine Profilangaben. Der Lehrer kann die Notiz ändern; gespeichert
wird sie mit ihrer Quelle.

## Statistik

Mehr › Statistik, intern für Lehrer und Verwaltung. Nur Summen über alle Schüler: keine Namen, keine
Schüler-IDs, kein Vergleich oder Ranking von Schülern. Reines SQL, keine KI (`lib/statistik.ts`).

- Schwierige Fähigkeiten (ab 5 Antworten): Erfolg, 1. Versuch, Hilfen pro Aufgabe, Zeit (Median)
- Häufige Fehlerarten, wie viele vom Lehrer bestätigt, und wie viele falsche Versuche noch ohne
  Fehlerart sind
- Durchschnittlicher Lernstand pro Fähigkeit
- Aufgaben: Erfolgsquote, Hilfen und Zeit pro Aufgabe; ungewöhnlich leicht oder schwer gegenüber der
  erwarteten Quote ihrer Schwierigkeit (ab 5 Antworten von mindestens 3 Schülern, 25 Prozentpunkte
  Abstand). Kopien in mehreren Übungen zählen zusammen, wenn Text, Fähigkeit, Format, Optionen und
  richtige Antwort gleich sind
- Themen und Stichwörter aus Schularbeiten und Tests

Filter: Fach, Zeitraum, Diagnosen mit/ohne/nur.

## Datenqualität

Mehr › Datenqualität und die Seite jeder Fähigkeit. Offizielle Daten (`skills`, `curricula`,
`curriculum_nodes`) schreibt nur der Import; eigene Korrekturen liegen getrennt und lassen sich
zurücksetzen (Details in `docs/curriculum.md`):

- Fähigkeit einer anderen Klasse oder einem anderen Thema zuordnen, verschieben, „in der Praxis oft
  früher/später“ (`skill_overrides`)
- Dubletten finden (nie automatisch) und zusammenführen; die Antworten der Dublette zählen dann für
  die bleibende Fähigkeit; Rückgängig möglich
- Voraussetzungen hinzufügen und entfernen
- falsche Lehrplan-Verknüpfungen entfernen oder eigene hinzufügen; entfernte kommen mit einem neuen
  Import nicht zurück
- jede Korrektur steht mit vorherigem Zustand und Lehrer in der Änderungsgeschichte

## Ohne KI / mit Claude

Ohne KI, immer: richtig/falsch, Versuche, Hilfen, Dauer, Fehlerart-Vorschläge, Lernstand, Empfehlung
und ihre Prioritäten, Voraussetzungs-Prüfung, Diagnose-Auswertung, Bibliothekssuche und Filter,
Material-Ablage und Fähigkeits-Vorschläge, Zusammenfassung und Notiz „Aus den Fakten“, Statistik,
Datenqualität.

Mit Claude, nur wenn ein Schlüssel hinterlegt ist und nur auf Wunsch: neue Aufgaben (Builder,
Diagnose für Fähigkeiten ohne Generator), Bewertung von Freitext-Antworten, die Einschätzung komplexer
Fehlerbilder im Lernstand, die formulierte Notiz, die Erkennung von Material.

## Betrieb

- Sicherung: die Datenbank enthält alle Daten außer den hochgeladenen Dateien. Den Ordner
  `data/uploads` (bzw. `UPLOADS_PATH`) mitsichern.
- Uploads laufen über eine eigene Route (`/material/hochladen`), nicht über den Proxy, weil Dateien
  größer sein können als dessen Grenze. Sie prüft die Anmeldung selbst und nimmt nur Formulare dieser
  Seite an.

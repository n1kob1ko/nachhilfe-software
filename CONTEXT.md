# Lernheft

Nachhilfe-Software für ein Institut: Schülerprofile, Einheiten dokumentieren,
Übungen erzeugen und zuweisen, Fortschritt je Fähigkeit, Blätter zum Drucken.

Dieses Dokument ist ein **Glossar** — es legt fest, welches Wort für welchen
Begriff gilt. Keine Architektur, keine Umsetzungsdetails, keine Entscheidungen;
die kommen aus [tommys-merge.md](tommys-merge.md) und `docs/`.

Der Merge (Phasen 0–7) ist umgesetzt: alle hier festgelegten Begriffe gibt es im
Code. Die Phasen und Entscheidungen stehen in [tommys-merge.md](tommys-merge.md).

## Personen

**Lehrer**:
Wer unterrichtet und mit dem Werkzeug arbeitet. **Die Person, nicht ihr Zugang** —
eine Zeile in `teachers`, mit Anmeldename, Passwort und `is_admin`. Wo es um
Anmelden, Passwort oder Rechte geht, heißt es Konto; wo es um Unterricht geht,
Lehrer.
_Avoid_: Lehrkraft, Nutzer, Benutzer, Account, Trainer

**Schüler**:
Wer unterrichtet wird. Eine Zeile in `students`, **ohne Konto**: er erreicht die
App über seinen geheimen Link `/lernen/[token]` oder über ein gekoppeltes Gerät.
_Avoid_: Kind, Klient, Teilnehmer, Schüleraccount, Nutzer

**Klasse fehlt**:
Ein **Schüler** ohne Schulart oder Klasse, z. B. nach dem Import der Dokumentation. Seine
Schulstufe ist „unklar“ (`grade` 0). Die Schülerliste filtert danach, das Profil bittet ums
Nachtragen (D27, [docs/import.md](docs/import.md)).
_Avoid_: unbekannte Klasse, ohne Stufe, Klasse offen

## Unterricht und Planung

**Einheit**:
Ein Nachhilfetermin zwischen Lehrer und Schüler. Beim Starten entsteht sofort
eine Zeile in `units` (Basis-Dokumentation); beendet wird sie von Hand oder nach
Inaktivität automatisch. Ihre **Dauer** ist die echte Zeit von Start bis Ende.
Abgerechnet werden nur Einheiten, nie das selbstständige Üben.
_Avoid_: Stunde, Lektion, Sitzung, Termin

**Einschätzung**:
Wie der Schüler sich in einer **Einheit** getan hat, beim Beenden aus den Daten
geschrieben (`lib/einschaetzung.ts`, ohne KI): Gesamteindruck 1–5, Sätze mit
Begründung, Vergleich mit den letzten Einheiten, dazu Verständnis, Konzentration
und Mitarbeit. Erst ab 4 Aufgaben am Gerät gibt es Werte. Damit ist die Einheit
dokumentiert, ohne dass der Lehrer etwas einträgt; was er ändert, bleibt.
_Avoid_: Bewertung, Note, Beurteilung

**Mappe**:
Alles, was der Schüler in einer **Einheit** gemacht hat, als A4-PDF für seine
Schulmappe (`/arbeitsblatt/einheit/[id]`, `lib/mappe.ts`): jede **Übung** mit
seinen Antworten, Häkchen und Kreuz am Rand und bei Fehlern der richtigen Lösung,
dazu die Textarbeiten und die Seiten des Whiteboards. Nichts wird gespeichert, das
PDF macht der Druckdialog des Browsers.
_Avoid_: Mappe als Ordner von Materialien, Portfolio

**geplante Einheit**:
Ein Platz im Wochenplan: wer (Lehrer, Schüler), wo (Raum), an welchem Wochentag,
zu welcher Startzeit und mit welcher **geplanten Dauer**. Sie wird erst wirklich,
wenn eine Einheit sich mit ihr verknüpft (`unit_id`); ein vergangener Platz ohne
Einheit heißt „nicht stattgefunden“ und hat keine Abrechnungsfolge.
_Avoid_: Termin, Slot, geplante Stunde, Lesson

**geplante Dauer**:
Wie lange eine **geplante Einheit** dauern soll — je Schüler eingestellt,
Vorgabe 100 Minuten, erlaubt 1–300. Sie schreibt die echte Einheit nicht vor.
_Avoid_: Dauer, Soll-Dauer, Termindauer

**Dauer**:
Die tatsächliche Länge einer **Einheit**, gerechnet von Start bis Ende. Nur sie
zählt für die Abrechnung. Auf der Einheitenseite steht beides nebeneinander:
„geplant 100 min · tatsächlich 85 min“.
_Avoid_: geplante Dauer, Zeit, Länge

**Abrechnung**:
Die stattgefundenen **Einheiten** eines Monats, die neueste oben, auch im CSV. Löschen nimmt
eine Einheit nach einer Rückfrage ganz aus der App: aus Abrechnung, Lernverlauf und Einheiten.
Gelöste Aufgaben bleiben im Lernstand. Lehrer löschen nur ihre eigenen Einheiten, die
Verwaltung alle.
_Avoid_: Rechnung, Stundenliste, Honorarliste

**Wochenplan**:
Der Plan einer Kalenderwoche (Montag bis Sonntag, Europe/Vienna): welche
**geplanten Einheiten** es gibt, mit Lehrer, Schüler, Raum und Zeit. Eine Woche
ist entweder Entwurf oder veröffentlicht.
_Avoid_: Stundenplan, Zeitplan, Kalender, Schedule

**Entwurf / veröffentlicht**:
Die zwei Zustände eines **Wochenplans**. Ein Entwurf ist noch änderbar und nur
für die Verwaltung sichtbar; veröffentlicht heißt: für diese Woche gilt er, und
Lehrer und Schüler sehen ihre Termine. Beim Veröffentlichen wird niemand
benachrichtigt. Nicht zu verwechseln mit dem Entwurf einer **Übung**: der wird
**freigegeben** (siehe *Übung*).
_Avoid_: Draft, freigegeben, aktiv, live

**gesperrt**:
Kennzeichen an einer **geplanten Einheit**: sie ist von Hand gesetzt und darf
nicht verschoben werden. „Neu generieren“ lässt gesperrte Plätze stehen, sonst
wäre die Handarbeit nach jedem Lauf weg.
_Avoid_: fixiert, gepinnt, blockiert, locked

**gleichzeitig**:
Haken an einer **geplanten Einheit**: der Lehrer darf zu dieser Zeit einen
zweiten Schüler haben, auch im selben Raum, aber nie einen dritten. Beide Plätze
werden dabei **gesperrt**. Die Lehrerzeit zählt dann einmal, nicht zweimal.
_Avoid_: Gruppe, Doppelstunde, parallel

**Raum**:
Wo eine **geplante Einheit** stattfindet: Gebäude, Name, und ob vor Ort oder
online. Ein Raum wird deaktiviert, nie gelöscht, sobald Plätze auf ihn zeigen.
_Avoid_: Zimmer, Saal, Ort, Location

**Verfügbarkeit**:
Die Zeiten, in denen ein Lehrer oder Schüler eingeplant werden darf: je
Wochentag eine oder mehrere Spannen (ISO: 1 = Montag … 7 = Sonntag). Dazu kann
es für eine einzelne Woche eine **Abweichung** geben, die nur diese Woche gilt.
_Avoid_: Zeitfenster, freie Zeiten, Availability, Kapazität

## Üben und Aufgaben

**Übung**:
Ein Arbeitsblatt, das einem Schüler zugewiesen wird — eine Zeile in
`worksheets`, zugewiesen über `assignments`. Sie ist zunächst **Entwurf**
(Schüler sehen sie nie), nach der Prüfung **freigegeben**. Arten: `uebung`,
`ueberpruefung` (Kontrolle nach dem Üben), `diagnose`, `bibliothek`.
_Avoid_: Arbeitsblatt (das ist das gedruckte Blatt), Aufgabe, Exercise, Training

**Aufgabe**:
Eine einzelne Aufgabe **innerhalb** einer Übung — eine Zeile in `tasks`, mit
Antwortformat, Schwierigkeit, Lösung, Hilfen und typischen Fehlern. Die Übung
ist das Ganze, die Aufgabe der einzelne Schritt.
_Avoid_: Übung, Frage, Item, Task

**Fähigkeit**:
Eine einzelne übbare Fertigkeit, geordnet als Fach › Thema › Fähigkeit ›
Teilfähigkeit (`skills`, Teilfähigkeit über `parent_id`). Der Fortschritt wird je
Fähigkeit gerechnet; eine Aufgabe kann mehrere trainieren. Die Fähigkeit trägt
den Namen, unter dem sie im Lehrplan steht.
_Avoid_: Kompetenz, Lernziel, Skill, Fertigkeit

**Schnellrunde**:
Eine Übung im Schülermodus, aber im Durchlauf: Multiple Choice mit höchstens vier
Antworten, ein Tipp, kurze Rückmeldung, automatisch die nächste Aufgabe; Anfang
und Ende als eigene Seite, große Flächen fürs Tablet. Versuche, Zeit und Hilfen
werden genau wie sonst gespeichert. Im Code `assignments.mode = 'schnell'`
(`lib/quick-round.ts`).
_Avoid_: Quiz, Blitzrunde, Schnelltest, Microlearning

**Auswendig schreiben**:
Eine Aufgabe, in der ein Text auswendig geschrieben wird: erst ist er zu lesen,
dann verschwinden nach und nach Wörter und Buchstaben, bis das Feld leer ist; die
App vergleicht Wort für Wort. Die falschen Wörter landen als Fehler im Versuch.
Im Code der Aufgabentyp `memorize` (`lib/memorize.ts`), der Text steht in
`data.passage`.
_Avoid_: Memorize, Auswendiglernen, Diktat, Abfrage

## Material, Bibliothek, Vorlage

**Material**:
Eine hochgeladene Datei, eingeordnet nach Fach, Thema und Fähigkeiten: Foto, PDF
oder Arbeitsblatt. Sie bleibt privat; die App darf darin etwas erkennen, aber
daraus wird erst eine Aufgabe, wenn der Lehrer es geprüft hat. Herkunft und
Lizenz bleiben an jedem übernommenen Stück hängen.
_Avoid_: Datei, Upload, Anhang, Ressource, Content

**Bibliothek** (Aufgabenbibliothek):
Die Sammlung einzelner, guter, wiederverwendbarer **Aufgaben**. Jeder Eintrag ist
genau eine Aufgabe samt Herkunft und Lizenz; aus ausgewählten Einträgen entsteht
mit einem Klick eine neue Übung.
_Avoid_: Archiv, Sammlung, Pool, Katalog

**Vorlage**:
Ein gespeichertes Rezept für eine **Übung**: die Einstellungen des Builders und,
wenn gewünscht, die festen Aufgaben — damit dieselbe Übung in einem Klick wieder
entsteht. Nicht zu verwechseln mit der **Bibliothek** (dort liegen einzelne
Aufgaben) und nicht mit dem „Vorlage“-Feld einer Bibliotheksaufgabe, das die
Quelle meint, nach der sie geschrieben wurde.
_Avoid_: Template, Muster, Blaupause, Schablone

## Schule

**Fach**:
Steht an zwei Stellen. Die **Fächer im Profil** sind die, die ein Schüler
regelmäßig bei uns hat. Das **Fach einer Einheit** (auch einer Hausübung) ist
frei: jedes Schulfach, auch einmalig, z. B. Biologie vor einem Test, ohne dass
sich das Profil ändert. Lehrplan, Übungen und Lernstand je Fähigkeit gibt es nur
für Mathematik, Deutsch und Englisch; eine Einheit in einem anderen Fach wird
dokumentiert, aber nicht ausgewertet.
_Avoid_: Gegenstand, Unterrichtsgegenstand, Kurs

**Hausübung**:
Was der Schüler zu Hause macht: Beschreibung, Fach, Fälligkeit, offen oder
erledigt. Österreichisch für Hausaufgabe.
_Avoid_: Hausaufgabe, Homework, Übung, Aufgabe

**Schularbeit**:
Ein schriftlicher Test in der Schule: Fach, Datum, Stoff, Ergebnis (Note oder
Punkte), Zustand geplant, geschrieben oder abgesagt. Österreichisch für
Klassenarbeit. Im Code und in der Oberfläche heißt sie oft noch „Test“ (Tabelle
`tests`) — siehe *Altlasten im Code*.
_Avoid_: Klassenarbeit, Prüfung, Examen, Schultest

## Blätter erstellen

**Blätter erstellen**:
Der eigene Bereich für Blätter zum Ausdrucken: **Lesetabelle**,
**Satzbaukasten**, **Nachmalblatt** und später weitere. Das Ergebnis eines
Generators ist ein **Druckblatt**. Der bestehende A4-Druck einer **Übung** bleibt
davon getrennt.
_Avoid_: Worksheet-Generator, Druckzentrum, Blattgenerator, Druckbereich

**Druckblatt**:
Ein unter „Blätter erstellen“ erzeugtes Blatt. Seine Beschreibung ist eine
**Definition** — was gedruckt werden soll, nicht wie es aussieht; aus ihr lässt
es sich wieder öffnen. Gespeichert wird es als Material (`kind = druckblatt`):
als Vorlage ohne Schüler oder als Kopie für einen Schüler.
_Avoid_: Worksheet, Arbeitsblatt (das ist der A4-Druck einer Übung), PDF, Ausdruck

**Lesetabelle**:
Eine Blattart: Silben oder Wörter in einem gleichmäßigen Raster, laut zu lesen.
_Avoid_: Silbentabelle, Leseblatt, Worksheet

**Satzbaukasten**:
Eine Blattart: Spalten mit Wörtern oder Satzteilen, aus denen Sätze
zusammengesetzt werden. Ausdrücklich nicht die Satzbau-Aufgaben der
**Schnellrunde** — das eine ist ein Blatt, das andere eine Übung am Bildschirm.
_Avoid_: Satztabelle, Satzgenerator, Baukasten

**Nachmalblatt**:
Eine Blattart: Buchstaben, Silben oder Wörter zum Nachspuren, wobei die Hilfe von
Zeile zu Zeile abnimmt.
_Avoid_: Schreibblatt, Tracing, Spurbild, Schwungblatt

**Lineatur**:
Die Linienvorgabe für Handschrift, nach DIN 16552-1 nummeriert: Lineatur 0 (vier
Linien, 6 mm) und Lineatur 1–4, jeweils passend zur Grundschulklasse. Ab
Lineatur 3 gibt es zwei Linien, bei Lineatur 4 nur die Grundlinie.
_Avoid_: Schreiblinien, Liniensystem, Raster, Linierung

**Schulschrift**:
Die Handschriftform, die ein Schüler lernt: Druckschrift oder eine der drei
Ausgangsschriften (Vereinfachte, Schul- und Lateinische Ausgangsschrift). Beim
Nachmalblatt ist sie Lerninhalt, nicht Gestaltung — deshalb wird eine fehlende
Schriftdatei sichtbar gemeldet und nicht still durch eine andere ersetzt.
_Avoid_: Font, Schriftart, Typeface, Handschrift

## KI

**KI-Hinweise**:
Notizen je Schüler, wie die KI ihn behandeln soll („Legasthenie: kurze Sätze“).
Sie hängen am Systemprompt jeder schülerbezogenen Anfrage und gehen nie mit dem
Namen des Schülers hinaus.
_Avoid_: Prompt, KI-Profil, Notizen, Anweisungen

**Tagesbriefing**:
Die Vorbereitung auf die heutige **Einheit** eines Schülers: letzter Stand, wo es
hakt, ein Plan mit Minuten für die **geplante Dauer** und passende Übungen aus dem
Bestand. Die Fassung aus den Daten ist immer da; die KI-Fassung nur auf Klick, eine
pro Schüler und Tag gespeichert. Sie ändert nie den Lernstand.
_Avoid_: Stundenvorbereitung, Unterrichtsplan, Tagesplan (das ist die Liste „Heute“ auf der Startseite)

**manueller KI-Modus**:
Ein Betrieb ohne Anfrage nach außen: die App zeigt den vollständigen Prompt zum
Kopieren, der Lehrer fügt die Antwort ein, und die App prüft sie mit derselben
Reparatur und Validierung wie eine Antwort über die API. Es entstehen keine
Kosten.
_Avoid_: Offline-Modus, ChatGPT-Modus, Copy-Paste-KI, Trockenlauf

## Regel: „Stunde“ ist eine Uhrzeit

**„Stunde“ wird hier nur für 60 Minuten gebraucht** — „eine Stunde später“, „nach
3 Stunden ohne Aktivität“, „0,10 $ pro Stunde“. Ein Nachhilfetermin heißt immer
**Einheit** (Entscheidung D12 in [tommys-merge.md](tommys-merge.md)). Das gilt
auch zusammengesetzt: kein „Stundenplan“ (das ist der **Wochenplan**), keine
„Stundendokumentation“ (das ist die Dokumentation der **Einheit**), keine
„Nachhilfestunden“ (das sind **Einheiten**).

Ausnahme ist allein der Wortlaut, den wir nicht ändern dürfen: der amtliche
Lehrplan und die Kennungen unter *Altlasten im Code*.

## Altlasten im Code

Diese Bezeichner tragen das alte Wort weiter und werden **nicht** umbenannt:
Daten, Adressen und Kennungen hängen daran. Sie stehen hier, damit sie niemand
für einen Fehler hält und „aufräumt“.

| Bezeichner | Was es ist |
|---|---|
| Tabelle `lessons` | die Dokumentationszeile einer Einheit (Lern-Dokumentation), verknüpft über `lessons.unit_id` |
| `lessons.kind = 'stunde'` | die Zeile gehört zu einer Einheit; Gegenstück ist `'selbststaendig'` (selbstständiges Üben) |
| `lessons.kind` Vorgabe `'stunde'` | die Spalte selbst (`lib/db.ts`, `COLUMNS`) |
| `lessons.status = 'geplant'` | eine von Hand eingetragene geplante Einheit, die noch keine `units`-Zeile hat. Bleibt (Entscheidung in Phase 4, siehe `docs/planung.md`): der Wochenplan ersetzt sie nicht, denn diese Zeile trägt Fach, Thema und Fähigkeiten und wird beim Start von der Einheit übernommen |
| `lessons.assignment_id`, `lessons.unit_id`, `lessons.family_note` | Felder derselben Tabelle |
| Route `/schueler/[id]/stunden/[id]` | die Adresse einer Dokumentationszeile (`components/LessonCard.tsx`, `Lernverlauf.tsx`, `app/(tutor)/abrechnung/page.tsx`) |
| `?tab=stunden` | alte Tab-Adresse auf dem Schülerprofil, wird auf `lernverlauf` umgebogen |
| `lib/mastery.ts`: `EvidenceSource = "stunde"`, `SOURCE_WEIGHT.stunde` | Herkunft und Gewicht der Beobachtung aus einer Einheit |
| `lib/analysis.ts`: `source: "stunde"` | dieselbe Herkunft, beim Rechnen |
| `lib/exports.ts`: Schlüssel `nachhilfestunden` | Kennung des Datensatzes im Datenexport |
| `lib/ai/features.ts`: `next_lesson_plan` | Feld der KI-Einschätzung |
| Tabelle `tests`, Oberfläche „Tests“ | Schularbeiten und Tests |
| `curriculum/ris-*.json`: „volle Stunden“, „halbe Stunden“, „Stunden und Minuten“ | amtlicher Lehrplanwortlaut (Uhrzeit) — darf nicht verändert werden |

Und die Stellen, an denen „Stunde“ **richtig** steht und so bleiben muss, weil es
wirklich 60 Minuten sind: `lib/math-expr.ts` (Einheiten `h`, `std`, `stunden`,
`stunde`), `lib/learning.ts` („nach 3 Stunden ohne Aktivität“),
`lib/units.test.ts`, `lib/text-doc.test.ts`, `docs/betrieb.md`,
`docs/ki-simulation.md` sowie die Textproben in `lib/ai/textkorrektur-*.ts` und
`lib/ai/qualitaetstest-faelle.ts`.
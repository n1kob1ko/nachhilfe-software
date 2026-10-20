# Schreibaufträge (Oberstufe, SRDP)

Ein Schreibauftrag ist ein ganzer Text einer Textsorte der SRDP zu einer Textbeilage mit Zeilennummern, wie bei der Schularbeit und der Matura: Zusammenfassung, Leserbrief, Erörterung, Kommentar, Meinungsrede, Textanalyse, offener Brief, Empfehlung und die Textinterpretation ([textinterpretation.md](textinterpretation.md)), die als erste da war. Technisch ist jeder Schreibauftrag eine normale Textarbeit mit der Textsorte als Thema und einer Zeile in `text_interpretations` (Textsorte in `sorte`, Textbeilage, Autor, Medium, Datum, Art der Textbeilage, Wortziel, Schreibsituation). Deshalb gilt alles, was für Texte gilt: automatisches Speichern, frühere Fassungen, Mitlesen, Abgeben, Korrektur, Lernverlauf und A4-Druck.

Jede Textsorte hat:

- ein **Wortziel** als Vorgabe, das die Lehrkraft ändern kann (150 bis 1 500); im Auftrag steht das Ziel ±10 %, auf Zehner gerundet;
- einen **Schreibplan** mit vier bis sechs Teilen, einem Satz Hilfe und einer Wortzahl je Teil;
- drei **Arbeitsaufträge** in eigenen Worten nach der Form der SRDP;
- ihre **Merkmale** („Achte auf“), beim Schreiben und auf dem Arbeitsblatt;
- **Hinweise ohne KI**, die nie etwas als falsch markieren;
- ein **Beispiel**: eine Textbeilage und einen Mustertext, beide für das Lernheft geschrieben;
- **Teilübungen** im Übungs-Builder statt kurzer Mini-Aufgaben.

## Ablauf

1. **Anlegen.** In einer laufenden Einheit eines Oberstufen-Schülers auf „Schreibauftrag“ tippen (`/einheiten/<id>/schreibauftrag`) und die Textsorte wählen. Ohne Einheit geht es über den Hinweis im Übungs-Builder (`/schueler/<id>/schreibauftrag`). Die alten Adressen `…/textinterpretation` leiten weiter.
   - Titel, Autor oder Autorin, „Erschienen in“ (Zeitung, Zeitschrift oder Webseite), Datum, Art der Textbeilage (Zeitungsartikel, Bericht, Reportage, Kommentar, Kolumne, Essay, Interview, Rede, Leserbrief, Rezension, Blogeintrag, Sachtext) und das Wortziel.
   - Die **Schreibsituation**, wo die Textsorte eine hat: Anlass und Publikum der Meinungsrede, der Adressat des offenen Briefs und die Zielgruppe der Empfehlung sind Pflicht. Die Frage der Erörterung ist wahlweise (ohne Frage heißt es „die Frage, um die es im Text geht“), ebenso eine Situation für Zusammenfassung, Leserbrief und Kommentar. Die Textanalyse hat keine.
   - Den Text der Textbeilage einfügen. Jeder Zeilenumbruch bleibt, jede Zeile bekommt ihre Nummer, sichtbar ist jede fünfte. Kommt der Text von einer Webseite (ein ganzer Absatz in einer Zeile), erscheint **„Zeilen umbrechen“**: Die App teilt lange Zeilen in Zeilen von etwa 62 Zeichen, ohne ein Wort zu trennen.
   - „Vom Foto lesen“ (nur mit KI, nur auf Klick) wie bei der Textinterpretation.
   - Der Arbeitsauftrag entsteht aus den Angaben und folgt ihnen, bis du ihn selbst änderst.
   - „Beispiel einfügen“ füllt alles mit der Beispiel-Textbeilage der Textsorte aus.
2. **Ändern.** In der Textarbeit führt „Text und Auftrag“ zu `/texte/<id>/schreibauftrag`. Die Textsorte bleibt, der geschriebene Text auch.
3. **Schreiben.** Am Tablet (`/geraet`) und am eigenen Laptop (`/mitmachen`) wie bei der Textinterpretation: breit links die Textbeilage mit Zeilennummern, rechts Schreibplan mit „Achte auf“, Wortzähler und Editor; schmal zwei Reiter „Text lesen“ und „Schreiben“. Darunter die Hinweise und „So kann es aussehen“ mit dem Mustertext der Textsorte.
4. **Abgeben, korrigieren, Lernverlauf** wie bei jedem Text ([textarbeit.md](textarbeit.md), [textkorrektur.md](textkorrektur.md)).
5. **Drucken.** „PDF / Drucken“ hat das Feld „Ausgabe“: das Arbeitsblatt (Arbeitsauftrag, Textbeilage mit Art, Titel, Autor, Medium und Datum, Zeilennummern, Schreibplan mit „Achte auf“ und Linien: 52 Linien je 500 Wörter, mindestens 24), den fertigen Text, oder den Text mit der Textbeilage auf einer neuen Seite.

## Die Textsorten

| Textsorte | Vorgabe | Im Auftrag | Teile (Anteil) | Hinweise |
|---|---|---|---|---|
| Zusammenfassung | 300 | 270 bis 330 | Einleitung (15 %), Position (30 %), Begründungen (35 %), Folgerungen (20 %) | Bezug am Anfang (Titel, Autor, Medium), eigene Worte, keine eigene Meinung, Konjunktiv I |
| Leserbrief | 300 | 270 bis 330 | Betreff, Anrede und Bezug (15 %), Worum es geht (10 %), Deine Meinung (50 %), Appell und Gruß (25 %) | Betreff, Anrede, Bezug am Anfang, Begründungen und Beispiele, Grußformel |
| Erörterung | 600 | 540 bis 660 | Einleitung (10 %), Position der Textbeilage (15 %), Gegenseite (30 %), Deine Seite (30 %), Schluss (15 %) | eigene Überschrift, Bezug am Anfang, Begründungen und Beispiele, Abwägen |
| Kommentar | 450 | 410 bis 500 | Überschrift und Einstieg (15 %), Bezug zur Textbeilage (15 %), Deine Meinung (50 %), Schluss (20 %) | eigene Überschrift, Bezug, Begründungen und Beispiele |
| Meinungsrede | 600 | 540 bis 660 | Anrede und Einstieg (15 %), Bezug zur Textbeilage (10 %), Argumente (55 %), Appell und Schluss (20 %) | Anrede, Bezug, Publikum angesprochen, Fragen, Begründungen, Dank (nur Info) |
| Textanalyse | 600 | 540 bis 660 | Einleitung (10 %), Inhalt (15 %), Aufbau und Argumentation (25 %), Sprache (30 %), Absicht und Wirkung (10 %), Schluss (10 %) | Bezug am Anfang, Zitate mit Zeilenangabe, Zeilen, Stelle |
| Offener Brief | 450 | 410 bis 500 | Kopf, Anrede und Anlass (15 %), Kritik mit Begründung (45 %), Forderung (30 %), Schluss und Gruß (10 %) | Ort und Datum, Anrede, Bezug, Begründungen, Forderung, Grußformel |
| Empfehlung | 300 | 270 bis 330 | Einleitung (15 %), Information (25 %), Bewertung (40 %), Empfehlung (20 %) | eigene Überschrift, Bezug, Begründungen und Beispiele, Empfehlung am Schluss |

Alle haben dazu **Umfang** und **Absätze**. Die Vorgaben für Zusammenfassung, Leserbrief, Erörterung, Kommentar und Meinungsrede liegen in den Umfängen, die öffentliche Beschreibungen der SRDP-Textsorten nennen (deutsche-grammatik.net: Zusammenfassung und Leserbrief 270 bis 330, Meinungsrede 540 bis 660, Kommentar und Erörterung je nach Aufgabe 405 bis 495 oder 540 bis 660). Für Textanalyse, offenen Brief und Empfehlung fand sich keine öffentliche Zahl; die Vorgaben sind eine Annahme und lassen sich je Auftrag ändern.

## Hinweise ohne KI

Die Hinweise sind Tipps, keine Note (`hinweiseFor()` in `lib/schreibauftrag.ts`). Sie zählen und suchen, sie lesen nicht mit:

- **Umfang** und **Absätze** wie bei der Textinterpretation.
- **Bezug:** Titel, Autor und Medium am Anfang (Zusammenfassung, Leserbrief, Erörterung, Textanalyse) oder eines davon irgendwo im Text (Kommentar, Rede, offener Brief, Empfehlung).
- **Anrede**, **Betreff**, **Grußformel**, **Ort und Datum**, **eigene Überschrift** (nicht der Titel der Textbeilage).
- **Begründungen und Beispiele:** Wörter wie weil, denn, deshalb und zum Beispiel, etwa. Ohne Beispiel ist das nur eine Info.
- **Abwägen** (Erörterung): zwar, jedoch, andererseits, Befürworter, Gegner.
- **Publikum, Fragen, Dank** (Meinungsrede): ihr, wir, Sie; ein Fragezeichen; ein Dank am Schluss (nur Info, nie Tipp).
- **Eigene Worte** (Zusammenfassung): Stellen ab sieben Wörtern, die wörtlich in der Textbeilage stehen, und wörtliche Zitate ab vier Wörtern.
- **Meinung** und **Konjunktiv** (Zusammenfassung): „ich finde“, „meiner Meinung nach“ und Ähnliches außerhalb von Zitaten; ob es Formen wie sei, habe, könne gibt.
- **Forderung** (offener Brief) und **Empfehlung** (Empfehlung) in der zweiten Hälfte oder am Schluss.
- **Zitate, Zeilen, Stelle** (Textanalyse) wie bei der Textinterpretation; der Titel und das Medium in Anführungszeichen zählen nicht als Zitat.

Ein Test prüft, dass jeder Mustertext keinen einzigen Tipp bekommt, und dass jeder Hinweis anschlägt, wenn das Gesuchte fehlt.

## Teilübungen im Übungs-Builder

Wählt man im Builder eine dieser Fähigkeiten (`deutsch.os.matura.zusammenfassung` usw.), entstehen keine kurzen Mini-Aufgaben mehr, sondern **Teilübungen** ohne KI: je eine freie Aufgabe zu einem Teil des Schreibplans, mit der ganzen Textbeilage mit Zeilennummern als gemeinsamem Lesetext und dem Erwartungshorizont des Teils. Grundlage ist der letzte Schreibauftrag des Schülers in dieser Textsorte, sonst die Beispiel-Textbeilage; beim Beispiel ist der Mustertext die Musterlösung. Jeder Teil höchstens zweimal pro Übung, die zweite Runde mit der anderen Formulierung; „Neu erzeugen“ wechselt die Formulierung und behält Teil und Textbeilage. Mehrere Textsorten in einer Übung bekommen jede ihre eigene Textbeilage; andere Fähigkeiten gehen wie bisher an die KI oder die Generatoren. Aus einem Schreibauftrag heraus macht „Teilübungen dazu“ eine Teilübung je Teil zu genau dieser Textbeilage. Der Empfehlungsweg (eine Fähigkeit, „Mit einem Klick zuweisen“) macht ebenfalls Teilübungen.

## KI-Korrektur

Die Textkorrektur erkennt die Textsorte am Thema des Textes (`kindCriteria()` in `lib/text-correction-rules.ts`). Jede Textsorte hat ihre eigene Regel (von niko am 2026-10-20 freigegeben): Zusammenfassung, Leserbrief, offener Brief, Kommentar, Meinungsrede und Empfehlung stehen vor der allgemeinen Brief- und Inhaltsangabe-Regel, damit ein Leserbrief nicht nach Ort und Datum gefragt wird. Erörterung und Textanalyse hatten schon ihre eigene. Konjunktiv I verlangt die Zusammenfassung nur in der Oberstufe. Der Prompt selbst ist unverändert. Die Textbeilage wird **nicht** gesendet, und anders als bei der Textinterpretation geht auch keine Zeile über den Bezugstext mit. Der Name des Autors der Textbeilage wird wie jeder andere Name behandelt: Findet die Namenserkennung ihn, wird er zu [Name].

## Beispiele

`lib/schreibauftrag-beispiele.ts` enthält fünf eigens geschriebene Textbeilagen mit erfundenen Autorinnen, Autoren und Medien und einen Mustertext je Textsorte:

| Textbeilage | Art | Für |
|---|---|---|
| „Ausgeschlafen lernt es sich besser“, Helene Baumgartl, Der Talblick, 12. März 2026 | Kommentar, 32 Zeilen | Leserbrief, Textanalyse |
| „Jugendtreff schließt künftig um 20 Uhr“, Lukas Steinmauer, Stadtzeitung Neustein, 3. Februar 2026 | Bericht, 30 Zeilen | Kommentar, offener Brief |
| „Schluss mit der Hausübung!“, Felix Wanninger, Familienjournal, Mai 2026 | Kolumne, 31 Zeilen | Erörterung, Meinungsrede |
| „Jeder Tropfen zählt“, Agnes Pröll, Der Talblick, 8. Mai 2026 | Zeitungsartikel, 32 Zeilen | Zusammenfassung |
| „Kaputt heißt nicht verloren“, Rosa Dornegger, Stadtzeitung Neustein, 20. April 2026 | Reportage, 33 Zeilen | Empfehlung |

Ein Test prüft Umfang und Teile jedes Mustertexts und jedes Zitat der Mustertextanalyse gegen die Zeilen der Textbeilage. Ins Repository, in Tests und Doku kommen nur erfundene Texte und Namen; Textbeilagen aus Schulbüchern, Schularbeiten oder Aufgabenpools fügt die Lehrkraft in der App ein, sie liegen nur in der Datenbank. Teile, Merkmale und Arbeitsaufträge sind eigene Formulierungen nach öffentlichen Beschreibungen der Textsorten (deutsche-grammatik.net, die BRP-Information der BAfEP 10); aus Aufgaben des Aufgabenpools oder der IQS ist nur die Form übernommen.

## Code

- `lib/schreibauftrag.ts`: Textsorten, Schreibplan, Arbeitsauftrag, Hinweise, Beispiele, Teilübungen (rein, ohne Datenbank); für die Textinterpretation gibt es an `lib/textinterpretation.ts` weiter
- `lib/schreibauftrag-beispiele.ts`: Textbeilagen und Mustertexte
- `lib/schreibauftrag-store.ts`: Tabelle `text_interpretations` (Spalten `sorte`, `story_medium`, `situation` in `COLUMNS` von `lib/db.ts`), Anlegen und Ändern
- `lib/textinterpretation-store.ts`: die Funktionen der Textinterpretation darauf; sie sehen nur Zeilen mit `sorte = 'textinterpretation'`
- `app/schreibauftrag-actions.ts`: Server-Aktionen
- `components/text/interpretation/`: Formular (`SchreibauftragForm`), Textsortenwahl, nummerierte Textbeilage, Hinweise, Wortzähler, Foto
- `components/text/TextEditor.tsx`: Ansicht beim Schreiben (`auftrag`)
- Tests: `lib/schreibauftrag.test.ts`

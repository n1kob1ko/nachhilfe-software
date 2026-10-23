# Textinterpretation (Oberstufe)

Eine Textinterpretation wie bei der Schularbeit: eine ganze Kurzgeschichte mit Zeilennummern und rund 500 Wörter Interpretation in sieben Teilen. Technisch ist sie eine normale Textarbeit mit der Textsorte „Textinterpretation“ und einer Zeile in `text_interpretations` (Geschichte, Autor, Jahr, Textsorte, Wortziel). Deshalb gilt alles, was für Texte gilt: automatisches Speichern, frühere Fassungen, Mitlesen, Abgeben, Korrektur, Lernverlauf und A4-Druck.

Die Textinterpretation ist einer von neun Schreibaufträgen. Die anderen Textsorten (Zusammenfassung, Leserbrief, Erörterung, Kommentar, Meinungsrede, Textanalyse, offener Brief, Empfehlung) nutzen dieselbe Ansicht, dasselbe Formular und dieselbe Tabelle: [schreibauftraege.md](schreibauftraege.md).

## Warum die Übungen vorher zu kurz waren

Die Fähigkeit `deutsch.os.matura.textinterpretation` hatte keinen eigenen Generator. Der Übungs-Builder machte daraus gewöhnliche freie Aufgaben: ohne KI eine Zeile „Erkläre …“, mit KI eine kurze, erfundene Textstelle im Aufgabentext und eine freie Antwort mit höchstens 20 Linien (`answer_lines` ist in `aiTaskToDraftRaw` auf 20 begrenzt). Das ergab Mini-Interpretationen von etwa 200 Wörtern, ohne ganzen Text, ohne Zeilennummern und ohne den Aufbau der Schule.

## Ablauf

1. **Anlegen.** In einer laufenden Einheit eines Oberstufen-Schülers auf „Schreibauftrag“ tippen und „Textinterpretation“ wählen (`/einheiten/<id>/schreibauftrag?sorte=textinterpretation`). Ohne Einheit geht es über das Schülerprofil oder den Hinweis im Übungs-Builder (`/schueler/<id>/schreibauftrag?sorte=textinterpretation`). Die alten Adressen `…/textinterpretation` leiten dorthin weiter.
   - Titel, Autor oder Autorin, Jahr (wenn bekannt), Textsorte (Kurzgeschichte, Erzählung, Parabel, …) und das Wortziel (Vorgabe 500, erlaubt 150 bis 1 500).
   - Den Text der Geschichte einfügen. Jeder Zeilenumbruch bleibt, jede Zeile bekommt ihre Nummer, sichtbar ist jede fünfte. Leerzeilen zählen nur mit, wenn der Haken „Leerzeilen mitzählen“ gesetzt ist. Die Vorschau zeigt die Nummern so, wie der Schüler sie sieht.
   - Der Arbeitsauftrag entsteht aus den Angaben (Textsorte, Bezugstext, Arbeitsaufträge, Umfang) und folgt ihnen, bis du ihn selbst änderst. „Wieder aus den Angaben“ holt die Vorlage zurück.
   - „Beispielgeschichte einfügen“ füllt alles mit der erfundenen Geschichte „Sieben Uhr zwölf“ aus (siehe unten).
   - „Quelle“ ist nur für dich und wird nicht gedruckt.
2. **Ändern.** In der Textarbeit führt „Text und Auftrag“ zu `/texte/<id>/schreibauftrag`. Der geschriebene Text bleibt dabei unverändert; ein offenes Tablet oder ein offener Laptop zeigt die Änderung sofort.
3. **Schreiben.** Am Tablet (`/geraet`) und am eigenen Laptop (`/mitmachen`) sieht der Schüler:
   - **Breit** (Schreibbereich ab 900 px, Laptop oder iPad quer): links die Geschichte mit Zeilennummern, sie bleibt beim Scrollen stehen; rechts Schreibplan, Wortzähler und Editor. Der Knopf ganz links in der Werkzeugleiste („Geschichte ausblenden“, bei den anderen Textsorten „Textbeilage ausblenden“) blendet sie aus, dann schreibt man über die ganze Breite; „… zeigen“ holt sie zurück, an derselben Stelle. Die Wahl gilt pro Text auf diesem Gerät. Text, Speichern und Aufgabe bleiben, wie sie sind; im Vollbild steht die Aufgabe zum Aufklappen über dem Schreibplan.
   - **Schmal** (Handy, iPad hoch): zwei Reiter „Text lesen“ und „Schreiben“. Am Handy (390 px) gibt es kein seitliches Scrollen; lange Zeilen brechen mit hängendem Einzug um, die Nummer bleibt links.
   - Den **Schreibplan** mit den sieben Teilen, einem Satz Hilfe und einer Wortzahl je Teil. Er ist offen, bis der Schüler den Fokusmodus wählt.
   - Den **Wortzähler** mit Balken: Ziel ±10 % (bei 500 also 450 bis 550 Wörter).
   - **Hinweise** (aufklappbar, ohne KI, siehe unten) und „So kann es aussehen“: die Musterinterpretation zur Beispielgeschichte, nach Teilen.
4. **Abgeben, korrigieren, Lernverlauf** wie bei jedem Text ([textarbeit.md](textarbeit.md), [textkorrektur.md](textkorrektur.md)).
5. **Drucken.** „PDF / Drucken“ hat das Feld „Ausgabe“:
   - **Arbeitsblatt: Auftrag, Text und Schreibplan:** Arbeitsauftrag, die Geschichte mit Zeilennummern, der Schreibplan mit Wortzahlen und 52 Linien.
   - **Fertige Textinterpretation:** der Text des Schülers (optional mit Korrekturen).
   - **Textinterpretation und Text mit Zeilen:** wie oben, dazu auf einer neuen Seite die Geschichte mit Zeilennummern.

## Schreibplan

| Teil | Anteil | Bei 500 Wörtern | Was hineingehört |
|---|---|---|---|
| Einleitung | 10 % | ca. 50 | Autor, Titel, Textsorte, Thema, wenn bekannt das Jahr; am Ende die Deutungshypothese |
| Inhaltsangabe | 15 % | ca. 75 | kurz, im Präsens, ohne Zitate und Wertung |
| Form und Aufbau | 15 % | ca. 75 | Erzählform, Aufbau (z. B. kreisförmig), Merkmale der Textsorte, Abschnitte mit Zeilen |
| Sprache | 20 % | ca. 100 | Wortwahl (Dialekt, veraltete Wörter), Satzbau, Stilmittel: immer Zitat, Zeile und Wirkung |
| Figur | 15 % | ca. 75 | Charakterisierung mit Belegen |
| Deutung | 15 % | ca. 75 | Aussageabsicht, Gesellschaftskritik, Titel |
| Schluss | 10 % | ca. 50 | Gesamtdeutung und begründete Stellungnahme |

Zitiert wird als „…“ (Z. 12), über zwei Zeilen (Z. 38f.), über mehrere (Z. 11–13) oder bis zum Ende (Z. 41ff.).

## Hinweise ohne KI

Die Hinweise sind Tipps, keine Note, und sie markieren nie etwas als falsch, das richtig sein könnte (`hinweise()` in `lib/textinterpretation.ts`):

- **Umfang:** Wortzahl im Verhältnis zum Ziel.
- **Einleitung:** ob im ersten Absatz Autor (auch nur der Nachname, auch im Genitiv) und Titel stehen.
- **Zitate:** ob jedes Zitat eine Zeilenangabe hat. Der Titel in Anführungszeichen zählt nicht als Zitat.
- **Zeilen:** Angaben über der letzten Zeile des Textes.
- **Stelle:** ein Zitat, das wörtlich im Text steht, aber nicht in der angegebenen Zeile. Eine Zeile daneben gilt als richtig; gekürzte Zitate mit […] oder … und Zitate, die nicht wörtlich im Text stehen (umformuliert, eigene Rechtschreibung), werden nicht geprüft.
- **Absätze:** ob der Aufbau in Absätzen zu sehen ist.

Ein Test prüft, dass die Musterinterpretation keinen einzigen Tipp bekommt und dass richtige Arten zu zitieren nie angemerkt werden: „f.“ und „ff.“, Bereiche, „Zeile 24“, „vgl.“, „ebd.“, die Angabe vor dem Zitat, eine Zeile daneben, ein Zitat, das zweimal im Text steht, und angepasste Zitate mit [ ].

## Teilübungen im Übungs-Builder

Wählt man im Builder die Fähigkeit Textinterpretation, entstehen keine Mini-Interpretationen mehr, sondern **Teilübungen** ohne KI: je eine freie Aufgabe zu einem Teil des Schreibplans (Einleitung mit Deutungshypothese, Inhaltsangabe im Präsens, Abschnitte mit Zeilen, Stilmittel mit Zitat und Wirkung, Figur, Deutung, Schluss), mit der ganzen Geschichte mit Zeilennummern als gemeinsamem Lesetext, Musterlösung und Erwartungshorizont. Grundlage ist die letzte Textinterpretation des Schülers, sonst die Beispielgeschichte. Höchstens 14 Teilübungen pro Übung; „Neu erzeugen“ wechselt zur zweiten Formulierung. Ein Hinweis im Builder führt zum ganzen Schreibauftrag. Aus einer Textinterpretation heraus macht „Teilübungen dazu“ sieben Teilübungen zu genau dieser Geschichte. Andere Fähigkeiten ändern sich nicht.

## KI-Korrektur

Die bestehende Textkorrektur erkennt die Textsorte und bewertet nach den sieben Teilen der Schule (`lib/text-correction-rules.ts`). Mit dem Text gehen nur Titel, Autor, Jahr, Textsorte und die Zahl der Zeilen mit, **nicht die Geschichte selbst**. Die KI wird angewiesen, Zitate und Zeilenangaben nicht auf Richtigkeit zu prüfen und den Namen des Autors nicht als Fehler anzumerken. Der Autorname wird beim Ersetzen der Namen nicht zu [Name].

## Text vom Foto (optional, mit KI)

Ist die KI eingerichtet und kann sie Bilder lesen, gibt es beim Anlegen „Vom Foto lesen“: ein Foto oder PDF der gedruckten Seite wählen, bestätigen, dass kein Name und nichts Handgeschriebenes darauf steht, und auf „Text lesen“ tippen. Die KI schreibt nur den gedruckten Text Zeile für Zeile ab (keine Handschrift, keine Namen außerhalb der Geschichte, auch nicht den Autor), unsichere Stellen stehen als […] da. Die App entfernt Zahlen am Rand und eine doppelte Überschrift und hängt die Abschrift ins Textfeld; eine zweite Seite wird darunter angehängt. Das Foto wird nicht gespeichert. Gespeichert wird erst mit „Schreibauftrag erstellen“, nachdem du den Text geprüft hast. Code: `lib/textinterpretation-foto.ts`, Route `app/material/textfoto/route.ts`, KI-Funktion `textfoto`.

## Beispiel

`lib/textinterpretation-beispiel.ts` enthält eine eigens geschriebene Kurzgeschichte („Sieben Uhr zwölf“ von der erfundenen Autorin Ida Brunnhofer, 68 Zeilen: ein alter Mann wartet an einer Haltestelle, deren Buslinie eingestellt ist) und eine Musterinterpretation mit rund 520 Wörtern in den sieben Teilen. Ein Test prüft jedes Zitat der Musterinterpretation gegen die Zeilen der Geschichte.

Ins Repository, in Tests und Doku kommen nur erfundene Texte und Namen. Geschichten aus Schulbüchern oder Schularbeiten fügt die Lehrkraft in der App ein; sie liegen nur in der Datenbank.

## Code

- `lib/textinterpretation.ts`: Zeilennummern, Schreibplan, Arbeitsauftrag, Zitate finden, Hinweise, Teilübungen (rein, ohne Datenbank)
- `lib/textinterpretation-store.ts`: Textinterpretationen in `text_interpretations` (dünne Hülle um `lib/schreibauftrag-store.ts`)
- `lib/schreibauftrag.ts`, `lib/schreibauftrag-store.ts`: alle Textsorten, siehe [schreibauftraege.md](schreibauftraege.md)
- `app/schreibauftrag-actions.ts`: Server-Aktionen
- `components/text/interpretation/`: Formular (`SchreibauftragForm`), nummerierte Geschichte, Hinweise, Wortzähler, Foto
- `components/text/TextEditor.tsx`: Ansicht beim Schreiben (`auftrag`)
- Tests: `lib/textinterpretation.test.ts`, `lib/textinterpretation-foto.test.ts`

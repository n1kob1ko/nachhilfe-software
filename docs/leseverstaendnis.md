# Leseverständnis (Lernheft Phase 5C)

Ein längerer Lesetext mit mehreren Fragen dazu, wie ein Arbeitsblatt in der Schule. Es gibt **keine eigene Aufgabenverwaltung**: eine Leseverständnisübung ist eine normale Übung (Entwurf, Vorschau, senden, Tablet, eigener Laptop, Schüler-Link, Ergebnis, Lernverlauf, A4). Jede Frage ist eine normale Aufgabe. Den gemeinsamen Text trägt jede Frage in `data.passage` (Titel in `data.passageTitle`), genau wie die kurzen Textverständnis-Aufgaben vorher. Eine Übung, deren Fragen alle denselben Text haben, ist ein **Lesetext** (`readingSet` in `lib/lesen.ts`). Dann:

- zeigt der Editor den Text einmal oben und ändert ihn einmal für alle Fragen,
- sieht der Schüler den Text neben den Fragen,
- druckt das A4-Blatt den Text einmal vor den Fragen,
- schickt der Server den Text nur einmal an das Schülergerät.

## Erstellen

**Übungen › Übung erstellen › „Leseverständnis mit längerem Text“** (`/uebungen/neu/lesen`).

| Schritt | Auswahl |
|---|---|
| Schüler und Klasse | Schüler (optional), Schultyp und Klasse, Fach Deutsch oder Englisch |
| Lesetext | **eigenen Text einfügen** (Absätze mit Leerzeile) oder **Text von der KI schreiben lassen**: Thema, Textart (Erzählung, Kurzgeschichte, Sachtext, Zeitungsartikel, argumentativer Text), ungefähre Länge |
| Fragen | Anzahl (4–12), Schwierigkeit, wer die Fragen schreibt (KI oder Vorlagen), Auswahlfragen erlauben (aus) |

Längenempfehlung, kein Limit: Volksschule 150–400 Wörter, Unterstufe 300–800, Oberstufe 600–1.500. Die Seite zählt Wörter und Absätze beim Einfügen.

Ohne KI (kein Schlüssel, KI aus, KI nicht erreichbar) funktioniert alles mit einem eigenen Text: die Fragen kommen dann aus Vorlagen (siehe unten) und der Lehrer passt sie an. Ein neuer Text braucht die KI.

## Die Fragen

Sieben Arten, jede eine Teilfähigkeit im Lehrplan (`deutsch.text.verstehen.*` und `englisch.reading.comprehension.*`):

| Art | Teilfähigkeit | Antwort |
|---|---|---|
| Informationen finden | Informationen aus Texten entnehmen | eindeutig im Text, mit Beleg |
| Zusammenhänge verstehen | Zusammenhänge erkennen | eindeutig im Text, mit Beleg |
| Schlussfolgern | Schlussfolgerungen ziehen | mehrere Antworten richtig |
| Wörter erklären | Wortbedeutungen erschließen | Wort aus dem Text, mit Beleg |
| Textstelle als Beleg | Textstellen als Beleg verwenden | Zitat aus dem Text |
| Zusammenfassen | Inhalte zusammenfassen | eigene Worte |
| Eigene Stellungnahme | Aussagen begründen | mehrere Antworten richtig |

Eine Übung mit 8 Fragen hat alle sieben Arten. Die meisten Fragen verlangen eine Antwort in eigenen Worten. Ab 5 Fragen ist eine ein Lückentext mit Wörtern aus dem Text. Multiple Choice nur, wenn der Lehrer es erlaubt, dann höchstens jede vierte Frage.

Jede Frage speichert Musterlösung, Erwartungshorizont (`answer.criteria`) und Belege (`answer.evidence`: Abschnitt und wörtliche Textstelle).

### Mit KI (`lib/ai/lesen.ts`, Funktion „Leseverständnis erstellen“)

- Text: ein Aufruf. Die KI schreibt einen neuen Text und übernimmt keine Texte aus anderen Quellen. Personen sind erfunden. Der Text kommt in Absätzen zurück.
- Fragen: ein Aufruf mit nummerierten Absätzen und einem Fragenplan (Art und Format je Frage). Die KI bekommt nur Fach, Klasse, Thema, Schwierigkeit und Text, **nie den Namen oder Daten des Schülers**.
- Danach prüft die App ohne KI: Fragen, die fast dasselbe fragen, fallen weg. Ein Beleg kommt in den Absatz, in dem er wirklich steht. Fehlende oder unbrauchbare Fragen werden **einmal** nachgefragt, nie öfter. Kommen trotzdem weniger, sagt die Vorschau das.

### Ohne KI (`templateQuestions` in `lib/lesen.ts`)

Vorlagen je Art, für Erzählungen und Sachtexte verschieden formuliert, mit echten Abschnittsnummern. „Wörter erklären“ nimmt ein Wort aus dem Text. Der Lückentext nimmt einen Satz aus dem Text und lückt zwei Inhaltswörter. Musterlösungen ergänzt der Lehrer; die Vorschau sagt, wo eine fehlt.

### Prüfen und Bearbeiten in der Vorschau

- Oben steht der Text mit nummerierten Absätzen und den Arten, die die Fragen üben. „Text bearbeiten“ ändert Text und Titel für alle Fragen.
- Jede Frage hat Bearbeiten (Frage, Art, Musterlösung, Erwartungshorizont, Belege), Neu erstellen (eine andere Frage derselben Art zum selben Text) und Löschen. „Weitere Frage zum Text“ legt eine Frage einer gewählten Art an.
- Fragen, die nicht zum Text passen, sind gelb markiert mit „Bitte prüfen“ (`readingIssues`):
  - Abschnitt, den es nicht gibt;
  - zitiertes Wort oder Beleg, das so nicht im Text steht;
  - Beleg im falschen Abschnitt;
  - fehlender Beleg bei Fragen mit eindeutiger Antwort;
  - fehlende Musterlösung;
  - Lückensatz, der nicht wörtlich im Text steht;
  - Frage, die nichts aus dem Text nennt;
  - Frage sehr ähnlich wie eine andere.
- Für die ganze Übung: zu viele Auswahlfragen oder zu wenig verschiedene Arten. Die Markierungen ändern nichts automatisch.

## Schüleransicht

- **Laptop und iPad quer (ab 1024 px):** Text links, Fragen rechts. Der Text bleibt beim Antworten sichtbar und scrollt für sich.
- **iPad hoch und kleinere Bildschirme:** oben ein Umschalter „Text“ und „Frage 3 von 8“.
- Große Schrift mit nummerierten Absätzen, Fortschritt „Frage 3 von 8“, Kreise 1 … n zum Springen zwischen Fragen (erledigte mit Häkchen).
- Offene Antworten werden **abgegeben**, nicht geprüft. Danach sieht der Schüler die Musterlösung.
- Was getippt ist, bleibt auf dem Gerät gespeichert („Entwurf auf diesem Gerät gespeichert“), auch beim Wechsel zwischen Fragen und nach Neuladen. Eine Abgabe ohne Verbindung wird gesendet, sobald das Internet wieder geht, und genau einmal gespeichert.
- Am eigenen Laptop tritt die Aufgabenliste für den Lesetext zur Seite.

## Bewertung und Lernstand

- Lückentext und Auswahlfragen prüft die App selbst (Groß- und Kleinschreibung egal).
- Offene Antworten bewertet der Lehrer (richtig, teilweise richtig, falsch) auf der Ergebnisseite. Dort stehen Musterlösung, Erwartungshorizont und Beleg neben der Antwort, der Text ist aufklappbar. Andere Formulierungen sind nie automatisch falsch. **Die KI bewertet keine offenen Antworten.**
- Erst die Bewertung des Lehrers zählt für den Lernstand, je Teilfähigkeit und für „Leseverständnis“ insgesamt. Doppelte Abgaben zählen einmal (Abgabe-ID und Sperre im Speichern wie bei allen Übungen).

## A4

`/arbeitsblatt/<id>` wie bei allen Übungen.

- **Schülerfassung:** Kopf mit Name und Datum, Hinweis zum Lesen, Titel, ganzer Text mit Absatznummern am Rand. Danach „Fragen zum Text“, nummeriert, mit Schreiblinien, Lücken und Ankreuzfeldern. Ein Absatz bleibt auf einer Seite, eine Frage wird nicht getrennt.
- **Lehrerfassung:** Text, Fragen, Lösung oder Musterlösung, Erwartungshorizont, Belege mit Abschnitt.

## Nicht enthalten

KI-Bewertung offener Antworten, Texte aus PDF oder Foto (OCR), Hörverständnis, Spiele.

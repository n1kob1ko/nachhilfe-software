# Wortarten bestimmen

Bei „Wortarten bestimmen“ entstanden ohne KI bisher nur Erklärfragen („Erkläre in eigenen Worten, wie man bei „Wortarten bestimmen“ vorgeht …“) mit der Musterlösung „Eine korrekte Erklärung … mit einem passenden Beispiel“. Der Grund: Es gab keinen Generator für diese Fähigkeit, darum kam die allgemeine Ersatzaufgabe. Jetzt erzeugt `lib/wortarten.ts` echte Bestimmungsaufgaben, schulstufengerecht und ohne KI. KI-Aufgaben prüft die App unabhängig vom KI-Anbieter.

## Welche Wortarten?

Im Übungs-Builder steht unter den Fähigkeiten die Zeile **„Welche Wortarten?“**, sobald „Wortarten bestimmen“ (oder eine Wortart darunter) gewählt ist. Gewählte Wortarten werden zu Teilfähigkeiten `deutsch.wortarten.bestimmen.<wortart>`, für die der Lernstand einzeln mitzählt.

| Schulstufe | Grundeinstellung |
|---|---|
| 1.–4. (Volksschule) | Nomen, Verb, Adjektiv (Lehrplan VS: „die Wortarten wie Nomen, Verb, Adjektiv … mit den Fachbegriffen benennen“) |
| 5. | dazu Artikel, Pronomen, Präposition |
| 6. | alle acht: dazu Konjunktion, Adverb |
| ab 7. | alle acht und Unterarten (Personal-, Possessiv-, Demonstrativ-, Relativpronomen …, bestimmter/unbestimmter Artikel, Hilfs-/Modalverb, neben-/unterordnende Konjunktion, Adverbarten) ab „schwer“ |

Der Lehrplan der Unterstufe nennt nur „Basisfertigkeiten“ (1. Klasse) und „differenzierte Fertigkeiten“ (2. Klasse) in Wort- und Satzgrammatik. Die Stufen ab der 5. Schulstufe sind darum eine eigene didaktische Entscheidung. Die Grundeinstellung ist keine feste Zuordnung:

- Wortarten aus dem **aktuellen Stoff** des Schülers und solche, die er **schon geübt** hat, kommen dazu.
- Sobald die Lehrkraft eine Wortart an- oder abwählt, gilt **nur ihre Auswahl**.
- Wer nur Nomen, Verb und Adjektiv wählt, bekommt keine Aufgabe, keine Antwortmöglichkeit, keine Lösung und keine Hilfe, die eine andere Wortart nennt.
- Sätze mit Wörtern noch nicht gelernter Wortarten werden bei „sehr leicht“ und „leicht“ vermieden. Bei sehr enger Auswahl (z. B. nur Konjunktionen) dürfen sie vorkommen; gefragt werden diese Wörter nie.

„Nomen erkennen und großschreiben“ übt nur Nomen: heraussuchen und großschreiben.

## Aufgaben ohne KI

Grundlage ist eine Satzbank mit 73 Sätzen, in der jedes Wort mit seiner Wortart (und Unterart) markiert ist, wie in österreichischen Schulbüchern:

- Adverbial gebrauchte Adjektive („Er läuft **schnell**.“) sind Adjektive.
- „im, beim, ins“ und Verbpartikel („liest **vor**“) werden nie gefragt.
- Wörter, die oft verwechselt werden („das“ als Artikel oder Relativpronomen, „Morgen“ und „morgen“), sind schwerer eingestuft.

| Art | Aufgabentyp | Beispiel |
|---|---|---|
| Wortarten zuordnen | Wortarten, Lückentext | „Der kleine Hund schläft.“ kleine: ___ Hund: ___ schläft: ___ |
| markiertes Wort bestimmen | Wortarten, Multiple Choice | „Der Fuchs [schleicht] leise durch den Wald.“ Nomen / Verb / Adjektiv |
| Wörter einer Wortart finden | Wortarten, Lückentext | Schreib alle Verben aus dem Satz heraus: ___, ___ |
| Wörter sortieren | Wortarten, Lückentext | Adjektive: ___ ___ Nomen: ___ ___ |
| Unterart bestimmen | Wortarten, Multiple Choice (ab „schwer“, nur mit Unterarten) | „[Das] Buch, [das] …“: Relativpronomen? |
| falsch bestimmte Wortarten verbessern | Fehler korrigieren | „Elias hat die Wortarten bestimmt. 2 Angaben sind falsch.“ |
| welche Angabe ist falsch? | Fehler finden | Multiple Choice mit „Wort = Wortart“ |
| Erklärung | nur bei **Freie Antwort** | eigener Satz mit vorgegebenen Wortarten, Musterlösung konkret („Der kleine Hund schläft. schläft = Verb, Hund = Nomen, kleine = Adjektiv“) und Kriterien |

Die Schwierigkeit steigt über die Grammatik, nicht nur über die Satzlänge:

- **sehr leicht, leicht:** kurze Sätze, typische Wörter, wenige Lücken.
- **mittel:** gebeugte Formen, zusammengesetzte Zeitformen („hat … geregnet“), mehr Wörter.
- **schwer, sehr schwer:** Nominalisierungen („beim Kochen“), adverbial gebrauchte Adjektive, „das“ als Artikel oder Relativpronomen, Hilfs- und Modalverben, Unterarten.

Jede Musterlösung nennt jedes gefragte Wort mit seiner Wortart („kleine = Adjektiv“). Bei schwierigen Wörtern steht eine kurze Begründung dabei.

„Gemischte Aufgaben“ nimmt für Wortarten jetzt Wortarten, Lückentext, Wortarten und Fehler korrigieren. Freie Antwort kommt nur, wenn die Lehrkraft sie ausdrücklich wählt.

## KI-Aufgaben (unabhängig vom Anbieter)

Die KI bekommt die erlaubten Wortarten und die Regeln (echte Wörter bestimmen, keine Platzhalter, adverbial gebrauchte Adjektive sind keine Adverbien). Danach prüft die App jede Aufgabe selbst (`checkWortartTask`), bei jedem Anbieter.

**Verworfen** (die Aufgabe wird noch einmal angefragt oder vom Generator erstellt):

- nennt eine Wortart, die nicht gewählt ist;
- fragt nach Unterarten, ohne dass sie gewählt sind;
- ist eine Erklärungsfrage statt einer Bestimmungsaufgabe;
- hat keine konkrete oder vollständige Musterlösung;
- hat Lückenlösungen, die weder eine Wortart noch ein Wort aus dem Satz sind;
- nennt ein Adjektiv der Satzbank ein Adverb („schnell = Adverb“) oder ein Adverb ein Adjektiv („gern = Adjektiv“).

**„Bitte prüfen“:**

- Ein bekanntes Wort hat eine andere Wortart als in der Satzbank („kleine = Nomen“).
- Ein unbekanntes Wort ist als Adverb angegeben.

Die Aufgabe zeigt dann in der Vorschau einen gelben Kasten mit **„Geprüft, passt“** und **„Verbessern“**. Senden geht erst danach. Nachschub in einer Einheit und Diagnosen gehen ohne Vorschau an den Schüler und nehmen solche Aufgaben deshalb gar nicht.

Lücken mit einer Wortart nehmen auch die Schulnamen an (Namenwort, Tunwort, Eigenschaftswort …).

## Platzhalter in allen Fächern

Musterlösungen wie „Eine passende Antwort“, „Eine korrekte Erklärung“, „Ein eigenes Beispiel“ oder „Individuelle Schülerlösung“ gelten überall als fehlend:

- **KI:** Freie Aufgaben mit so einer Musterlösung werden verworfen.
- **Ohne KI:** Die allgemeine Erklärfrage für Fähigkeiten ohne hinterlegte Erklärung hat keine erfundene Musterlösung mehr, nur die Bewertungskriterien.
- **Vor dem Senden:** Die Prüfung meldet „Die Musterlösung ist nur ein Platzhalter“.

## Dateien

| Datei | Inhalt |
|---|---|
| `lib/wortarten.ts` | Wortarten, Grundeinstellung, Satzbank, Aufgaben, Prüfung von KI-Aufgaben, KI-Regeln |
| `lib/curriculum.ts` | Teilfähigkeiten `deutsch.wortarten.bestimmen.*`, Aufgabentyp „Wortarten“ (Lückentext, Multiple Choice, Kurzantwort), Mischung |
| `lib/generators.ts` | Wortarten-Fähigkeiten gehen an `wortartenTask` (Builder, Nachschub, Empfehlung, Diagnose) |
| `lib/builder.ts` | `wortartenSetting` aus Fähigkeiten, Schulstufe, aktuellem Stoff und Lernverlauf; Prüfung „Bitte prüfen“ und Platzhalter vor dem Senden |
| `lib/ai/features.ts` | Regeln im KI-Auftrag, Prüfung jeder KI-Aufgabe |
| `components/BuilderForm.tsx` | Zeile „Welche Wortarten?“ |
| `components/WorksheetEditor.tsx`, `app/builder-actions.ts` | Kasten „Bitte prüfen“, „Geprüft, passt“ |
| `lib/wortarten.test.ts` | Tests 1–8 aus dem Auftrag |

# KI-Simulation: 60 Minuten Nachhilfe

Probelauf ohne API-Schlüssel: der Router, die Auslöser, die Bündelung und das Log sind echt, der KI-Anbieter ist durch einen Platzhalter ersetzt. Die Tokens sind aus den echten Prompts geschätzt (etwa 3,2 Zeichen pro Token, Ausgabeschema zählt als Eingabe, Denken bei Aufgabenerstellung +80 %). Ein Echtlauf mit `npm run ai:simulate -- --echt` misst sie.

Anbieter und Modelle: Echtzeit = `anthropic: claude-haiku-4-5`, Aufgaben = `anthropic: claude-sonnet-5-5`, Auswertung = `anthropic: claude-sonnet-5-5`, Tiefenanalyse = `anthropic: claude-opus-5-5`, Material = `anthropic: claude-sonnet-5-5`.

## Ablauf

- 66 Antworten auf 45 Aufgaben in 7 Übungen, 11 Hilfen geöffnet
- 78 Ereignisse an die KI-Schicht, davon 42 Auslöser für eine Analyse
- 24 Echtzeit-Analysen; 13 Auslöser wurden mit anderen gebündelt, 5 entfielen, weil die Aufgabe inzwischen gelöst war
- 6 Blockauswertungen, 3 Mal „Passende Aufgabe senden“, 1 Zusammenfassung am Ende

## 1. API-Aufrufe

**36 Aufrufe** in 60 Minuten, dazu 2 aus dem Speicher beantwortet (keine Kosten). Ohne Filter und Bündelung wären es etwa 89 gewesen (eine Analyse pro Antwort und Hilfe).

## 2. Tokens

**35 368 Input** zum vollen Preis, dazu 1 353 in den Cache geschrieben und 2 706 aus dem Cache gelesen (10 % des Preises); **6 322 Output**.

## 3. Kosten

**0,0987 $ pro Stunde** (geschätzt). Bei 40 Stunden im Monat etwa 3,95 $. Ohne Router etwa 0,1897 $ pro Stunde.

## 4. Funktionen und Modelle

| Funktion | Modell | Aufrufe | aus Speicher | Input | Cache gelesen | Output | Ø Dauer | Kosten |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Echtzeit-Analyse | `claude-haiku-4-5` | 24 | 0 | 26 110 | 0 | 3 019 | 1,4 s | 0,0412 $ |
| Neue Aufgabe in der Einheit | `claude-sonnet-5-5` | 3 | 0 | 2 991 | 2 706 | 2 488 | 11,2 s | 0,0368 $ |
| Blockauswertung | `claude-sonnet-5-5` | 6 | 0 | 4 863 | 0 | 597 | 2,4 s | 0,0157 $ |
| Freitext bewerten | `claude-sonnet-5-5` | 2 | 2 | 983 | 0 | 78 | 1,7 s | 0,0027 $ |
| Zusammenfassung der Einheit | `claude-sonnet-5-5` | 1 | 0 | 421 | 0 | 140 | 2,9 s | 0,0022 $ |
| **Summe** | | **36** | 2 | 35 368 | 2 706 | 6 322 | | **0,0987 $** |

## 5. Wo es noch günstiger geht

1. **Echtzeit-Analyse** (0,0412 $, 42 %): Erste Fehlversuche und erste Hilfen nur regelbasiert auswerten und die KI erst ab dem zweiten Fehlversuch oder der zweiten Hilfe fragen.
2. **Neue Aufgabe in der Einheit** (0,0368 $, 37 %): Erst in der Aufgabenbibliothek nach einer passenden Aufgabe suchen und nur ohne Treffer neu erzeugen; weniger Denkaufwand oder das schnelle Modell für einfache Rechenaufgaben.
3. **Blockauswertung** (0,0157 $, 16 %): Blockauswertung mit dem schnellen Modell statt dem Standard-Modell (eigene Stufe für diese Funktion).

## Ausfalltest

Derselbe Ablauf, jeder KI-Aufruf schlägt fehl. Die Einheit lief bis zum Ende: 64 Antworten, 5 Freitexte per Selbsteinschätzung, 0 Mal neue Aufgaben aus dem Generator. 19 Aufrufe schlugen fehl, danach pausierte die KI und 18 weitere wurden gar nicht erst versucht.

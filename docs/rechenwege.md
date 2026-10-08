# Mathematik mit Rechenwegen (Lernheft Phase 5B)

Zwei Mathematik-Formate, bei denen der Schüler zeigt, **wie** er rechnet: **Rechenweg** und **Mehrteilige Sachaufgabe**. Sie sind Formate im bestehenden Aufgabenmodell (`lib/tasks.ts`) und laufen überall, wo Übungen laufen: Übungs-Builder, Aufgabenbibliothek, Schüler-Tablet, eigener Laptop, Schüler-Link, Ergebnisansicht, Lernverlauf und A4-Druck. Es gibt keine zweite Aufgabenarchitektur.

| Typ | Format | Was der Schüler macht |
|---|---|---|
| Rechenweg | `rechenweg` | schreibt jeden Rechenschritt in eine eigene Zeile und das Ergebnis in ein eigenes Feld |
| Mehrteilige Sachaufgabe | `sachaufgabe` | beantwortet Teilfragen a), b), c): Zahlen mit Rechnung oder Antworten in Worten |

## Eingabe für Schüler

- Rechenzeilen auf kariertem Hintergrund. Eingabetaste = neue Zeile, Rücktaste in einer leeren Zeile = Zeile weg, Mülleimer löscht eine Zeile.
- Geschrieben wird wie im Heft, ohne LaTeX: `3/4` für Brüche, `x^2` oder `x²` für Potenzen, `sqrt(2)` oder `√2` für Wurzeln, `·` oder `*` für mal, `:` für geteilt, Komma für Dezimalzahlen.
- Eine Zeichenleiste bringt die Zeichen, die die Tablet-Tastatur versteckt (Bruchstrich, ², Hochzahl, √, ·, :, −, =, Klammern, %, bei Gleichungen die Unbekannte). Sie fügt dort ein, wo der Cursor steht.
- Unter einer Zeile mit Bruch, Potenz oder Wurzel zeigt die App, wie sie die Zeile liest (echter Bruchstrich, hochgestellte Hochzahl, Wurzelzeichen).
- Das Ergebnis steht in einem eigenen Feld, bei Gleichungen mit „x =“ davor. Fehlt es, gilt die letzte Zeile (auch „L = {5}“, „Lösung: x = 5“ oder „5 = x“). Findet die App dort kein Ergebnis und die letzte Zeile ist Text, bewertet der Lehrer.
- Nach „Prüfen“ bekommt jede Zeile ein Zeichen: ✓ stimmt, ✗ hier passt etwas nicht, ↳ mit dem Fehler davor richtig weitergerechnet, ? nicht sicher prüfbar. Die Rückmeldung nennt die erste falsche Zeile. Wer eine Zeile ändert, verliert dort die Markierung und kann neu prüfen (3 Versuche).
- Läuft eine Einheit, kann der Schüler „Ich rechne am Whiteboard“ anhaken. Dann reicht das Ergebnis, den Rechenweg am Whiteboard bewertet der Lehrer.
- Alles Getippte bleibt auf dem Gerät gespeichert, bis es gesendet ist (Neuladen, Verbindung weg). Eine Abgabe ohne Verbindung wird später genau einmal gesendet.

## So prüft die App

Die Prüfung steht in `lib/math-expr.ts` (Lesen der Ausdrücke) und `lib/math-check.ts` (Bewertung). **Eingaben werden nie als Programmcode ausgeführt**: ein eigener Leser kennt nur Zahlen, einzelne Buchstaben als Unbekannte, + − · : / ^ √ ( ) und %. Alles andere ist ein Wort (Notiz) oder unlesbar. Länge, Verschachtelung und Hochzahlen sind begrenzt.

### Die Zeilen eines Rechenwegs

| Aufgabe | Eine Zeile stimmt, wenn … |
|---|---|
| Gleichung (`3x + 7 = 22`) | sie für die Lösung der Gleichung gilt. Jede richtige Umformung zählt, auch in anderer Reihenfolge, mit Brüchen oder in mehr Schritten. |
| Term (`3/4 + 1/6`, `3x^7 · 4x^7`) | jeder Teil gleich viel wert ist wie die Angabe (bei Termen mit x an mehreren Stellen geprüft). Nebenrechnungen, die in sich stimmen (`√16 = 4`, `1/2 = 2/4`), sind auch richtig. |
| Rechnung ohne Angabe (Prozent, Sachrechnen) | die Rechnung in sich stimmt (`480 : 100 = 4,8`). Eine Zeile mit „=“ am Anfang rechnet mit dem Wert davor weiter. |

- Gerundete Zwischenergebnisse (`0,1667`, `≈`) gelten, wenn richtig gerundet.
- Nummern, Pfeile, Umformungsnotizen (`| −7`), „1 % ≙ …“ und Wörter wie „Rabatt:“ werden übersprungen. Reine Textzeilen sind Notizen und zählen nicht.
- Zeilen nach einem Fehler, die mit dem falschen Wert richtig weiterrechnen, gelten als Folgefehler (↳), nicht als neue Fehler.
- Ungleichungen und Zeilen, die die App nicht lesen kann, sind „nicht sicher prüfbar“. Sie machen einen Weg nie falsch.

### Das Ergebnis

- Gleichwertige Schreibweisen zählen: `1/2 = 0,5 = 50 %` (wenn die Aufgabe keine Form verlangt), `6/8 = 3/4`, `x = 5`, mehrere Lösungen in beliebiger Reihenfolge (`x = 2 oder x = 3`).
- Einheiten werden umgerechnet (`7200 ct = 72 €`, `1,5 m = 150 cm`). Fehlt die Einheit, ist das Ergebnis teilweise richtig. Eine falsche Einheit (`72 kg`) ist falsch. Gezählte Wörter („12 Jahre“) sind keine Einheit.
- Verlangt die Aufgabe eine Form (gekürzter Bruch, Dezimalzahl, Prozent) und der Wert stimmt, ist es teilweise richtig mit dem Hinweis, was fehlt.
- Verlangt die Aufgabe Runden, gilt der gerundete Wert. Falsch gerundet ist falsch, mit dem Hinweis „achte aufs Runden“.

### Ergebnis und Rechenweg zusammen

| Ergebnis | Rechenweg | Bewertung |
|---|---|---|
| richtig | richtig | **richtig** |
| richtig | fehlt, ein Fehler oder nicht sicher prüfbar | **Lehrerbewertung**, der Fehler ist als Vorschlag markiert |
| richtig | am Whiteboard | **Lehrerbewertung** |
| teilweise (Einheit, Form) | egal | noch ein Versuch; beim letzten **teilweise richtig** |
| falsch | egal | **falsch**, noch ein Versuch; die erste falsche Zeile wird genannt |
| nicht lesbar | egal | **Lehrerbewertung** |

Ein falsches Ergebnis mit teilweise richtigem Weg bleibt falsch. Der Lehrer kann es im Ergebnis auf „teilweise richtig“ setzen. Ist bei einer Aufgabe kein Rechenweg verlangt (Haken im Editor), reicht das richtige Ergebnis.

### Sachaufgaben

- Jede Teilfrage wird einzeln geprüft: Zahlen wie ein Ergebnis oben, mit Rechenzeilen. Antworten in Worten bewertet immer der Lehrer.
- **Folgefehler:** Zu einer Teilfrage kann stehen, wie sie aus den Teilfragen davor entsteht (`480 - a`). Rechnet der Schüler mit seinem falschen a) richtig weiter, zählt b) als richtig. Kann die App a) nicht lesen, bewertet der Lehrer auch b).
- Alle Zahlen richtig und keine Wort-Antwort: richtig. Alle Zahlen richtig mit Wort-Antwort: Lehrerbewertung. Eine Zahl falsch: noch ein Versuch, die falschen Teilfragen sind markiert. Beim letzten Versuch: einige richtig = teilweise richtig.

## Lernstand und Fehlerarten

- Neue Fehlerarten: Vorzeichenfehler, Falsche Umformung, Fehler beim Bruchrechnen, Prozentrechnung falsch angewendet, Rechenfehler, Einheit vergessen, Aufgabe nicht verstanden.
- Die App schlägt eine Fehlerart vor (aus der ersten falschen Zeile oder dem Ergebnis). Ein Vorschlag bleibt ein Vorschlag, bis der Lehrer ihn bestätigt.
- **Unsichere Bewertungen verändern den Lernstand nicht.** Alles mit „Lehrerbewertung“ zählt erst, wenn der Lehrer richtig, teilweise richtig oder falsch gewählt hat. Automatisch „teilweise richtig“ zählt halb (siehe [lernstand.md](lernstand.md)).

## Übungs-Builder, Editor und KI

- Im Builder stehen „Rechenweg“ und „Mehrteilige Sachaufgabe“ bei Mathematik vorne. „Gemischte Aufgaben“ nimmt sie für Gleichungen, Brüche, Prozent und Potenzen mit.
- Ohne KI kommen die Aufgaben aus den eingebauten Generatoren (`lib/generators-mathe.ts`): Gleichungen (einfach, mit Klammern, aus Text), Brüche (kürzen, + − · :), negative Zahlen, Potenzregeln, Prozentwert/-satz/Grundwert; Sachaufgaben zu Rabatt, Preiserhöhung, Anteilen, Pizza-Brüchen und Altersrätseln. Jede hat Musterlösung Zeile für Zeile, Hilfen und typische Fehler.
- Die KI bekommt Fach, Thema, Schulstufe und Schwierigkeit, nie Namen. Jede KI-Aufgabe muss die eigene Prüfung bestehen (Lösung erfüllt die Gleichung, Musterlösung Zeile für Zeile richtig, Folgefehler-Rechnung ergibt das richtige Ergebnis), sonst wird sie verworfen und neu angefragt.
- Im Editor: Angabe, richtiges Ergebnis (auch weitere Schreibweisen), Einheit, Form, Runden, „Rechenweg verlangt“, Musterlösung Zeile für Zeile; bei Sachaufgaben die Teilfragen mit Ergebnis, Einheit, Folgefehler-Rechnung und Lösungsweg. Ein Hinweis unter den Feldern sagt sofort, ob die App die Aufgabe so prüfen kann und was nicht passt.

## Lehreransicht und A4

- Im Ergebnis sieht der Lehrer jeden Versuch kurz und den letzten mit allen Zeilen und ihren Zeichen, das Ergebnis, den Rechenweg-Status und jede Teilfrage. Dazu Lösungsweg, Bewertungsknöpfe und die Fehlerart.
- A4: unter jedem Rechenweg ein kariertes Rechenfeld und „Ergebnis: x =“, unter jeder Zahl-Teilfrage ein kleineres Rechenfeld mit „Antwort:“, für Wort-Antworten Linien. Platz klein/mittel/groß wirkt auch hier. Die Lehrerfassung zeigt Ergebnisse, Musterlösung Zeile für Zeile, Teilfragen-Lösungen und Folgefehler-Regel.

## Noch nicht dabei

Interaktive Geometrie, Funktionsgraphen, eine neue Whiteboard-Architektur, Ungleichungen als Rechenweg (werden angezeigt, aber vom Lehrer bewertet) und Gleichungssysteme mit mehreren Unbekannten.

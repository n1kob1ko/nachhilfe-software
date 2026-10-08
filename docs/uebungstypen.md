# Abwechslungsreichere Übungen (Lernheft Phase 5A)

Drei Aufgabentypen, bei denen der Schüler selbst schreibt: **Lückentext**, **Fehler korrigieren** und **Freie Antwort**. Sie laufen im bestehenden Übungs-Builder, auf dem Schüler-Tablet, am eigenen Laptop, über den Schüler-Link und im A4-Druck. Es gibt keine eigene Aufgabenarchitektur: alle drei sind Formate im selben Aufgabenmodell (`lib/tasks.ts`).

## Die drei Typen

| Typ | Format | Was der Schüler macht | Wer bewertet |
|---|---|---|---|
| Lückentext | `cloze` | trägt Wörter, Begriffe oder Zahlen direkt in die Lücken eines zusammenhängenden Textes ein | die App, bis zu 3 Versuche |
| Fehler korrigieren | `fix` | bekommt einen Text mit Fehlern und schreibt ihn verbessert | die App, bis zu 3 Versuche; der Lehrer kann die Bewertung ändern |
| Freie Antwort | `free` | schreibt eine eigene Antwort, ein- oder mehrzeilig | der Lehrer: richtig, teilweise richtig oder falsch |

### Lückentext
- Beliebig viele Lücken (`___`) in einem Text.
- Für jede Lücke können mehrere richtige Antworten gelten. Im Editor werden sie mit `|` getrennt, zum Beispiel `bin | war`.
- Groß- und Kleinschreibung zählt je nach Aufgabe; der Haken sitzt im Editor. Bei Zahlen zählt der Wert (0,5 = 0.5).
- Nach einem falschen Versuch werden nur die falschen Lücken rot markiert. Beim Weitertippen verschwindet die Markierung.

### Fehler korrigieren
- Die Aufgabe speichert den **Text mit Fehlern** (`data.faulty`) und den **verbesserten Text** (`answer.accepted`), auch mehrere richtige Fassungen.
- Die einzelnen Fehler (`answer.fixes`: falsch → richtig, mit kurzer Begründung und Fehlerart) erkennt der Editor selbst aus den beiden Texten. Der Lehrer schreibt nur die Begründung dazu.
- Das Eingabefeld beginnt mit dem fehlerhaften Text. Der Schüler verbessert ihn direkt dort; „Zurücksetzen“ holt den Ausgangstext zurück. Unverändert kann er nicht abgegeben werden.
- Die Prüfung (`lib/fix-text.ts`) vergleicht Wörter und Satzzeichen, nicht ganze Zeichenketten. Leerzeichen und Anführungszeichen-Arten zählen nicht. Die Rückmeldung sagt, wie viele Fehler verbessert sind und ob eine richtige Stelle verändert wurde. Verglichen wird mit der richtigen Fassung, die der Antwort am nächsten ist.
- Gespeichert bleibt der Originaltext in der Aufgabe und jeder Versuch des Schülers, so wie er ihn geschrieben hat. Nach der Aufgabe sieht der Schüler seine Fassung neben der richtigen, mit markierten Stellen. Der Lehrer sieht dasselbe im Ergebnis.
- Die Fehlerart einer falschen Antwort kommt aus der Begründung des ersten nicht verbesserten Fehlers.

### Freie Antwort
- Antwortfeld einzeilig, „ein paar Sätze“, „mehrere Sätze“ oder „längerer Text“ (`data.lines`). Mehrzeilig mit Wortzähler.
- Musterlösung (`answer.sample`) und Erwartung in Stichpunkten (`answer.criteria`) für den Lehrer.
- **Eine freie Antwort gilt nie automatisch als falsch.** Nach dem Abgeben steht sie auf „offen“ (`attempts.review = 'offen'`). Der Schüler sieht „Deine Antwort ist gespeichert“ und eine mögliche Antwort.
- Bis zur Lehrerbewertung zählt sie nirgends: nicht im Lernstand, nicht in Statistik, Fortschritt oder Bericht.
- Die frühere Selbsteinschätzung („Hattest du es richtig?“) und die automatische KI-Bewertung von Freitext entfallen. Eine spätere KI-Bewertung kann auf der Spalte `review` aufbauen (zum Beispiel als Vorschlag, den der Lehrer bestätigt).

## Lehrerbewertung
- Im Ergebnis einer Übung stehen bei freien Antworten und Korrekturen drei Knöpfe: **richtig**, **teilweise richtig**, **falsch**. Eine Bewertung kann später geändert werden.
- Auf der Einheit zeigt eine Übung mit offenen Antworten „n zu bewerten“.
- Gespeichert in `attempts.review`, `review_by`, `review_at`. „richtig“ setzt `correct = 1`, die anderen `correct = 0`.
- Lernstand (`lib/mastery.ts`): „teilweise richtig“ zählt 0,5 (−0,15 je Hilfe, mindestens 0,25).
- Fehlerarten lassen sich wie bisher bei falschen und teilweise richtigen Antworten setzen.
- Die Abgabe-ID gegen Doppelzählung bleibt; eine Bewertung legt keinen neuen Versuch an.

## Übungs-Builder
- Schritt 6 „Aufgabentyp“: **Gemischte Aufgaben** (Standard) oder ein oder mehrere Typen. Lückentext, Fehler korrigieren und Freie Antwort stehen vorne.
- Vor dem Erzeugen legt ein **Plan** (`planSlots` in `lib/builder.ts`) für jede Aufgabe Fähigkeit und Typ fest. Gewählte Typen kommen gleich oft dran. Bei „Gemischt“ nimmt jede Fähigkeit ihre passenden Typen der Reihe nach (`mixFor` in `lib/curriculum.ts`); Multiple Choice kommt höchstens einmal pro Runde vor.
- Ohne KI erzeugen die eingebauten Generatoren jeden Typ im richtigen Format. Gibt es für eine Fähigkeit keinen passenden Lückentext oder keine Korrektur, entsteht eine freie Antwort, und der Builder sagt das. Nie wird Multiple Choice als Lückentext ausgegeben.
- Manuell angelegte Aufgaben („Neue Aufgabe“) funktionieren ohne API-Key in allen drei Typen.

## KI-Erzeugung
- Über den bestehenden KI-Router (Funktion `aufgaben`). Die KI bekommt den Plan („Aufgabenplan“) und für jedes Format eigene Regeln.
- Jede Aufgabe enthält strukturiert: Aufgabenstellung, erwartete Antwort (Lücken, Text mit Fehlern und verbesserter Text mit den einzelnen Fehlern, Musterlösung), Antwortzeilen und Bewertungskriterien.
- Was nicht im verlangten Format zurückkommt, wird verworfen (zum Beispiel Antwortoptionen bei einem Lückentext). Fehlende Aufgaben werden einmal nachgefordert, der Rest kommt aus den Generatoren. Wer 5 Lückentexte verlangt, bekommt 5 Lückentexte.
- Die KI bekommt keine Namen, wie bisher.
- Der Lehrer prüft und bearbeitet alles in der Vorschau, bevor er sendet.

## Schüleransicht
- Gleich auf Tablet (`/geraet`), eigenem Laptop (`/mitmachen`) und Schüler-Link (`/lernen/…`, auch am Desktop).
- Lücken wachsen mit der Antwort mit. Korrektur und freie Antwort haben große Textfelder.
- **Zwischenstände** (getippt, noch nicht abgegeben) bleiben auf dem Gerät gespeichert, je Übung und Aufgabe. Nach dem Neuladen sind sie wieder da. Auf dem Laptop beginnen die Schlüssel mit `lernheft-laptop-`, so dass „Fertig“ am Laptop sie mitlöscht.
- Bei Verbindungsabbruch bleibt die Antwort wie bisher stehen und wird mit derselben Abgabe-ID nachgesendet.

## A4-Druck
- Lückentext: Lücken so breit wie die längste richtige Antwort.
- Fehler korrigieren: der Text mit Fehlern in einem Rahmen, darunter Schreiblinien für den verbesserten Text.
- Freie Antwort: so viele Linien wie im Editor gewählt (einzeilig: eine Linie).
- Lehrerfassung: Lösung, weitere richtige Antworten, die Fehler mit Begründung (im Text markiert) und „Darauf kommt es an“. Die Schülerfassung zeigt nichts davon.

## Tests
- `lib/uebungstypen.test.ts`: Lückentext mit mehreren Lücken und Alternativen, Groß-/Kleinschreibung, Korrektur (verbessert, verpasst, zusätzlich geändert), Ablauf in der App, freie Antwort mit Lehrerbewertung und Lernstand, Plan für gemischte Aufgaben, Generatoren ohne KI, KI hält das Format ein, A4-Plan.

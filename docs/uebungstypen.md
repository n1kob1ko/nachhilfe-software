# Abwechslungsreichere Übungen (Lernheft Phase 5A, Auswendig schreiben aus Phase 2)

Aufgabentypen, bei denen der Schüler selbst schreibt: **Lückentext**, **Fehler korrigieren**, **Freie Antwort** und seit dem Merge **Auswendig schreiben**. Sie laufen im bestehenden Übungs-Builder, auf dem Schüler-Tablet, am eigenen Laptop, über den Schüler-Link und im A4-Druck. Es gibt keine eigene Aufgabenarchitektur: alle sind Formate im selben Aufgabenmodell (`lib/tasks.ts`).

## Die Typen

| Typ | Format | Was der Schüler macht | Wer bewertet |
|---|---|---|---|
| Lückentext | `cloze` | trägt Wörter, Begriffe oder Zahlen direkt in die Lücken eines zusammenhängenden Textes ein | die App, bis zu 3 Versuche |
| Fehler korrigieren | `fix` | bekommt einen Text mit Fehlern und schreibt ihn verbessert | die App, bis zu 3 Versuche; der Lehrer kann die Bewertung ändern |
| Freie Antwort | `free` | schreibt eine eigene Antwort, ein- oder mehrzeilig | der Lehrer: richtig, teilweise richtig oder falsch |
| Auswendig schreiben | `memorize` | liest einen Text, blendet ihn Stufe für Stufe aus und schreibt ihn aus dem Gedächtnis auf | die App, bis zu 3 Versuche |

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

### Auswendig schreiben
- Der Text steht in `data.passage`; eine Lösung daneben gibt es nicht — **der Text ist die Lösung**. Der Lehrer schreibt ihn im Editor (Feld „Text zum Auswendiglernen“); mindestens drei Wörter, sonst lässt sich die Aufgabe nicht senden.
- Der Schüler sieht den Text auf vier Stufen (`MEMORIZE_LEVELS` in `lib/memorize.ts`), die er selbst umschaltet:
  1. **Ganzer Text** — zum Lesen.
  2. **Jedes 3. Wort verdeckt** — das dritte, sechste, neunte … Wort steht als `▁▁▁` in der Länge des Wortes.
  3. **Nur erste Buchstaben** — jedes Wort nur mit seinem ersten Buchstaben und `…` („Der Hund läuft“ → „D… H… l…“).
  4. **Ohne Hilfe** — der Text ist ausgeblendet, das Feld wartet auf den ganzen Text.
- Der Schüler schreibt in ein großes Feld darunter; die Umlautleiste (`ä ö ü ß Ä Ö Ü`, `components/UmlautBar.tsx`) steht daneben, weil eine Tablet-Tastatur sie oft nicht hergibt. Die gewählte Stufe bleibt mit dem Entwurf auf dem Gerät gespeichert.
- Geprüft wird **Wort für Wort** mit dem vorhandenen Fassungsvergleich (`compareVersions` in `lib/text-correction-diff.ts`) — es gibt keinen zweiten Vergleich. Satzzeichen, Anführungszeichen und Leerzeichen zählen dabei nicht, Groß- und Kleinschreibung schon. Ein Wort, das der Schüler an der Stelle richtig geschrieben hat, gilt nicht als Fehler; ein zu viel geschriebenes Wort schon.
- Die falschen Wörter stehen als Fehler am Versuch (`attempts.error_label`, im Etikett „Falsche Wörter: …“) und damit in Ergebnis, Dokumentation und Analyse wie jede andere Fehlerbezeichnung. Aus der Wortliste wird **keine** Fehlerart geraten.
- Nach dem Fertigwerden steht der ganze Text wieder da — wie die Lösung bei den anderen Typen.

## Schnellrunde
- Kein eigener Aufgabentyp, sondern ein **Ablauf** für eine Übung: `assignments.mode = 'schnell'` (Vorgabe `'normal'`).
- Geeignet ist nur **Multiple Choice mit zwei bis vier Antworten** — geprüft von `isQuickRound` in `lib/quick-round.ts`. Dieselbe Prüfung benutzen die Lehreroberfläche (Builder-Schritt 6, Sendepanel, `releaseWorksheet`) und die Schülerseite (`showsQuickRound` in `app/lernen/[token]/[aid]/page.tsx`, `app/geraet/page.tsx`, `app/mitmachen/page.tsx`): sie können sich nicht widersprechen. Passt eine Aufgabe doch nicht, wird die Übung ganz normal gesendet bzw. ganz normal angezeigt.
- Ablauf (nach dem Micro-Widget der Tutoring-Plattform): **Anfang** mit Erklärung und „Los geht's“ → je Aufgabe **ein Tipp**, die Rückmeldung bleibt etwa **1,2 s** stehen, dann kommt die nächste Aufgabe von selbst (kein „Weiter“-Knopf) → **Ende** mit dem Ergebnis und „Nochmal üben“ für die noch offenen Aufgaben. Große Flächen (mindestens 76 px hoch), Fortschrittsbalken, Zifferntasten 1–4 am Desktop.
- **Versuche, Zeit und Hilfen werden genau wie sonst gespeichert**: dieselbe Abgabe (`app/actions.ts submitAnswerAction`, `app/device-actions.ts`, `app/laptop-actions.ts`), dieselbe Abgabe-ID gegen Doppelzählung, dieselbe Zeitmessung (`useActiveTime` aus `components/Solver.tsx`) und dieselben Hilfen (`recordHintAction`). Es gibt keine eigene Tabelle und keine eigene Auswertung — Ergebnis und Analyse sehen dasselbe wie im üblichen Ablauf.
- Eine falsche Antwort ist wie sonst ein Versuch von dreien; sie bleibt offen und kann über „Nochmal üben“ wiederholt werden.

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
- Manuell angelegte Aufgaben („Neue Aufgabe“) funktionieren ohne API-Key in allen Typen.
- **Auswendig schreiben** steht als Aufgabentyp bei Deutsch und Englisch (`CATEGORIES` in `lib/curriculum.ts`, Format `memorize`). Die KI erzeugt diesen Typ nicht: den Text gibt die Lehrkraft ein. Wird der Typ gewählt, legt der Builder leere Auswendig-Aufgaben an, die im Editor mit Text gefüllt werden müssen — ohne Text lässt sich die Übung nicht senden.
- Schritt 6 hat zusätzlich **„Als Schnellrunde senden“**. Der Haken lässt sich nur setzen, wenn jeder gewählte Aufgabentyp Multiple Choice erlaubt („Gemischte Aufgaben“ also nicht); sonst steht der Grund daneben. Der Haken ist der Wunsch: Ob die Übung wirklich eine Schnellrunde wird, entscheidet `isQuickRound` beim Senden über die fertigen Aufgaben (lib/quick-round.ts).

## KI-Erzeugung
- Über den bestehenden KI-Router (Funktion `aufgaben`). Die KI bekommt den Plan („Aufgabenplan“) und für jedes Format eigene Regeln.
- Jede Aufgabe enthält strukturiert: Aufgabenstellung, erwartete Antwort (Lücken, Text mit Fehlern und verbesserter Text mit den einzelnen Fehlern, Musterlösung), Antwortzeilen und Bewertungskriterien.
- Was nicht im verlangten Format zurückkommt, wird verworfen (zum Beispiel Antwortoptionen bei einem Lückentext). Fehlende Aufgaben werden einmal nachgefordert, der Rest kommt aus den Generatoren. Wer 5 Lückentexte verlangt, bekommt 5 Lückentexte.
- Die KI bekommt keine Namen, wie bisher.
- Der Lehrer prüft und bearbeitet alles in der Vorschau, bevor er sendet.

## Schüleransicht
- Gleich auf Tablet (`/geraet`), eigenem Laptop (`/mitmachen`) und Schüler-Link (`/lernen/…`, auch am Desktop).
- Lücken wachsen mit der Antwort mit. Korrektur, freie Antwort und Auswendig schreiben haben große Textfelder; bei Textantworten steht die Umlautleiste darunter.
- Eine Übung mit `mode = 'schnell'` läuft als **Schnellrunde** (eigener Ablauf, siehe oben), alles andere im üblichen Ablauf.
- **Zwischenstände** (getippt, noch nicht abgegeben) bleiben auf dem Gerät gespeichert, je Übung und Aufgabe. Nach dem Neuladen sind sie wieder da. Auf dem Laptop beginnen die Schlüssel mit `lernheft-laptop-`, so dass „Fertig“ am Laptop sie mitlöscht.
- Bei Verbindungsabbruch bleibt die Antwort wie bisher stehen und wird mit derselben Abgabe-ID nachgesendet.

## A4-Druck
- Lückentext: Lücken so breit wie die längste richtige Antwort.
- Fehler korrigieren: der Text mit Fehlern in einem Rahmen, darunter Schreiblinien für den verbesserten Text.
- Freie Antwort: so viele Linien wie im Editor gewählt (einzeilig: eine Linie).
- Auswendig schreiben: der Text steht als Lesetext über der Aufgabe, darunter Schreiblinien für die Länge des Textes. In der Lehrerfassung ist der Text zugleich die Lösung.
- Lehrerfassung: Lösung, weitere richtige Antworten, die Fehler mit Begründung (im Text markiert) und „Darauf kommt es an“. Die Schülerfassung zeigt nichts davon.

## Tests
- `lib/uebungstypen.test.ts`: Lückentext mit mehreren Lücken und Alternativen, Groß-/Kleinschreibung, Korrektur (verbessert, verpasst, zusätzlich geändert), Ablauf in der App, freie Antwort mit Lehrerbewertung und Lernstand, Plan für gemischte Aufgaben, Generatoren ohne KI, KI hält das Format ein, A4-Plan.
- Dazu: Auswendig schreiben (richtiger Text, falsche Wörter im Versuch und in der Analyse, die vier Stufen, der gemeinsame Fassungsvergleich, Builder und A4) und die Schnellrunde (Eignung, gleiches Urteil auf Lehrer- und Schülerseite, `assignments.mode` beim Senden).

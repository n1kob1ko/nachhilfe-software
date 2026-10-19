# Minitest am Anfang der Einheit

niko, 2026-10-19: „Was jetzt auch allerdings neu ist und getestet wird, um die Nervosität von
Schülern von Tests wegzukriegen, ist, dass jedes Mal am Anfang der Einheit gleich eine
Probeschularbeit sozusagen oder ein Minitest geschrieben wird über den Stoff, der zuletzt gemacht
wurde. Ähm, dass das auch generiert werden kann hier, das wäre auch super.“ Der Begriff steht in
[CONTEXT.md](../CONTEXT.md): **Minitest**.

| Bereich | Ort |
|---|---|
| Stoff der letzten Einheit, Aufgaben, Erstellen | `lib/minitest.ts` (`letzterStoff`, `minitestAufgaben`, `erstelleMinitest`) |
| Ein Versuch je Aufgabe | `lib/service.ts` `triesFor`, `lib/quick-round.ts` `isMinitest` |
| Keine Tipps, keine freigegebenen Lösungen | `lib/solver-tasks.ts` `clientTasks` |
| Schülerseite: Start, Abgeben, Später, Ergebnis | `components/Solver.tsx` (`test`) |
| Karte in der laufenden Einheit | `components/MinitestKarte.tsx`, `app/minitest-actions.ts` |
| Bericht und Einschätzung | `lib/learning.ts` (`minitest`), `lib/einschaetzung.ts` |

## Ablauf

1. Der Lehrer startet die Einheit. Solange noch nichts beantwortet ist, steht oben die Karte
   „Minitest zum Start“ mit dem Stoff („Stoff vom 12.10. · Mathematik, Bruchrechnung: Kürzen,
   Addieren“), der Anzahl (5, 6 oder 8 Aufgaben, Standard 6) und zwei Knöpfen.
2. **Auf das Tablet** (bzw. „Auf den Laptop“, „Senden“ ohne Gerät): der Minitest ist eine Übung mit
   einer Zuweisung im Modus `test`, das Tablet zeigt ihn sofort.
3. **Drucken**: nur die Übung, kein Eintrag am Gerät; das A4-Blatt öffnet sich, „Zur Einheit“ führt
   zurück. Dort bleibt die Zeile „Minitest gedruckt“ zum Nochmal-Drucken oder doch Senden.
4. Pro Einheit gibt es einen Minitest. Ein zweiter Klick bringt den vorhandenen.

## Am Tablet

- Ein Startbildschirm erklärt die drei Regeln: ohne Tipps, jede Aufgabe einmal abgeben, keine Note.
- „Abgeben“ statt „Prüfen“, keine Rückmeldung zur einzelnen Aufgabe, gleich weiter zur nächsten.
- „Später“ lässt eine Aufgabe für den Schluss; die letzte offene muss abgegeben werden.
- Am Ende: „x von y richtig“, je Aufgabe ✓ oder ✗, und „Fehler sind hier gut: Sie zeigen, was ihr
  heute übt. Ihr schaut euch den Test gleich gemeinsam an.“

Der Lehrer sieht ihn live wie jede Übung, mit „Minitest“ markiert und ohne „Lösung zeigen“.

## Die Aufgaben

Ohne KI, ohne Kosten. Der Stoff ist die neueste beendete Einheit mit Aufgaben am Gerät, im Fach
der laufenden Einheit (sonst im häufigsten Fach). Ein früherer Minitest ist nie selbst Stoff.

Reihum über die Fähigkeiten, schwache zuerst, je Fähigkeit die falsch gelösten Aufgaben zuerst.
Für jede Vorlage:

1. eine neue Variante aus den Generatoren im selben Antwortformat (sonst als Rechnung), die der
   Schüler noch nicht gesehen hat; Erklärungsaufgaben und ganze Lesetexte nicht;
2. sonst eine noch nicht gesehene Aufgabe aus der Aufgabenbibliothek;
3. sonst die Aufgabe der letzten Einheit selbst.

## Danach

Die Antworten laufen über dieselbe Abgabe wie sonst und zählen für Lernstand und Bericht. Die
Einschätzung bekommt den Satz „Minitest am Anfang: 4 von 6 richtig, Fehler bei Kürzen.“; was im
Minitest falsch war, kommt zu „Wiederholen“. In der Mappe steht der Minitest mit den Antworten wie
jede Übung.

## Tests

`lib/minitest.test.ts`: ein Versuch nur im Minitest, die Reihenfolge der Vorlagen, und einmal ganz
durch: kein Stoff ohne frühere Einheit, neue Varianten statt der alten Aufgaben, gedruckt und dann
doch gesendet, keine Tipps, eine falsche Antwort ist sofort fertig, Bericht und Einschätzung, ein
Minitest ist nie selbst Stoff.

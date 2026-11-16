# Ganzes Blatt am Tablet

niko, 2026-11-16: „was wenn er dann die sachen auch erstellt und dann die pdfs wie tests oder arbeitsblätter extra
öffnet wo man dann darin schreiben kann … wichtig ist das auch getrackt wird wie der schüler sich dabei tut wenn er am
pdf arbeitet und das pdf soll auch von der software ausgewertet werden“. Phase 2 von drei nach
[Stoff vorbereiten](stoff-vorbereiten.md). Der Begriff steht in [CONTEXT.md](../CONTEXT.md): **Ganzes Blatt**.

Statt eines echten PDFs zum Ausfüllen nimmt die App ihre eigenen Blätter: dieselben Aufgaben wie am A4-Blatt, aber
jede Antwort wird geprüft, gezählt und dokumentiert.

| Bereich | Ort |
|---|---|
| Wann ein Blatt ganz erscheint, „hängt fest“ | `lib/blatt.ts` (`alsBlatt`, `mitBlatt`, `haengtFest`) |
| Ansicht am Gerät | `components/Solver.tsx` (`BlattAnsicht`, `TaskCard` mit `blatt`) |
| Leere Aufgabe beim „Blatt abgeben“ | `lib/service.ts` `submitAnswer` (`leer`) |
| Live bei der Lehrkraft | `components/device/LiveStatus.tsx` |
| Wahl in der Übung | `app/(tutor)/uebungen/[id]/page.tsx` (`BlattWahl`), `app/builder-actions.ts` `setBlattAction` |
| Tests | `lib/blatt.test.ts` |

## Ablauf

1. Ein Blatt aus „Stoff vorbereiten“ erscheint am Tablet, am eigenen Laptop und über den Schüler-Link als **ganzes
   Blatt**: alle Aufgaben untereinander, oben eine Leiste mit den Nummern (antippen springt hin). Jede andere Übung mit
   mehreren Aufgaben kann die Lehrkraft in der Übung unter „Am Tablet“ umstellen (ganzes Blatt oder eine Aufgabe nach
   der anderen); das gilt sofort, auch für schon gesendete. Leseverständnis und Einzelaufgaben bleiben wie bisher.
2. **Übung** (Übungsblatt): jede Aufgabe hat ihr „Prüfen“ mit Versuchen, Hilfen und „Ich komme nicht weiter“, genau wie
   in der Einzelansicht. Das Ergebnis steht gleich an der Aufgabe (✓, ✗, wird bewertet), am Ende „Geschafft: 6 von 8
   richtig“.
3. **Test** (Vorbereitungstest, Test, Probeschularbeit): zuerst der Startbildschirm, dann das Blatt ohne Knöpfe je
   Aufgabe und ohne Rückmeldung. Unten **Blatt abgeben**. Sind Aufgaben leer, fragt das Blatt einmal („Die Aufgaben 4, 5,
   6 sind noch leer“) mit „Weiterarbeiten“ oder „Trotzdem abgeben“. Danach das Ergebnis wie beim Minitest.
4. **Tracking**: wo der Schüler tippt oder schreibt, ist die aktuelle Aufgabe. Nur dort läuft die Zeit dieser Aufgabe
   (gesamt und aktiv), so dass jede Aufgabe ihre eigene Zeit hat, auch wenn alle gleichzeitig offen sind. Versuche und
   Hilfen zählen wie immer; alles landet im Lernverlauf, in der Dokumentation und im Lernstand.
5. **Hängt fest**: die Lehrkraft sieht im Live-Stand der Einheit (auch in der einzeiligen Ansicht) „hängt bei Aufgabe 2
   fest“, wenn der Schüler in der Übung 2 falsche Versuche an derselben Aufgabe hat oder 5 Minuten daran ist (im Test 8
   Minuten). Es verschwindet, sobald die Aufgabe abgeschlossen ist.
6. **Auswertung**: geprüft wird wie überall (`lib/tasks.ts` `checkAnswer`). Was die App nicht sicher prüfen kann (freie
   Antworten, unsichere Rechenwege), wartet auf die Bewertung der Lehrkraft.

## Regeln

- Eine beim Abgeben leere Aufgabe zählt im Test als **nicht bearbeitet**: falsch und abgeschlossen, nicht „Lösung
  angesehen“ und nicht zum Bewerten für die Lehrkraft. In einer Übung gibt es das nicht (der Server ignoriert es).
- Im Test gibt es weiter keinen Lösungsweg und keine Musterantwort am Gerät.
- Am ganzen Blatt springt der Fokus nicht von selbst in eine Aufgabe.

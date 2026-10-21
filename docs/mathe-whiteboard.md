# Mathe am Whiteboard

niko, 2026-10-19: „Die Übungen die generiert werden wie hier für mathe sind unbrauchbar da es nicht klar
ersichtlich ist was genau gemeint ist und das problem bei Mathe ist auch das man es nicht wikrlich mit der
Tastatur lösen kann da wäre alles am whiteboard besser. Ich habe auch die whiteboard funktion getestet aber da
erscheinen nur 2 aufgaben und der rest wird gar nicht angezeigt und wie wird dann das geprüft wenn der Schüler
am Whiteboard die aufgabe löst.“ Die Begriffe stehen in [CONTEXT.md](../CONTEXT.md): **Aufgabenleiste**,
**Bewerten am Whiteboard**, **KI prüfen**.

| Bereich | Ort |
|---|---|
| Brüche und Hochzahlen erkennen | `lib/math-text.ts` (`splitFractions`), `lib/math-format.ts` (`parseMath`, `clozeParts`) |
| Lücke in der Hochzahl | `components/Solver.tsx`, `components/TaskPreview.tsx`, `components/arbeitsblatt/MathLine.tsx` |
| Mathe auf dem Whiteboard | `lib/whiteboard-templates.ts` (`mathText`, `tasksTemplate`) |
| Aufgabenleiste | `components/whiteboard/TaskBar.tsx`, `components/whiteboard/Whiteboard.tsx` |
| Bewerten | `lib/whiteboard-grades.ts`, Befehle `grade`, `grades`, `solution` in `lib/whiteboard-routes.ts` |
| KI prüfen | `lib/whiteboard-check.ts`, `pruefeWhiteboard` in `lib/ai/features.ts` (KI-Funktion `whiteboard`), Befehl `check` |
| Marke an den Elementen | `customData.aufgabe` (`TaskTag`), der Server behält nur diese (`taskTag` in `lib/whiteboard.ts`) |

## Anzeige

- Eine Hochzahl gehört zu ihrer Basis, auch im Bruch: `x^2/x^9` ist x² über x⁹, `(2a^2·b)^3/(4a^3·b)` ein
  Bruch mit (2a²·b)³ oben und 4a³·b unten. In einer Hochzahl fängt kein Bruch an (`x^(2/3)` bleibt eine Potenz).
  Vorher fraß der Bruch die Hochzahl („x^ 2/x 9“).
- Eine Lücke direkt nach `^` („3^___“) ist eine Hochzahl: sie steht kleiner und hochgestellt, das `^`
  verschwindet. Das gilt in der Übung am Tablet, in der Vorschau und auf dem A4-Blatt.
- Am Whiteboard werden Hochzahlen hochgestellt (eigene, kleinere Textstücke), Brüche mit Bruchstrich, Wurzeln
  mit √. Eine Klammer wird beim Umbrechen nicht getrennt. Ohne Messung (nur in Tests) wird `2^3` zu 2³.

## Aufgabenleiste

Werden Aufgaben aufs Whiteboard gesendet, steht oben eine Leiste „Aufgabe 1 2 3 …“, beim Schüler und beim
Lehrer. Ein Tipp springt zur Aufgabe; die Aufgabe, die gerade zu sehen ist, ist markiert. So sieht der Schüler,
dass weiter unten noch Aufgaben sind (vorher sah das Tablet nur die ersten zwei). Jede Aufgabe hat eine größere
Rechenfläche (300 statt 220 Punkte hoch).

Die Leiste kennt die Aufgaben über eine Marke an jedem Element (`customData.aufgabe`: Nummer, Einfüge-Vorgang,
Aufgabe, Übung). Andere `customData` nimmt der Server weiterhin nicht an.

## Bewerten am Whiteboard

Mathe rechnet der Schüler am Whiteboard mit dem Stift. Der Lehrer sieht den Rechenweg live und bewertet:

1. In der Leiste die Aufgabe antippen (oder hinscrollen).
2. Darunter **Richtig**, **Teilweise** oder **Falsch** tippen. Die Aufgabe bekommt beim Schüler und beim Lehrer
   ihr Zeichen (✓, ½, ✗). Ein zweiter Tipp ändert die Bewertung.
3. **Lösung zeigen** schreibt die Lösung rechts neben die Aufgabe, auf beiden Geräten.

Gespeichert wird eine **Lehrerbewertung** wie bei einer freien Antwort: Antwort „Am Whiteboard gerechnet“,
in der laufenden Einheit, teilweise zählt halb. Sie zählt für den Lernstand und steht in der Dokumentation.

- Gibt es die Übung beim Schüler noch nicht (nur aufs Whiteboard gesendet), wird sie ihm dabei zugewiesen; die
  bewerteten Aufgaben sind darin erledigt.
- Hat der Schüler die Aufgabe in der Übung schon beantwortet, ersetzt die Bewertung vom Whiteboard die der App.
- Hat er sich die Lösung angesehen, bleibt das so.
- Bewerten und Lösung holen darf nur der Lehrer der Einheit. Die Lösung geht nicht mehr mit den Aufgaben ans
  Gerät des Schülers, erst wenn der Lehrer sie zeigt.
- Weiter möglich: in der Übung „Ich rechne am Whiteboard“ ([rechenwege.md](rechenwege.md)), dann prüft die App
  das getippte Ergebnis und der Lehrer den Rechenweg.

## KI prüfen

niko, 2026-10-19: „Warum liest die KI das whiteboard nicht?“, dann auf die Frage, ob der Knopf gebaut werden soll:
„Bauen“. Hilfreich vor allem, wenn zwei Schüler gleichzeitig da sind.

1. In der Zeile zum Bewerten **KI prüfen** tippen.
2. Das Whiteboard macht ein Bild der Aufgabe: der gedruckte Text, die Rechenfläche und alles, was darüber
   geschrieben steht. Die Lösung daneben ist nicht im Bild.
3. Die KI bekommt das Bild, den Aufgabentext und die gespeicherte Lösung. Sie antwortet mit Richtig, Teilweise oder
   Falsch und einem kurzen Grund, oder mit „nicht sicher“, wenn sie die Schrift nicht sicher lesen kann.
4. Darunter steht, was die KI gelesen hat, damit ein Lesefehler auffällt. **Übernehmen** speichert den Vorschlag als
   Bewertung des Lehrers; er kann auch selbst anders bewerten.

- Nur auf Tipp des Lehrers. Der Schüler sieht weder den Knopf noch den Vorschlag, nur die Bewertung danach.
- Nichts wird gespeichert, bevor der Lehrer übernimmt; der Lernstand ändert sich nur durch seine Bewertung.
- Kein Name geht an die KI, nur das Bild der einen Aufgabe mit Aufgabentext und Lösung.
- Lieber „nicht sicher“ als falsch: so steht es im Auftrag an die KI.
- Kosten: eine Anfrage pro Tipp (KI-Funktion `whiteboard`, Bereich Material, mit Nachdenken). Dasselbe Bild noch
  einmal kostet nichts (eine Stunde lang gemerkt). Ohne Lösung bei der Aufgabe wird nicht gefragt.
- Ohne KI, oder in einem Modus, der keine Bilder liest (manuell, DeepSeek), gibt es den Knopf nicht.

## Stiftmodus (niko, 21.10.2026)

Alle Schüler-Tablets haben einen Stift. Deshalb gilt am Tablet der Schüler von Anfang an der Stiftmodus, beim Lehrer schaltet ihn der erste Stiftstrich ein (Excalidraw `penMode`).

- Nur der Stift schreibt. Ein oder zwei Finger schieben das Blatt und zoomen nie, die Hand auf dem Blatt malt nichts (`components/whiteboard/Whiteboard.tsx`, eigene Touch-Behandlung vor Excalidraw).
- Zoomen geht über „Mehr“ › „Größer“ / „Kleiner“ und „Alles zeigen“.
- „Mehr“ › „Mit Finger schreiben“ schaltet den Stiftmodus aus, „Nur Stift schreibt“ wieder ein.
- Vom anderen Gerät ist nur noch der Laserpunkt zu sehen, ohne Namen; Zeiger mit Namen gibt es nicht mehr.

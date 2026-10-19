# Mappe einer Einheit

niko, 2026-10-19: „wichtig ist auch für die jüngeren Schüler, da die immer eine Mappe haben, dass halt
alles, was gemacht wurde am Ende der Einheit, in ein PDF kommt. Also die Übungen, die er gemacht hat,
alle, auch wenn es mehrere Übungen waren. Und die kommen in ein PDF und dass es ausgedruckt werden
kann.“ Der Begriff steht in [CONTEXT.md](../CONTEXT.md): **Mappe**.

| Bereich | Ort |
|---|---|
| Daten: was in der Einheit entstanden ist | `lib/mappe.ts` (`mappeFuerEinheit`, `leseAntwort`) |
| Druckeinstellungen in der Adresse | `lib/mappe-druck.ts` (ohne Datenbank, die Einstellungen im Browser brauchen sie) |
| Das A4-Dokument | `components/arbeitsblatt/Mappe.tsx` |
| Einstellungen links | `components/arbeitsblatt/MappeSettings.tsx` |
| Seite | `app/arbeitsblatt/einheit/[id]/page.tsx` |
| Druck-CSS | `app/arbeitsblatt/arbeitsblatt.css`, Abschnitt „Mappe einer Einheit“ (`.mp-*`) |

## Was hineinkommt

- **Übungen**: jede Übung, in der der Schüler in dieser Einheit geantwortet hat, in der Reihenfolge,
  in der er sie bearbeitet hat. Je Aufgabe die letzte echte Antwort in der Einheit, so wie sie auf
  Papier stünde: angekreuzte Möglichkeit, eingesetzte Lücken, die Zeilen des Rechenwegs, die
  Reihenfolge, der geschriebene Text. Am Rand ✓, ✗, (✓) für teilweise und „–“, wenn er die Lösung
  angesehen hat. Bei Fehlern steht darunter die richtige Lösung. Antworten, die noch auf die
  Bewertung des Lehrers warten, stehen ohne Zeichen da („noch nicht bewertet“).
- Nicht bearbeitete Aufgaben fallen weg, eine Zeile nennt sie („Nicht bearbeitet: Aufgabe 6.“). Mit
  „Nicht bearbeitete Aufgaben zum Weiterüben“ kommen sie wie auf dem Arbeitsblatt mit Platz zum
  Schreiben dazu, ebenso Übungen, die in der Einheit gesendet, aber nicht begonnen wurden.
- **Textarbeiten** der Einheit mit Aufgabe, Bildern (Bildgeschichte) und dem Text, so wie er jetzt ist.
- **Whiteboard**: die Seiten mit Inhalt, als das Vorschaubild, das Excalidraw selbst gezeichnet hat.

Antworten aus anderen Einheiten gehören nicht dazu, auch wenn es dieselbe Übung ist.

## Drucken

Wie Arbeitsblatt und Text: die Vorschau ist der Ausdruck, das PDF macht der Druckdialog des Browsers
(ADR 0001, siehe [druckblatt.md](druckblatt.md)). Der Titel „Einheit vom 19.10.2026“ ist der Kopf der
Mappe; der Name der PDF-Datei bekommt den Namen des Schülers dazu. Keine Aufgabe wird zwischen zwei
Seiten geteilt.

Der Knopf „Mappe drucken“ steht oben auf der beendeten Einheit und als „Mappe“ im Lernverlauf. Ohne
Inhalt (nichts am Gerät, kein Text, nichts am Whiteboard) gibt es keinen Knopf.

## Tests

`lib/mappe.test.ts`: jedes Antwortformat wird gelesen, eine kurze Antwort kommt in die einzige
Lücke, die Einstellungen überleben die Adresse, und eine Einheit bringt genau ihre Übungen mit
richtig, im 2. Versuch richtig, falsch, nicht bearbeitet und Lösung angesehen.

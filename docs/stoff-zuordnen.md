# Stoff zuordnen

niko, 2026-10-19: der Stoffzettel einer 1. Klasse war übernommen, aber keinem Punkt war eine Fähigkeit
zugeordnet, also gab es weder Plan noch Probeschularbeit. „Das wird oft der Fall sein.“ Die Begriffe stehen in
[CONTEXT.md](../CONTEXT.md): **Stoff zuordnen**, **Suchwörter**.

| Bereich | Ort |
|---|---|
| Vorschlag je Punkt des Stoffs, was angehakt ist, Gedächtnis | `lib/lehrplan.ts` (`stoffVorschlag`, `merkeZuordnung`, `matchSkills`) |
| Suchwörter je Fähigkeit und je Thema | `lib/themen/*.ts` (`suchwoerter`, `suchwoerterBisher`) |
| Formularfelder lesen, Gedächtnis schreiben | `app/curriculum-actions.ts` (`zuordnungAus`) |
| Zeilen und Chips | `components/StoffZuordnung.tsx` |
| Beim Eintragen der Schularbeit | `components/ExamForm.tsx` |
| Karte „Stoff zuordnen“ | `app/(tutor)/schueler/[id]/pruefung/[testId]/page.tsx` |

## Ablauf

1. Beim Eintragen (auch nach „Lesen und ausfüllen“ vom Stoffzettel) bekommt jeder Punkt des Stoffs eine Zeile
   mit Fähigkeiten. Was eindeutig passt, ist angehakt; andere Vorschläge liegen hinter „Andere“. Unten steht,
   wie viele Fähigkeiten „Eintragen“ verknüpft.
2. Ist eine Schularbeit ohne Fähigkeiten gespeichert, zeigt die Vorbereitung oben die Karte „Stoff zuordnen“
   mit denselben Zeilen. Ein Punkt ohne Vorschlag bekommt eine Auswahl aller Fähigkeiten der Stufe. „Zuordnen“
   verknüpft; kam der Lehrer über „Probeschularbeit“, geht es dorthin weiter.
3. „Fähigkeiten der Prüfung ändern“ unten auf der Vorbereitung bleibt für später.

## Was angehakt wird

Ohne KI, nur aus den Wörtern (ohne Füllwörter und Endungen):

- Ein Wort zählt umso weniger, je mehr Fähigkeiten es haben („Zahlen“ wenig, „Stellenwerttafel“ viel).
- Angehakt wird eine Fähigkeit nur, wenn sie ein Wort trifft, das nicht bloß ihr Thema nennt, und jede andere
  Fähigkeit mit diesem Wort klar hinter sich lässt. „Erweitern und Kürzen“ hakt beide an, „Vergleichen“ allein
  keine.
- Die anderen Punkte geben das Thema: „Vergleichen“ neben „Runden von natürlichen Zahlen“ heißt natürliche
  Zahlen, neben „Erweitern und Kürzen“ Brüche. Fähigkeiten der eigenen Schulstufe und des genannten Themas
  liegen vorne.
- Ein Punkt, der ein ganzes Thema nennt („Bruchrechnung“, „Kommasetzung“), hakt dessen Fähigkeiten der
  Schulstufe an (höchstens 8), außer zwei andere Punkte nennen schon Teile davon (eine Überschrift wie
  „Natürliche Zahlen“ über ihren Teilen).
- Was ein Lehrer für dieselben Wörter anders gewählt hat (auch „nichts“), gilt beim nächsten Mal, außer die
  Schularbeit ist klar aus einem anderen Thema. Gemerkt wird nur, wo die Wahl vom Vorschlag abweicht.

## Was es nicht macht

- Nichts wird ohne „Eintragen“ oder „Zuordnen“ verknüpft.
- Keine KI und keine Namen: es sind nur die Wörter des Stoffs.
- Suchwörter sind Kapitelnamen und übliche Bezeichnungen, keine Inhalte aus Büchern.

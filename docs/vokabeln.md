# Vokabeln: eigene Listen, vom Foto, üben

Eigene Vokabellisten gehören zu einem Schüler (Schüler › Übungen › Vokabellisten, `lib/vokabellisten.ts`). Eine Zeile ist ein Wort:

```
mobile phone; cell phone = das Handy | My mobile phone is in my bag.
```

Geprüft wird ohne KI (`lib/vokabeln-pruefen.ts`), die Aufgaben macht `lib/vokabeln.ts`.

## Vom Foto lesen (niko, 11.11.2026)

„Wenn ich selbst über Fotos von Vokabeln hochladen kann und dann der Schüler die Vokabeln üben kann, die er auch braucht.“

- **Wo:** Vokabellisten › „Vom Foto“ (öffnet eine neue Liste mit offenem Foto-Bereich) oder im Editor jeder Liste „Vom Foto lesen“.
- **Ablauf:** bis zu 6 Fotos oder PDF-Seiten (Schulbuch, Arbeitsblatt, Vokabelheft) → optional „Nur bestimmte Wörter?“ (z. B. „nur Unit 3“) → Haken „kein echter Name“ → „Vokabeln lesen“. Die Zeilen kommen in das Textfeld (bei einer Liste mit Wörtern darunter, ohne Wörter, die schon da sind), die Überschrift wird der Name, wenn noch keiner dasteht. Rechts zeigt die Vorschau wie immer, wie die App jede Zeile liest. Gespeichert wird erst mit „Liste speichern“.
- **Was die KI tut** (`VOKABELFOTO_SYSTEM` in `lib/ai/features.ts`): Englisch nach links, Deutsch nach rechts, auch wenn das Buch es umgekehrt druckt; abschreiben, was dasteht, nie selbst übersetzen; ein Wort ohne deutsche Bedeutung fällt weg und wird genannt; bei unregelmäßigen Verben nur die Grundform; Lautschrift, Wortart-Kürzel, Übungen und Grammatikkästen weg; ein Beispielsatz kommt nach „|“ mit dem Wort in *Sternchen*.
- **Nicht lesbar:** ein Wort, das die KI nicht sicher lesen kann, steht als `[?]` da. Eine Liste mit `[?]` lässt sich nicht speichern, bis der Lehrer das Wort ergänzt oder die Zeile löscht.
- **Datenschutz und Kosten:** die Fotos werden nicht gespeichert, kein Name aus der App geht mit, nur nach dem Haken. Funktion `vokabelfoto` im Router (Bereich MATERIAL, Sonnet 5.5 wie die anderen Foto-Lesungen), zählt für das Monatsbudget und die Grenze je Schüler; dieselben Fotos werden einen Tag lang nicht noch einmal bezahlt. Schätzung vor dem Klick, etwa 1 bis 2 Cent je Seite.
- **Ohne KI** (nicht eingerichtet, manueller Modus, Budget aus) steht statt des Knopfs der Grund; der Lehrer tippt wie bisher.
- Code: `lib/vokabel-foto.ts`, `lib/vokabel-foto-regeln.ts`, `app/material/vokabeln/route.ts`, `components/VokabelFotoLesen.tsx`. Tests: `lib/vokabel-foto.test.ts`.

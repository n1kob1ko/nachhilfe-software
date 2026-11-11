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

## Selbst üben in der Schüler-App (niko, 11.11.2026)

Jede eigene Liste kann der Schüler selbst üben, ohne KI und ohne dass der Lehrer eine Übung erstellt (`lib/vokabel-training.ts`).

- **Wo:** Start der Schüler-App, Karte „Vokabeln“ mit „X Wörter sind heute dran“ (eine Liste: gleich zum Üben, mehrere: `/lernen/<token>/vokabeln`). Geübt wird über der Seite (`components/lernen/VokabelTrainer.tsx`).
- **Karteikasten:** Fach 0 bis 5 je Wort (`vokabel_stand`). Richtig beim ersten Mal in einer Runde → ein Fach weiter, falsch → Fach 1 (neue bleiben in 0). Wieder dran nach 0, 0, 1, 3, 7, 14 Tagen. Ab Fach 3 „sitzt“ ein Wort.
- **Runde:** bis zu 10 Wörter: zuerst zuletzt falsche, dann fällige (unsicherste zuerst), dann höchstens 5 neue, sonst die unsichersten zum Weiterüben. Ein falsches Wort kommt am Ende der Runde noch einmal, ohne zu zählen.
- **Form nach Fach:** 0 Auswahl aus 3, 1 Auswahl aus 4, 2 geschrieben in beide Richtungen, ab 3 Deutsch → Englisch oder Lücke im Beispielsatz. Die Aufgaben und die Prüfung sind dieselben wie in Übungen (`vokabelAufgabe`, `checkAnswer`).
- **Unsicher:** was die App nicht sicher entscheiden kann (ein Wort, das nicht in der Liste steht), entscheidet der Schüler: „Meins stimmt auch“ zählt als richtig, „War falsch“ als falsch.
- **Lösungen** bleiben auf dem Server (`vokabelrunden`); jede Antwort wird an der beim Start gespeicherten Karte geprüft (`app/vokabel-uebung-actions.ts`).
- **Lehrer:** Vokabellisten zeigt je Liste „Lena übt selbst: 12 sitzen · 8 am Üben · 20 neu“ mit Balken und den Wörtern, die falsch beantwortet wurden. Der Lernstand ändert sich nicht.
- Eine gelöschte Liste nimmt ihren Stand mit. Ändert der Lehrer ein Wort, ist es für den Karteikasten ein neues Wort.
- Tests: `lib/vokabel-training.test.ts`.

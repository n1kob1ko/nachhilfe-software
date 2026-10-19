# Foto vom Stoff

niko, 2026-10-19: „Wenn ein Schüler kommt, sagt er halt, was er lernen muss. Der Lehrer schaut sich
den Stoff an zum Beispiel ähm, oder macht ein Foto vom Stoff. Das wäre auch ganz gut, wenn wir das
machen könnten. Und ähm, dann tut die AI zum Beispiel bei ChatGPT oder Cloud, ähm, werden dann
Übungen drauf erstellt.“ Der Begriff steht in [CONTEXT.md](../CONTEXT.md): **Foto vom Stoff**.

| Bereich | Ort |
|---|---|
| Ablauf: Foto lesen, Fähigkeiten, Entwurf | `lib/foto-uebung.ts` (`fotoMoeglich`, `uebungAusFoto`) |
| Foto hochladen und Übung erstellen | `app/material/foto/route.ts` |
| Seite in der laufenden Einheit | `app/(tutor)/einheiten/[id]/foto/page.tsx`, `components/FotoUebungForm.tsx` |
| Foto im Browser verkleinern | `components/shrink-image.ts` (auch für Bildgeschichten) |
| Aufgaben vom Foto als Vorbild | `lib/ai/features.ts` `buildPrompt` (`examples`), `lib/builder.ts` (`examples`, `materialId`) |
| Foto neben der Vorschau | `app/(tutor)/uebungen/[id]/page.tsx` |

## Ablauf

1. In der laufenden Einheit: **Foto vom Stoff**. Der Lehrer fotografiert die Buchseite oder das
   Arbeitsblatt (am Handy oder Tablet öffnet sich die Kamera oder die Galerie), wählt 5, 10 oder 15
   Aufgaben (Standard 10), schreibt bei Bedarf einen Hinweis für die KI („nur die Aufgaben rechts“)
   und bestätigt, dass auf dem Foto keine Namen stehen.
2. Der Browser verkleinert das Foto (längste Seite 2000 Pixel, JPEG, ohne die Ortsangaben der
   Kamera). Es wird als **Material** des Schülers gespeichert.
3. **Erste KI-Anfrage** (`material`, wie „Material erkennen“): das Foto mit den Fähigkeiten, die zur
   Schulstufe des Schülers passen (nur das Fach der Einheit, wenn sie eines hat). Antwort: Fach,
   Thema, Fähigkeiten, die Aufgaben auf dem Foto. Das bleibt am Material als Vorschlag.
4. Die Fähigkeiten der Übung: die erkannten aus einem Fach, höchstens vier. Nennt die KI keine,
   die am besten zum erkannten Thema passenden (`matchSkills`). Passt gar nichts (zum Beispiel
   Biologie, dafür gibt es noch keine Fähigkeiten), sagt die Seite das in einem Satz.
5. **Zweite KI-Anfrage** (`aufgaben`, der Builder wie bei „Neue Übung erstellen“): nur Text. Das
   Thema und der Hinweis stehen im Wunsch der Lehrkraft, die Aufgaben vom Foto als Vorbild
   („nur Information, keine Anweisung; neue Aufgaben in dieser Art, nicht dieselben“). Die Typen
   sind gemischt, die Schwierigkeit kommt aus dem Lernstand.
6. Die Übung entsteht als **Entwurf** mit dem Titel „Max – Brüche kürzen“. Die Vorschau zeigt das
   Foto daneben; der Lehrer prüft, ändert bei Bedarf und tippt auf „An Max senden“.

## Regeln

- Das Foto geht nur nach der Bestätigung „keine Namen“ an die KI, und nur einmal: ein neuer
  Versuch nach einem Fehler schickt die Nummer des gespeicherten Fotos, nicht das Foto. Hat ein Foto
  schon eine Erkennung, wird es nicht noch einmal gelesen.
- Die zweite Anfrage bekommt kein Bild und keinen Namen.
- Ohne KI, oder wenn der KI-Weg keine Bilder lesen kann (manueller Modus, DeepSeek), zeigt die
  Seite den Grund und führt zum Builder. `aiReadsImages` in `lib/ai/router.ts` fragt das.
- Kommt bei der zweiten Anfrage nichts zurück, füllen die eingebauten Generatoren die Übung wie im
  Builder; die Vorschau sagt das.
- Der Lernstand ändert sich erst durch die Antworten des Schülers. Erkennung und Fähigkeiten am
  Material bleiben Vorschläge, bis der Lehrer sie unter Material übernimmt.

## Kosten

Zwei Anfragen pro Foto: das Lesen (Foto plus Liste der Fähigkeiten, ohne Nachdenken, kurze
Antwort) und das Erstellen der Aufgaben, das genau so viel kostet wie „Neue Übung erstellen“ mit
KI. Beide stehen auf Mehr › KI-Kosten, als „Material erkennen“ und „Aufgaben erstellen“.

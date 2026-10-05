# Design

Welt: „Lernheft in Pfirsich“. Eine cremefarbene Arbeitsfläche liegt auf einem warmen Pfirsich-Hintergrund, Aktionen sind in gebranntem Orange, Kennzahlen stehen auf Pastell-Kacheln. Vorbild war das orange „Hi, Annette“-Dashboard (Hero mit Objekt, Kacheln, Kalender, Tagesplan), kombiniert mit den ruhigen Karten aus dem blauen Beispiel.

- Schrift: Poppins (500–700) für Überschriften und große Zahlen, Plus Jakarta Sans für Text. Zahlen tabellarisch in Daten.
- Flächen: Hintergrund `#f7cfb2` → `#fbe3d0` (Verlauf), Arbeitsfläche `#fbf6f1` mit 32 px Radius, Karten weiß mit 20 px Radius und weichem Schatten, Paneele `#f6eee6`, Linien `#efe3d8`.
- Tinte `#231a15`, zweite Ebene `#5e4a3e`, dritte `#7a6a5f` (≥ 4,5 : 1 auf Creme).
- Akzent `#c94f17` (weißer Text 4,55 : 1) für Buttons und Links; `#ee7a45` nur für Flächen und Icons (heute im Kalender, aktiver Navigationspunkt).
- Kacheln: rosa `#f9d2d0`, mint `#ccebd9`, flieder `#dcd6fb`, pfirsich `#fcdcc3`, jede mit einem großen Eck-Symbol.
- Fächerfarben: Mathe flieder, Deutsch pfirsich, Englisch mint, sonst rosa (`subjectTone` in `components/Calendar.tsx`). Gilt für Tagesplan, Fächer-Tags und Tabellen.
- Formen: Buttons, Pills, Tabs und Navigation sind ganz rund (999 px), Eingabefelder 12 px.
- Illustrationen: SVG-Objekte pro Fach (Taschenrechner, Bücher, Sprechblasen, Heft) mit Lichtkante und Bodenschatten, keine Bilddateien (`components/Art.tsx`). Avatare zeigen Initialen in einer Farbe, die aus dem Namen folgt.
- Fortschrittsbalken: eine Farbe (violett `#6f5bd6`) für die Größe, Schwellen 60 % / 80 % als Lücken im Balken, Status mit Icon + Text. Rot nur für Fehler und Schwächen, Grün für Gelöstes.
- Verlaufsdiagramm: Kategorien-Palette, 2-px-Linien, Legende + Endbeschriftung, Fadenkreuz-Tooltip, Tabellenansicht.
- Schüler-Modus: gleicher Pfirsich-Verlauf, Begrüßung als Hero-Karte mit Fach-Objekt, größere Schrift, eine Aufgabe pro Ansicht.

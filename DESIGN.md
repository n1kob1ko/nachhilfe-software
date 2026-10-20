# Design

Welt: „Lernheft in Elfenbein und Gold“, abgeleitet aus dem Logo von MC Dream Education (Doktorhut in Schwarz, goldenes „m“, offenes Buch, rote Quaste). Eine ruhige Elfenbein-Fläche, weiße Karten mit Haarlinie, Braunschwarz als Schrift und für die Hauptaktion, Gold für alles Aktive und Ausgewählte. Zahlen stehen groß auf Kennzahl-Karten, Erklärungen bleiben hinter ⓘ.

- Marke: das Zeichen (`public/brand/mark.png`, Hut + „m“ + Buch; das Buch gehört immer dazu) neben „Lernheft / MC Dream Education“ in der Seitenleiste, auf Schüler-App, Geräte- und Mitmachen-Seite; das ganze Logo (`public/brand/logo.png`) auf der Anmeldung und im Wochenplan-Druck; `components/Brand.tsx`. App-Symbol `app/icon.png`, `app/apple-icon.png`.
- Schrift: Outfit (500–700) für Überschriften und große Zahlen, Plus Jakarta Sans für Text. Zahlen tabellarisch (`.num`). H1 28–32 px mit −0,02 em.
- Flächen: Seite `#f5f0e8` (Elfenbein), Karten weiß mit 1 px `#e7dfd2` und kaum sichtbarem braunem Schatten, Paneele `#f1eadf`, kräftige Linien `#d3c7b5`. Keine Verläufe auf der Seite.
- Tinte `#221c17`, zweite Ebene `#584d42`, dritte `#716458` (alle ≥ 4,5 : 1 auf Elfenbein und Weiß).
- Akzent: Bronze `#86600f` für Links und Akzent-Text (5,7 : 1 auf Weiß), Gold `#cfa24a` für Flächen und Icons (aktiver Navigationspunkt, Fokusring, heute im Kalender, Fortschritt), helles Gold `#f6ecd4` als Wash. Gold trägt nie weißen Text.
- Hauptaktion (`.btn-primary`): Braunschwarz mit weißer Schrift. Zweite Aktion weiß mit Linie, Hover goldene Linie. Auf der dunklen Bühne wird die Hauptaktion golden mit dunkler Schrift.
- Bühne (`.buehne`): eine dunkle Karte pro Seite in Braunschwarz mit goldenem Lichtfleck oben rechts: die laufende oder nächste Einheit auf der Startseite, die Begrüßung in der Schüler-App. Nebentext `.buehne-meta` (`#cbbda9`).
- Kennzahlen (`.kennzahl`): Wort klein in Grau, Zahl groß in Outfit, eine Zeile Zusatz; in Reihen zu zwei (Handy) oder vier (Laptop). Startseite (heute, als Nächstes, offen, Schüler), Schülerprofil (Lernstand, Trend, Prüfung, Einheiten), Abrechnung (Einheiten, Schüler, Zeit, Lehrer).
- Status: Rot `#b3281f` nur für Fehler und Schwächen, Grün `#1f6b3b` für Gelöstes, Orange-Braun `#9a4e07` für Hinweise; je mit Wash. Violett `#5b55b5` bleibt für seltene Nebenrollen.
- Kacheln und Fächer: Mathe flieder `#e3e0f4`, Deutsch gold `#f5e6c6`, Englisch mint `#d8ecdf`, sonst rosé `#f6dcd7` (`subjectTone` in `components/Calendar.tsx`). Avatare zeigen Initialen in derselben Familie.
- Formen: Buttons, Pills, Tabs und Navigation ganz rund (999 px); Karten 18 px, Bühne 24 px, Eingabefelder 12 px.
- Illustrationen: SVG-Objekte pro Fach in Gold, Creme und Tinte mit Bodenschatten (`components/Art.tsx`), keine Bilddateien.
- Fortschrittsbalken: eine Farbe (Gold `#c6962e`) für die Größe, Schwellen 70 % / 85 % als Lücken, Status mit Icon + Text.
- Bewegung: kurz und nur mit Zweck. Drücken `scale(0.97)` (`.btn`, `.drueck`), Schubfach 300 ms von rechts (`.schubfach`, `--ease-drawer`), Dialog 200 ms (`.dialog-karte`, `--ease-out`). Bei „weniger Bewegung“ alles aus.
- Schüler-Modus: gleiche Fläche, Begrüßung als Bühne mit Fach-Objekt, größere Schrift, eine Aufgabe pro Ansicht.

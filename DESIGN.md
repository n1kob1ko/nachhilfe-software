# Design

Welt: „Lernheft Sonne“, abgeleitet aus dem Logo von MC Dream Education (Doktorhut in Schwarz, goldenes „m“, offenes Buch, rote Quaste). Eine fast weiße, cremige Fläche, weiße Karten mit Haarlinie, warmes Braunschwarz als Schrift, ein kräftiges Orange für alles, was man tun oder gerade sieht: Hauptknöpfe, aktive Navigation, Links, die Bühne. Zahlen stehen groß auf Kennzahl-Karten, Erklärungen bleiben hinter ⓘ.

- Marke: das Zeichen (`public/brand/mark.png`, Hut + „m“ + Buch; das Buch gehört immer dazu) neben „Lernheft / MC Dream Education“ in der Seitenleiste, auf Schüler-App, Geräte- und Mitmachen-Seite; das ganze Logo (`public/brand/logo.png`) auf der Anmeldung und im Wochenplan-Druck; `components/Brand.tsx`. App-Symbol `app/icon.png`, `app/apple-icon.png`.
- Schrift: Outfit (500–700) für Überschriften und große Zahlen, Plus Jakarta Sans für Text. Zahlen tabellarisch (`.num`). H1 28–32 px mit −0,02 em.
- Flächen: Seite `#fffaf4` (Cremeweiß), Karten weiß mit 1 px `#f1dfcf` und kaum sichtbarem warmem Schatten, Paneele `#fff0e4`, kräftige Linien `#e4c9b3`. Verläufe nur auf der Bühne.
- Tinte `#2a221c`, zweite Ebene `#6a5648`, dritte `#7d675a` (alle ≥ 4,5 : 1 auf Cremeweiß und Weiß).
- Akzent: Orange `#bd4211` für Links, Akzent-Text und gefüllte Aktionen mit weißer Schrift (5,3 : 1 auf Weiß); helles Orange `#ff8b4e` für Icons, Punkte, Fokusring und den aktiven Navigationskreis (trägt dunkle Schrift, nie weiße); Wash `#ffe8da` für leichte Flächen. Hover `#a0360c`.
- Hauptaktion (`.btn-primary`): Orange mit weißer Schrift und weichem orangem Schatten. Zweite Aktion weiß mit Linie, Hover orange Linie. Aktive Chips und der heutige Tag im Kalender ebenfalls Orange mit Weiß.
- Bühne (`.buehne`): eine Karte pro Seite im Orange-Verlauf (`#ff8c4f` → `#dc4e16`) mit weißem Lichtfleck oben rechts: die laufende oder nächste Einheit auf der Startseite, die Begrüßung in der Schüler-App. Schrift weiß, Nebentext `.buehne-meta` (`#ffe4d3`), Hauptknopf darin weiß mit oranger Schrift, zweiter Knopf durchscheinend.
- Kennzahlen (`.kennzahl`): Wort klein in Grau, Zahl groß in Outfit, eine Zeile Zusatz; in Reihen zu zwei (Handy) oder vier (Laptop). Startseite (heute, als Nächstes, offen, Schüler), Schülerprofil (Lernstand, Trend, Prüfung, Einheiten), Abrechnung (Einheiten, Schüler, Zeit, Lehrer).
- Status: Rot `#b3281f` nur für Fehler und Schwächen, Grün `#1f6b3b` für Gelöstes, Orange-Braun `#9a4e07` für Hinweise; je mit Wash. Violett `#5b55b5` bleibt für seltene Nebenrollen. Status-Orange und Akzent-Orange treffen sich nie auf derselben Karte als Fläche.
- Kacheln und Fächer: Mathe flieder `#e6e2fb`, Deutsch pfirsich `#ffe3cf`, Englisch mint `#d7f0e2`, sonst rosé `#ffdcd9` (`subjectTone` in `components/Calendar.tsx`). Avatare zeigen Initialen in derselben Familie.
- Formen: Buttons, Pills, Tabs und Navigation ganz rund (999 px); Karten 18 px, Bühne 24 px, Eingabefelder 12 px.
- Illustrationen: SVG-Objekte pro Fach in Orange, Creme und Tinte mit Bodenschatten (`components/Art.tsx`), keine Bilddateien.
- Fortschrittsbalken: eine Farbe (Orange `#f0702f`) für die Größe, Schwellen 70 % / 85 % als Lücken, Status mit Icon + Text.
- Bewegung: kurz und nur mit Zweck. Drücken `scale(0.97)` (`.btn`, `.drueck`), Schubfach 300 ms von rechts (`.schubfach`, `--ease-drawer`), Dialog 200 ms (`.dialog-karte`, `--ease-out`). Bei „weniger Bewegung“ alles aus.
- Schüler-Modus: gleiche Fläche, Begrüßung als Bühne mit Fach-Objekt, größere Schrift, eine Aufgabe pro Ansicht.

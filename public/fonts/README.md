# Schriftdateien

Hier liegen die Schulschriften für das **Nachmalblatt** (`/blaetter/nachmalblatt`,
`lib/druckblatt/rendering/handwriting-scripts.ts`).

**In diesem Projekt liegt keine einzige Schriftdatei.** Portiert aus
`aufgaben_webseite/public/fonts/README.md`; auch dort lagen keine Dateien — es gab nur
diese Anleitung. Die Druckschrift wird über die Systemschrift der App gesetzt
(`--font-sans`, Andika bzw. der System-Fallback), die Schreibschriften musst du selbst
beilegen, weil ihre Lizenzen eine Weitergabe im Repository nicht in jedem Fall erlauben.

Fehlt eine Datei, ist das kein Fehler: Der Generator fällt sichtbar auf die Druckschrift
zurück und schreibt dazu, welche Schrift eigentlich gemeint war
(`fehlendeSchriftHinweis` in `lib/druckblatt/definition/schemas.ts`, angezeigt im Panel
„Schulschrift“). Ein Nachmalblatt in der falschen Schrift wäre schlimmer als eines, das
sagt, dass die Schrift fehlt — das Kind soll genau diese Formen nachmalen.

## Was wohin

| Datei | Schrift | Familienname in der CSS | Lizenz |
| --- | --- | --- | --- |
| `gruenewald-va.woff2` | Vereinfachte Ausgangsschrift (VA) | `Gruenewald VA` | SIL OFL |
| `bienchen-sas.woff2` | Schulausgangsschrift (SAS) | `Bienchen SAS` | SIL OFL |

Beide stammen von **Peter Wiegel** und stehen unter der SIL Open Font License.
Bezugsquellen sind unter anderem `gpaed.de` und `schulschriften.net`.

**Lateinische Ausgangsschrift (LA):** Für sie ist **keine frei lizenzierte Fassung
bekannt**. Wer sie braucht, kauft eine Schrift und trägt sie analog ein. Das steht auch
so in `handwriting-scripts.ts` (`source` der Kennung `la`) und in `docs/druckblatt.md`.

## Einbinden

1. Datei hierher legen, Namen wie in der Tabelle.
2. Falls du ein anderes Format hast (`.ttf`, `.otf`), in `app/globals.css` im Block
   „Schulschriften“ die `src`-Zeile anpassen — oder vorher nach woff2 umwandeln, das ist
   deutlich kleiner.
3. In `lib/druckblatt/rendering/handwriting-scripts.ts` beim passenden Eintrag
   `bundled: true` setzen. Erst dann verschwindet der Hinweis in der Oberfläche.
4. In `app/(tutor)/blaetter/blaetter.css` steht die `font-family`-Kette schon bereit
   (`.db-schrift-va`, `.db-schrift-sas`, `.db-schrift-la`); sie nennt die Schriftfamilie
   zuerst und fällt sonst auf die Druckschrift zurück.

## Was noch zu prüfen ist

Die **x-Höhe** in `handwriting-scripts.ts` ist je Schrift eine Näherung. Sie bestimmt,
wie groß die Buchstaben gesetzt werden, damit sie ins Mittelband der Lineatur passen.
Sitzt es nach dem Einbinden nicht genau, hilft entweder der Regler „Schriftgröße
feinjustieren“ im Generator oder ein korrigierter Wert dort.

## Lizenzpflichten der SIL OFL

- Die Schrift darf mitgeliefert und verändert werden.
- Sie darf **nicht** einzeln verkauft werden.
- Eine veränderte Fassung muss wieder frei verfügbar sein.
- Der Lizenztext gehört mit ins Verzeichnis — lege die `OFL.txt` der jeweiligen Schrift
  daneben.

Damit erstellte Arbeitsblätter darfst du frei weitergeben und auch dafür Geld verlangen.

# Präsentationen: Upload, Vortragstext, Folien-Abgleich

Eine **Präsentation** ist eine Folienfolge mit Animationen, die der Browser so abspielt, wie sie gebaut ist,
dazu ein **Vortragstext** je Folie. Der Lehrer sieht Folie und Text, der Schüler nur die Folien.
Unter Mehr › Präsentationen; Code in `lib/praesentationen.ts`, `lib/praesentation-zip.ts`,
`lib/praesentation-host.ts`, `lib/praesentation-protokoll.ts`.

## Was hochgeladen werden kann

- **eine HTML-Datei** (z. B. eine Präsentation aus claude.ai): wird zu `index.html`.
- **eine ZIP-Datei** mit einer HTML-Präsentation: reveal.js, iSpring, Articulate und alles, was eine
  `index.html` mitbringt.
- **PowerPoint** (.pptx) lässt sich im Browser nicht mit Animationen abspielen. Lernheft lehnt die Datei
  mit einem Hinweis ab: als HTML exportieren (iSpring, Web-Export) oder als PDF speichern.
- **PDF**: kommt ohne Animationen unter Material (dort zeigt Lernheft PDFs schon an).

### Grenzen der ZIP-Datei

| Grenze | Wert |
| --- | --- |
| hochgeladene Datei | höchstens 60 MB |
| Dateien in der ZIP | höchstens 300 (dazu bis 2000 Einträge mit Ordnern und Systemdateien) |
| alles ausgepackt | höchstens 60 MB |
| Pfad | höchstens 240 Zeichen, höchstens 12 Ordner tief |
| Dateiarten | `html htm css js mjs json png jpg jpeg gif webp avif svg ico woff woff2 ttf otf eot mp3 m4a wav ogg oga aac mp4 m4v webm ogv vtt` |

Abgelehnt wird die ganze Datei bei: absoluten Pfaden, `..` oder `.` im Pfad, Backslash, Doppelpunkt
(Laufwerk) oder Steuerzeichen im Namen, symbolischen Links und anderen besonderen Dateien,
verschlüsselten Einträgen, unbekanntem Packverfahren (erlaubt: „stored“ und „deflate“), ZIP64,
mehrteiligen ZIPs, zwei Namen, die sich nur in Groß- und Kleinschreibung unterscheiden, Dateien, die
ausgepackt größer sind als angegeben oder deren Prüfsumme nicht stimmt, und jeder anderen Dateiart.
Ohne ein Wort weggelassen werden `__MACOSX/`, Dateien, die mit einem Punkt beginnen, `Thumbs.db` und
`desktop.ini`.

**Startseite**: die `index.html` (oder `index.htm`), die am weitesten oben liegt; sonst `story.html`
(Articulate); sonst die einzige HTML-Datei. Gibt es keine, lehnt Lernheft die Datei ab.

Gespeichert wird unter `uploads/praesentationen/<token>/` neben dem Material (also in `/data` und in den
Sicherungen). Ausgeliefert werden nur Dateien, die beim Hochladen in der Datenbank verzeichnet wurden.

## Vortragstext

Der Vortragstext steht nur in der Datenbank und erscheint nur auf Lehrerseiten. Die Schüleransicht, das
Tablet und der eigene Laptop bekommen ihn nicht, auch nicht versteckt. Er kommt auf drei Wegen:

1. im Vortrag: bei der Folie „Schreiben“ bzw. „Bearbeiten“,
2. als Datei `lernheft-notizen.json` in der ZIP-Datei (irgendwo; die oberste zählt) oder später einzeln
   unter „Vortragstext aus Datei“. Diese Datei wird gelesen und **nie ausgeliefert**,
3. aus einem **Lernpaket**, das die Präsentation nutzt: bei Folie n steht, was der Lehrer in den Schritten
   mit `folie: n` sagt und fragt ([lernpaket-format.md](lernpaket-format.md)).

Achtung: was in den HTML-Dateien selbst steht (z. B. `<aside class="notes">` bei reveal.js), gehört zur
Präsentation und wird mit ihr ausgeliefert. Vortragstext gehört deshalb in die Notizen-Datei.

### Format `lernheft-notizen.json`

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `format` | ja | immer `"lernheft-praesentation-notizen"` |
| `version` | ja | immer `1` |
| `folien` | ja | Liste mit `{ "folie": n, "notiz": "…" }`; `folie` von 1 bis 500, jede Folie höchstens einmal, `notiz` bis 4000 Zeichen; leere Notizen fallen weg |

Gezählt wird wie im Folien-Abgleich: von 1 an durch alle Folien.

## Beispiel

```json
{
  "format": "lernheft-praesentation-notizen",
  "version": 1,
  "folien": [
    { "folie": 1, "notiz": "Begrüßen. Heute: die vier Fälle. Frage in die Runde: Wer hat schon einmal „wem“ und „wen“ verwechselt?" },
    { "folie": 2, "notiz": "Die Tabelle Schritt für Schritt aufbauen lassen: erst die Fragen, dann die Beispiele." },
    { "folie": 4, "notiz": "Bei falscher Antwort: den Satz umstellen und die Frage noch einmal stellen." }
  ]
}
```

## Folien-Abgleich (postMessage)

Die Präsentation läuft in einem Rahmen mit `sandbox="allow-scripts"` auf einer eigenen Adresse. Damit der
Vortragstext zur Folie passt, sprechen Präsentation und App ein kleines Protokoll über `postMessage`:

| Richtung | Nachricht |
| --- | --- |
| Präsentation → App | `{ "quelle": "lernheft-praesentation", "v": 1, "typ": "bereit", "folien": 12 }` |
| Präsentation → App | `{ "quelle": "lernheft-praesentation", "v": 1, "typ": "folie", "folie": 3, "folien": 12, "schritt": 0 }` |
| App → Präsentation | `{ "quelle": "lernheft", "v": 1, "typ": "gehe-zu", "folie": 3, "schritt": null }` |
| App → Präsentation | `{ "quelle": "lernheft", "v": 1, "typ": "weiter" }` bzw. `"zurueck"` (ein Schritt, Animationen eingeschlossen) |

`folie` zählt von 1 an durch alle Folien (bei reveal.js auch die senkrechten), `folien` ist die Anzahl
oder `null`, `schritt` der gezeigte Animationsschritt der Folie ab 0 (reveal.js: Fragment) oder `null`.

- **reveal.js** spricht das Protokoll von selbst: Lernheft fügt jeder ausgelieferten HTML-Seite vor
  `</body>` ein kleines Skript ein, das ein fertiges globales `Reveal` sucht, Folienwechsel und Fragmente
  meldet und „gehe-zu“, „weiter“, „zurueck“ ausführt.
- **andere Präsentationen** (iSpring, Articulate, eigene): das Skript tut nichts. Der Lehrer blättert in
  der Präsentation selbst und stellt im Vortrag die Folie ein. Eine eigene Präsentation kann das
  Protokoll selbst sprechen:

```js
// in der eigenen Präsentation: melden …
parent.postMessage({ quelle: "lernheft-praesentation", v: 1, typ: "folie", folie: aktuelleFolie, folien: anzahl }, "*");
// … und folgen
addEventListener("message", (e) => {
  if (e.source !== parent || e.data?.quelle !== "lernheft" || e.data.v !== 1) return;
  if (e.data.typ === "gehe-zu") zeigeFolie(e.data.folie);
  if (e.data.typ === "weiter") naechsterSchritt();
  if (e.data.typ === "zurueck") vorigerSchritt();
});
```

Die App nimmt eine Nachricht nur an, wenn sie aus dem eigenen Rahmen kommt (`event.source`), mit dem
Ursprung `"null"` (so meldet sich eine Sandbox ohne `allow-same-origin`) oder der Präsentations-Adresse,
und genau diese Form hat (`lib/praesentation-protokoll.ts`, `leseDeckNachricht`). Die App schickt an
`"*"`, weil eine Sandbox keinen benennbaren Ursprung hat; die Nachrichten enthalten nur Zahlen.

Auf der Lehrerseite blättern auch ein Präsentations-Klicker oder die Tasten Bild ab/auf und Pfeil
rechts/links (solange der Fokus nicht in der Präsentation liegt).

## Schülergerät

Läuft eine Einheit mit Tablet oder eigenem Laptop, zeigt „Am Schülergerät zeigen“ die Präsentation dort
(`units.device_view = "praesentation:<id>:<folie>"`). Jeder Folienwechsel des Lehrers geht als Ereignis
„folie“ über die Live-Verbindung des Geräts; das Gerät lädt dafür nicht neu. Der Animationsschritt geht
nur live mit: ein Gerät, das neu verbindet, zeigt die Folie des Lehrers von ihrem Anfang. „Zurück zu den
Aufgaben“ holt das Gerät zurück. Der Schüler selbst kann keine Präsentation öffnen.

## Aus einem Lernpaket erstellen (KI)

niko, 2026-10-23 (Plan 5.1): „Die KI soll anhand des Unterrichtsthemas automatisch geeignete vorhandene
Präsentationen auswählen. Fehlt eine Präsentation, soll sie später eine neue erstellen können. Diese wird
gespeichert und wiederverwendet.“ Hier geht es um den zweiten Teil, das Erstellen. Code: `lib/praesentation-ki.ts`, `lib/ai/praesentation.ts`,
`lib/praesentation-html.ts`, `components/praesentation/PraesentationKiKnopf.tsx` und `KiVorschlag.tsx`, Test
`lib/praesentation-ki.test.ts`.

1. Auf der Seite eines **geprüften** Lernpakets: **Präsentation erstellen** (hat das Paket schon eine:
   **Neue Präsentation erstellen**, mit Rückfrage). Am Knopf stehen die geschätzten Kosten, aus der Länge des
   Pakets und der Preisliste (`lib/ai/config.ts`), etwa 12 bis 26 Cent mit dem Standardmodell.
2. Eine Anfrage über den Router (`praesentation`, Bereich Aufgaben: Monatsbudget, Protokoll in `ai_calls`,
   manueller Modus). Mit geht nur das Paket: Titel, Fach, Schulart, Klasse, Thema, Ziel und je Schritt Art,
   Minuten, Titel, „Lehrer sagt“, „Lehrer fragt“, die erwartete Antwort, „Bei Fehler“ und die bisherige Folie.
   Keine Aufgaben, keine Notizen, kein Schüler (also auch keine Grenze je Schüler); Namen werden ersetzt.
3. Die KI schreibt **kein HTML**. Sie liefert je Folie einen Titel, wenige Blöcke (Text, Liste, Beispiel,
   Merksatz, kleine Tabelle, Frage; keine Bilder), welche davon erst beim Klicken erscheinen, den
   Vortragstext und die Nummern der Schritte, zu denen die Folie gehört. Lernheft kürzt zu lange Texte, lässt
   leere Blöcke weg und speichert das als **Vorschlag** (`praesentation_entwuerfe`). Zeigt eine Folie die
   erwartete Antwort einer Frage, steht das bei „Noch zu prüfen“: die Folien sieht auch der Schüler.
4. Der Vorschlag zeigt jede Folie neben ihrem Vortragstext und welche Folie jeder Schritt danach zeigt.
   **Übernehmen** baut daraus `index.html` (das Gerüst des Skills „lernheft-lernpaket“, jeder Text escapt, nur
   `**fett**` wird fett) und `lernheft-notizen.json`, packt beides als ZIP und speichert es über denselben Weg
   wie ein Upload, mit derselben Prüfung. Die Präsentation ist „mit KI erstellt“ und **Ungeprüft**, bis ein
   Lehrer auf ihrer Seite „Geprüft“ tippt. Sie wird mit dem Paket verknüpft, jeder Schritt bekommt die erste
   Folie, die zu ihm gehört (sonst keine), und sie gilt für jeden Schüler, der das Paket bekommt. Eine
   frühere Präsentation des Pakets bleibt unter Präsentationen. **Verwerfen** ändert nichts.
5. Ohne KI (ausgeschaltet, kein Schlüssel, Budget aufgebraucht) sagt der Bereich das, der Knopf bleibt aus,
   und es geht keine Anfrage hinaus. Hochladen geht weiter.

## Sicherheit und Einrichtung

Hochgeladene Präsentationen enthalten fremde Skripte. Sie sind deshalb vollständig von den
Schülerdaten und den Sitzungen getrennt, mehrfach:

1. **Eigene Adresse.** Präsentationen laufen nur unter `PRESENTATION_ORIGIN`, z. B.
   `https://folien.example.at`, nie unter der Adresse der App. Die App erkennt die Adresse am Host:
   dort antwortet nur `/deck/<token>/…`, alles andere (Seiten, Anmeldung, Schülerlinks, Tablet) ist 404;
   unter der Adresse der App ist `/deck/…` 404 (`proxy.ts`, `lib/praesentation-host.ts`). Die
   Sitzungs-Cookies gelten nur für den Rechnernamen der App (kein `Domain`-Attribut); auf der
   Präsentations-Adresse zählt zudem keine Sitzung (`lib/praesentation-anfrage.ts`).
   Die Präsentations-Adresse muss ein **anderer Rechnername** sein; ein anderer Port reicht nicht, weil
   Cookies für alle Ports gelten. Am besten eine eigene Domain statt einer Subdomain der App.
2. **Sandbox.** Der Rahmen hat `sandbox="allow-scripts"`: kein gleicher Ursprung, keine Formulare,
   keine Popups, keine Navigation der Seite. Dieselbe Sandbox steht auch im CSP-Header, falls jemand eine
   Datei direkt öffnet.
3. **CSP** jeder Datei: Skripte, Styles, Bilder, Schriften und Medien nur aus dem eigenen Ordner der
   Präsentation (inline erlaubt), `connect-src 'none'`, keine Rahmen, Worker, Formulare oder `base`,
   `frame-ancestors` nur die App (`PUBLIC_URL` bzw. die Railway-Domain; ohne beides `localhost` und
   `127.0.0.1` mit jedem Port), dazu `X-Content-Type-Options: nosniff`. Was eine Präsentation von außen
   laden will, wird blockiert; beim Hochladen zeigt Lernheft, welche Adressen das sind.

Ohne `PRESENTATION_ORIGIN` gehen Hochladen und Liste trotzdem, abspielen nicht: der Vortrag zeigt der
Verwaltung, dass die Adresse fehlt. Lernheft liefert Präsentationen **nie** unter der eigenen Adresse aus.

Einrichten:

- **Railway**: dem Dienst eine zweite Domain geben (z. B. `folien.example.at`), dann
  `PRESENTATION_ORIGIN=https://folien.example.at` und `PUBLIC_URL=https://lernheft.example.at` setzen.
- **Lokal / Entwicklung**: App unter `http://localhost:3000`, `PRESENTATION_ORIGIN=http://127.0.0.1:3000`.
- **Im Netz des Instituts**: zwei Rechnernamen, die beide auf den Server zeigen, und `PUBLIC_URL` auf die
  Adresse der App (sonst darf das Tablet die Präsentation nicht im Rahmen zeigen).

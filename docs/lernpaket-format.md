# Lernpakete und ihr Dateiformat

niko, 2026-10-22: Eine vorbereitete Einheit zu einem Thema, einmal gebaut und für viele Schüler
verwendet: Ablauf mit Minuten, Reihenfolge der Erklärungen, was der Lehrer sagt und fragt, die
erwartete Antwort, was bei einem Fehler hilft, Beispiele, Verständnisfragen, Übungen mit Lösungen,
typische Fehler, Zusatzübungen und eine Kontrolle am Ende. Was unsicher ist, muss ein Mensch prüfen
können.

Ein **Lernpaket** gehört zu einem Thema, nicht zu einem Schüler. Die Datei hier ist das Format für
Import und Export: eine JSON-Datei, `"format": "lernheft-lernpaket"`, `"version": 1`.

| Bereich | Ort |
|---|---|
| Tabellen | `lernpakete`, `lernpaket_schritte` in `lib/db.ts` |
| Logik, Prüfung, Import und Export | `lib/lernpakete.ts` (`leseLernpaket`, `importiereLernpaket`, `exportiereLernpaket`, `listLernpakete`, `markiereGeprueft`, `archiviereLernpaket`) |
| Aktionen | `app/lernpaket-actions.ts` |
| Bibliothek | Mehr › Lernpakete (`app/(tutor)/mehr/lernpakete/page.tsx`) |
| Paket ansehen und bearbeiten | `app/(tutor)/mehr/lernpakete/[id]/page.tsx` |
| Export (Download) | `app/(tutor)/mehr/lernpakete/[id]/export/route.ts` |
| Tests | `lib/lernpakete.test.ts` (prüft auch das Beispiel unten) |
| Mit KI entwerfen | `lib/lernpaket-ki.ts`, `lib/ai/lernpaket.ts`, `components/LernpaketKiForm.tsx`, Test `lib/lernpaket-ki.test.ts`, Probelauf `npm run ai:lernpaket` |

## Ablauf in der App

1. Mehr › **Lernpakete** › **Importieren**: eine `.json`-Datei wählen (höchstens 1 MB). Die App prüft
   sie ganz. Bei einem Fehler wird nichts gespeichert, und die Meldung nennt Schritt, Aufgabe und Feld,
   zum Beispiel: `Schritt 4 („Verständnisfrage“), Aufgabe 1: Bitte die richtige Antwort markieren.`
2. Ein importiertes Paket ist ein **Entwurf** mit der Herkunft „importiert“ und trägt den Hinweis
   **Ungeprüft**, bis ein Lehrer es durchgeht und **Geprüft** tippt. Offene Punkte aus `pruefen` muss er
   dabei bestätigen; danach sind sie erledigt.
3. **Exportieren** lädt das Paket in genau diesem Format herunter. Importiert man die Datei wieder,
   entsteht dasselbe Paket (als neuer Entwurf).
4. Gelöscht wird kein Paket. **Archivieren** nimmt es aus der Liste; unter „Archiviert“ ist es mit allen
   Schritten weiter da und lässt sich wiederherstellen.

## Mit KI entwerfen

niko, 2026-10-23 (Plan 2.1): „Lernpaket entwerfen“ zu einem Thema; alles kommt „ungeprüft“.

1. Mehr › **Lernpakete** › **Mit KI entwerfen**: eine Fähigkeit wählen (oder Fach und Thema eintippen),
   Schulart, Klasse, Dauer (Vorgabe 50 Minuten), Schwierigkeit und bei Bedarf Hinweise (zum Beispiel
   typische Fehler). Am Knopf stehen die geschätzten Kosten (etwa 15 bis 25 Cent je Paket).
2. Eine Anfrage an die KI über den Router (`lernpaket`, Bereich Aufgaben: Budget, Protokoll in `ai_calls`,
   manueller Modus). Die Seite zeigt, wie lange sie schon läuft; das dauert meist ein bis drei Minuten.
   Ein Doppelklick wartet auf dieselbe Anfrage. Bei einem Fehler wird nichts gespeichert, die Meldung
   sagt warum, und **Erneut versuchen** schickt dasselbe noch einmal.
3. Die Antwort wird eine Datei in diesem Format und geht durch dieselbe Prüfung wie ein Import. Fach,
   Schulart, Klasse, Thema, Fähigkeit, Schwierigkeit und Dauer kommen vom Lehrer, nie von der KI; passen
   die Minuten nicht zur Dauer, werden sie im Verhältnis angepasst. Gespeichert wird ein **Entwurf** mit
   der Herkunft „von der KI“, **Ungeprüft**, und die Kosten aus `ai_calls` stehen auf der Seite des Pakets.
4. Was die KI unsicher findet, steht im Schritt unter `pruefen` („Noch zu prüfen“).

Regeln:

- Kein Schülerdatum geht mit: ein Paket gehört zu einem Thema. Die Anfrage hat weder Schüler noch Einheit
  (also auch keine KI-Hinweise); Namen von Schülern und Lehrern in den Hinweisen und im Bestand werden
  durch [Name] ersetzt.
- Die KI bekommt die Fähigkeit mit Schulstufen, Lernziel und Beschreibung aus dem Lehrplan, die Erklärung
  und die typischen Fehler der App. Sie soll lieber weniger und dafür sichere Schritte und Aufgaben
  liefern, keine Zitate, Seitenzahlen oder Quellen erfinden und österreichische Begriffe verwenden.
- Aufgaben zuerst aus dem Bestand ohne KI: bis zu 8 aus der Aufgabenbibliothek und bis zu 6 aus den
  eingebauten Generatoren (mit den Aufgabenbanken) für diese Fähigkeit, jede vorher wie beim Import
  geprüft. Die KI wählt sie über ihre Kennung (`B…`, `G…`); eine Kennung, die nicht im Bestand steht,
  fällt weg.
- Eigene Aufgaben der KI nur, wo der Bestand nicht reicht (höchstens 2 je Schritt, 6 im Paket). Jede geht
  durch dieselben Prüfungen wie eine KI-Aufgabe im Builder (`aiTaskToDraft`: nur die Formate ihres
  Aufgabentyps, Rechenweg nachgerechnet, Wortarten geprüft) und danach durch die des Imports. Was nicht
  besteht, fällt weg; zweifelhafte Wortarten bleiben mit `data.pruefen` stehen. Ohne Fähigkeit gibt es
  keine Aufgaben.
- Ohne KI (ausgeschaltet, kein Schlüssel, Budget aufgebraucht) sagt der Bereich das und der Knopf bleibt
  aus; Neues Lernpaket und Importieren gehen weiter.

Probelauf ohne die App, eigene Wegwerf-Datenbank: `npm run ai:lernpaket -- --skill deutsch.grammatik.faelle`
(kostet nichts, Tokens geschätzt). Mit `--echt` geht eine echte Anfrage an den eingestellten Anbieter und
zeigt Tokens und Kosten; dazu `--schulart`, `--klasse`, `--dauer`, `--schwierigkeit`, `--hinweise` und
`--datei paket.json` (das Paket zum Ansehen oder Importieren).

## Das Paket

| Feld | Pflicht | Inhalt |
|---|---|---|
| `format` | ja | immer `"lernheft-lernpaket"` |
| `version` | ja | immer `1` |
| `titel` | ja | höchstens 120 Zeichen, z. B. „Die vier Fälle“ |
| `fach` | ja | Schulfach, z. B. „Deutsch“ (Schreibweise wie in der App) |
| `schulart` | nein | `Volksschule`, `Mittelschule`, `Gymnasium`, `HTL`, `HAK` (auch `VS`, `MS`, `AHS`); leer = jede |
| `klasse` | nein | Klasse der Schulart (VS 1–4, MS 1–4, Gymnasium 1–8, HTL/HAK 1–5); nur mit `schulart` |
| `thema` | nein | z. B. „Grammatik“ |
| `faehigkeiten` | nein | Kennungen von Fähigkeiten in Lernheft, die wichtigste zuerst, z. B. `"deutsch.grammatik.faelle"`. Die Kennung steht in der Adresse der Fähigkeitsseite (`/faehigkeiten/deutsch.grammatik.faelle`). Sie muss zum `fach` gehören. |
| `schwierigkeit` | nein | `sehr leicht`, `leicht`, `mittel` (Vorgabe), `schwer`, `sehr schwer` |
| `dauer_minuten` | nein | muss die Summe der `minuten` aller Schritte sein; weglassen = die App rechnet sie |
| `ziel` | nein | was der Schüler am Ende kann, ein bis zwei Sätze |
| `schritte` | ja | 1 bis 60 Schritte in der Reihenfolge des Unterrichts |

Unbekannte Felder sind ein Fehler (meist ein Tippfehler wie `lehrer_sagtt`).

## Ein Schritt

| Feld | Pflicht | Inhalt |
|---|---|---|
| `art` | ja | siehe unten |
| `titel` | ja | kurz, was passiert |
| `minuten` | ja | ganze Zahl 1–240 |
| `lehrer_sagt` | nein | was der Lehrer sagt oder erklärt, wörtlich |
| `folie` | nein | Nummer der Folie einer Präsentation, die dazu gezeigt wird (ab 1), sonst `null` |
| `lehrer_fragt` | nein | die Frage an den Schüler |
| `erwartete_antwort` | nein | was der Schüler antworten soll |
| `bei_fehler` | nein | was der Lehrer bei einer falschen Antwort tut; typische Fehler gehören hierher |
| `notiz` | nein | nur für den Lehrer (Material, Tafelbild, Zeit sparen) |
| `pruefen` | nein | Liste: was ein Mensch noch prüfen muss („Ist der Genitiv in der 4. Klasse schon bekannt?“) |
| `aufgaben` | nein | 0 bis 30 Aufgaben im Format der Übungen (siehe unten) |

Arten (`art`) und wie die App sie nennt:

| `art` | in der App | wofür |
|---|---|---|
| `einstieg` | Einstieg | Anknüpfen, Neugier wecken |
| `erklaerung` | Erklärung | neuer Stoff, in der Reihenfolge der Erklärungen |
| `beispiel` | Beispiel | vorgezeigtes Beispiel |
| `frage` | Verständnisfrage | kurze Frage mit erwarteter Antwort |
| `gefuehrte_uebung` | Gemeinsam üben | Lehrer und Schüler lösen gemeinsam |
| `uebung` | Übung | der Schüler übt allein |
| `zusatz` | Zusatzübung | nur bei Schwierigkeiten; die Minuten zählen mit, also einplanen |
| `kontrolle` | Kontrolle | Abschlusskontrolle: sitzt es? |
| `abschluss` | Abschluss | Zusammenfassung, Ausblick |

## Aufgaben

Eine Aufgabe hat dasselbe Format wie jede Aufgabe einer Übung (`TaskDraft` in `lib/tasks.ts`), damit sie
später als Übung an einen Schüler gehen kann. Sie wird beim Import mit denselben Regeln geprüft wie im
Übungs-Editor (`normalizeTask`, `checkTask` in `lib/builder.ts`).

| Feld | Pflicht | Inhalt |
|---|---|---|
| `type` | ja | Antwortformat: `mc`, `calc`, `free`, `cloze`, `grammar`, `reading`, `order`, `fix`, `memorize`, `rechenweg`, `sachaufgabe`, `zuordnung` |
| `prompt` | ja | Aufgabenstellung; Lücken als `___` |
| `skillId` | nein | Fähigkeit der Aufgabe; ohne Angabe die erste aus `faehigkeiten` |
| `difficulty` | nein | wie `schwierigkeit`; ohne Angabe die des Pakets |
| `data` | je nach Format | z. B. `options` (Multiple Choice), `passage` (Lesetext), `faulty` (Text mit Fehlern), `steps` (Reihenfolge), `lines` (Zeilen für eine freie Antwort), `pruefen` (offene Punkte zu dieser Aufgabe) |
| `answer` | je nach Format | z. B. `correct` (Index der richtigen Option, ab 0), `accepted` (richtige Kurzantworten), `blanks` (je Lücke die richtigen Wörter), `mode` (`text`, `exact` = Groß/klein zählt, `value` = Zahlenwert), `sample` (Musterlösung) |
| `solution` | nein | Lösungsweg in Worten |
| `hints` | nein | bis zu 6 Hilfen: Denkanstoß, Regel, erster Schritt |
| `errorMap` | nein | typische falsche Antworten: `{"answer": "0", "label": "…"}` (bei Multiple Choice der Index als Text) |
| `category` | nein | Aufgabentyp wie im Builder (z. B. `textaufgabe`) |

Die häufigsten Formate kurz:

- `mc`: `data.options` (2–5 Texte), `answer.correct` (Index ab 0).
- `grammar` (Kurzantwort) und `calc` (Rechnung): `answer.accepted` mit allen richtigen Antworten; `calc` vergleicht den Zahlenwert.
- `cloze`: im `prompt` je Lücke `___`, `answer.blanks` mit einer Liste je Lücke, gleich viele wie Lücken.
- `free`: `answer.sample` und/oder `answer.criteria`; bewertet der Lehrer.

Eine Aufgabe mit offenen Punkten in `data.pruefen` wird importiert, gilt aber erst als fertig, wenn ein
Lehrer das Paket geprüft hat.

## Vollständiges Beispiel

Deutsch, 4. Klasse Volksschule, „Die vier Fälle“, 50 Minuten in 7 Schritten.

```json
{
  "format": "lernheft-lernpaket",
  "version": 1,
  "titel": "Die vier Fälle",
  "fach": "Deutsch",
  "schulart": "Volksschule",
  "klasse": 4,
  "thema": "Grammatik",
  "faehigkeiten": ["deutsch.grammatik.faelle"],
  "schwierigkeit": "mittel",
  "dauer_minuten": 50,
  "ziel": "Der Schüler kennt die vier Fälle mit ihren Fragen und bestimmt den Fall eines Nomens mit der Frageprobe.",
  "schritte": [
    {
      "art": "einstieg",
      "titel": "Detektivfragen",
      "minuten": 5,
      "lehrer_sagt": "Heute sind wir Detektive. Jedes Nomen in einem Satz hat einen Fall, und wir finden ihn mit einer Frage.",
      "folie": 1,
      "lehrer_fragt": "Wer bellt im Satz „Der Hund bellt.“?",
      "erwartete_antwort": "Der Hund.",
      "bei_fehler": "Den Satz langsam vorlesen und auf das Zeitwort zeigen: Wer tut das?",
      "notiz": "",
      "pruefen": [],
      "aufgaben": []
    },
    {
      "art": "erklaerung",
      "titel": "Vier Fälle, vier Fragen",
      "minuten": 10,
      "lehrer_sagt": "Es gibt vier Fälle. 1. Fall: Wer oder was? 2. Fall: Wessen? 3. Fall: Wem? 4. Fall: Wen oder was? Die Frage stellen wir immer zusammen mit dem Zeitwort.",
      "folie": 2,
      "lehrer_fragt": "Mit welcher Frage findest du den 3. Fall?",
      "erwartete_antwort": "Wem?",
      "bei_fehler": "Auf die Tabelle auf der Folie zeigen und die vier Fragen gemeinsam laut sagen.",
      "notiz": "Tabelle mit den vier Fragen an die Tafel schreiben und stehen lassen.",
      "pruefen": [],
      "aufgaben": []
    },
    {
      "art": "beispiel",
      "titel": "Ein Satz, vier Fälle",
      "minuten": 8,
      "lehrer_sagt": "Schau dir den Satz an: „Der Bub gibt dem Hund des Nachbarn einen Knochen.“ Wir fragen nach jedem Nomen.",
      "folie": 3,
      "lehrer_fragt": "Wem gibt der Bub den Knochen?",
      "erwartete_antwort": "Dem Hund. Das ist der 3. Fall.",
      "bei_fehler": "Kommt „Wen oder was?“, die Frage mit dem Zeitwort sprechen lassen: „Wem gibt er den Knochen?“",
      "notiz": "",
      "pruefen": ["Ist der Genitiv („des Nachbarn“) in der 4. Klasse schon bekannt? Sonst ein Beispiel ohne 2. Fall nehmen."],
      "aufgaben": []
    },
    {
      "art": "frage",
      "titel": "Verständnisfrage",
      "minuten": 5,
      "lehrer_sagt": "",
      "folie": 4,
      "lehrer_fragt": "Im Satz „Ich sehe den Baum.“: Welcher Fall ist „den Baum“?",
      "erwartete_antwort": "Der 4. Fall: Wen oder was sehe ich? Den Baum.",
      "bei_fehler": "Typischer Fehler: „Wer oder was?“ gefragt. Zeigen: Wer sieht? Ich. Was sehe ich? Den Baum.",
      "notiz": "",
      "pruefen": [],
      "aufgaben": [
        {
          "type": "mc",
          "prompt": "Ich sehe den Baum. Welcher Fall ist „den Baum“?",
          "data": { "options": ["1. Fall (Wer oder was?)", "2. Fall (Wessen?)", "3. Fall (Wem?)", "4. Fall (Wen oder was?)"] },
          "answer": { "correct": 3 },
          "solution": "Wen oder was sehe ich? Den Baum. Also 4. Fall.",
          "hints": ["Stell die Frage mit dem Zeitwort „sehen“.", "Wer sieht? Ich. Und was sehe ich?"],
          "errorMap": [{ "answer": "0", "label": "Nach „Wer oder was?“ statt „Wen oder was?“ gefragt" }]
        }
      ]
    },
    {
      "art": "gefuehrte_uebung",
      "titel": "Gemeinsam bestimmen",
      "minuten": 10,
      "lehrer_sagt": "Jetzt machen wir zwei Aufgaben zusammen. Du sagst mir zuerst die Frage, dann den Fall.",
      "folie": null,
      "lehrer_fragt": "Welche Frage passt zu „dem Kind“ in „Die Oma hilft dem Kind.“?",
      "erwartete_antwort": "Wem hilft die Oma? Dem Kind. 3. Fall.",
      "bei_fehler": "Die vier Fragen der Reihe nach ausprobieren lassen, bis eine passt.",
      "notiz": "",
      "pruefen": [],
      "aufgaben": [
        {
          "type": "grammar",
          "prompt": "Die Oma hilft dem Kind. In welchem Fall steht „dem Kind“?",
          "answer": { "accepted": ["3. Fall", "dritter Fall", "Dativ"], "mode": "text" },
          "solution": "Wem hilft die Oma? Dem Kind. Also 3. Fall.",
          "hints": ["Frag: Wem hilft die Oma?"]
        },
        {
          "type": "cloze",
          "difficulty": "leicht",
          "prompt": "Die Frage für den 2. Fall heißt: ___? Die Frage für den 4. Fall heißt: ___ oder was?",
          "answer": { "blanks": [["Wessen"], ["Wen"]], "mode": "text" },
          "solution": "2. Fall: Wessen? 4. Fall: Wen oder was?"
        }
      ]
    },
    {
      "art": "uebung",
      "titel": "Allein üben",
      "minuten": 8,
      "lehrer_sagt": "Jetzt bist du dran. Schreib zuerst die Frage auf, dann den Fall.",
      "folie": null,
      "lehrer_fragt": "",
      "erwartete_antwort": "",
      "bei_fehler": "Bei zwei Fehlern hintereinander die Tabelle von der Tafel zu Hilfe nehmen.",
      "notiz": "",
      "pruefen": [],
      "aufgaben": [
        {
          "type": "grammar",
          "prompt": "Der Vater liest die Zeitung. In welchem Fall steht „der Vater“?",
          "answer": { "accepted": ["1. Fall", "erster Fall", "Nominativ"], "mode": "text" },
          "solution": "Wer liest die Zeitung? Der Vater. Also 1. Fall."
        },
        {
          "type": "grammar",
          "prompt": "Der Vater liest die Zeitung. In welchem Fall steht „die Zeitung“?",
          "answer": { "accepted": ["4. Fall", "vierter Fall", "Akkusativ"], "mode": "text" },
          "solution": "Wen oder was liest der Vater? Die Zeitung. Also 4. Fall.",
          "errorMap": [{ "answer": "1. Fall", "label": "Nach „Wer oder was?“ gefragt" }]
        }
      ]
    },
    {
      "art": "kontrolle",
      "titel": "Abschlusskontrolle",
      "minuten": 4,
      "lehrer_sagt": "Zum Schluss: Sag mir alle vier Fälle mit ihren Fragen.",
      "folie": 5,
      "lehrer_fragt": "Wie heißen die vier Fragen?",
      "erwartete_antwort": "Wer oder was? Wessen? Wem? Wen oder was?",
      "bei_fehler": "Die fehlende Frage auf Folie 2 zeigen und am Anfang der nächsten Einheit wiederholen.",
      "notiz": "",
      "pruefen": [],
      "aufgaben": [
        {
          "type": "mc",
          "prompt": "Mit welcher Frage findest du den 3. Fall?",
          "data": { "options": ["Wer oder was?", "Wessen?", "Wem?", "Wen oder was?"] },
          "answer": { "correct": 2 },
          "solution": "Der 3. Fall antwortet auf „Wem?“."
        }
      ]
    }
  ]
}
```

## Versionen

Nur `"version": 1` gibt es. Ändert sich das Format so, dass alte Dateien nicht mehr passen, steigt die
Nummer; die App sagt dann „Version 2 kennt Lernheft nicht“, statt die Datei falsch zu lesen.

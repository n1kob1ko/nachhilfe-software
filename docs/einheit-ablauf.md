# Geführter Ablauf der Einheit

niko, 26.11.2026: „Es ist gerade zu viel drauf. Die Lehrer sind nicht wirklich gut mit der Technik. Der Ablauf soll klar und einfach sein.“

Eine laufende Einheit zeigt oben die Stufen und darunter **eine** Karte mit **einem** großen Knopf:

```
Start ─┬─ Weiter mit dem Stoff vom letzten Mal → Kurztest → Üben → Hausübung
       └─ Neues Thema → Stoff (Fotos/Text) → Erklären → Üben → Hausübung
```

| Stufe | Was die Karte zeigt | Großer Knopf | Woher |
| --- | --- | --- | --- |
| Start | Stoff und Ergebnis vom letzten Mal | „Weiter mit …“ / „Neues Thema“ | `letzterStoff` (lib/minitest.ts) |
| Kurztest | 6 Aufgaben, ein Versuch, ohne Tipps; dann Stand und Ergebnis je Thema | „Kurztest ans Tablet senden“, danach „Aufgaben zu den Fehlern bei … senden“ | `erstelleMinitest`, `kurztestStand` |
| Stoff | Mit KI: Fotos (bis 10) oder Text → ein Lauf von „Stoff vorbereiten“ (Präsentation, Lernpaket mit Sprechtext und Fragen, Übungsblatt, Lernzettel); „wird erstellt“, dann „Fertig: …“ mit „Kurz prüfen“. Ohne KI oder „Ohne Präsentation“: „Was steht heute an?“ | „Präsentation und Übungen erstellen“, dann „Übernehmen und erklären“ | `stoffpaketDerEinheit`, `stoffUebernehmen` (lib/einheit-ablauf.ts), lib/stoffpaket.ts; sonst lib/vorgabe.ts |
| Erklären | Mit Lernpaket aus dem Stoff: ein Schritt nach dem anderen (Einstieg, Erklärung, Beispiel, Frage, gemeinsame Übung) mit Folie, „Das sagst du“, Frage mit erwarteter Antwort und Richtig/Teilweise/Falsch. Sonst: Präsentation, „Das sagst du“, ein Beispiel, eine Frage | „Weiter: …“, im letzten Schritt „Verstanden: Übungen ans Tablet senden“ | `erklaerSchritte`, `einheit_ablauf.schritt_id`; sonst Planschritt „Erklären“, `planFuehrung` |
| Üben | Stand der laufenden Übung, sonst Ergebnis je Thema | nach der Regel `naechsteUebung` | zuerst das Übungsblatt aus dem Stoff (`offenesStoffBlatt`), dann `sendeAusGenerator` (ohne KI) |
| Hausübung | was beim Beenden passiert | „Einheit beenden“ | Abschluss mit „Hausübung mitschicken“ (lib/hausuebung.ts) |

**Regel für Üben** (`naechsteUebung`, lib/einheit-ablauf.ts): je Thema zählt das Neueste (letzte Übung mit Antworten, sonst der Kurztest).
1. Hat das Neueste Fehler: Aufgaben zu den Fehlern (aktuelles Thema zuerst).
2. Sonst ein Thema von heute, das noch nicht geübt wurde (beim neuen Thema zuerst erklären).
3. Sonst „Weiter zur Hausübung“ groß, „Weitere Übung“ klein.

**Deutsch und Englisch: der Text von heute** (`textFehler`, lib/einheit-ablauf.ts) geht in Üben vor, solange er etwas braucht:
1. auf Papier geschrieben, noch leer: „Text fotografieren“ (`/texte/[id]/papier`, liest die Handschrift wörtlich);
2. noch nicht korrigiert: „Text korrigieren“ (`/texte/[id]/korrektur`); während die KI korrigiert, wartet die Karte;
3. korrigiert: die Fehler je Bereich und „Aufgaben zu den Fehlern im Text senden: …“, eine Fähigkeit nach der anderen (aus dem Generator, nie das Übungsblatt aus dem Stoff). Es zählen die Fehler außer den abgelehnten. Eine Korrektur des Lehrers ohne Fähigkeit bekommt sie aus der Stelle (`skillAusStelle`: Groß/klein, das/dass, s/ss/ß, getrennt/zusammen, Beistrich), sonst gilt die Empfehlung der Korrektur.
Ohne Text: unter Üben „Text schreiben lassen, am Tablet oder auf Papier“.

**Lieber auf Papier rechnen** (Üben und Erklären, klein unter dem großen Knopf): dieselbe Übung gedruckt (zuerst das Übungsblatt aus dem Stoff). Bis sie fotografiert ist, zeigt Üben „{Name} rechnet auf Papier“ mit „Seite fotografieren“ (`/einheiten/[id]/papier`, die KI liest alle Aufgaben in einem Lauf, die App prüft) und „Ohne Foto weiter“ (`gedruckteUebung`, `papierOhneFoto`).

**Mehr Werkzeuge** schaltet für diese Einheit auf das ganze frühere Cockpit (`einheit_ablauf.ansicht = 'alles'`), „Zurück zum geführten Ablauf“ wieder zurück. Eine Einheit, die schon im Cockpit läuft (etwas gesendet, keine Zeile in `einheit_ablauf`), bleibt dort; „Geführten Ablauf starten“ holt sie herein.

Läuft die Einheit geführt und wurde im Cockpit nie „Weiter“ oder „Überspringen“ getippt, beschreibt der Plan des Cockpits sie nicht: kein „Plan für heute: 1 von 6 Schritten“ und kein „Lernpaket „…“: 0 von 7 Schritten“ im Abschluss (`nurGefuehrt` in lib/cockpit.ts). Was mit dem Lernpaket erklärt wurde, schreibt `dokumentiereGefuehrt` in „Was wurde gemacht?“: „Erklärt mit Präsentation: „Thema“, 3 von 5 Schritten; Fragen: 2 richtig, 1 teilweise.“

Noch offen: Mathe mit Stift (niko will das gemeinsam überlegen).

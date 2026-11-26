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

**Mehr Werkzeuge** schaltet für diese Einheit auf das ganze frühere Cockpit (`einheit_ablauf.ansicht = 'alles'`), „Zurück zum geführten Ablauf“ wieder zurück. Eine Einheit, die schon im Cockpit läuft (etwas gesendet, keine Zeile in `einheit_ablauf`), bleibt dort; „Geführten Ablauf starten“ holt sie herein.

Läuft die Einheit geführt und wurde im Cockpit nie „Weiter“ oder „Überspringen“ getippt, beschreibt der Plan des Cockpits sie nicht: kein „Plan für heute: 1 von 6 Schritten“ und kein „Lernpaket „…“: 0 von 7 Schritten“ im Abschluss (`nurGefuehrt` in lib/cockpit.ts). Was mit dem Lernpaket erklärt wurde, schreibt `dokumentiereGefuehrt` in „Was wurde gemacht?“: „Erklärt mit Präsentation: „Thema“, 3 von 5 Schritten; Fragen: 2 richtig, 1 teilweise.“

Noch offen (eigene PRs): Deutsch: Text auf Papier → Foto → Korrektur → Übungen zu den Fehlern; Mathe mit Stift.

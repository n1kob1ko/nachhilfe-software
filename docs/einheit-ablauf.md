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
| Stoff | „Was steht heute an?“: Fotos, PDF oder Text; danach die erkannten Themen | „Weiter: … erklären“ | lib/vorgabe.ts |
| Erklären | Präsentation (vorhanden oder „Präsentation erstellen“), „Das sagst du“, ein Beispiel, eine Frage mit Richtig/Teilweise/Falsch | „Verstanden: Übungen ans Tablet senden“ | Planschritt „Erklären“ des Themas, `planFuehrung` |
| Üben | Stand der laufenden Übung, sonst Ergebnis je Thema | nach der Regel `naechsteUebung` | `sendeAusGenerator` (ohne KI) |
| Hausübung | was beim Beenden passiert | „Einheit beenden“ | Abschluss mit „Hausübung mitschicken“ (lib/hausuebung.ts) |

**Regel für Üben** (`naechsteUebung`, lib/einheit-ablauf.ts): je Thema zählt das Neueste (letzte Übung mit Antworten, sonst der Kurztest).
1. Hat das Neueste Fehler: Aufgaben zu den Fehlern (aktuelles Thema zuerst).
2. Sonst ein Thema von heute, das noch nicht geübt wurde (beim neuen Thema zuerst erklären).
3. Sonst „Weiter zur Hausübung“ groß, „Weitere Übung“ klein.

**Mehr Werkzeuge** schaltet für diese Einheit auf das ganze frühere Cockpit (`einheit_ablauf.ansicht = 'alles'`), „Zurück zum geführten Ablauf“ wieder zurück. Eine Einheit, die schon im Cockpit läuft (etwas gesendet, keine Zeile in `einheit_ablauf`), bleibt dort; „Geführten Ablauf starten“ holt sie herein.

Läuft die Einheit geführt und wurde im Cockpit nie „Weiter“ oder „Überspringen“ getippt, beschreibt der Plan des Cockpits sie nicht: kein „Plan für heute: 1 von 6 Schritten“ im Abschluss (`nurGefuehrt` in lib/cockpit.ts).

Noch offen (eigene PRs): Fotos vom Stoff → Präsentation mit Abruf-Fragen und Übungen in einem KI-Lauf; Deutsch: Text auf Papier → Foto → Korrektur → Übungen zu den Fehlern; Mathe mit Stift.

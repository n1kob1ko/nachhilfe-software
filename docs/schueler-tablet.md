# Schüler-Tablet: Lehrer → festes Tablet → laufende Einheit → Schüler

## Ablauf

1. **Einmal koppeln.** Mehr › Schülergeräte › „Tablet verbinden“ erzeugt einen 6-stelligen Code (10 Minuten gültig, einmal verwendbar). Daneben steht ein QR-Code auf `/geraet`: mit der Tablet-Kamera scannen (oder die Adresse darunter eingeben) und den Code eingeben. Das Tablet bleibt verbunden, bis der Lehrer oder ein Admin es trennt.
2. **Bereitschaft.** Ohne laufende Einheit zeigt das Tablet nur „Bereit für die nächste Einheit · Verbunden mit Niko“.
3. **Einheit starten.** Das Tablet wechselt ohne Neuladen auf „Max · Mathematik · Einheit läuft“.
4. **An Max senden.** Ein Tipp auf der Übung (oder bei einer einzelnen Aufgabe unter „Einzeln senden“). Es gibt keine Schülerauswahl, weil die Einheit den Schüler kennt.
5. **Live-Status in der Einheit.** Der Lehrer sieht: Tablet verbunden/offline, Aufgabe n von m, Status, Zeit, Versuche, Hilfen und die letzte Antwort.
   - Aktionen: Nächste Aufgabe senden, Nochmal versuchen, Lösung zeigen, Auf Whiteboard.
   - Umschalter: Tablet zeigt Aufgaben oder Whiteboard.
6. **Whiteboard.** „Auf Whiteboard“ oder das Öffnen des Whiteboards der Einheit schaltet das eigene Tablet auf das Board dieser Einheit.
7. **Textarbeit.** „Textarbeit starten“ öffnet am Tablet einen Schreibbereich für längere Texte (Ansicht `text:<id>`). Details in `docs/textarbeit.md`.
8. **Einheit beenden.** Die Dokumentation wird erstellt und das Tablet springt sofort auf Bereitschaft. Beim nächsten Schüler ist nichts vom vorherigen sichtbar. Seine Daten bleiben auf dem Server.

**Sonderfälle**

- **Kein Tablet gekoppelt:** Die App zeigt „Noch kein Schülergerät verbunden“ mit dem Knopf „Tablet verbinden“, der direkt zum Code führt. Die Übung liegt trotzdem am Lernlink bereit.
- **Tablet offline:**
  - Die App zeigt „Tablet offline – noch nicht angekommen“ mit den Aktionen Erneut senden, Verbindung prüfen und Später senden.
  - Die Übung gilt erst als angekommen, wenn das Tablet sie anzeigt (`assignments.delivered_at`).

## Wiederverwendete Architektur

| Wunsch | Umsetzung |
|---|---|
| Realtime | Derselbe SSE-Hub wie beim Whiteboard (`lib/whiteboard-hub.ts`), erweitert um Text-Kanäle: `geraet:<lehrer>` für das Tablet und `einheit:<id>` für den Live-Status. Es gibt kein zweites Live-System. |
| tutoring_sessions | `units` (bestehend), plus `device_view`: was das Tablet zeigt. |
| exercises | `worksheets` (bestehend), plus `source_task_id` für einzeln gesendete Aufgaben. |
| exercise_assignments | `assignments` (bestehend), plus `delivered_at`. |
| student_answers | `attempts` und `hint_uses` (bestehend). |
| student_devices | neu: `id, teacher_id, name, token_hash, paired_at, last_seen_at, revoked_at`. Der Status online/offline kommt live aus dem Hub und wird nicht gespeichert. |
| Kopplungscodes | neu: `device_pair_codes` (Code, Lehrer, Ablauf). |

Das Tablet speichert keinen Schüler. Jede Anfrage löst serverseitig auf: Tablet → Lehrer → `activeUnitForTeacher` → Schüler.

## Sicherheit (serverseitig)

**Tablet-Schlüssel**
- Das Tablet erhält 32 zufällige Bytes in einem httpOnly-Cookie, das nur für `/geraet` gilt.
- In der Datenbank liegt nur der SHA-256-Hash.
- Trennen wirkt sofort.

**Was das Tablet sehen darf**
- Es sieht nur die laufende Einheit seines Lehrers: die Übungen dieser Einheit und das Whiteboard dieser Einheit.
- Antworten, Hilfen und Status werden gegen diese Einheit geprüft.
- Alle Lehrerbereiche bleiben hinter dem Lehrer-Login. Das Tablet-Cookie öffnet sie nicht.

**Codes**
- 6 Stellen, 10 Minuten gültig, einmal verwendbar.
- Nach 8 Fehlversuchen in 10 Minuten wird die Adresse gesperrt.

**Nach dem Ende**
- Es bleiben keine Daten am Gerät: keine lokale Speicherung, die Ansicht wird pro Einheit neu aufgebaut, und das Whiteboard ist pro Einheit getrennt.

## Grenzen

- Pro Lehrer ist ein Tablet gedacht. Mehrere gekoppelte Tablets zeigen dasselbe, und „online“ gilt pro Lehrer.
- Der Live-Hub läuft im Speicher eines einzelnen Server-Prozesses, wie schon das Whiteboard.

## Getestet

`lib/devices.test.ts` deckt ab:
- Kopplung, Ablauf und Einmal-Code
- Sperre nach Fehlversuchen
- Trennung zweier Lehrer
- Wechsel Anna → Max

Der Browser-Test deckt mit zwei Lehrern und zwei Tablets alle 13 Szenarien ab:
1. Koppeln von Tablet A
2. Koppeln von Tablet B
3. Gleichzeitige Einheiten
4. Übung nur auf A
5. Übung nur auf B
6. Ende und Wechsel
7. Nichts vom vorherigen Schüler sichtbar
8. Neu laden
9. Offline
10. Ende während offline
11. Whiteboard getrennt
12. Fremdzugriffe abgewiesen
13. Bereitschaft

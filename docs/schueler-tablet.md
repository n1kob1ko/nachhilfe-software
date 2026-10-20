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

**Zwei Schüler gleichzeitig (D26, seit 2026-10-20)**

Laufen beim Lehrer zwei Einheiten, hat jede ihr eigenes Tablet, ihr eigenes Whiteboard und ihre eigenen Übungen:

- **Wer arbeitet an diesem Gerät?** Ein Tablet ohne Wahl zeigt beide Vornamen. Der Schüler tippt seinen Namen; das Tablet merkt sich die **Einheit** (`student_devices.unit_id`), nie den Schüler. Die Wahl gilt nur, solange diese Einheit läuft: mit ihrem Ende ist sie weg (`finishUnit`), und läuft danach nur noch eine Einheit, zeigt das Tablet diese.
- **Wechseln.** Im Kopf des Tablets steht „Wechseln“; das fragt neu. Im Live-Status jeder der beiden Einheiten stellt der Lehrer jedes seiner Tablets per Tipp auf Anna oder Ben.
- **Senden.** „An Anna senden“, „Erneut senden“ und „Auf Whiteboard senden“ gehen in die Einheit des Schülers der Übung. Gehört die Übung keinem der beiden (Bibliothek, anderer Schüler), stehen zwei Knöpfe mit Vornamen da. Ein Senden (`showOnTablet`) erreicht nur die Tablets dieser Einheit: öffnet der Lehrer das Whiteboard von Ben, bleibt Annas Tablet, wo es ist.
- **Live-Status.** „Tablet verbunden“ zählt nur die Tablets dieser Einheit. Ist keins dort, steht „Kein Tablet bei Ben“ da.
- Läuft nur eine Einheit, ändert sich nichts: jedes Tablet des Lehrers zeigt sie.

**Sonderfälle**

- **Kein Tablet gekoppelt:** Die App zeigt „Noch kein Schülergerät verbunden“ mit dem Knopf „Tablet verbinden“, der direkt zum Code führt. Die Übung liegt trotzdem am Lernlink bereit.
- **Tablet offline:**
  - Die App zeigt „Tablet offline – noch nicht angekommen“ mit den Aktionen Erneut senden, Verbindung prüfen und Später senden.
  - Die Übung gilt erst als angekommen, wenn das Tablet sie anzeigt (`assignments.delivered_at`).

## Wiederverwendete Architektur

| Wunsch | Umsetzung |
|---|---|
| Realtime | Derselbe SSE-Hub wie beim Whiteboard (`lib/whiteboard-hub.ts`), erweitert um Text-Kanäle: `geraet:<tablet>` je Tablet und `einheit:<id>` für den Live-Status. Start und Ende einer Einheit gehen an alle Tablets des Lehrers, alles andere nur an die Tablets der Einheit (`notifyUnitTablets`). Es gibt kein zweites Live-System. |
| tutoring_sessions | `units` (bestehend), plus `device_view`: was das Tablet zeigt. |
| exercises | `worksheets` (bestehend), plus `source_task_id` für einzeln gesendete Aufgaben. |
| exercise_assignments | `assignments` (bestehend), plus `delivered_at`. |
| student_answers | `attempts` und `hint_uses` (bestehend). |
| student_devices | neu: `id, teacher_id, name, token_hash, paired_at, last_seen_at, revoked_at`, dazu `unit_id` (die am Tablet gewählte laufende Einheit, wenn zwei laufen). Der Status online/offline kommt live aus dem Hub und wird nicht gespeichert. |
| Kopplungscodes | neu: `device_pair_codes` (Code, Lehrer, Ablauf). |

Das Tablet speichert keinen Schüler. Jede Anfrage löst serverseitig auf: Tablet → Lehrer → laufende Einheit (bei zweien die am Tablet gewählte, `deviceUnit` in `lib/devices.ts`) → Schüler.

## Sicherheit (serverseitig)

**Tablet-Schlüssel**
- Das Tablet erhält 32 zufällige Bytes in einem httpOnly-Cookie, das nur für `/geraet` gilt.
- In der Datenbank liegt nur der SHA-256-Hash.
- Trennen wirkt sofort.

**Was das Tablet sehen darf**
- Es sieht nur eine laufende Einheit seines Lehrers: die Übungen dieser Einheit und das Whiteboard dieser Einheit. Wählen kann es nur unter den laufenden Einheiten seines eigenen Lehrers.
- Antworten, Hilfen und Status werden gegen diese Einheit geprüft.
- Alle Lehrerbereiche bleiben hinter dem Lehrer-Login. Das Tablet-Cookie öffnet sie nicht.

**Codes**
- 6 Stellen, 10 Minuten gültig, einmal verwendbar.
- Nach 8 Fehlversuchen in 10 Minuten wird die Adresse gesperrt.

**Nach dem Ende**
- Es bleiben keine Daten am Gerät: keine lokale Speicherung, die Ansicht wird pro Einheit neu aufgebaut, und das Whiteboard ist pro Einheit getrennt.

## Grenzen

- Pro Lehrer ist ein Tablet gedacht, bei zwei Schülern gleichzeitig zwei. Bei einer laufenden Einheit zeigen alle Tablets des Lehrers dasselbe; „online“ zählt die Tablets der Einheit.
- Der Live-Hub läuft im Speicher eines einzelnen Server-Prozesses, wie schon das Whiteboard.

## Getestet

`lib/devices.test.ts` deckt ab:
- Kopplung, Ablauf und Einmal-Code
- Sperre nach Fehlversuchen
- Trennung zweier Lehrer
- Wechsel Anna → Max

`lib/zwei-schueler.test.ts` deckt zwei Einheiten gleichzeitig ab: Senden in die Einheit des Schülers der Übung (auch Whiteboard und „Erneut senden“), zwei Tablets mit je eigener Einheit, `showOnTablet` erreicht nur das passende Tablet, die Wahl nur unter den Einheiten des eigenen Lehrers, das Ende gibt die Wahl frei.

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

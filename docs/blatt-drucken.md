# Ausgefülltes Blatt drucken

niko, 2026-11-16: „… dann kann ich das ausgefüllte pdf am ende drucken“. Phase 3 von drei nach
[Stoff vorbereiten](stoff-vorbereiten.md) und [Ganzes Blatt am Tablet](blatt-am-tablet.md). Bisher gab es das nur als
[Mappe](mappe.md) für eine ganze Einheit; jetzt auch für ein einzelnes Blatt.

| Bereich | Ort |
|---|---|
| Daten: Antworten, Zeit, Hilfen, Punkte, Note | `lib/blatt-druck.ts` (`blattFuerZuweisung`) |
| Druckseite | `app/arbeitsblatt/zuweisung/[id]/page.tsx` |
| Blatt | `components/arbeitsblatt/Mappe.tsx` (`BlattDokument`, dieselben Aufgaben wie in der Mappe) |
| Einstellungen | `components/arbeitsblatt/MappeSettings.tsx`, `lib/mappe-druck.ts` (`BLATT_STANDARD`) |
| Tests | `lib/blatt-druck.test.ts` |

## Wo

- **Ergebnis** einer Übung: „Ausgefülltes Blatt drucken“.
- **Übung**, sobald etwas bearbeitet ist: „Ausgefüllt drucken“.
- **Stoff vorbereiten**, bei jedem bearbeiteten Blatt: „Ausgefüllt drucken“ und wie es ausging („5 von 8 richtig“).

## Was draufsteht

- Kopf: Titel (ohne den Vornamen vorne), Fach, Klasse, Name, Datum (fertig am, sonst letzte Antwort) und eine Zeile
  „5 von 8 richtig · 1 nicht bearbeitet · 18 Minuten · 2 Hilfen“.
- Jede Aufgabe mit der Antwort des Schülers wie auf Papier, ✓, ✗ oder (✓) am Rand, bei Fehlern „Richtig: …“.
  Was im Test leer abgegeben wurde, steht als „nicht bearbeitet“ da.
- **Probeschularbeit**: ein Kasten „Punkte: 14 von 20 · Note: 2 (Gut)“, unter jeder Aufgabe „2 von 3 Punkten“. Die Note
  kommt erst, wenn alles bearbeitet und bewertet ist, sonst „folgt, wenn alles bewertet ist“; Punkte wie in
  `lib/probeschularbeit.ts` (richtig alle, teilweise die Hälfte, falsch 0, auf Papier die eingetragenen).
- Einstellungen wie bei der Mappe (Häkchen, Lösungen, nicht bearbeitete Aufgaben, Name, Datum, Logo, Seitenzahlen).
  Beim einzelnen Blatt stehen alle Aufgaben und das Datum standardmäßig drauf. Ohne Häkchen ist es ein sauberes Blatt
  nur mit den Antworten.

## Regeln

- Nur für Lehrkräfte; der Schüler sieht in der Schüler-App sein Ergebnis wie bisher.
- Es werden alle Antworten der Zuweisung genommen, egal in welcher Einheit sie kamen.
- Kein gespeichertes PDF: „Drucken / PDF“ im Browser, wie bei allen A4-Blättern.

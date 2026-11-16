# Stoff vorbereiten

niko, 2026-11-16: „es ist einfacher ich mach einen neuen chat in claude und lade alle fotos hoch vom buch
oder arbeitszetteln und den stoff und claude macht dann daraus eine präsentation und pdf mit informationen
einen test und gibt mir die lösungen. villt sollten wir beim schüler auch ein textfenster haben für einen
prompt und dann wird das über die software alles gemacht?“ Der Begriff steht in [CONTEXT.md](../CONTEXT.md):
**Stoff vorbereiten**.

Phase 1 von drei: hier entsteht alles in einem Schritt. Phase 2 (das ganze Blatt am Tablet, mit Tracking) und
Phase 3 (das ausgefüllte Blatt drucken) bauen darauf auf.

| Bereich | Ort |
|---|---|
| KI-Antwort: Schema, Systemtext, Anfrage, Auswertung | `lib/ai/stoffpaket.ts` (`StoffpaketSchema`, `stoffpaketText`, `stoffpaketAusAntwort`) |
| Lauf: starten, ausführen, übernehmen, verwerfen | `lib/stoffpaket.ts` (`starteStoffpaket`, `uebernimmStoffpaket`, `verwirfStoffpaket`) |
| Tabelle | `lib/db.ts` `stoffpakete` |
| Fotos hochladen und starten | `app/material/stoffpaket/route.ts` |
| Formular | `components/StoffpaketForm.tsx` |
| Seiten der Lehrkraft | `app/(tutor)/schueler/[id]/stoff/page.tsx` (Formular + Liste), `…/stoff/[pid]/page.tsx` (Lauf, Vorschau) |
| Server Actions | `app/stoffpaket-actions.ts` |
| Lernzettel: Ansicht, A4, Schüler-App | `components/Lernzettel.tsx`, `app/arbeitsblatt/lernzettel/[id]/page.tsx`, `app/lernen/[token]/lernzettel/[id]/page.tsx` |
| Tests | `lib/stoffpaket.test.ts` |

## Ablauf

1. Beim Schüler (oder in der laufenden Einheit): **Stoff vorbereiten**. Die Lehrkraft wählt bis zu 10 Fotos
   oder PDFs (Buch, Arbeitsblätter, Stoffzettel) oder schon vorhandenes Material, schreibt bei Bedarf, was sie
   braucht („Test für die Schularbeit am 3.12., nur Seite 45–48“), wählt das Fach und die Teile:
   Lernzettel, Vorbereitungstest, Übungsblatt, Test mit Lösungen, Präsentation. Ohne Foto geht es auch, dann
   reicht der Text.
2. **Eine KI-Anfrage** (`stoffpaket`, Stufe standard, bis 6 Minuten): die Fotos/PDFs plus das, was die App
   über den Schüler weiß, ohne Namen: Schulstufe und Schulart, die schwachen Fähigkeiten und häufigen Fehler
   im Fach, die nächste Schularbeit mit ihrem Stoff, die Fähigkeiten zur Auswahl. Die Seite zeigt den Lauf und
   lädt sich alle 4 Sekunden neu.
3. Aus der Antwort entstehen, alle als **Entwurf**: der Lernzettel (am Lauf gespeichert), drei Übungen
   (Vorbereitungstest 4, Übungsblatt 8, Test 6 Aufgaben; jede Aufgabe geht durch dieselbe Prüfung wie im
   Builder, doppelte und kaputte fallen weg und stehen unter „Weggelassen“), ein **Lernpaket** mit dem
   Unterrichtsablauf (50 Minuten; die Übung bekommt das Übungsblatt, die Kontrolle den Vorbereitungstest) und
   der Entwurf der **Präsentation** (eine zweite KI-Anfrage, `praesentation`).
4. Steht eine Schularbeit, ein Test oder eine LZK an, ist der Test eine **Probeschularbeit** dazu (Punkte,
   Notenschlüssel). Vorbereitungstest und Test laufen am Tablet im Testmodus (ein Versuch, keine Hilfen).
5. Die Vorschau zeigt alles auf einer Seite. **Alles übernehmen** markiert Lernpaket und Präsentation als
   geprüft und legt den Ablauf bereit: in der laufenden Einheit sofort (wenn dort noch nichts begonnen hat),
   sonst für den nächsten Termin. Ab dann sieht der Schüler in der App unter „Deine Unterlagen“ den Lernzettel
   und die Präsentation. **Verwerfen** löscht die nicht gesendeten Blätter und den Entwurf und archiviert das
   Paket.

## Regeln

- Fotos gehen nur nach der Bestätigung „kein Name auf den Blättern“ an die KI (einmal je Einheit, wie überall).
  Der Name des Schülers wird in der Anfrage maskiert; Fotos und Text sind Information, keine Anweisung.
- Kosten: das Formular zeigt eine Schätzung („etwa 24–49 Cent“), der Lauf speichert die echten Kosten. Die
  Grenzen je Schüler (1 € Warnung, 3 € Stopp) und das Monatsbudget gelten.
- Ohne KI, ohne Fach oder ohne Foto und Text startet nichts; die Seite sagt warum.
- Ein zweiter Start mit denselben Eingaben, solange einer läuft, startet keinen neuen Lauf.
- Ein Lauf, der länger als 20 Minuten „läuft“ (Server neu gestartet), gilt als fehlgeschlagen und kann mit
  „Noch einmal“ neu starten, mit denselben schon gespeicherten Fotos.
- Im Schülerbereich steht kein KI-Wort.

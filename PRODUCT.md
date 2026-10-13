# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
delegated: Next.js + TypeScript + SQLite (lokal lauffähig, ein Prozess, keine Server-Infrastruktur nötig), Claude API optional.

## Users
Primär: eine Nachhilfelehrkraft (niko) in Österreich, die mehrere Schüler in Mathematik, Deutsch und Englisch betreut, vor und nach Einheiten am Laptop. Sekundär: die Schüler selbst, die zugewiesene Übungen über einen persönlichen Link bearbeiten (oft am Handy oder Tablet). *Abgeleitet aus dem Brief.*

## Product Purpose
Eine komplette Nachhilfe-Software statt einer Schülerliste: Profile, Dokumentation der Einheiten, Übungen mit Lösungen, Selbstbearbeitung mit Tracking, Fortschritt pro Fähigkeit, automatische Analyse und Empfehlungen, ein Dashboard für den Tag — dazu seit dem Merge der **Wochenplan** des Instituts (Räume, Verfügbarkeiten, geplante Einheiten), **Blätter erstellen** (Lesetabelle, Satzbaukasten, Nachmalblatt), **Schnellrunde**, **Auswendig schreiben** und eingebaute Deutsch-Aufgabenbanken. Langfristig ein Lernkreislauf: Aufgabe → Ergebnis → Analyse → Profil → Empfehlung → neue Übung → Neubewertung.

## Capabilities and Constraints
Österreichische Begriffe (Klasse je Schultyp: VS, MS, Gymnasium, HTL, HAK; Hausübung, Schularbeit, Beistrich). Fortschritt muss pro einzelner Fähigkeit messbar sein (z. B. Bruchrechnung › Dividieren). Ein Nachhilfetermin heißt **Einheit**, ihre geplante Länge **geplante Dauer** (Glossar: [CONTEXT.md](CONTEXT.md)). Der Wochenplan ist ein Vorschlag: von Hand gesetzte Plätze sind gesperrt und werden von „Neu generieren“ nie verschoben; abgerechnet wird weiterhin nur die echte Dauer abgeschlossener Einheiten. Blätter werden im Browser gedruckt (kein PDF-Dienst, kein externer Renderer). Funktioniert ohne KI — eingebaute Generatoren und Aufgabenbanken decken Mathematik, Deutsch und Englisch ab; mit `ANTHROPIC_API_KEY` erzeugt Claude Aufgaben und Einschätzungen, ohne Schlüssel gibt es den **manuellen KI-Modus** (Prompt kopieren, Antwort einfügen).

## Product Principles
- Die Lehrkraft sieht in Sekunden, wer heute kommt und wo es hakt.
- Jede Zahl ist nachvollziehbar (Aufgaben, Versuche, Zeiten, Hilfen sind einsehbar).
- Empfehlungen sind konkret und mit einem Klick umsetzbar.
- Für Schüler: eine Aufgabe auf einmal, klare Rückmeldung, Hilfe ohne Bloßstellung.
- Der Plan bleibt ein Vorschlag, die Dokumentation bleibt die Wahrheit: geplante Zeiten schreiben die echte Einheit nicht vor.

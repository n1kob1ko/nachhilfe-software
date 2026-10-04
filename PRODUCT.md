# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
delegated: Next.js + TypeScript + SQLite (lokal lauffähig, ein Prozess, keine Server-Infrastruktur nötig), Claude API optional.

## Users
Primär: eine Nachhilfelehrkraft (niko) in Österreich, die mehrere Schüler in Mathematik, Deutsch und Englisch betreut, vor und nach Stunden am Laptop. Sekundär: die Schüler selbst, die zugewiesene Übungen über einen persönlichen Link bearbeiten (oft am Handy oder Tablet). *Abgeleitet aus dem Brief.*

## Product Purpose
Eine komplette Nachhilfe-Software statt einer Schülerliste: Profile, Stundendokumentation, Übungen mit Lösungen, Selbstbearbeitung mit Tracking, Fortschritt pro Fähigkeit, automatische Analyse und Empfehlungen, ein Dashboard für den Tag. Langfristig ein Lernkreislauf: Aufgabe → Ergebnis → Analyse → Profil → Empfehlung → neue Übung → Neubewertung.

## Capabilities and Constraints
Österreichische Begriffe (Klasse je Schultyp: VS, MS, Gymnasium, HTL, HAK; Hausübung, Schularbeit, Beistrich). Fortschritt muss pro einzelner Fähigkeit messbar sein (z. B. Bruchrechnung › Dividieren). Funktioniert ohne KI; mit ANTHROPIC_API_KEY erzeugt Claude Aufgaben und Einschätzungen.

## Product Principles
- Die Lehrkraft sieht in Sekunden, wer heute kommt und wo es hakt.
- Jede Zahl ist nachvollziehbar (Aufgaben, Versuche, Zeiten, Hilfen sind einsehbar).
- Empfehlungen sind konkret und mit einem Klick umsetzbar.
- Für Schüler: eine Aufgabe auf einmal, klare Rückmeldung, Hilfe ohne Bloßstellung.

# Biko-Anbindung

niko, 26.11.2026: „Biko soll täglich ein Briefing für die Lehrer schreiben und Material für Schüler vorbereiten
(Dokumente lesen und zusammenfassen). Schülernamen nicht ungefiltert an die KI schicken.“

Biko-Chef (Repo `n1kob1ko/Biko-Bot`, `assistent/dreamstudy.py`, Seite `/chef`) läuft auf einem eigenen Server mit
eigenem Claude-Schlüssel. DreamStudy ruft Biko nie an: Biko fragt alle 2 Minuten nach, ob es etwas zu tun gibt.

## Was Biko macht

| Auftrag | Wann | Ergebnis in DreamStudy |
|---|---|---|
| Tagesbriefing | ab 6 Uhr (Wien, `BIKO_BRIEFING_UHR`), je Lehrkraft mit Terminen heute einmal | Karte „Briefing von Biko“ auf Heute, Erweitert › Biko, „Neu schreiben lassen“ |
| Lernzettel aus einem Dokument | wenn die Lehrkraft beim Material „An Biko geben“ tippt (Schüler wählen, Haken „keine Namen“) | Zusammenfassung für die Lehrkraft und Lernzettel unter Erweitert › Biko; „Für … übernehmen“ legt ihn in die Schüler-App (Deine Unterlagen) und zum Drucken |

## Namen

Die App baut jeden Text für Biko selbst (`lib/biko.ts`) und speichert ihn genau so (`biko_auftraege.anfrage`):

- Schüler heißen S1, S2 …; die Zuordnung (`zuordnung`) verlässt die App nie. Die Namen setzt erst die Anzeige ein.
- Alle Namen von Schülern und Lehrern, dazu jeder Name, den die App in den Texten findet (Vornamenliste, „Frau X“,
  Nachname nach Vorname, Name nach „Mutter“, „Klassenlehrerin“ …), werden durch [Name] ersetzt, wie beim KI-Briefing.
- Profil-Notizen gehen nicht mit; Lehrkräfte haben keinen Namen.
- Eine Datei geht nur mit, wenn die Lehrkraft bestätigt, dass kein Name darauf steht, und nur, solange der Auftrag
  abgeholt ist.

## Kosten

Biko meldet Kosten, Modell und Tokens mit dem Ergebnis. Sie stehen in `ai_calls` mit Anbieter `biko` beim Schüler
(ein Briefing teilt sie auf seine Schüler auf) und zählen für die KI-Grenze je Schüler (1 € Hinweis, 3 € Stopp). Ist
sie erreicht, gehen für diesen Schüler keine Daten mehr an Biko. Die Monatsbudgets der App belasten sie nicht: Biko
zahlt selbst und hat eine eigene Tagesgrenze (3 $ Standard).

## Schnittstelle

Alles mit `Authorization: Bearer <BIKO_TOKEN>`; ohne `BIKO_TOKEN` (mindestens 24 Zeichen) antwortet sie mit 404.

- `GET /api/biko` – Verbindung prüfen.
- `GET /api/biko/auftraege` – bis zu 4 offene Aufträge: `{ id, art, system, anfrage, schema, max_tokens, datei }`.
  Abgeholt heißt: nach 20 Minuten ohne Antwort gibt es ihn noch einmal, höchstens 3 Mal.
- `GET /api/biko/auftraege/<id>/datei` – die Datei eines abgeholten Dokument-Auftrags.
- `POST /api/biko/auftraege/<id>` – `{ ergebnis | fehler, kosten_usd, modell, tokens_ein, tokens_aus }`. Die App prüft
  das Ergebnis mit dem Schema; passt es nicht, 422 und der Auftrag steht auf Fehler.

## Einrichten

Ein zufälliger Wert (z. B. `openssl rand -hex 32`) als `BIKO_TOKEN` bei DreamStudy (Railway, Projekt
industrious-courage) und als `DREAMSTUDY_TOKEN` bei Biko (Railway, Projekt biko-helfer).

# Tagesbriefing

Stand 18. Oktober 2026. Wunsch von niko: Auf der Startseite steht „Heute: X Schüler“. Neben jedem Schüler gibt es einen Knopf „Briefing“. Er zeigt den letzten Stand, wo es hakt, einen Plan für heute mit Minuten und passende Übungen aus dem Bestand.

## Wo

- **Startseite › Heute:** Die Überschrift zählt die Schüler mit Platz im veröffentlichten Wochenplan und mit von Hand geplanten Einheiten. Jede offene Zeile hat den Knopf „Briefing“. Er öffnet `/schueler/[id]/briefing?start=1&platz=…`.
- **Schülerprofil:** Der Knopf „Briefing für heute“ öffnet dieselbe Seite. Er fragt die KI nicht von selbst.

## Zwei Fassungen

**Aus den Daten** (`einfachesBriefing` in `lib/briefing.ts`). Sie ist immer da und kostet nichts.

- **Letzter Stand:** die letzte Dokumentation, also Datum, Thema, Verständnis, „Gemacht“, „Gut“, „Beobachtungen“ und „Nächstes Mal“. Dazu, ob der Schüler seitdem selbstständig geübt hat.
- **Wo es hakt:** die Schwächen aus dem Lernstand, häufige Fehler und was zuletzt schwierig war.
- **Nächste Schularbeit:** die nächste geplante in den nächsten 60 Tagen.
- **Plan für heute:** die geplante Dauer, aufgeteilt in diese Schritte:
  - Einstieg und Wiederholung;
  - Hausübung kontrollieren, wenn eine offen ist;
  - Schularbeit vorbereiten, wenn sie in 14 Tagen oder früher ist;
  - zwei Übungsblöcke aus den Empfehlungen;
  - Abschluss.
- **Übungsvorschläge aus dem Bestand:**
  - freigegebene Übungen;
  - Einträge der Bibliothek;
  - Vorlagen;
  - Material und Druckblätter;
  - schon zugewiesene offene Übungen;
  - die Aufgabenbanken.

  Eine Übung zählt als passend, wenn sie eine Fokus-Fähigkeit trifft, deren Teil- oder deren Oberfähigkeit. Fokus-Fähigkeiten sind die Empfehlungen, die Fähigkeiten der Schularbeit, die Schwächen und das Thema der letzten Einheit.

**KI-Fassung** (`lib/ai/briefing.ts`). Sie läuft nur auf Klick. Funktion `briefing`, Bereich Auswertung, Tarif standard.

- **Was die KI bekommt:**
  - geplante Dauer, Schulart, Klasse, Schulstufe, Fächer, Ziele;
  - die nächste Schularbeit;
  - den Lernstand je Fähigkeit;
  - häufige Fehler und die Empfehlungen;
  - den Lernverlauf (die letzten acht Einträge);
  - die letzten drei Dokumentationen;
  - die Liste der passenden Übungen mit IDs.

  Die KI-Hinweise hängt der Router an.
- **Was nicht mitgeht:**
  - Notizen;
  - Stärken und Schwächen als eigene Beobachtung;
  - aktuelle Themen aus dem Profil;
  - Notizen zu Schularbeiten;
  - Telefon und Ähnliches.
- **Namen:** Vor dem Senden wird durch `[Name]` ersetzt:
  - der Name des Schülers;
  - die Namen aller Lehrer und aller Schüler;
  - jeder Name, den `detectNames` findet;
  - jeder Name nach einer Familien- oder Schulrolle (`namesAfterRelation`: „Mutter Gerlinde“, „Bruder Ilvo“, „Klassenlehrerin Novak“).

  Die Textkorrektur behält ihre drei Regeln.
- **Was die App prüft:**
  - Übungs-IDs, die nicht in der Liste stehen, werden verworfen. Über dem Briefing steht, wie viele.
  - Die Minuten der KI bleiben, wenn sie zusammen genau die geplante Dauer ergeben. Sonst werden sie anteilig darauf gebracht (`verteileMinuten`).
  - Das Datum der Schularbeit kommt immer aus der App.

## Speichern und Kosten

- Pro Schüler und Wiener Tag gibt es ein KI-Briefing (Tabelle `briefings`).
- Wer den Knopf noch einmal drückt, sieht das gespeicherte. Neu gefragt wird nur über „Neu erstellen“.
- Läuft die Anfrage noch, wartet ein zweiter Klick auf dieselbe Anfrage (auch auf dem Server). Ein Doppelklick kostet also nichts.
- Jedes Briefing zeigt, was es laut Kostenprotokoll gekostet hat: Dollar, Tokens ein und aus, davon Denken.
- Unter Mehr › KI-Kosten steht „Tagesbriefing“ als eigene Funktion mit „Ø je Aufruf“.
- Gibt es seit dem Briefing neue Dokumentationen, Schularbeiten oder Antworten, steht ein Hinweis da (`datenStand`).

## Was das Briefing nie tut

- Es schreibt nicht in Lernstand, Versuche, Dokumentationen oder Schularbeiten. Seine einzige Tabelle ist `briefings`.
- Ein Test vergleicht den Lernstand vor und nach zwei KI-Briefings.
- Ohne KI, mit leerem Budget oder bei einem Fehler bleibt die Fassung aus den Daten stehen, mit einem kurzen Hinweis.
- Im manuellen Modus erscheint der Prompt zum Kopieren.

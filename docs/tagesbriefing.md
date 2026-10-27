# Tagesbriefing

Stand 25. Oktober 2026. Wunsch von niko: Auf der Startseite steht „Heute: X Schüler“. Neben jedem Schüler gibt es einen Knopf „Briefing“. Er zeigt den letzten Stand, wo es hakt, einen Plan für heute mit Minuten und passende Übungen aus dem Bestand.

Seit 25. Oktober 2026 (niko): Vor der Einheit bereitet die App alles selbst vor. Die Lehrkraft liest die kurze Karte auf Heute und tippt „Einheit starten“. Gefragt wird sie nur, wenn es wirklich nötig ist.

## Automatische Vorbereitung

`lib/vorbereitung-auto.ts` sammelt für jeden Schüler Signale und ordnet sie (`ordneSignale`, `SIGNAL_RANG`). Reihenfolge nach niko:

0. **Vorgabe für heute:** was die Lehrkraft in der laufenden Einheit unter „Was steht heute an?“ angegeben hat
   ([Heute · Unterricht · Abschluss](heute-unterricht-abschluss.md#was-steht-heute-an)). Im Plan für die ganze
   Einheit (`lib/stundenplan.ts`) kommen ihre Themen zuerst, die übrigen Signale füllen die restliche Zeit.
1. **Prüfung:** eine geplante Schularbeit oder ein Test. Bei zwei Prüfungen zählt die frühere.
2. **Schulstoff:** eine Empfehlung „Schulstoff“ und die aktuellen Themen aus dem Profil.
3. **Vom Schüler gemeldet:** der Wunsch aus der Schüler-App („Was willst du nächstes Mal machen?“).
4. **Wiederholte Fehler:** eine Fehler-Empfehlung oder eine Schwäche, bei der derselbe Fehler zuletzt mindestens zweimal kam.
5. **Offenes Ziel:** ein begonnenes Lernpaket mit nicht erreichten Zielen, „Nächstes Mal“ der letzten Dokumentation, eine offene Hausübung, eine Textarbeit der letzten 30 Tage mit übernommener Note 4 oder 5 oder einem Kriterium ab Stufe 4 („E-Mail am 25.10.: Note 3, schwach: Sprache“, `textSignale`). Nur übernommene Bewertungen zählen, nie ein Vorschlag.
6. **Wiederholung:** Lernstand, fällige Wiederholung, Thema der letzten Einheit.

Bei gleichem Rang gewinnt die frühere Prüfung, sonst die Reihenfolge der Daten. Signale aus einem anderen Fach als dem der Einheit fallen weg, wenn das Fach feststeht.

Zum besten Signal sucht die App:

- ein **geprüftes** Lernpaket, wenn möglich mit Präsentation. Ungeprüfte Pakete und KI-Entwürfe wählt sie nie von selbst;
- sonst einen Plan aus den Daten: den „Plan für heute“ mit dem Signal vorne („Üben: <Thema>“). Übungen aus dem Bestand kommen vor den Aufgabenbanken.

Das Ergebnis heißt **Fokus** (`fokusAus`): Art, Fähigkeiten, Thema und eine kurze Beschreibung. Bei einem Wunsch steht dort nur „Vom Schüler gemeldet: <Thema>“, nie sein eigener Text. Heute, Unterricht und das Briefing nutzen denselben Fokus:

- Die Karte auf Heute zeigt Thema, Warum, Vorbereitet („3 Themen: Past Simple 35 · E-Mail 30 · Tagesablauf 20 · Lernpaket „…““, ein selbst gewähltes Lernpaket wie bisher), Schwierigkeiten und eine Prüfung bis 30 Tage.
- „Einheit starten“ beginnt im Fach der Vorbereitung (`fachHeute`). Der Unterricht nimmt denselben Plan für die ganze Einheit (`lib/stundenplan.ts`): mehrere Themen, geprüfte Pakete als Block eines Themas. Ein selbst gewähltes Paket gilt allein.
- Das Briefing selbst („Plan für heute“ weiter unten) bleibt wie bisher ein Plan mit einem Schwerpunkt.

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

**KI-Fassung** (`lib/ai/briefing.ts`). Sie läuft auf Klick oder von selbst im Hintergrund (siehe unten). Funktion `briefing`, Bereich Auswertung, Tarif standard.

- **Was die KI bekommt:**
  - geplante Dauer, Schulart, Klasse, Schulstufe, Fächer, Ziele;
  - die nächste Schularbeit;
  - den Lernstand je Fähigkeit;
  - häufige Fehler und die Empfehlungen;
  - den Lernverlauf (die letzten acht Einträge);
  - die letzten drei Dokumentationen;
  - die Liste der passenden Übungen mit IDs;
  - den Schwerpunkt der App mit seiner Art, nur als Namen von Fähigkeiten („Schwerpunkt der App (Wiederholte Fehler): Artikel bestimmen“). Er steht im Plan vorne.

  Die KI-Hinweise hängt der Router an.
- **Was nicht mitgeht:**
  - Notizen;
  - Stärken und Schwächen als eigene Beobachtung;
  - aktuelle Themen aus dem Profil;
  - Notizen zu Schularbeiten;
  - was der Schüler selbst geschrieben hat (Wunsch, Notizen);
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

- Ein KI-Briefing gilt, solange die Daten des Schülers gleich sind, auch an späteren Tagen. Der Schlüssel ist `briefingStand`: `datenStand` (Dokumentationen, Versuche, Schularbeiten, Hausübungen, Zuweisungen, Material, Wünsche, Schüler-Notizen, aktuelle Themen), die Nähe der Schularbeit (über 14, bis 14, bis 7, bis 3 Tage) und der Fokus.
- Ändert sich etwas davon, gilt das alte nicht mehr und es wird neu gefragt (von selbst oder auf Klick). Alte Zeilen bleiben lesbar; die Briefing-Seite zeigt sonst das letzte.
- In der Tabelle `briefings` gibt es weiterhin höchstens eine Zeile je Schüler und Wiener Tag. Die Spalte `daten` hält die Fassung aus den Daten und den Fokus von damals fest.
- Die Fassung aus den Daten wird immer frisch gerechnet. Sie kostet nichts.
- Wer den Knopf noch einmal drückt, sieht das gespeicherte. Neu gefragt wird nur über „Neu erstellen“.
- Läuft die Anfrage noch, wartet ein zweiter Klick auf dieselbe Anfrage (auch auf dem Server). Ein Doppelklick kostet also nichts.
- Jedes Briefing zeigt, was es laut Kostenprotokoll gekostet hat: Dollar, Tokens ein und aus, davon Denken.
- Unter Mehr › KI-Kosten steht „Tagesbriefing“ als eigene Funktion mit „Ø je Aufruf“.
- Gibt es seit dem Briefing neue Dokumentationen, Schularbeiten oder Antworten, steht ein Hinweis da (`datenStand`).

## Von selbst im Hintergrund

`lib/briefing-auto.ts`. Öffnet die Lehrkraft Heute, fragt die App für jeden heutigen Schüler, der noch nicht begonnen hat und für den es zum jetzigen Stand kein KI-Briefing gibt, die KI-Fassung an. Heute wartet nie darauf. Bis sie da ist, steht die Fassung aus den Daten. Ist sie da, zeigt die Karte die Schwierigkeiten aus dem KI-Briefing.

Nur wenn alles erlaubt ist:

- Der Schalter „Briefings automatisch mit KI vorbereiten“ unter Erweitert › KI-Kosten ist an.
- Die KI ist an und nicht im manuellen Modus.
- Das Monatsbudget ist unter der Warnschwelle (80 %). Der Rest bleibt für Klicks der Lehrkraft.
- Der Schüler ist unter 1 € KI-Kosten im Monat. Ab 1 € fragt nur noch ein Klick, ab 3 € stoppt der Router.

Ein lokales Modell kostet nichts. Dafür gelten Budget und Schülergrenze nicht.

Die Anfragen laufen nacheinander, je Schüler höchstens eine zugleich. Bei einem Fehler fragt die App für denselben Stand erst nach sechs Stunden wieder von selbst. Ins Protokoll kommt nur die Schüler-ID, kein Text und kein Schlüssel.

**Schalter und Kosten.** Standard: an. Unter dem Schalter steht, was ein Briefing kostet: gemessen (Ø der letzten 60 Tage, ab drei Aufrufen) oder geschätzt (rund 3 500 Tokens ein, 2 500 aus). Dazu der Monat bei 20 Schülern an 21 Schultagen. Mit Sonnet 5.5 sind das rund 2,9 Cent je Briefing und etwa 12 € im Monat. Wer nicht ändert, fragt nicht neu: dieselben Daten kosten nichts.

## Was das Briefing nie tut

- Es schreibt nicht in Lernstand, Versuche, Dokumentationen oder Schularbeiten. Seine einzige Tabelle ist `briefings`.
- Ein Test vergleicht den Lernstand vor und nach zwei KI-Briefings.
- Ohne KI, mit leerem Budget oder bei einem Fehler bleibt die Fassung aus den Daten stehen, mit einem kurzen Hinweis. Heute und der Unterricht laufen ohne KI weiter.
- Im manuellen Modus erscheint der Prompt zum Kopieren.

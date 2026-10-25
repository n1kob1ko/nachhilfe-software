# Heute · Unterricht · Abschluss

Die Lehreroberfläche hat drei Bereiche für den Alltag und einen für alles andere (niko, 25.10.2026). Kein Feature ist
weg: was nicht in die drei Bereiche gehört, steht unter **Erweitert**.

| Navigation | Adresse | Was dort ist |
| --- | --- | --- |
| Heute | `/` | Die Schüler von heute als kurze Karten: Zeit, Name, Klasse, Fach, Thema, Warum, Vorbereitet, Schwierigkeiten, Prüfung (bis 30 Tage). Ein Hauptknopf „Einheit starten“. Läuft eine Einheit, steht sie oben mit „Zum Unterricht“; die Karte des Schülers darunter ist dann eine leise Zeile. Siehe [Tagesbriefing](tagesbriefing.md#automatische-vorbereitung). |
| Unterricht | `/unterricht` | Leitet in die laufende Einheit (bei zwei in die früher gestartete). Läuft keine: „Gerade läuft keine Einheit“ mit dem nächsten Schüler. |
| Abschluss | `/abschluss` | Leitet zum letzten beendeten, noch nicht bestätigten Abschluss von heute (Wiener Tag). Sonst „Nichts zu bestätigen“ und die offenen der letzten 14 Tage. |
| Erweitert | `/mehr` | Alles andere, oben die Gruppe „Arbeit“. |

`/jetzt` leitet dorthin, wo die Lehrkraft gerade gebraucht wird (`lib/situation.ts`): laufende Einheit → Unterricht,
offener Abschluss von heute → Abschluss, sonst Heute. Dorthin führen das Anmelden, das Logo und „Dokumentation
bestätigen“. Die Navigation markiert auf einer laufenden Einheit „Unterricht“, auf einer beendeten „Abschluss“.

## Unterricht (laufende Einheit, `/einheiten/[id]`)

Der geführte Unterricht (`components/cockpit/Ablauf.tsx`): Kopf mit Name, Fach, Restzeit, „Einheit beenden“ und bei
zwei Schülern zugleich einem Umschalter. Darunter eine Gerätezeile (falsche Antworten rot, auf Tippen alle Details und
„Gerät verbinden“), die Schritte als Punkte und eine Karte mit dem Schritt: „Schritt x von n · Minute a–b“, Das sagst du,
Das zeigst du (Folie, „Vortrag öffnen“), Das fragst du, Erwartete Antwort, „Übung senden“ und drei Knöpfe:

- **Weiter**: Schritt erledigt, der nächste offene kommt.
- **Wiederholen**: zählt mit (`einheit_cockpit.wiederholt`), der Schritt bleibt. Beim Beenden steht er unter „Wiederholen“.
- **Schüler versteht es nicht**: zählt mit (`einheit_cockpit.nicht_verstanden`) und zeigt, was es schon gibt: „Bei
  Fehler“ aus dem Paket, übernommene Anpassungen (Bei Fehler, leichtere Frage, Zusatzbeispiel), Erklärung und typische
  Fehler der Fähigkeit (`hilfeBeiFehler`, ohne KI). Beim Beenden steht der Schritt unter „Schwierigkeiten“.

Bei einer Verständnisfrage oder Kontrolle stehen unter der erwarteten Antwort drei kleine Knöpfe **Richtig /
Teilweise / Falsch** (`einheit_cockpit.antworten`, noch einmal tippen nimmt es zurück). Das sind Beobachtungen des
Lehrers, der Lernstand bleibt unberührt; der Abschluss kann sie über `antwortenDerEinheit` (lib/cockpit.ts) lesen.

Ohne Lernpaket kommen die Schritte aus dem „Plan für heute“ des Briefings (beim ersten Tippen festgehalten,
`einheit_cockpit.plan`); „Übung senden“ nimmt die passende Übung aus dem Bestand oder neue Aufgaben aus den
Generatoren. Sind alle Schritte durch, kommt „Alles durch“ mit „Einheit beenden“.

Die Einheit einer anderen Lehrkraft ist nur zum Lesen da (Übungen und Fortschritt, kein Beenden).

### Textarbeit im Ablauf

Ist die Fähigkeit eines Schritts eine Schreibaufgabe (Plan, Lernpaket, Vorgabe oder Prüfungsstoff,
`lib/textarbeit-ablauf.ts`), ist **„Schreibauftrag starten“** die Hauptaktion, vorgefüllt mit Textsorte, Aufgabe,
Wortzahl und Quelle („Vorgefüllt aus deiner Vorgabe für heute“). Er führt zum Textformular (`/text?schreiben=…`), bei
Oberstufe/HTL (Textinterpretation, Erörterung …) zum Schreibauftrag mit Textbeilage und der Prüfung vorgewählt, bei der
Bildgeschichte zu ihr. Vor dem Start lässt sich alles ändern. Im Schritt „Schularbeit vorbereiten“ steht die
Schreibaufgabe der Prüfung als zweiter Knopf neben „Übung senden“.

Jede laufende Textarbeit der Einheit hat oben eine Zeile mit Stand und genau einem nächsten Schritt: schreibt (Öffnen
oder Mitlesen, ohne Gerät auch „Vom Foto“) · abgegeben (Korrigieren) · Bewertung offen (Bewertung übernehmen) ·
bewertet · Note N (Ansehen). Bei zwei Schülern zugleich nur die Texte dieser Einheit.

### Anpassung im Unterricht

niko, 25.10.2026: Lernheft reagiert auf die Antworten des Schülers, zuerst nach festen Regeln, KI nur wenn nötig und
im Budget, und alles geht auch ohne KI. Unter der Gerätezeile steht dann **ein** Vorschlag: der Grund in einfachen
Worten („2 Fehler: Kehrwert vergessen · Brüche dividieren“), ein Hauptknopf und zugeklappt **Andere Möglichkeit**
(die übrigen Wege, „Nicht nötig“ und nur dort neue Aufgaben der KI mit Kosten). Er kommt mit jeder neuen Antwort neu
(die Gerätezeile lädt die Seite nach) und zählt nur Antworten nach der letzten Reaktion (`einheit_cockpit.steuerung`).

| Regel (lib/steuerung-regeln.ts) | Schwelle | Vorschlag |
| --- | --- | --- |
| Fehler | mind. 2 falsche unter den letzten 5 Antworten einer Fähigkeit (Lösung angesehen zählt als falsch) | Aufgabe zu diesem Fehler (wenn ein Generator „Fehler korrigieren“ kann), sonst Leichtere Aufgabe (Stufe −1); auf der leichtesten Stufe eine nicht sichere Voraussetzung (unter 70 %), sonst Einfacher erklären |
| Zeichen des Lehrers | „Schüler versteht es nicht“ oder „Falsch“ bei der Frage | derselbe leichtere Weg, in der Karte des Schritts |
| Hilfen | Hilfe bei mehr als der Hälfte von mind. 2 Aufgaben | Gemeinsam an der Tafel (die aktuelle Aufgabe aufs Whiteboard) |
| Alles richtig | mind. 3 Aufgaben (kürzere Übung: alle) im ersten Versuch ohne Hilfe | schnell (Median bis 60 s): Schwerere Aufgabe, sonst Weiter zum nächsten Schritt |
| Nichts gesendet oder noch keine Antwort | – | kein Vorschlag |

Es bleibt bei den Fähigkeiten von heute: Vorgabe für heute vor der Fähigkeit des Schritts vor dem Stoff der nächsten
Prüfung (bis 30 Tage); eine Voraussetzung davon gehört dazu. Die Aufgaben kommen in dieser Reihenfolge (`lib/steuerung.ts`):

1. **A, vorhanden**: Aufgaben der Schritte des Lernpakets, freigegebene Übungen (allgemeine oder die des Schülers) und
   die Bibliothek, zur Fähigkeit und Stufe.
2. **B, Generatoren und Banken**: neue Aufgaben ohne KI (bei „Aufgabe zu diesem Fehler“: Fehler korrigieren).
3. **C, KI**: nur, wenn A und B für keine Möglichkeit etwas haben, nur auf Tippen („Neue passende Aufgabe erstellen ·
   ca. 2 Cent“), über `newExerciseForUnit` mit denselben Prüfungen (Aufgaben mit „Bitte prüfen“ gehen nicht hinaus).
   Gesperrt mit Grund bei KI aus, manuellem KI-Modus, aufgebrauchtem Budget und erreichter Grenze des Schülers.
   Antwortet die KI nicht, kommen die Aufgaben aus dem Generator, und oben steht das in einem Satz. Die Kosten stehen
   wie immer unter KI-Kosten beim Schüler. Nichts davon läuft im Hintergrund.

Schlecht bewertete Aufgaben und schon gesendete kommen nie in die Auswahl. Ein Tippen schickt drei Aufgaben an den
Schüler **dieser** Einheit (auch bei zwei zugleich); ohne Gerät liegt die Übung am Lernlink, und oben steht „Zum Drucken
öffnen“. Die KI-Live-Analyse (KI-Hinweis) bleibt, wie sie ist; gibt es zur aktuellen Übung einen, steht er unter dem
Vorschlag als **Zusatz-Hinweis**, nie an seiner Stelle.

### Was steht heute an?

niko, 25.10.2026: Manchmal sagt der Schüler am Anfang, was heute dran ist, oder zeigt einen Zettel. Gleich unter
dem Kopf steht darum eine zugeklappte Zeile **Was steht heute an?** (optional, `components/cockpit/Vorgabe.tsx`).
Ohne Eingabe bleibt alles wie bisher, der Start ist nicht langsamer (eine Abfrage mehr).

- Aufgeklappt: Textfeld („Heute Present Continuous und Fragen, nächste Woche Test“), Fotos oder PDF (bis 8),
  oder eine eingetragene Prüfung. Namen im Text werden maskiert; Dateien liest die KI nur mit dem Haken „Auf den
  Blättern steht kein Name“, sonst werden sie nur angehängt. Ohne KI liest die App den Text selbst (`regelLesung`), die Dateien hängen trotzdem an.
- Gespeichert als **Vorgabe für heute** (`einheit_vorgabe`, `lib/vorgabe.ts`). In der Vorbereitung steht sie
  über der Prüfung. Ist im Ablauf noch nichts getan, wird der Plan gleich danach neu gemacht („Plan für heute
  nach deiner Vorgabe“); sonst bleibt er und die Karte bietet **Plan anpassen** an (Notizen bleiben).
- Die Karte zeigt die Punkte mit ihrer Fähigkeit, unklare als Chips zum kurzen Bestätigen (nichts
  vorausgewählt), was schwierig war, und eine **Abweichung** zur nächsten Prüfung, z. B. „Laut Stoffzettel
  auch Past Simple und Writing – heute nicht geplant“.
- Ein Termin im Text („nächste Woche Test“) wird nie von selbst eingetragen: die Karte fragt, das Datum
  wählt die Lehrkraft.
- „Ändern“ und „Entfernen“ gibt es immer. Wählt die Lehrkraft selbst ein Paket oder eine Fähigkeit, gilt das.

### Wohin es gewandert ist

| Früher | Jetzt |
| --- | --- |
| Startseite: Kennzahlen, Zu erledigen (`#offen`), Vorbereitung 7 Tage (`#vorbereitung`), Zuletzt verwendet | Erweitert › Übersicht (`/mehr/uebersicht`); alte Anker leiten dorthin |
| Startseite „Meine Woche“ (`/?tab=woche`), Terminanfragen | Erweitert › Meine Woche (`/mehr/uebersicht?tab=woche`); die alte Adresse leitet weiter |
| Navigation: Schüler, Übungen, Abrechnung; Mehr › Planung | Erweitert › Arbeit |
| Einheit: Bereich „Übungen“ (Foto vom Stoff, Textarbeit, Bildgeschichte, Schreibauftrag, Minitest, Link fürs Gerät) | Weitere Werkzeuge; die ganze Ansicht unter `?bereich=uebungen` |
| Einheit: Bereich „Fortschritt“ | Weitere Werkzeuge › Fortschritt (`?bereich=fortschritt`) |
| Einheit: Cockpit (Paket wählen, Anpassen, Überspringen, Verschieben, Notiz, Aufgaben mit Lösung, ohne Paket) | Unterricht; das Übrige unter Weitere Werkzeuge (`?bereich=cockpit`) |
| Einheit abbrechen | Weitere Werkzeuge (und unten in Übungen und Fortschritt) |

## Abschluss (beendete Einheit, `/einheiten/[id]`)

Eine Karte mit vier Feldern aus echten Daten (`lib/abschluss.ts`): Heute gemacht, Gut verstanden, Noch schwierig,
Nächstes Mal. Ohne Beleg bleibt „Gut verstanden“ leer: „Keine sicheren Ergebnisse – bei Bedarf ergänzen“.
Eine Textarbeit mit übernommener Bewertung steht unter „Heute gemacht“ mit Textsorte und Note, Kriterien ab Stufe 4
unter „Noch schwierig“. Ist nur ein Vorschlag da oder fehlt die Bewertung, steht „Bewertung offen“ mit einem Link
(„Bewertung übernehmen“ oder „Korrigieren“); ein Vorschlag der KI erscheint nie als Ergebnis.
„Dokumentation bestätigen“ setzt nur `reviewed_at` und führt zu `/jetzt`; danach steht „Bestätigt am …“ da.
„Ändern“ (`?aendern=1`) öffnet das Formular der Dokumentation. Alles Übrige (Mappe drucken, Einschätzung, Auf einen
Blick, Notiz für Eltern, Dokumentation, Aufgaben, Lernpaket-Rückblick, Texte, Whiteboard) steht unter „Mehr Details“
(`?details=1`).

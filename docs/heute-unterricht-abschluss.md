# Heute · Unterricht · Abschluss

Die Lehreroberfläche hat drei Bereiche für den Alltag und einen für alles andere (niko, 25.10.2026). Kein Feature ist
weg: was nicht in die drei Bereiche gehört, steht unter **Erweitert**.

| Navigation | Adresse | Was dort ist |
| --- | --- | --- |
| Heute | `/` | Die Schüler von heute als kurze Karten: Zeit, Name, Klasse, Fach, Thema, Warum, Vorbereitet, Schwierigkeiten, Prüfung (bis 30 Tage). Ein Hauptknopf „Einheit starten“. Läuft eine Einheit, steht sie oben mit „Zum Unterricht“; die Karte des Schülers darunter ist dann eine leise Zeile. Siehe [Tagesbriefing](tagesbriefing.md#automatische-vorbereitung). |
| Unterricht | `/unterricht` | Leitet in die laufende Einheit (bei zwei in die früher gestartete). Läuft keine: „Gerade läuft keine Einheit“ mit dem nächsten Schüler. |
| Abschluss | `/abschluss` | Leitet zum letzten beendeten, noch nicht bestätigten Abschluss von heute (Wiener Tag). Sonst „Nichts zu bestätigen“ und die offenen der letzten 14 Tage, auch automatisch beendete („automatisch beendet“). Auf Heute steht dazu eine leise Zeile „2 Abschlüsse offen“. |
| Erweitert | `/mehr` | Alles andere, oben die Gruppe „Arbeit“. |

`/jetzt` leitet dorthin, wo die Lehrkraft gerade gebraucht wird (`lib/situation.ts`): laufende Einheit → Unterricht,
offener Abschluss von heute → Abschluss, sonst Heute. Dorthin führen das Anmelden, das Logo und „Dokumentation
bestätigen“. Die Navigation markiert auf einer laufenden Einheit „Unterricht“, auf einer beendeten „Abschluss“.

## Unterricht (laufende Einheit, `/einheiten/[id]`)

Der geführte Unterricht (`components/cockpit/Ablauf.tsx`): Kopf mit Name, Fach, Restzeit, „Einheit beenden“ und bei
zwei Schülern zugleich einem Umschalter. Darunter eine Gerätezeile (falsche Antworten rot, auf Tippen alle Details und
„Gerät verbinden“), die Schritte als Punkte und eine Karte mit dem Schritt: „Schritt x von n · Minute a–b“, Das sagst du,
Das zeigst du (Folie, „Vortrag öffnen“), Das fragst du, Erwartete Antwort, „Passende Übungen senden“, zugeklappt
„Lösung · typische Fehler · Hintergrund“ und drei Knöpfe:

- **Weiter**: Schritt erledigt, der nächste offene kommt.
- **Wiederholen**: zählt mit (`einheit_cockpit.wiederholt`), der Schritt bleibt. Beim Beenden steht er unter „Wiederholen“.
- **Schüler versteht es nicht**: zählt mit (`einheit_cockpit.nicht_verstanden`) und zeigt, was es schon gibt: „Bei
  Fehler“ aus dem Paket, übernommene Anpassungen (Bei Fehler, leichtere Frage, Zusatzbeispiel), Erklärung und typische
  Fehler der Fähigkeit (`hilfeBeiFehler`, ohne KI). Beim Beenden steht der Schritt unter „Schwierigkeiten“.

Bei einer Verständnisfrage oder Kontrolle stehen unter der erwarteten Antwort drei kleine Knöpfe **Richtig /
Teilweise / Falsch** (`einheit_cockpit.antworten`, noch einmal tippen nimmt es zurück). Das sind Beobachtungen des
Lehrers, der Lernstand bleibt unberührt; der Abschluss kann sie über `antwortenDerEinheit` (lib/cockpit.ts) lesen.

Ohne eigens gewähltes Lernpaket kommen die Schritte aus dem **Plan für die ganze Einheit** (`lib/stundenplan.ts`,
niko 27.10.2026; ohne KI, mit der KI aus derselbe Plan):

- **Themen:** zuerst die Vorgabe für heute (je Fähigkeit ein Thema, die mit einer nahen Prüfung vorne), dann die
  Signale der automatischen Vorbereitung in ihrer Reihenfolge. Was dieselbe Fähigkeit meint, ist ein Thema. Höchstens
  3 Themen, bis 60 Minuten 2, bis 40 Minuten 1, jedes mindestens 20 Minuten. Die Dauer kommt vom Platz im Wochenplan,
  sonst von der von Hand geplanten Einheit, sonst vom Schüler, sonst 100 Minuten.
- **Grundlagen zuerst:** ist eine direkte Voraussetzung laut Lernstand nicht sicher (unter 70 %; ohne Daten zählt sie
  nicht als schwach), steht vor dem Thema ein kurzer Block „Grundlage: …“ aus seinen Minuten. Ist die Voraussetzung
  selbst ein Thema von heute, kommt dieses Thema zuerst.
- **Je Thema:** Erklären → Üben (Bestand, sonst Generator) → **Lernkontrolle** (3 Aufgaben, ein Versuch, ohne Hilfen;
  danach Richtig / Teilweise / Falsch; bei einer Schreibaufgabe „Schreibauftrag starten“ bzw. der laufende Text). Dazu ein kurzer Einstieg (mit der offenen Hausübung) und der Abschluss. Die
  Minuten der Themen nach Rang (4 : 3 : 2), zusammen genau die Dauer.
- **Geprüfte Lernpakete zuerst:** passt ein geprüftes Paket zum Thema (Fach, Schulart, Stufe, Fähigkeit), sind seine
  Schritte der Block des Themas, die Minuten auf die des Themas gebracht (50 Minuten Paket in 35 Minuten). Jeder Schritt
  kennt seine Quelle (Paketschritt oder Fähigkeit) und sein Thema; Senden, Lösungen, Folien und Richtig/Teilweise/Falsch
  gehen wie im Paket. Ungeprüfte Pakete nimmt der Plan nie.

Der Plan wird gelesen, bis zum ersten Weiter, Wiederholen oder Senden; dann ist er festgehalten
(`einheit_cockpit.plan`). Eine neue Vorgabe davor macht ihn neu. Wählt die Lehrkraft selbst ein Paket (im Unterricht
oder mit „Einheit vorbereiten“), gilt wie bisher genau dieses Paket. Über der Karte steht eine Zeile mit den Themen
und Minuten („Past Simple 35 · E-Mail 30 · Tagesablauf 20“); antippen öffnet die Schritte. In der Karte steht das
Thema über dem Titel. Sind alle Schritte durch, kommt „Alles durch“ mit „Einheit beenden“.

**Lehrertext ohne Paket** (niko 27.10.2026, ohne KI): „Das sagst du“ ist die ganze Erklärung der Fähigkeit; die ersten
zwei, drei Sätze stehen da, der Rest unter „Mehr“. „Das zeigst du“ ist ein durchgerechnetes Beispiel aus einer echten
Aufgabe des Schritts (Aufgabe und Lösung), „Das fragst du“ und „Erwartete Antwort“ eine andere. Ist der Text dünn,
gibt es **„Ausführlicher erklären · ca. 1 Cent“** (nur Lehrer, `lib/ausfuehrlich.ts`): eine Anfrage an die KI mit
Fähigkeit, Fach, Schulstufe und typischen Fehlern, ohne Schülerdaten. Die Antwort (längerer Text, Beispiel, Frage mit
Antwort, zwei typische Fehler) wird geprüft (in Mathematik jede Rechenzeile; was falsch ist, fällt weg) und je
Fähigkeit, Schulstufe und Fassung des Prompts gespeichert (`ki_erklaerungen`): jeder weitere Schüler dieser Stufe
kostet nichts. Ohne KI fehlt der Knopf, bei aufgebrauchtem Budget sagt er warum.

**Die nächste Übung bereit:** beim Zeigen eines Schritts baut die App die Übung des nächsten Übungs- oder
Kontrollschritts schon aus den Generatoren (ohne KI, `haltBereit`), nie weiter voraus. Sie liegt nur in
`einheit_bereit`, nie als Übung; der Schüler sieht sie erst nach dem Senden, dann geht genau sie hinaus. Ändert sich
der Plan oder die Stufe, wird sie neu gebaut.

**Die Zeit passt sich an:** bei jedem Weiter, Überspringen oder Springen taktet die App den Rest neu
(`neuTakten`): Rest = weniger von „bis zum Ende des Platzes“ und „geplante Minuten − vergangen“, nie mehr als der Plan.
Erledigte Schritte bleiben, das Thema auf dem Schirm behält seine Minuten, spätere Themen werden im Verhältnis kürzer
(in 5-Minuten-Schritten), eine Lernkontrolle behält mindestens 5 Minuten. Fiele ein Thema unter 10 Minuten, kommt es
auf **„Nächstes Mal“** (eine Zeile unter den Themen); seine Schritte gelten als nicht erreicht und stehen im Abschluss
unter „Weiter mit“. Öffnet die Lehrkraft einen seiner Schritte, kommt es zurück. „Minute a–b“ folgt dem neuen Takt.
Ein selbst gewähltes Lernpaket behält seine Minuten.

Die Einheit einer anderen Lehrkraft ist nur zum Lesen da (Übungen und Fortschritt, kein Beenden).

### Textarbeit im Ablauf

Ist die Fähigkeit eines Schritts eine Schreibaufgabe (Plan, Lernpaket, Vorgabe oder Prüfungsstoff,
`lib/textarbeit-ablauf.ts`), ist **„Schreibauftrag starten“** die Hauptaktion, vorgefüllt mit Textsorte, Aufgabe,
Wortzahl und Quelle („Vorgefüllt aus deiner Vorgabe für heute“). Er führt zum Textformular (`/text?schreiben=…`), bei
Oberstufe/HTL (Textinterpretation, Erörterung …) zum Schreibauftrag mit Textbeilage und der Prüfung vorgewählt, bei der
Bildgeschichte zu ihr. Vor dem Start lässt sich alles ändern. Im Schritt „Schularbeit vorbereiten“ (im Plan für die
ganze Einheit: Üben zu einem Thema der nahen Prüfung) steht die Schreibaufgabe der Prüfung als zweiter Knopf neben
„Passende Übungen senden“.

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
   ca. 2 Cent“) oder im KI-Budget der Einheit von selbst (`lib/ki-nachschub.ts`). Die Aufgaben kommen immer zuerst als
   Vorschau „neu erstellt, ungeprüft“ mit Lösungen in den Vorschlag; an den Schüler erst mit „Senden“, „Verwerfen“
   schickt nichts. Aufgaben mit „Bitte prüfen“ fallen vorher weg. Gesperrt mit Grund bei KI aus, manuellem KI-Modus,
   aufgebrauchtem Budget und erreichter Grenze des Schülers. Antwortet die KI nicht, steht der Grund unter dem Knopf.
   Die Kosten stehen unter KI-Kosten beim Schüler und in der Einheit.

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
  über der Prüfung. Ist im Ablauf noch nichts getan, wird der Plan gleich danach neu gemacht (ihre Themen zuerst,
  „Nach deiner Vorgabe“); sonst bleibt er und die Karte bietet **Plan anpassen** an (Notizen bleiben).
- Die Karte zeigt die Punkte mit ihrer Fähigkeit, unklare als Chips zum kurzen Bestätigen (nichts
  vorausgewählt), was schwierig war, und eine **Abweichung** zur nächsten Prüfung, z. B. „Laut Stoffzettel
  auch Past Simple und Writing – heute nicht geplant“.
- Ein Termin im Text („nächste Woche Test“) wird nie von selbst eingetragen: die Karte fragt, das Datum
  wählt die Lehrkraft.
- „Ändern“ und „Entfernen“ gibt es immer. Wählt die Lehrkraft selbst ein Paket oder eine Fähigkeit, gilt das.
- **Art der Unterlagen** (niko, 27.10.2026: „Lernheft muss unterscheiden, ob das Dokument ein Thema erklärt, eine
  Aufgabe enthält oder den Prüfungsumfang festlegt“): je Datei eine Zeile „Foto 2: erklärt ein Thema“ mit einer kleinen
  Auswahl (legt den Prüfungsstoff fest, ist ein Inhaltsverzeichnis, erklärt ein Thema, enthält Aufgaben, etwas anderes).
  Ein Tippen ändert sie (an der Datei gespeichert, `materials.rolle`); die Vorgabe wird aus der gespeicherten Lesung neu
  gemacht, ohne KI-Anfrage. Erklärung und Aufgaben geben die Themen für heute, nie den Prüfungsstoff: keine
  Abweichung, nichts davon in „Prüfung eintragen“, an einer Prüfung nur „noch zu klären“. Ein Blatt mit Aufgaben ist
  an der Datei vermerkt (`rolle = 'aufgaben'`); die Aufgaben selbst werden noch nicht übernommen.
- **Vorhandenes Material**: unter dem Foto-Knopf die Fotos und PDFs des Schülers, das neueste zuerst (6, dann
  „mehr“), zum Antippen zusammen mit neuen Fotos. Sie gehen denselben Weg; was schon gelesen ist (dieselben Dateien,
  dieselbe Fassung), kostet nichts mehr und braucht auch keinen Haken und keine KI. Kommt ein neuer Text dazu, wird
  nur der Text gelesen.
- Ohne KI zerlegt die App den Text selbst; Fotos und PDFs werden gespeichert, und die Karte sagt, dass nur die KI sie
  liest. Eine Datei, die schon als Stoffzettel an einer Prüfung hängt, gilt ohne Lesen als „legt den Prüfungsstoff fest“.

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
„Ändern“ (`?aendern=1`) öffnet das Formular der Dokumentation. Alles Übrige (Mappe drucken, Einschätzung, Auf einen
Blick, Notiz für Eltern, Dokumentation, Aufgaben, Lernpaket-Rückblick, Texte, Whiteboard) steht unter „Mehr Details“
(`?details=1`).

### Automatischer Abschluss

niko, 25.10.2026: „Am Ende der Einheit wird die Dokumentation automatisch vorbereitet, nur aus echten Daten. Die
Lehrkraft tippt nur ‚Dokumentation bestätigen‘.“ Die KI darf keinen Fortschritt erfinden; unsichere Beobachtungen sind
nie Fakten. Jede Zeile der Karte sagt leise, woher sie kommt (`QUELLE` in `lib/abschluss.ts`, gesammelt von
`belegeDerEinheit`):

| Quelle (Hinweis) | Was | Feld |
| --- | --- | --- |
| aus Antworten | Aufgaben am Gerät (Bericht der Einheit): Themen, Anzahl, erster Versuch, mit Hilfe; Fehler nach Art, „vermutet“, solange die Lehrkraft die Fehlerart nicht bestätigt hat; Minitest am Anfang | Heute gemacht, Gut verstanden (Regeln), Noch schwierig |
| deine Beobachtung | Richtig / Teilweise / Falsch bei Fragen und Kontrollen (`antwortenDerEinheit`) | Richtig: Gut verstanden, aber nie allein als sicheres Ergebnis; Teilweise, Falsch: Noch schwierig |
| Anpassung | gesendete Aufgaben der Anpassung im Unterricht (`einheit_cockpit.steuerung.reaktionen`) | leichter, Grundlage, zum Fehler: Noch schwierig („Leichtere Aufgabe nötig bei Dividieren (danach 3 von 3 richtig)“); schwerer: Gut verstanden nur, wenn alle Antworten darauf richtig waren |
| Ablauf | erledigt, wiederholt, nicht verstanden, nicht erreicht, übersprungen | Heute gemacht, Noch schwierig, Nächstes Mal |
| Vorgabe | die bestätigten Fähigkeiten der Vorgabe für heute: geübt (Antworten, erledigter Schritt, Beobachtung, Textarbeit) oder nicht | Heute gemacht („Aus deiner Vorgabe geübt“), Nächstes Mal („Aus deiner Vorgabe noch offen“) |
| Prüfung | die nächste eingetragene Prüfung (bis 30 Tage, nur ein gespeichertes Datum) und ihr Stoff ohne Antwort in den 30 Tagen davor, höchstens drei Punkte | Nächstes Mal, ganz oben |
| Text | Textarbeit mit übernommener Note oder „Bewertung offen“ | Heute gemacht, Noch schwierig |
| Lernstand, Hausübung | Empfehlung (`nextSteps`), offene Hausübung | Nächstes Mal |
| deine Notiz, von dir | was die Lehrkraft selbst geschrieben oder in der Karte korrigiert hat | im jeweiligen Feld |

**Gut verstanden** hat feste Regeln (`gutVerstanden`), nur aus dieser Einheit:

1. mindestens 3 Aufgaben einer Fähigkeit im ersten Versuch ohne Hilfe richtig und keine falsche Antwort dazu (falsch
   abgegeben, erst nach einem Fehlversuch richtig oder Lösung angesehen zählt als falsch; ein Hinweis nicht),
2. oder mindestens 2 richtige Aufgaben ohne falsche Antwort und dein „Richtig“ bei einer Frage dieser Fähigkeit,
3. oder eine schwerere Aufgabe der Anpassung mit mindestens 2 Aufgaben, alle im ersten Versuch richtig.

Dein „Teilweise“ oder „Falsch“ zu einer Fähigkeit schließt sie aus. Ohne Treffer steht „Keine sicheren Ergebnisse – bei
Bedarf ergänzen“, deine Beobachtungen darunter. Eine Fähigkeit mit sicherem Ergebnis steht nicht zugleich unter „Noch
schwierig“. Die KI-Zusammenfassung der Einheit (`onUnitEnd`, im Hintergrund) steht nur unter „Mehr Details“ als
„Vorschlag der KI“ und kommt nie in die Felder, die Dokumentation oder den Lernstand.

**Schnell korrigieren:** ein Tippen auf ein Feld (oder den Stift daneben) öffnet ein Textfeld mit seinen Zeilen.
„Speichern“ schreibt nur dieses Feld in die Dokumentation (`korrigiereFeld`, `lessons.abschluss_eigen`) und bestätigt
nicht; das Feld zeigt dann genau diesen Text („von dir“). Leer gespeichert, kommt es wieder aus den Daten. Das große
Formular „Ändern“ bleibt.

**Dokumentation bestätigen** (`bestaetigeAbschluss`) schreibt die vier Felder in die Dokumentation, nur wo die Lehrkraft
nichts selbst geschrieben hat (leer oder noch der automatische Wert): Heute gemacht → `activities`, Gut verstanden →
`positives`, Noch schwierig → `difficulties`, Nächstes Mal → `next_steps`. Eine Beobachtung steht dort mit
„(Beobachtung)“. Dann `reviewed_at`, und weiter zu `/jetzt`: läuft ein zweiter Schüler, in seinen Unterricht, wartet
sein Abschluss von heute, dorthin, sonst Heute. „Nächstes Mal“ liest die nächste Vorbereitung als offenes Ziel
(„Nächstes Mal (Einheit am …)“, `lib/vorbereitung-auto.ts`). Die Notiz für Eltern oder Schüler (Mehr Details) entsteht
aus denselben vier Feldern, ohne deine Beobachtungen.

Offene Abschlüsse gehen nicht verloren: auch automatisch beendete Einheiten (`sweepIdleUnits`) stehen unter
`/abschluss`, und Heute zeigt eine leise Zeile („2 Abschlüsse offen“).

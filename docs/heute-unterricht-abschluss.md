# Heute · Unterricht · Abschluss

Die Lehreroberfläche hat drei Bereiche für den Alltag und einen für alles andere (niko, 25.10.2026). Kein Feature ist
weg: was nicht in die drei Bereiche gehört, steht unter **Erweitert**.

| Navigation | Adresse | Was dort ist |
| --- | --- | --- |
| Heute | `/` | Die Schüler von heute als kurze Karten: Zeit, Name, Klasse, Fach, Thema, Schwierigkeiten, Prüfung (bis 30 Tage), Empfehlung. Ein Hauptknopf „Einheit starten“. Läuft eine Einheit, steht sie oben mit „Zum Unterricht“. |
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

Ohne Lernpaket kommen die Schritte aus dem „Plan für heute“ des Briefings (beim ersten Tippen festgehalten,
`einheit_cockpit.plan`); „Übung senden“ nimmt die passende Übung aus dem Bestand oder neue Aufgaben aus den
Generatoren. Sind alle Schritte durch, kommt „Alles durch“ mit „Einheit beenden“.

Die Einheit einer anderen Lehrkraft ist nur zum Lesen da (Übungen und Fortschritt, kein Beenden).

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
„Dokumentation bestätigen“ setzt nur `reviewed_at` und führt zu `/jetzt`; danach steht „Bestätigt am …“ da.
„Ändern“ (`?aendern=1`) öffnet das Formular der Dokumentation. Alles Übrige (Mappe drucken, Einschätzung, Auf einen
Blick, Notiz für Eltern, Dokumentation, Aufgaben, Lernpaket-Rückblick, Texte, Whiteboard) steht unter „Mehr Details“
(`?details=1`).

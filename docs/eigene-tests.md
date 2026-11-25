# Eigene Tests

niko, 2026-11-22: „ich möchte das auf der nachhilfe software für max haben“, mit dem Link zu seinem claude.ai-Artifact
„Test: Europe – Geography“ (Englisch, vier Teile, Karte, Punkte und Note, Ergebnis zum Kopieren in Discord). Ein
**eigener Test** ist so ein fertiger Test als Seite der Schüler-App: wörtlich übernommen, je Schüler freigeschaltet,
geprüft am Server, das Ergebnis bei der Lehrkraft statt in Discord.

| Bereich | Ort |
|---|---|
| Fragen, Ansicht ohne Lösungen, Bewertung, Note (ohne Datenbank, auch im Browser) | `lib/eigene-tests.ts` |
| Liste der Tests (nur Server: die Dateien enthalten die Lösungen) | `lib/eigene-tests-liste.ts` |
| Die Tests | `lib/eigene-tests/europe-geography.ts` (Max), Bild `public/spiele/tests/europe-geography/karte.webp`; `lib/eigene-tests/chemie-probetest-5.ts` (Yanxin, 2026-11-25, aus einem PDF) |
| Freigabe, Abgaben, Punkte der offenen Fragen | `lib/eigene-tests-speicher.ts`, Tabellen `eigene_test_freigaben`, `eigene_test_abgaben` |
| Aktionen | `app/eigene-test-actions.ts` |
| Schüler-App: Test | `app/lernen/[token]/test/[key]/page.tsx`, `components/lernen/EigenerTest.tsx` |
| Schüler-App: Karte auf Start und unter Prüfungen | `components/lernen/EigeneTestsTeaser.tsx` |
| Lehrkraft: Profil › „Übungen & Verlauf“ › „Tests in der App“ (ganz oben) | `components/EigeneTestsProfil.tsx` |
| Lehrkraft: eine Abgabe | `app/(tutor)/schueler/[id]/test/[abgabeId]/page.tsx`, `components/TestLehrerPunkte.tsx` |
| Tests | `lib/eigene-tests.test.ts` |

## Ablauf

1. Schülerprofil › **Übungen & Verlauf** › „Tests in der App“ (ganz oben) › **Für Max freischalten**. „Zurücknehmen“ nimmt ihn aus der
   App; Abgaben bleiben. Der Testschüler unter Mehr › Spiele testen sieht alle Tests, zum Ausprobieren.
2. Der Schüler sieht den Test auf **Start** und unter **Prüfungen** („etwa 40 Minuten · noch nicht gemacht“). Alle Fragen
   stehen untereinander; die Antworten bleiben bis zum Abgeben auf dem Gerät (localStorage), ein Neuladen verliert nichts.
3. **Test abgeben**: sind Felder leer, fragt die Seite „Test wirklich abgeben?“ (kein Browser-Dialog). Erst jetzt schickt der
   Server Punkte und Lösungen; vorher hat der Browser keine (der Test darauf prüft das).
4. Ergebnis: Punkte, Prozent, Note zur Orientierung (89 / 76 / 63 / 50 %, wie im Artifact), je Teil ein Balken, bei jeder
   Frage ✓ / ✗ mit der richtigen Lösung. Offene Fragen: Musterlösung, der Schüler gibt sich 0 bis n Punkte.
   „Nochmal machen“ beginnt eine neue Abgabe; die Karte auf Start zeigt immer die letzte.
5. Die Lehrkraft sieht jede Abgabe (Datum, Minuten, Punkte, Note, offene Fragen) und setzt bei offenen Fragen eigene Punkte.
   Sie gelten vor der Selbstbewertung; der Schüler sieht dann „Dein Lehrer hat bewertet“.

## Punkte wie im Artifact

- Auswahl je Zeile, Richtig/Falsch je Aussage, Lückentext je Lücke: 1 Punkt.
- Multiple Choice: 1 Punkt. Mehrfachwahl („Tick three“): je richtige 1, je falsch angekreuzte −1, nie unter 0.
- Lücken: Groß/klein, Akzente, Leerzeichen und Satzzeichen zählen nicht (außer `.` und `,` in Zahlen); die erste erlaubte
  Antwort ist die angezeigte Lösung.
- Die Punkte stehen nicht in der Tabelle, sie kommen bei jedem Anzeigen aus den Antworten: eine berichtigte Lösung gilt
  auch für alte Abgaben.

## Chemie-Probetest 5. Klasse (aus einem PDF)

niko, 2026-11-25: „Sowie damals für Max. Soll das für yanxin freigeschaltet werden.“ Vorlage war ein Probetest als PDF
(30 Aufgaben, 79 Punkte, Lösungsteil und Notenschlüssel). Deutsch (`sprache: "de"`): Richtig/Falsch-Knöpfe und
Platzhalter auf Deutsch. Die meisten Aufgaben sind offen (Musterlösung aus dem Lösungsteil, Selbstbewertung); Zahlen
prüft die App als Lücken (Komma oder Punkt, mit oder ohne Einheit, „6“ ist nicht „6,00“).

- `punkte` bei Auswahl, Richtig/Falsch, Lücken und Multiple Choice: die Punkte der ganzen Frage, gleich auf Zeilen bzw.
  Lücken verteilt (12: sechs Aussagen zu je 0,5 P.). Halbe Punkte zeigt `punkteZahl` mit Komma.
- `notenschluessel`: ab 70 / 59 / 50 / 40 Punkten wie auf dem Blatt; ohne ihn gelten die Prozent oben.
- 20 ist zweigeteilt: die Reihenfolge als Auswahl aus vier Reihenfolgen (2 P.), die Frage dazu offen (2 P.).

## Einen weiteren Test übernehmen

Eine Datei in `lib/eigene-tests/` im Format von `EigenerTest` (Arten `auswahl`, `mc`, `mehrfach`, `rf`, `luecken`, `offen`)
und eine Zeile in `lib/eigene-tests-liste.ts`. Bilder unter `public/spiele/tests/<key>/` (die Schüler-App lädt ohne
Anmeldung nur Bilder unter `spiele/`, siehe `proxy.ts`). `pruefeTest` und der Test prüfen Ids, Lösungen und Lücken.

Nicht dabei: am Tablet in der Einheit (`/geraet`) und am eigenen Laptop (`/mitmachen`), Lernstand je Fähigkeit (die Fragen
haben keine Fähigkeit), Druck als A4.

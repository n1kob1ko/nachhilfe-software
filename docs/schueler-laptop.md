# Eigenes Gerät: Schüler arbeiten am eigenen Laptop (Lernheft Phase 2)

Der Schüler öffnet das Lernheft im Browser seines eigenen Laptops: ohne App, ohne Konto. Der Zugang gilt nur für die laufende Einheit.

## Zwei Konzepte, bewusst getrennt

| | Lehrer-Tablet (`/geraet`) | Eigenes Gerät (`/mitmachen`) |
|---|---|---|
| gehört | dem Lehrer, dauerhaft | einer Einheit, vorübergehend |
| verbunden durch | Code unter Mehr › Schülergeräte | Code in der laufenden Einheit + Bestätigung mit Prüfzahl |
| zeigt | die laufende Einheit des Lehrers, egal welcher Schüler | nur die Einheit, für die es bestätigt wurde |
| endet | nur durch „Trennen“ | mit der Einheit, durch „Zugang beenden“ oder „Abmelden“ |
| Daten | `student_devices`, Cookie `lernheft_geraet` (400 Tage) | `laptop_codes`, `laptop_sessions`, Cookie `lernheft_laptop` (endet mit dem Browser) |

Gemeinsam ist nur, was zur Einheit gehört: Was der Schüler gerade sieht (`units.device_view`), die gesendeten Übungen, die Textarbeiten und der Live-Status.

## Ablauf

1. **Starten.** Der Lehrer startet eine Einheit mit Max. Im Live-Status tippt er auf „Eigenes Gerät verbinden“.
2. **Zugang zeigen.** Angezeigt werden:
   - die kurze Adresse (`…/mitmachen`),
   - ein QR-Code zu dieser Adresse (ohne Code),
   - der sechsstellige Zugangscode mit Ablaufzeit (10 Minuten, einmal verwendbar),
   - „Wartet auf Max …“, „Neuer Code“, „Groß zeigen“ und „Abbrechen“.
3. **Code eingeben.** Max öffnet die Adresse am Laptop und gibt den Code ein. Der Laptop zeigt „Warte auf Bestätigung“ und eine zweistellige Prüfzahl. Vor der Bestätigung zeigt er keinen Namen und keine Inhalte.
4. **Bestätigen.** Beim Lehrer erscheint sofort „Ein Gerät möchte sich verbinden · Windows · Chrome · Prüfzahl 47“ mit „Bestätigen“ und „Ablehnen“. Nach der Bestätigung geht der Laptop von selbst in den Arbeitsbereich.
5. **Arbeiten.** Der Arbeitsbereich ist für Laptops gebaut: links „Deine Aufgaben“, rechts die Übung oder der Text.
   - Übungen bearbeiten, Antworten abgeben, Hilfen öffnen.
   - Textarbeiten im vorhandenen Editor schreiben, mit automatischem Speichern.
   - Freigegebene Arbeiten fortsetzen.
   - Keine Lehrer-Menüs, keine Schülerliste, keine Abrechnung, kein Lernverlauf.
6. **Senden.** „An Max senden“, „Textarbeit starten“ und „Am Laptop öffnen“ gehen an den bestätigten Laptop („Auf dem Laptop von Max“). Das Lehrer-Tablet zeigt währenddessen „Max arbeitet am eigenen Laptop“; das Whiteboard funktioniert dort weiter.
7. **Live mitverfolgen.** Der Live-Status zeigt:
   - ob der Laptop verbunden ist,
   - welche Übung offen ist und welche Aufgabe,
   - Versuche, Hilfen, „Abgegeben x von y“ und die letzte Antwort mit Uhrzeit,
   - bei Texten Wörter, letzte Speicherung, „schreibt gerade“ und „Mitlesen“.
8. **Ende.** Wenn die Einheit endet, der Lehrer „Zugang beenden“ drückt oder Max sich abmeldet, verliert der Laptop sofort den Zugang. Er zeigt „Die Einheit ist beendet“ und räumt auf.

## Speicherung und Verbindungsabbrüche

- Antworten und Texte landen in denselben Tabellen wie vom Tablet (`attempts`, `texts`, `text_units`), mit der Einheit. Sie stehen damit in Lernverlauf und Dokumentation.
- **Texte:** Der Editor speichert laufend und hält eine Kopie im Gerät (`localStorage`, Schlüssel `lernheft-laptop-text-<id>`), bis der Server sie hat. Ohne WLAN schreibt Max weiter; die Seite zeigt „Keine Verbindung – deine Arbeit bleibt auf diesem Gerät …“ und speichert, sobald die Verbindung wieder da ist.
- **Antworten:** Geht eine Antwort ohne Verbindung nicht durch, bleibt sie stehen („Keine Verbindung. Deine Antwort ist noch da …“) und wird gesendet, sobald das Internet wieder geht.
- **Keine doppelten Antworten:** Jeder Klick auf „Prüfen“ bekommt eine eigene Abgabe-ID. Wiederholt der Browser dieselbe Abgabe (Antwort kam beim Server an, die Rückmeldung aber nicht), speichert und bewertet der Server sie nur einmal und schickt das erste Ergebnis zurück.
  - In der Datenbank verhindert ein eindeutiger Index (`attempts.student_id` + `submission_id`) eine zweite Zeile; Versuchsnummer und Speichern laufen in einer Transaktion.
  - Kommt die Wiederholung, während die erste Abgabe noch bewertet wird, wartet sie auf deren Ergebnis.
  - Lernverlauf, Lernstand, Dokumentation und Live-Status sehen die Antwort damit genau einmal. Ein neuer Klick zählt weiter als neuer Versuch.
  - Gilt genauso für Lehrer-Tablet und Übungslink (`lib/service.ts` `submitAnswer`).
- **Nicht gespeicherte Texte:** Fehlt die Verbindung, zeigt der Editor deutlich „Noch nicht gespeichert: Deine letzten Änderungen sind nur auf diesem Gerät.“ mit der letzten Speicherzeit. Mit „Als Datei sichern“ lädt der Schüler den Entwurf als Textdatei herunter, bevor er das Fenster schließt. Das geht auch im Abmelden-Dialog und auf der Ende-Seite.
- **Ende während einer Unterbrechung:** Endet die Einheit, während der Laptop offline ist, darf er Texte bis 10 Minuten nach dem Einheitsende noch abgeben (nur Texte seines Schülers). Danach oder nach „Zugang beenden“ nicht mehr.

## Aufräumen am Laptop

- **Reguläres Ende:** Der Laptop gibt noch nicht gespeicherte Texte ab, löscht dann seine Kopien und das Zugangs-Cookie. Der Browser verwirft dabei zwischengespeicherte Seiten (`Clear-Site-Data: "cache"`). Die Seite zeigt danach „Alles gespeichert. Auf diesem Gerät ist nichts mehr davon.“
- **Ohne Verbindung:** Die Kopie bleibt, bis sie gespeichert ist. Die Seite bittet, das Fenster offen zu lassen. Kann ein Entwurf nicht mehr gespeichert werden (Zugang vom Lehrer beendet), wählt der Schüler „Als Text kopieren“ oder „Vom Gerät löschen“.
- **„Abmelden“:** Erst wird alles gespeichert, dann endet der Zugang. Ohne Verbindung fragt die Seite: weiter warten oder „Trotzdem abmelden, Ungespeichertes löschen“.
- Kopien, die älter als ein Tag sind, löscht die Code-Seite.

## Sicherheit

- **Serverseitig geprüft.** Jede Anfrage prüft die Sitzung UND dass ihre Einheit noch läuft (`lib/laptop-context.ts`). Auch ein Ende, das niemand mitbekommen hat (Neustart, automatisches Ende), sperrt den Zugang.
- **Kein Lehrer-Login.** Das Cookie gilt nur für `/mitmachen` und ist `httpOnly`. Lehrerseiten schicken den Laptop zur Anmeldung.
- **Lehrerfreigabe vor Teilnahme.** Vor der Bestätigung sieht der Laptop nichts. Die Prüfzahl verhindert, dass ein fremdes Gerät bestätigt wird.
- **Kein Zugriff auf andere Schüler.** Der Schüler kommt immer aus der Einheit der Sitzung. Übungen (`unitAssignment`) und Texte (`unitText`, `laptopMayWrite`) werden gegen diese Einheit geprüft.
- **Schutz gegen Erraten.**
  - Codes haben 6 Ziffern, gelten 10 Minuten und nur einmal.
  - Pro Adresse sind 8 falsche Codes in 10 Minuten erlaubt, für alle zusammen 100. Danach wartet auch der richtige Code.
  - Ein erratener Code führt nur zu einer Anfrage, die der Lehrer bestätigen muss.
- **Geheimnisse.**
  - Das Cookie enthält 32 Zufallsbytes; die Datenbank speichert nur den SHA-256.
  - Codes werden im Formular geschickt, nie in einer Adresse; der QR-Code enthält nur die Adresse.
  - Die App schreibt weder Codes noch Geheimnisse ins Log.
  - Die Laptop-Tabellen kommen nicht in die Sicherung.
- **Getrennte Lehrer und Schüler.** Jede Sitzung hat einen eigenen Live-Kanal (`laptop:<id>`). Der Live-Status einer Einheit sieht nur ihren Laptop.
- **Railway und HTTPS.**
  - Das Cookie ist in Produktion `Secure`.
  - Die Adresse kommt aus `PUBLIC_URL` bzw. `RAILWAY_PUBLIC_DOMAIN` (`lib/base-url.ts`).
  - Der Live-Kanal endet nach 10 Minuten und verbindet sich neu (Railway-Limit 15 Minuten).
  - Die Sperre gegen Erraten nutzt `X-Real-IP` von Railway.

## Dateien

| Datei | Inhalt |
|---|---|
| `lib/laptop.ts` | Codes, Anfragen, Bestätigen, Beenden, Schreibrechte, Erraten-Schutz |
| `lib/laptop-context.ts` | Sitzung aus dem Cookie → Einheit → Schüler |
| `app/laptop-actions.ts` | Code eingeben, Antworten und Hilfen am Laptop; Lehrer: Code, Bestätigen, Ablehnen, Zugang beenden |
| `app/mitmachen/*` | Seite, Live-Kanal, Ansicht wechseln, Fortschritt, Text speichern, Abmelden |
| `components/laptop/*` | Code-Eingabe, Live-Verbindung, Abmelden, Aufräumen |
| `components/device/LaptopAccess.tsx` | „Eigenes Gerät verbinden“ im Live-Status |

## Grenzen

- Ein Laptop pro Einheit. Ein neu bestätigtes Gerät löst das alte ab.
- Kein Whiteboard am Laptop; das bleibt am Lehrer-Tablet.
- Keine KI-Textkorrektur, keine Bildgeschichten, keine neuen Aufgabenformate.
- Keine dauerhaften Schülerkonten und kein gemeinsames Schreiben.

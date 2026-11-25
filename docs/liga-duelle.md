# Liga und Duelle (Schüler-App)

niko 2026-11-11: „was hältst du von einem Ranking, damit die Schüler gegeneinander spielen können?“ Gebaut auf den
Lernspielen (docs/lernspiele.md), alle drei Konzepte: Wochenliga, Duell per Code, Live-Duell im Unterricht.

## Grundsätze

- **Einsatz statt Können**: Ligapunkte gibt es für fertige Runden und fürs Besserwerden gegen sich selbst. So können
  auch schwächere Schüler vorne stehen.
- **Mit dem echten Namen** (niko 2026-11-25: „ich will nicht mehr anonyme Usernames, es soll der Schülername angezeigt
  werden“): andere sehen Vorname und ersten Buchstaben des Nachnamens („Max M.“, `spielName` in lib/spielprofil.ts)
  und ein Tierbild, das der Schüler wählt. Schule und Klasse stehen nirgends. Bis dahin gab es Spitznamen aus zwei
  Listen („Blitzfuchs“); die Spalte `spielprofile.name` ist nur noch ein innerer Schlüssel. Liga und Duelle lassen sich
  einzeln ausschalten.
- **Für alle erlaubt** (niko 2026-11-16: „mach die erlaubnis weg es soll generell erlaubt sein“; vorher „ab der 9.
  Schulstufe, jünger nur mit Erlaubnis der Eltern“). Der Lehrer kann es im Profil › Fortschritt › „Liga und Duelle“ für
  einen Schüler ausschalten („Aus“). „Spielprofil zurücksetzen“ setzt Bild und Schalter zurück. Wer Blockwerk-Punkte hat und
  noch kein Profil, bekommt eines (`sorgeFuerProfil`), damit alle in der Bestenliste stehen.

## Was der Schüler sieht

- **Tab „Spiele“ › Gegeneinander** (niko 2026-11-11: „Ranking muss jetzt nicht sein, aber diese Duelle“): eine Zeile
  „Duelle“ mit dem, was wartet, darunter klein die Wochenliga mit Platz und Punkten. Wartet ein Duell, hat der Tab
  einen roten Punkt und auf dem Start steht die Zeile „Duelle“ ebenfalls.
  Startet der Lehrer ein Live-Duell, erscheint auf dem Start oben von selbst „Live-Duell · Ein Duell wartet auf dich“.
- **`/lernen/[token]/arena`** (über der Seite wie die Spiele): ohne Profil „Mitspielen?“, sonst zuerst die Duelle
  (Code eingeben, „Neues Duell · Code holen“, eigene Duelle), darunter die Wochenliga. Der Name oben öffnet die
  Einstellungen, das Kreuz führt zurück zum Tab „Spiele“.
- **`/lernen/[token]/duell/[id]`**: Gegenüber, Spiel (dieselbe Mechanik wie die Lernspiele), Ergebnis mit
  „Beide falsch: das lernt ihr gerade“ und Revanche.

## Wochenliga (lib/liga.ts)

| Regel | Wert |
| --- | --- |
| Punkte je fertige Runde | 20 |
| Besserwerden | +1 je Prozentpunkt über dem eigenen Schnitt der letzten 10 Runden desselben Spiels, höchstens +30; erste Runde eines Spiels +10 |
| zählt nicht | unter 25 Sekunden, unter 3 richtigen, ab der 11. Runde am Tag |
| Gruppen | bis 8 Spieler je Stufe (Bronze, Silber, Gold, Diamant) |
| Woche | Montag bis Sonntag, Wiener Zeit |
| Aufstieg | die ersten 3 einer Gruppe mit Punkten; Absteigen gibt es nicht |

Punkte stehen an der Runde (`spielrunden.punkte`), die Gruppe in `spielliga`. Wer neu in eine Woche kommt, landet in
der ersten Gruppe seiner Stufe mit freiem Platz. Es gibt keinen Zeitplaner: Wochenwechsel und Aufstieg rechnet die App,
sobald der Schüler wieder spielt oder die Liga öffnet.

## Duelle (lib/duelle.ts)

- **Per Code**: Code mit 4 Zeichen (ohne 0/O und 1/I), gilt 48 Stunden. Wer annimmt, startet die 24 Stunden für beide.
  Die Karten kommen aus den Stufen für den jüngeren Spieler, ohne die eigenen Fehler-Wiederholungen. Gewonnen hat, wer
  mehr beim ersten Versuch richtig hat, bei Gleichstand der Schnellere. Wer nicht spielt, verliert kampflos.
- **Live im Unterricht**: hat der Lehrer zwei Einheiten gleichzeitig laufen, steht in der Einheit neben den beiden Namen
  „Live-Duell“. Spiel wählen, „Duell starten“, beide tippen „Bereit“, 3 Sekunden Countdown, 2 Minuten. Bei Gleichstand
  gewinnt, wer mehr Karten geschafft hat. Live braucht kein Spielprofil (die beiden sitzen nebeneinander); dort steht
  der Name wie überall („Max M.“), beim Lehrer der Vorname. Der Lehrer sieht den Stand alle 2 Sekunden und kann abbrechen.
- Jede erste Wahl speichert der Server sofort (`spielduelle.zuege_*`), ein Neuladen ändert nichts. Jede Duell-Runde ist
  auch eine normale Runde (Lernstand, Serie, Ligapunkte).

Tests: lib/duelle.test.ts.

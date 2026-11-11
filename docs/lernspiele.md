# Lernspiele (Schüler-App)

niko 2026-11-11: Lernspiele ja, aber hochwertig und so, dass sie **beim aktuellen Stoff helfen**. Begonnen wird mit
Deutsch, weil Artikel, Präpositionen und Deklination oft ein Problem sind.

## Was der Schüler sieht

- **Start** (`/lernen/[token]`): eine Karte „Lernspiel“ mit dem Spiel, das gerade passt, dem Grund
  („2. Deutsch-Schularbeit in 9 Tagen“, „Dein aktueller Stoff“) und der Serie (Tage am Stück).
- **Spiel** (`/lernen/[token]/spiel?art=…`): liegt über der ganzen Seite. Anfang mit Stand und Serie, Wahl eines
  anderen Spiels, „Los geht’s“. Dann zwölf Karten: in ein Fach ziehen und werfen oder ein Fach antippen
  (am Laptop Tasten 1–5).
  - richtig: die Karte fliegt ins Fach, oben steht kurz der ganze richtige Satz mit der Antwort hervorgehoben
    (bei Präpositionen auch Dativ oder Akkusativ);
  - falsch: die Wahl steht durchgestrichen in der Lücke, das richtige Fach leuchtet, eine kurze Regel erscheint,
    weiter geht es mit der richtigen Antwort; die Karte kommt drei Karten später noch einmal.
- **Ende**: Sterne (ab 90 % drei, ab 70 % zwei), „x von 12 beim ersten Mal richtig“, der Lernstand der Fähigkeit
  vorher und nachher, die Serie und was nächstes Mal wiederkommt.

## Die drei Spiele

| Spiel | Fähigkeit | Bank | Fächer |
| --- | --- | --- | --- |
| der, die, das | `deutsch.grammatik.artikel` | `artikel.json` (ohne Wörter mit zwei Artikeln) | der · die · das (blau, rot, grün) |
| Präposition und Fall | `deutsch.grammatik.praepositionen` | `praepositionen.json` (nur mit sicherem Fall) | der · die · das · dem · den (die vier des Eintrags) |
| Adjektiv-Endungen | `deutsch.grammatik.adjektivdeklination` | `adjektivdeklination.json` | -e · -en · -er · -es · -em (die vier des Eintrags) |

Die Fächer stehen immer in derselben Reihenfolge, damit die Hand sich die Plätze merkt. Einträge, die die Regeln
der Bank beanstanden (`eintragFehler`), kommen nicht vor.

**Regeln nach einem Fehler** (`lib/lernspiele-karten.ts`) sagen nur, was für die Karte sicher stimmt: das Grundwort
eines zusammengesetzten Nomens (die Tür → die Haustür), Endungen wie -ung, -heit, -chen nur, wenn der Artikel dazu
passt, „mit verlangt immer den Dativ“, Wo?/Wohin? bei Wechselpräpositionen, „nach dem endet das Adjektiv immer
auf -en“. Sonst steht die richtige Lösung da.

## Welches Spiel dran ist

`spielVorschlaege` (lib/lernspiele.ts), das wichtigste zuerst:

1. eine geplante Prüfung in den nächsten 21 Tagen mit passender Fähigkeit (Die vier Fälle → Präposition und Fall),
2. der aktuelle Stoff im Profil,
3. die letzte Einheit der letzten 14 Tage,
4. eine Spiel-Fähigkeit mit Lernstand unter 60 %,
5. sonst, wenn der Schüler Deutsch hat, die übrigen Spiele „zum Üben“.

Ohne Deutsch und ohne passenden Stoff gibt es kein Spiel.

## Welche Karten

`waehleKarten`: zuerst bis zu vier Karten, die in den letzten fünf Runden falsch waren und seither nicht richtig,
dann neue aus den Stufen nach Schulstufe und Lernstand (`stufenFuer`: unsicher → leichter, sicher → schwerer),
ohne die Karten der letzten zwei Runden. Keine Antwort steht öfter als bei der Hälfte der Karten (sonst gewinnt bei
den Endungen „-en“ fast immer).

## Was gezählt wird

- Gespeichert wird eine Runde in `spielrunden` mit den Karten beim Start. Am Ende schickt das Spiel nur die erste
  Wahl je Karte; der Server prüft sie an den gespeicherten Karten. Eine Runde lässt sich nur einmal beenden.
- Eine beendete Runde ist **ein** Beleg für den Lernstand: Wert = Anteil beim ersten Mal richtig, Gewicht 1,5
  (wie eine dokumentierte Stunde, viel weniger als die Aufgaben einer Übung). Abgebrochene Runden zählen nicht und
  verschwinden nach einem Tag.
- Der Lehrer sieht im Profil unter **Lernstand** einen Abschnitt „Lernspiele“: Runden der letzten 30 Tage je Spiel
  und die Lösungen, die öfter falsch waren.

## Bewegung

Nach DESIGN.md „Bewegung“ (`components/lernen/lernspiel.css`): nur transform und opacity, Eintritt ease-out,
Fliegen über den Schirm ease-in-out (geworfen: ease-out, die Karte ist schon in Fahrt), Ziehen ohne Übergang mit
Reibung nach oben, ein schneller Wurf reicht auch über kurze Strecke, die Karten dahinter rücken nach. Kurze
Vibration am Handy (richtig kurz, falsch doppelt). Bei „weniger Bewegung“ nur Farbe und Deckkraft.

# Lernspiele (Schüler-App)

niko 2026-11-11: Lernspiele ja, aber hochwertig und so, dass sie **beim aktuellen Stoff helfen**. Begonnen wird mit
Deutsch, weil Artikel, Präpositionen und Deklination oft ein Problem sind.

## Was der Schüler sieht

- **Tab „Spiele“** (`/lernen/[token]/spiele`, niko 2026-11-11: „es sollte übersichtlicher sein, wo Spiele sind, und
  besser getrennt“): der dritte von fünf Tabs der Schüler-App. Oben „Für dich“ das Spiel, das gerade passt, mit Grund
  und Serie. Darunter alle Spiele als Kacheln nach Fach (Kärtchen mit Wörtern aus dem Spiel, eine kurze Zeile, der
  eigene Stand oder „Neu“, ein Schild wie „Schularbeit“ oder „Dein Stoff“, wenn das Spiel gerade passt). Am Ende
  „Gegeneinander“ mit den Duellen; die Wochenliga steht nur als kleine Zeile da (docs/liga-duelle.md). Wartet ein
  Duell, hat der Tab einen roten Punkt.
- **Start** (`/lernen/[token]`): nur eine Karte „Lernspiel“ mit dem Spiel, das gerade passt, dem Grund
  („2. Deutsch-Schularbeit in 9 Tagen“, „Dein aktueller Stoff“) und der Serie (Tage am Stück); dazu „Duelle“, solange
  ein Duell auf den Schüler wartet.
- **Spiel** (`/lernen/[token]/spiel?art=…`): liegt über der ganzen Seite, auf der blauen Bühne. Anfang mit Stand
  und Serie und „Los geht’s“; das Kreuz führt zurück zum Tab „Spiele“ (vom Start aus zurück zum Start). Dann zwölf Karten: in eine Kiste ziehen und werfen oder eine
  Kiste antippen (am Laptop Tasten 1–5).
  - richtig: die Karte fliegt in die Kiste, die Kiste leuchtet, Funken und „+1“, das Wort schaut danach oben aus
    der Kiste; oben steht kurz der ganze richtige Satz mit der Antwort hervorgehoben (bei Präpositionen auch Dativ
    oder Akkusativ). Der Zähler oben rechts zählt richtige Antworten in Folge und wird ab drei gold, bei 3, 5, 10,
    15 … erscheint kurz „3 in Folge!“;
  - falsch: die Karte wackelt und rückt hoch, die Wahl steht durchgestrichen darauf, von unten kommt ein Blatt
    „Fast! Richtig ist …“ mit einer kurzen Regel, die richtige Kiste hat einen weißen Rand; weiter geht es mit der
    richtigen Antwort, die Karte kommt drei Karten später noch einmal.
  - Fortschritt oben: ein Strich je Karte, gold = beim ersten Mal richtig, rot = erst danach.
- **Ende**: Ring „x von 12 richtig“ (gezählt wird der erste Versuch), Sterne (ab 90 % drei, ab 70 % zwei), ab zwei
  Sternen einmal Konfetti, die längste Serie der Runde, der Lernstand der Fähigkeit vorher und nachher, die
  Tages-Serie und was nächstes Mal wiederkommt.

**Aussehen** (niko 2026-11-11: „sehen etwas fad aus“): Das Spiel ist die einzige Seite, die ganz Bühne ist
(Blau-Verlauf mit Lichtfleck, hell und dunkel), mit weißer Schrift, weißem Hauptknopf und kräftig farbigen Kisten
(blau, rot, grün, gold, violett; der, die, das und die Endungen haben immer dieselbe Farbe, sonst geht es nach dem
Platz in der Reihe). Lange Aufschriften („Nominativ“, „schwammen“) werden kleiner, in einer Reihe alle gleich.
Ein markierter Satzteil ist gelb angestrichen. Auf dem Anfang steht „Los geht’s“ fest unten, der Rest rollt. Karten, Regel-Blatt und die Liste am Ende sind
weiße Blätter. Bei „weniger Bewegung“ entfallen Funken, Konfetti, „in Folge!“ und das Wackeln. Am Regelwerk und an
der Wertung hat der neue Look nichts geändert.

## Die acht Spiele

niko 2026-11-11: „mach alle deutsch spiele zuerst“. Alle Spiele haben dieselbe Mechanik (eine Karte, zwei bis fünf
Kisten); neu ist nur, was auf der Karte steht und wie die Kisten heißen.

| Spiel | Fähigkeit | Quelle | Karte | Kisten |
| --- | --- | --- | --- | --- |
| der, die, das | `deutsch.grammatik.artikel` | `artikel.json` (ohne Wörter mit zwei Artikeln) | ein Nomen | der · die · das |
| Präposition und Fall | `deutsch.grammatik.praepositionen` | `praepositionen.json` (nur mit sicherem Fall) | Satz mit Lücke | der · die · das · dem · den (die vier des Eintrags) |
| Adjektiv-Endungen | `deutsch.grammatik.adjektivdeklination` | `adjektivdeklination.json` | Satz, die Endung fehlt | -e · -en · -er · -es · -em (die vier des Eintrags) |
| Die vier Fälle | `deutsch.grammatik.faelle` | Satzlehre-Generator „Fälle bestimmen“ (`wahlFuerSpiel`, fester Zufall, rund 790 Sätze) | Satz, ein Teil ist markiert | Nominativ · Genitiv · Dativ · Akkusativ, darunter die Frage (Wer? Wessen? Wem? Wen?) |
| das oder dass | `deutsch.recht.dasdass` | `das-dass.json`; je Lücke eine Karte, die anderen Lücken sind gefüllt | Satz mit Lücke | das · dass |
| Hauptsatz oder Gliedsatz | `deutsch.satz.hauptsatz-gliedsatz` | `hauptsatz-gliedsatz.json`; je Satz zwei Karten | ganzer Satz, ein Teilsatz ist markiert | Hauptsatz · Gliedsatz |
| Perfekt: haben oder sein | `deutsch.grammatik.perfekt` | `perfekt.json` | Satz mit Partizip, das Hilfsverb fehlt, Grundform in Klammern | haben · sein |
| Präteritum | `deutsch.grammatik.praeteritum` | `praeteritum.json` (Einträge mit mindestens zwei falschen Formen) | Satz mit Lücke, Grundform in Klammern | die richtige Form und zwei typische falsche („ging · gehte · geht“) |

Die Kisten stehen immer in derselben Reihenfolge, damit die Hand sich die Plätze merkt (beim Präteritum heißen sie
je Karte anders, stehen für dieselbe Karte aber immer gleich). Einträge, die die Regeln der Bank beanstanden
(`eintragFehler`), kommen nicht vor.

Worauf die neuen Spiele achten:

- **Nur eindeutige Karten.** Perfekt: keine Verben, die in Österreich mit „sein“ und in Deutschland mit „haben“
  stehen (sitzen, liegen, stehen, schwimmen …, `SEIN_ODER_HABEN`). Präteritum: eine falsche Form, die im Satz doch
  stimmen könnte („wurde krank“ statt „war krank“, „schloß“), ist keine Kiste. Fälle: nur Sätze, in denen der
  gefragte Teil genau einmal vorkommt.
- **Beide Kisten etwa gleich oft.** Bei zwei Kisten höchstens sieben von zwölf Karten für eine Antwort. Die
  Perfekt-Bank hat dafür 43 Sätze mit „sein“ dazubekommen (108 statt 65, 60 mit „sein“).
- **Nie zwei Karten aus demselben Satz** in einer Runde (die zwei Teilsätze, die zwei Lücken bei das/dass).
- **Was in der Lücke steht**, ist die Form des Satzes („bin“, „Das“), die Kiste heißt „sein“ oder „das“. Bei
  einem Fehler steht die falsche Wahl in der passenden Form da („Ich ~~bin~~ … gegeben“).
- **Schulstufe**: zum Weiterüben gibt es Artikel ab der 1., Präpositionen ab der 3., Perfekt und Präteritum ab der
  4., alles andere ab der 5. Schulstufe (`SPIEL_AB`). Steht ein Thema im Stoff, kommt das Spiel auch früher.

Noch kein Spiel: **Satzbau** (Wörter in die richtige Reihenfolge bringen). Das braucht eine andere Mechanik als
Kisten und wäre ein eigener Schritt; ebenso Wortarten und Zeitformen erkennen (ginge mit Kisten, Karten fehlen noch).

**Regeln nach einem Fehler** (`lib/lernspiele-karten.ts`) sagen nur, was für die Karte sicher stimmt: das Grundwort
eines zusammengesetzten Nomens (die Tür → die Haustür), Endungen wie -ung, -heit, -chen nur, wenn der Artikel dazu
passt, „mit verlangt immer den Dativ“, Wo?/Wohin? bei Wechselpräpositionen, „nach dem endet das Adjektiv immer
auf -en“. Sonst steht die richtige Lösung da. Bei den Fällen ist es die Frageprobe des Generators („Wem? Der Oma:
Dativ (3. Fall).“), bei das/dass die Ersatzprobe mit „dieses“ oder „welches“, beim Gliedsatz das Einleitewort
(„beginnt mit weil und kann nicht allein stehen“), beim Perfekt „gehen bildet das Perfekt mit sein: bin … gegangen“.

## Welches Spiel dran ist

`spielVorschlaege` (lib/lernspiele.ts), das wichtigste zuerst:

1. eine geplante Prüfung in den nächsten 21 Tagen mit passender Fähigkeit (`FUEHRT_ZU`: Die vier Fälle → „Die vier
   Fälle“ und „Präposition und Fall“, Zeiten → Perfekt und Präteritum, Satzreihe und Satzgefüge → Hauptsatz oder
   Gliedsatz; Unterfähigkeiten zählen mit),
2. der aktuelle Stoff im Profil,
3. die letzte Einheit der letzten 14 Tage,
4. eine Spiel-Fähigkeit mit Lernstand unter 60 %,
5. sonst, wenn der Schüler Deutsch hat, die übrigen Spiele „zum Üben“.

Ohne Deutsch und ohne passenden Stoff gibt es kein Spiel.

## Welche Karten

`waehleKarten`: zuerst bis zu vier Karten, die in den letzten fünf Runden falsch waren und seither nicht richtig,
dann neue aus den Stufen nach Schulstufe und Lernstand (`stufenFuer`: unsicher → leichter, sicher → schwerer),
ohne die Karten der letzten zwei Runden. Keine Antwort steht öfter als bei der Hälfte der Karten (sonst gewinnt bei
den Endungen „-en“ fast immer); bei zwei Kisten sind es bis zu sieben von zwölf, damit es nicht immer genau sechs
und sechs sind.

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

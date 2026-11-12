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
  und Serie und „Los geht’s“; das Kreuz führt zurück zum Tab „Spiele“ (vom Start aus zurück zum Start). Bei den Kisten-Spielen dann zwölf Karten (Satzbau, Vokabel-Paare und Zahlenstrahl haben ein eigenes Spielfeld, und nicht jedes Spiel wird mit Kisten beantwortet, siehe „Wie geantwortet wird“): in eine Kiste ziehen und werfen oder eine
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

## Die acht Kisten-Spiele

niko 2026-11-11: „mach alle deutsch spiele zuerst“. Diese acht Spiele haben dieselbe Mechanik (eine Karte, zwei bis fünf
Kisten); neu ist nur, was auf der Karte steht und wie die Kisten heißen. Seit 2026-11-12 wird „Präteritum“ nicht mehr
mit Kisten beantwortet: die Form wird aus Buchstaben gelegt (siehe „Wie geantwortet wird“).

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

## Satzbau (Deutsch)

niko 2026-11-11: „mach mal alle Spiele, außer Mathe … und die ganzen Deutschsachen“. Das neunte Deutsch-Spiel übt,
**wo das Verb steht**, mit eigener Mechanik (`form: "reihe"`, `components/lernen/SatzbauFeld.tsx`).

- **Spielfeld**: oben ein Blatt mit dem Satz. Der Anfang steht schon da („Heute“, „Ich bleibe zu Hause, weil“), die
  übrigen drei oder vier Teile liegen unten gemischt. Ein Teil antippen setzt es an die nächste freie Stelle, ein
  gesetztes Teil antippen holt es zurück (am Laptop auch die Rücktaste). Über dem Satz steht die Satzart („Perfekt“,
  „Gliedsatz“, „Frage“).
- **Prüfen**: sobald das letzte Teil liegt. Richtig: das Blatt leuchtet, die nächste Karte kommt. Falsch: ab der ersten
  falschen Stelle werden die Teile rot und wandern zurück, in der Mitte erscheinen der richtige Satz und die Regel;
  weiter geht es, wenn der Satz richtig gebaut ist. Die Karte kommt drei Karten später noch einmal.
- **Gezählt** wird der erste geprüfte Satz je Karte. Fähigkeit: `deutsch.satz.satzglieder` (Volksschule:
  `deutsch.vs.sprache.satzglieder`).
- **Sätze**: 172 eigene Alltagssätze in `lib/satzbau-saetze.ts`, von Hand geschrieben, in drei Stufen:

  | Stufe | Was | Beispiel |
  | --- | --- | --- |
  | 1 | Subjekt vorne mit Satzklammer (trennbares Verb, Perfekt, Modalverb); etwas anderes vorne, Verb an zweiter Stelle | Ich · stehe · um sieben Uhr · auf. / Heute · gehen · wir · ins Kino. |
  | 2 | etwas anderes vorne und Satzklammer, Futur, Gliedsatz (Verb am Ende), W-Frage | Gestern · hat · er · seine Hausübung · vergessen. / …, weil · ich · krank · bin. |
  | 3 | Gliedsatz mit zweiteiligem Prädikat, Gliedsatz vorne | …, weil · er · den Bus · verpasst · hat. / Weil es regnet, · bleiben · wir · zu Hause. |

  Volksschule spielt Stufe 1 (sicher: 1 und 2), ab der 5. Schulstufe 1 bis 3 (unsicher 1 und 2, sicher 2 und 3).
- **Genau eine richtige Reihenfolge.** Deutsch lässt vieles zu, darum sind die Sätze so gebaut, dass nach dem festen
  Anfang nur eine Reihenfolge stimmt: höchstens ein freies Satzglied neben Subjekt und Verb; wo zwei Nomen die Plätze
  tauschen könnten, ist das Subjekt ein Pronomen; keine Ja/Nein-Fragen (sie gingen auch als Aussage mit
  Fragezeichen) und keine Sätze, in denen Zeit und Ort tauschen könnten. Wer Sätze ergänzt, hält sich daran
  (Kopf von `lib/satzbau-saetze.ts`); `lib/satzbau.test.ts` prüft die Form, nicht die Grammatik.
- Die Teile einer Karte liegen immer gleich da (fester Zufall), nie schon in der richtigen Reihenfolge.

## Vokabel-Paare (Englisch)

niko 2026-11-11: „mach mal alle Spiele, außer Mathe: das Englischspiel, das Vokabelspiel“. Das Englisch-Spiel hat eine
eigene Mechanik (`form: "paar"`, `components/lernen/PaarFeld.tsx`); Anfang, Ende, Zählen, Lernstand, Liga und Duelle
sind dieselben wie bei den Kisten-Spielen.

- **Spielfeld**: links englische Wörter, rechts die deutschen in anderer Reihenfolge. Ein Wort antippen, dann das
  passende auf der anderen Seite (welche Seite zuerst, ist egal; noch einmal antippen nimmt die Wahl zurück).
  Richtig: beide Kärtchen leuchten grün und verschwinden, oben steht das Paar („bridge = die Brücke“). Falsch: beide
  wackeln rot und bleiben stehen; die Lösung wird nicht verraten, das Wort bleibt am Brett.
- **Runde**: bis zu zwölf Wortpaare auf Brettern mit höchstens sechs Paaren (12 → 6 + 6, 8 → 4 + 4). Waren Wörter
  zuerst falsch, kommt zum Schluss ein Brett „Noch einmal: diese Wörter waren schwer“ mit ihnen, aufgefüllt auf vier
  Paare. Dieses Brett übt nur, es zählt nicht mehr.
- **Gezählt** wird der erste Versuch je englischem Wort (`erste Wahl` = das deutsche Wort, das dazu getippt wurde).
- **Welche Wörter** (`vokabelPlan`, lib/lernspiele.ts):
  1. Hat der Schüler **eigene Vokabellisten** mit zusammen mindestens vier spielbaren Wörtern, spielt er sie (auch
     die vom Foto eingelesenen). Bei mehreren Listen kommen bis zu zwei Drittel der Runde aus der neuesten. Fähigkeit
     der Runde: `englisch.vocab.eigene`.
  2. Sonst eine **Themenliste** (lib/vokabeln-themen.ts): ein Vokabelthema aus seinem Stoff (Prüfung, aktueller
     Stoff, letzte Einheit), sonst das erste Thema seiner Schulart, das er noch nicht geschafft hat. Geschafft heißt:
     zwei Runden mit mindestens 80 %. Sind alle geschafft, kommt das Thema, das am längsten her ist. Die Fähigkeit der
     Runde ist das Thema (`englisch.vocab.freizeit`); die Stufen der Wörter gehen nach Schulstufe und Lernstand
     (`vokabelStufen`).
  3. Im **Duell** bekommen beide dieselbe Themenliste für die jüngere Schulstufe (`duellVokabeln`).
- **Nie zwei Wörter, die zueinander passen**: Wörter mit einer gemeinsamen englischen oder deutschen Form („big“ und
  „large“ = „groß“, „mum“ und „mother“) kommen nicht in dieselbe Runde, sonst gäbe es zwei richtige Paare. Wendungen
  mit mehr als 32 Zeichen bleiben für die Übungen.
- **Wann es angeboten wird**: mit einer eigenen Liste immer („Dein Stoff“), mit einem Vokabelthema im Stoff, sonst
  „zum Üben“, wenn der Schüler Englisch hat (ab der 3. Schulstufe). Auf dem Anfang und auf der Kachel steht, woher die
  Wörter kommen („Deine Liste „Unit 3““, „Thema: Familie“).
- Der Karteikasten des Vokabeltrainers (docs/vokabeln.md) bleibt davon unberührt: das Spiel verschiebt keine
  Wörter zwischen den Fächern.

## Englisch mit Kisten: Irregular Verbs, English Tenses, English Grammar

niko 2026-11-11: „Vielleicht noch die Irregular Verbs. Zeiten in Englisch können wir auch noch reinhauen.“ Die drei
Spiele haben die Kisten-Mechanik; neu sind die Karten (`lib/lernspiele-englisch.ts`). Seit 2026-11-12 wird bei
„Irregular Verbs“ die Form aus Buchstaben gelegt (siehe „Wie geantwortet wird“).

- **Karten**: Sätze mit einer Lücke aus den Englisch-Generatoren (`englischWahlFuerSpiel` in
  lib/englisch-grammatik.ts), dieselben wie in den Übungen, ohne KI. Unter dem Satz steht das Verb in Klammern
  („(go)“). Die Kisten sind die richtige Form und zwei typische falsche: die erste falsche ist immer der häufigste
  Fehler (die andere Zeit, die regelmäßig gebildete Form „goed“), die zweite wechselt. Hat ein Satz zwei Lücken, ist
  eine schon gefüllt. Lange Aufschriften („is going to visit“) stehen in zwei Zeilen.
- **Regel nach einem Fehler**: die des Generators („Der Satz sagt, wann es war: past simple, went (go, went, gone).“).
  Bei den Zeiten steht nach der richtigen Antwort die Zeit als Schild auf der Karte („Past Simple“), wenn die Regel
  genau eine nennt.
- **Irregular Verbs**: Past Simple und Present Perfect mit unregelmäßigen Verben (Fähigkeit
  `englisch.vocab.irregular`), zum Üben ab der 6. Schulstufe.
- **English Tenses** und **English Grammar** sind **Themenspiele**: jede Runde hat ein Thema, also eine Fähigkeit
  (13 Zeiten von „Present Simple“ bis „Present Perfect Progressive“, 25 Grammatik-Themen von „am, is, are“ bis
  „Reported Speech“; Listen `ZEITEN_THEMEN` und `GRAMMATIK_THEMEN` mit Namen und Schulstufe; was für alle
  Themenspiele gilt, steht in lib/lernspiele-themen.ts). Welches Thema (`themenPlan`, lib/lernspiele.ts):
  1. ein Thema aus dem **Stoff** des Schülers (Prüfung, aktueller Stoff, letzte Einheit; Unterfähigkeiten zählen mit),
  2. sonst das erste Thema, das für seine Schulstufe schon dran war und das er noch nicht geschafft hat (zwei Runden
     mit mindestens 80 %), das Neueste zuerst: die 4. Klasse beginnt mit „Past Perfect“, nicht mit „am, is, are“.
  Die Runde hängt an der Fähigkeit des Themas, so landet sie im richtigen Lernstand. Auf dem Anfang und auf der Kachel
  steht das Thema („Thema: will oder going to“), die kleinen Kisten auf dem Anfang sind die einer Karte des Themas.
- **Vorlagen**: Sätze, die sich nur im Namen unterscheiden („Paul …“, „Lena …“), gibt es höchstens zweimal, und nie
  beide in einer Runde (`gruppe`).
- **Duell**: ein Thema, das der Jüngere schon hatte, für beide dieselben Karten (`duellThema`).
- Ein neues Thema: eine Zeile in `ZEITEN_THEMEN` oder `GRAMMATIK_THEMEN` mit einer Fähigkeit, die einen Generator
  hat; `lib/lernspiele-englisch.test.ts` verlangt mindestens 15 Karten je Thema.

## Mathe: Kopfrechnen

niko 2026-11-11: „Dann vielleicht für Mathe … Was Spaß machen könnte.“ Das erste Mathe-Spiel hat die Kisten-Mechanik
(`lib/lernspiele-mathe.ts`): auf der Karte steht eine Rechnung („3/4 + 1/6 =“), die Kisten sind Ergebnisse. Seit
2026-11-12 wird das Ergebnis an einem Ziffernblock eingetippt, wo es eine Zahl ist (siehe „Wie geantwortet wird“).

- **Themenspiel** wie English Tenses: jede Runde hat ein Thema, also eine Fähigkeit. 38 Themen in `RECHNEN_THEMEN`,
  von „Plus und Minus bis 10“ (1. Klasse Volksschule) über Einmaleins, Dezimalzahlen, Maße, Teilbarkeit, Brüche,
  negative Zahlen, Terme, Gleichungen und Prozent bis zu Potenzen, binomischen Formeln und Wurzeln (4. Klasse
  Gymnasium). Das Thema kommt aus dem Stoff, sonst ist es das nächste der Schulstufe (`themenPlan`). Themen haben
  auch ein Ende (`bis`): in der 3. Klasse Gymnasium kommt kein „Plus und Minus bis 20“ mehr.
- **Karten ab der 5. Schulstufe**: aus den Mathe-Generatoren der Übungen (`MATHE_RECHNUNGEN`, `MATHE_GRUNDLAGEN`),
  ohne KI. `form` macht aus der Angabe die Rechnung mit Lücke („Berechne 3/4 + 1/6.“ wird „3/4 + 1/6 =“, eine
  Gleichung steht über „x =“). Die Kisten sind das richtige Ergebnis und zwei **typische Fehler** des Generators
  (Zähler und Nenner einzeln addiert, Vorzeichen vergessen, Komma falsch gesetzt). Nur wenn ein Generator weniger als
  zwei Fehler liefert, kommt ein Nachbar dazu (`ersatz`). Aufgaben, die als Rechnung zu lang wären oder kein
  eindeutiges kurzes Ergebnis haben, bleiben für die Übungen.
- **Karten der Volksschule**: eigene kleine Generatoren (Plus und Minus bis 10, 20, 100, 1000, Einmaleins, Geteilt,
  Mal mit Zehnern), die falschen Kisten sind auch hier die üblichen Fehler (Zehner vergessen, Nachbarreihe im
  Einmaleins, eine Null zu viel oder zu wenig), sonst Ergebnisse knapp daneben.
- **Regel nach einem Fehler**: der Lösungsweg in höchstens fünf Zeilen („Hauptnenner 12: 9/12 + 2/12 = 11/12“).
- **Schrift**: Karten, Kisten und Regel werden wie in den Übungen gesetzt (`MathText`: Bruchstrich, Hochzahlen,
  Wurzeln). Negative Zahlen stehen mit echtem Minus („−5“). Einheiten stehen auf der Kiste in einer zweiten Zeile.
- **Wann es angeboten wird**: mit einem Thema im Stoff („Schularbeit“, „Dein Stoff“), sonst „zum Üben“, wenn der
  Schüler Mathematik hat (ab der 1. Schulstufe). Im Duell spielen beide ein Thema, das der Jüngere schon hatte.
- **Volksschule und Lernstand**: sechs Volksschul-Themen hängen an Fähigkeiten aus dem Lehrplan-Paket „Volksschule“
  (Mehr › Lehrplan). Ist das Paket nicht eingespielt, lässt sich das Spiel spielen, im Lernstand steht aber nichts.
- Ein neues Thema: eine Zeile in `RECHNEN_THEMEN` (und in `QUELLEN`, wenn der Generator Besonderheiten hat);
  `lib/lernspiele-mathe.test.ts` verlangt mindestens 24 Karten je Thema und prüft die Volksschul-Rechnungen nach.

## Mathe: Zahlenstrahl

niko 2026-11-11: „überleg dir noch ein paar Spiele, mach ein paar Spiele rein.“ Das zweite Mathe-Spiel hat eine eigene
Mechanik (`form: "strahl"`, `components/lernen/StrahlFeld.tsx`, Karten aus `lib/lernspiele-strahl.ts`): oben steht
eine Zahl, darunter ein Zahlenstrahl, und der Schüler schiebt den Zeiger dorthin, wo die Zahl liegt.

- **Spielfeld**: ein Blatt mit „Wo liegt 3,7“ und dem Strahl. Die Zahlen stehen über den Teilstrichen, der Zeiger
  hängt darunter, damit der Finger nichts verdeckt. Irgendwo auf den Strahl tippen oder ziehen setzt den Zeiger auf den
  nächsten Teilstrich (am Laptop die Pfeiltasten), „Prüfen“ zählt (Eingabetaste). Welche Zahl unter dem Zeiger liegt,
  steht vorher nirgends: das abzulesen ist die Aufgabe.
- **Richtig**: der Zeiger wird grün, über dem Teilstrich erscheint die Zahl als Fähnchen, die nächste Karte kommt.
  **Falsch**: der Zeiger wird rot, die richtige Stelle bekommt das grüne Fähnchen, darunter steht, welche Zahl
  getroffen wurde („Fast! Das war 3,6. Um einen Teilstrich verzählt.“) und der Weg („Von 3,5 bis 4 sind es 5
  Teilstücke, ein Teilstück ist also 0,1 …“). Weiter geht es, wenn der Zeiger an der richtigen Stelle sitzt; die Karte
  kommt drei Karten später noch einmal.
- **Gezählt** wird das erste Prüfen je Karte. Die Wahl ist die Nummer des Teilstrichs (`richtig` der Karte), der
  Server prüft sie wie bei jedem Spiel.
- **Themenspiel**: acht Themen in `STRAHL_THEMEN`, jedes eine Fähigkeit: Zahlen am Zahlenstrahl (Volksschule), große
  Zahlen, Dezimalzahlen, Brüche, Brüche erweitern, gemischte Zahlen, negative Zahlen, negative Brüche und
  Dezimalzahlen. Das Thema kommt aus dem Stoff, sonst ist es das nächste der Schulstufe (`themenPlan`).
- **Zahlenstrahlen**: dieselben wie in den Aufgaben mit Bild (`strahlFuerSpiel` in lib/generators-figur.ts), ohne KI.
  Dort liest man eine markierte Zahl ab, hier ist es umgekehrt. Gefragt wird nur nach Teilstrichen ohne Zahl. Bei
  „Brüche“ steht der Bruch so da, wie man ihn abzählt (4/6), bei „Brüche erweitern“ gekürzt (2/3 auf einem Strahl mit
  Zwölfteln). Bei den negativen Zahlen wird vor allem nach negativen gefragt.
- **Stufen** 0 bis 3 sind die des Strahls (feinere Einteilung, weniger Zahlen am Strahl). In der Volksschule sind es
  die Zahlenräume: 1. Klasse bis 20, 2. Klasse bis 100, 3. Klasse dazu Zehnerschritte, 4. Klasse Hunderter und
  Fünferschritte (`stufenFuer`).
- **Typische falsche Stellen** kommen aus denselben Generatoren (`tipps` der Karte): um einen Teilstrich verzählt,
  Vorzeichen verwechselt, in die falsche Richtung gezählt, von rechts statt von 0 aus gezählt, nur den Zähler abgezählt.
- In einer Runde wird nach keiner Zahl zweimal gefragt (`gruppe`).
- **Wann es angeboten wird**: mit einem Thema im Stoff, sonst „zum Üben“, wenn der Schüler Mathematik hat. Duelle
  spielen ein Thema, das der Jüngere schon hatte.

## Wie geantwortet wird

niko 2026-11-12: „Jedes Spiel hat die gleiche Lösungsart mit diesen 3 Kästchen unten, das ist zu langweilig, immer das
gleiche.“ Die Karten bleiben dieselben, aber die Art zu antworten hängt am Spiel (`lib/lernspiele-antwort.ts`,
`antwortForm`; `waehleKarten` schreibt sie als `form` auf jede Karte der Runde, auch im Duell):

| Antwort | Spiele | Spielfeld |
| --- | --- | --- |
| **Ziffernblock** (`tippen`) | Kopfrechnen, wo das Ergebnis eine Zahl ist | `ZiffernFeld.tsx` |
| **Buchstaben legen** (`legen`) | Irregular Verbs, Präteritum | `LegeFeld.tsx` |
| Paare, Reihe, Zahlenstrahl | Vokabel-Paare, Satzbau, Zahlenstrahl | siehe die Abschnitte oben |
| Kisten | alle anderen | `Lernspiel.tsx` |

- **Ziffernblock**: oben das Blatt mit der Rechnung und einem Feld, unten beim Daumen die Ziffern wie am Handy, rechts
  Löschen und ein goldener Haken zum Prüfen (am Laptop Ziffern, Rücktaste, Eingabetaste). Das Ergebnis wird selbst
  ausgerechnet und eingetippt, statt es unter drei Kisten wiederzuerkennen. Eine Einheit steht fest hinter dem Feld
  („= ___ dm“), lange Zahlen stehen beim Tippen in Dreiergruppen. Komma, Vorzeichen („+/−“) und Bruchstrich gibt es
  nur, wenn eine Karte der Runde sie braucht; die Null nimmt sonst ihren Platz. Zahlen zählen nach ihrem Wert („0,50“
  ist „0,5“), ein Bruch muss genau so dastehen („30/35“ ist beim Kürzen falsch).
  - Getippt wird (`tippbar`): alle Themen mit einer Zahl als Ergebnis, auch mit Einheit, dazu „Brüche kürzen“,
    „Brüche erweitern“ und „Wurzeln“ mit einfachen Brüchen.
  - Bei den Kisten bleiben: Brüche addieren, subtrahieren, multiplizieren, dividieren und „Bruch, Dezimalzahl, Prozent“
    (gemischte Zahlen, und ein ungekürztes Ergebnis wäre auch richtig), Terme, Potenzregeln, binomische Formeln und
    „Teilbar oder nicht?“. Bei „Dezimalzahlen“ und „ggT und kgV“ wird nur getippt, was höchstens drei Ziffern hat: für
    „5,59 · 1,2“ reicht ein Überschlag, dafür sind die drei Kisten da. In so einer Runde wechseln sich Ziffernblock
    und Kisten ab.
- **Buchstaben legen**: oben das Blatt mit dem Satz und der Lücke, unten die Buchstaben als Kacheln. Antippen setzt
  einen Buchstaben in die Lücke, die Rücktaste (oder ein Tipp auf das Wort) holt den letzten zurück, „Prüfen“ zählt
  (am Laptop tippen, Rücktaste, Eingabetaste). Wie lang das Wort ist, steht nirgends. Zu den Buchstaben der Antwort
  kommen zwei oder drei aus den falschen Formen der Karte (`legeKacheln`): bei „put“ liegen auch t, e, d da, damit
  sich „putted“ legen lässt. Die Reihenfolge der Kacheln ist je Karte fest.
- **Nach einem Fehler** bei beiden wie bei den Kisten: das Feld wird rot, darunter kommt das Blatt „Fast! Richtig
  ist …“ mit Rechenweg oder Regel, und weiter geht es erst, wenn das Richtige getippt oder gelegt ist (dann ohne
  „Prüfen“). Die Karte kommt drei Karten später noch einmal.
- **Wertung**: wie immer die erste Antwort gegen `karte.richtig`. Stimmt das Getippte oder Gelegte, meldet das
  Spielfeld genau `karte.richtig`, sonst das, was der Schüler geschrieben hat. Am Server ändert sich nichts.
- Der Anfang des Spiels zeigt statt der kleinen Kisten einen kleinen Ziffernblock oder vier Buchstaben-Kacheln
  (`spielAntwort` für Kopfrechnen: wie die meisten Karten des Themas beantwortet werden).

## Welches Spiel dran ist

`spielVorschlaege` (lib/lernspiele.ts), das wichtigste zuerst:

1. eine geplante Prüfung in den nächsten 21 Tagen mit passender Fähigkeit (`FUEHRT_ZU`: Die vier Fälle → „Die vier
   Fälle“ und „Präposition und Fall“, Zeiten → Perfekt und Präteritum, Satzreihe und Satzgefüge → Hauptsatz oder
   Gliedsatz und Satzbau, Satzglieder → Satzbau, jede englische Zeit → English Tenses, jedes englische Grammatik-Thema → English Grammar, jedes Thema von Kopfrechnen → Kopfrechnen, jedes Thema von Zahlenstrahl → Zahlenstrahl;
   Unterfähigkeiten zählen mit),
2. der aktuelle Stoff im Profil,
3. die letzte Einheit der letzten 14 Tage,
4. eine Spiel-Fähigkeit mit Lernstand unter 60 %,
5. sonst, wenn der Schüler Deutsch hat, die übrigen Deutsch-Spiele „zum Üben“, und mit Englisch die Vokabel-Paare
   (ab der 3. Schulstufe), English Tenses und English Grammar (ab der 5.) und die Irregular Verbs (ab der 6.), mit
   Mathematik „Kopfrechnen“ und „Zahlenstrahl“.

Eine eigene Vokabelliste zählt als aktueller Stoff (Punkt 2). Ohne passendes Fach und ohne passenden Stoff gibt es
kein Spiel.

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

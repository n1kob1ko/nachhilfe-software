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
- **Am Schüler-Tablet in der Einheit** (niko 2026-11-12): der Knopf „Spiele“ oben am Tablet zeigt dieselbe Liste; der
  Lehrer kann sie im Live-Status schicken (docs/schueler-tablet.md).
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
Kisten); neu ist nur, was auf der Karte steht und wie die Kisten heißen. Seit 2026-11-12 werden nur noch „der, die,
das“ und „Die vier Fälle“ mit Kisten beantwortet: bei „Präteritum“ wird die Form aus Buchstaben gelegt, „das oder
dass“, „Hauptsatz oder Gliedsatz“ und „Perfekt“ werden gewischt, „Präposition und Fall“ und „Adjektiv-Endungen“ haben
Antwortkacheln (siehe „Wie geantwortet wird“). Die Spalte „Kisten“ nennt die Antworten.

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
„Irregular Verbs“ die Form aus Buchstaben gelegt, „English Tenses“ und „English Grammar“ haben Antwortkacheln (siehe
„Wie geantwortet wird“); „Kisten“ heißt hier: die Antworten der Karte.

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
2026-11-12 wird das Ergebnis an einem Ziffernblock eingetippt, wo es eine Zahl ist, und „Teilbar oder nicht?“ wird
gewischt (siehe „Wie geantwortet wird“).

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
| **Wischen** (`wischen`) | das oder dass, Perfekt: haben oder sein, Hauptsatz oder Gliedsatz, bei Kopfrechnen „Teilbar oder nicht?“ (jede Karte mit genau zwei Antworten) | `WischFeld.tsx` |
| **Antwortkacheln** (`kacheln`) | Präposition und Fall, Adjektiv-Endungen, English Tenses, English Grammar, Wortschatz (ein Satz mit Lücke und drei bis sechs Antworten) | `KachelFeld.tsx` |
| Paare, Reihe, Zahlenstrahl | Vokabel-Paare, Satzbau, Zahlenstrahl | siehe die Abschnitte oben |
| Kisten | der, die, das; Die vier Fälle; bei Kopfrechnen, was sich nicht tippen lässt | `Lernspiel.tsx` |

- **Ziffernblock**: oben das Blatt mit der Rechnung und einem Feld, unten beim Daumen die Ziffern wie am Handy, rechts
  Löschen und ein goldener Haken zum Prüfen (am Laptop Ziffern, Rücktaste, Eingabetaste). Das Ergebnis wird selbst
  ausgerechnet und eingetippt, statt es unter drei Kisten wiederzuerkennen. Eine Einheit steht fest hinter dem Feld
  („= ___ dm“), lange Zahlen stehen beim Tippen in Dreiergruppen. Komma, Vorzeichen („+/−“) und Bruchstrich gibt es
  nur, wenn eine Karte der Runde sie braucht; die Null nimmt sonst ihren Platz. Zahlen zählen nach ihrem Wert („0,50“
  ist „0,5“), ein Bruch muss genau so dastehen („30/35“ ist beim Kürzen falsch).
  - Getippt wird (`tippbar`): alle Themen mit einer Zahl als Ergebnis, auch mit Einheit, dazu „Brüche kürzen“,
    „Brüche erweitern“ und „Wurzeln“ mit einfachen Brüchen.
  - Bei den Kisten bleiben: Brüche addieren, subtrahieren, multiplizieren, dividieren und „Bruch, Dezimalzahl, Prozent“
    (gemischte Zahlen, und ein ungekürztes Ergebnis wäre auch richtig), Terme, Potenzregeln und binomische Formeln
    („Teilbar oder nicht?“ wird gewischt). Bei „Dezimalzahlen“ und „ggT und kgV“ wird nur getippt, was höchstens drei Ziffern hat: für
    „5,59 · 1,2“ reicht ein Überschlag, dafür sind die drei Kisten da. In so einer Runde wechseln sich Ziffernblock
    und Kisten ab.
- **Buchstaben legen**: oben das Blatt mit dem Satz und der Lücke, unten die Buchstaben als Kacheln. Antippen setzt
  einen Buchstaben in die Lücke, die Rücktaste (oder ein Tipp auf das Wort) holt den letzten zurück, „Prüfen“ zählt
  (am Laptop tippen, Rücktaste, Eingabetaste). Wie lang das Wort ist, steht nirgends. Zu den Buchstaben der Antwort
  kommen zwei oder drei aus den falschen Formen der Karte (`legeKacheln`): bei „put“ liegen auch t, e, d da, damit
  sich „putted“ legen lässt. Die Reihenfolge der Kacheln ist je Karte fest.
- **Wischen**: wo es nur zwei Antworten gibt, wird die Karte nach links oder rechts gewischt (die erste Antwort liegt
  links, die zweite rechts, wie vorher die Kisten). Gewischt wird überall auf dem Feld, nicht nur auf der Karte: der
  Daumen muss nicht nach oben. Beim Ziehen steht die Antwort als Stempel auf der Karte, losgelassen wird ab etwa
  84 px oder mit einem schnellen kurzen Wisch; darunter kommt die Karte zurück. Unten stehen zwei Schilder, die nach
  außen zeigen (violett links, gold rechts); sie lassen sich auch antippen, am Laptop zählen die Pfeiltasten links
  und rechts. Richtig: die Karte fliegt zu ihrer Seite hinaus, oben steht kurz der ganze richtige Satz. Die Karte ist
  dieselbe wie bei den Kisten (`KartenInhalt.tsx`), auch mit markiertem Teil.
- **Antwortkacheln** (niko 2026-11-12: „das mit dem drehen als antwort bei spielen gefällt mir nicht schau dir mal
  online einige lernspiele an die beliebt sind und mache es wie die“; bis dahin war hier ein Drehrad): oben das Blatt
  mit dem Satz, darunter beim Daumen die Antworten als große Kacheln, zu zweit nebeneinander (lange englische Formen
  untereinander), darunter „Prüfen“. So machen es die verbreiteten Lern-Apps: eine Wortbank unter dem Satz, ein Tipp
  setzt das Wort ein, ein Knopf prüft, und das Ergebnis kommt als farbiger Streifen unten. Eine Kachel antippen: das
  Wort fliegt in die Lücke (`probe`, noch ohne Farbe), auf seinem Platz bleibt ein leerer Rahmen; eine andere Kachel
  tauscht es, die Lücke antippen holt es zurück. Unten kommt nach dem Prüfen der Streifen: grün „Super!“, oder rot
  „Fast! Richtig ist …“ mit der Regel. Die falsche Kachel ist dann durchgestrichen, um die richtige
  atmet ein goldener Ring, ein Tipp auf sie schließt die Karte ab. Am Laptop die Ziffern, Eingabetaste, Rücktaste. Eine Karte mit nur
  zwei Antworten in diesen Spielen wird gewischt.
- **Nach einem Fehler** bei allen wie bei den Kisten: das Feld wird rot, darunter kommt das Blatt „Fast! Richtig
  ist …“ mit Rechenweg oder Regel, und weiter geht es erst, wenn das Richtige getippt, gelegt, gewischt oder als Kachel
  angetippt ist (dann ohne „Prüfen“). Die Karte kommt drei Karten später noch einmal.
- **Wertung**: wie immer die erste Antwort gegen `karte.richtig`. Stimmt das Getippte oder Gelegte, meldet das
  Spielfeld genau `karte.richtig`, sonst das, was der Schüler geschrieben hat; beim Wischen und bei den Kacheln ist die Wahl
  wie bei den Kisten eine der Antworten der Karte. Am Server ändert sich nichts.
- Der Anfang des Spiels zeigt statt der kleinen Kisten einen kleinen Ziffernblock, vier Buchstaben-Kacheln, zwei
  Schilder oder eine Lücke mit zwei Kacheln (`spielAntwort` für die Themenspiele: wie die meisten Karten des Themas beantwortet
  werden).

## Wortschatz und Wortfelder (Deutsch)

niko 2026-11-12: „die art der wörter die gefragt werden sollten zu einen bestimmten thema passen also wie zum beispiel
gruselgeschichte muss der schüler lernen und dann bei den lernspielen sind es wörter die er für eine gruselgeschichte
braucht“.

- **Wortfelder** (`lib/lernspiele-wortfelder.ts`, von Hand geschrieben, ohne KI) für die Schreib-Themen
  Gruselgeschichte, Abenteuergeschichte, Märchen (ab der 3. Schulstufe), Krimi, Sage und Personenbeschreibung (ab der
  5.). Je Thema 16 Sätze mit dem treffenden Wort und zwei Wörtern, die dort klar nicht passen, dazu, was das Wort
  bedeutet; über 20 Nomen mit Artikel; 14 Verben im Präteritum mit zwei typischen falschen Formen (die
  Personenbeschreibung steht im Präsens und hat keine).
- **Fähigkeiten**: Gruselgeschichte, Abenteuergeschichte, Märchen schreiben, Krimi und Sage erzählen sind Teile von
  „Spannend erzählen“ (`deutsch.schreiben.erzaehlung.grusel` …) mit Suchwörtern („Gruselgeschichte“, „Spukgeschichte“,
  „Krimi“ …), damit „Stoff zuordnen“ ein Thema wie „Gruselgeschichte“ findet. Märchen und Sage kommen auch über
  „Märchen und ihre Merkmale“ und „Sagen und ihre Merkmale“, die Personenbeschreibung über ihre eigene Fähigkeit.
- **Spiel „Wortschatz“**: ein Themenspiel wie „English Tenses“, das Thema ist das Wortfeld (aus dem Stoff, sonst eines
  der Schulstufe). Auf Kacheln das treffende Wort für den Satz („Die alte Tür ___ laut“: knarrte, kicherte, tropfte); nach
  einem Fehler steht, was das Wort bedeutet. Der Lernstand geht an das Wortfeld.
- **„der, die, das“ und „Präteritum“ mit den Wörtern des Themas**: steht ein Schreib-Thema im Stoff (Prüfung,
  aktueller Stoff, letzte Einheit), spielen die beiden Spiele die Nomen und Verben des Wortfelds (`wortfeldPlan`), und
  am Anfang steht „Wörter für: Gruselgeschichte“. Steht ein Nomen auch in der Artikel-Bank, ist es dieselbe Karte;
  Wörter mit zwei Artikeln bleiben draußen. Der Lernstand bleibt bei „der, die, das“ und „Präteritum“.
- **Vorschlag**: ein Schreib-Thema im Stoff bringt „Wortschatz“, „der, die, das“ und „Präteritum“ (in dieser
  Reihenfolge) nach vorne; „Spannend erzählen“ allein bringt „Wortschatz“.

## Endlos-Modus

Jedes Spiel außer den Vokabel-Paaren hat am Anfang neben „Los geht’s“ den Knopf **Endlos** (darunter der Rekord oder
„3 Herzen“). Man spielt, bis drei Antworten falsch waren (drei Herzen oben links); jede beim ersten Mal richtige
Karte ist ein Punkt. Am Ende stehen Punkte gegen Rekord („Neuer Rekord“ mit Konfetti), die Serie, der Lernstand und
„Kommt nächstes Mal wieder“ mit den falschen Karten.

- Ein Endlos-Lauf besteht aus normalen Runden zu zwölf Karten (`spielrunden`), die nahtlos aneinanderhängen: sind
  noch drei Karten übrig, holt das Spiel die nächste Runde, am Übergang wird die alte im Hintergrund beendet. Die
  Spalte `spielrunden.endlos` trägt bei jeder Runde des Laufs die id der ersten (`starteRunde(..., { endlos })`).
- Die letzte Runde wird mit `teil: true` beendet: es zählen nur die beantworteten Karten; eine Runde ohne Antwort
  verschwindet. Lernstand, Wochenliga und „falsch gewesen“ gehen also wie bei normalen Runden, jede Karte einmal.
- Stand = beim ersten Mal richtig über alle Runden des Laufs (`endlosStand`), Rekord = bester Lauf je Spiel
  (`endlosRekord`).

## Blockwerk

niko 2026-11-16 (mit einem Bild eines Quiz-Spiels, bei dem man für eine Antwort Züge bekommt): „neue spielidee …
kennst du das spiel block blast … ich möchte es genau so haben aber als lernspiel“. Blockwerk hat die Regeln dieser
Legespiele, aber einen eigenen Namen und den Look der Lernspiele (Bühne, Klötze in den Farben der Kisten); dazwischen
kommen die Karten eines Spiels aus dem Stoff (`components/lernen/BlockFeld.tsx`, Logik in `lib/blockwerk.ts`).

- **Wo**: im Tab „Spiele“ als breite Kachel unter „Für dich“ (die Fragen kommen aus dem Spiel, das am besten passt),
  und auf dem Anfang jedes Spiels außer den Vokabel-Paaren als dritter Knopf neben „Los geht’s“ und „Endlos“. Der
  eigene Anfang (`/lernen/[token]/spiel?modus=bloecke&art=…`, am Tablet `bloecke:<art>`) zeigt „Fragen aus“ mit bis
  zu sechs passenden Spielen zum Umschalten.
- **Brett**: 8 × 8 Felder, darunter drei Teile (37 Formen von 1 bis 9 Feldern, gedreht gibt es nicht). Ein Teil wird
  aufs Brett gezogen; am Finger schwebt es gut eine Zelle über dem Finger, damit man sieht, wo es landet. Wo es
  passt, steht es blass als Vorschau da, und was dabei abgeräumt würde, leuchtet. Volle Reihen und Spalten
  verschwinden (von der Stelle des Teils aus nach außen). Ein Teil, das nirgends passt, ist grau.
- **Fragen**: die ersten drei Teile gibt es so. Sind sie gelegt, kommt die nächste Karte des Spiels als Frage, mit
  derselben Antwortart wie im Spiel (Kisten, Kacheln, Ziffernblock …). Oben steht „Antworte für neue Teile“ mit den
  drei Teilen, die danach kommen. Neue Teile gibt es immer, auch nach einem Fehler (dann erst mit der richtigen
  Antwort, wie im Spiel). Beim ersten Versuch richtig: +60 Punkte, und der Blitz lädt.
- **Blitz**: räumt 3 × 3 Felder frei (Knopf oben rechts, dann aufs Feld tippen). Man beginnt mit einem; drei
  richtige Antworten laden einen neuen (die drei Punkte am Knopf), höchstens drei. Zuerst gab jede richtige Antwort
  einen Blitz; im Test endete dann kein Spiel mehr.
- **Ende**: passt kein Teil mehr, wird der Blitz scharf gestellt. Ohne Blitz kommt eine **Rettungsfrage**: richtig
  gibt einen Blitz, falsch beendet das Spiel. Am Ende: Punkte gegen Rekord, wie viele Fragen beim ersten Versuch
  richtig waren, der Lernstand des Spiels und „Kommt nächstes Mal wieder“.
- **Punkte** (`punkteFuer`, seit 2026-11-16 alles mal drei: niko „die punkte sind noch zu wenig“): jedes gelegte
  Feld 3, jede Linie 30 mal die Zahl der Linien (1 → 30, 2 → 120, 3 → 270), das Ganze mal der Kombo; ein ganz leeres
  Brett +900. Ältere Stände hat die Datenbank einmal mal drei genommen (`blockwerk_punkte_mal3`). Die Kombo steigt mit jedem Zug, der abräumt, und endet nach
  drei Zügen ohne Linie.
- **Gezählt** wird wie im Endlos-Modus: die Karten kommen in gewöhnlichen Runden, die aneinanderhängen
  (`spielrunden.endlos`), der Lernstand zählt jede Runde einmal, die letzte nur mit den beantworteten Karten. Die
  erste Runde trägt in `spielrunden.bloecke` die Punkte (0 beim Start); das Gerät meldet sie am Ende, der Server nimmt
  höchstens drei Millionen und macht sie nie kleiner. Der Rekord gilt für alle Spiele zusammen (`bloeckeRekord`), der
  Endlos-Rekord zählt Blockwerk nicht mit. Wer mit dem Kreuz aufhört, bekommt keinen Rekord (wie beim Endlos-Spiel).
- Ziehen geht mit Finger und Maus; ohne Bewegung bei „weniger Bewegung“. Video: `lernspiele/blockwerk-handy.mp4` im
  Projektordner.

- **Bestenliste** (niko 2026-11-16: „mach einen highscore also leaderboard für alle“, `bloeckeBestenliste`): je
  Schüler der beste Blockwerk-Stand, die Besten zuerst, auf dem Anfang (5 Plätze) und am Ende (3 Plätze), und ganz
  (10 Plätze) unten im Tab „Spiele“ (components/lernen/BestenlisteTafel.tsx; Platz und Rekord auch auf der
  Blockwerk-Kachel, niko: „man soll wo auch das leaderboard sehen können“). Andere stehen
  alle drin, nur mit Spitzname und Tierbild (lib/spielprofil.ts); wer noch keinen hat, bekommt mit den ersten Punkten
  einen freien (niko: „es soll generell erlaubt sein“). Nur wen der Lehrer ausgeschaltet hat, sehen die anderen nicht;
  er sieht sich selbst als „Du“.
- **Ende** (niko: „ist überfüllt hier“): Ring mit den Punkten (lange Zahlen kleiner, `data-lang`), eine Zeile Titel
  („Neuer Rekord!“ oder „Kein Platz mehr“), Fragen und Rekord in einer Zeile, Lernstand und Serie in einer schmalen
  Zeile, dann die knappe Bestenliste.

## Funkelfeld

niko 2026-11-16: „mach weitere spiele“ (nach Blockwerk und Glasklar; vorgeschlagen war zuerst ein Drei-in-einer-Reihe-
Spiel, bei dem eine Antwort neue Züge bringt, wie auf niko's erstem Bild). Eigener Name, eigene Steine (fünf Formen in
fünf Farben, Form und Farbe zugleich), kein Nachbau eines bekannten Spiels (`components/lernen/FunkelFeld.tsx`,
`components/lernen/FunkelSteine.tsx`, Logik in `lib/funkelfeld.ts`).

- **Wo**: wie Blockwerk: breite Kachel im Tab „Spiele“ unter Blockwerk, auf dem Anfang jedes Spiels außer den
  Vokabel-Paaren ein Knopf neben Blockwerk (auf Handys unter 375 px ohne Zeichen), eigener Anfang mit „Fragen aus“
  (`/lernen/[token]/spiel?modus=funkel&art=…`, am Tablet `funkel:<art>`). In Lernspiel.tsx heißen beide Bretter
  `brett` („bloecke“ oder „funkel“); Fragen, Runden und Ende sind dieselben.
- **Feld**: 7 × 7 Steine. Zwei Nachbarn tauschen (wischen oder nacheinander antippen; am Laptop Pfeile, Leertaste
  wählt). Drei oder mehr gleiche in einer Linie leuchten auf und verschwinden, die Steine darüber fallen, neue kommen
  von oben; jede weitere Welle („Kette!“) zählt mehr. Ein Tausch, der nichts auflöst, springt zurück und kostet keinen
  Zug. Geht kein Zug mehr, wird gemischt; nach acht Sekunden ohne Zug wippen zwei Steine, die gehen.
- **Strahl und Funke**: vier in einer Linie werden ein Strahl (drei helle Linien), der beim Auflösen seine Reihe
  (waagrecht gelegt) oder Spalte räumt. Fünf in einer Linie oder ein Winkel (L, T, Kreuz) werden ein Funke (Stern):
  mit einem Stein getauscht räumt er alle Steine dieser Form, zwei Funken räumen alles.
- **Züge und Fragen**: man beginnt mit 8 Zügen. Sind sie weg, kommt die nächste Karte als Frage („Antworte für neue
  Züge“). Beim ersten Versuch richtig: +60 Punkte und 6 Züge (alle sechs Fragen einer weniger, mindestens 3, damit
  ein Spiel nicht ewig dauert). Falsch: 2 Züge und ein Herz weg; nach drei Herzen ist das Spiel aus.
- **Punkte**: 10 je Stein mal der Welle der Kette, +60 für einen neuen Strahl, +120 für einen Funken. Gezählt und
  gespeichert wie Blockwerk, aber in `spielrunden.funkel` mit eigenem Rekord (`punkteRekord(…, "funkel")`) und eigener
  Bestenliste (Anfang, Ende und unten im Tab „Spiele“). Der Endlos-Rekord zählt Funkelfeld nicht mit.
- Bilder und Video: `lernspiele/funkelfeld-*.png` und `lernspiele/funkelfeld-handy.mp4` im Projektordner.

## Glasklar

niko 2026-11-16 (Frage, welche Spiele so beliebt sind wie Blockwerk; Antwort „ja“ zu einem Sortier-Spiel wie die
Wasser- und Kugel-Sortierspiele): Begriffe nach Sorten in Gläser sortieren. Eigener Name und Look der Lernspiele (hohe
Gläser auf der Bühne, Farben der Kisten); geprüft wird ohne KI (`components/lernen/GlasSpiel.tsx`, Regeln in
`lib/glasklar.ts`, Themen in `lib/glasklar-themen.ts`).

- **Wo**: im Tab „Spiele“ als breite Kachel unter Blockwerk (mit dem passendsten Thema, Platz in der Bestenliste),
  `/lernen/[token]/spiel?modus=glas&thema=…`, am Tablet `glas:<thema>`. Der Anfang zeigt „Sortieren nach“ mit den
  Themen zum Umschalten und darunter eine Zeile „Gläser für: …“.
- **Themen** (`GLAS_THEMEN`, je Schulstufe): der/die/das (ab 1), Wortarten (ab 2; 3 Sorten bis Stufe 4, 5 in Stufe
  5, 7 ab 6), die vier Fälle (ab 5), Irregular Verbs (1./2./3. Form, ab 6), Plus bis 10 (1), Plus bis 20 (1–2),
  Einmaleins (2–5, Sorten „= 12“), Gleich lang (Längen, 5–7), Gleich viel (Bruch, Dezimalzahl, Prozent, ab 6). Dazu
  **Dein Stoff**: Spielkarten mit mehreren Antworten werden nach ihrer richtigen Antwort gruppiert (eine Sorte
  braucht mindestens 3 Karten, ein Thema mindestens 2 Sorten). Reihenfolge wie bei den Spielen: frischer Stoff zuerst,
  dann Themen zum Stoff, dann die zur Schulstufe, alter Stoff am Ende „Zum Wiederholen“.
- **Regeln**: Glas antippen hebt den obersten Begriff an, ein zweites Glas legt ihn ab: in ein leeres Glas oder auf
  einen Begriff derselben Sorte. Ein volles Glas mit nur einer Sorte geht zu (Deckel mit dem Namen, Farbe der Sorte).
  Die Begriffe sind weiß, solange sie offen sind, sonst würde die Farbe die Sorte verraten.
- **Fehler**: auf eine andere Sorte gelegt = falsche Antwort. Ein Herz weg (3 Herzen), der Begriff bleibt, wo er war,
  beide Begriffe tragen danach ihre Sorte klein als Etikett, und ein Blatt zeigt beide Sorten mit der Regel der Karte.
  Eine Stufe ohne Fehler gibt ein Herz zurück. Ohne Herzen ist das Spiel aus.
- **Stufen** (`stufeFuer`): 1: 2 Sorten × 3 und ein leeres Glas; 2: 3 × 3, zwei leer; 3: 3 × 4; 4: 4 × 4; 5–6: 5 × 4;
  ab 7: 4 × 4 mit nur einem leeren Glas. Jede Auslage ist geprüft lösbar (Suche mit Gedächtnis), kein Glas ist schon
  sortiert. „Zurück“ nimmt Züge bis zum letzten zugemachten Glas zurück; geht kein Zug mehr, kommt „Neu mischen“.
  Tasten 1–9 wählen ein Glas, Rückschritt nimmt zurück.
- **Punkte** (`GLAS_PUNKTE`): jeder Begriff 10 (einmal), jedes zugemachte Glas 40 × Stufe, jede Stufe 100 × Stufe,
  ohne Fehler noch einmal 100 × Stufe. Gespeichert in `spielrunden.glas` an der ersten Runde, höchstens drei
  Millionen, nie kleiner. Eigener Rekord und eigene **Bestenliste** (`punkteBestenliste(student, "glas")`), wie bei
  Blockwerk für alle, mit Spitznamen.
- **Gezählt**: jede Stufe ist eine Runde (`spielrunden.endlos` hängt sie aneinander, die Fähigkeit ist die des
  Themas). Die erste Bewegung eines Begriffs auf einen anderen ist seine Antwort (die Sorte darunter); Begriffe, die
  nie auf einem anderen lagen, zählen als richtig, wenn ihr Glas zugeht. In der letzten, nicht fertigen Stufe zählen
  nur die beantworteten. Falsche kommen beim nächsten Mal zuerst wieder; sonst keine Begriffe der letzten 40 Runden.
- Video: `lernspiele/glasklar-handy.mp4` im Projektordner.

## Dein Stoff (eigene Spielkarten)

niko 2026-11-16 mit einem Bio-Test (Evolution, Plattentektonik): „wie könnte ich das in blockpuzzle implementieren für
den schüler kann ich das wo anlegen?“. Für jeden Stoff, den die fertigen Spiele nicht haben, in jedem Fach:

- **Anlegen**: beim Schüler im Tab Übungen › **Spielkarten** (`/schueler/<id>/spielkarten`), wie die Vokabellisten
  als Text mit Vorschau. Eine Karte pro Zeile: `Frage = richtig | falsch | falsch` (2 bis 6 Antworten, die erste
  stimmt; `___` in der Frage ist die Lücke), `Auftrag: erstes > zweites > drittes` für eine Reihenfolge (3 bis 8
  Teile), `Merke: …` darunter erscheint nach einem Fehler. Regeln in lib/spielkarten-text.ts.
- **Aus Unterlagen**: bei **Stoff vorbereiten** das Häkchen „Spielkarten“; die KI schlägt im selben Lauf etwa 40
  Karten vor. Jede geht durch dieselbe Prüfung wie getippte Karten; erst „Alles übernehmen“ nimmt sie ins Spiel.
- **Spielen**: der zuletzt geänderte Satz, der im Spiel ist und mindestens 4 Karten hat, ist das Spiel „Dein Stoff“
  (Art `stoff`). In den ersten 30 Tagen steht es zuerst unter „Für dich“, danach am Ende „Zum Wiederholen“. Blockwerk
  nimmt dann seine Fragen von dort. Zwei Antworten werden gewischt, drei bis sechs sind Kacheln, eine Reihenfolge
  wird gelegt wie beim Satzbau. Falsche Karten kommen wieder (der Schlüssel hängt an der Frage).
- **Lernstand**: die Runden hängen an der ersten Fähigkeit des Stoffpakets, sonst an `stoff.eigen` (zählt für keine
  Fähigkeit). Die Liste der Spielkarten zeigt je Satz Runden, Anteil richtig und was oft falsch war.
- Kein Duell mit „Dein Stoff“: die Karten hat nur dieser Schüler.

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
zuerst Karten, die in den letzten 40 Runden nicht dran waren; reicht das nicht, die am längsten nicht gesehenen
(`zuletztGespielt`, die neueste zuerst; niko 2026-11-16 „die fragen wiederholen sich mit der zeit“: vorher zählten nur
die letzten zwei Runden, im Blockwerk kamen Fragen so schon nach 24 wieder). Keine Antwort steht öfter als bei der Hälfte der Karten (sonst gewinnt bei
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

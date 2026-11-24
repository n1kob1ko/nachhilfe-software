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
  nächsten Teilstrich (am Laptop die Pfeiltasten), das Loslassen zählt sofort (am Laptop die Eingabetaste). Welche Zahl unter dem Zeiger liegt,
  steht vorher nirgends: das abzulesen ist die Aufgabe.
- **Richtig**: der Zeiger wird grün, über dem Teilstrich erscheint die Zahl als Fähnchen, die nächste Karte kommt.
  **Falsch**: der Zeiger wird rot, die richtige Stelle bekommt das grüne Fähnchen, darunter steht, welche Zahl
  getroffen wurde („Fast! Das war 3,6. Um einen Teilstrich verzählt.“) und der Weg („Von 3,5 bis 4 sind es 5
  Teilstücke, ein Teilstück ist also 0,1 …“). Weiter geht es, wenn der Zeiger an der richtigen Stelle sitzt; die Karte
  kommt drei Karten später noch einmal.
- **Gezählt** wird das erste Loslassen je Karte. Die Wahl ist die Nummer des Teilstrichs (`richtig` der Karte), der
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
  Löschen und ein goldener Haken (am Laptop Ziffern, Rücktaste, Eingabetaste). Hat das Getippte so viele Zeichen wie
  das Ergebnis (oder stimmt es schon), zählt es sofort; der Haken braucht es nur für ein kürzeres. Das Ergebnis wird selbst
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
  einen Buchstaben in die Lücke, die Rücktaste (oder ein Tipp auf das Wort) holt den letzten zurück. Liegen so viele
  Buchstaben, wie das Wort lang ist, zählt es sofort (am Laptop tippen, Rücktaste; die Eingabetaste zählt ein kürzeres). Wie lang das Wort ist, steht nirgends. Zu den Buchstaben der Antwort
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
  untereinander). Eine Kachel antippen: das Wort fliegt in die Lücke (`probe`, noch ohne Farbe), auf seinem Platz
  bleibt ein leerer Rahmen, und es zählt sofort (niko 2026-11-16: „dieses ‚Prüfen‘ ist zu anstrengend, das soll weg
  sein, also wenn der Spieler klickt, dann soll es sofort zählen“; bis dahin gab es einen Knopf „Prüfen“). Unten kommt der Streifen: grün „Super!“, oder rot
  „Fast! Richtig ist …“ mit der Regel. Die falsche Kachel ist dann durchgestrichen, um die richtige
  atmet ein goldener Ring, ein Tipp auf sie schließt die Karte ab. Am Laptop die Ziffern. Eine Karte mit nur
  zwei Antworten in diesen Spielen wird gewischt.
- **Nach einem Fehler** bei allen wie bei den Kisten: das Feld wird rot, darunter kommt das Blatt „Fast! Richtig
  ist …“ mit Rechenweg oder Regel, und weiter geht es erst, wenn das Richtige getippt, gelegt, gewischt oder als Kachel
  angetippt ist. Einen Knopf „Prüfen“ gibt es in keinem Spiel. Die Karte kommt drei Karten später noch einmal.
- **Wertung**: wie immer die erste Antwort gegen `karte.richtig`. Stimmt das Getippte oder Gelegte, meldet das
  Spielfeld genau `karte.richtig`, sonst das, was der Schüler geschrieben hat; beim Wischen und bei den Kacheln ist die Wahl
  wie bei den Kisten eine der Antworten der Karte. Am Server ändert sich nichts.
- Der Anfang des Spiels zeigt statt der kleinen Kisten einen kleinen Ziffernblock, vier Buchstaben-Kacheln, zwei
  Schilder oder eine Lücke mit zwei Kacheln (`spielAntwort` für die Themenspiele: wie die meisten Karten des Themas beantwortet
  werden).

## Selbst schreiben und „Schwer“

niko 2026-11-24: „das mit antwort auswählen ist am anfang vielleicht besser aber mit der zeit kommt es mir so vor als
würde man einfach raten oder man kann's halt auswendig … was wenn es einen schwer modus gibt wo man dann selbst die
antwort eintippen muss“; dann: „ja übernimm das für alle spiele“. Alles Reine steht in `lib/antwort-schreiben.ts`, das
Feld in `components/lernen/SchreibFeld.tsx` (`form: "schreiben"`).

- **Kommt zum Schreiben wieder**: war die letzte Antwort auf eine Karte richtig, kommt sie beim nächsten Mal zum selbst
  Schreiben (im Mathe-Quiz eine Zahl am Ziffernblock). War das Geschriebene falsch, kommt sie danach wieder mit Auswahl.
  Bis zu zwei Karten, die mit Auswahl richtig und noch nie geschrieben waren, holt jede Runde gleich wieder (nach den
  Fehlern, `wiederholen`). `schreibenFuer` liest dafür die letzten 80 beendeten Runden des Spiels.
- **Schwer**: ein Schalter über „Los geht’s“ (je Gerät gemerkt, `ls-schwer`): jede Karte, die sich schreiben lässt,
  wird geschrieben, auch in Endlos, Blockwerk und Funkelfeld. Im Duell und im Torlauf (die Antworten sind Tore) wird nie
  geschrieben.
- **Wo geschrieben wird** (`schreibForm`): Irregular Verbs und Präteritum (statt Buchstaben legen), English Tenses und
  English Grammar mit Grundform („(take)“ → takes; is/am/are bleiben Kacheln), Stilmittel (der Name), Wortschatz (mit
  dem Anfangsbuchstaben, sonst gäbe es mehrere treffende Wörter), Meine Fehler (die richtige Stelle), Dein Stoff (kurze
  Antworten, keine „Welche …?“-Fragen), Deutsch- und Englisch-Quiz nur bei einer Frage zu einem Wort in
  Anführungszeichen („Mehrzahl von „der Baum““, „„always“ heißt“), Mathe-Quiz bei ganzen Zahlen oder einer
  Nachkommastelle (nichts Gerundetes).
- **Nicht geschrieben**: der, die, das; die Endungen und Präposition und Fall (feste kleine Auswahl, Schreiben wäre
  dasselbe Wählen); alles mit zwei Antworten (Wischen); Die vier Fälle, Satzbau, Zahlenstrahl, Vokabel-Paare (der
  Vokabeltrainer schreibt schon), Glasklar; Wortschloss schreibt schon.
- **Europa, Blätter bestimmen, Biolabor** haben schon „Wie im Test“ (= Schwer). Beim Üben kommt dort, was beim letzten
  Mal richtig war, zum Schreiben wie im Test: Hauptstadt und Land zur Flagge, Name und Familie der Pflanze, der Begriff
  (`zumSchreibenEigen` in lib/lernspiele.ts).
- **Prüfen** (`pruefeSchreiben`): Groß/klein, Leerzeichen, Apostrophe, ein Punkt am Ende zählen nie, im Englischen
  „doesn't“ wie „does not“. Ein Tippfehler ist „fast“ und zählt als richtig (die Schreibung steht da, weiter mit
  „Weiter“): ein Buchstabe daneben ab 5 Buchstaben, zwei ab 12, Umlaute als ae/oe/ue, Artikel vorne egal; nie, wenn das
  Geschriebene eine falsche Antwort der Karte ist oder ihr näher. **Streng** (kein Tippfehler) bei Irregular Verbs,
  Präteritum, English Tenses und Grammar und den eigenen Fehlern: dort ist genau der Buchstabe der Fehler („telled“).
  Silbentrennung („Kin-der“) muss mit Strich stimmen.
- **Das Feld**: oben das Blatt, das Geschriebene steht gleich in der Lücke; darunter das Feld, „Weiß ich nicht“ und
  „Fertig“ (Eingabetaste). Falsch: die richtige Antwort und die Regel stehen da, weiter erst, wenn sie geschrieben ist;
  die Karte kommt drei Karten später noch einmal. Gezählt wird der erste Versuch (stimmt er, meldet das Feld
  `karte.richtig`), am Server ändert sich nichts. Im Blockwerk kommt eine Karte zum Schreiben auf eigenem Bildschirm.

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
  Antwort, wie im Spiel). Beim ersten Versuch richtig: +200 Punkte, und der Blitz lädt.
- **Frage unter dem Brett** (niko 2026-11-16: „die spiele sollen die schüler süchtig machen … zu wenig flashyness
  und das spielkonzept … komisch aufgebaut“; „blockwerk war bisher das beste die kinder lieben es“): seit 2026-11-17
  verschwindet das Brett nicht mehr. Die Frage schiebt sich dort hoch, wo sonst die Teile liegen
  (`components/lernen/BrettFrage.tsx`), das Brett wird so groß, wie noch Platz ist (Container-Abfrage in
  blockwerk.css). Oben stehen die drei Teile, die es dafür gibt, darunter ein Zeitbalken (8–14 s, seit 2026-11-18 eine Grenze), der Satz und
  höchstens vier große Kacheln (`brettOptionen`: die richtige und die ersten falschen der Karte). Ein Tipp zählt
  sofort. Falsch: durchgestrichen, die richtige leuchtet, die Regel steht darunter, weiter mit einem Tipp auf die
  richtige. Karten ohne Kacheln (Satzbau, Zahlenstrahl) kommen wie bisher auf eigenem Bildschirm. Auch die
  Rettungsfrage kommt unter dem Brett.
- **Schnell und Fieber**: richtig in der ersten Hälfte des Zeitbalkens ist „Blitzschnell!“ (+100). Drei Antworten beim ersten Versuch
  richtig am Stück sind **Fieber** (`fieberFaktor`): alle Punkte ×2, ab sechs ×3, bis eine Antwort falsch ist. Links
  oben zeigt die Flamme mit drei Punkten, wie weit es bis zum Fieber ist; im Fieber leuchtet ein Ring um das Brett.
- **Effekte**: Töne aus dem Browser (`components/lernen/klang.ts`, Web Audio ohne Dateien: Tock beim Legen, eine
  Tonfolge je Linie, die mit der Kombo höher wird, Klingeln bei richtig, Brummen bei falsch, Fanfare bei leerem Brett
  und neuem Rekord; Lautsprecher-Knopf oben rechts, das Gerät merkt sich die Wahl in `ls-ton`). Funken aus jeder
  geräumten Zelle und aus der richtigen Kachel (`components/lernen/Funkenregen.tsx`, eine Leinwand, die nur zeichnet,
  solange etwas fliegt), Regen bei Fieber, leerem Brett und Rekord. Das Brett wackelt bei zwei und mehr Linien, große
  Wörter („Super!“, „Stark!“, „Wahnsinn!“), die Punkte erscheinen dort, wo das Teil lag, und zählen oben hoch. Bei
  „weniger Bewegung“ fliegt und wackelt nichts.
- **Blitz**: räumt 3 × 3 Felder frei (Knopf oben rechts, dann aufs Feld tippen). Man beginnt mit einem; **fünf**
  richtige Antworten laden einen neuen (die fünf Punkte am Knopf; bis 2026-11-22 drei, niko: „noch zu leicht … erst
  blitze bei 5“), **höchstens einer** (seit 2026-11-18, niko:
  „blockwerk ist zu leicht … max 1 blitz“; davor drei). Wer einen hat, spart nicht weiter an. Zuerst gab jede
  richtige Antwort einen Blitz; im Test endete dann kein Spiel mehr.
- **Strafen** (niko 2026-11-18: „blockwerk ist zu leicht … mehr punishing“, gewählt Ideen 1, 3, 5):
  - **Schutt**: eine falsche Antwort wirft 3 graue Steine auf freie Felder (`schutt`, `SCHUTT_STEINE`; nie so, dass
    eine Linie voll wird). Sie gehen nur mit einer vollen Reihe/Spalte oder dem Blitz weg.
  - **Zeit ist Pflicht**: der Balken über der Frage unter dem Brett läuft 8 s (lange Sätze bis 14 s, `zeitFuer`).
    Erste Hälfte gold = „Blitzschnell“, dann rot; ist er leer, zählt die Frage als falsch („Zeit um!“, gespeichert
    als Antwort ohne Wahl) und es geht weiter wie nach einem Fehler, also auch mit Schutt. Karten auf eigenem
    Bildschirm (Satzbau, Zahlenstrahl) haben keine Zeit.
  - **Rettungsfrage nur einmal je Spiel**: steckt man danach wieder ohne Blitz, ist das Spiel aus.
- **Weiterspielen** (niko 2026-11-22: „was wenn ein schüler die runde nicht beendet aber gehen muss“,
  `lib/blockwerk-stand.ts`): nach jedem Zug und jeder Antwort geht der Stand (Brett, Teile, Punkte, Blitz, Fieber, die
  offene Frage und die laufende Runde mit ihren Antworten) kurz danach an den Server, sofort, wenn die App in den
  Hintergrund geht oder das Kreuz gedrückt wird. Er liegt an der ersten Runde des Spiels (`spielrunden.brett_stand`).
  Beim nächsten Öffnen zeigt Blockwerk „Weiterspielen · 1 720 Punkte“ und „Neues Spiel“; kommen die Fragen aus einem
  anderen Spiel, führt der Knopf dorthin (`&weiter=1`). „Neues Spiel“ beendet das angefangene mit seinen Punkten
  (Rekord und Bestenliste zählen sie). Angefangene Spiele bleiben 14 Tage (andere offene Runden nur bis morgen). Eine
  schon falsch beantwortete offene Frage bleibt falsch. Nur in der Schüler-App, nicht am Tablet in der Einheit.
- **Ende**: passt kein Teil mehr, wird der Blitz scharf gestellt. Ohne Blitz kommt eine **Rettungsfrage** (einmal je
  Spiel): richtig gibt einen Blitz, falsch beendet das Spiel. Am Ende: Punkte gegen Rekord, wie viele Fragen beim ersten Versuch
  richtig waren, der Lernstand des Spiels und „Kommt nächstes Mal wieder“.
- **Punkte** (`punkteFuer`, `PUNKTE_FAKTOR`: 2026-11-16 mal drei, niko „die punkte sind noch zu wenig“; seit
  2026-11-18 mal zehn, niko „punkte sollen mehr sein“): jedes gelegte Feld 10, jede Linie 100 mal die Zahl der
  Linien (1 → 100, 2 → 400, 3 → 900), das Ganze mal der Kombo; ein ganz leeres Brett +3000. Ältere Stände hat die
  Datenbank umgerechnet (`blockwerk_punkte_mal3`, dann `blockwerk_punkte_mal10` mal 10/3). Die Kombo steigt mit jedem Zug, der abräumt, und endet nach
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

- **Bilder und Musik** (niko 2026-11-18: „schau mal was du mit higgsfield für blockwerk machen kannst … nicht zu viel
  credits“; mit Higgsfield gemacht, zusammen etwa 35 Credits): alles in `public/spiele/blockwerk/` (der Pfad `spiele/`
  ist für Schüler ohne Anmeldung offen, proxy.ts und `OFFENE_PFADE`).
  - **Hintergrund**: Himmel in DreamStudy-Blau mit Wolken und offenem Buch, hochkant fürs Handy (die schwebenden
    Steine oben sind herausgerechnet, sie lagen hinter Serie und Blitz), quer ab Seitenverhältnis 4:5; im dunklen
    Modus abgedunkelt (components/lernen/blockwerk-bild.css, nur solange das Brett offen ist: `.ls:has(> .bw)`).
  - **Maskottchen** unter dem Brett, neben dem Hinweis (components/lernen/BlockMaskottchen.tsx): ein blauer Block mit
    Blitz-Abzeichen in sechs Posen; welche, sagt `stimmung` in lib/blockwerk-stimmung.ts: traurig, wenn das Spiel aus
    ist; Blitz beim Blitz und beim Zielen; staunt bei „Alles frei“, Fieber und Lob; jubelt bei Punkten und Kombo;
    nervös bei Schutt, wenn nichts passt oder ab 60 % belegten Feldern; im Fieber jubelt er, sonst ist er ruhig.
    Hüpfen, Zittern und Atmen nur mit transform; bei „weniger Bewegung“ wechselt nur das Bild.
  - **Musik**: zwei ruhige Stücke zu je einer Minute, die sich abwechseln, leise unter den Tönen
    (components/lernen/musik.ts). Noten-Knopf im Kopf neben dem Lautsprecher, das Gerät merkt sich die Wahl
    (`ls-musik`); sind die Töne aus, schweigt auch die Musik. Startet der Browser sie nicht gleich, kommt sie mit dem
    nächsten Tippen; ist die Seite verdeckt, pausiert sie.

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

## Torlauf

niko 2026-11-17 auf der Karte „Welches Spiel als Nächstes?“: „Läufer mit Antwort-Toren“ (nach „was … generell schon
beliebt ist … nachmachen und etwas umändern“). Ein Endlos-Läufer mit eigenem Namen, eigener Figur (runder oranger
Läufer mit blauem Schulrucksack) und eigenem Look, kein Nachbau eines bekannten Spiels
(`components/lernen/TorLauf.tsx`, `components/lernen/torlauf.css`, Logik in `lib/torlauf.ts`).

- **Wo**: wie Blockwerk und Funkelfeld: Kachel „Torlauf“ im Tab „Spiele“, ein Knopf auf dem Anfang jedes Spiels mit
  Antworten zum Wählen (`torTauglich`: nicht Satzbau, Zahlenstrahl, Glasklar, Wortschloss), eigener Anfang
  (`/lernen/[token]/spiel?modus=tor&art=…`, am Tablet `tor:<art>`). In Lernspiel.tsx ist es das dritte `brett` („tor“).
- **Laufen**: der Läufer rennt von selbst auf drei Spuren, erst 9 m/s, alle 230 m einen m/s schneller, höchstens 19.
  Wischen links/rechts wechselt die Spur (lang gewischt zwei), nach oben springt er; Tippen links oder rechts vom
  Läufer geht auch, am Laptop Pfeile, A/D, W und Leertaste. Kisten muss man umlaufen, über Hürden springt man (oder
  läuft vorbei), Sterne sammelt man ein (+10, mit einem höher werdenden Ton). Jede Reihe lässt einen Weg frei; auf der
  ersten Strecke steht nur ein Hindernis je Reihe.
- **Tore**: oben steht die Frage mit den Antworten (bis zu drei, `torOptionen`: die richtige und die ersten falschen
  der Karte, die richtige je Karte an fester, aber anderer Stelle). Die Torreihe kommt erst, wenn man die Frage mindestens
  6,5 s lesen konnte (später 4,5 s), vor und hinter den Toren bleibt die Strecke frei. Ein Tipp auf eine Antwort oben
  oder die Taste 1–3 schickt den Läufer auf ihre Spur. Bei zwei Antworten stehen die Tore außen, in der Mitte eine Wand.
- **Richtig**: +100 Punkte mal Fieber, Funken, ein Lobwort; drei richtige am Stück sind **Fieber** (×2, ab sechs ×3,
  wie Blockwerk) und bringen ein verlorenes Herz zurück. **Falsch** oder gegen Kiste oder Wand: ein Herz weg (3 Herzen),
  die richtige Antwort und die Regel stehen kurz über der Strecke. Ohne Herzen ist der Lauf aus.
- **Strecken**: alle fünf Tore beginnt eine neue Strecke mit anderem Himmel (Morgen, Mittag, Abend, Nacht,
  Polarlicht), dichteren Hindernissen und kürzerer Lesezeit.
- **Punkte**: 1 je Meter, 10 je Stern, 100 je Tor, alles mal Fieber. Gespeichert wie Funkelfeld in `spielrunden.tor`
  mit eigenem Rekord und eigener Bestenliste; der Endlos-Rekord zählt Torlauf nicht mit. Gezählt wird wie im
  Endlos-Modus (Runden hängen aneinander).
- Bilder und Video: `lernspiele/torlauf-bilder/` und `lernspiele/torlauf-handy.mp4` im Projektordner.

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

## Wortschloss

niko 2026-11-16 „mach weitere spiele“: ein Wort-Rätsel zum Stoff, eigene Kachel im Tab „Spiele“ (wie Glasklar), eigenes
Spielfeld (`components/lernen/WortSchloss.tsx`), Regeln in `lib/wortschloss.ts`, Wörter in `lib/wortschloss-themen.ts`.

- **Spielfeld**: oben der Hinweis (ein weißes Kärtchen: „bleiben“ mit dem Schild „Präteritum · er, sie, es“), in der
  Mitte das Schloss (ein Messing-Rahmen mit sechs Reihen, so viele Felder, wie das Wort Buchstaben hat), unten eine
  QWERTZ-Tastatur. Umlaute und ß gibt es nur, wenn ein Wort der Stufe sie braucht. Ist eine Reihe voll, zählt sie
  sofort, ohne Knopf. Die Felder drehen sich nacheinander: grün sitzt, gold kommt an einer anderen Stelle vor, grau kommt
  nicht vor (doppelte Buchstaben leuchten nur so oft, wie sie im Wort sind). Die Tasten färben sich mit. Es gibt kein
  Wörterbuch: jede Reihe aus Buchstaben zählt.
- **Gelöst**: die Reihe hüpft, der Bügel springt auf, unten am Schloss „Auf Anhieb! +100“; das nächste Wort kommt.
  **Nicht gelöst** nach sechs Reihen: das Schloss wackelt, ein Herz ist weg, ein Blatt zeigt das Wort und die Regel
  („kommen: er kam, sie kamen (nicht „kommte“)“), „Weiter“.
- **Stufen**: vier Wörter je Stufe (eine Runde am Server). Stufe 1 nur Wörter bis 6 Buchstaben, Stufe 2 bis 8, dann
  bis 10. Am Ende der Stufe 50 × Stufe Bonus, alle in der ersten Reihe +100 × Stufe; kein Wort verloren: ein Herz
  zurück. Drei Herzen; ohne Herzen ist das Spiel aus.
- **Punkte** je Wort nach der Reihe: 100, 60, 40, 25, 15, 10, mal die Stufe. Gerät zählt, Server nimmt sie am Ende
  (`gueltigeWortPunkte`), eigener Rekord und eigene Bestenliste (Spalte `spielrunden.wort`).
- **Gezählt** für den Lernstand wird je Wort die erste Reihe: richtig ist sie nur, wenn das Wort gleich beim ersten
  Mal stimmt (`ersteWahl`). Nicht gewusste Wörter kommen in der nächsten Stufe zuerst wieder.
- **Themen** (`wortThemen`, das passendste zuerst): „Dein Stoff“ (Spielkarten mit einem Wort als Antwort, frisch zuerst),
  die eigene Vokabelliste, Themen aus dem Stoff, dann je Fach: Englisch „Vokabeln“ (Deutsch → Englisch, wie bei
  Vokabel-Paare die eigene oder eine Themenliste) und „Irregular Verbs“ (ab 6. Schulstufe: Simple Past und Past
  Participle), Deutsch „Präteritum“ und „Perfekt-Formen“ (ab 4.: die Verben aus `lib/deutsch-woerter.ts`, ohne
  trennbare) und „Mehrzahl“ (2. bis 6.: `MEHRZAHL` aus `lib/deutsch-mehr.ts`, nur eindeutige). Nur Wörter aus 3 bis 10
  Buchstaben ohne Leerzeichen.
- **Tablet**: Ansicht `wort:<thema>` (leer = das passendste), wie Glasklar.
- **Laptop**: Buchstaben tippen, die Rücktaste löscht.

## Phantombild (Personenbeschreibung)

niko 2026-11-19: drei Schüler lernen die Personenbeschreibung. Kein „Wer ist es?“ (Einzelunterricht), kein Sortieren,
kein Satztuning. Zwei Teile in einem Spiel (`components/lernen/PhantomSpiel.tsx`), eigene Kachel im Tab „Spiele“ wie
Glasklar. Regeln in `lib/phantombild.ts`, der Lückentext in `lib/phantom-vorlage.ts`, das Gesicht als SVG in
`components/lernen/PhantomGesicht.tsx` (keine Bilder, keine Credits).

- **Wörter**: je Bereich nur 4–5 (niko: „damit sie nicht überfordert sind“). Körperbau zierlich/schlank/kräftig/
  muskulös, Haut blass/hell/gebräunt/dunkel, Gesicht rund/oval/eckig/schmal, Augen blau/grün/braun/grau, Nase klein/
  groß/breit/spitz, Mund klein/breit/schmal/volle Lippen, Haare kurz/lang/glatt/lockig oder Glatze, Haarfarbe schwarz/
  braun/blond/rot/grau, Kleidung T-Shirt/Hemd/Pullover/Kapuzenpullover/Jacke in rot/blau/grün/gelb/schwarz. Dazu Bart,
  Brille, Schmuck und besondere Merkmale (Sommersprossen, Narbe, Muttermal). Keine Augenbrauen. Text, Kacheln und
  Vorlage nehmen genau diese Wörter (`MERKMALE`).
- **Körperbau sichtbar** (niko 2026-11-19: „man erkennt oft nicht genau ob es zb muskulös oder schlank ist“): das
  Bild zeigt den Oberkörper bis zur Hüfte mit Armen (`KOERPER` in PhantomGesicht.tsx): zierlich schmal mit dünnen
  Armen, schlank gerade, kräftig breit mit Bauch, muskulös V-Form mit dicken Oberarmen. Kleine Bilder (Person,
  Text lernen, Kachel) nehmen den Ausschnitt `kopf`.
- **Fall lösen**: oben die Zeugenaussage (Präsens, Aufbau des Arbeitsblatts: Einleitung, oben → unten, Schluss), darunter
  das Phantombild. Gefragt wird in der Reihenfolge des Aufbaus, je Merkmal eine Reihe Kacheln mit dem Bild des Teils.
  Jeder Tipp zählt sofort. Richtig: das Teil springt ins Bild. Falsch: ein Herz weg, das richtige Teil wird gezeichnet,
  ein Blatt zeigt den Satz aus der Aussage und die Regel. Ein Fall ist eine Runde am Server; der nächste kommt mit
  Stufe + 1 (`ab` je Merkmal: Stufe 1 nur Person, Augen, Haare, Kleidung; ab 3 alle). Ab Stufe 3 zeigen die Kacheln
  nur Bilder (`NUR_BILD_AB`), ab Stufe 4 verschwindet die Aussage nach „Gemerkt!“ (`MERKEN_AB`).
- **Punkte**: 100 × Stufe je Merkmal, aus dem Kopf × 1,5 (nicht nach „Nochmal lesen“), fehlerfreier Fall + 300 × Stufe
  und ein Herz zurück. Drei Herzen. Eigener Rekord und eigene Bestenliste (Spalte `spielrunden.phantom`,
  `gueltigePhantomPunkte`). Falsche Werte kommen im nächsten Fall bevorzugt wieder (`phantomVorrang`).
- **Text lernen** (`vorlage`): der Lückentext, den sie auswendig lernen und nur mehr einsetzen. Fünf Stufen: 0, 25, 50,
  75, 100 % der Wörter fehlen (wer in Stufe 2 fehlt, fehlt auch in 3). Die Platzhalter ([Name], [Augenfarbe] …) füllt
  immer die Person des Falls, die Kacheln bieten dieselbe Lücke für andere Personen an. Ab 80 % richtig ist die Stufe
  geschafft und die nächste offen (`vorlageGeschafft`). Keine Herzen, ein falscher Tipp zeigt das Wort rot.
- **Vorlage ändern**: Mehr › Phantombild-Vorlage. Der Text von Claude folgt dem Aufbau des Arbeitsblatts; Platzhalter in
  eckigen Klammern, [Er]/[er]/[Sein]/[sein] werden zu sie/ihr. Fehlt der Person ein Merkmal (kein Bart), fällt der Satz
  weg. Gespeichert in `app_settings` unter `phantom_vorlage`, „Vorlage von Claude nehmen“ setzt zurück.
- **Wer es sieht** (`phantomWahl`): Deutsch in der 4. bis 8. Schulstufe, oder wenn `deutsch.beschreiben.person` im
  Stoff ist (dann steht die Kachel gleich unter „Für dich“).
- **Gezählt** für den Lernstand: die Fähigkeit `deutsch.beschreiben.person`, je Merkmal der erste Tipp.
- **Tablet**: Ansichten `phantom:fall` und `phantom:text`; quer zwei Spalten (Aussage links, Bild rechts).

## Blätter bestimmen (Biologie)

niko 2026-11-22 mit 28 Fotos aus der Mappe einer Schülerin (Liste „Blättersammlung 2.D“ und ein Herbarbogen je
Pflanze): „Die Schülerin bekommt als Biologie test diese Blätter als Bild und sie muss dann sagen können welche Familie
und welches Blatt. Mach daraus ein Spiel“, dazu: „die Infos sind egal“, „also nur deutschen namen und deutschen
familiennamen“. Spiel `blatt` (`lib/blaetter.ts`, `components/lernen/BlattSpiel.tsx`, `blaetter.css`), ohne KI:

- **Pflanzen**: die 26 der gedruckten Liste mit deutschem Namen und deutschem Familiennamen (19 Familien). Die Liste
  gilt, nicht die Handschrift auf den Bögen; „Bittereschengewäsche“ ist als „Bittereschengewächse“ übernommen. Kein Latein.
- **Bilder**: die gepressten Blätter der Schülerin, aus den Fotos freigestellt (ohne Namen und Infos, ohne Zeichnungen
  von Frucht und Blüte), `public/spiele/blaetter/blatt-NN.webp` mit NN = Nummer der Liste. Ein neues Blatt braucht
  ein Bild dort und eine Zeile in `PFLANZEN`.
- **Spielen**: ein Herbarbogen mit dem Blatt und einem Etikett (Pflanze, Familie). Je Blatt zwei Karten: erst „Welche
  Pflanze ist das?“, dann „Zu welcher Familie gehört der Efeu?“. Die Antwort steht danach auf dem Etikett.
  - **Üben**: vier Kacheln, ein Tipp zählt sofort. Die falschen Antworten kommen möglichst von Blättern, die ähnlich
    aussehen (`form`: gelappt, gefiedert, gesägt, glatt); bei der Familie nie eine zweite richtige.
  - **Wie im Test**: Name und Familie selbst schreiben, „Fertig“ oder Eingabetaste; „Weiß ich nicht“ zeigt die Lösung.
    Groß/klein, Leerzeichen, Bindestrich und ß/ss sind egal („Rotbuche“ = „Rot-Buche“). Ein Buchstabe daneben (bei
    langen Wörtern zwei, nicht bei Wörtern unter fünf Buchstaben) zählt als gewusst, aber ein Blatt zeigt „Fast! Achte
    auf die Schreibung“. Eine andere Pflanze oder Familie der Liste ist nie „fast“ (`pruefeGeschrieben`).
  - **Großer Test**: alle 26 Blätter schreiben. Sonst hat eine Runde 8 Blätter (16 Karten).
  - **Alle Blätter ansehen**: nach Familien geordnet, „Namen abdecken“ zum Selbsttest (antippen deckt auf). Zählt nicht.
- **Fehler**: ein Blatt von unten mit der richtigen Antwort und dem Merkmal des Blatts („Fünf Lappen mit langen,
  spitzen Zipfeln …“), bei der Familie die anderen Pflanzen derselben Familie. Die Karte kommt drei Karten später
  noch einmal (höchstens zweimal); gezählt wird der erste Versuch.
- **Sammlung**: ein Blatt ist **sicher**, wenn Name und Familie zweimal hintereinander beim ersten Versuch stimmten
  (`blattStand`). Anfang und Ende zeigen alle 26 klein (sicher mit goldenem Rand, nie gesehen nur als Umriss).
  Eine Runde nimmt zuerst die zuletzt falschen Blätter, dann die nicht sicheren (am längsten nicht gesehen zuerst),
  dann die sicheren.
- **Wer es sieht** (`blaetterWahl`): Biologie im Profil, ein geplanter Biologie-Test in den nächsten 60 Tagen (dann
  steht die Kachel ganz oben mit dem Test als Grund), eine Biologie-Einheit in den letzten 60 Tagen, und der
  Test-Schüler von „Spiele testen“. Eigene Kachel im Tab „Spiele“, kein Duell, kein Blockwerk.
- **Gezählt**: `bio.blaetter` (keine Fähigkeit aus dem Lehrplan); die Runden stehen wie alle in `spielrunden`.
- **Tablet**: Ansicht `blatt`; quer Bogen links, Frage rechts.

## Biolabor (Biologie, 4. Klasse)

niko 2026-11-23 mit Foto vom Buch (Expedition Biologie 4) und vom Teststoff einer Schülerin der 4D (Test am
26.11.): „Ich möchte ein Spiel daraus machen“, „Es soll ein neues Spiel werden“, mit Animationen und Bildern von
Higgsfield. Spiel `bio` (`lib/biolabor-inhalt.ts`, `lib/biolabor.ts`, `components/lernen/BioLabor.tsx`,
`biolabor.css`), ohne KI:

- **Labor-Mission** (niko 2026-11-23 „kein richtiges spiel“, Wahl „Kampf gegen Keime“): das Biolabor öffnet mit einer
  Karte. Jede Nummer vom Blatt der Lehrerin ist ein Level (25 Level, 18 gehört zu 19; `LEVELS`, `LEVEL_TITEL`,
  `levelEintraege`: zuerst die kurzen Fragen, am Schluss die Frage der Lehrerin selbst), in zwei Welten (Genetik ab 1,
  Nervensystem und Hormone ab 20; der Anfang jeder Welt ist immer offen, sonst öffnet ein Stern das nächste Level,
  `levelOffen`). In jedem Level steht ein Keim (Higgsfield, `public/spiele/biolabor/keim-*.webp`; 19 und 26 der Boss)
  mit Lebensbalken: jede richtige Antwort ist ein Treffer (beim ersten Versuch schnell oder in Serie: kritisch, mehr
  Punkte), jede falsche beim ersten Versuch kostet ein Herz, die Karte kommt wie sonst später noch einmal. Drei Herzen;
  sind sie weg, ist das Level verloren (Lösungen stehen am Ende). Sterne = übrige Herzen, auf dem Server aus den Fehlern
  beim ersten Versuch (`levelStand`, `bioLevelStand`); es zählt die beste Runde. Unter der Karte: Blockwerk,
  Lösungen zum Nachlesen, Andere Übungen.
- **Andere Übungen** (früher der Start, niko 2026-11-23 „zu viele Fragen“): Labor-Mission, Fragen der Lehrerin am
  Stück, Dein Glossar; alles aus dem Buch (Alles/Genetik/Der Mensch, Üben, Wie im Test, Kreuzungsschemata, Großer
  Test, Lernzettel, „Dein Labor“) steht zugeklappt unter „Mehr üben“.
- **Fragen der Lehrerin** (Thema `lehrerin`): der Fragenkatalog zum Test am 26.11.2026 (Fotos von niko), Fragen
  1–26 im Wortlaut der Lehrerin als Erklärfragen, dazu kurze Teilfragen zum Selbstschreiben (z. B. 12) Anzahl und n,
  14) Kind vertauscht → Paar 4, 15) Vaterschaftsausschluss → Fall 2, Stammbaum Blutgruppen, Karyogramm richtig/falsch)
  und Kreuzungsschemata für 14), 16) Erbsen und 17) Meerschweinchen. Eine Runde (12, wie im Test) geht der Reihe nach
  wie auf dem Blatt (`lehrerinReihe`): zuerst die zuletzt falschen, dann die noch nicht sicheren; oben steht
  „Frage 11 der Lehrerin“ (`lehrerNr`). Der Lernzettel des Themas hat die Lösung zu jeder Nummer.
- **Glossar aus dem Heft** (Thema `heft`): das handgeschriebene Glossar der Schülerin (Foto von niko), 23 Begriffe in
  ihren Worten, nur Rechtschreibung verbessert; dazu zwei Fragen zu dominant-rezessiv und intermediär.
- **Blockwerk** (niko 2026-11-23: „beim test kein ankreuzen … sie muss die antwort schreiben“): Knopf im Biolabor,
  `spiel?modus=bloecke&art=bio`. Nur Fragen zum Selbstschreiben (`schreibbar`) aus `BLOCK_THEMEN` (Fragen der
  Lehrerin und Glossar aus dem Heft), 10 je Runde (`bioRunde` mit `schreiben`). Die Frage liegt über dem Brett
  (`BioSchreibFeld.tsx`), geprüft wie „Wie im Test“ (`pruefeGeschrieben`); „fast“ zählt als richtig.
- **Stoff**: 19 Themen in zwei Bereichen, 542 Einträge (100 davon Fragen der Lehrerin). Zuerst nach dem Lehrplan geschrieben; am 2026-11-23 abends
  schickte niko die Buchseiten (S. 8–17 und 54–72), seither folgt alles dem Buch: seine Wörter zuerst
  („Elterngeneration (E)“, „1. Folgegeneration“, „Erscheinungsbild“, „sensorische Nerven“, „kurze Fortsätze“,
  „Nervenfaser“, „Endknöpfchen“, „Nachhirn“, „gleich wirksam“ statt kodominant, Rh/rh, Wunderblume rr × ww → rw),
  Fachwörter aus dem Unterricht gelten beim Schreiben auch (Mitose, Meiose, Dendrit, Axon, P-Generation). Genetik:
  Grundlagen, Glossar, Weitergabe der Erbinformation (Zellteilung, Geschlechtszellen, Trisomie 21), DNA und
  Chromosomen (A–T, C–G, Verdopplung, Mutation, Rot-Grün-Sehschwäche), Mendel’sche Regeln (mit Mendels Zahlen,
  Correns, 9 : 3 : 3 : 1, Kind-Aufgabe), Kreuzungsschemata, Vererbung beim Menschen (44 + XX, 22 + X, Blutgruppen,
  Rhesus, Augenfarbe), Gentechnik (Gentransfer, Insulin aus Bakterien, transgenes Schaf; die drei Zweige rot,
  grün, weiß stehen nicht auf den Buchseiten, aber im Teststoff), Gentechnik und Lebensmittel (Bt-Mais,
  Herbizidresistenz, Genome-Editing, Gesetz) und Biotechnik (Besamung, IVF, Embryonentransfer, Embryosplitting,
  Klonen, Stammzellen). Der Mensch: Nervensystem (Reiz-Reaktions-Schema, Nervenzelle), Gehirn (fünf Abschnitte,
  Rindenfelder), Rückenmark (Reflex), Lernen und Gedächtnis, unwillkürliches Nervensystem, Sympathikus und
  Parasympathikus (Organe wie in Abb. 4 des Buchs), Hormone (S. 18 lag nicht vor, bleibt nach dem Lehrplan). Je
  Thema ein Lernzettel (`merke`, nach den „Merke dir“-Kästen). Einträge: Fragen mit vier Kacheln (`wahl`, mit
  `schreib` auch zum Schreiben), Begriffe (`begriff`), Sympathikus oder Parasympathikus (`zuordnen`), Erklärfragen
  (`erklaeren`, viele nach den Aufgaben im Buch, nur „Wie im Test“, selbst bewertet) und 17 Kreuzungen (`kreuzung`).
- **Kreuzungsschema**: Eltern, Geschlechtszellen und das Quadrat (Zeilen Mutter, Spalten Vater). Feld antippen, Genotyp
  wählen, „Prüfen“. Beim Üben stehen die Keimzellen schon da, „wie im Test“ trägt man sie selbst ein; ihre
  Reihenfolge ist egal, „rR“ zählt wie „Rr“ (`pruefeSchema`). Danach eine Frage zum fertigen Schema („Wie viele
  Pflanzen der F2 blühen weiß?“). Dabei: dominant-rezessiv, intermediär (Wunderblume), Rückkreuzung, Geschlecht,
  Blutgruppen A/B/0 und Rhesus.
- **Modi**: Üben (10 Karten, Kacheln), Wie im Test (12, schreiben wie bei Blätter bestimmen), Kreuzungsschemata
  (nur das Thema `schema`), Großer Test (24, reihum aus allen Themen), Lernzettel (alle Merkzettel, zählt nicht).
  Oben Alles, Genetik oder Der Mensch; ein Thema in „Dein Labor“ antippen spielt nur dieses.
- **Fehler**: ein Blatt von unten mit der richtigen Antwort und einem Merksatz (`merkeFuer`: eigenes `merke`,
  sonst `MERKE` in `lib/biolabor.ts`, bei Begriffen die Erklärung, sonst der Satz vom Lernzettel des Themas mit den
  meisten gleichen Wörtern), die Karte kommt drei
  Karten später noch einmal (höchstens zweimal, nicht bei Erklärfragen). Zuletzt falsche kommen in der nächsten
  Runde zuerst. **Sicher** = zweimal hintereinander beim ersten Versuch richtig (`bioStand`).
- **Keine Animationen**: niko 2026-11-23 zu Deko-Szenen „helfen beim lernen nicht wirklich“, zu den danach gebauten
  Erklär-Animationen (11 SVG-Abläufe) „Die Animationen sind schlecht ich versteh gar nichts worum es ghet“. Beide
  wieder entfernt; das Spiel zeigt nur Frage, Antwort und Merksatz. Neue Bilder nur, wenn niko sie ausdrücklich will.
  Maskottchen Erbsi (ruhig, jubelt, denkt nach).
- **Bilder**: Higgsfield (gpt_image_2_6, etwa 11 Credits): Hintergrund, DNA (Kachel) und Erbsi, `public/spiele/biolabor/*.webp`.
- **Wer es sieht** (`bioWahl`): ein geplanter Biologie-Test in den nächsten 60 Tagen ab der 3. Klasse (Schulstufe
  7) oder mit Genetik/Nerven/Hormonen im Stoff (dann ganz oben, mit dem Test als Grund; Blätter bestimmen rückt
  dann nach unten), Biologie im Profil oder eine Biologie-Einheit ab der 3. Klasse, und der Test-Schüler.
- **Gezählt**: `bio.genetik-mensch`; Runden in `spielrunden`. **Tablet**: Ansicht `bio`.

## Bio Test 4.Klasse Vorbereitung De La Salle (Biologie)

niko 2026-11-23 mit 16 Bildern der Übungen einer Lehrkraft für den Biologie-Test eines anderen Schülers (nicht das
Biolabor): „ich möchte das du das alles einbaust als spiel für den bio test vorbereitung“, Name „Bio Test 4.Klasse
Vorbereitung De La Salle“. Spiel `biotest` (`lib/biotest-inhalt.ts`, `lib/biotest.ts`, `components/lernen/BioTest.tsx`,
`biotest.css`), ohne KI:

- **Stoff**: die 16 Übungen im Wortlaut der Lehrkraft (Überschrift, Auftrag, Schulbuchseite, Wortkasten, Text).
  Evolution des Menschen (S. 12–15): Mensch und Menschenaffen, Vorfahren, 3 Vertreter der Hominini (Tabelle mit
  Bildern), Out of Africa, Zuordnen. Nervensystem (S. 19–27): Reflex, Reiz-Reaktions-Schema, Einteilung nach Lage
  und nach Funktion, Nervenzelle beschriften, Funktionen der Bestandteile, Fachbegriffe 2 (selbst schreiben, wie
  „e _ _ ktr …“), Synapse beschriften, Vorgänge an der Synapse (Reihenfolge), Sympathicus-Lückentext, Sympathicus
  oder Parasympathicus (zwei Spalten).
- **Ausgedacht**: die Auswahllisten von Out of Africa, Reflex und Sympathicus waren auf den Bildern zu; die
  richtige Antwort ist die aus dem Schulbuch-Stoff, die falschen sind klar falsch. Unsicher ohne Buch: „etwa
  100 000“ Jahre, „Beringstraße“, „bis zu 120“ m/s, „Menschen und Tiere“, „die Tätigkeit“. Nervenzelle 5 und 6 nach
  den Linien im Bild: 5 Hüllzelle, 6 Axon.
- **Bilder**: aus den Bildern der Lehrkraft ausgeschnitten (`public/spiele/biotest/`), graue Felder durch blaue
  Nummern ersetzt. Die Grafik bleibt beim Scrollen oben, antippen macht sie groß.
- **Spielen**: Feld antippen (das nächste leere ist gewählt), unten Wort aus dem Wortkasten oder der Auswahlliste.
  Üben: sofort richtig/falsch, ein Fehler zeigt die Lösung und den Satz der Lehrkraft mit der Lösung (`satzMit`)
  oder einen kurzen Merksatz. Wie im Test: alles ausfüllen, „Abgeben“. Alle Übungen der Reihe nach, Meine Fehler
  (nur die zuletzt falschen Felder offen, der Rest eingetragen), Großer Test (alle 16 wie im Test). Keine Animationen.
- **Runde** = eine Übung (oder nur ihre Fehler), jede Stelle eine Karte `biotest:<übung>:<stelle>`; gezählt der
  erste Versuch. **Sicher** = zweimal hintereinander richtig.
- **Wer es sieht** (`biotestWahl`): Schule „De La Salle“ im Profil (`/la\s*salle/i`) und der Test-Schüler; mit einem
  geplanten Biologie-Test in 60 Tagen ganz oben (das Biolabor rückt dann nach unten).
- **Gezählt**: `bio.test-4-dls`; Runden in `spielrunden`. **Tablet**: Ansicht `biotest`.

## Europa (Länder, Hauptstädte, Flaggen)

niko 2026-11-22: „erstell ein geograpie spiel man soll länder und hauptstäde in europa lernen“, „es soll ganz europa
sein und vielleicht auch eine option mit flaggen“, dann „ja mach alles aber lass den Reise Modus weg“. Spiel `europa`
(`lib/europa.ts`, `components/lernen/EuropaSpiel.tsx`, `EuropaKarte.tsx`, `europa.css`), ohne KI:

- **Länder**: 47 (`LAENDER`, deutsche Namen, Hauptstadt, Lage als lon/lat, Region, Nachbarn, „auch“-Schreibweisen).
  Kosovo ist dabei, Nordzypern gehört zu Zypern, die Krim zur Ukraine. Regionen (Nord, West, Mitte, Süd, Südost, Ost)
  sind nur ein Filter.
- **Karte**: `lib/europa-karte.ts` ist erzeugt (`scripts/europa-karte.mjs`, Natural Earth 50m über world-atlas,
  konforme Kegelprojektion), nicht von Hand ändern. Ein SVG; Ziehen, zwei Finger und Mausrad zoomen, + / − / ganz.
  Kleine Länder (Andorra, Liechtenstein, Luxemburg, Malta, Monaco, San Marino, Vatikan) haben Tippkreise. Nach einem
  Fehler zoomt die Karte von selbst hin und bei der nächsten Frage wieder zurück, außer das Kind hat selbst gezoomt.
- **Flaggen**: `public/spiele/europa/flaggen/` aus flag-icons (MIT, `LIZENZ.txt`); mit Wappen als webp, sonst SVG.
- **Drei Teile je Land**: Lage, Hauptstadt, Flagge. Ein Land ist **erobert**, wenn alle drei sitzen (zweimal
  hintereinander beim ersten Versuch richtig, `europaStand`). Die Sammlungskarte färbt sich.
- **Fragen**: auf der Karte antippen, vier Kacheln, Flaggen wählen oder schreiben (ein Buchstabe daneben, bei langen
  Namen zwei, zählt mit „Fast!“; ein anderes Land oder eine andere Hauptstadt nie).
- **Arten**: Üben (8 Länder, Kacheln und Karte), Wie im Test (schreiben), Rennen (60 Sekunden, Länder / Hauptstädte /
  Flaggen, eigener Rekord), Verwechsler (die eigenen verwechselten Paare, sonst typische wie Slowakei/Slowenien, mit
  Merksatz), Großer Test (alle 47, mit Note: 90/80/65/50 %), Karte erkunden (zählt nicht).
- **Fehler**: Hilfe mit Lösung auf der Karte bzw. beiden Flaggen nebeneinander; die Karte kommt drei Karten später noch
  einmal (nicht im Großen Test und Rennen). Gezählt wird der erste Versuch.
- **Wer es sieht** (`europaWahl`): alle. Bei einem Geografie-/GW-Test in den nächsten 60 Tagen steht die Kachel oben.
- **Duell** (per Code und live, `europaDuellKarten`): 12 Länder, beide dieselben Karten im normalen Kachelfeld (ohne
  Karte zum Antippen): Hauptstadt („Die Hauptstadt von Belgien ist …“), Flagge (Bild über dem Satz, `SpielKarte.bild`)
  und Nachbarn („An Spanien und Andorra grenzt …“; nur wenn keine falsche Antwort auch an alle genannten grenzt).
  Europa ist das einzige Spiel mit eigenem Feld, das als Duell geht (`DUELL_ARTEN`).
- **Gezählt**: `geo.europa`. **Tablet**: Ansicht `europa`; quer Karte links, Frage rechts.

## Quiz je Fach (Mathe-Quiz, Deutsch-Quiz, Englisch-Quiz)

niko 2026-11-17: „spiele sind da was fehlt ist stoff“. Vorher hatten die meisten Themen des Lehrplans kein Spiel
(Mathe: 26 von 291 Themen). Das Quiz ist ein Themenspiel je Fach (`quizmathe`, `quizdeutsch`, `quizenglisch`,
lib/lernspiele-quiz.ts), ohne KI:

- **Fragen** stehen in lib/quiz/, eine Bank je Fach und Schulstufe (`mathe-vs.ts`, `mathe-unterstufe-zahlen.ts`,
  `mathe-unterstufe-geometrie.ts` …), der Schlüssel ist die Fähigkeit aus lib/themen. Ein Eintrag hat Text im Format
  der eigenen Spielkarten (`Frage = richtig | falsch`, `Merke:` darunter; ab einer Zeile `# schwer` Stufe 2) und/oder
  einen Erzeuger, der Rechenaufgaben mit typischen falschen Antworten würfelt (Bausteine in lib/quiz/hilfen.ts:
  Zahlen mit Komma, gekürzte Brüche). „=“ in einer Antwort schreibt man in der Bank als „＝“. Ein Erzeuger bringt mit
  demselben Thema immer dieselben 40 Karten, damit falsche wiederkommen.
- **Themen** sind die Fähigkeiten mit Fragen, in der Reihenfolge des Lehrplans, mit Schulstufe und Schularten aus
  lib/themen (eine HAK-Fähigkeit kommt nur bei HAK). Kein Thema hängt an zwei Spielen: was Kopfrechnen, Zahlenstrahl
  oder ein Deutsch-/Englisch-Spiel schon hat, bekommt kein Quiz.
- **Stoff**: eine Schularbeit, der aktuelle Stoff oder die letzte Einheit mit so einem Thema bringt das Quiz zuerst
  (`FUEHRT_ZU`), Blockwerk, Torlauf und Funkelfeld nehmen dann seine Fragen. Ohne Stoff kommt es „zum Üben“ mit dem
  nächsten Thema der Schulstufe; ab der 9. Schulstufe steht es vor den anderen Spielen des Fachs.
- **Antworten**: zwei werden gewischt, drei bis sechs sind Kacheln; Brüche und Hochzahlen stehen gesetzt da.
- **Stand 2026-11-17**: jedes Thema aus lib/themen hat ein Spiel, Mathe 291, Deutsch 139, Englisch 162 (Volksschule
  bis Oberstufe, auch HAK/HTL-Business und Technik). Deutsch und Englisch sind reine Textkarten
  (`deutsch-unterstufe.ts`, `deutsch-oberstufe-literatur.ts`, `deutsch-oberstufe-sprache.ts`, `englisch-unterstufe.ts`,
  `englisch-oberstufe-sprache.ts`, `englisch-oberstufe-schreiben.ts`). Gleiche Fragen in einem Thema zählen nur
  einmal, also braucht „Welcher Satz ist richtig?“ einen Zusatz.
- Ein Fach ohne Fragen hat kein Quiz. Der Test lib/lernspiele-quiz.test.ts liest jede Frage (keine Fehler, mindestens
  12 Karten je Thema, richtige Antwort dabei, Fach passt).

## Stilmittel (Deutsch)

niko 2026-11-17: „ich möchte ein spiel für deutsch um stilmittel zu üben. es sollen sätze kommen und man soll
auswählen was das für ein stilmittel ist“. Spiel `stilmittel` (lib/stilmittel.ts), Sätze von Hand in
lib/stilmittel-saetze.ts, ohne KI:

- **Karte**: ein Satz, die Stelle mit dem Stilmittel ist angestrichen (`mitte`; bei Anapher, Parallelismus, Chiasmus
  der ganze Satz), darunter vier Namen als Kacheln (`form: "kacheln"`), ein Tipp zählt sofort. Nach einem Fehler
  steht die Regel des Stilmittels da, mit der Wirkung („Hyperbel: eine starke Übertreibung … Wirkung: betont stark,
  oft komisch oder dramatisch.“). Die Wirkung im Satz üben die Karten „Welche Wirkung?“ im Deutsch-Quiz
  (Textinterpretation), weil eine Wirkung je Stilmittel ohne Text oft mehrdeutig wäre.
- **Schulstufe**: 1. Klasse Vergleich, Metapher, Personifikation, Lautmalerei, Alliteration; 2. Klasse dazu Hyperbel und
  rhetorische Frage; 3. Klasse Anapher, Ironie, Antithese, Klimax; 4. Klasse Parallelismus, Ellipse, Euphemismus,
  Oxymoron; ab der 5. Klasse (9. Schulstufe) dazu Chiasmus, Epipher, Litotes, Inversion, Synästhesie, Metonymie,
  Paradoxon, für die Textinterpretation auch Wiederholung, Aufzählung, Parataxe, Hypotaxe und Symbol (27). Falsche Antworten sind nur Stilmittel, die schon dran waren, bis zu zwei, die man gern verwechselt,
  dazu andere (damit man die Antwort nicht an den übrigen Kacheln erkennt).
- **Nie eine richtige als falsch**: was in einem Stilmittel meist mitsteckt (`auch`, z. B. Parallelismus bei der
  Anapher), was im Satz zusätzlich steckt (` || ` hinter dem Satz) und was man am Satz sieht (`siehtAus`: „wie“,
  Fragezeichen, gleiche Anlaute, gleiche Anfänge oder Enden der Satzteile, gleich lange Teile, ein Wort zweimal,
  Kommas mit „und“, ein Nebensatz oder mehrere Hauptsätze, Gegenstände wie Kerze oder Ring) kommt nie als falsche
  Kachel. Ein neuer Satz braucht genau ein eindeutiges Stilmittel; der Test lib/stilmittel.test.ts prüft Form und
  Kacheln je Schulstufe.
- **Lernstand**: Unterstufe für „Sprachliche Bilder“ (deutsch.literatur.sprachbilder), Oberstufe je Karte für ihre
  Gruppe (deutsch.os.stil.klang, .satzfiguren, .gedankenfiguren, .bilder). Eine Runde zählt je Fähigkeit ihrer Karten
  (`spielBelege`).
- **Stoff**: eine dieser Fähigkeiten (oder deutsch.os.stil.wirkung) in Schularbeit, aktuellem Stoff oder letzter
  Einheit bringt das Spiel zuerst; bei einer Gruppe der Oberstufe kommen 8 der 12 Karten aus ihr („Thema:
  Satzfiguren“). Ohne Stoff ab der 2. Klasse „zum Üben“, ab der 9. Schulstufe gleich nach dem Deutsch-Quiz.
- Wie jedes Spiel mit Kacheln auch als Endlos, Blockwerk, Funkelfeld, Torlauf (drei Tore) und im Duell (Stilmittel
  des Jüngeren).

## Meine Fehler (Fehlerprotokoll)

niko 2026-11-17, Punkt 5 des Plans zur Textinterpretation: das Fehlerprotokoll aus den eigenen Texten eines Schülers
(„Falsch | Richtig“ auf Papier), mit seiner Regel „eine Karte fliegt raus, wenn sie zweimal hintereinander richtig war“.
Spiel `fehler` (lib/fehlerprotokoll.ts, Text in lib/fehlerprotokoll-text.ts), ohne KI:

- **Schreiben**: beim Schüler unter Übungen › Fehlerprotokoll, eine Zeile ein Fehler: `falsch → richtig` (auch `->`
  oder `=>`), `Merke: …` darunter. Anführungszeichen außen fallen weg. Rechts steht gleich die Vorschau der Karten.
- **Karte**: was links und rechts gleich ist, bleibt stehen, der Unterschied ist die Lücke („Die Schule muss ___
  unterstützen“), gewischt wird zu „Kinder“ oder „Kindern“ (die richtige je Fehler fest links oder rechts). Nach einem
  Fehler steht der Merksatz da, ohne Merksatz „Richtig: … Nicht: …“. Ein Unterschied über 48 Zeichen hält das
  Speichern auf (dann zwei Zeilen schreiben).
- **Raus nach zweimal**: gezählt wird der erste Versuch je Karte in den beendeten Runden „Meine Fehler“ (auch Blockwerk,
  Torlauf, Endlos); ein Fehler setzt die Folge auf null. Geschaffte Fehler bleiben im Text und sind auf der Seite
  abgehakt; eine geänderte falsche Form ist ein neuer Fehler. Der Stand wird aus den Runden gerechnet, nicht gespeichert.
- **Vorschlag**: solange ein Fehler offen ist, steht „Meine Fehler“ ganz oben („Dein Fehlerprotokoll“, für die 5 Minuten
  am Anfang); sind alle geschafft, verschwindet das Spiel. Kein Duell (nur dieser Schüler hat die Karten). Die Runden
  zählen für `stoff.fehler`, keine Fähigkeit im Lernstand.

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
   Gliedsatz und Satzbau, Satzglieder → Satzbau, jede englische Zeit → English Tenses, jedes englische Grammatik-Thema → English Grammar, jedes Thema von Kopfrechnen → Kopfrechnen, jedes Thema von Zahlenstrahl → Zahlenstrahl, jedes Quiz-Thema → das Quiz des Fachs;
   Unterfähigkeiten zählen mit),
2. der aktuelle Stoff im Profil,
3. die letzte Einheit der letzten 14 Tage,
4. eine Spiel-Fähigkeit mit Lernstand unter 60 %,
5. sonst, wenn der Schüler Deutsch hat, die übrigen Deutsch-Spiele „zum Üben“, und mit Englisch die Vokabel-Paare
   (ab der 3. Schulstufe), English Tenses und English Grammar (ab der 5.) und die Irregular Verbs (ab der 6.), mit
   Mathematik „Kopfrechnen“, das Mathe-Quiz und „Zahlenstrahl“ (ab der 9. Schulstufe das Quiz zuerst).

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

## Spiele testen (Lehrer und Verwaltung)

niko 2026-11-17: „wie kann ich als Lehrer und Verwalter Spiele spielen und testen“. **Mehr › Spiele testen**
(`/mehr/spiele-testen`, für jede Lehrkraft): Klasse wählen, „Spiele öffnen“, und es geht der Tab „Spiele“ der
Schüler-App auf, mit einem eigenen Test-Schüler der Lehrkraft („Niko Test“, `students.spiele_test` = Lehrer-ID,
lib/spiele-testen.ts). Er hat immer Mathematik, Deutsch und Englisch und die gewählte Klasse.

Damit nichts zählt: Er steht in keiner Liste (`listStudents`, Planung, Export, `hasData`), hat keine Lehrkraft
(`teacher_id` leer, zählt beim Löschen eines Lehrers nicht als Verlauf), und Liga und Duelle sind aus
(`wettspiel = 'nein'`): Kinder sehen ihn nie in Bestenliste oder Wochenliga, er sieht sich dort als „Du“. Oben in
der Schüler-App steht „Testmodus: zählt bei keinem Schüler“ mit „Zurück“. „Spielstand löschen“ löscht seine
Spielrunden (Rekorde, Serie, Endlos-Stände). Duelle lassen sich so nicht testen.

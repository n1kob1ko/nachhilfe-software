/**
 * Kurzgeschichten für die Textinterpretation (niko 2026-11-17, Punkt 6 des Plans: „Jede Woche eine neue Kurzgeschichte:
 * lesen mit Methode, Verständnisfragen mündlich beantworten“). Alle Geschichten sind für DreamStudy geschrieben, Autoren
 * und Jahre sind erfunden; nichts stammt aus Schulbüchern, Matura-Material oder veröffentlichter Literatur.
 *
 * Jede Geschichte hat die Merkmale der Kurzgeschichte (unmittelbarer Einstieg, Alltag, Wendepunkt, wenige Figuren,
 * offenes Ende), eine andere Erzählform (Er personal, Ich, Wir, auktorial) und Stellen für Operator 2 (Stilmittel) und
 * Operator 3 (Deuten). Die Antworten auf den Fragenkatalog sind Musterantworten für die Lehrkraft, mit Zitat und Zeile;
 * lib/kurzgeschichten.test.ts prüft jedes Zitat an der Geschichte.
 *
 * Im Schreibauftrag wählt die Lehrkraft eine Geschichte aus der Sammlung. Beim Lesen sieht der Schüler neben dem Text die
 * Lesemethode und die Fragen, die Lehrkraft dazu die Musterantworten (lib/schreibauftrag-store.ts `auftragView`).
 */
import { BEISPIEL_AUTORIN, BEISPIEL_GESCHICHTE, BEISPIEL_JAHR, BEISPIEL_TITEL } from "./textinterpretation-beispiel";

/** Die Lesemethode in vier Schritten (aus dem Überblick der Lehrkraft). */
export const LESEMETHODE = [
  "Zuerst Aufgabenstellung und Titel lesen.",
  "1. Durchgang ganz durch, danach in 2 Sätzen sagen: Wer? Was passiert am Ende?",
  "2. Durchgang: Randnotizen pro Absatz (3–5 Wörter) und Stellen für OP2 / OP3 markieren.",
  "Lange Sätze zerlegen: Wer tut was?",
] as const;

export const FRAGE_KEYS = ["wer", "ende", "thema", "titel", "figur", "wendepunkt", "symbol", "sprache", "erzaehler", "offen"] as const;
export type FrageKey = (typeof FRAGE_KEYS)[number];

/** Die Verständnisfragen: zuerst die beiden nach dem 1. Durchgang, dann der Fragenkatalog zum Ideenfinden. */
export const FRAGEN: Record<FrageKey, string> = {
  wer: "Wer kommt vor?",
  ende: "Was passiert am Ende?",
  thema: "Worum geht es? Sag die Thematik in einem Satz.",
  titel: "Warum heißt der Text so?",
  figur: "Wie ist die Hauptfigur am Anfang, wie am Ende?",
  wendepunkt: "Wo kippt es? Nenn die Zeile.",
  symbol: "Welcher Gegenstand kommt öfter vor, und wofür steht er?",
  sprache: "Was fällt an der Sprache auf: kurze Sätze, Wiederholungen, direkte Rede?",
  erzaehler: "Wer erzählt, und was erfahren wir nicht?",
  offen: "Ist das Ende offen oder geschlossen?",
};

export type Kurzgeschichte = {
  id: string;
  titel: string;
  autor: string;
  jahr: string;
  /** eine Zeile ist eine Zeile auf dem Blatt (wie im Schreibauftrag) */
  text: string;
  /** worum es geht, für die Liste der Lehrkraft (verrät das Ende nicht) */
  kurz: string;
  antworten: Record<FrageKey, string>;
};

export const KURZGESCHICHTEN: Kurzgeschichte[] = [
  {
    id: "sieben-uhr-zwoelf",
    titel: BEISPIEL_TITEL,
    autor: BEISPIEL_AUTORIN,
    jahr: BEISPIEL_JAHR,
    text: BEISPIEL_GESCHICHTE,
    kurz: "Ein alter Mann wartet jeden Morgen auf einen Bus, der nicht mehr fährt. Eine junge Frau kommt dazu.",
    antworten: {
      wer: "Ein alter Mann, der früher in einem Amt gearbeitet hat, und eine junge Frau, die zu einem Vorstellungsgespräch muss. Beide haben keinen Namen.",
      ende: "Am nächsten Morgen wartet die junge Frau schon an der Haltestelle. „Um sieben Uhr zwölf stehen zwei an der Haltestelle.“ (Z. 68)",
      thema: "Es geht um die Einsamkeit alter Menschen auf dem Land und um Nähe, die trotzdem entstehen kann.",
      titel: "Sieben Uhr zwölf ist die Abfahrtszeit des Busses, der nicht mehr fährt. Am Ende ist es die Zeit, zu der sich zwei Menschen treffen.",
      figur: "Am Anfang wartet der Alte allein und stur, „Er wartet. Die Straße bleibt leer.“ (Z. 24) Am Ende ist er nicht mehr allein.",
      wendepunkt: "Die junge Frau kommt den Hang herunter (Z. 25) und fragt nach dem Bus. Ab da erzählt der Alte von seinem Leben.",
      symbol: "Der Bus und der Zettel an der Glaswand. Der Zettel spricht kühl von „rückläufiger Fahrgastzahlen“ (Z. 6), der Bus steht für die Verbindung zur Welt.",
      sprache: "Der Dialekt „I wort auf'n Bus“ (Z. 31) und alte Wörter wie „Billett“ (Z. 22) zeigen, dass der Alte in der Vergangenheit lebt. Die Anapher „Jeden Morgen“ (Z. 11–13) betont die gleichförmigen Tage.",
      erzaehler: "Ein Er-Erzähler im Präsens. Wir erfahren nicht, ob die junge Frau die Stelle bekommen hat und warum sie am Ende wieder da ist.",
      offen: "Offen: Der Bus kommt nicht zurück, aber der Alte wartet nicht mehr allein. Was aus den beiden wird, bleibt offen.",
    },
  },
  {
    id: "die-jacke",
    titel: "Die Jacke",
    autor: "Paul Wiesinger",
    jahr: "2025",
    text: `Die Jacke ist ihm zu groß. Das merkt er schon im Bus,
als er nach der Haltestange greift und der Ärmel bis über
die Fingerknöchel rutscht. Er schiebt ihn zurück. Er rutscht wieder.
Es ist eine schwarze Arbeitsjacke mit vielen Taschen, und auf
der Brust steht in weißer Schrift der Name einer Firma,
die es nicht mehr gibt. Sein Bruder hat sie drei Jahre lang
getragen, jeden Tag, auch am Sonntag, auch im Sommer.
Die Mutter hat sie gewaschen und gebügelt, obwohl man eine
Arbeitsjacke nicht bügelt. Dann hat sie sie aufs Bett gelegt,
gestern Abend, ohne etwas zu sagen.
In der Werkstatt riecht es nach Öl und kaltem Metall.
Zwölf neue Lehrlinge stehen in einer Reihe vor den Werkbänken.
Die anderen tragen blaue Overalls, die noch Falten von der
Verpackung haben. Er ist der Einzige in Schwarz.
Der Meister geht die Reihe entlang und liest die Namen von
einer Liste. Bei jedem Namen hebt einer die Hand. Bei seinem
Namen bleibt der Meister stehen und schaut ihn länger an
als die anderen. „Du bist der Bruder“, sagt er. Es ist keine Frage.
Er nickt. Der Meister nickt auch. Dann geht er weiter.
Am Vormittag lernen sie, wie man eine Feile hält.
Er hält sie richtig, beim ersten Mal. Der Meister sagt nichts,
aber er bleibt hinter ihm stehen, bis er fertig ist.
In der Pause sitzen die anderen auf der Laderampe und reden
über Mopeds und über ein Mädchen aus der Berufsschule.
Einer fragt ihn, ob sein Bruder wirklich hier gearbeitet hat.
Einer fragt, ob es stimmt, was man sich erzählt.
Einer fragt gar nichts und schaut nur auf die Jacke.
Er sagt, er wisse es nicht. Das ist gelogen.
Er weiß, wie das Auto ausgesehen hat, danach. Er weiß,
dass die Straße nass war und dass sein Bruder zu schnell
gefahren ist, weil er nach der Spätschicht noch zu einem Fest
wollte. Er weiß, dass die Jacke auf dem Rücksitz gelegen ist.
Am Nachmittag soll jeder ein Werkstück anfangen, einen
Winkel aus Stahl, auf den Zehntelmillimeter genau.
Er misst. Er feilt. Er misst wieder. Der Ärmel rutscht.
Er krempelt ihn zweimal um, dann dreimal. Jetzt hält er.
Kurz vor Schluss kommt der Meister an seine Werkbank und
nimmt den Winkel in die Hand. Er hält ihn gegen das Licht.
„Dein Bruder hat am ersten Tag einen schiefen gemacht“, sagt er.
„Ganz schief. Ich hab ihn heute noch.“ Er legt den Winkel zurück.
Dann zeigt er auf die Jacke. „Die ist dir zu groß.“
„Ich weiß“, sagt er.
„Im Lager gibt es blaue. In deiner Größe.“
Er schaut auf den Schriftzug auf seiner Brust, auf die Ärmel,
auf seine Hände, die schwarz sind vom Metallstaub.
„Morgen vielleicht“, sagt er.
Der Meister geht. Die anderen packen ihre Sachen zusammen.
Er bleibt noch an der Werkbank stehen und feilt an einer Kante,
an der nichts mehr zu feilen ist.
Im Bus nach Hause hält er sich an der Stange fest.
Der Ärmel bleibt, wo er ist.`,
    kurz: "Ein Lehrling beginnt in der Werkstatt, in der sein verunglückter Bruder gearbeitet hat, und trägt dessen Jacke.",
    antworten: {
      wer: "Ein junger Lehrling ohne Namen, sein Meister und die anderen neuen Lehrlinge. Der Bruder und die Mutter kommen nur in seinen Gedanken vor.",
      ende: "Der Meister bietet ihm eine passende blaue Jacke an, doch er sagt nur „Morgen vielleicht“ (Z. 46) und fährt in der Jacke des Bruders nach Hause.",
      thema: "Es geht um Trauer und um die Frage, wie man seinen eigenen Platz findet, wenn man im Schatten eines anderen steht.",
      titel: "Die Jacke des Bruders steht für die Erinnerung und für die Rolle, die der Junge übernimmt. Sie „ist ihm zu groß“ (Z. 1), so wie diese Rolle.",
      figur: "Am Anfang ist er unsicher und allein, er ist „der Einzige in Schwarz“ (Z. 14). Am Ende hat er den Ärmel umgekrempelt, „Jetzt hält er“ (Z. 36): Er macht sich die Jacke langsam zu eigen.",
      wendepunkt: "Der Meister erzählt, dass auch der Bruder „am ersten Tag einen schiefen gemacht“ (Z. 39) hat. Ab da ist der Bruder nicht nur ein Vorbild, sondern ein Mensch, der auch Fehler gemacht hat.",
      symbol: "Die Jacke und der Ärmel. Am Anfang rutscht der Ärmel immer wieder (Z. 3, 35), am Ende heißt es: „Der Ärmel bleibt, wo er ist.“ (Z. 51)",
      sprache: "Kurze Hauptsätze wie „Er misst. Er feilt. Er misst wieder.“ (Z. 35) zeigen seine Konzentration. Die Anapher „Einer fragt“ (Z. 25–27) und die Wiederholung „Er weiß“ (Z. 29–32) machen deutlich, wie sehr ihn die Fragen bedrängen.",
      erzaehler: "Ein Er-Erzähler erzählt personal aus der Sicht des Jungen. Wir erfahren nie seinen Namen und nur in Andeutungen, was mit dem Bruder passiert ist (Z. 29–32).",
      offen: "Offen: Wir wissen nicht, ob er morgen die blaue Jacke nimmt. Das „vielleicht“ (Z. 46) lässt beides zu.",
    },
  },
  {
    id: "funkstille",
    titel: "Funkstille",
    autor: "Mira Lehner",
    jahr: "2024",
    text: `Hinter der Mautstelle verschwindet der letzte Balken.
Ich halte das Handy zum Fenster, dann an die Decke, dann
zwischen die Knie. Nichts. Kein Netz, steht da, als wäre das
eine Auskunft über mich.
Papa fährt. Er fährt immer, auch wenn Mama dabei ist, und
heute ist Mama nicht dabei. Heute bringt er mich ins Internat,
vier Stunden hin, und dann fährt er vier Stunden allein zurück.
Das Radio rauscht. Er dreht es ab.
„Kommt wieder“, sagt er. „Nach dem Tunnel.“
Ich weiß nicht, ob er das Radio meint oder das Netz.
Draußen ziehen Felder vorbei, dann ein Lagerhaus, dann
wieder Felder. Ich zähle die Windräder. Bei elf höre ich auf.
Papa räuspert sich. Er räuspert sich immer, bevor er etwas
sagt, und meistens sagt er dann doch nichts.
Diesmal sagt er: „Hast du die Ladekabel?“
„Ja.“
„Beide?“
„Ja, Papa.“
Er nickt, als hätte er eine wichtige Sache erledigt.
Zu Hause schreiben wir uns. Er schickt mir Fotos vom Garten,
von einer Tomate, die größer ist als die anderen, vom Hund
mit Sonnenbrille. Ich schicke einen Daumen. Manchmal zwei.
Wenn wir im selben Zimmer sind, schaut jeder auf seinen Bildschirm,
und es ist trotzdem gemütlich, irgendwie.
Dann kommt der Tunnel. Er ist lang, viel länger, als ich
gedacht habe, und das Licht ist orange und macht unsere
Gesichter krank. Papa fährt langsamer als erlaubt.
„Ich muss dir was sagen“, sagt er in den Tunnel hinein.
Ich schaue auf das Handy. Kein Netz.
„Ich bin seit März nicht mehr in der Firma.“
Die Lampen an der Decke kommen auf uns zu, eine nach der anderen,
eine nach der anderen, eine nach der anderen.
„Seit März“, sage ich.
„Ich bin jeden Tag losgefahren. Um halb sieben. Wie immer.“
„Und wohin?“
„Überallhin. Zum See. Zum Baumarkt. Einmal bis Salzburg.“
Er lacht kurz, aber es klingt nicht wie ein Lachen.
„Weiß es die Mama?“
„Seit gestern.“
Ich denke an die Fotos. An die Tomate, an den Hund. An den
Garten am Vormittag, wenn alle anderen in der Arbeit sind.
Ich habe nie gefragt, warum er am Dienstag um zehn Uhr
Fotos vom Garten schickt.
Am Ende des Tunnels wird es hell, so hell, dass ich die Augen
zukneife. Das Handy vibriert in meinem Schoß. Einmal, zweimal,
dann ohne Pause. Nachrichten, die gewartet haben.
Papa schaut auf die Straße. Er wartet, dass ich nachschaue.
Ich lasse das Handy liegen, mit dem Bildschirm nach unten.
„Und jetzt?“, frage ich.
Er zuckt mit den Schultern und schaltet das Radio wieder ein.
Es ist ein Lied, das wir beide nicht kennen.
Wir hören es trotzdem bis zum Ende.`,
    kurz: "Auf der Fahrt ins Internat erzählt ein Vater seiner Tochter im Tunnel, dass er seit Monaten keine Arbeit mehr hat.",
    antworten: {
      wer: "Die Ich-Erzählerin, ein Mädchen auf dem Weg ins Internat, und ihr Vater, der fährt. Die Mutter kommt nur im Gespräch vor.",
      ende: "Das Handy hat wieder Netz, aber die Tochter lässt es liegen (Z. 48). Sie hört mit dem Vater ein Lied bis zum Ende.",
      thema: "Es geht um Sprachlosigkeit in der Familie und um die Frage, ob ständige Nachrichten echte Gespräche ersetzen können.",
      titel: "„Funkstille“ meint das fehlende Netz im Tunnel, aber auch das Schweigen zwischen Vater und Tochter. Erst als das Handy nichts mehr empfängt, reden die beiden wirklich.",
      figur: "Am Anfang hält die Tochter das Handy „zum Fenster, dann an die Decke“ (Z. 2) und sucht Netz. Am Ende lässt sie es „mit dem Bildschirm nach unten“ (Z. 48) liegen und wendet sich dem Vater zu.",
      wendepunkt: "Im Tunnel sagt der Vater: „Ich bin seit März nicht mehr in der Firma.“ (Z. 30) Ab da sieht die Tochter die Fotos vom Garten mit anderen Augen (Z. 40–43).",
      symbol: "Das Handy und das Netz. „Kein Netz“ (Z. 3, 29) steht für das fehlende Gespräch. Der Tunnel ist der Ort, an dem die Wahrheit herauskommt, am Ende wird es „so hell, dass ich die Augen zukneife“ (Z. 44f.).",
      sprache: "Viele kurze Sätze und knappe Dialoge wie „Beide?“ (Z. 17) zeigen, wie wenig die beiden sonst reden. Die Wiederholung „eine nach der anderen“ (Z. 31f.) macht die lange Fahrt durch den Tunnel und die Spannung spürbar.",
      erzaehler: "Eine Ich-Erzählerin erzählt im Präsens. Wir erfahren nicht, warum der Vater die Arbeit verloren hat und wie die Mutter reagiert hat.",
      offen: "Offen: Auf die Frage „Und jetzt?“ (Z. 49) gibt es keine Antwort. Das gemeinsame Lied zeigt aber, dass die beiden einander näher sind.",
    },
  },
  {
    id: "kleingeld",
    titel: "Kleingeld",
    autor: "Theresa Krall",
    jahr: "2026",
    text: `Um halb sechs ist die Schlange an Kasse drei am längsten.
Die Leute kommen aus der Arbeit und wollen nach Hause,
und jeder glaubt, dass die anderen Kassen schneller sind.
Sie zieht Milch über den Scanner, Brot, eine Packung Nudeln,
Bananen, die man abwiegen muss. Piep. Piep. Piep.
Sie sagt „Grüß Gott“ und „Sammeln Sie Punkte?“ und „Schönen Abend“,
vierhundert Mal am Tag, bis die Wörter nichts mehr wiegen.
Die Frau im grünen Mantel legt nur wenig auf das Band.
Eine Packung Reis. Zwei Dosen Tomaten. Ein Glas Honig.
Ein kleiner Bub steht neben ihr und hält sich am Mantel fest.
„Neun Euro achtzig“, sagt die Kassiererin.
Die Frau öffnet ihre Geldbörse und schüttet sie auf die Hand.
Münzen, nur Münzen. Sie beginnt zu zählen, halblaut,
zwei, zwei fünfzig, drei, und die Münzen klingen auf dem
Teller wie ein Uhrwerk, das zu langsam geht.
Hinter ihr seufzt ein Mann im Anzug. Hinter dem Mann
seufzt eine Frau mit einem Einkaufswagen voller Getränke.
Die Schlange seufzt.
„Acht Euro zwanzig“, sagt die Frau im grünen Mantel.
Sie schaut auf das Band, nicht auf die Kassiererin.
„Dann den Honig nicht.“
Der Bub sagt nichts. Er lässt den Mantel los.
Die Kassiererin hat den Storno-Schlüssel schon in der Hand.
So geht das. Man dreht den Schlüssel, man drückt eine Taste,
man legt den Honig in die Kiste unter der Kasse. Es dauert
vier Sekunden, und niemand schaut hin. Sie hat es oft gemacht.
Diesmal dreht sie den Schlüssel nicht.
Sie greift in die Tasche ihrer Kittelschürze, wo das
Kleingeld für den Kaffee in der Pause liegt.
Ein Euro, fünfzig Cent, zehn, zehn, zehn.
Sie legt es zu den Münzen der Frau auf den Teller.
„Passt schon“, sagt sie und schiebt den Honig weiter.
Die Frau hebt den Blick. Zum ersten Mal schaut sie die
Kassiererin an. Sie sagt nicht danke. Sie sagt gar nichts.
Sie packt die Dosen ein, den Reis, den Honig zuletzt,
ganz oben, damit er nicht zerdrückt wird. Dann nimmt sie
den Buben an der Hand und geht.
„Geht's jetzt endlich weiter?“, fragt der Mann im Anzug.
Die Kassiererin zieht seine Flasche Wein über den Scanner.
Piep. „Sammeln Sie Punkte?“
Er sammelt keine Punkte.
In der Pause steht sie vor dem Kaffeeautomaten im Lager und
sucht in der Kittelschürze nach Münzen, obwohl sie weiß,
dass keine mehr da sind. Die Kollegin von Kasse fünf fragt,
ob sie ihr einen ausgeben soll.
„Nein“, sagt sie. „Ich hab heute schon einen gehabt.“
Durch das kleine Fenster im Lager sieht man den Parkplatz.
Die Laternen gehen an. Irgendwo da draußen trägt jemand
ein Glas Honig nach Hause, ganz oben in der Tasche.
Sie weiß nicht, ob sie das richtig gemacht hat.
Morgen wird die Schlange um halb sechs wieder am längsten sein.`,
    kurz: "Eine Kassiererin bezahlt einer armen Frau heimlich ein Glas Honig, statt es wie sonst zu stornieren.",
    antworten: {
      wer: "Eine Kassiererin ohne Namen, eine Frau im grünen Mantel mit einem kleinen Buben, ein ungeduldiger Mann im Anzug und eine Kollegin.",
      ende: "Die Kassiererin hat kein Geld mehr für ihren Kaffee und lügt die Kollegin an: „Ich hab heute schon einen gehabt.“ (Z. 46) Sie weiß nicht, ob es richtig war.",
      thema: "Es geht um Armut, um Scham und um kleine Gesten der Menschlichkeit im anonymen Alltag.",
      titel: "„Kleingeld“ meint die Münzen der Frau (Z. 13) und das Kaffeegeld der Kassiererin (Z. 29). Es ist wenig Geld, aber es macht für beide einen großen Unterschied.",
      figur: "Am Anfang arbeitet die Kassiererin wie eine Maschine, sie sagt ihre Sätze „vierhundert Mal am Tag“ (Z. 7). Am Ende handelt sie gegen die Routine und denkt über ihr Handeln nach (Z. 50).",
      wendepunkt: "„Diesmal dreht sie den Schlüssel nicht.“ (Z. 27) Die Kassiererin bricht mit der Routine und hilft.",
      symbol: "Der Honig steht für ein bisschen Süße und Würde, die sich die Frau eigentlich nicht leisten kann. Am Ende trägt ihn jemand „ganz oben in der Tasche“ (Z. 49) nach Hause.",
      sprache: "Die Lautmalerei „Piep. Piep. Piep.“ (Z. 5) zeigt die Eintönigkeit der Arbeit. Der Vergleich „wie ein Uhrwerk, das zu langsam geht“ (Z. 15) macht das Warten spürbar, und „Die Schlange seufzt.“ (Z. 18) zeigt den Druck der Wartenden.",
      erzaehler: "Ein Er/Sie-Erzähler erzählt personal aus der Sicht der Kassiererin. Wir erfahren nicht, warum die Frau so wenig Geld hat und was sie denkt, denn „Sie sagt gar nichts.“ (Z. 34)",
      offen: "Offen: „Sie weiß nicht, ob sie das richtig gemacht hat.“ (Z. 50) Der letzte Satz zeigt, dass morgen alles wieder gleich weitergeht.",
    },
  },
  {
    id: "das-klassenfoto",
    titel: "Das Klassenfoto",
    autor: "Anton Haberl",
    jahr: "2025",
    text: `Das Foto hängt seit Juni im Gang neben dem Konferenzzimmer.
Wir stehen in drei Reihen auf der Stiege vor der Schule,
die Großen hinten, die Kleinen vorne, und alle lachen,
weil der Fotograf „Spaghetti“ gesagt hat und nicht „Cheese“.
Unter dem Foto steht: 4B, Abschlussjahrgang. Und darunter
stehen unsere Namen, in der Reihenfolge, in der wir stehen.
Wir gehen jeden Tag daran vorbei. Wir schauen nicht mehr hin.
Man schaut nicht auf etwas, in dem man selbst schon drin ist.
Im Oktober bleibt Hannah davor stehen. Sie ist neu, sie
war im Juni noch nicht da, für sie ist das Foto noch ein Bild
und keine Wand. „Wer ist das?“, fragt sie und zeigt auf die
letzte Reihe, ganz rechts. Dort steht niemand.
Dort ist nur ein Stück Mauer und ein Fenster und die Ecke
einer Regenrinne. Aber unter dem Foto, ganz rechts in der
letzten Reihe, steht ein Name, der zu niemandem gehört.
Wir lesen ihn. Wir kennen ihn natürlich.
Er ist im Februar weggegangen. Oder im März, das weiß
keiner mehr so genau. Er hat in der letzten Bank gesessen
und meistens die Kapuze aufgehabt, auch im Turnsaal, und
wenn ihn ein Lehrer etwas gefragt hat, hat er die Schultern
gehoben, so langsam, dass man zuschauen konnte.
Wir haben ihn nicht gemocht und nicht nicht gemocht.
Er war einfach da, so wie die Regenrinne da ist.
Und dann war er nicht mehr da, und das haben wir auch
erst gemerkt, als der Platz in der letzten Bank frei blieb
und Jonas seine Sporttasche hingestellt hat.
„Warum steht sein Name da, wenn er gar nicht drauf ist?“,
fragt Hannah.
Wir wissen es nicht. Vielleicht hat die Sekretärin die alte
Liste genommen. Vielleicht hat niemand daran gedacht, ihn
zu streichen. Vielleicht war es Absicht.
Wir zucken mit den Schultern. Langsam.
Am nächsten Tag sind wir früher in der Schule als sonst.
Wir stehen vor dem Foto, alle, auch die, die sonst immer
zu spät kommen. Wir suchen ihn. Wir suchen in den Fenstern,
hinter den Köpfen, in den Schatten auf der Stiege.
Wir finden ihn nicht. Wir finden nur die Mauer und die
Regenrinne und unser Lachen über die Spaghetti.
Jemand sagt, man könnte ihm schreiben. Jemand sagt, keiner
hat seine Nummer. Jemand sagt, er hätte ja auch schreiben können.
Dann läutet es zur ersten Stunde, und wir gehen hinein.
Hannah bleibt noch kurz stehen. Dann holt sie einen Bleistift
aus ihrem Federpennal und schreibt etwas an den Rand des Fotos,
ganz rechts, in die letzte Reihe, so klein, dass man es
nur sieht, wenn man stehen bleibt.
Wir haben bis heute nicht nachgeschaut, was es ist.`,
    kurz: "Eine Klasse merkt erst durch eine neue Mitschülerin, dass auf dem Abschlussfoto ein Schüler fehlt, der im Frühling gegangen ist.",
    antworten: {
      wer: "Die Klasse, die in der Wir-Form erzählt, die neue Schülerin Hannah und ein Mitschüler, der die Schule verlassen hat und dessen Namen wir nie erfahren.",
      ende: "Hannah schreibt etwas an den Rand des Fotos, wo der Mitschüler fehlt. Die Klasse hat „bis heute nicht nachgeschaut, was es ist“ (Z. 46).",
      thema: "Es geht um Gleichgültigkeit und Ausgrenzung: Ein Mensch verschwindet aus einer Gemeinschaft, und niemand bemerkt es.",
      titel: "Das Klassenfoto soll alle zeigen, die dazugehören. Gerade auf ihm sieht man, wer fehlt: Unter dem Foto „steht ein Name, der zu niemandem gehört“ (Z. 15).",
      figur: "Am Anfang schauen die Schüler „nicht mehr hin“ (Z. 7). Am Ende suchen sie den Mitschüler auf dem Foto (Z. 35f.), tun aber trotzdem nichts.",
      wendepunkt: "Hannah fragt: „Wer ist das?“ (Z. 11) Erst durch den Blick von außen fällt der Klasse die Lücke auf.",
      symbol: "Die leere Stelle auf dem Foto und die Regenrinne. Der Mitschüler „war einfach da, so wie die Regenrinne da ist“ (Z. 23): unbeachtet, wie ein Teil der Mauer.",
      sprache: "Die doppelte Verneinung „nicht gemocht und nicht nicht gemocht“ (Z. 22) zeigt die Gleichgültigkeit. Die Anapher „Jemand sagt“ (Z. 39f.) macht deutlich, dass alle reden, aber keiner handelt.",
      erzaehler: "Ein Wir-Erzähler, also die Klasse selbst. Wir erfahren nicht, warum der Schüler gegangen ist, wie er heißt und was Hannah schreibt.",
      offen: "Offen: Was am Rand des Fotos steht, bleibt ein Geheimnis. Der letzte Satz zeigt, dass die Klasse wieder wegschaut.",
    },
  },
  {
    id: "glatteis",
    titel: "Glatteis",
    autor: "Jakob Sternthal",
    jahr: "2026",
    text: `Um sieben Uhr achtundzwanzig rutscht der alte Mann aus.
Es geht ganz schnell. Eben ist er noch vor ihm hergegangen,
mit kleinen Schritten, die Einkaufstasche in der linken Hand,
und jetzt liegt er auf dem Gehsteig, auf der Seite, wie ein
Sack, den jemand vom Lastwagen geworfen hat.
Die Tasche ist aufgegangen. Orangen rollen über das Eis,
langsam, leuchtend, bis in den Rinnstein.
Er bleibt stehen. Das heißt: Seine Füße bleiben stehen.
Der Rest von ihm ist schon weiter, schon beim Bus um sieben
Uhr einunddreißig, schon in der Halle, schon beim Chef,
der um sieben Uhr fünfundvierzig auf die Uhr schaut und
nichts sagt, weil er nichts sagen muss. Zweimal zu spät
im Probemonat, hat er gesagt, und du kannst gehen.
Er war schon einmal zu spät.
Eine Frau mit Kinderwagen geht vorbei. Sie schaut hin.
Sie schaut weg. Sie geht weiter. Ein Mann mit Kopfhörern
macht einen Bogen um die Orangen, als wären sie gefährlich.
Ein Lieferwagen hupt, weil jemand auf der Straße steht.
Der alte Mann versucht aufzustehen. Er stützt sich auf
den Ellbogen und sinkt wieder zurück. Er sagt etwas, aber
es ist so leise, dass es im Verkehr verschwindet.
Das Handy in seiner Jackentasche vibriert. Der Wecker,
den er sich gestellt hat, damit er den Bus nicht verpasst.
Er hat noch drei Minuten. Wenn er jetzt läuft, schafft er es.
Er weiß das. Er hat es ausgerechnet, jeden Morgen, seit
drei Wochen, auf die Sekunde.
Dann kniet er sich hin.
Das Eis ist kalt durch die Jeans. Er fragt, ob alles in
Ordnung ist, und weiß, dass das eine dumme Frage ist.
Der alte Mann schaut ihn an, als hätte er ihn erwartet.
„Die Hüfte“, sagt er. „Ich glaub, es ist die Hüfte.“
Er ruft die Rettung an. Er sagt die Adresse zweimal,
weil seine Stimme beim ersten Mal nicht funktioniert.
Dann zieht er seine Jacke aus und legt sie unter den Kopf
des alten Mannes. Dann sammelt er die Orangen ein.
Es sind sieben. Eine ist im Rinnstein aufgeplatzt.
Der Bus um sieben Uhr einunddreißig fährt vorbei. Er sieht
ihn nicht kommen, er hört ihn nur, und dann sieht er ihn
fahren, die gelben Lichter, die im Nebel kleiner werden.
Der alte Mann hält eine Orange in der Hand, die aufgeplatzte.
„Die gehört Ihnen“, sagt er. „Für den Weg.“
Die Rettung kommt nach elf Minuten. Er hat sie nicht gezählt.
Als sie den alten Mann auf die Trage heben, fragt die
Sanitäterin, ob er ein Angehöriger sei.
„Nein“, sagt er. Und nach einer Weile: „Ich bin nur stehen geblieben.“
Das Handy vibriert wieder. Diesmal ist es der Chef.
Er steht auf dem Gehsteig ohne Jacke, eine Orange in der
Hand, und schaut auf den Namen auf dem Bildschirm.
Er lässt es noch zweimal läuten. Dann hebt er ab.`,
    kurz: "Ein junger Mann im Probemonat hilft einem gestürzten alten Mann und verpasst dafür seinen Bus zur Arbeit.",
    antworten: {
      wer: "Ein junger Mann ohne Namen auf dem Weg zur Arbeit, ein alter Mann, der auf dem Eis stürzt, Passanten, eine Sanitäterin und am Ende der Chef am Telefon.",
      ende: "Der Chef ruft an. Der junge Mann steht ohne Jacke mit einer Orange in der Hand da und hebt ab (Z. 49).",
      thema: "Es geht um Zivilcourage und um die Frage, was im Leben wichtiger ist: Pünktlichkeit und Leistung oder Menschlichkeit.",
      titel: "Glatteis ist der Grund für den Sturz. Im übertragenen Sinn ist der junge Mann selbst auf Glatteis: Wenn er hilft, riskiert er seine Stelle.",
      figur: "Am Anfang denkt er nur an die Zeit, in Gedanken ist er „schon beim Bus um sieben Uhr einunddreißig, schon in der Halle, schon beim Chef“ (Z. 9f.). Am Ende zählt er die Minuten nicht mehr (Z. 42) und sagt: „Ich bin nur stehen geblieben.“ (Z. 45)",
      wendepunkt: "„Dann kniet er sich hin.“ (Z. 27) Dieser kurze Satz steht allein und zeigt die Entscheidung.",
      symbol: "Die Uhrzeiten und das Handy stehen für den Druck der Arbeit. Die aufgeplatzte Orange, die ihm der alte Mann schenkt (Z. 40f.), steht für Dankbarkeit und für das, was wirklich zählt.",
      sprache: "Die genauen Uhrzeiten wie „sieben Uhr achtundzwanzig“ (Z. 1) zeigen den Zeitdruck. Die kurzen Sätze „Sie schaut hin. Sie schaut weg. Sie geht weiter.“ (Z. 15f.) machen die Gleichgültigkeit der Passanten deutlich. Der Vergleich „wie ein Sack“ (Z. 4f.) zeigt, wie hilflos der alte Mann ist.",
      erzaehler: "Ein Er-Erzähler erzählt personal aus der Sicht des jungen Mannes. Wir erfahren nicht, ob er seine Stelle verliert und wie es dem alten Mann geht.",
      offen: "Offen: Wir hören nicht, was der Chef sagt. Dass er „es noch zweimal läuten“ (Z. 49) lässt, zeigt aber, dass er keine Angst mehr hat.",
    },
  },
  {
    id: "der-zaun",
    titel: "Der Zaun",
    autor: "Selin Aydın",
    jahr: "2024",
    text: `Zwischen dem Haus der Brunners und dem Haus der Kovačs
steht ein Zaun aus grünem Maschendraht, einen Meter zwanzig
hoch, und keiner der beiden Männer weiß mehr, wer ihn
aufgestellt hat. Jeder glaubt, der andere war es.
Herr Brunner mäht seinen Rasen jeden Samstag um neun,
in Streifen, hin und her, wie man es auf Fußballplätzen sieht.
Herr Kovač mäht, wenn er Zeit hat, und er hat selten Zeit.
Auf seiner Seite wachsen Löwenzahn und Klee bis an den Zaun,
und manchmal wächst etwas hindurch.
Dann kommt Herr Brunner mit der Gartenschere.
Er schneidet nur, was auf seiner Seite ist. Da ist er genau.
Gegrüßt wird trotzdem. Man grüßt sich ja.
„Schönes Wetter“, sagt Herr Brunner über den Zaun.
„Wird schon wieder regnen“, sagt Herr Kovač über den Zaun.
Mehr sagen sie nicht, seit elf Jahren, und beide halten
das für eine gute Nachbarschaft.
Im Juli fliegt ein Fußball über den Zaun.
Er gehört dem Enkel von Herrn Kovač, der in den Ferien
da ist, und er landet mitten in Herrn Brunners Tomaten.
Zwei Stauden knicken um. Eine rote Tomate platzt.
Der Bub steht am Zaun und traut sich nicht hinüber.
Herr Brunner kommt aus dem Haus. Er sieht den Ball,
er sieht die Tomaten, er sieht den Buben. Er sagt nichts.
Er hebt den Ball auf und trägt ihn ins Haus.
An diesem Abend redet Herr Kovač zum ersten Mal
länger als einen Satz mit seiner Frau über den Nachbarn.
An diesem Abend redet Herr Brunner mit niemandem,
weil seine Frau seit drei Jahren nicht mehr da ist.
Er sitzt in der Küche, und auf dem Tisch liegt der Ball.
Er ist alt und abgeschabt, und jemand hat mit Filzstift
einen Namen draufgeschrieben, der fast nicht mehr zu lesen ist.
Herr Brunner hatte auch einmal einen Ball. Einen Sohn hatte
er auch, der jetzt in Kanada wohnt und zu Weihnachten anruft.
Am nächsten Morgen ist der Ball weg.
Der Enkel findet ihn auf seiner Seite des Zauns, im Klee,
und daneben liegt ein Sackerl mit drei Tomaten, den
heilen, und ein Zettel: „Für die Mannschaft.“
Herr Kovač liest den Zettel zweimal. Dann geht er in den
Schuppen und holt die Zange, mit der er sonst den Draht
für die Weinreben schneidet.
Herr Brunner sieht ihn vom Küchenfenster aus.
Er sieht, wie Herr Kovač am Zaun steht, die Zange in der Hand,
und lange nichts tut.
Dann schneidet er. Ein Stück, nicht groß, gerade so groß,
dass ein Ball hindurchpasst. Oder ein Kind.
Oder, wenn man sich bückt, ein Mann.
Herr Brunner bleibt am Fenster stehen. Der Kaffee wird kalt.
Am Samstag um neun mäht er den Rasen, in Streifen, hin und her.
Beim Loch im Zaun hört er auf und schaut hinüber.`,
    kurz: "Zwei Nachbarn, die seit elf Jahren nur über das Wetter reden, nähern sich durch einen Fußball über den Zaun an.",
    antworten: {
      wer: "Herr Brunner, ein ordentlicher Witwer, sein Nachbar Herr Kovač und dessen Enkel, der in den Ferien zu Besuch ist.",
      ende: "Herr Kovač schneidet ein Loch in den Zaun. Herr Brunner hört beim Mähen beim Loch auf „und schaut hinüber“ (Z. 49).",
      thema: "Es geht um Abgrenzung und Einsamkeit unter Nachbarn und darum, wie eine kleine Geste eine Grenze öffnen kann.",
      titel: "Der Zaun trennt die beiden Gärten und die beiden Männer. Keiner weiß, wer ihn aufgestellt hat (Z. 3f.), aber beide halten sich an ihn.",
      figur: "Am Anfang ist Herr Brunner genau und abweisend, er „schneidet nur, was auf seiner Seite ist“ (Z. 11). Am Ende schenkt er dem Buben Tomaten und schaut neugierig zum Nachbarn hinüber.",
      wendepunkt: "Herr Brunner trägt den Ball ins Haus (Z. 24) und gibt ihn am nächsten Morgen mit drei Tomaten und dem Zettel „Für die Mannschaft.“ (Z. 37) zurück.",
      symbol: "Der Zaun steht für die Grenze zwischen den Menschen, das Loch für die Öffnung. Der alte Ball erinnert Herrn Brunner an seinen eigenen Sohn (Z. 32f.).",
      sprache: "Der Parallelismus „sagt Herr Brunner über den Zaun“ (Z. 13) und „sagt Herr Kovač über den Zaun“ (Z. 14) zeigt, wie formelhaft die Gespräche sind. Die Klimax „Oder ein Kind. Oder, wenn man sich bückt, ein Mann.“ (Z. 45f.) zeigt, dass das Loch eine Einladung ist.",
      erzaehler: "Ein auktorialer Er-Erzähler: Er weiß, was in beiden Häusern passiert (Z. 25–28). Wir erfahren nicht, was die Nachbarn sich denken, wenn sie einander sehen.",
      offen: "Offen: Wir wissen nicht, ob Herr Brunner durch das Loch geht. Der letzte Halbsatz „und schaut hinüber“ (Z. 49) lässt hoffen.",
    },
  },
];

const flach = (s: string) => s.replace(/\r\n?/g, "\n").split("\n").map((z) => z.trim()).filter(Boolean).join("\n");

/** Die Geschichte der Sammlung mit genau diesem Text (Zeilen ohne Leerzeichen am Rand verglichen), sonst undefined. */
export function geschichteMitText(text: string): Kurzgeschichte | undefined {
  const t = flach(text);
  return t ? KURZGESCHICHTEN.find((g) => flach(g.text) === t) : undefined;
}

/** Die Verständnisfragen einer Geschichte, mit oder ohne Musterantworten. */
export function verstaendnisFragen(g: Kurzgeschichte, mitAntworten: boolean): { frage: string; antwort?: string }[] {
  return FRAGE_KEYS.map((k) => (mitAntworten ? { frage: FRAGEN[k], antwort: g.antworten[k] } : { frage: FRAGEN[k] }));
}


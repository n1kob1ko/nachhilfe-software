/**
 * The example for Textinterpretation: a short story and a model interpretation, both written for the
 * DreamStudy. Story, author and year are invented; nothing comes from published literature, school books
 * or Matura material. Used by the tests, the docs, the Teilübungen without a story of the student's own
 * and the "So kann es aussehen" view while writing.
 *
 * The interpretation follows the seven parts of the Schreibplan, quotes word for word and gives the
 * lines; lib/textinterpretation.test.ts checks every quote against the story.
 */
import type { TeilKey, TeilSource } from "./textinterpretation";

export const BEISPIEL_TITEL = "Sieben Uhr zwölf";
export const BEISPIEL_AUTORIN = "Ida Brunnhofer";
export const BEISPIEL_JAHR = "2026";

/** 68 lines, no empty lines. */
export const BEISPIEL_GESCHICHTE = `Um sieben Uhr zwölf steht der Alte an der Haltestelle.
Er trägt den grauen Rock, den er schon im Amt getragen hat,
und unter dem Arm die Zeitung, gefaltet wie ein Brief, den
niemand öffnen soll. Das Wartehäuschen ist frisch gestrichen.
An der Glaswand hängt seit drei Wochen ein Zettel:
„Aufgrund rückläufiger Fahrgastzahlen wird die Linie 14
mit Fahrplanwechsel eingestellt. Wir danken für Ihr
Verständnis. Ihre Verkehrsbetriebe.“ Der Alte hat ihn gelesen.
Er hat ihn sogar zweimal gelesen, mit der Brille und ohne.
Dann hat er die Brille wieder in die Brusttasche gesteckt.
Jeden Morgen geht er die dreihundert Schritte vom Haus herunter.
Jeden Morgen zählt er sie nicht mehr, weil er sie kennt.
Jeden Morgen stellt er sich an den gleichen Platz neben den Mistkübel.
Die Straße kommt aus dem Wald herunter und verschwindet
hinter der Kurve wie eine graue Zunge im Maul des Waldes.
Früher, als die Kinder noch in die Stadt zur Schule fuhren und
die Frauen am Dienstag mit leeren Taschen hinunter- und mit vollen
wieder heraufkamen, als der Bus so voll war, dass man
im Gang stehen musste, wenn man nicht rechtzeitig da war,
hat der Kondukteur jeden beim Namen gegrüßt, obwohl er
selbst aus einem anderen Tal stammte, das keiner kannte.
Der Alte hat das Billett immer passend in der Hand gehabt.
Jetzt steckt er die Hand in die Tasche und findet nur Münzen.
Er wartet. Die Straße bleibt leer. Er wartet weiter.
Um sieben Uhr zwanzig kommt eine junge Frau den Hang herunter.
Sie hat einen Rucksack auf dem Rücken und das Handy in der Hand
und schaut abwechselnd auf den Bildschirm und auf den Fahrplan.
„Entschuldigung“, sagt sie, „fährt hier noch ein Bus in die Stadt?“
Der Alte schaut sie an, als hätte sie ihn etwas sehr
Persönliches gefragt. Dann nickt er langsam.
„Na, passt scho“, sagt er. „I wort auf'n Bus.“
Die junge Frau liest den Zettel an der Glaswand.
Sie liest ihn einmal, ohne Brille, und runzelt die Stirn.
„Aber da steht doch, dass er nicht mehr fährt.“
„Der kummt scho“, sagt der Alte. „Der is no imma kumma.“
Sie setzt sich auf die Bank im Wartehäuschen, ein Stück entfernt,
und tippt etwas in ihr Handy. Dann noch etwas. Dann steckt
sie es weg. Der Alte steht. Er setzt sich nie, weil man
im Sitzen den Bus zu spät sieht. Das hat er seinen Kindern
beigebracht, damals, als sie noch hier gewohnt haben.
Jetzt wohnen sie in Linz und in Graz, und einmal im Jahr
sitzen alle um seinen Tisch und reden über Fahrtzeiten.
Die junge Frau fragt, wohin er denn wolle. Er sagt, in die Stadt.
Was er dort mache. Er hebt die Schultern. Er kauft eine Zeitung,
obwohl er schon eine hat, und er zeigt dem Fahrer sein Billett,
und am Hauptplatz trinkt er einen Kaffee im Stehen, und dann
fährt er mit dem Bus um zehn wieder herauf. Früher hat er dort
einem Fräulein am Schalter Formulare gebracht, vierzig Jahre lang.
Die junge Frau lacht nicht. Sie sagt, sie habe heute ein
Vorstellungsgespräch, um neun, und ihr Auto sei kaputt.
Der Alte nickt, als wüsste er, was das bedeutet.
Eine Weile sagen beide nichts. Ein Traktor fährt vorbei,
und der Fahrer hebt grüßend zwei Finger vom Lenkrad.
Die junge Frau schaut ihm nach. Der Alte schaut auf die Kurve.
Um sieben Uhr vierzig ist die Straße noch immer leer.
Dann steht die junge Frau auf. Sie sagt, sie werde jetzt
jemanden anrufen, der sie hinunterbringt, vielleicht ihre Mutter.
Ob er mitfahren wolle. Der Alte schüttelt den Kopf.
Er müsse auf den Bus warten, sagt er, sonst wisse der
Fahrer ja nicht, dass hier noch jemand wohnt.
Und der Kondukteur, sagt er leiser, der habe ihn immer gefragt,
wie es den Kindern gehe. Die junge Frau sagt nichts dazu.
Ein kleines rotes Auto holt sie ab. Durch die Heckscheibe
sieht sie den Alten kleiner werden, bis ihn die Kurve verschluckt.
Am nächsten Morgen geht der Alte die dreihundert Schritte hinunter.
Das Wartehäuschen ist frisch gestrichen. Der Zettel hängt noch.
Auf der Bank sitzt jemand mit einem Rucksack und steht auf, als er kommt.
Um sieben Uhr zwölf stehen zwei an der Haltestelle.`;

/** The model interpretation, part by part (about 500 words in all). */
export const BEISPIEL_INTERPRETATION: { teil: TeilKey; text: string }[] = [
  {
    teil: "einleitung",
    text: "Die Kurzgeschichte „Sieben Uhr zwölf“ von Ida Brunnhofer (2026) erzählt von einem alten Mann, der jeden Morgen auf einen Bus wartet, der nicht mehr fährt. Thema ist die Einsamkeit alter Menschen auf dem Land. Meine Deutungshypothese: Der Text zeigt, dass Menschen dort allein gelassen werden, wo nur noch Zahlen zählen, und dass Nähe trotzdem möglich ist.",
  },
  {
    teil: "inhalt",
    text: "Ein alter Mann steht wie jeden Morgen an der Haltestelle, obwohl ein Zettel ankündigt, dass die Buslinie eingestellt wird. Eine junge Frau kommt dazu, weil sie zu einem Vorstellungsgespräch in die Stadt muss. Der Alte ist überzeugt, dass der Bus kommt. Die beiden warten eine Weile gemeinsam, dann lässt sich die Frau abholen. Am nächsten Morgen stehen zwei an der Haltestelle.",
  },
  {
    teil: "form",
    text: "Die Geschichte wird von einem Er-Erzähler meist im Präsens erzählt und ist kreisförmig aufgebaut: Der erste Satz „Um sieben Uhr zwölf steht der Alte an der Haltestelle“ (Z. 1) kehrt am Ende verändert wieder (Z. 68). Typisch für eine Kurzgeschichte sind der unvermittelte Beginn, die namenlosen Figuren und das offene Ende. Der Text lässt sich in drei Abschnitte gliedern: das Warten des Alten (Z. 1–24), die Begegnung mit der jungen Frau (Z. 25–55) und der Abschied mit dem neuen Morgen (Z. 56 ff.).",
  },
  {
    teil: "sprache",
    text: "Auffällig ist die Wortwahl. In der direkten Rede spricht der Alte Dialekt: „I wort auf'n Bus“ (Z. 31) und „Der is no imma kumma“ (Z. 35). Veraltete Wörter wie „Kondukteur“ (Z. 20), „Billett“ (Z. 22) und „Fräulein“ (Z. 48) zeigen, dass er in einer vergangenen Zeit lebt. Dagegen steht die kühle Amtssprache des Zettels: „Aufgrund rückläufiger Fahrgastzahlen“ (Z. 6). Die Anapher „Jeden Morgen“ (Z. 11–13) betont, wie gleichförmig sein Alltag ist. Der Vergleich „wie eine graue Zunge im Maul des Waldes“ (Z. 15) wirkt bedrohlich, als würde die Landschaft die Menschen verschlucken. Ein langes Satzgefüge (Z. 16–21) erzählt von der lebendigen Vergangenheit, während die kurzen Hauptsätze „Er wartet. Die Straße bleibt leer. Er wartet weiter.“ (Z. 24) den Stillstand der Gegenwart spürbar machen.",
  },
  {
    teil: "figur",
    text: "Der Alte ist ein pflichtbewusster, ordentlicher Mann, der an seinen Gewohnheiten festhält. Er setzt sich nie, „weil man im Sitzen den Bus zu spät sieht“ (Z. 38f.). Seine Kinder leben weit weg, und bei ihren Besuchen reden alle nur „über Fahrtzeiten“ (Z. 42). Das Warten gibt ihm Halt: Er will zeigen, „dass hier noch jemand wohnt“ (Z. 60). Hinter seiner Sturheit steckt also der Wunsch, gesehen zu werden.",
  },
  {
    teil: "deutung",
    text: "Die Geschichte übt Kritik an einer Gesellschaft, die Menschen nach Zahlen bemisst. Der Satz „Wir danken für Ihr Verständnis“ (Z. 7f.) klingt höflich, lässt die Betroffenen aber allein. Die Einstellung der Linie trifft auch die junge Frau, deren Auto kaputt ist. Der Titel nennt die Abfahrtszeit eines Busses, der nicht mehr kommt. Am Ende bekommt diese Uhrzeit eine neue Bedeutung: Sie ist nicht mehr die Zeit des Busses, sondern die Zeit einer Begegnung.",
  },
  {
    teil: "schluss",
    text: "Insgesamt zeigt Brunnhofer, wie Menschen auf dem Land vergessen werden, aber auch, dass Gemeinschaft dort entstehen kann, wo man sie nicht erwartet. Mich überzeugt besonders das offene Ende, weil es keine einfache Lösung anbietet. Der Bus kommt nicht zurück, doch der Alte wartet nicht mehr allein. Gerade diese leise Hoffnung macht die Geschichte für mich glaubwürdig.",
  },
];

/** The model interpretation as one text, a paragraph per part. */
export const beispielInterpretation = () => BEISPIEL_INTERPRETATION.map((p) => p.text).join("\n");

/** The example as source of Teilübungen, with the model answers as samples. */
export const BEISPIEL_QUELLE: TeilSource = {
  title: BEISPIEL_TITEL,
  author: BEISPIEL_AUTORIN,
  year: BEISPIEL_JAHR,
  kind: "Kurzgeschichte",
  text: BEISPIEL_GESCHICHTE,
  countBlank: false,
  samples: Object.fromEntries(BEISPIEL_INTERPRETATION.map((p) => [p.teil, p.text])),
};

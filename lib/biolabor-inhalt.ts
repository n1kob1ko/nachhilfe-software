/**
 * Der Stoff von „Biolabor“ (lib/biolabor.ts): Genetik und „Der Mensch“ (Nervensystem, Gehirn, unwillkürliches
 * Nervensystem, Sympathikus und Parasympathikus, Hormone) für die 4. Klasse (8. Schulstufe).
 *
 * niko 2026-11-23 mit dem Teststoff „Biologie 4D 26.11.2026“ (Buch Expedition Biologie 4, Westermann/E. Dorner,
 * Neuer Lehrplan): 1) Genetik (BS 53–72) und 2) Der Mensch (BS 7–18). Die Buchseiten haben wir nicht; der Stoff ist
 * nach den Überschriften des Teststoffs und dem Lehrplan geschrieben, in Worten einer 4. Klasse.
 *
 * Fünf Arten von Einträgen:
 * - `wahl`: eine Frage mit der richtigen und falschen Antworten. Mit `schreib` kann man sie wie im Test schreiben
 *   (die erste ist die richtige Schreibweise, die anderen gelten auch).
 * - `begriff`: ein Begriff aus dem Glossar mit Erklärung („Welcher Begriff ist gemeint?“).
 * - `zuordnen`: eine Aussage, die man einer von zwei Seiten zuordnet (Sympathikus oder Parasympathikus).
 * - `erklaeren`: eine offene Frage wie im Test; nur „Wie im Test“, mit Selbstkontrolle an den Stichpunkten.
 * - `kreuzung`: ein Kreuzungsschema (Punnett-Quadrat) und danach eine Frage zum Ergebnis.
 */

export type Bereich = "genetik" | "mensch";


export type BioThema = {
  id: string;
  bereich: Bereich;
  titel: string;
  /** Der Lernzettel: das Wichtigste in kurzen Sätzen */
  merke: string[];
};

type Basis = { id: string; thema: string; merke?: string };
export type WahlEintrag = Basis & { art: "wahl"; frage: string; richtig: string; falsch: string[]; schreib?: string[] };
export type BegriffEintrag = Basis & { art: "begriff"; begriff: string; erklaerung: string; auch?: string[] };
export type ZuordnenEintrag = Basis & { art: "zuordnen"; aussage: string; richtig: string; seiten: [string, string] };
export type ErklaerEintrag = Basis & { art: "erklaeren"; frage: string; punkte: string[] };
export type KreuzungEintrag = Basis & {
  art: "kreuzung";
  titel: string;
  /** was die Buchstaben bedeuten */
  legende: string[];
  /** die Allele in der Reihenfolge, in der sie im Genotyp stehen (R vor r, A vor B vor 0, X vor Y) */
  allele: string[];
  mutter: [string, string];
  vater: [string, string];
  frage: string;
  richtig: string;
  falsch: string[];
};
export type BioEintrag = WahlEintrag | BegriffEintrag | ZuordnenEintrag | ErklaerEintrag | KreuzungEintrag;

export const BIO_THEMEN: BioThema[] = [
  {
    id: "grundlagen",
    bereich: "genetik",
    titel: "Grundlagen der Vererbung",
    merke: [
      "Vererbung: Eltern geben Merkmale (z. B. Haarfarbe, Blutgruppe) über ihre Erbanlagen (Gene) an die Nachkommen weiter.",
      "Die Wissenschaft von der Vererbung heißt Genetik (Vererbungslehre).",
      "Gregor Mendel (1822–1884) war Augustinermönch in Brünn. Er kreuzte Erbsen und fand die Regeln der Vererbung. Er gilt als „Vater der Genetik“.",
      "Nicht alles ist vererbt: auch die Umwelt prägt uns (Ernährung, Sonne, Training). Eine Narbe oder ein gelernter Sport wird nicht vererbt.",
    ],
  },
  {
    id: "glossar",
    bereich: "genetik",
    titel: "Glossar Genetik",
    merke: [
      "Gen: Abschnitt der DNA mit der Information für ein Merkmal. Allel: eine Form (Variante) eines Gens.",
      "Genotyp: die Erbanlagen (z. B. Rr). Phänotyp: das Aussehen (z. B. rote Blüte).",
      "Dominant setzt sich durch (Großbuchstabe), rezessiv wird überdeckt (Kleinbuchstabe). Intermediär: Mischform.",
      "Reinerbig (homozygot): zwei gleiche Allele (RR, rr). Mischerbig (heterozygot): zwei verschiedene (Rr).",
      "P-Generation = Eltern, F1 = erste Tochtergeneration, F2 = zweite Tochtergeneration.",
      "Mutation: plötzliche, dauerhafte Veränderung der Erbinformation.",
    ],
  },
  {
    id: "weitergabe",
    bereich: "genetik",
    titel: "Weitergabe der Erbinformation",
    merke: [
      "Mitose (normale Zellteilung): aus einer Körperzelle werden zwei gleiche Tochterzellen mit 46 Chromosomen. Für Wachstum und Erneuerung (Haut, Wundheilung).",
      "Vor jeder Teilung wird die DNA verdoppelt (kopiert). So bekommt jede Tochterzelle die ganze Erbinformation.",
      "Meiose (Reifeteilung, Reduktionsteilung): in Eierstock und Hoden entstehen aus einer Zelle vier Keimzellen mit dem halben Chromosomensatz (23).",
      "Befruchtung: Eizelle (23) + Spermium (23) = Zygote (46). Das Kind hat die Hälfte der Erbinformation von der Mutter und die Hälfte vom Vater.",
      "Bei der Meiose werden die Chromosomen zufällig verteilt. Darum sind Geschwister verschieden (außer eineiige Zwillinge).",
    ],
  },
  {
    id: "dna",
    bereich: "genetik",
    titel: "DNA und Chromosomen",
    merke: [
      "Die Erbinformation liegt im Zellkern, auf den Chromosomen. Chromosomen bestehen aus DNA (Desoxyribonukleinsäure).",
      "Die DNA ist gebaut wie eine verdrehte Strickleiter: die Doppelhelix (Watson und Crick, 1953).",
      "Die Sprossen der Leiter sind vier Basen: Adenin, Thymin, Guanin, Cytosin. Immer A mit T und G mit C.",
      "Ein Gen ist ein Abschnitt der DNA. Es ist die Bauanleitung für ein Merkmal.",
      "Jede Körperzelle des Menschen hat 46 Chromosomen = 23 Paare: 22 Paare Körperchromosomen (Autosomen) und 1 Paar Geschlechtschromosomen.",
      "Keimzellen (Eizelle, Spermium) haben nur 23 Chromosomen. Ein Karyogramm zeigt alle Chromosomen geordnet nach Größe.",
    ],
  },
  {
    id: "mendel",
    bereich: "genetik",
    titel: "Mendel’sche Regeln",
    merke: [
      "1. Regel, Uniformitätsregel: Kreuzt man zwei reinerbige Eltern, die sich in einem Merkmal unterscheiden, sind alle Nachkommen der F1 gleich (uniform). RR × rr → alle Rr.",
      "2. Regel, Spaltungsregel: Kreuzt man die mischerbigen F1 untereinander (Rr × Rr), spaltet sich die F2 wieder auf: dominant-rezessiv 3 : 1, intermediär 1 : 2 : 1.",
      "3. Regel, Unabhängigkeitsregel (Neukombinationsregel): Mehrere Merkmale werden unabhängig voneinander vererbt, es entstehen neue Kombinationen. Bei zwei Merkmalen ist die F2 9 : 3 : 3 : 1.",
      "Dominant-rezessiv: das dominante Allel überdeckt das rezessive. Rr sieht aus wie RR.",
      "Intermediär: beide Allele wirken mit, es entsteht eine Mischform. Wunderblume: rot × weiß → rosa.",
    ],
  },
  {
    id: "schema",
    bereich: "genetik",
    titel: "Kreuzungsschemata",
    merke: [
      "1. Die Genotypen der Eltern aufschreiben (z. B. Rr × Rr).",
      "2. Die Keimzellen (Gameten) jedes Elternteils: jede bekommt ein Allel (R oder r).",
      "3. Ins Quadrat: oben die Keimzellen des Vaters, links die der Mutter. In jedes Feld kommt ein Allel von oben und eines von links.",
      "4. Auszählen: Genotypen (RR : Rr : rr) und Aussehen (z. B. 3 rot : 1 weiß). Jedes Feld ist 25 %.",
    ],
  },
  {
    id: "mensch",
    bereich: "genetik",
    titel: "Vererbung beim Menschen",
    merke: [
      "Geschlecht: Frauen haben XX, Männer XY. Jede Eizelle hat ein X, ein Spermium ein X oder ein Y.",
      "Das Spermium entscheidet: mit X wird es ein Mädchen, mit Y ein Bub. Die Chance ist 50 : 50.",
      "Blutgruppen (AB0-System): drei Allele A, B und 0. A und B sind dominant über 0. A und B zusammen sind gleich stark (kodominant): Blutgruppe AB.",
      "Blutgruppe A: AA oder A0. B: BB oder B0. AB: AB. 0: 00.",
      "Rhesusfaktor: Rh-positiv ist dominant, rh-negativ rezessiv.",
      "Trisomie 21 (Down-Syndrom): das Chromosom 21 ist dreimal da, die Zellen haben 47 Chromosomen.",
    ],
  },
  {
    id: "gentechnik",
    bereich: "genetik",
    titel: "Gentechnik",
    merke: [
      "Gentechnik: die Erbinformation wird gezielt verändert, oder Gene werden von einem Lebewesen in ein anderes übertragen.",
      "Rote Gentechnik (Medizin): Bakterien stellen Insulin und andere Medikamente her, Impfstoffe, Gentests, Gentherapie.",
      "Grüne Gentechnik (Pflanzen, Landwirtschaft): Pflanzen, die Schädlinge abwehren oder Trockenheit aushalten, z. B. Bt-Mais; „Goldener Reis“ mit Vitamin A.",
      "Weiße Gentechnik (Industrie): Bakterien und Pilze erzeugen Stoffe, z. B. Enzyme für Waschmittel, Zusatzstoffe für Lebensmittel, Biotreibstoff.",
      "Chancen: neue Medikamente, mehr Ernte. Risiken: unbekannte Folgen für Natur und Gesundheit, veränderte Pflanzen breiten sich aus, Abhängigkeit von Saatgutfirmen.",
    ],
  },
  {
    id: "nerven",
    bereich: "mensch",
    titel: "Das Nervensystem (ZNS und PNS)",
    merke: [
      "Das Nervensystem nimmt Reize auf, leitet sie weiter, verarbeitet sie und steuert den Körper.",
      "ZNS (zentrales Nervensystem) = Gehirn und Rückenmark. Schutz: Schädel und Wirbelsäule.",
      "PNS (peripheres Nervensystem) = alle Nerven außerhalb von Gehirn und Rückenmark. Es verbindet das ZNS mit dem ganzen Körper.",
      "Sensible (sensorische) Nerven melden von den Sinnesorganen zum ZNS. Motorische Nerven bringen Befehle vom ZNS zu den Muskeln.",
      "Nervenzelle (Neuron): Zellkörper mit Zellkern, Dendriten (nehmen Signale auf), Axon oder Nervenfaser (leitet weiter), Endknöpfchen an der Synapse.",
      "In der Nervenzelle läuft das Signal elektrisch, an der Synapse geht es mit chemischen Botenstoffen weiter.",
      "Reflex: schnelle, unbewusste Reaktion über das Rückenmark, ohne das Gehirn (Kniesehnenreflex, Hand von der heißen Herdplatte).",
    ],
  },
  {
    id: "gehirn",
    bereich: "mensch",
    titel: "Das Gehirn",
    merke: [
      "Großhirn: der größte Teil, zwei Hälften, außen die gefurchte Großhirnrinde. Denken, Lernen, Gedächtnis, Sprache, Bewusstsein, Wahrnehmung, willkürliche Bewegungen.",
      "Die linke Gehirnhälfte steuert die rechte Körperseite, die rechte die linke.",
      "Kleinhirn: Gleichgewicht und fein abgestimmte Bewegungen (Radfahren, Tanzen).",
      "Zwischenhirn: Schaltstelle. Der Hypothalamus regelt Körpertemperatur, Hunger und Durst und steuert über die Hypophyse die Hormone.",
      "Hirnstamm mit dem verlängerten Mark: lebenswichtige Dinge wie Atmung, Herzschlag, Blutdruck, Schlucken und Husten.",
      "Schutz: Schädel, Hirnhäute und Hirnflüssigkeit.",
    ],
  },
  {
    id: "vegetativ",
    bereich: "mensch",
    titel: "Das unwillkürliche Nervensystem",
    merke: [
      "Willkürliches Nervensystem: steuert, was wir bewusst tun, z. B. die Skelettmuskeln beim Gehen, Greifen und Sprechen.",
      "Unwillkürliches (vegetatives) Nervensystem: steuert die inneren Organe ohne unseren Willen: Herzschlag, Atmung, Verdauung, Schwitzen, Pupillen.",
      "Es hat zwei Gegenspieler: Sympathikus und Parasympathikus. Sie wirken auf dieselben Organe, aber entgegengesetzt.",
    ],
  },
  {
    id: "sympathikus",
    bereich: "mensch",
    titel: "Sympathikus und Parasympathikus",
    merke: [
      "Sympathikus: macht den Körper bereit für Leistung, Stress, Kampf oder Flucht. Herz schneller, Blutdruck höher, Atmung schneller, Bronchien und Pupillen weiter, Verdauung gebremst.",
      "Parasympathikus: sorgt für Ruhe und Erholung. Herz langsamer, Atmung ruhiger, Pupillen enger, Verdauung angeregt.",
      "Merke: Sympathikus = Gas geben. Parasympathikus = Bremse, Ruhe und Verdauung.",
    ],
  },
  {
    id: "hormone",
    bereich: "mensch",
    titel: "Hormone",
    merke: [
      "Hormone sind chemische Botenstoffe. Hormondrüsen geben sie direkt ins Blut ab; das Blut bringt sie zu den Zielorganen.",
      "Ein Hormon wirkt nur an Zellen mit dem passenden Empfänger (Rezeptor): Schlüssel-Schloss-Prinzip.",
      "Hormone wirken langsamer als Nerven, dafür länger.",
      "Hypophyse (Hirnanhangdrüse): die „Chefdrüse“, steuert andere Hormondrüsen und bildet das Wachstumshormon.",
      "Schilddrüse: Thyroxin, regt den Stoffwechsel an; sie braucht Jod.",
      "Bauchspeicheldrüse: Insulin senkt den Blutzucker, Glukagon hebt ihn. Fehlt Insulin: Diabetes (Zuckerkrankheit).",
      "Nebennieren: Adrenalin, das Stresshormon. Eierstöcke: Östrogen und Progesteron. Hoden: Testosteron.",
    ],
  },
];

const w = (id: string, thema: string, frage: string, richtig: string, falsch: string[], o: { schreib?: string[]; merke?: string } = {}): WahlEintrag => ({
  id,
  thema,
  art: "wahl",
  frage,
  richtig,
  falsch,
  ...o,
});
const b = (id: string, thema: string, begriff: string, erklaerung: string, auch?: string[]): BegriffEintrag => ({ id, thema, art: "begriff", begriff, erklaerung, auch });
const e = (id: string, thema: string, frage: string, punkte: string[]): ErklaerEintrag => ({ id, thema, art: "erklaeren", frage, punkte });
const SYMP: [string, string] = ["Sympathikus", "Parasympathikus"];
const z = (id: string, aussage: string, richtig: "Sympathikus" | "Parasympathikus"): ZuordnenEintrag => ({
  id,
  thema: "sympathikus",
  art: "zuordnen",
  aussage,
  richtig,
  seiten: SYMP,
  merke: richtig === "Sympathikus" ? "Sympathikus: Leistung, Stress, Kampf oder Flucht." : "Parasympathikus: Ruhe, Erholung und Verdauung.",
});

export const BIO_EINTRAEGE: BioEintrag[] = [
  // ---------- Grundlagen der Vererbung ----------
  w("g-mendel-wer", "grundlagen", "Wer fand die Grundregeln der Vererbung?", "Gregor Mendel", ["Charles Darwin", "Louis Pasteur", "Robert Koch"], {
    schreib: ["Gregor Mendel", "Mendel", "Johann Gregor Mendel"],
    merke: "Gregor Mendel war Augustinermönch in Brünn und kreuzte Erbsen.",
  }),
  w("g-erbsen", "grundlagen", "Mit welchen Pflanzen machte Mendel seine Kreuzungsversuche?", "Erbsen", ["Bohnen", "Rosen", "Tulpen"], { schreib: ["Erbsen", "Erbse", "Gartenerbsen", "Gartenerbse"] }),
  w("g-beruf", "grundlagen", "Was war Gregor Mendel von Beruf?", "Mönch im Kloster", ["Arzt im Spital", "Bauer", "Kapitän"], { merke: "Mendel war Augustinermönch im Kloster in Brünn." }),
  w("g-genetik", "grundlagen", "Wie heißt die Wissenschaft von der Vererbung?", "Genetik", ["Ökologie", "Anatomie", "Botanik"], { schreib: ["Genetik", "Vererbungslehre"] }),
  w("g-vererbung", "grundlagen", "Was bedeutet Vererbung?", "Eltern geben Merkmale an ihre Nachkommen weiter.", ["Kinder lernen alles von den Eltern.", "Merkmale entstehen ganz zufällig neu.", "Nur der Vater gibt Merkmale weiter."]),
  w("g-erworben", "grundlagen", "Was davon wird NICHT vererbt?", "eine Narbe von einem Sturz", ["die Blutgruppe", "die natürliche Haarfarbe", "die Augenfarbe"], {
    merke: "Was man im Leben erwirbt (Narben, Muskeln vom Training, Gelerntes), wird nicht vererbt.",
  }),
  w("g-umwelt", "grundlagen", "Eineiige Zwillinge haben dieselben Gene. Warum sind sie trotzdem nicht ganz gleich?", "Auch die Umwelt beeinflusst Merkmale.", ["Sie haben verschiedene Eltern.", "Ihre Gene ändern sich jedes Jahr.", "Einer hat mehr Chromosomen."]),
  e("g-erkl-vererbung", "grundlagen", "Was versteht man unter Vererbung? Wer hat die Regeln entdeckt?", ["Eltern geben Merkmale über ihre Gene an die Nachkommen weiter", "die Erbinformation steckt in den Keimzellen (Eizelle, Spermium)", "Gregor Mendel, Augustinermönch in Brünn, Versuche mit Erbsen"]),

  // ---------- Glossar ----------
  b("b-gen", "glossar", "Gen", "Ein Abschnitt der DNA mit der Information für ein Merkmal (Erbanlage).", ["Gene", "Erbanlage"]),
  b("b-allel", "glossar", "Allel", "Eine Form (Variante) eines Gens, z. B. für rote oder für weiße Blüten.", ["Allele"]),
  b("b-genotyp", "glossar", "Genotyp", "Die Erbanlagen eines Lebewesens, also was in den Genen steht (z. B. Rr).", ["Erbbild"]),
  b("b-phaenotyp", "glossar", "Phänotyp", "Das äußere Erscheinungsbild, die sichtbaren Merkmale (z. B. rote Blüte).", ["Erscheinungsbild"]),
  b("b-dominant", "glossar", "dominant", "Ein Allel, das sich durchsetzt und das Aussehen bestimmt; man schreibt es groß."),
  b("b-rezessiv", "glossar", "rezessiv", "Ein Allel, das überdeckt wird und sich nur zeigt, wenn es doppelt da ist; man schreibt es klein."),
  b("b-intermediaer", "glossar", "intermediär", "Ein Erbgang, bei dem beide Allele mitwirken und eine Mischform entsteht (rot × weiß → rosa)."),
  b("b-reinerbig", "glossar", "reinerbig", "Beide Allele für ein Merkmal sind gleich (RR oder rr).", ["homozygot"]),
  b("b-mischerbig", "glossar", "mischerbig", "Die beiden Allele für ein Merkmal sind verschieden (Rr).", ["heterozygot"]),
  b("b-mutation", "glossar", "Mutation", "Eine plötzliche, dauerhafte Veränderung der Erbinformation.", ["Mutationen"]),
  b("b-pgen", "glossar", "P-Generation", "Die Elterngeneration bei einem Kreuzungsversuch.", ["Parentalgeneration", "Elterngeneration", "P"]),
  b("b-f1", "glossar", "F1-Generation", "Die erste Tochtergeneration: die Nachkommen der Eltern.", ["F1", "erste Tochtergeneration", "Filialgeneration", "1. Tochtergeneration"]),
  b("b-kreuzung", "glossar", "Kreuzung", "Man paart gezielt zwei Lebewesen, die sich in Merkmalen unterscheiden.", ["kreuzen"]),
  b("b-klon", "glossar", "Klon", "Ein Lebewesen mit genau derselben Erbinformation wie ein anderes (genetische Kopie).", ["Klone"]),
  w("g-gross-klein", "glossar", "Wie schreibt man ein dominantes Allel?", "mit einem Großbuchstaben (R)", ["mit einem Kleinbuchstaben (r)", "mit einer Zahl (1)", "mit einem Sternchen (R*)"]),
  w("g-rr-aussehen", "glossar", "R = rot ist dominant, r = weiß. Eine Erbse hat den Genotyp Rr. Welche Farbe hat ihre Blüte?", "rot", ["weiß", "rosa", "rot-weiß gestreift"], { merke: "Das dominante R überdeckt das rezessive r: Rr sieht aus wie RR." }),
  w("g-rezessiv-zeigt", "glossar", "Bei welchem Genotyp zeigt sich das rezessive Merkmal?", "rr", ["RR", "Rr", "bei allen dreien"]),
  w("g-geno-pheno", "glossar", "„Die Blüte ist rot.“ Ist das der Genotyp oder der Phänotyp?", "Phänotyp", ["Genotyp"], { merke: "Phänotyp = wie es aussieht. Genotyp = die Buchstaben (RR, Rr, rr)." }),
  w("g-geno-pheno2", "glossar", "„Die Pflanze ist Rr.“ Ist das der Genotyp oder der Phänotyp?", "Genotyp", ["Phänotyp"]),

  // ---------- Weitergabe der Erbinformation ----------
  w("w-mitose", "weitergabe", "Wie heißt die Zellteilung, bei der zwei gleiche Körperzellen entstehen?", "Mitose", ["Meiose", "Befruchtung", "Mutation"], { schreib: ["Mitose"] }),
  w("w-meiose", "weitergabe", "Wie heißt die Zellteilung, bei der Keimzellen entstehen?", "Meiose", ["Mitose", "Klonen", "Befruchtung"], { schreib: ["Meiose", "Reifeteilung", "Reduktionsteilung"] }),
  w("w-vier", "weitergabe", "Wie viele Keimzellen entstehen bei der Meiose aus einer Zelle?", "4", ["2", "1", "8"], { schreib: ["4", "vier"] }),
  w("w-mitose-wozu", "weitergabe", "Wozu braucht der Körper die Mitose?", "für Wachstum und um Zellen zu erneuern", ["um Keimzellen zu bilden", "um das Geschlecht festzulegen", "um Hormone zu bilden"]),
  w("w-halb", "weitergabe", "Warum haben Keimzellen nur den halben Chromosomensatz?", "Damit die befruchtete Eizelle wieder 46 Chromosomen hat.", ["Weil sie kleiner sind als andere Zellen.", "Damit sie schneller schwimmen.", "Weil die Hälfte bei der Befruchtung verloren geht."]),
  w("w-zygote", "weitergabe", "Eizelle und Spermium verschmelzen. Was entsteht?", "die Zygote", ["ein Chromosom", "eine neue Keimzelle", "ein Gen"], { schreib: ["Zygote", "befruchtete Eizelle"] }),
  w("w-verdoppeln", "weitergabe", "Was passiert mit der DNA vor jeder Zellteilung?", "Sie wird verdoppelt (kopiert).", ["Sie wird halbiert.", "Sie wird abgebaut.", "Sie verlässt den Zellkern."]),
  w("w-geschwister", "weitergabe", "Warum sehen Geschwister (keine eineiigen Zwillinge) verschieden aus?", "Bei der Meiose werden die Chromosomen zufällig verteilt.", ["Sie haben verschiedene Eltern.", "Die Mitose verändert die Gene.", "Nur der Vater vererbt Merkmale."]),
  w("w-wo-meiose", "weitergabe", "Wo findet die Meiose statt?", "in den Eierstöcken und Hoden", ["in der Haut", "im Gehirn", "in jeder Zelle des Körpers"]),
  w("w-mitose-zahl", "weitergabe", "Eine Hautzelle mit 46 Chromosomen teilt sich durch Mitose. Wie viele Chromosomen hat jede Tochterzelle?", "46", ["23", "92", "12"], { schreib: ["46"] }),
  b("b-keimzellen", "weitergabe", "Keimzellen", "Eizellen und Spermien; sie haben nur den halben Chromosomensatz (23).", ["Geschlechtszellen", "Gameten", "Keimzelle"]),
  b("b-zygote", "weitergabe", "Zygote", "Die befruchtete Eizelle, aus der ein neuer Mensch wächst.", ["befruchtete Eizelle"]),
  e("w-erkl-mitose-meiose", "weitergabe", "Erkläre den Unterschied zwischen Mitose und Meiose.", ["Mitose: aus einer Körperzelle zwei gleiche Zellen mit 46 Chromosomen", "Mitose für Wachstum und Erneuerung", "Meiose: vier Keimzellen mit halbem Satz (23), in Eierstock und Hoden"]),
  e("w-erkl-befruchtung", "weitergabe", "Was passiert bei der Befruchtung mit den Chromosomen?", ["Eizelle (23) und Spermium (23) verschmelzen", "die Zygote hat wieder 46 Chromosomen", "je die Hälfte der Erbinformation von Mutter und Vater"]),

  // ---------- DNA und Chromosomen ----------
  w("d-wo", "dna", "Wo liegt die Erbinformation in der Zelle?", "im Zellkern", ["in der Zellmembran", "im Zellplasma", "in der Zellwand"], { schreib: ["im Zellkern", "Zellkern", "Kern"] }),
  w("d-abk", "dna", "Wofür steht DNA?", "Desoxyribonukleinsäure", ["Doppelnukleinsäure", "Desoxy-Natrium-Atom", "Dinatriumacetat"], { schreib: ["Desoxyribonukleinsäure", "Desoxyribonucleinsäure", "DNS"] }),
  w("d-helix", "dna", "Wie nennt man die Form der DNA?", "Doppelhelix", ["Einfachspirale", "Doppelkreis", "Dreieck"], { schreib: ["Doppelhelix"], merke: "Die DNA sieht aus wie eine verdrehte Strickleiter." }),
  w("d-watson", "dna", "Wer entdeckte 1953 den Bau der DNA?", "Watson und Crick", ["Gregor Mendel", "Charles Darwin", "Marie Curie"]),
  w("d-at", "dna", "Mit welcher Base paart sich Adenin in der DNA immer?", "Thymin", ["Guanin", "Cytosin", "Adenin"], { schreib: ["Thymin", "T"], merke: "A mit T, G mit C." }),
  w("d-gc", "dna", "Mit welcher Base paart sich Guanin in der DNA immer?", "Cytosin", ["Thymin", "Adenin", "Guanin"], { schreib: ["Cytosin", "Zytosin", "C"], merke: "A mit T, G mit C." }),
  w("d-basen", "dna", "Welche vier Basen bilden die Sprossen der DNA?", "Adenin, Thymin, Guanin, Cytosin", ["Adenin, Thymin, Glukose, Calcium", "Alpha, Beta, Gamma, Delta", "Eisen, Jod, Kalium, Natrium"]),
  w("d-46", "dna", "Wie viele Chromosomen hat eine Körperzelle des Menschen?", "46", ["23", "48", "92"], { schreib: ["46"] }),
  w("d-23", "dna", "Wie viele Chromosomen hat eine Eizelle oder ein Spermium?", "23", ["46", "22", "12"], { schreib: ["23"] }),
  w("d-paare", "dna", "Wie viele Chromosomenpaare hat der Mensch?", "23", ["46", "22", "24"], { schreib: ["23"] }),
  w("d-autosomen", "dna", "Wie viele Paare davon sind Körperchromosomen (Autosomen)?", "22", ["23", "1", "44"], { schreib: ["22"] }),
  w("d-gen", "dna", "Was ist ein Gen?", "ein Abschnitt der DNA mit der Information für ein Merkmal", ["ein ganzes Chromosom", "eine Zelle im Blut", "ein Hormon im Zellkern"]),
  w("d-chromosom", "dna", "Woraus bestehen Chromosomen?", "aus aufgewickelter DNA", ["aus Fett", "aus Zucker", "aus Hormonen"]),
  b("b-chromosom", "dna", "Chromosom", "Ein aufgewickelter Faden aus DNA im Zellkern; er trägt die Gene.", ["Chromosomen"]),
  b("b-dna", "dna", "DNA", "Der Stoff, aus dem die Erbinformation besteht; gebaut wie eine verdrehte Strickleiter.", ["DNS", "Desoxyribonukleinsäure"]),
  b("b-karyogramm", "dna", "Karyogramm", "Ein Bild aller Chromosomen einer Zelle, geordnet nach Größe und Form.", ["Chromosomenbild"]),
  b("b-autosomen", "dna", "Autosomen", "Die 22 Chromosomenpaare, die bei Frau und Mann gleich sind (Körperchromosomen).", ["Körperchromosomen", "Autosom"]),
  b("b-gonosomen", "dna", "Geschlechtschromosomen", "Das Chromosomenpaar, das das Geschlecht bestimmt: XX oder XY.", ["Gonosomen", "Geschlechtschromosom"]),
  e("d-erkl-bau", "dna", "Beschreibe den Bau der DNA.", ["Doppelhelix: wie eine verdrehte Strickleiter", "zwei Stränge, verbunden durch Basenpaare (die Sprossen)", "vier Basen: A mit T, G mit C"]),
  e("d-erkl-chromosomen", "dna", "Was sind Chromosomen, und wie viele hat der Mensch?", ["Chromosomen bestehen aus aufgewickelter DNA und tragen die Gene", "sie liegen im Zellkern", "Körperzelle 46 (23 Paare), Keimzelle 23"]),

  // ---------- Mendel’sche Regeln ----------
  w("m-1", "mendel", "Wie heißt die 1. Mendel’sche Regel?", "Uniformitätsregel", ["Spaltungsregel", "Unabhängigkeitsregel", "Dominanzregel"], { schreib: ["Uniformitätsregel", "Uniformitätsgesetz", "Regel der Uniformität"] }),
  w("m-2", "mendel", "Wie heißt die 2. Mendel’sche Regel?", "Spaltungsregel", ["Uniformitätsregel", "Unabhängigkeitsregel", "Mischregel"], { schreib: ["Spaltungsregel", "Aufspaltungsregel", "Spaltungsgesetz"] }),
  w("m-3", "mendel", "Wie heißt die 3. Mendel’sche Regel?", "Unabhängigkeitsregel", ["Uniformitätsregel", "Spaltungsregel", "Gleichheitsregel"], { schreib: ["Unabhängigkeitsregel", "Neukombinationsregel", "Unabhängigkeitsgesetz"] }),
  w("m-1-was", "mendel", "Welche Regel sagt: Alle Nachkommen der F1 sind gleich?", "die 1. Regel (Uniformitätsregel)", ["die 2. Regel (Spaltungsregel)", "die 3. Regel (Unabhängigkeitsregel)", "keine Regel"]),
  w("m-2-was", "mendel", "Welche Regel sagt: In der F2 tauchen beide Merkmale wieder auf?", "die 2. Regel (Spaltungsregel)", ["die 1. Regel (Uniformitätsregel)", "die 3. Regel (Unabhängigkeitsregel)", "keine Regel"]),
  w("m-3-was", "mendel", "Was sagt die 3. Mendel’sche Regel?", "Merkmale werden unabhängig voneinander vererbt und neu kombiniert.", ["Alle Nachkommen sind gleich.", "In der F2 gehen Merkmale verloren.", "Nur dominante Merkmale werden vererbt."]),
  w("m-f1", "mendel", "Reinerbig rot (RR) wird mit reinerbig weiß (rr) gekreuzt. Wie sieht die F1 aus? (R ist dominant)", "alle rot (Rr)", ["alle weiß (rr)", "3 rot : 1 weiß", "halb rot, halb weiß"]),
  w("m-31", "mendel", "Dominant-rezessiver Erbgang: In welchem Verhältnis spaltet die F2 im Aussehen auf?", "3 : 1", ["1 : 2 : 1", "1 : 1", "9 : 3 : 3 : 1"]),
  w("m-121", "mendel", "Intermediärer Erbgang: In welchem Verhältnis spaltet die F2 im Aussehen auf?", "1 : 2 : 1", ["3 : 1", "1 : 1", "alle gleich"]),
  w("m-9331", "mendel", "Welches Verhältnis gibt es in der F2, wenn man zwei Merkmale gleichzeitig kreuzt (3. Regel)?", "9 : 3 : 3 : 1", ["3 : 1", "1 : 2 : 1", "1 : 1 : 1 : 1"]),
  w("m-rosa", "mendel", "Wunderblume (intermediär): rot × weiß. Welche Farbe hat die F1?", "rosa", ["rot", "weiß", "rot-weiß gefleckt"], { schreib: ["rosa", "rosarot"] }),
  w("m-f2-weiss", "mendel", "Erbsen: Rr × Rr (R rot dominant). Wie viele Nachkommen haben im Durchschnitt weiße Blüten?", "ein Viertel (25 %)", ["die Hälfte (50 %)", "drei Viertel (75 %)", "keine"]),
  w("m-uniform-warum", "mendel", "Warum ist die F1 bei RR × rr uniform?", "Jedes Kind bekommt ein R von einem und ein r vom anderen Elternteil.", ["Weil r verschwindet.", "Weil Mendel nur rote Pflanzen nahm.", "Weil die Pflanzen sich selbst bestäuben."]),
  e("m-erkl-1", "mendel", "Erkläre die 1. Mendel’sche Regel (Uniformitätsregel) mit einem Beispiel.", ["man kreuzt zwei reinerbige Eltern, die sich in einem Merkmal unterscheiden", "alle Nachkommen der F1 sind gleich (uniform)", "Beispiel: RR × rr → alle Rr, alle rot"]),
  e("m-erkl-2", "mendel", "Erkläre die 2. Mendel’sche Regel (Spaltungsregel) mit einem Beispiel.", ["man kreuzt die mischerbigen F1 untereinander: Rr × Rr", "in der F2 kommen beide Merkmale wieder vor", "dominant-rezessiv 3 : 1 (RR, Rr, Rr, rr), intermediär 1 : 2 : 1"]),
  e("m-erkl-3", "mendel", "Erkläre die 3. Mendel’sche Regel (Unabhängigkeitsregel).", ["man kreuzt Lebewesen, die sich in zwei (oder mehr) Merkmalen unterscheiden", "die Merkmale werden unabhängig voneinander vererbt", "es entstehen neue Kombinationen, F2: 9 : 3 : 3 : 1"]),
  e("m-erkl-erbgang", "mendel", "Was ist der Unterschied zwischen dominant-rezessivem und intermediärem Erbgang?", ["dominant-rezessiv: ein Allel setzt sich durch, Rr sieht aus wie RR", "intermediär: beide Allele wirken mit, eine Mischform (rot × weiß → rosa)", "F2: 3 : 1 gegen 1 : 2 : 1"]),

  // ---------- Kreuzungsschemata ----------
  {
    id: "k-erbse-p",
    thema: "schema",
    art: "kreuzung",
    titel: "Erbsen: Blütenfarbe (P-Generation)",
    legende: ["R = rot (dominant)", "r = weiß (rezessiv)"],
    allele: ["R", "r"],
    mutter: ["R", "R"],
    vater: ["r", "r"],
    frage: "Wie sehen alle Nachkommen (F1) aus?",
    richtig: "alle rot",
    falsch: ["alle weiß", "3 rot : 1 weiß", "1 rot : 1 weiß"],
    merke: "1. Mendel’sche Regel: Alle Nachkommen sind gleich (uniform), alle Rr.",
  },
  {
    id: "k-erbse-f1",
    thema: "schema",
    art: "kreuzung",
    titel: "Erbsen: die F1 untereinander",
    legende: ["R = rot (dominant)", "r = weiß (rezessiv)"],
    allele: ["R", "r"],
    mutter: ["R", "r"],
    vater: ["R", "r"],
    frage: "In welchem Verhältnis stehen rote zu weißen Blüten?",
    richtig: "3 rot : 1 weiß",
    falsch: ["1 rot : 1 weiß", "1 rot : 2 rosa : 1 weiß", "alle rot"],
    merke: "2. Mendel’sche Regel: RR, Rr und Rr sind rot, nur rr ist weiß. 3 : 1.",
  },
  {
    id: "k-erbse-rueck",
    thema: "schema",
    art: "kreuzung",
    titel: "Erbsen: mischerbig × weiß",
    legende: ["R = rot (dominant)", "r = weiß (rezessiv)"],
    allele: ["R", "r"],
    mutter: ["R", "r"],
    vater: ["r", "r"],
    frage: "Wie viele Nachkommen sind weiß?",
    richtig: "die Hälfte (50 %)",
    falsch: ["keiner", "ein Viertel (25 %)", "alle"],
    merke: "Zwei Felder Rr (rot), zwei Felder rr (weiß): 1 : 1.",
  },
  {
    id: "k-samen",
    thema: "schema",
    art: "kreuzung",
    titel: "Erbsen: Samenfarbe",
    legende: ["G = gelb (dominant)", "g = grün (rezessiv)"],
    allele: ["G", "g"],
    mutter: ["G", "g"],
    vater: ["G", "g"],
    frage: "Wie viel Prozent der Samen sind grün?",
    richtig: "25 %",
    falsch: ["50 %", "75 %", "0 %"],
    merke: "Nur gg ist grün: ein Feld von vier = 25 %.",
  },
  {
    id: "k-meerschwein",
    thema: "schema",
    art: "kreuzung",
    titel: "Meerschweinchen: Fellfarbe",
    legende: ["S = schwarz (dominant)", "s = weiß (rezessiv)"],
    allele: ["S", "s"],
    mutter: ["S", "s"],
    vater: ["s", "s"],
    frage: "Wie wahrscheinlich ist ein weißes Junges?",
    richtig: "50 %",
    falsch: ["25 %", "75 %", "0 %"],
    merke: "Ss × ss: zwei Felder Ss (schwarz), zwei Felder ss (weiß).",
  },
  {
    id: "k-wunder-p",
    thema: "schema",
    art: "kreuzung",
    titel: "Wunderblume (intermediär): rot × weiß",
    legende: ["R = rot", "W = weiß", "RW = rosa (Mischform)"],
    allele: ["R", "W"],
    mutter: ["R", "R"],
    vater: ["W", "W"],
    frage: "Welche Farbe haben die Nachkommen?",
    richtig: "alle rosa",
    falsch: ["alle rot", "alle weiß", "3 rot : 1 weiß"],
    merke: "Intermediär: RW ist eine Mischform, also rosa. Auch hier ist die F1 uniform.",
  },
  {
    id: "k-wunder-f1",
    thema: "schema",
    art: "kreuzung",
    titel: "Wunderblume (intermediär): rosa × rosa",
    legende: ["R = rot", "W = weiß", "RW = rosa (Mischform)"],
    allele: ["R", "W"],
    mutter: ["R", "W"],
    vater: ["R", "W"],
    frage: "Welche Farben kommen in welchem Verhältnis vor?",
    richtig: "1 rot : 2 rosa : 1 weiß",
    falsch: ["3 rot : 1 weiß", "alle rosa", "1 rot : 1 weiß"],
    merke: "Intermediär spaltet die F2 1 : 2 : 1 auf: RR rot, RW rosa, WW weiß.",
  },
  {
    id: "k-geschlecht",
    thema: "schema",
    art: "kreuzung",
    titel: "Mensch: Mädchen oder Bub?",
    legende: ["X und Y = Geschlechtschromosomen", "Mutter XX, Vater XY"],
    allele: ["X", "Y"],
    mutter: ["X", "X"],
    vater: ["X", "Y"],
    frage: "Wie groß ist die Chance auf ein Mädchen?",
    richtig: "50 %",
    falsch: ["25 %", "75 %", "100 %"],
    merke: "XX = Mädchen, XY = Bub. Das Spermium (X oder Y) entscheidet.",
  },
  {
    id: "k-blut-a0b0",
    thema: "schema",
    art: "kreuzung",
    titel: "Blutgruppen: A0 × B0",
    legende: ["Mutter: Blutgruppe A (A0)", "Vater: Blutgruppe B (B0)", "A und B dominant über 0"],
    allele: ["A", "B", "0"],
    mutter: ["A", "0"],
    vater: ["B", "0"],
    frage: "Welche Blutgruppen kann das Kind haben?",
    richtig: "A, B, AB und 0",
    falsch: ["nur AB", "nur A oder B", "A, B und AB"],
    merke: "AB = AB, A0 = A, B0 = B, 00 = 0. Alle vier sind möglich, je 25 %.",
  },
  {
    id: "k-blut-ab00",
    thema: "schema",
    art: "kreuzung",
    titel: "Blutgruppen: AB × 00",
    legende: ["Mutter: Blutgruppe AB", "Vater: Blutgruppe 0 (00)"],
    allele: ["A", "B", "0"],
    mutter: ["A", "B"],
    vater: ["0", "0"],
    frage: "Welche Blutgruppen kann das Kind haben?",
    richtig: "A oder B",
    falsch: ["AB oder 0", "nur AB", "A, B, AB oder 0"],
    merke: "A0 ist Blutgruppe A, B0 ist Blutgruppe B. AB und 0 sind hier nicht möglich.",
  },
  {
    id: "k-blut-a0a0",
    thema: "schema",
    art: "kreuzung",
    titel: "Blutgruppen: A0 × A0",
    legende: ["Mutter: Blutgruppe A (A0)", "Vater: Blutgruppe A (A0)"],
    allele: ["A", "B", "0"],
    mutter: ["A", "0"],
    vater: ["A", "0"],
    frage: "Kann das Kind Blutgruppe 0 haben?",
    richtig: "Ja, mit 25 %",
    falsch: ["Nein, nie", "Ja, mit 50 %", "Ja, immer"],
    merke: "Bekommt das Kind von beiden das 0, ist es 00: Blutgruppe 0.",
  },
  {
    id: "k-blut-aab0",
    thema: "schema",
    art: "kreuzung",
    titel: "Blutgruppen: AA × B0",
    legende: ["Mutter: Blutgruppe A (AA)", "Vater: Blutgruppe B (B0)"],
    allele: ["A", "B", "0"],
    mutter: ["A", "A"],
    vater: ["B", "0"],
    frage: "Welche Blutgruppen kann das Kind haben?",
    richtig: "AB oder A",
    falsch: ["nur AB", "A, B oder 0", "B oder 0"],
    merke: "AB ist Blutgruppe AB, A0 ist Blutgruppe A.",
  },
  {
    id: "k-rhesus",
    thema: "schema",
    art: "kreuzung",
    titel: "Rhesusfaktor: Dd × Dd",
    legende: ["D = Rh-positiv (dominant)", "d = rh-negativ (rezessiv)"],
    allele: ["D", "d"],
    mutter: ["D", "d"],
    vater: ["D", "d"],
    frage: "Wie wahrscheinlich ist ein rh-negatives Kind?",
    richtig: "25 %",
    falsch: ["0 %", "50 %", "75 %"],
    merke: "Nur dd ist rh-negativ: ein Feld von vier.",
  },
  w("s-feld", "schema", "Wie viel Prozent der Nachkommen steht ein Feld im Kreuzungsschema (2 × 2) für?", "25 %", ["50 %", "10 %", "100 %"]),
  w("s-gameten", "schema", "Welche Keimzellen bildet ein Elternteil mit dem Genotyp Rr?", "R und r", ["nur R", "nur r", "Rr und Rr"], { merke: "Jede Keimzelle bekommt nur EIN Allel." }),
  w("s-oben", "schema", "Was schreibt man im Kreuzungsschema an den Rand (oben und links)?", "die Keimzellen der Eltern", ["die Phänotypen der Kinder", "die Blutgruppen der Großeltern", "die Chromosomenzahl"]),

  // ---------- Vererbung beim Menschen ----------
  w("h-frau", "mensch", "Welche Geschlechtschromosomen hat eine Frau?", "XX", ["XY", "YY", "nur X"], { schreib: ["XX"] }),
  w("h-mann", "mensch", "Welche Geschlechtschromosomen hat ein Mann?", "XY", ["XX", "YY", "nur Y"], { schreib: ["XY"] }),
  w("h-wer", "mensch", "Wer bestimmt das Geschlecht des Kindes?", "das Spermium des Vaters", ["die Eizelle der Mutter", "das Wetter in der Schwangerschaft", "die Hormone der Mutter"], {
    merke: "Eizellen haben immer ein X. Spermien haben ein X oder ein Y.",
  }),
  w("h-eizelle", "mensch", "Welches Geschlechtschromosom hat jede Eizelle?", "ein X", ["ein Y", "X oder Y", "keines"]),
  w("h-ab0", "mensch", "Welche Blutgruppen gibt es im AB0-System?", "A, B, AB und 0", ["A, B und C", "A, B und 0", "1, 2, 3 und 4"]),
  w("h-a-geno", "mensch", "Welche Genotypen kann ein Mensch mit Blutgruppe A haben?", "AA oder A0", ["nur AA", "nur A0", "AB oder A0"]),
  w("h-b-geno", "mensch", "Welche Genotypen kann ein Mensch mit Blutgruppe B haben?", "BB oder B0", ["nur BB", "nur B0", "AB oder B0"]),
  w("h-0-geno", "mensch", "Welchen Genotyp hat ein Mensch mit Blutgruppe 0?", "00", ["A0", "B0", "0 und A"], { schreib: ["00"] }),
  w("h-ab-geno", "mensch", "Welchen Genotyp hat ein Mensch mit Blutgruppe AB?", "AB", ["A0", "B0", "AA"], { schreib: ["AB"] }),
  w("h-kodominant", "mensch", "Warum zeigt ein Mensch mit AB beide Merkmale?", "A und B sind gleich stark (kodominant).", ["B ist dominant über A.", "A ist rezessiv.", "Er hat drei Allele."]),
  w("h-0-dominant", "mensch", "Wie verhält sich das Allel 0 zu A und B?", "0 ist rezessiv, A und B setzen sich durch.", ["0 ist dominant.", "0 ist kodominant mit A.", "0 wird nie vererbt."]),
  w("h-00", "mensch", "Mutter Blutgruppe 0, Vater Blutgruppe 0. Welche Blutgruppe hat das Kind?", "0", ["A", "B", "AB"], { schreib: ["0", "Null", "00"] }),
  w("h-ab-0", "mensch", "Mutter AB, Vater 0. Kann das Kind Blutgruppe AB haben?", "Nein, nur A oder B.", ["Ja, immer.", "Ja, zu 50 %.", "Ja, zu 25 %."]),
  w("h-rhesus", "mensch", "Rhesusfaktor: Welches Merkmal ist dominant?", "Rh-positiv", ["rh-negativ", "beide gleich stark", "keines"]),
  w("h-trisomie", "mensch", "Was ist bei Trisomie 21 (Down-Syndrom) anders?", "Das Chromosom 21 ist dreimal da.", ["Ein Chromosom fehlt.", "Es gibt nur 21 Chromosomen.", "Das Y-Chromosom fehlt."]),
  w("h-47", "mensch", "Wie viele Chromosomen haben die Zellen bei Trisomie 21?", "47", ["46", "45", "21"], { schreib: ["47"] }),
  e("h-erkl-geschlecht", "mensch", "Erkläre, wie das Geschlecht eines Kindes festgelegt wird.", ["Frau XX, Mann XY", "Eizelle immer X, Spermium X oder Y", "Spermium mit X → Mädchen, mit Y → Bub, je 50 %"]),
  e("h-erkl-blut", "mensch", "Erkläre die Vererbung der Blutgruppen (AB0).", ["drei Allele: A, B und 0; jeder Mensch hat zwei davon (eines von jedem Elternteil)", "A und B sind dominant über 0", "A und B zusammen sind kodominant: Blutgruppe AB; 00 ist Blutgruppe 0"]),

  // ---------- Gentechnik ----------
  w("t-rot", "gentechnik", "Welcher Zweig der Gentechnik gehört zur Medizin?", "rote Gentechnik", ["grüne Gentechnik", "weiße Gentechnik", "blaue Gentechnik"], { schreib: ["rote Gentechnik", "rote", "rot"] }),
  w("t-gruen", "gentechnik", "Welcher Zweig der Gentechnik betrifft Pflanzen und Landwirtschaft?", "grüne Gentechnik", ["rote Gentechnik", "weiße Gentechnik", "gelbe Gentechnik"], { schreib: ["grüne Gentechnik", "grüne", "grün"] }),
  w("t-weiss", "gentechnik", "Welcher Zweig der Gentechnik wird in der Industrie eingesetzt?", "weiße Gentechnik", ["rote Gentechnik", "grüne Gentechnik", "schwarze Gentechnik"], { schreib: ["weiße Gentechnik", "weiße", "weiß"] }),
  w("t-insulin", "gentechnik", "Bakterien stellen Insulin für Menschen mit Diabetes her. Welcher Zweig ist das?", "rote Gentechnik", ["grüne Gentechnik", "weiße Gentechnik"]),
  w("t-mais", "gentechnik", "Ein Mais wurde so verändert, dass er Schädlinge abwehrt. Welcher Zweig ist das?", "grüne Gentechnik", ["rote Gentechnik", "weiße Gentechnik"]),
  w("t-wasch", "gentechnik", "Bakterien erzeugen Enzyme für Waschmittel. Welcher Zweig ist das?", "weiße Gentechnik", ["rote Gentechnik", "grüne Gentechnik"]),
  w("t-gentest", "gentechnik", "Ein Arzt untersucht die DNA auf eine Erbkrankheit (Gentest). Welcher Zweig ist das?", "rote Gentechnik", ["grüne Gentechnik", "weiße Gentechnik"]),
  w("t-reis", "gentechnik", "„Goldener Reis“ bekam ein Gen für mehr Vitamin A. Welcher Zweig ist das?", "grüne Gentechnik", ["rote Gentechnik", "weiße Gentechnik"]),
  w("t-was", "gentechnik", "Was ist Gentechnik?", "Erbinformation gezielt verändern oder Gene übertragen", ["Tiere nur durch Auslese züchten", "Pflanzen besser düngen", "Krankheiten mit Antibiotika heilen"]),
  w("t-risiko", "gentechnik", "Was ist ein Risiko der grünen Gentechnik?", "Veränderte Pflanzen können sich in der Natur ausbreiten.", ["Die Pflanzen haben danach keine DNA mehr.", "Die Pflanzen brauchen kein Wasser mehr.", "Die Ernte wird automatisch kleiner."]),
  w("t-chance", "gentechnik", "Was ist eine Chance der roten Gentechnik?", "neue Medikamente, z. B. Insulin aus Bakterien", ["Waschmittel, die besser reinigen", "Mais, der Schädlinge abwehrt", "Biotreibstoff für Autos"]),
  b("b-gentherapie", "gentechnik", "Gentherapie", "Ein krankes Gen in den Zellen eines Menschen wird ersetzt oder repariert."),
  b("b-gentechnik", "gentechnik", "Gentechnik", "Methoden, mit denen man Erbinformation gezielt verändert oder Gene überträgt."),
  e("t-erkl-zweige", "gentechnik", "Nenne die drei Zweige der Gentechnik mit je einem Beispiel.", ["rot (Medizin): z. B. Insulin aus Bakterien, Gentests", "grün (Landwirtschaft): z. B. Mais, der Schädlinge abwehrt", "weiß (Industrie): z. B. Enzyme für Waschmittel"]),
  e("t-erkl-chancen", "gentechnik", "Nenne Chancen und Risiken der Gentechnik.", ["Chancen: neue Medikamente, Pflanzen mit mehr Ertrag oder mehr Vitaminen", "Risiken: unbekannte Folgen für Natur und Gesundheit", "veränderte Pflanzen breiten sich aus, Abhängigkeit von Saatgutfirmen"]),

  // ---------- Nervensystem (ZNS und PNS) ----------
  w("n-zns", "nerven", "Woraus besteht das zentrale Nervensystem (ZNS)?", "Gehirn und Rückenmark", ["Gehirn und Herz", "alle Nerven in Armen und Beinen", "Rückenmark und Muskeln"]),
  w("n-pns", "nerven", "Was gehört zum peripheren Nervensystem (PNS)?", "alle Nerven außerhalb von Gehirn und Rückenmark", ["nur das Gehirn", "nur das Rückenmark", "die Wirbelsäule"]),
  w("n-zns-abk", "nerven", "Wofür steht ZNS?", "zentrales Nervensystem", ["zelluläres Nervensystem", "zweites Nervensystem", "Zellkern-Nerven-System"], { schreib: ["zentrales Nervensystem", "Zentralnervensystem"] }),
  w("n-pns-abk", "nerven", "Wofür steht PNS?", "peripheres Nervensystem", ["paralleles Nervensystem", "privates Nervensystem", "primäres Nervensystem"], { schreib: ["peripheres Nervensystem"] }),
  w("n-neuron", "nerven", "Wie heißt eine Nervenzelle mit dem Fachwort?", "Neuron", ["Nephron", "Neutron", "Hormon"], { schreib: ["Neuron", "Neuronen"] }),
  w("n-synapse", "nerven", "Wie heißt die Verbindungsstelle zwischen zwei Nervenzellen?", "Synapse", ["Dendrit", "Axon", "Zellkern"], { schreib: ["Synapse", "Synapsen"] }),
  w("n-axon", "nerven", "Welcher Teil der Nervenzelle leitet das Signal weiter, oft über eine lange Strecke?", "Axon (Nervenfaser)", ["Dendrit", "Zellkern", "Synapse"], { schreib: ["Axon", "Nervenfaser", "Neurit"] }),
  w("n-dendrit", "nerven", "Welche Teile der Nervenzelle nehmen Signale von anderen Zellen auf?", "Dendriten", ["Axon", "Endknöpfchen", "Zellkern"], { schreib: ["Dendriten", "Dendrit"] }),
  w("n-motorisch", "nerven", "Welche Nerven bringen Befehle vom ZNS zu den Muskeln?", "motorische Nerven", ["sensible Nerven", "Sehnerven", "Riechnerven"], { schreib: ["motorische Nerven", "motorische", "motorisch", "motorischer Nerv"] }),
  w("n-sensibel", "nerven", "Welche Nerven melden von den Sinnesorganen zum ZNS?", "sensible Nerven", ["motorische Nerven", "Muskelnerven", "Hormonnerven"], {
    schreib: ["sensible Nerven", "sensorische Nerven", "sensible", "sensorische", "sensibel", "sensorisch", "sensibler Nerv"],
  }),
  w("n-elektrisch", "nerven", "Wie läuft ein Signal durch eine Nervenzelle?", "als elektrischer Impuls", ["mit dem Blut", "als Schallwelle", "als Licht"]),
  w("n-chemisch", "nerven", "Wie wird ein Signal an der Synapse auf die nächste Zelle übertragen?", "mit chemischen Botenstoffen", ["mit Licht", "mit roten Blutkörperchen", "mit Wärme"]),
  w("n-reflex", "nerven", "Was ist ein Reflex?", "eine schnelle, unbewusste Reaktion über das Rückenmark", ["eine gut überlegte Bewegung", "ein Hormon", "eine Krankheit der Nerven"]),
  w("n-knie", "nerven", "Über welchen Teil des ZNS läuft der Kniesehnenreflex?", "über das Rückenmark", ["über das Großhirn", "über das Kleinhirn", "über die Hypophyse"], { schreib: ["Rückenmark", "über das Rückenmark"] }),
  w("n-herd", "nerven", "Du ziehst die Hand von der heißen Herdplatte weg, bevor du den Schmerz spürst. Warum geht das so schnell?", "Es ist ein Reflex, das Rückenmark schaltet direkt um.", ["Das Großhirn denkt besonders schnell.", "Hormone fließen in die Hand.", "Die Haut bewegt die Hand selbst."]),
  w("n-schutz", "nerven", "Was schützt das Rückenmark?", "die Wirbelsäule", ["der Schädel", "die Rippen", "das Becken"], { schreib: ["Wirbelsäule", "die Wirbelsäule", "Wirbel"] }),
  w("n-aufgabe", "nerven", "Welche Aufgaben hat das Nervensystem?", "Reize aufnehmen, weiterleiten, verarbeiten und den Körper steuern", ["nur Blut durch den Körper pumpen", "nur Nahrung verdauen", "nur Hormone ins Blut abgeben"]),
  b("b-reflex", "nerven", "Reflex", "Eine schnelle, unbewusste Reaktion auf einen Reiz, die über das Rückenmark läuft.", ["Reflexe"]),
  b("b-synapse", "nerven", "Synapse", "Die Kontaktstelle zwischen zwei Nervenzellen oder zwischen Nerv und Muskel.", ["Synapsen"]),
  b("b-reiz", "nerven", "Reiz", "Ein Einfluss von außen oder innen, den Sinneszellen aufnehmen (Licht, Schall, Hitze, Druck).", ["Reize"]),
  e("n-erkl-reflex", "nerven", "Beschreibe den Weg eines Reflexes (Reflexbogen).", ["ein Reiz trifft auf Sinneszellen (z. B. Hitze)", "ein sensibler Nerv leitet ins Rückenmark, dort wird direkt umgeschaltet", "ein motorischer Nerv bringt den Befehl zum Muskel, ohne das Gehirn, sehr schnell"]),
  e("n-erkl-zelle", "nerven", "Beschreibe den Bau einer Nervenzelle.", ["Zellkörper mit Zellkern", "Dendriten nehmen Signale auf, das Axon (Nervenfaser) leitet weiter", "Endknöpfchen geben das Signal an der Synapse mit Botenstoffen weiter"]),
  e("n-erkl-zns", "nerven", "Erkläre den Unterschied zwischen ZNS und PNS.", ["ZNS: Gehirn und Rückenmark, verarbeitet und steuert", "PNS: alle Nerven außerhalb davon", "das PNS verbindet das ZNS mit Sinnesorganen und Muskeln"]),

  // ---------- Gehirn ----------
  w("h-gross", "gehirn", "Welcher Teil des Gehirns ist für Denken, Lernen und Gedächtnis zuständig?", "Großhirn", ["Kleinhirn", "Hirnstamm", "Rückenmark"], { schreib: ["Großhirn", "Grosshirn", "Großhirnrinde"] }),
  w("h-klein", "gehirn", "Welcher Teil des Gehirns steuert Gleichgewicht und Bewegungsabläufe?", "Kleinhirn", ["Großhirn", "Hirnstamm", "Zwischenhirn"], { schreib: ["Kleinhirn"] }),
  w("h-stamm", "gehirn", "Welcher Teil des Gehirns steuert lebenswichtige Dinge wie Atmung und Herzschlag?", "Hirnstamm", ["Großhirn", "Kleinhirn", "Großhirnrinde"], { schreib: ["Hirnstamm", "Stammhirn", "verlängertes Mark", "Nachhirn"] }),
  w("h-zwischen", "gehirn", "Welcher Teil des Gehirns regelt Körpertemperatur, Hunger und Durst?", "Zwischenhirn", ["Kleinhirn", "Großhirn", "Rückenmark"], { schreib: ["Zwischenhirn", "Hypothalamus"], merke: "Im Zwischenhirn liegt der Hypothalamus." }),
  w("h-seite", "gehirn", "Die linke Gehirnhälfte steuert …", "die rechte Körperseite", ["die linke Körperseite", "nur den Kopf", "beide Seiten gleich"]),
  w("h-schutz", "gehirn", "Was schützt das Gehirn?", "Schädel, Hirnhäute und Hirnflüssigkeit", ["die Wirbelsäule", "die Rippen", "nur die Haare"]),
  w("h-schwanken", "gehirn", "Nach einem Unfall schwankt jemand und kann nicht mehr gerade gehen. Welcher Teil ist wohl verletzt?", "Kleinhirn", ["Großhirn", "Hirnstamm", "Hypophyse"]),
  w("h-sprache", "gehirn", "Wo im Gehirn entstehen Sprache und bewusstes Denken?", "in der Großhirnrinde", ["im Kleinhirn", "im Hirnstamm", "im Rückenmark"]),
  w("h-rinde", "gehirn", "Wie heißt die äußere, gefurchte Schicht des Großhirns?", "Großhirnrinde", ["Hirnhaut", "Hirnstamm", "Kleinhirnrinde"], { schreib: ["Großhirnrinde", "Hirnrinde", "Kortex", "Cortex"] }),
  w("h-haelften", "gehirn", "Aus wie vielen Hälften besteht das Großhirn?", "2", ["3", "4", "1"], { schreib: ["2", "zwei"] }),
  w("h-rad", "gehirn", "Du fährst Rad, ohne nachzudenken, und hältst das Gleichgewicht. Welcher Teil hilft dir dabei vor allem?", "Kleinhirn", ["Großhirn", "Zwischenhirn", "Hypophyse"]),
  e("h-erkl-teile", "gehirn", "Nenne vier Teile des Gehirns und ihre Aufgaben.", ["Großhirn: Denken, Lernen, Gedächtnis, Sprache, Bewusstsein", "Kleinhirn: Gleichgewicht, Bewegungsabläufe", "Zwischenhirn: Temperatur, Hunger, Durst, Hormone (Hypothalamus)", "Hirnstamm: Atmung, Herzschlag, Schlucken"]),

  // ---------- Unwillkürliches Nervensystem ----------
  w("v-herz", "vegetativ", "Welches Nervensystem steuert den Herzschlag, ohne dass wir es wollen?", "das unwillkürliche (vegetative) Nervensystem", ["das willkürliche Nervensystem", "nur das Kleinhirn", "die motorischen Nerven der Beine"], {
    schreib: ["unwillkürliches Nervensystem", "vegetatives Nervensystem", "autonomes Nervensystem", "unwillkürlich", "vegetativ", "autonom", "unwillkürliche Nervensystem", "vegetative Nervensystem"],
  }),
  w("v-willkuer", "vegetativ", "Was steuert das willkürliche Nervensystem?", "bewusste Bewegungen der Skelettmuskeln", ["den Herzschlag", "die Verdauung", "das Schwitzen"]),
  w("v-beispiel", "vegetativ", "Was steuert das unwillkürliche Nervensystem?", "die Verdauung", ["einen Ball werfen", "sprechen", "winken"]),
  w("v-beispiel2", "vegetativ", "Was davon kannst du NICHT mit deinem Willen steuern?", "wie weit deine Pupillen sind", ["deinen Arm heben", "deine Augen schließen", "ein Wort sagen"]),
  w("v-teile", "vegetativ", "Welche zwei Teile hat das unwillkürliche Nervensystem?", "Sympathikus und Parasympathikus", ["Großhirn und Kleinhirn", "ZNS und PNS", "Axon und Dendrit"]),
  w("v-gegen", "vegetativ", "Warum nennt man Sympathikus und Parasympathikus Gegenspieler?", "Sie wirken auf dieselben Organe, aber entgegengesetzt.", ["Sie liegen in verschiedenen Körperhälften.", "Einer wirkt nur bei Frauen, einer nur bei Männern.", "Sie kämpfen gegen Krankheitserreger."]),
  w("v-gegenspieler", "vegetativ", "Wie nennt man zwei Nerven oder Muskeln, die entgegengesetzt wirken?", "Gegenspieler", ["Partner", "Zwillinge", "Nachbarn"], { schreib: ["Gegenspieler", "Antagonisten", "Antagonist"] }),
  e("v-erkl", "vegetativ", "Erkläre den Unterschied zwischen willkürlichem und unwillkürlichem Nervensystem.", ["willkürlich: was wir bewusst steuern, Skelettmuskeln (gehen, greifen, sprechen)", "unwillkürlich (vegetativ): innere Organe ohne unseren Willen (Herz, Atmung, Verdauung)", "das unwillkürliche hat Sympathikus und Parasympathikus"]),

  // ---------- Sympathikus und Parasympathikus ----------
  w("y-kampf", "sympathikus", "Welcher Teil macht den Körper bereit für Kampf oder Flucht?", "Sympathikus", ["Parasympathikus", "Kleinhirn", "Rückenmark"], { schreib: ["Sympathikus"] }),
  w("y-ruhe", "sympathikus", "Welcher Teil sorgt für Ruhe, Erholung und Verdauung?", "Parasympathikus", ["Sympathikus", "Großhirn", "Hypophyse"], { schreib: ["Parasympathikus"] }),
  z("y-herz-schnell", "Das Herz schlägt schneller.", "Sympathikus"),
  z("y-herz-langsam", "Der Herzschlag wird langsamer.", "Parasympathikus"),
  z("y-verdauung-an", "Die Verdauung wird angeregt.", "Parasympathikus"),
  z("y-verdauung-aus", "Die Verdauung wird gebremst.", "Sympathikus"),
  z("y-pupille-weit", "Die Pupillen werden weit.", "Sympathikus"),
  z("y-pupille-eng", "Die Pupillen werden eng.", "Parasympathikus"),
  z("y-blutdruck", "Der Blutdruck steigt.", "Sympathikus"),
  z("y-atmung-ruhig", "Die Atmung wird ruhig und langsam.", "Parasympathikus"),
  z("y-bronchien", "Die Bronchien werden weiter, damit mehr Luft in die Lunge kommt.", "Sympathikus"),
  z("y-sofa", "Du liegst nach dem Essen gemütlich auf dem Sofa.", "Parasympathikus"),
  z("y-hund", "Ein großer Hund rennt bellend auf dich zu.", "Sympathikus"),
  z("y-referat", "Du stehst vor der Klasse und hältst ein Referat.", "Sympathikus"),
  z("y-schlaf", "Du schläfst tief und fest.", "Parasympathikus"),
  z("y-sprint", "Du sprintest beim Sportfest um die Wette.", "Sympathikus"),
  e("y-erkl", "sympathikus", "Vergleiche Sympathikus und Parasympathikus: je drei Wirkungen.", ["Sympathikus: Herz schneller, Blutdruck höher, Pupillen weit, Verdauung gebremst (Leistung, Stress)", "Parasympathikus: Herz langsamer, Atmung ruhig, Pupillen eng, Verdauung angeregt (Ruhe)", "sie sind Gegenspieler im unwillkürlichen Nervensystem"]),

  // ---------- Hormone ----------
  w("o-was", "hormone", "Was sind Hormone?", "chemische Botenstoffe, die mit dem Blut transportiert werden", ["elektrische Signale in den Nerven", "Zellen, die Krankheitserreger fressen", "Teile der DNA"]),
  w("o-blut", "hormone", "Wie kommen Hormone zu ihrem Zielorgan?", "mit dem Blut", ["über die Nerven", "über die Luft", "über die Muskeln"], { schreib: ["mit dem Blut", "Blut", "über das Blut", "Blutkreislauf", "mit dem Blutkreislauf"] }),
  w("o-insulin", "hormone", "Welches Hormon senkt den Blutzuckerspiegel?", "Insulin", ["Adrenalin", "Testosteron", "Glukagon"], { schreib: ["Insulin"] }),
  w("o-glukagon", "hormone", "Welches Hormon hebt den Blutzuckerspiegel, wenn er zu niedrig ist?", "Glukagon", ["Insulin", "Östrogen", "Thyroxin"], { schreib: ["Glukagon", "Glucagon"] }),
  w("o-bauch", "hormone", "Wo wird Insulin gebildet?", "in der Bauchspeicheldrüse", ["in der Schilddrüse", "in der Leber", "in der Nebenniere"], { schreib: ["Bauchspeicheldrüse", "in der Bauchspeicheldrüse", "Pankreas"] }),
  w("o-diabetes", "hormone", "Welche Krankheit entsteht, wenn der Körper zu wenig Insulin bildet?", "Diabetes (Zuckerkrankheit)", ["Grippe", "Allergie", "Kropf"], { schreib: ["Diabetes", "Zuckerkrankheit", "Diabetes mellitus"] }),
  w("o-adrenalin", "hormone", "Wie heißt das Stresshormon aus den Nebennieren?", "Adrenalin", ["Insulin", "Melatonin", "Östrogen"], { schreib: ["Adrenalin"] }),
  w("o-adrenalin-wirkt", "hormone", "Was macht Adrenalin im Körper?", "Herz schneller, mehr Energie für Kampf oder Flucht", ["Man wird müde und schläft ein.", "Der Blutzucker sinkt stark.", "Die Verdauung wird angeregt."]),
  w("o-hypophyse", "hormone", "Welche Hormondrüse nennt man die „Chefdrüse“?", "Hypophyse (Hirnanhangdrüse)", ["Schilddrüse", "Bauchspeicheldrüse", "Nebenniere"], { schreib: ["Hypophyse", "Hirnanhangdrüse", "Hirnanhangsdrüse"] }),
  w("o-wachstum", "hormone", "Wo wird das Wachstumshormon gebildet?", "in der Hypophyse", ["in der Schilddrüse", "in den Nebennieren", "in der Bauchspeicheldrüse"], { schreib: ["Hypophyse", "in der Hypophyse", "Hirnanhangdrüse"] }),
  w("o-schild", "hormone", "Welche Drüse braucht Jod und regt mit ihrem Hormon den Stoffwechsel an?", "Schilddrüse", ["Hypophyse", "Bauchspeicheldrüse", "Nebenniere"], { schreib: ["Schilddrüse"] }),
  w("o-testo", "hormone", "Welches Hormon bilden die Hoden?", "Testosteron", ["Östrogen", "Insulin", "Adrenalin"], { schreib: ["Testosteron"] }),
  w("o-oestro", "hormone", "Welches Hormon bilden die Eierstöcke?", "Östrogen", ["Testosteron", "Insulin", "Thyroxin"], { schreib: ["Östrogen", "Oestrogen", "Estrogen", "Progesteron"] }),
  w("o-schloss", "hormone", "Was bedeutet das Schlüssel-Schloss-Prinzip bei Hormonen?", "Ein Hormon wirkt nur an Zellen mit dem passenden Rezeptor.", ["Hormone öffnen die Blutgefäße.", "Jedes Hormon wirkt in allen Zellen gleich.", "Hormone sperren die Nerven ab."]),
  w("o-vergleich", "hormone", "Wie unterscheiden sich Hormone von Nervensignalen?", "Hormone wirken langsamer, aber länger.", ["Hormone sind schneller als Nerven.", "Hormone wirken nur im Gehirn.", "Hormone sind elektrische Signale."]),
  w("o-druesen", "hormone", "Wie heißen Drüsen, die ihre Stoffe direkt ins Blut abgeben?", "Hormondrüsen", ["Schweißdrüsen", "Speicheldrüsen", "Tränendrüsen"], { schreib: ["Hormondrüsen", "Hormondrüse", "endokrine Drüsen", "innere Drüsen"] }),
  w("o-pubertaet", "hormone", "Welche Hormone steuern die Pubertät?", "die Geschlechtshormone (Östrogen, Testosteron)", ["Insulin und Glukagon", "Adrenalin allein", "keine, nur die Nerven"]),
  b("b-hormon", "hormone", "Hormon", "Ein chemischer Botenstoff, den eine Drüse ins Blut abgibt und der an einem Zielorgan wirkt.", ["Hormone"]),
  b("b-rezeptor", "hormone", "Rezeptor", "Der Empfänger an einer Zelle, zu dem nur ein bestimmtes Hormon passt (wie Schloss und Schlüssel).", ["Rezeptoren"]),
  e("o-erkl-zucker", "hormone", "Erkläre, wie der Blutzuckerspiegel geregelt wird.", ["nach dem Essen steigt der Blutzucker", "die Bauchspeicheldrüse gibt Insulin ab, die Zellen nehmen Zucker auf, der Blutzucker sinkt", "ist er zu niedrig, hebt Glukagon ihn wieder; fehlt Insulin: Diabetes"]),
  e("o-erkl-vergleich", "hormone", "Vergleiche Nervensystem und Hormonsystem.", ["Nerven: elektrische Signale, sehr schnell, kurz, gezielt", "Hormone: Botenstoffe im Blut, langsamer, wirken länger", "beide steuern den Körper; Hormone wirken nur an Zellen mit passendem Rezeptor"]),
];

/**
 * Die Übungen für „Bio Test 4.Klasse Vorbereitung De La Salle“ (lib/biotest.ts): die 16 Übungen, die niko am
 * 2026-11-23 von der Lehrkraft geschickt hat, im Wortlaut der Lehrkraft (Überschrift, Auftrag, Schulbuchseite,
 * Wortkasten, Text). Nur die Auswahllisten (Out of Africa, Reflex, Sympathicus) waren auf den Bildern zu, ihre
 * falschen Antworten sind ausgedacht und klar falsch. Bilder: public/spiele/biotest/ (aus den Bildern der Lehrkraft
 * ausgeschnitten, Nummern statt grauer Felder).
 *
 * Lücken im Text: `[[id]]`; ein Absatz endet mit einer Leerzeile, „\n“ ist ein Zeilenumbruch.
 */

export type Teil = "evolution" | "nerven";

/** Eine Lücke, ein Feld oder ein Schritt: was richtig ist und was man wählen kann. */
export type Stelle = {
  id: string;
  richtig: string;
  /** Eigene Auswahl (Auswahlliste); sonst der Wortkasten der Übung */
  optionen?: string[];
  /** Selbst schreiben (Fachbegriffe 2): so sieht die Lücke aus, z. B. „e _ _ ktr _ _ _ _ _ _“ */
  muster?: string;
  /** Beim Schreiben auch richtig */
  auch?: string[];
  /** Was vor dem Feld steht: Beschreibung, Nummer im Bild, Satz bei der Reihenfolge */
  text?: string;
  /** Der Satz nach einem Fehler; sonst der Satz aus dem Text mit der Lösung */
  merke?: string;
};

type Basis = { id: string; teil: Teil; titel: string; auftrag: string; seite: string; stellen: Stelle[] };

export type Uebung =
  /** Lückentext: mit Wortkasten (`bank`), mit Auswahllisten (`optionen` je Lücke) oder zum Schreiben (`muster`) */
  | (Basis & { art: "luecken"; text: string; bank?: string[] })
  /** Zuordnen: Beschreibung links, Begriff aus dem Wortkasten rechts */
  | (Basis & { art: "liste"; bank: string[] })
  /** Grafik beschriften: nummerierte Felder im Bild */
  | (Basis & { art: "bild"; bank: string[]; bild: { src: string; alt: string; breite: number; hoehe: number } })
  /** Tabelle: Zeilen mit festen Zellen und Feldern (`{ id }`); Bilder im Wortkasten heißen `bild:<name>` */
  | (Basis & { art: "tabelle"; bank: string[]; zeilen: { titel: string; zellen: (string | { id: string })[] }[] })
  /** Reihenfolge: Sätze antippen, in der richtigen Reihenfolge; `richtig` ist die Nummer */
  | (Basis & { art: "reihenfolge" })
  /** Zwei Spalten: jeden Begriff in die richtige Spalte */
  | (Basis & { art: "spalten"; spalten: [string, string] });

/** Bilder im Wortkasten der Tabelle (3 Vertreter der Hominini) */
export const BILDER: Record<string, { src: string; alt: string }> = {
  "bild:gehirn-1": { src: "/spiele/biotest/gehirn-1.webp", alt: "Schädel mit kleinem Gehirn" },
  "bild:gehirn-2": { src: "/spiele/biotest/gehirn-2.webp", alt: "Schädel mit mittlerem, langem Gehirn" },
  "bild:gehirn-3": { src: "/spiele/biotest/gehirn-3.webp", alt: "Schädel mit großem, rundem Gehirn" },
  "bild:kopf-1": { src: "/spiele/biotest/kopf-1.webp", alt: "Kopf, sehr affenähnlich" },
  "bild:kopf-2": { src: "/spiele/biotest/kopf-2.webp", alt: "Kopf mit Überaugenwulst und Bart" },
  "bild:kopf-3": { src: "/spiele/biotest/kopf-3.webp", alt: "Kopf eines heutigen Menschen" },
};

export const TEILE: { id: Teil; titel: string; seiten: string }[] = [
  { id: "evolution", titel: "Evolution des Menschen", seiten: "Schulbuch S. 12–15" },
  { id: "nerven", titel: "Nervensystem", seiten: "Schulbuch S. 19–27" },
];

const S = (id: string, richtig: string, mehr: Partial<Stelle> = {}): Stelle => ({ id, richtig, ...mehr });

export const UEBUNGEN: Uebung[] = [
  // ---------- Evolution des Menschen ----------
  {
    id: "primaten",
    teil: "evolution",
    art: "luecken",
    titel: "Mensch und Menschenaffen.",
    auftrag: "Ergänze den Text mit den richtigen Begriffen.",
    seite: "Schulbuch S. 12",
    bank: ["zehn", "„Affenlücke“", "Gang", "Hominini", "Mitte", "hinten", "Fossilfunde", "Menschenaffen", "Primaten"],
    text:
      "Im System der Tiere gehört der Mensch zur Ordnung der Herrentiere (= [[p1]])\n\n" +
      "Untersuchungen des Erbguts von [[p2]] (Schimpansen, Zwergschimpansen, Gorillas, Orang-Utans) haben ergeben, dass ihre Entwicklung seit etwa [[p3]] Millionen Jahren unabhängig von der des Menschen und seiner Vorfahren (= [[p4]]) verläuft.\n\n" +
      "Die meisten Unterschiede betreffen den Knochenbau und die Zähne, also jene Hartteile, die auch fossil erhalten bleiben können. Deshalb kann man [[p5]] dem Menschen bzw. Menschenaffen zuordnen. Als wesentliches Merkmal von Menschen gilt der aufrechte [[p6]]. Menschenaffen können nur zeitweise und nur über kurze Strecken aufrecht gehen.\n\n" +
      "Bei Menschenaffen gibt es zwischen Eck- und Schneidezähnen einen Zwischenraum, die sogenannte [[p7]].\n\n" +
      "Die Ansatzstelle der Wirbelsäule (= Hinterhauptsloch) liegt bei Menschen etwa in der [[p8]] der Schädelbasis, bei Affen weit [[p9]].",
    stellen: [
      S("p1", "Primaten"),
      S("p2", "Menschenaffen"),
      S("p3", "zehn"),
      S("p4", "Hominini"),
      S("p5", "Fossilfunde"),
      S("p6", "Gang"),
      S("p7", "„Affenlücke“"),
      S("p8", "Mitte"),
      S("p9", "hinten"),
    ],
  },
  {
    id: "vorfahren",
    teil: "evolution",
    art: "luecken",
    titel: "Wichtige Vorfahren des heutigen Menschen.",
    auftrag: "Ergänze den Text mit den richtigen Begriffen.",
    seite: "Schulbuch S. 12, 13 - Kap. 3,4 und 7",
    bank: ["300", "3,2", "7", "Australopithecus afarensis", "neanderthalensis", "40", "130", "erectus", "sapiens", "Sahelanthropus tchadensis"],
    text:
      "Der bisher älteste Fund von Menschenresten ist ca. [[v1]] Millionen Jahre alt. Er wird der Art [[v2]] zugeordnet. Der aufrechte Gang dieser Art wird von manchen Forscherinnen und Forschern angezweifelt.\n" +
      "[[v3]] ist etwa [[v4]] Millionen Jahre alt. Das erste Skelett wurde 1974 in Äthiopien entdeckt. Der aufrechte Gang lässt sich aufgrund des Skelettbaus sicher nachweisen.\n" +
      "Der Homo [[v5]] gebrauchte Steinwerkzeuge und beherrschte bereits das Feuer. Ein bekannter Vertreter der Gattung Homo ist der Homo [[v6]], der vor [[v7]] Tausend bis [[v8]] Tausend Jahren lebte.\n" +
      "Alle heute lebenden Menschen gehören zur Art Homo [[v9]]. Er entwickelte sich vor mindestens [[v10]] Tausend Jahren in Afrika.",
    stellen: [
      S("v1", "7"),
      S("v2", "Sahelanthropus tchadensis"),
      S("v3", "Australopithecus afarensis"),
      S("v4", "3,2"),
      S("v5", "erectus"),
      S("v6", "neanderthalensis"),
      S("v7", "130"),
      S("v8", "40"),
      S("v9", "sapiens"),
      S("v10", "300"),
    ],
  },
  {
    id: "vertreter",
    teil: "evolution",
    art: "tabelle",
    titel: "3 wichtige Vertreter der Hominini im Vergleich.",
    auftrag: "Ergänze die Tabelle mit den richtigen Abbildungen und Begriffen.",
    seite: "Schulbuch S. 12-13, Kap. 4, 5 und 7",
    bank: ["bild:gehirn-1", "bild:gehirn-2", "bild:gehirn-3", "bild:kopf-1", "bild:kopf-2", "bild:kopf-3", "300 000 Jahre", "450 cm³", "900 cm³", "Australopithecus afarensis", "Homo erectus", "Homo sapiens", "ja", "nein", "seit 1,9 Mio. Jahren"],
    zeilen: [
      { titel: "Abbildung Gehirn", zellen: [{ id: "g1" }, { id: "g2" }, { id: "g3" }] },
      { titel: "Abbildung Aussehen", zellen: [{ id: "a1" }, { id: "a2" }, { id: "a3" }] },
      { titel: "Art", zellen: [{ id: "art1" }, { id: "art2" }, { id: "art3" }] },
      { titel: "Gehirnvolumen", zellen: [{ id: "vol1" }, { id: "vol2" }, "1300 cm³"] },
      { titel: "Alter", zellen: ["3,2 Mio. Jahre", { id: "alt2" }, { id: "alt3" }] },
      { titel: "Werkzeuggebrauch", zellen: [{ id: "wz1" }, "ja", { id: "wz3" }] },
    ],
    stellen: [
      S("g1", "bild:gehirn-1", { text: "Abbildung Gehirn, Spalte 1", merke: "Australopithecus afarensis (3,2 Mio. Jahre) hat das kleinste Gehirn: etwa 450 cm³." }),
      S("g2", "bild:gehirn-2", { text: "Abbildung Gehirn, Spalte 2", merke: "Homo erectus hat ein mittleres, langgestrecktes Gehirn: etwa 900 cm³." }),
      S("g3", "bild:gehirn-3", { text: "Abbildung Gehirn, Spalte 3", merke: "Homo sapiens hat das größte, runde Gehirn: etwa 1300 cm³." }),
      S("a1", "bild:kopf-1", { text: "Abbildung Aussehen, Spalte 1", merke: "Australopithecus afarensis sieht noch sehr affenähnlich aus." }),
      S("a2", "bild:kopf-2", { text: "Abbildung Aussehen, Spalte 2", merke: "Homo erectus: schon menschenähnlich, aber mit Überaugenwulst und flacher Stirn." }),
      S("a3", "bild:kopf-3", { text: "Abbildung Aussehen, Spalte 3", merke: "Homo sapiens: so sehen alle heute lebenden Menschen aus." }),
      S("art1", "Australopithecus afarensis", { text: "Art, Spalte 1", merke: "Spalte 1: Australopithecus afarensis, 3,2 Mio. Jahre alt." }),
      S("art2", "Homo erectus", { text: "Art, Spalte 2", merke: "Spalte 2: Homo erectus, er gebrauchte schon Werkzeuge (ja)." }),
      S("art3", "Homo sapiens", { text: "Art, Spalte 3", merke: "Spalte 3: Homo sapiens, Gehirnvolumen 1300 cm³." }),
      S("vol1", "450 cm³", { text: "Gehirnvolumen, Spalte 1", merke: "Australopithecus afarensis: 450 cm³ (kleinstes Gehirn)." }),
      S("vol2", "900 cm³", { text: "Gehirnvolumen, Spalte 2", merke: "Homo erectus: 900 cm³." }),
      S("alt2", "seit 1,9 Mio. Jahren", { text: "Alter, Spalte 2", merke: "Homo erectus gibt es seit 1,9 Mio. Jahren." }),
      S("alt3", "300 000 Jahre", { text: "Alter, Spalte 3", merke: "Homo sapiens: 300 000 Jahre." }),
      S("wz1", "nein", { text: "Werkzeuggebrauch, Spalte 1", merke: "Australopithecus afarensis: Werkzeuggebrauch nein." }),
      S("wz3", "ja", { text: "Werkzeuggebrauch, Spalte 3", merke: "Homo sapiens: Werkzeuggebrauch ja." }),
    ],
  },
  {
    id: "africa",
    teil: "evolution",
    art: "luecken",
    titel: "„Out of Africa“.",
    auftrag: "Ergänze den Text mit den richtigen Begriffen.",
    seite: "Schulbuch S. 15, Kap. 10",
    text:
      "Die meisten Forscherinnen und Forscher gehen davon aus, dass der Ursprung des heutigen Menschen in [[o1]] liegt.\n\n" +
      "Von dort wanderte er seit [[o2]] Jahren in alle Kontinente der Erde. Früher bestanden oft Landbrücken (z. B. im Bereich [[o3]]). Diese Landbrücken gibt es heute nicht mehr, da der Meeresspiegel durch das Abschmelzen riesiger Eismassen nach [[o4]] anstieg.\n\n" +
      "Der Mensch nutzte [[o5]] und baute erste witterungsbeständige Behausungen. Bekleidung aus Gräsern und Fellen schützte ihn vor [[o6]]. Auf diese Weise konnte der „moderne Mensch“ auch für ihn unwirtliche Regionen dauerhaft besiedeln.",
    stellen: [
      S("o1", "Afrika", { optionen: ["Afrika", "Asien", "Europa", "Australien"] }),
      S("o2", "etwa 100 000", { optionen: ["etwa 1000", "etwa 100 000", "etwa 7 Millionen", "etwa 70 Millionen"] }),
      S("o3", "der Beringstraße", { optionen: ["der Alpen", "der Beringstraße", "der Sahara", "des Himalaya"] }),
      S("o4", "der letzten Eiszeit", { optionen: ["der letzten Eiszeit", "dem Aussterben der Dinosaurier", "dem Mittelalter"] }),
      S("o5", "das Feuer", { optionen: ["das Feuer", "den Strom", "das Auto"] }),
      S("o6", "Kälte", { optionen: ["Kälte", "Hunger", "Krankheiten"] }),
    ],
  },
  {
    id: "zuordnen",
    teil: "evolution",
    art: "liste",
    titel: "Ordne die Begriffe richtig zu.",
    auftrag: "Ordne die Begriffe richtig zu.",
    seite: "Schulbuch S. 12–15",
    bank: ["Düsseldorf", "Primaten", "Kultur", "Turkanasee/Kenia", "Homo erectus", "Homo sapiens", "Gorilla", "„Lucy“", "Paläoanthropologe/anthropologin", "Sahelanthropus tchadensis", "Hominini"],
    stellen: [
      S("z1", "Paläoanthropologe/anthropologin", { text: "erforscht Stammesgeschichte des Menschen" }),
      S("z2", "„Lucy“", { text: "Australopithecus afarensis", merke: "„Lucy“ ist das berühmte Skelett eines Australopithecus afarensis (1974 in Äthiopien gefunden)." }),
      S("z3", "Primaten", { text: "Fachbegriff für Herrentiere" }),
      S("z4", "Homo erectus", { text: "Beherrschung des Feuers", merke: "Homo erectus gebrauchte Steinwerkzeuge und beherrschte bereits das Feuer." }),
      S("z5", "Sahelanthropus tchadensis", { text: "ca. sieben Millionen Jahre alt", merke: "Sahelanthropus tchadensis: der älteste Fund von Menschenresten, ca. 7 Millionen Jahre alt." }),
      S("z6", "Homo sapiens", { text: "breitet sich seit 300 000 Jahren auf der Erde aus" }),
      S("z7", "Kultur", { text: "alles was der Mensch selbst gestaltend hervorbringt" }),
      S("z8", "Düsseldorf", { text: "Homo neanderthalensis", merke: "Der Neandertaler ist nach dem Neandertal bei Düsseldorf benannt." }),
      S("z9", "Hominini", { text: "alle Arten der Primaten, die zu den Menschen gerechnet werden" }),
      S("z10", "Turkanasee/Kenia", { text: "Homo rudolfensis", merke: "Homo rudolfensis wurde am Turkanasee (früher Rudolfsee) in Kenia gefunden." }),
      S("z11", "Gorilla", { text: "Menschenaffe mit Überaugenwulst" }),
    ],
  },

  // ---------- Nervensystem ----------
  {
    id: "reflex",
    teil: "nerven",
    art: "luecken",
    titel: "Schmerz löst extrem schnelle Reaktionen aus.",
    auftrag: "Ergänze den Text mit den richtigen Begriffen.",
    seite: "Schulbuch S. 19, Kap. 1",
    text:
      "Wenn du bloßfüßig auf einen Nagel trittst oder mit der Hand einen heißen Gegenstand berührst, wirst du den Fuß bzw. die Hand sehr rasch zurückziehen. Man spricht auch von einer [[r1]]handlung.\n" +
      "Das hilft, gröbere Verletzungen zu vermeiden.\n" +
      "Zum Auslösen der [[r2]] Reaktion müssen also folgende Voraussetzungen erfüllt sein:\n" +
      "1. Es muss eine [[r3]] zwischen der schmerzauslösenden Stelle und den Muskeln, welche die Handlung ausführen, bestehen.\n" +
      "2. Die Signalleitung muss sehr schnell erfolgen. [[r4]] haben für diese Aufgaben [[r5]], die den ganzen Körper als dichtes Netz durchziehen und alle Teile des Körpers miteinander verbinden.\n" +
      "Die Informationen werden über [[r6]] Signale (= Impulse) weitergeleitet. Die Übertragung erfolgt mit Geschwindigkeiten von bis zu [[r7]] Metern pro Sekunde.",
    stellen: [
      S("r1", "Reflex", { optionen: ["Reflex", "Denk", "Spiel"] }),
      S("r2", "schnellen", { optionen: ["schnellen", "langsamen", "überlegten"] }),
      S("r3", "Verbindung", { optionen: ["Verbindung", "Lücke", "Pause"] }),
      S("r4", "Menschen und Tiere", { optionen: ["Pflanzen", "Menschen und Tiere", "Pilze"] }),
      S("r5", "Nerven", { optionen: ["Nerven", "Blutgefäße", "Knochen"] }),
      S("r6", "elektrische", { optionen: ["elektrische", "chemische", "magnetische"] }),
      S("r7", "120", { optionen: ["1", "12", "120"] }),
    ],
  },
  {
    id: "reiz",
    teil: "nerven",
    art: "bild",
    titel: "Reiz-Reaktions-Schema.",
    auftrag: "Ordne die angeführten Begriffe der Grafik richtig zu.",
    seite: "Schulbuch S. 19, Kap. 1",
    bank: ["Sinnesnerv", "Reaktion", "Rückenmark", "Reiz", "Muskel", "Sinnesorgan", "Bewegungsnerv", "Gehirn"],
    bild: { src: "/spiele/biotest/reiz-reaktion.webp", alt: "Reiz-Reaktions-Schema: Spinne, Auge, Nerven, Gehirn, Rückenmark, Bein", breite: 1514, hoehe: 858 },
    stellen: [
      S("rr1", "Reiz", { text: "1", merke: "1 Reiz: die Spinne, die man sieht." }),
      S("rr2", "Sinnesorgan", { text: "2", merke: "2 Sinnesorgan: das Auge nimmt den Reiz auf." }),
      S("rr3", "Sinnesnerv", { text: "3", merke: "3 Sinnesnerv (blau): leitet die Meldung vom Sinnesorgan zum Rückenmark und Gehirn." }),
      S("rr4", "Gehirn", { text: "4", merke: "4 Gehirn: oben im Kopf." }),
      S("rr5", "Rückenmark", { text: "5", merke: "5 Rückenmark: der gelbe Strang unter dem Gehirn." }),
      S("rr6", "Bewegungsnerv", { text: "6", merke: "6 Bewegungsnerv (rot): leitet den Befehl zum Muskel." }),
      S("rr7", "Muskel", { text: "7", merke: "7 Muskel: im Bein, er führt die Bewegung aus." }),
      S("rr8", "Reaktion", { text: "8", merke: "8 Reaktion: das Bein zieht weg." }),
    ],
  },
  {
    id: "lage",
    teil: "nerven",
    art: "luecken",
    titel: "Verschiedene Bereiche des Nervensystems - Einteilung nach der Lage.",
    auftrag: "Ergänze den Text mit den richtigen Begriffen. Betrachte auch die Abbildung genau.",
    seite: "Schulbuch S. 20, Kap. 3",
    bank: ["PNS", "Zentralnervensystem", "periphere", "ZNS", "zentrale", "Speicherung", "Gehirn", "Sinnesorganen", "Rückenmark", "peripheres", "Muskeln"],
    text:
      "Im [[l1]] und im Rückenmark sind besonders viele Nervenfasern konzentriert. Diese beiden Körperteile bilden die Kommandozentrale des Nervensystems ([[l2]]; ZNS). Das [[l3]] Nervensystem dient vor allem der Verarbeitung und [[l4]] von angelieferten Informationen wie z. B. Signalen von [[l5]].\n" +
      "Alle Nervenfasern außerhalb des zentralen Nervensystems bezeichnet man als [[l6]] Nervensystem ([[l7]]). Das [[l8]] Nervensystem umfasst alle Nerven, die außerhalb des [[l9]] verlaufen. Es übermittelt Daten aus den Randbereichen des Körpers an das Gehirn und zum [[l10]] und leitet Steuerbefehle zu den [[l11]] und Organen.",
    stellen: [
      S("l1", "Gehirn"),
      S("l2", "Zentralnervensystem"),
      S("l3", "zentrale"),
      S("l4", "Speicherung"),
      S("l5", "Sinnesorganen"),
      S("l6", "peripheres"),
      S("l7", "PNS"),
      S("l8", "periphere"),
      S("l9", "ZNS"),
      S("l10", "Rückenmark"),
      S("l11", "Muskeln"),
    ],
  },
  {
    id: "funktion",
    teil: "nerven",
    art: "luecken",
    titel: "Verschiedene Bereiche des Nervensystems - Einteilung nach der Funktion.",
    auftrag: "Ergänze den Text mit den richtigen Begriffen. Betrachte auch die Abbildung genau.",
    seite: "Schulbuch S. 20, Kap. 3",
    bank: ["Hormon- und Immunsystem", "peripheren Nervensystem", "vegetativen", "Zentralnervensystem", "inneren Organe", "Skelettmuskulatur", "somatisches", "zentralen und peripheren"],
    text:
      "Als willkürliches Nervensystem (= [[f1]] Nervensystem) bezeichnet man jenen Anteil des [[f2]] Nervensystems, der dem Willen unterliegt.\n" +
      "Über das willkürliche Nervensystem wird die [[f3]] gesteuert, z. B. das Bewegen der Hand.\n\n" +
      "Alle anderen Anteile gehören zum unwillkürlichen (= [[f4]]) Nervensystem. Dieses regelt die Aktivität der [[f5]] (z. B. Herz, Magen-Darm-Bereich) und Drüsen.\n\n" +
      "Willkürliches und unwillkürliches Nervensystem sind im [[f6]] weitgehend getrennt, im [[f7]] sind sie eng miteinander verflochten. Außerdem bestehen enge Verbindungen zum [[f8]].",
    stellen: [
      S("f1", "somatisches"),
      S("f2", "zentralen und peripheren"),
      S("f3", "Skelettmuskulatur"),
      S("f4", "vegetativen"),
      S("f5", "inneren Organe"),
      S("f6", "peripheren Nervensystem"),
      S("f7", "Zentralnervensystem"),
      S("f8", "Hormon- und Immunsystem"),
    ],
  },
  {
    id: "nervenzelle",
    teil: "nerven",
    art: "bild",
    titel: "Nervenzellen und ihre Bestandteile.",
    auftrag: "Ordne die Begriffe der Grafik richtig zu.",
    seite: "Schulbuch S. 21, Kap. 5",
    bank: ["Zellkern", "Axon", "Dendriten", "Schnürringe", "Endknöpfchen mit Synapse", "Hüllzelle", "Mitochondrium", "Zellkörper"],
    bild: { src: "/spiele/biotest/nervenzelle.webp", alt: "Nervenzelle mit den Nummern 1 bis 8", breite: 680, hoehe: 720 },
    stellen: [
      S("n1", "Zellkörper", { text: "1", merke: "1 Zellkörper: der dicke gelbe Teil in der Mitte." }),
      S("n2", "Zellkern", { text: "2", merke: "2 Zellkern: der violette Kreis im Zellkörper, die Steuerzentrale." }),
      S("n3", "Mitochondrium", { text: "3", merke: "3 Mitochondrium: die kleinen orangen Teile im Zellkörper, Energieversorgung." }),
      S("n4", "Dendriten", { text: "4", merke: "4 Dendriten: die vielen verästelten Fortsätze am Zellkörper, sie empfangen Signale." }),
      S("n5", "Hüllzelle", { text: "5", merke: "5 Hüllzelle: die hellblaue Hülle um die Nervenfaser, sie isoliert." }),
      S("n6", "Axon", { text: "6", merke: "6 Axon: die lange gelbe Nervenfaser in der Hülle, sie leitet die Signale." }),
      S("n7", "Schnürringe", { text: "7", merke: "7 Schnürringe: die Lücken zwischen den Hüllzellen." }),
      S("n8", "Endknöpfchen mit Synapse", { text: "8", merke: "8 Endknöpfchen mit Synapse: die kleinen Knöpfchen am Ende der Verzweigungen." }),
    ],
  },
  {
    id: "bestandteile",
    teil: "nerven",
    art: "liste",
    titel: "Bestandteile von Nervenzellen und ihre Funktionen.",
    auftrag: "Ordne die Funktionen den Bestandteilen richtig zu.",
    seite: "Schulbuch S. 21, Kap. 5",
    bank: ["empfängt Nervensignale und ist verästelt", "Steuerzentrale der Nervenzelle", "dort wird Erregung chemisch von einer auf die andere Nervenzelle übertragen", "Faser zur Leitung der elektrischen Signale", "dient zur schnelleren Erregungsleitung", "isoliert die Nervenfaser", "Energieversorgung der Zelle"],
    stellen: [
      S("b1", "Steuerzentrale der Nervenzelle", { text: "Zellkern" }),
      S("b2", "Faser zur Leitung der elektrischen Signale", { text: "Axon" }),
      S("b3", "dient zur schnelleren Erregungsleitung", { text: "Schnürring" }),
      S("b4", "dort wird Erregung chemisch von einer auf die andere Nervenzelle übertragen", { text: "Synapse" }),
      S("b5", "isoliert die Nervenfaser", { text: "Hüllzelle" }),
      S("b6", "empfängt Nervensignale und ist verästelt", { text: "Dendrit" }),
      S("b7", "Energieversorgung der Zelle", { text: "Mitochondrium" }),
    ],
  },
  {
    id: "fachbegriffe",
    teil: "nerven",
    art: "luecken",
    titel: "Fachbegriffe rund um die Nervenzelle 2.",
    auftrag: "Ergänze den Text bzw. die Aussagen mit den richtigen Begriffen.",
    seite: "Schulbuch S. 21, Kap. 5",
    text:
      "Der [[k1]] ist die Steuerzentrale der Nervenzelle.\n\n" +
      "Die [[k2]] nehmen die [[k3]] Signale auf, sie werden über den Zellkörper an die Nervenfaser, die man auch als [[k4]] bezeichnet, weitergeleitet.\n\n" +
      "An den [[k5]] erfolgt auf chemischem Wege die Übertragung der Signale auf weitere Nervenzellen.\n\n" +
      "Hüllzellen mit der fettartigen Substanz [[k6]] dienen der Isolierung. Bei den Schnür[[k7]] ist die Nervenfaser nicht isoliert.",
    stellen: [
      S("k1", "Zellkern", { muster: "_ _ _ _ _ _ _ _" }),
      S("k2", "Dendriten", { muster: "_ _ _ _ _ _ _ _ _" }),
      S("k3", "elektrischen", { muster: "e _ _ ktr _ _ _ _ _ _" }),
      S("k4", "Axon", { muster: "_ _ _ _" }),
      S("k5", "Synapsen", { muster: "_ _ _ _ _ _ _ _" }),
      S("k6", "Myelin", { muster: "_ _ _ _ _ _" }),
      S("k7", "ringen", { muster: "_ _ _ _ _ _", auch: ["Schnürringen"] }),
    ],
  },
  {
    id: "synapse",
    teil: "nerven",
    art: "bild",
    titel: "Synapsen sind Kontaktstellen zwischen Nervenzellen.",
    auftrag: "Ordne die angeführten Begriffe der Grafik richtig zu.",
    seite: "Schulbuch S. 23, Kap. 1",
    bank: ["Neurotransmitter", "Nervenimpuls", "präsynaptischer Teil", "Bläschen", "Rezeptor", "postsynaptischer Teil", "Endknöpfchen", "synaptischer Spalt"],
    bild: { src: "/spiele/biotest/synapse.webp", alt: "Synapse mit den Nummern 1 bis 8", breite: 1244, hoehe: 684 },
    stellen: [
      S("s1", "präsynaptischer Teil", { text: "1", merke: "1 präsynaptischer Teil: die Klammer über dem Endknöpfchen (die sendende Zelle)." }),
      S("s2", "postsynaptischer Teil", { text: "2", merke: "2 postsynaptischer Teil: die Klammer über dem blauen Teil (die empfangende Zelle)." }),
      S("s3", "synaptischer Spalt", { text: "3", merke: "3 synaptischer Spalt: der schmale Raum zwischen Endknöpfchen und blauer Membran." }),
      S("s4", "Bläschen", { text: "4", merke: "4 Bläschen: die runden Kugeln im Endknöpfchen." }),
      S("s5", "Endknöpfchen", { text: "5", merke: "5 Endknöpfchen: das verdickte Ende der Nervenfaser." }),
      S("s6", "Nervenimpuls", { text: "6", merke: "6 Nervenimpuls: der Pfeil in der Nervenfaser, das elektrische Signal kommt an." }),
      S("s7", "Neurotransmitter", { text: "7", merke: "7 Neurotransmitter: die roten Dreiecke in den Bläschen, die chemischen Botenstoffe." }),
      S("s8", "Rezeptor", { text: "8", merke: "8 Rezeptor: die blauen Zacken in der Membran, sie fangen die Neurotransmitter auf." }),
    ],
  },
  {
    id: "reihenfolge",
    teil: "nerven",
    art: "reihenfolge",
    titel: "An Synapsen werden elektrische Informationen auf chemischem Wege weitergeleitet.",
    auftrag: "Bringe die angeführten Vorgänge in die richtige Reihenfolge.",
    seite: "Schulbuch S. 23, Kap. 10",
    // so stehen die Sätze bei der Lehrkraft; `richtig` ist ihre Stelle in der Reihenfolge
    stellen: [
      S("q5", "5", { text: "Dadurch verändern sich die Membraneigenschaften der postsynaptischen Nervenzelle" }),
      S("q2", "2", { text: "Die sendende Zelle schüttet aus Bläschen in den Endknöpfchen chemische Botenstoffe aus" }),
      S("q4", "4", { text: "Dort aktivieren sie in der Membran Auffangmoleküle (= Rezeptoren)" }),
      S("q1", "1", { text: "Ein elektrischer Nervenimpuls erreicht die präsynaptische Nervenzelle" }),
      S("q6", "6", { text: "Je nach Botenstoff wird das chemische Signal wieder in ein elektrisches Signal umgewandelt oder die Weiterleitung gehemmt" }),
      S("q3", "3", { text: "Die Neurotransmitter breiten sich über den synaptischen Spalt zur nächsten Nervenzelle aus" }),
    ],
  },
  {
    id: "sympathicus",
    teil: "nerven",
    art: "luecken",
    titel: "Sympathicus und Parasympathicus.",
    auftrag: "Ergänze den Text mit den richtigen Begriffen.",
    seite: "Schulbuch S. 27, Kap. 8",
    text:
      "Das [[y1]] Nervensystem besteht aus zwei Teilsystemen: dem Sym[[y2]] und dem Para[[y3]]. Sie haben oft [[y4]] Wirkungen. Die [[y5]] des Menschen werden von Nerven versorgt, die der Körper nicht bewusst steuern kann. Das [[y6]] Nervensystem funktioniert auch im Schlaf oder bei Bewusstlosigkeit.\n" +
      "Vom [[y7]] gehen Nervenstränge aus, die alle inneren Organe versorgen. Bei Anstrengung, Höchstleistungen, Stress oder Gefahr [[y8]] der [[y9]] Herz, Lunge und Schweißdrüsen. Die [[y10]] wird verstärkt, [[y11]] wird bereitgestellt. Zugleich hemmt der [[y12]] seinen Gegenspieler, den [[y13]]. Dieser wird bei der Entspannung des Körpers aktiv und fördert [[y14]] des Verdauungstraktes, der Ausscheidungsorgane und der Geschlechtsorgane. Auch im Schlaf ist überwiegend der [[y15]] aktiv.",
    stellen: [
      S("y1", "vegetative", { optionen: ["vegetative", "somatische", "willkürliche"] }),
      S("y2", "pathicus", { optionen: ["pathicus", "phonie", "bol"] }),
      S("y3", "sympathicus", { optionen: ["sympathicus", "graph", "meter"] }),
      S("y4", "gegensätzliche", { optionen: ["gleiche", "gegensätzliche", "keine"] }),
      S("y5", "inneren Organe", { optionen: ["inneren Organe", "Skelettmuskeln", "Haare"] }),
      S("y6", "vegetative", { optionen: ["somatische", "vegetative", "willkürliche"] }),
      S("y7", "Rückenmark", { optionen: ["Rückenmark", "Magen", "Herz"] }),
      S("y8", "aktiviert", { optionen: ["aktiviert", "hemmt", "beruhigt"] }),
      S("y9", "Sympathicus", { optionen: ["Sympathicus", "Parasympathicus"] }),
      S("y10", "Atmung", { optionen: ["Atmung", "Verdauung", "Müdigkeit"] }),
      S("y11", "Energie", { optionen: ["Energie", "Schlaf", "Ruhe"] }),
      S("y12", "Sympathicus", { optionen: ["Sympathicus", "Parasympathicus"] }),
      S("y13", "Parasympathicus", { optionen: ["Sympathicus", "Parasympathicus"] }),
      S("y14", "die Tätigkeit", { optionen: ["die Tätigkeit", "die Hemmung", "das Ende"] }),
      S("y15", "Parasympathicus", { optionen: ["Sympathicus", "Parasympathicus"] }),
    ],
  },
  {
    id: "spalten",
    teil: "nerven",
    art: "spalten",
    titel: "Sympathicus und Parasympathicus.",
    auftrag: "Ordne die angeführten Aussagen und Begriffe den beiden Teilsystemen des vegetativen Nervensystems richtig zu.",
    seite: "Schulbuch S. 27, Kap. 8",
    spalten: ["Sympathicus", "Parasympathicus"],
    stellen: [
      S("t1", "Sympathicus", { text: "Stress" }),
      S("t2", "Sympathicus", { text: "Konzentration" }),
      S("t3", "Sympathicus", { text: "vermehrte Atmung" }),
      S("t4", "Parasympathicus", { text: "Entspannung" }),
      S("t5", "Sympathicus", { text: "mehr Schweißabsonderung" }),
      S("t6", "Parasympathicus", { text: "Ausscheidung" }),
      S("t7", "Parasympathicus", { text: "Ruhe" }),
      S("t8", "Parasympathicus", { text: "Schlaf" }),
      S("t9", "Parasympathicus", { text: "Verdauung" }),
      S("t10", "Sympathicus", { text: "Anspannung" }),
      S("t11", "Sympathicus", { text: "steigender Herzschlag" }),
    ],
  },
];

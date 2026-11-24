/**
 * Biolabor (niko 2026-11-23): ein Lernspiel für den Biologie-Test einer 4. Klasse: Genetik (Vererbung, DNA,
 * Mendel’sche Regeln mit Kreuzungsschemata, Blutgruppen, Gentechnik) und „Der Mensch“ (Nervensystem, Gehirn,
 * unwillkürliches Nervensystem, Sympathikus und Parasympathikus). Der Stoff steht in lib/biolabor-inhalt.ts.
 *
 * Gespielt wird in components/lernen/BioLabor.tsx, ohne KI:
 * - „Üben“: vier Antworten zum Antippen, das Kreuzungsschema mit vorgegebenen Keimzellen.
 * - „Wie im Test“: Begriffe selbst schreiben (ein Tippfehler zählt als gewusst), offene Fragen mit Selbstkontrolle,
 *   im Kreuzungsschema auch die Keimzellen selbst eintragen.
 * - „Großer Test“: 24 Aufgaben aus allen Themen, wie im Test.
 * Ein Eintrag ist „sicher“, wenn er zweimal hintereinander beim ersten Versuch stimmte. Eine Runde nimmt zuerst die
 * zuletzt falschen, dann die nie gesehenen und am längsten nicht gesehenen, zuletzt die sicheren.
 */
import { BIO_EINTRAEGE, BIO_THEMEN, type BegriffEintrag, type BioEintrag, type BioThema, type Bereich, type KreuzungEintrag } from "./biolabor-inhalt";
import type { SpielKarte } from "./lernspiele-typen";

export { BIO_EINTRAEGE, BIO_THEMEN };
export type { BioEintrag, BioThema, Bereich };

export type Rng = () => number;

/** Die Fähigkeit für den Lernstand (keine aus dem Lehrplan). */
export const BIO_SKILL = "bio.genetik-mensch";
export type BioModus = "ueben" | "test";
/** Welche Themen: alle, ein Bereich, ein einzelnes Thema (seine id) oder nur die Kreuzungsschemata. */
export type BioAuswahl = "alle" | Bereich | string;

export const AUFGABEN_JE_RUNDE: Record<BioModus, number> = { ueben: 10, test: 12 };
export const GROSSER_TEST = 24;
export const SICHER_NACH = 2;

/** Was eine Karte für das Spielfeld mitbringt (SpielKarte.bio). */
export type BioDaten = {
  eintrag: string;
  thema: string;
  modus: BioModus;
  /** wie geantwortet wird */
  art: "kacheln" | "schreiben" | "selbst" | "schema";
  frage: string;
  /** kleine Zeile über der Frage („Welcher Begriff ist gemeint?“) */
  ueber?: string;
  /** schreiben: was außer `richtig` auch gilt */
  auch?: string[];
  /** selbst: die Stichpunkte der Musterantwort */
  punkte?: string[];
  /** schema: das Kreuzungsschema */
  schema?: {
    titel: string;
    legende: string[];
    allele: string[];
    mutter: [string, string];
    vater: [string, string];
    /** Keimzellen vorgegeben (Üben) oder selbst eintragen (Test) */
    gameten: boolean;
  };
  /** die Frage nach dem Schema: das fertige Schema steht darüber */
  nachSchema?: { mutter: [string, string]; vater: [string, string]; allele: string[]; titel: string };
};

export const thema = (id: string): BioThema | undefined => BIO_THEMEN.find((t) => t.id === id);
export const eintrag = (id: string): BioEintrag | undefined => BIO_EINTRAEGE.find((e) => e.id === id);

/** Die Karten-Keys: `bio:<eintrag>` und beim Kreuzungsschema `bio:<eintrag>:frage` für die Frage danach. */
export const bioKey = (id: string, teil?: "frage") => `bio:${id}${teil ? `:${teil}` : ""}`;
export function vonKey(key: string): string | null {
  const m = /^bio:([a-z0-9-]+)(?::frage)?$/.exec(key);
  return m && eintrag(m[1]) ? m[1] : null;
}

function mische<T>(a: T[], rng: Rng): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

// ---------- Kreuzungsschema ----------

/** Ein Genotyp in der üblichen Reihenfolge: dominant vor rezessiv (Rr), A vor B vor 0 (A0), X vor Y. */
export function genotyp(a: string, b: string, allele: string[]): string {
  return [a, b].sort((x, y) => allele.indexOf(x) - allele.indexOf(y)).join("");
}
/** Die vier Felder: Zeilen = Keimzellen der Mutter, Spalten = Keimzellen des Vaters. */
export const felder = (mutter: [string, string], vater: [string, string], allele: string[]): string[] => mutter.flatMap((m) => vater.map((v) => genotyp(m, v, allele)));
/** Was in ein Feld passen kann: alle Genotypen aus den Allelen dieser Kreuzung. */
export function feldWahl(allele: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < allele.length; i++) for (let j = i; j < allele.length; j++) out.push(allele[i] + allele[j]);
  // Geschlecht: YY gibt es nicht
  return out.filter((g) => g !== "YY");
}
/** Das richtige Schema als Text (die Antwort der Karte). */
export const schemaText = (k: Pick<KreuzungEintrag, "mutter" | "vater" | "allele">) => felder(k.mutter, k.vater, k.allele).join("|");

/**
 * Prüft ein ausgefülltes Schema. `gameten` sind die eingetragenen Keimzellen (Mutter links oben und unten, Vater oben
 * links und rechts) oder null, wenn sie vorgegeben waren. Die Reihenfolge der Keimzellen ist egal, solange sie zu den
 * Eltern passen und jedes Feld zu seiner Zeile und Spalte. Zurück: ob alles stimmt und welche Stellen falsch sind
 * (`g0`–`g3` Keimzellen, `f0`–`f3` Felder).
 */
export function pruefeSchema(
  k: Pick<KreuzungEintrag, "mutter" | "vater" | "allele">,
  eingabe: { gameten: [string, string, string, string] | null; felder: string[] },
): { ok: boolean; falsch: string[] } {
  const falsch: string[] = [];
  const m: [string, string] = eingabe.gameten ? [eingabe.gameten[0], eingabe.gameten[1]] : k.mutter;
  const v: [string, string] = eingabe.gameten ? [eingabe.gameten[2], eingabe.gameten[3]] : k.vater;
  if (eingabe.gameten) {
    const gleich = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join();
    if (!gleich(m, k.mutter)) falsch.push("g0", "g1");
    if (!gleich(v, k.vater)) falsch.push("g2", "g3");
  }
  const soll = felder(m, v, k.allele);
  soll.forEach((g, i) => {
    if (genotypNormal(eingabe.felder[i] ?? "", k.allele) !== g) falsch.push(`f${i}`);
  });
  return { ok: falsch.length === 0, falsch };
}
/** „rR“ wie „Rr“: die Reihenfolge der Buchstaben in einem Feld ist egal. */
function genotypNormal(g: string, allele: string[]): string {
  const teile = g.split("");
  return teile.length === 2 && teile.every((t) => allele.includes(t)) ? genotyp(teile[0], teile[1], allele) : g;
}

// ---------- Schreiben wie im Test ----------

/** Für den Vergleich: klein, Umlaute als ae/oe/ue, ß als ss, ohne Artikel vorne, nur Buchstaben und Ziffern. */
export function normal(s: string): string {
  let t = s
    .toLocaleLowerCase("de-AT")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[„“"'’.!?]/g, "")
    .trim();
  for (let i = 0; i < 3; i++) t = t.replace(/^(der|die|das|den|dem|des|ein|eine|einen|einem|im|in|mit|ueber|vom|von|zum|zur)\s+/, "");
  return t.replace(/[^a-z0-9]/g, "");
}

function abstand(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Alles, was man irgendwo schreiben kann: eine andere richtige Antwort ist nie „fast“ (Mitose ≠ Meiose). */
const ALLE_SCHREIBBAR: string[] = [
  ...new Set(
    BIO_EINTRAEGE.flatMap((e) => (e.art === "wahl" ? [e.richtig, ...(e.schreib ?? [])] : e.art === "begriff" ? [e.begriff, ...(e.auch ?? [])] : [])).map(normal),
  ),
];

/**
 * Stimmt das Geschriebene? „richtig“: genau eine der erlaubten Antworten (Groß/klein, Artikel, Umlaute egal). „fast“:
 * ein, bei langen Wörtern (ab 12 Buchstaben) zwei Buchstaben daneben; zählt als gewusst, die Schreibweise wird gezeigt.
 * Zahlen und kurze Wörter (unter 5) müssen genau stimmen.
 */
export function pruefeGeschrieben(eingabe: string, erlaubt: string[]): "richtig" | "fast" | "falsch" {
  const e = normal(eingabe);
  if (!e) return "falsch";
  const gut = erlaubt.map(normal).filter(Boolean);
  if (gut.includes(e)) return "richtig";
  const andere = ALLE_SCHREIBBAR.filter((x) => !gut.includes(x));
  if (andere.includes(e)) return "falsch";
  let best = Infinity;
  let ziel = "";
  for (const g of gut) {
    const d = abstand(e, g);
    if (d < best) {
      best = d;
      ziel = g;
    }
  }
  if (/\d/.test(ziel)) return "falsch";
  const darf = ziel.length >= 12 ? 2 : ziel.length >= 5 ? 1 : 0;
  if (andere.some((x) => abstand(e, x) < best)) return "falsch";
  return best <= darf ? "fast" : "falsch";
}

// ---------- Karten ----------

/** Falsche Begriffe für eine Glossar-Karte: zuerst aus demselben Thema, dann aus demselben Bereich. */
function begriffFalsch(b: BegriffEintrag, rng: Rng): string[] {
  const bereich = thema(b.thema)?.bereich;
  const begriffe = BIO_EINTRAEGE.filter((x): x is BegriffEintrag => x.art === "begriff" && x.id !== b.id);
  const gleich = mische(begriffe.filter((x) => x.thema === b.thema), rng).map((x) => x.begriff);
  const nah = mische(begriffe.filter((x) => x.thema !== b.thema && thema(x.thema)?.bereich === bereich), rng).map((x) => x.begriff);
  return [...new Set([...gleich, ...nah])].filter((x) => x !== b.begriff).slice(0, 3);
}

/** Wortstämme für den Vergleich: klein, ohne Umlaute, Wörter ab 4 Buchstaben, die ersten 6 Buchstaben. */
function staemme(text: string): Set<string> {
  const ohne = new Set(["eine", "einer", "einem", "einen", "der", "die", "das", "und", "oder", "nicht", "werden", "wird", "sind", "haben", "welche", "welcher", "welches", "beim", "immer", "auch", "dann", "wenn", "nach", "sich", "zwei"]);
  return new Set(
    text
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !ohne.has(w))
      .map((w) => w.slice(0, 6)),
  );
}

/** Wo der Satz vom Lernzettel nicht genau passt, steht hier ein eigener. */
const MERKE: Record<string, string> = {
  "g-umwelt": "Neben den Genen beeinflussen Umweltfaktoren, wie sich Merkmale ausprägen (Ernährung, Training, Sonne).",
  "g-rezessiv-zeigt": "Eine rezessive Erbanlage (Kleinbuchstabe) zeigt sich nur, wenn sie doppelt da ist: rr.",
  "m-f2-weiss": "Rr × Rr ergibt RR, Rr, Rr, rr. Nur rr ist weiß: 1 von 4 Feldern = 25 %.",
  "d-avery": "Oswald Avery, ein kanadischer Mediziner, erkannte 1944 bei Versuchen mit Bakterien, dass die DNA die Erbinformation speichert.",
  "d-abgleich": "Die Abfolge der Basen ist bei jedem Menschen ein klein wenig anders. Darum verrät eine DNA-Spur (z. B. ein Haar) die Person.",
  "d-sichel": "Sichelzellenanämie: Wer das defekte Gen auf nur einem Chromosom hat, ist vor schwerer Malaria geschützt. Darum ist die Mutation in Malariagebieten häufiger.",
  "d-23": "Geschlechtszellen (Eizelle, Spermienzelle) haben nur 23 Chromosomen, von jedem Paar eines.",
  "w-foerdern": "Frühe Förderung verbessert die Entwicklung bei Trisomie 21, z. B. fördern Logopädinnen und Logopäden das Sprechen.",
  "m-reinerbig": "Reinerbig: Die Pflanze zeigt ein Merkmal über mehrere Generationen unverändert (zwei gleiche Erbanlagen, RR oder rr).",
  "m-bestaeubung": "Mendel übertrug den Pollen mit einem Pinsel auf die Narbe einer anderen Erbsenpflanze: künstliche Bestäubung = Kreuzung.",
  "m-weiss-weg": "Die Erbanlage für Weiß war in der F1 noch da, sie trat nur zurück (rezessiv). Rot ist dominant.",
  "m-intermediaer-warum": "Intermediär: Keine Erbanlage ist dominant, darum entsteht eine Mischung: rot (rr) × weiß (ww) → rosa (rw).",
  "m-3-gilt": "Die 3. Regel gilt nur, wenn die Gene für die Merkmale auf unterschiedlichen Chromosomen liegen.",
  "h-geschlechtszellen-ab": "Jede Geschlechtszelle bekommt nur eine Erbanlage: Ein Mensch mit AB gibt A oder B weiter.",
  "h-zwischen-filter": "Das Zwischenhirn bewertet die Informationen der Sinneszellen und leitet nur Wichtiges zum Großhirn weiter.",
  "h-stamm": "Das Nachhirn geht ins Rückenmark über und steuert unwillkürliche Vorgänge: Atmung, Blutkreislauf, Schlucken, Husten, Niesen.",
  "n-neuron": "Die Bausteine des Nervensystems sind die Nervenzellen. Ihre Aufgabe ist die Weiterleitung von Impulsen.",
  "n-elektrisch": "In der Nervenzelle laufen elektrische Impulse. Erst am Endknöpfchen geht es mit chemischen Botenstoffen weiter.",
  "n-lineal": "Beim Linealversuch fängt man ein fallendes Lineal; die Fallstrecke ist das Maß für die Reaktionszeit.",
  "t-gesetz": "Das Gentechnikgesetz regelt das Arbeiten mit gentechnisch veränderten Lebewesen, die Gentherapie, das Freisetzen und die Kennzeichnung von Lebensmitteln.",
  "t-fische": "Leuchtende Zebrabärblinge haben Gene von Quallen für Leucht-Eiweiße. Haltung und Verkauf sind in der EU verboten.",
  "s-feld": "Ein 2 × 2-Schema hat 4 Felder. Jedes Feld ist 1 von 4 = 25 %.",
  "h-0-dominant": "A und B sind dominant über 0. Blutgruppe 0 hat nur, wer 00 hat.",
  "h-00": "00 × 00: Beide Eltern können nur 0 weitergeben, das Kind hat 00 = Blutgruppe 0.",
  "h-ab-0": "AB × 00: Das Kind bekommt A oder B von der Mutter und 0 vom Vater, also A0 oder B0 = Blutgruppe A oder B.",
  "h-schwanken": "Das Kleinhirn steuert Gleichgewicht und fein abgestimmte Bewegungen. Ist es verletzt, schwankt man.",
};

/**
 * Der Merksatz nach einem Fehler (niko 2026-11-23: Animationen raus, dafür klar erklären). Steht beim Eintrag einer,
 * gilt der; bei Begriffen die Erklärung; sonst der Satz vom Lernzettel des Themas, der die meisten Wörter mit Frage
 * und Antwort teilt.
 */
export function merkeFuer(e: BioEintrag): string {
  if (e.merke) return e.merke;
  if (MERKE[e.id]) return MERKE[e.id];
  if (e.art === "begriff") return `${e.begriff}: ${e.erklaerung}`;
  const t = thema(e.thema);
  if (!t) return "";
  const text = e.art === "wahl" ? `${e.frage} ${e.richtig}` : e.art === "zuordnen" ? `${e.aussage} ${e.richtig}` : e.art === "erklaeren" ? `${e.frage} ${e.punkte.join(" ")}` : `${e.frage} ${e.richtig}`;
  const such = staemme(text);
  let best = "";
  let punkte = 0;
  for (const m of t.merke) {
    let n = 0;
    for (const w of staemme(m)) if (such.has(w)) n++;
    if (n > punkte) {
      punkte = n;
      best = m;
    }
  }
  return best;
}

/** Die Karten zu einem Eintrag (ein Kreuzungsschema gibt zwei: das Schema und die Frage danach). */
export function eintragKarten(e: BioEintrag, modus: BioModus, rng: Rng): SpielKarte[] {
  const basis = { skill: BIO_SKILL, vor: "", nach: "", regel: merkeFuer(e) };
  const nr = lehrerNr(e);
  // Fragen der Lehrerin: die Nummer vom Blatt steht oben
  const daten = (d: Omit<BioDaten, "eintrag" | "thema" | "modus">): BioDaten => ({ eintrag: e.id, thema: e.thema, modus, ...d, ueber: nr ? `Frage ${nr} der Lehrerin${d.ueber ? ` · ${d.ueber}` : ""}` : d.ueber });
  if (e.art === "wahl") {
    const schreiben = modus === "test" && !!e.schreib?.length;
    return [
      {
        ...basis,
        key: bioKey(e.id),
        faecher: schreiben ? [e.richtig] : mische([e.richtig, ...e.falsch.slice(0, 3)], rng),
        richtig: e.richtig,
        loesung: e.richtig,
        bio: daten({ art: schreiben ? "schreiben" : "kacheln", frage: e.frage, auch: schreiben ? e.schreib : undefined }),
      },
    ];
  }
  if (e.art === "begriff") {
    const schreiben = modus === "test";
    return [
      {
        ...basis,
        key: bioKey(e.id),
        faecher: schreiben ? [e.begriff] : mische([e.begriff, ...begriffFalsch(e, rng)], rng),
        richtig: e.begriff,
        loesung: `${e.begriff}: ${e.erklaerung}`,
        bio: daten({ art: schreiben ? "schreiben" : "kacheln", frage: e.erklaerung, ueber: "Welcher Begriff ist gemeint?", auch: schreiben ? [e.begriff, ...(e.auch ?? [])] : undefined }),
      },
    ];
  }
  if (e.art === "zuordnen") {
    return [
      {
        ...basis,
        key: bioKey(e.id),
        faecher: [...e.seiten],
        richtig: e.richtig,
        loesung: e.richtig,
        bio: daten({ art: "kacheln", frage: e.aussage, ueber: "Sympathikus oder Parasympathikus?" }),
      },
    ];
  }
  if (e.art === "erklaeren") {
    return [
      {
        ...basis,
        key: bioKey(e.id),
        faecher: ["gewusst", "nicht gewusst"],
        richtig: "gewusst",
        loesung: e.punkte.join(" · "),
        bio: daten({ art: "selbst", frage: e.frage, punkte: e.punkte, ueber: "Wie im Test: erst selbst antworten" }),
      },
    ];
  }
  // Kreuzungsschema und die Frage danach
  const schema = { titel: e.titel, legende: e.legende, allele: e.allele, mutter: e.mutter, vater: e.vater };
  return [
    {
      ...basis,
      key: bioKey(e.id),
      faecher: feldWahl(e.allele),
      richtig: schemaText(e),
      loesung: schemaText(e).replace(/\|/g, ", "),
      regel: "Jedes Feld bekommt ein Allel von oben (Vater) und eines von links (Mutter).",
      bio: daten({ art: "schema", frage: "Füll das Kreuzungsschema aus.", schema: { ...schema, gameten: modus === "ueben" } }),
    },
    {
      ...basis,
      key: bioKey(e.id, "frage"),
      faecher: mische([e.richtig, ...e.falsch.slice(0, 3)], rng),
      richtig: e.richtig,
      loesung: e.richtig,
      bio: daten({ art: "kacheln", frage: e.frage, nachSchema: schema }),
    },
  ];
}

/** Die Einträge einer Auswahl, für einen Modus (offene Fragen nur wie im Test). */
export function eintraegeFuer(auswahl: BioAuswahl, modus: BioModus): BioEintrag[] {
  const passt = (e: BioEintrag) => {
    const t = thema(e.thema);
    if (!t) return false;
    if (auswahl === "alle") return true;
    if (auswahl === "genetik" || auswahl === "mensch") return t.bereich === auswahl;
    return e.thema === auswahl;
  };
  return BIO_EINTRAEGE.filter((e) => passt(e) && (modus === "test" || e.art !== "erklaeren"));
}

/** Was der Schüler über einen Eintrag schon kann. */
export type EintragStand = { gesehen: number; sicher: boolean; zuletzt: number };

/** Der Stand je Eintrag aus den beendeten Runden (älteste zuerst); ein Kreuzungsschema zählt mit seiner Frage. */
export function bioStand(runden: { antworten: { key: string; richtig: boolean }[] }[]): Map<string, EintragStand> {
  const verlauf = new Map<string, { ergebnisse: boolean[]; zuletzt: number }>();
  runden.forEach((r, i) => {
    const je = new Map<string, boolean>();
    for (const a of r.antworten) {
      const id = vonKey(a.key);
      if (!id) continue;
      je.set(id, (je.get(id) ?? true) && a.richtig);
    }
    for (const [id, ok] of je) {
      const v = verlauf.get(id) ?? { ergebnisse: [], zuletzt: 0 };
      v.ergebnisse.push(ok);
      v.zuletzt = i + 1;
      verlauf.set(id, v);
    }
  });
  const out = new Map<string, EintragStand>();
  for (const [id, v] of verlauf) {
    const letzte = v.ergebnisse.slice(-SICHER_NACH);
    out.set(id, { gesehen: v.ergebnisse.length, sicher: letzte.length === SICHER_NACH && letzte.every(Boolean), zuletzt: v.zuletzt });
  }
  return out;
}

/**
 * Welche Einträge in die Runde kommen: zuerst die zuletzt falschen (`wiederholen`), dann die nicht sicheren (nie
 * gesehen und am längsten her zuerst), dann die sicheren. Beim großen Test (`verteilt`) reihum aus jedem Thema.
 * Höchstens ein Drittel offene Fragen, damit man auch etwas antippt.
 */
export function waehleEintraege(
  pool: BioEintrag[],
  stand: Map<string, EintragStand>,
  o: { anzahl: number; wiederholen?: string[]; rng: Rng; verteilt?: boolean },
): BioEintrag[] {
  const zuletzt = (id: string) => stand.get(id)?.zuletzt ?? 0;
  const reihe = (liste: BioEintrag[]) => {
    const gemischt = mische(liste, o.rng);
    const offen = gemischt.filter((e) => !stand.get(e.id)?.sicher).sort((a, b) => zuletzt(a.id) - zuletzt(b.id));
    const sicher = gemischt.filter((e) => stand.get(e.id)?.sicher).sort((a, b) => zuletzt(a.id) - zuletzt(b.id));
    return [...offen, ...sicher];
  };
  const vorne = (o.wiederholen ?? []).map((id) => pool.find((e) => e.id === id)).filter((e): e is BioEintrag => !!e);
  let folge: BioEintrag[];
  if (o.verteilt) {
    const je = new Map<string, BioEintrag[]>();
    for (const e of reihe(pool)) je.set(e.thema, [...(je.get(e.thema) ?? []), e]);
    const themen = mische([...je.keys()], o.rng);
    folge = [];
    for (let i = 0; folge.length < pool.length; i++) {
      let neu = false;
      for (const t of themen) {
        const e = je.get(t)?.[i];
        if (e) {
          folge.push(e);
          neu = true;
        }
      }
      if (!neu) break;
    }
  } else folge = reihe(pool);
  const out: BioEintrag[] = [];
  const offeneMax = Math.max(1, Math.floor(o.anzahl / 3));
  for (const e of [...vorne, ...folge]) {
    if (out.length >= o.anzahl || out.includes(e)) continue;
    if (e.art === "erklaeren" && out.filter((x) => x.art === "erklaeren").length >= offeneMax) continue;
    out.push(e);
  }
  return mische(out, o.rng);
}

/** Blockwerk mit dem Biolabor: so viele Fragen je Runde, alle zum Selbstschreiben. */
export const SCHREIB_JE_RUNDE = 10;

/**
 * Was man im Blockwerk schreiben kann (niko 2026-11-23: „beim test kein ankreuzen … sie muss die antwort schreiben“):
 * die Fragen mit einer Antwort zum Schreiben und alle Begriffe, keine offenen Fragen und keine Schemata.
 */
export const schreibbar = (e: BioEintrag) => (e.art === "wahl" && !!e.schreib?.length) || e.art === "begriff";

/**
 * Was im Blockwerk drankommt (niko 2026-11-23: „es sind zu viele Fragen“): nur die Fragen der Lehrerin
 * (Fragenkatalog zum Test) und das Glossar der Schülerin aus ihrem Heft.
 */
export const BLOCK_THEMEN = ["lehrerin", "heft"];

/** Die Nummer im Fragenkatalog der Lehrerin („l-11-kind“ → 11, „k-l-erbse-f1“ → 16); sonst null. */
export function lehrerNr(e: Pick<BioEintrag, "id" | "thema">): number | null {
  if (e.thema !== "lehrerin") return null;
  const m = /^l-(\d+)/.exec(e.id);
  if (m) return Number(m[1]);
  if (e.id.startsWith("k-l-paar")) return 14;
  if (e.id.startsWith("k-l-erbse")) return 16;
  if (e.id.startsWith("k-l-meer")) return 17;
  return null;
}

/**
 * Fragen der Lehrerin: der Reihe nach wie auf dem Blatt. Zuerst die zuletzt falschen, dann die noch nicht sicheren in
 * der Reihenfolge des Blatts, zum Schluss die sicheren (am längsten her zuerst).
 */
function lehrerinReihe(pool: BioEintrag[], stand: Map<string, EintragStand>, anzahl: number, wiederholen: string[] = []): BioEintrag[] {
  const vorne = wiederholen.map((id) => pool.find((e) => e.id === id)).filter((e): e is BioEintrag => !!e);
  const offen = pool.filter((e) => !stand.get(e.id)?.sicher);
  const sicher = pool.filter((e) => stand.get(e.id)?.sicher).sort((a, b) => (stand.get(a.id)?.zuletzt ?? 0) - (stand.get(b.id)?.zuletzt ?? 0));
  const out: BioEintrag[] = [];
  for (const e of [...vorne, ...offen, ...sicher]) if (out.length < anzahl && !out.includes(e)) out.push(e);
  // auf dem Blatt der Reihe nach (die Wiederholungen vorne)
  const platz = (e: BioEintrag) => (lehrerNr(e) ?? 99) * 1000 + pool.indexOf(e);
  return [...out.filter((e) => vorne.includes(e)), ...out.filter((e) => !vorne.includes(e)).sort((a, b) => platz(a) - platz(b))];
}

// ---------- Labor-Mission: die Fragen der Lehrerin als Level (niko 2026-11-23: „es ist irgendwie kein richtiges spiel“) ----------

/** So viele Fehler beim ersten Versuch verzeiht ein Level; der nächste beendet es. */
export const LEBEN = 3;

/** Kurze Namen der Level (die Nummern vom Blatt der Lehrerin; 18 und 19 sind eine Aufgabe). */
export const LEVEL_TITEL: Record<number, string> = {
  1: "Mendelsche Regeln",
  2: "Dominant-rezessiv",
  3: "Intermediär",
  4: "Genotyp und Phänotyp",
  5: "Allel, homozygot, heterozygot",
  6: "Rezessiv, dominant, Gen, Chromosom",
  7: "Geschlechtszellen",
  8: "Keimzellen und Körperzellen",
  9: "Enkelkinder",
  10: "P-, F1- und F2-Generation",
  11: "Stammbaum Blutgruppen",
  12: "Wie viele Chromosomen?",
  13: "Haploid und diploid",
  14: "Kind vertauscht",
  15: "Vaterschaft",
  16: "Erbsen kreuzen",
  17: "Meerschweinchen",
  19: "Karyogramm",
  20: "Aufbau des Nervensystems",
  21: "Herz und vegetatives Nervensystem",
  22: "Organe und Gehirn",
  23: "Nervenzelle",
  24: "Gehirn beschriften",
};

/** Die Level in der Reihenfolge des Blatts. */
export const LEVELS: number[] = Object.keys(LEVEL_TITEL).map(Number).sort((a, b) => a - b);

export const levelAuswahl = (n: number): BioAuswahl => `level-${n}`;
export function levelVon(auswahl: string): number | null {
  const m = /^level-(\d+)$/.exec(auswahl);
  const n = m ? Number(m[1]) : NaN;
  return LEVELS.includes(n) ? n : null;
}

/** Die Einträge eines Levels: zuerst die kurzen Fragen, am Schluss die Frage der Lehrerin selbst (der Boss). */
export function levelEintraege(n: number): BioEintrag[] {
  const alle = BIO_EINTRAEGE.filter((e) => e.thema === "lehrerin" && lehrerNr(e) === n);
  return [...alle.filter((e) => e.art !== "erklaeren"), ...alle.filter((e) => e.art === "erklaeren")];
}

/** Sterne nach Fehlern beim ersten Versuch: keiner 3, einer 2, zwei 1, sonst keiner (Level nicht geschafft). */
export const sterneFuer = (fehler: number) => (fehler <= 0 ? 3 : fehler === 1 ? 2 : fehler === 2 ? 1 : 0);

/**
 * Die besten Sterne je Level aus den beendeten Runden: eine Runde zählt für ein Level, wenn alle ihre Karten zu ihm
 * gehören und jede Karte des Levels beantwortet ist (wer vorher alle Leben verliert, hat das Level nicht geschafft).
 */
export function levelStand(runden: { antworten: { key: string; richtig: boolean }[] }[]): Record<number, number> {
  const out: Record<number, number> = {};
  for (const r of runden) {
    if (!r.antworten.length) continue;
    const ids = r.antworten.map((a) => vonKey(a.key));
    const nrs = new Set(ids.map((id) => (id ? lehrerNr({ id, thema: eintrag(id)?.thema ?? "" }) : null)));
    if (nrs.size !== 1) continue;
    const n = [...nrs][0];
    if (n === null) continue;
    const keys = new Set(r.antworten.map((a) => a.key));
    const noetig = levelEintraege(n).flatMap((e) => (e.art === "kreuzung" ? [bioKey(e.id), bioKey(e.id, "frage")] : [bioKey(e.id)]));
    if (!noetig.every((k) => keys.has(k))) continue;
    const sterne = sterneFuer(r.antworten.filter((a) => !a.richtig).length);
    out[n] = Math.max(out[n] ?? 0, sterne);
  }
  return out;
}

/** Die ersten Level der zwei Welten (Genetik, Nervensystem) sind immer offen. */
export const WELT_ANFANG = [1, 20];
/** Offen: der Anfang einer Welt, oder das Level davor ist geschafft (mindestens ein Stern). */
export const levelOffen = (n: number, stand: Record<number, number>) => {
  const i = LEVELS.indexOf(n);
  return i >= 0 && (WELT_ANFANG.includes(n) || (i > 0 && (stand[LEVELS[i - 1]] ?? 0) > 0));
};

/** Die Karten einer Runde; `schreiben`: nur Fragen zum Selbstschreiben (Blockwerk), aus allen Themen. */
export function bioRunde(
  stand: Map<string, EintragStand>,
  o: { auswahl: BioAuswahl; modus: BioModus; gross?: boolean; schreiben?: boolean; wiederholen?: string[]; rng: Rng },
): SpielKarte[] {
  if (o.schreiben) {
    const pool = eintraegeFuer("alle", "test").filter((e) => schreibbar(e) && BLOCK_THEMEN.includes(e.thema));
    const wahl = waehleEintraege(pool, stand, { anzahl: SCHREIB_JE_RUNDE, wiederholen: o.wiederholen, rng: o.rng, verteilt: true });
    return wahl.flatMap((e) => eintragKarten(e, "test", o.rng));
  }
  const level = levelVon(o.auswahl);
  if (level !== null && !o.gross) return levelEintraege(level).flatMap((e) => eintragKarten(e, "test", o.rng));
  if (o.auswahl === "lehrerin" && !o.gross) {
    const pool = eintraegeFuer("lehrerin", o.modus);
    return lehrerinReihe(pool, stand, AUFGABEN_JE_RUNDE[o.modus], o.wiederholen).flatMap((e) => eintragKarten(e, o.modus, o.rng));
  }
  const modus: BioModus = o.gross ? "test" : o.modus;
  const pool = eintraegeFuer(o.gross ? "alle" : o.auswahl, modus);
  const anzahl = o.gross ? GROSSER_TEST : AUFGABEN_JE_RUNDE[modus];
  const wahl = waehleEintraege(pool, stand, { anzahl, wiederholen: o.wiederholen, rng: o.rng, verteilt: o.gross || o.auswahl === "alle" });
  return wahl.flatMap((e) => eintragKarten(e, modus, o.rng));
}

/** Je Thema: wie viele Einträge es gibt und wie viele sicher sind (für den Start und das Ende). */
export function themenStand(stand: Map<string, EintragStand>): { id: string; titel: string; bereich: Bereich; sicher: number; gesehen: number; alle: number }[] {
  return BIO_THEMEN.map((t) => {
    const liste = BIO_EINTRAEGE.filter((e) => e.thema === t.id);
    return {
      id: t.id,
      titel: t.titel,
      bereich: t.bereich,
      sicher: liste.filter((e) => stand.get(e.id)?.sicher).length,
      gesehen: liste.filter((e) => stand.has(e.id)).length,
      alle: liste.length,
    };
  });
}

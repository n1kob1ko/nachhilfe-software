/**
 * Biolabor (niko 2026-11-23): ein Lernspiel für den Biologie-Test einer 4. Klasse: Genetik (Vererbung, DNA,
 * Mendel’sche Regeln mit Kreuzungsschemata, Blutgruppen, Gentechnik) und „Der Mensch“ (Nervensystem, Gehirn,
 * unwillkürliches Nervensystem, Sympathikus und Parasympathikus, Hormone). Der Stoff steht in lib/biolabor-inhalt.ts.
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

/** Die Karten zu einem Eintrag (ein Kreuzungsschema gibt zwei: das Schema und die Frage danach). */
export function eintragKarten(e: BioEintrag, modus: BioModus, rng: Rng): SpielKarte[] {
  const basis = { skill: BIO_SKILL, vor: "", nach: "", regel: e.merke ?? "" };
  const daten = (d: Omit<BioDaten, "eintrag" | "thema" | "modus">): BioDaten => ({ eintrag: e.id, thema: e.thema, modus, ...d });
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

/** Die Karten einer Runde. */
export function bioRunde(
  stand: Map<string, EintragStand>,
  o: { auswahl: BioAuswahl; modus: BioModus; gross?: boolean; wiederholen?: string[]; rng: Rng },
): SpielKarte[] {
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

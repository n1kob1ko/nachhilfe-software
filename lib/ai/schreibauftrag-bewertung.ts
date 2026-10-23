/**
 * Die KI beim Schreibauftrag (Plan 4.2): „Mit KI vorschlagen“ für den Erwartungshorizont und „Bewertung vorschlagen“
 * für einen abgegebenen Text. Beides nur auf Klick der Lehrkraft, über den Router (Budget, Grenze je Schüler,
 * Protokoll, manueller Modus).
 *
 * An die KI gehen Textsorte, Arbeitsauftrag, Wortziel, Schulstufe, die Textbeilage mit Zeilennummern und für die
 * Bewertung der Erwartungshorizont und der Schülertext. Namen von Schüler, Lehrkräften und weitere gefundene Namen
 * ersetzt der Aufrufer vorher durch [Name] (lib/schreibauftrag-bewertung.ts).
 *
 * Dieselbe Funktion `bewertung` prüft für „Aufgabe erfüllt?“ (jede Textarbeit) je Arbeitsauftrag, ob er erfüllt ist. Die
 * Liste der Aufträge kommt von der App (lib/bewertung-kriterien.ts arbeitsauftraege), nie von der KI: sie antwortet für
 * genau diese Nummern, ein Eintrag zu einer anderen Nummer fällt heraus. Beim Schreibauftrag kommen die Urteile in
 * derselben Anfrage wie die vier Kriterien, bei einer anderen Textarbeit allein (kiAufgaben).
 *
 * Was zurückkommt, prüft die App (lib/zitatpruefung.ts): jedes Zitat und jede Zeilenangabe wird im Text gesucht,
 * was nicht gefunden wird, fällt heraus und wird gezählt. Alles bleibt ein Vorschlag: der Erwartungshorizont ist
 * „Ungeprüft“, bis die Lehrkraft ihn speichert; eine Bewertung zählt erst, wenn die Lehrkraft sie bestätigt.
 */
import { z } from "zod";
import {
  AUFTRAG_STATUS_KEYS,
  cleanErwartung,
  isAuftragStatus,
  isKriterium,
  KRITERIEN,
  KRITERIUM_KEYS,
  kriteriumName,
  leereErwartung,
  MAX_PUNKT,
  STUFEN,
  stufeOf,
  type AuftragStatus,
  type Erwartung,
  type KriteriumKey,
  type Stufe,
} from "../bewertung-kriterien";
import { planFor, SORTEN, type AuftragView } from "../schreibauftrag";
import { numberedLines, wordRange } from "../textinterpretation";
import { pruefeBeleg, pruefeStelle, pruefeText, type GefundenerBeleg, type Pruefgrundlage } from "../zitatpruefung";
import { runAI, type AIMeta } from "./router";

// ---------- what the KI gets ----------

/** Der Auftrag, wie die KI ihn bekommt; Arbeitsauftrag schon ohne Namen. */
export type AuftragDaten = { auftrag: AuftragView; arbeitsauftrag: string; stufe: string };

/** Die Textbeilage mit den Zeilennummern, die der Schüler sieht: „12 | …“; nicht gezählte Leerzeilen bleiben leer. */
export function beilageMitZeilen(a: Pick<AuftragView, "text" | "countBlank">): string {
  return numberedLines(a.text, a.countBlank)
    .map((l) => (l.n === null ? "" : `${String(l.n).padStart(3, " ")} | ${l.text}`))
    .join("\n");
}

function auftragsTeil(d: AuftragDaten): string[] {
  const a = d.auftrag;
  const s = SORTEN[a.sorte];
  const { min, max } = wordRange(a.target);
  const z: string[] = [];
  z.push(`Textsorte: ${s.name}`);
  z.push(`Schüler/in: ${d.stufe || "Oberstufe"}`);
  z.push(`Umfang: ${min} bis ${max} Wörter`);
  if (a.situation.trim()) z.push(`Schreibsituation: ${a.situation.trim()}`);
  z.push("", "Arbeitsauftrag:", d.arbeitsauftrag.trim());
  const plan = planFor(a);
  if (plan.length) z.push("", "Schreibplan:", ...plan.map((p) => `- ${p.title} (ca. ${p.words} Wörter): ${p.hint}`));
  if (s.merkmale.length) z.push("", `Merkmale: ${s.merkmale.join("; ")}`);
  const kopf = [`„${a.title}“`, a.author && `von ${a.author}`, [a.medium, a.year].filter(Boolean).join(", "), a.kind && `(${a.kind})`].filter(Boolean).join(" ");
  z.push("", `${s.beilage === "Geschichte" ? "Geschichte" : "Textbeilage"}: ${kopf}`, "Zeilennummer | Zeile", beilageMitZeilen(a));
  return z;
}

const KRITERIEN_TEXT = KRITERIEN.map((k) => `- ${k.key} (${k.name}): ${k.frage}`).join("\n");

const ZITIEREN = [
  "Zitate: Setze nur wörtliche Zitate in Anführungszeichen „…“, Buchstabe für Buchstabe aus dem Text kopiert, sonst keine Anführungszeichen (auch nicht für Begriffe).",
  "Zeilenangaben (Z. 12) nur aus den mitgeschickten Zeilennummern der Textbeilage und nur dort, wo das Zitat wirklich steht. Erfinde nie ein Zitat oder eine Zeile; bist du unsicher, lass Zitat und Zeile weg.",
  "Die App sucht jedes Zitat und jede Zeilenangabe im Text und streicht, was sie nicht findet.",
].join("\n");

// ---------- Erwartungshorizont ----------

const Punkte = (k: KriteriumKey) => z.array(z.string()).describe(`${kriteriumName(k)}: 2–6 kurze Punkte, je ein Satz`);
export const ErwartungSchema = z.object({
  inhalt: Punkte("inhalt"),
  textstruktur: Punkte("textstruktur"),
  stil: Punkte("stil"),
  sprachrichtigkeit: Punkte("sprachrichtigkeit"),
});
export type ErwartungKi = z.infer<typeof ErwartungSchema>;

const SYSTEM_ERWARTUNG = [
  "Du bereitest für eine Deutsch-Lehrkraft in Österreich den Erwartungshorizont zu einem Schreibauftrag der Oberstufe (SRDP) vor: was ein guter Text zu genau diesem Auftrag und dieser Textbeilage enthält.",
  "Gliedere nach den vier Kriterien:",
  KRITERIEN_TEXT,
  "Schreib je Kriterium 2–6 kurze, prüfbare Punkte. Beim Inhalt: welche Aussagen der Textbeilage ein guter Text aufgreifen muss (Position, Begründungen, Beispiele, bei einer Geschichte Figuren, Aufbau, sprachliche Mittel und mögliche Deutungen), mit Zeilen, wo es hilft.",
  "Offene Aufgaben haben mehr als eine richtige Antwort: Nenne bei Deutungen, Positionen und Stellungnahmen mehrere vertretbare Richtungen (z. B. „… oder …“) und woran man eine gut begründete erkennt, nie nur eine Lösung.",
  "Keine Noten, keine Punkte, kein Mustertext. Österreichisches Deutsch, sachlich, ohne Anrede.",
  ZITIEREN,
].join("\n");

export function erwartungAnfrage(d: AuftragDaten): { system: string; prompt: string } {
  return { system: SYSTEM_ERWARTUNG, prompt: auftragsTeil(d).join("\n") };
}

/** Die Antwort der KI, wie die App sie übernimmt: Punkte mit erfundenem Zitat oder falscher Zeile fallen heraus. */
export function pruefeErwartung(raw: ErwartungKi, g: Pruefgrundlage): { erwartung: Erwartung; verworfen: number } | { fehler: string } {
  let verworfen = 0;
  const roh = cleanErwartung(raw as unknown as Record<string, unknown>);
  const erwartung = leereErwartung();
  for (const k of KRITERIUM_KEYS)
    erwartung[k] = roh[k].filter((p) => {
      const ok = pruefeStelle(p, g).ok;
      if (!ok) verworfen++;
      return ok;
    });
  if (KRITERIUM_KEYS.every((k) => !erwartung[k].length)) return { fehler: verworfen ? "Die KI hat nur Zitate oder Zeilen geliefert, die nicht im Text stehen. Nichts übernommen." : "Die KI hat keinen brauchbaren Erwartungshorizont geliefert." };
  return { erwartung, verworfen };
}

export type KiErwartung = { ok: true; erwartung: Erwartung; verworfen: number; callId: number | null } | { ok: false; error: string };

export async function kiErwartung(d: AuftragDaten, g: Pruefgrundlage, meta: AIMeta): Promise<KiErwartung> {
  const { system, prompt } = erwartungAnfrage(d);
  const out = await runAI("erwartung", ErwartungSchema, system, prompt, { meta });
  if (!out.ok) return { ok: false, error: out.message };
  const geprueft = pruefeErwartung(out.data, g);
  if ("fehler" in geprueft) return { ok: false, error: geprueft.fehler };
  return { ok: true, ...geprueft, callId: out.callId };
}

// ---------- „Aufgabe erfüllt?“: je Arbeitsauftrag ein Urteil, bei jeder Textarbeit ----------

const BelegSchema = z.object({
  zitat: z.string().describe("wörtlich und buchstabengenau kopiert, ohne Anführungszeichen, meist 3–12 Wörter"),
  quelle: z.enum(["schuelertext", "textbeilage"]),
  zeile: z.string().nullable().describe("nur bei quelle textbeilage: die Zeile aus der Liste, z. B. „12“ oder „12f.“; sonst null"),
});

const AuftraegeSchema = z
  .array(
    z.object({
      nr: z.number().int().describe("die Nummer des Arbeitsauftrags aus der Liste"),
      status: z.string().describe(`Eines von: ${AUFTRAG_STATUS_KEYS.join(", ")}`),
      begruendung: z.string().describe("1–2 kurze Sätze, warum"),
      belege: z.array(BelegSchema).describe("0–2 Belege"),
    }),
  )
  .describe("Genau ein Eintrag je nummeriertem Arbeitsauftrag, in derselben Reihenfolge, keine weiteren");

/** Für eine Textarbeit ohne Schreibauftrag: nur die Arbeitsaufträge, keine Kriterien der SRDP. */
export const AufgabenSchema = z.object({ auftraege: AuftraegeSchema });
export type AufgabenKi = z.infer<typeof AufgabenSchema>;

const AUFTRAEGE_REGELN = [
  "Prüfe jeden nummerierten Arbeitsauftrag für sich: erfuellt (ganz bearbeitet), teilweise (angesprochen, aber unvollständig oder nur behauptet), fehlt (nicht bearbeitet) oder nicht_beurteilbar (ohne fehlende Angaben, etwa die Textvorlage, nicht zu sagen).",
  "Antworte für genau diese Nummern, in dieser Reihenfolge. Erfinde keine weiteren Aufträge oder Anforderungen; was nicht in der Aufgabenstellung steht, wird nicht verlangt.",
  "Hier zählt nur der Inhalt: ob der Auftrag bearbeitet ist und ob Aussagen über die Vorlage stimmen und begründet sind. Rechtschreibung, Grammatik und Zeichensetzung gehören nicht hierher.",
  "Eine andere Deutung oder Meinung ist nicht falsch, wenn sie am Text begründet ist. Begründe jedes Urteil in 1–2 kurzen Sätzen, höchstens zwei Belege.",
].join("\n");

const nummeriert = (punkte: string[]) => punkte.map((p, i) => `${i + 1}. ${p}`);

/** Ein Arbeitsauftrag, wie die App ihn zeigt: das Urteil der KI mit geprüfter Begründung und geprüften Belegen. */
export type AuftragErgebnis = {
  nr: number;
  /** der Auftrag, wie die App ihn aus der Aufgabenstellung gelesen hat */
  text: string;
  status: AuftragStatus;
  begruendung: string;
  belege: GefundenerBeleg[];
  /** so viele Sätze oder Belege fielen hier weg, weil ihr Zitat oder ihre Zeile nicht im Text steht */
  weggelassen: number;
  /** die KI hat zu diesem Auftrag nichts geliefert */
  ohneAntwort: boolean;
};

/**
 * Die Urteile der KI, wie die App sie übernimmt: je Auftrag der Liste genau eines. Ein Eintrag zu einer Nummer, die es
 * nicht gibt (ein erfundener Auftrag), oder ein zweiter zur selben Nummer fällt heraus und wird gezählt; ein Satz der
 * Begründung oder ein Beleg mit Zitat oder Zeile, die nicht im Text stehen, ebenso. Fehlt ein Auftrag, ist er
 * „nicht beurteilbar“ und so markiert.
 */
export function pruefeAuftraege(raw: AufgabenKi["auftraege"], punkte: string[], g: Pruefgrundlage): { auftraege: AuftragErgebnis[]; verworfen: number } {
  let verworfen = 0;
  const gesehen = new Map<number, AufgabenKi["auftraege"][number]>();
  for (const e of raw ?? []) {
    const nr = Number(e.nr);
    if (!Number.isInteger(nr) || nr < 1 || nr > punkte.length || gesehen.has(nr) || !isAuftragStatus(e.status)) verworfen++;
    else gesehen.set(nr, e);
  }
  const auftraege = punkte.map((text, i): AuftragErgebnis => {
    const e = gesehen.get(i + 1);
    if (!e) return { nr: i + 1, text, status: "nicht_beurteilbar", begruendung: "", belege: [], weggelassen: 0, ohneAntwort: true };
    const b = pruefeText(String(e.begruendung ?? "").slice(0, 1200), g);
    let weg = b.verworfen;
    const belege: GefundenerBeleg[] = [];
    for (const x of (e.belege ?? []).slice(0, 4)) {
      const ok = pruefeBeleg({ zitat: String(x.zitat ?? "").slice(0, MAX_PUNKT), quelle: x.quelle, zeile: x.zeile }, g);
      if (ok && belege.length < 2 && !belege.some((y) => y.zitat === ok.zitat)) belege.push(ok);
      else if (!ok) weg++;
    }
    verworfen += weg;
    return { nr: i + 1, text, status: isAuftragStatus(e.status) ? e.status : "nicht_beurteilbar", begruendung: b.text, belege, weggelassen: weg, ohneAntwort: false };
  });
  return { auftraege, verworfen };
}

/** Eine Textarbeit ohne Schreibauftrag, wie die KI sie für „Aufgabe erfüllt?“ bekommt; alles schon ohne Namen. */
export type AufgabenDaten = {
  fach: string;
  textsorte: string;
  stufe: string;
  /** die Zeilen der Aufgabenstellung, die zu keinem Auftrag gehören */
  rahmen: string[];
  punkte: string[];
  /** Angabe oder Textvorlage (bei einer Bildgeschichte die Bildbeschreibungen); '' = keine */
  vorlage: string;
  /** der Schülertext Absatz für Absatz */
  absaetze: string[];
  woerter: number;
};

const SYSTEM_AUFGABEN = [
  "Du prüfst für eine Lehrkraft in Österreich, ob ein Schülertext die Aufgabe erfüllt: je Arbeitsauftrag ein Urteil. Du bewertest nicht die Sprache und vergibst keine Note.",
  AUFTRAEGE_REGELN,
  "Fehlt die Angabe oder Textvorlage, beurteile den Bezug auf sie und Zitate daraus nicht; dann ist ein Auftrag, der nur damit zu prüfen ist, nicht_beurteilbar.",
  "Belege: wörtliche Stellen aus dem Schülertext oder der Angabe (quelle textbeilage).",
  ZITIEREN,
  "Schreib ohne Anrede. Nenne keine Namen; „[Name]“ steht für einen ersetzten Namen und bleibt so. Stütze dich nur auf den Text, keine Vermutungen über die Person. Die Lehrkraft entscheidet.",
].join("\n");

export function aufgabenAnfrage(d: AufgabenDaten): { system: string; prompt: string } {
  const z: string[] = [];
  z.push(`Fach: ${d.fach || "Deutsch"}`);
  if (d.textsorte.trim()) z.push(`Textsorte: ${d.textsorte.trim()}`);
  z.push(`Schüler/in: ${d.stufe}`);
  if (d.rahmen.length) z.push("", "Aufgabenstellung (Rahmen):", ...d.rahmen);
  z.push("", "Arbeitsaufträge (von der App nummeriert; beurteile genau diese):", ...nummeriert(d.punkte));
  if (d.vorlage.trim()) z.push("", "Angabe / Textvorlage:", "Zeilennummer | Zeile", beilageMitZeilen({ text: d.vorlage, countBlank: false }));
  else z.push("", "Angabe / Textvorlage: keine. Bezug auf eine Vorlage und Zitate daraus lassen sich nicht prüfen.");
  z.push("", `Schülertext (${d.woerter} Wörter, Absätze A1, A2 …):`);
  d.absaetze.forEach((p, i) => z.push(`A${i + 1}: ${p}`));
  return { system: SYSTEM_AUFGABEN, prompt: z.join("\n") };
}

export type KiAufgaben = { ok: true; auftraege: AuftragErgebnis[]; verworfen: number; callId: number | null } | { ok: false; error: string };

/** „Aufgabe erfüllt?“ für eine Textarbeit ohne Schreibauftrag: dieselbe KI-Funktion wie die Bewertung, ohne Kriterien. */
export async function kiAufgaben(d: AufgabenDaten, g: Pruefgrundlage, meta: AIMeta): Promise<KiAufgaben> {
  if (!d.punkte.length) return { ok: false, error: "Es gibt keine Aufgabenstellung." };
  const { system, prompt } = aufgabenAnfrage(d);
  const out = await runAI("bewertung", AufgabenSchema, system, prompt, { meta });
  if (!out.ok) return { ok: false, error: out.message };
  const geprueft = pruefeAuftraege(out.data.auftraege, d.punkte, g);
  if (geprueft.auftraege.every((a) => a.ohneAntwort)) return { ok: false, error: "Die KI hat zu keinem Arbeitsauftrag etwas Brauchbares geliefert." };
  return { ok: true, ...geprueft, callId: out.callId };
}

/**
 * Ungefähr, was „Aufgabe erfüllt?“ kostet, in Tokens: Anweisungen, Vorlage und Text gehen hinaus, je Auftrag ein kurzes
 * Urteil zurück, beim Schreibauftrag dazu die vier Kriterien und der Erwartungshorizont. Mit Denkzeit (Aufwand niedrig).
 */
export function estimateTokensBewertung(o: { woerter: number; vorlageWoerter: number; auftraege: number; srdp: boolean }) {
  const text = Math.round((o.woerter + o.vorlageWoerter) * 1.7);
  return { input: 1_100 + text + o.auftraege * 40 + (o.srdp ? 700 : 0), output: 500 + o.auftraege * 160 + (o.srdp ? 900 : 0) };
}

// ---------- Bewertung ----------

export const BewertungSchema = z.object({
  kriterien: z
    .array(
      z.object({
        kriterium: z.string().describe(`Eines von: ${KRITERIUM_KEYS.join(", ")}`),
        stufe: z.number().int().describe(`1–5: ${STUFEN.map((s) => `${s.wert} = ${s.name} (${s.text})`).join("; ")}`),
        begruendung: z.string().describe("1–3 kurze Sätze: was gelingt, was fehlt, gemessen am Erwartungshorizont"),
        belege: z
          .array(
            z.object({
              zitat: z.string().describe("wörtlich und buchstabengenau kopiert, ohne Anführungszeichen, meist 3–12 Wörter"),
              quelle: z.enum(["schuelertext", "textbeilage"]),
              zeile: z.string().nullable().describe("nur bei quelle textbeilage: die Zeile aus der Liste, z. B. „12“ oder „12f.“; sonst null"),
            }),
          )
          .describe("0–3 Belege für die Begründung"),
      }),
    )
    .describe("Genau vier Einträge, einer je Kriterium"),
  auftraege: AuftraegeSchema.default([]),
});
export type BewertungKi = z.infer<typeof BewertungSchema>;

export type BewertungDaten = AuftragDaten & {
  erwartung: Erwartung;
  /** false: die Vorlage aus der Textsorte, weil noch kein Erwartungshorizont gespeichert ist */
  erwartungGespeichert: boolean;
  /** der Schülertext Absatz für Absatz, Namen ersetzt */
  absaetze: string[];
  woerter: number;
  /** die Arbeitsaufträge, wie die App sie aus dem Arbeitsauftrag liest (lib/bewertung-kriterien.ts arbeitsauftraege) */
  punkte: string[];
};

const SYSTEM_BEWERTUNG = [
  "Du schlägst einer Deutsch-Lehrkraft in Österreich eine Bewertung eines Schülertexts zu einem Schreibauftrag der Oberstufe (SRDP) vor.",
  "Bewerte jedes der vier Kriterien für sich, gemessen am Erwartungshorizont und am Arbeitsauftrag:",
  KRITERIEN_TEXT,
  `Stufen: ${STUFEN.map((s) => `${s.wert} = ${s.name}: ${s.text}`).join("; ")}.`,
  "Begründe jede Stufe in 1–3 kurzen, sachlichen Sätzen (was gelingt, was fehlt). Stütze dich nur auf den Text, keine Vermutungen über die Person.",
  "Der Erwartungshorizont nennt Richtungen, keine einzige Lösung: Eine andere Deutung oder Meinung ist nicht falsch, wenn sie am Text begründet ist.",
  "Belege: wörtliche Stellen aus dem Schülertext oder der Textbeilage; höchstens drei je Kriterium.",
  "Dazu unter auftraege, getrennt von den Kriterien:",
  AUFTRAEGE_REGELN,
  ZITIEREN,
  "Schreib ohne Anrede. Nenne keine Namen; „[Name]“ steht für einen ersetzten Namen und bleibt so. Die Lehrkraft entscheidet über jede Stufe.",
].join("\n");

export function bewertungAnfrage(d: BewertungDaten): { system: string; prompt: string } {
  const z: string[] = auftragsTeil(d);
  if (d.punkte.length) z.push("", "Arbeitsaufträge (von der App nummeriert; beurteile genau diese unter auftraege):", ...nummeriert(d.punkte));
  z.push("", d.erwartungGespeichert ? "Erwartungshorizont der Lehrkraft:" : "Erwartungshorizont (Vorlage aus der Textsorte, noch nicht von der Lehrkraft angepasst):");
  for (const k of KRITERIEN) {
    z.push(`${k.name}:`);
    for (const p of d.erwartung[k.key]) z.push(`- ${p}`);
  }
  z.push("", `Schülertext (${d.woerter} Wörter, Absätze A1, A2 …):`);
  d.absaetze.forEach((p, i) => z.push(`A${i + 1}: ${p}`));
  return { system: SYSTEM_BEWERTUNG, prompt: z.join("\n") };
}

/** Ein Kriterium, wie die App es der Lehrkraft vorschlägt: Begründung und Belege geprüft. */
export type KriteriumVorschlag = { key: KriteriumKey; stufe: Stufe; begruendung: string; belege: GefundenerBeleg[] };

/**
 * Die Antwort der KI, wie die App sie übernimmt: je Kriterium höchstens ein Eintrag mit einer Stufe 1 bis 5; Sätze
 * der Begründung und Belege, deren Zitat oder Zeile nicht im Text steht, fallen heraus und werden gezählt.
 */
export function pruefeBewertung(raw: BewertungKi, g: Pruefgrundlage): { kriterien: KriteriumVorschlag[]; verworfen: number } | { fehler: string } {
  let verworfen = 0;
  const kriterien: KriteriumVorschlag[] = [];
  for (const e of raw.kriterien) {
    const key = e.kriterium.trim().toLowerCase().replace(/[^a-zäöüß]/g, "");
    const k = isKriterium(key) ? key : KRITERIEN.find((x) => x.name.toLowerCase().replace(/[^a-zäöüß]/g, "") === key)?.key;
    const stufe = stufeOf(e.stufe);
    if (!k || !stufe || kriterien.some((x) => x.key === k)) {
      verworfen++;
      continue;
    }
    const b = pruefeText(String(e.begruendung ?? "").slice(0, 2000), g);
    verworfen += b.verworfen;
    const belege: GefundenerBeleg[] = [];
    for (const x of e.belege.slice(0, 5)) {
      const ok = pruefeBeleg({ zitat: String(x.zitat ?? "").slice(0, MAX_PUNKT), quelle: x.quelle, zeile: x.zeile }, g);
      if (ok && belege.length < 3 && !belege.some((y) => y.zitat === ok.zitat)) belege.push(ok);
      else if (!ok) verworfen++;
    }
    kriterien.push({ key: k, stufe, begruendung: b.text, belege });
  }
  if (!kriterien.length) return { fehler: "Die KI hat keine brauchbare Bewertung geliefert." };
  kriterien.sort((a, b) => KRITERIUM_KEYS.indexOf(a.key) - KRITERIUM_KEYS.indexOf(b.key));
  return { kriterien, verworfen };
}

/** verworfen: bei den Kriterien; auftraegeVerworfen: bei den Arbeitsaufträgen (erfundene Aufträge, Sätze, Belege). */
export type KiBewertung = { ok: true; kriterien: KriteriumVorschlag[]; auftraege: AuftragErgebnis[]; verworfen: number; auftraegeVerworfen: number; callId: number | null } | { ok: false; error: string };

/** Die Bewertung eines Schreibauftrags: die vier Kriterien und, in derselben Anfrage, das Urteil je Arbeitsauftrag. */
export async function kiBewertung(d: BewertungDaten, g: Pruefgrundlage, meta: AIMeta): Promise<KiBewertung> {
  const { system, prompt } = bewertungAnfrage(d);
  const out = await runAI("bewertung", BewertungSchema, system, prompt, { meta });
  if (!out.ok) return { ok: false, error: out.message };
  const geprueft = pruefeBewertung(out.data, g);
  if ("fehler" in geprueft) return { ok: false, error: geprueft.fehler };
  const a = pruefeAuftraege(out.data.auftraege, d.punkte, g);
  return { ok: true, kriterien: geprueft.kriterien, auftraege: a.auftraege, verworfen: geprueft.verworfen, auftraegeVerworfen: a.verworfen, callId: out.callId };
}

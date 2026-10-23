/**
 * Die KI beim Schreibauftrag (Plan 4.2): „Mit KI vorschlagen“ für den Erwartungshorizont und „Bewertung vorschlagen“
 * für einen abgegebenen Text. Beides nur auf Klick der Lehrkraft, über den Router (Budget, Grenze je Schüler,
 * Protokoll, manueller Modus).
 *
 * An die KI gehen Textsorte, Arbeitsauftrag, Wortziel, Schulstufe, die Textbeilage mit Zeilennummern und für die
 * Bewertung der Erwartungshorizont und der Schülertext. Namen von Schüler, Lehrkräften und weitere gefundene Namen
 * ersetzt der Aufrufer vorher durch [Name] (lib/schreibauftrag-bewertung.ts).
 *
 * Was zurückkommt, prüft die App (lib/zitatpruefung.ts): jedes Zitat und jede Zeilenangabe wird im Text gesucht,
 * was nicht gefunden wird, fällt heraus und wird gezählt. Alles bleibt ein Vorschlag: der Erwartungshorizont ist
 * „Ungeprüft“, bis die Lehrkraft ihn speichert; eine Bewertung zählt erst, wenn die Lehrkraft sie bestätigt.
 */
import { z } from "zod";
import { cleanErwartung, isKriterium, KRITERIEN, KRITERIUM_KEYS, kriteriumName, leereErwartung, MAX_PUNKT, STUFEN, stufeOf, type Erwartung, type KriteriumKey, type Stufe } from "../bewertung-kriterien";
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
});
export type BewertungKi = z.infer<typeof BewertungSchema>;

export type BewertungDaten = AuftragDaten & {
  erwartung: Erwartung;
  /** false: die Vorlage aus der Textsorte, weil noch kein Erwartungshorizont gespeichert ist */
  erwartungGespeichert: boolean;
  /** der Schülertext Absatz für Absatz, Namen ersetzt */
  absaetze: string[];
  woerter: number;
};

const SYSTEM_BEWERTUNG = [
  "Du schlägst einer Deutsch-Lehrkraft in Österreich eine Bewertung eines Schülertexts zu einem Schreibauftrag der Oberstufe (SRDP) vor.",
  "Bewerte jedes der vier Kriterien für sich, gemessen am Erwartungshorizont und am Arbeitsauftrag:",
  KRITERIEN_TEXT,
  `Stufen: ${STUFEN.map((s) => `${s.wert} = ${s.name}: ${s.text}`).join("; ")}.`,
  "Begründe jede Stufe in 1–3 kurzen, sachlichen Sätzen (was gelingt, was fehlt). Stütze dich nur auf den Text, keine Vermutungen über die Person.",
  "Der Erwartungshorizont nennt Richtungen, keine einzige Lösung: Eine andere Deutung oder Meinung ist nicht falsch, wenn sie am Text begründet ist.",
  "Belege: wörtliche Stellen aus dem Schülertext oder der Textbeilage; höchstens drei je Kriterium.",
  ZITIEREN,
  "Schreib ohne Anrede. Nenne keine Namen; „[Name]“ steht für einen ersetzten Namen und bleibt so. Die Lehrkraft entscheidet über jede Stufe.",
].join("\n");

export function bewertungAnfrage(d: BewertungDaten): { system: string; prompt: string } {
  const z: string[] = auftragsTeil(d);
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

export type KiBewertung = { ok: true; kriterien: KriteriumVorschlag[]; verworfen: number; callId: number | null } | { ok: false; error: string };

export async function kiBewertung(d: BewertungDaten, g: Pruefgrundlage, meta: AIMeta): Promise<KiBewertung> {
  const { system, prompt } = bewertungAnfrage(d);
  const out = await runAI("bewertung", BewertungSchema, system, prompt, { meta });
  if (!out.ok) return { ok: false, error: out.message };
  const geprueft = pruefeBewertung(out.data, g);
  if ("fehler" in geprueft) return { ok: false, error: geprueft.fehler };
  return { ok: true, ...geprueft, callId: out.callId };
}

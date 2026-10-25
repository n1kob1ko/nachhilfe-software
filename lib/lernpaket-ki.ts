/**
 * **Lernpaket mit KI entwerfen** (Plan 2.1, niko 2026-10-23): unter Mehr › Lernpakete wählt der Lehrer eine
 * Fähigkeit (oder Fach und Thema), Schulart, Klasse, Dauer und schreibt bei Bedarf Hinweise dazu (typische
 * Fehler). Eine Anfrage an die KI über den Router (Budget, Protokoll, manueller Modus) liefert die Schritte;
 * daraus wird eine Datei im Importformat, die durch die Prüfung des Imports geht und als **Entwurf** mit der
 * Herkunft „ki“ gespeichert wird, „ungeprüft“, bis ein Lehrer sie prüft (lib/lernpakete.ts).
 *
 * Kein Schülerdatum geht mit: ein Lernpaket gehört zu einem Thema. Die Anfrage hat weder Schüler noch Einheit,
 * damit hängt der Router auch keine KI-Hinweise an; Namen in den Hinweisen des Lehrers werden ersetzt.
 * Aufgaben kommen zuerst aus dem Bestand ohne KI (Aufgabenbibliothek, eingebaute Generatoren und Banken);
 * eigene Aufgaben der KI nur, wenn sie die Prüfungen jeder KI-Aufgabe bestehen (lib/ai/lernpaket.ts).
 */
import { budget, costOf, isLocalModel, routeFor } from "./ai/config";
import { jsonSchemaOf } from "./ai/providers/schema";
import { entwurfAusAntwort, dateiFelder, LERNPAKET_SYSTEM, LernpaketKiSchema, lernpaketAnfrage, type BestandAufgabe, type KiAuftrag } from "./ai/lernpaket";
import { aiEnabled, budgetUsedUp, runAI } from "./ai/router";
import { aufgabeSchluessel, ausgeblendet, rueckmeldungZeile, staende, vorbildZeilen } from "./bewertungen";
import { DIFFICULTIES, type Difficulty } from "./curriculum";
import { db } from "./db";
import { EXPLAIN, generateBuiltIn, hasBuiltInGenerator } from "./generators";
import { importiereLernpaket, pruefeDateiAufgabe, pruefeMeta } from "./lernpakete";
import { searchLibrary } from "./library";
import { referenzVorbilder } from "./referenz";
import * as repo from "./repo";
import { klassenLabel, schulstufe } from "./school";
import { typischeFehler } from "./themen";
import { isWortartenSkill, wortartenFor } from "./wortarten";

/** What the teacher fills in under „Mit KI entwerfen“. */
export type KiEingabe = { skillId?: string | null; fach?: string; thema?: string; schulart?: string; klasse?: number | null; dauer?: number; schwierigkeit?: string; hinweise?: string };

export const KI_DAUER = { von: 10, bis: 240, vorgabe: 50 } as const;
const HINWEISE_MAX = 1000;

/** The teacher's input, checked like the data of every package (pruefeMeta), with the skill's Lehrplan data. */
export function pruefeEingabe(e: KiEingabe): { auftrag: KiAuftrag } | { fehler: string[] } {
  const skillId = e.skillId?.trim() || null;
  const skill = skillId ? repo.getSkill(skillId) : null;
  if (skillId && !skill) return { fehler: [`Die Fähigkeit „${skillId}“ gibt es in Lernheft nicht.`] };
  const fach = skill?.subject ?? (e.fach ?? "").trim();
  const thema = (e.thema ?? "").replace(/\s+/g, " ").trim() || skill?.area || "";
  if (!fach || !thema) return { fehler: ["Bitte eine Fähigkeit wählen, oder Fach und Thema angeben."] };
  const dauer = Number(e.dauer) || KI_DAUER.vorgabe;
  const schwierigkeit = (DIFFICULTIES as readonly string[]).includes(e.schwierigkeit ?? "") ? (e.schwierigkeit as Difficulty) : "mittel";
  const meta = pruefeMeta({ title: thema, fach, schulart: e.schulart ?? "", klasse: e.schulart?.trim() ? (e.klasse ?? null) : null, thema, skill_ids: skill ? [skill.id] : [], schwierigkeit, dauer_minuten: dauer, ziel: "" }, { skill_ids: "Fähigkeit" });
  if ("fehler" in meta) return meta;
  if (dauer < KI_DAUER.von || dauer > KI_DAUER.bis) return { fehler: [`Dauer: ${KI_DAUER.von} bis ${KI_DAUER.bis} Minuten.`] };
  const m = meta.wert;
  const stufe = m.schulart ? `${klassenLabel(m.schulart, m.klasse)}${m.klasse ? ` (Schulstufe ${schulstufe(m.schulart, m.klasse)})` : ""}` : "";
  const parent = skill?.parent_id ? repo.getSkill(skill.parent_id) : null;
  const grade = m.schulart && m.klasse ? schulstufe(m.schulart, m.klasse) : (skill?.grade_min ?? 5);
  return {
    auftrag: {
      fach: m.fach,
      thema: m.thema,
      schulart: m.schulart,
      klasse: m.klasse,
      stufe,
      skill,
      parent,
      dauer,
      schwierigkeit,
      hinweise: (e.hinweise ?? "").trim().slice(0, HINWEISE_MAX),
      erklaerung: skill ? (EXPLAIN[skill.id] ?? (parent ? EXPLAIN[parent.id] : undefined) ?? "") : "",
      fehler: skill ? typischeFehler(skill.id).slice(0, 8) : [],
      wortarten: skill && isWortartenSkill(skill.id) ? wortartenFor([skill.id], grade) : null,
      vorbilder: skill ? vorbildZeilen([skill.id], 3) : [],
      rueckmeldung: skill ? rueckmeldungZeile([skill.id]) : "",
    },
  };
}

const BESTAND = { bibliothek: 8, generator: 6 } as const;

/**
 * Tasks without KI for the package's skill: the Aufgabenbibliothek first, then the built-in generators (with
 * the task banks behind them), each checked like an imported task. The generator runs with a fixed seed, so
 * the list for one skill stays the same. Badly rated tasks are left out, well-rated ones are marked
 * (lib/bewertungen.ts; the library search puts them first).
 */
export function bestandFuer(a: KiAuftrag): BestandAufgabe[] {
  if (!a.skill) return [];
  const p = { skillIds: [a.skill.id], schwierigkeit: a.schwierigkeit, fach: a.fach };
  const out: BestandAufgabe[] = [];
  const prompts = new Set<string>();
  const weg = ausgeblendet();
  /** the key of each task as it is stored (its rating), before the import check */
  const schluessel: string[] = [];
  const nimm = (id: string, herkunft: BestandAufgabe["herkunft"], t: Parameters<typeof dateiFelder>[0]) => {
    const k = aufgabeSchluessel(t);
    if (prompts.has(t.prompt) || weg.has(k)) return false;
    const r = pruefeDateiAufgabe(dateiFelder(t), p);
    if ("fehler" in r) return false;
    prompts.add(t.prompt);
    out.push({ id, herkunft, aufgabe: r.aufgabe });
    schluessel.push(k);
    return true;
  };
  let n = 0;
  for (const e of searchLibrary({ subject: a.fach, skillId: a.skill.id }, 40)) {
    if (n >= BESTAND.bibliothek) break;
    if (nimm(`B${e.task.id}`, "bibliothek", e.task)) n++;
  }
  if (hasBuiltInGenerator(a.skill.id)) {
    const grade = a.schulart && a.klasse ? schulstufe(a.schulart, a.klasse) : a.skill.grade_min;
    const tasks = generateBuiltIn({ subject: a.fach, skills: [{ id: a.skill.id, name: a.skill.name }], difficulty: a.schwierigkeit, count: BESTAND.generator + 4, taskType: "mixed", seed: 1, grade, wortarten: a.wortarten });
    let g = 0;
    for (const t of tasks) {
      if (g >= BESTAND.generator) break;
      if (nimm(`G${g + 1}`, "generator", t)) g++;
    }
  }
  const st = staende(schluessel);
  return out.map((b, i) => (st.get(schluessel[i])?.gut ? { ...b, gut: true } : b));
}

/** Names that never leave the app: every teacher and every student. */
function bekannteNamen(): string[] {
  return (db().prepare("SELECT name FROM teachers UNION SELECT name FROM students").all() as { name: string }[]).map((r) => r.name);
}

/** Why the button cannot ask the KI now, or null. */
export function kiAusGrund(): string | null {
  if (!aiEnabled("lernpaket")) return "Die KI ist aus oder für den gewählten Anbieter ist kein Schlüssel hinterlegt (Erweitert › KI-Kosten). Neues Lernpaket und Importieren gehen weiter.";
  if (budgetUsedUp("lernpaket")) return "Das KI-Budget für diesen Monat ist aufgebraucht. Neues Lernpaket und Importieren gehen weiter.";
  return null;
}

const cent = (usd: number) => Math.round((usd / budget().usdPerEur) * 100);

/**
 * What a draft will cost, before the click: a typical request (system prompt, answer shape, about 2 500
 * tokens of request) and 14 000 to 24 000 tokens of answer with thinking. Plan: 15 to 25 Cent.
 */
export function kostenSchaetzung(): { text: string; usdVon: number; usdBis: number } {
  const route = routeFor("lernpaket");
  if (route.provider === "manual") return { text: "kostet nichts (manueller Modus)", usdVon: 0, usdBis: 0 };
  if (isLocalModel(route.provider)) return { text: "kostet nichts (lokales Modell)", usdVon: 0, usdBis: 0 };
  const input = Math.round((LERNPAKET_SYSTEM.length + JSON.stringify(jsonSchemaOf(LernpaketKiSchema)).length) / 3.2) + 2_500;
  const usd = (output: number) => costOf(route.model, "standard", { input, output, cacheWrite: 0, cacheRead: 0 });
  const [von, bis] = [usd(14_000), usd(24_000)];
  return { text: `ca. ${cent(von)}–${cent(bis)} Cent`, usdVon: von, usdBis: bis };
}

export type KiKosten = { usd: number; cent: number; tokensEin: number; tokensAus: number; denken: number | null; modell: string; sekunden: number };

/** What the request of a draft cost, from the cost log (ai_calls). */
export function kiKosten(callId: number | null): KiKosten | null {
  if (!callId) return null;
  const c = db().prepare("SELECT cost_usd, input_tokens, cache_write_tokens, cache_read_tokens, output_tokens, thinking_tokens, model, duration_ms FROM ai_calls WHERE id = ?").get(callId) as
    | { cost_usd: number; input_tokens: number; cache_write_tokens: number; cache_read_tokens: number; output_tokens: number; thinking_tokens: number | null; model: string; duration_ms: number }
    | undefined;
  if (!c) return null;
  return {
    usd: c.cost_usd,
    cent: cent(c.cost_usd),
    tokensEin: c.input_tokens + c.cache_write_tokens + c.cache_read_tokens,
    tokensAus: c.output_tokens,
    denken: c.thinking_tokens,
    modell: c.model,
    sekunden: Math.round(c.duration_ms / 1000),
  };
}

export type KiErgebnis = { ok: true; id: number; weggelassen: string[]; callId: number | null } | { ok: false; error: string };

/** One request per teacher and input at a time: a double click waits for the running one instead of paying twice. */
const laufend = ((globalThis as unknown as { __lernpaketKiLaufend?: Map<string, Promise<KiErgebnis>> }).__lernpaketKiLaufend ??= new Map());

/**
 * Asks the KI for a draft and stores it as Entwurf („ungeprüft“, quelle „ki“). Never throws: without KI, with
 * an empty budget, on a timeout or an answer that does not pass the checks a message comes back, and nothing
 * is stored. The request runs on in the server when the browser leaves; the package then appears in the list.
 */
export async function entwerfeLernpaket(e: KiEingabe, teacherId: number | null): Promise<KiErgebnis> {
  const key = `${teacherId ?? 0}:${JSON.stringify([e.skillId ?? "", e.fach ?? "", e.thema ?? "", e.schulart ?? "", e.klasse ?? null, e.dauer ?? null, e.schwierigkeit ?? "", e.hinweise ?? ""])}`;
  const running = laufend.get(key);
  if (running) return running;
  const job = (async (): Promise<KiErgebnis> => {
    try {
      const geprueft = pruefeEingabe(e);
      if ("fehler" in geprueft) return { ok: false, error: geprueft.fehler.join(" ") };
      const aus = kiAusGrund();
      if (aus) return { ok: false, error: aus };
      // mit Fähigkeit: geprüfte Einträge der Referenzsammlung dazu als Beispiele (lib/referenz.ts)
      const a = { ...geprueft.auftrag, referenzen: geprueft.auftrag.skill ? referenzVorbilder({ fach: geprueft.auftrag.fach, skillIds: [geprueft.auftrag.skill.id] }) : [] };
      const bestand = bestandFuer(a);
      const { system, prompt } = lernpaketAnfrage(a, bestand, bekannteNamen());
      // no student and no unit: the router adds no KI-Hinweise, and nothing about a student goes out
      const out = await runAI("lernpaket", LernpaketKiSchema, system, prompt, { meta: { teacherId, trigger: "lernpaket" } });
      if (!out.ok) return { ok: false, error: out.message };
      const gezahlt = kiKosten(out.callId);
      const kosten = gezahlt?.usd ? ` Die Anfrage hat ${gezahlt.cent} Cent gekostet.` : "";
      const entwurf = entwurfAusAntwort(out.data, a, bestand);
      if ("fehler" in entwurf) return { ok: false, error: `${entwurf.fehler}${kosten}` };
      const r = importiereLernpaket(entwurf.datei, teacherId, { quelle: "ki", kiCallId: out.callId });
      if ("fehler" in r) return { ok: false, error: `Der Entwurf der KI hat die Prüfung nicht bestanden: ${r.fehler.slice(0, 3).join(" ")}${kosten}` };
      return { ok: true, id: r.id, weggelassen: entwurf.weggelassen, callId: out.callId };
    } catch (err) {
      console.error("[Lernpaket KI]", err instanceof Error ? err.message : err);
      return { ok: false, error: "Der Entwurf konnte nicht erstellt werden." };
    }
  })().finally(() => laufend.delete(key));
  laufend.set(key, job);
  return job;
}

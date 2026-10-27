/**
 * **Präsentation aus einem Lernpaket erstellen** (Plan 5.1, niko 2026-10-23): auf der Seite eines geprüften Lernpakets
 * lässt der Lehrer die KI eine animierte Präsentation mit Vortragstext je Folie erstellen. Eine Anfrage über den
 * Router (Budget, Protokoll in ai_calls, manueller Modus) liefert den Inhalt der Folien als JSON (lib/ai/praesentation.ts);
 * er wird als **Vorschlag** gespeichert (praesentation_entwuerfe), nie als HTML.
 *
 * Erst mit „Übernehmen“ baut die App daraus index.html und lernheft-notizen.json (lib/praesentation-html.ts), packt
 * beides als ZIP und speichert es über denselben Weg wie ein Upload (importierePraesentation: dieselbe Prüfung), als
 * Präsentation „von der KI“, „Ungeprüft“, bis ein Lehrer sie ansieht. Dann ist sie mit dem Paket verknüpft, und die
 * Schritte bekommen die Foliennummern des Vorschlags. Sie gilt für jeden Schüler, der das Paket bekommt.
 *
 * Kein Schülerdatum geht mit: die Anfrage hat weder Schüler noch Einheit; Namen in den Texten des Pakets werden ersetzt.
 */
import { kiKosten } from "./lernpaket-ki";
import { budget, costOf, isLocalModel, routeFor } from "./ai/config";
import { jsonSchemaOf } from "./ai/providers/schema";
import { deckAusAntwort, folieJeSchritt, notizenAus, PRAESENTATION_SYSTEM, PraesentationKiSchema, praesentationAnfrage, type Deck, type PraesAuftrag, type PraesSchritt } from "./ai/praesentation";
import { aiEnabled, budgetUsedUp, runAI } from "./ai/router";
import { db, json } from "./db";
import { getLernpaket, SCHRITT_ARTEN, type LernpaketMitSchritten } from "./lernpakete";
import { deckHtml, zipDatei } from "./praesentation-html";
import { externeQuellen, NOTIZEN_DATEI } from "./praesentation-zip";
import { importierePraesentation, notizenDatei } from "./praesentationen";
import { klassenLabel, schulstufe } from "./school";

export { kiKosten };

export type PraesEntwurfStatus = "vorschlag" | "uebernommen" | "verworfen";
export type PraesEntwurf = {
  id: number;
  /** null: a proposal for one step of a unit (lib/praesentation-unterricht.ts, `unit_id`, `schritt_id`) */
  paket_id: number | null;
  unit_id: number | null;
  schritt_id: number | null;
  deck: Deck;
  status: PraesEntwurfStatus;
  praesentation_id: number | null;
  call_id: number | null;
  teacher_id: number | null;
  created_at: string;
};

type Row = Omit<PraesEntwurf, "deck"> & { inhalt: string };
export const toEntwurf = (r: Row): PraesEntwurf => {
  const { inhalt, ...rest } = r;
  return { ...rest, deck: json<Deck>(inhalt, { titel: "", folien: [] }) };
};

export function getPraesEntwurf(id: number): PraesEntwurf | null {
  const r = db().prepare("SELECT * FROM praesentation_entwuerfe WHERE id = ?").get(id) as Row | undefined;
  return r ? toEntwurf(r) : null;
}

/** The newest proposal of a package that is still waiting for „Übernehmen“ or „Verwerfen“. */
export function offenerPraesEntwurf(paketId: number): PraesEntwurf | null {
  const r = db().prepare("SELECT * FROM praesentation_entwuerfe WHERE paket_id = ? AND status = 'vorschlag' ORDER BY id DESC LIMIT 1").get(paketId) as Row | undefined;
  return r ? toEntwurf(r) : null;
}

/** What the KI gets from a package: its data and steps, no tasks, no internal notes, no student. */
export function auftragAus(p: LernpaketMitSchritten): PraesAuftrag & { schritte: (PraesSchritt & { id: number })[] } {
  const stufe = p.schulart ? `${klassenLabel(p.schulart, p.klasse)}${p.klasse ? ` (Schulstufe ${schulstufe(p.schulart, p.klasse)})` : ""}` : "";
  return {
    titel: p.title,
    fach: p.fach,
    stufe,
    thema: p.thema,
    ziel: p.ziel,
    dauer: p.minuten_summe || p.dauer_minuten,
    schritte: p.schritte.map((s, i) => ({
      id: s.id,
      nr: i + 1,
      art: SCHRITT_ARTEN[s.art] ?? s.art,
      titel: s.titel,
      minuten: s.minuten,
      lehrer_sagt: s.lehrer_sagt,
      lehrer_fragt: s.lehrer_fragt,
      erwartete_antwort: s.erwartete_antwort,
      bei_fehler: s.bei_fehler,
      folie: s.folie,
    })),
  };
}

/** Names that never leave the app: every teacher and every student. */
export function bekannteNamen(): string[] {
  return (db().prepare("SELECT name FROM teachers UNION SELECT name FROM students").all() as { name: string }[]).map((r) => r.name);
}

/** Why the button cannot ask the KI now, or null. Uploading a presentation goes on either way. */
export function praesKiAusGrund(): string | null {
  if (!aiEnabled("praesentation")) return "Die KI ist aus oder für den gewählten Anbieter ist kein Schlüssel hinterlegt (Erweitert › KI-Kosten). Eine Präsentation hochladen geht weiter.";
  if (budgetUsedUp("praesentation")) return "Das KI-Budget für diesen Monat ist aufgebraucht. Eine Präsentation hochladen geht weiter.";
  return null;
}

const cent = (usd: number) => Math.round((usd / budget().usdPerEur) * 100);

/** Tokens of an answer: 8 to 14 slides with notes (about 5 000) and thinking. */
export const PRAES_AUSGABE = { von: 12_000, bis: 28_000 } as const;

/**
 * What a deck will cost, before the click: system prompt, answer shape and this package's request (about 3.2
 * characters per token) in, 12 000 to 28 000 tokens of answer with thinking out. Plan: 30 to 60 Cent per topic.
 */
export function praesKostenSchaetzung(p?: LernpaketMitSchritten | null): { text: string; usdVon: number; usdBis: number } {
  return praesKostenFuer(p ? auftragAus(p) : null);
}

/** The same estimate for any request, e.g. one step of a unit (lib/praesentation-unterricht.ts). */
export function praesKostenFuer(a: PraesAuftrag | null): { text: string; usdVon: number; usdBis: number } {
  const route = routeFor("praesentation");
  if (route.provider === "manual") return { text: "kostet nichts (manueller Modus)", usdVon: 0, usdBis: 0 };
  if (isLocalModel(route.provider)) return { text: "kostet nichts (lokales Modell)", usdVon: 0, usdBis: 0 };
  const anfrage = a ? praesentationAnfrage(a).prompt.length : 6_000;
  const input = Math.round((PRAESENTATION_SYSTEM.length + JSON.stringify(jsonSchemaOf(PraesentationKiSchema)).length + anfrage) / 3.2);
  const usd = (output: number) => costOf(route.model, "standard", { input, output, cacheWrite: 0, cacheRead: 0 });
  const [von, bis] = [usd(PRAES_AUSGABE.von), usd(PRAES_AUSGABE.bis)];
  return { text: `ca. ${cent(von)}–${cent(bis)} Cent`, usdVon: von, usdBis: bis };
}

export type PraesKiErgebnis = { ok: true; id: number } | { ok: false; error: string };

/** One request per package at a time: a double click waits for the running one instead of paying twice. */
const laufend = ((globalThis as unknown as { __praesKiLaufend?: Map<number, Promise<PraesKiErgebnis>> }).__praesKiLaufend ??= new Map());

/**
 * Asks the KI for the slides of a checked package and stores them as a proposal. Never throws: without KI, with an
 * empty budget, on a timeout or an unusable answer a message comes back and nothing is stored. An older open
 * proposal of the package is set aside (verworfen), so there is only ever one to look at.
 */
export async function erstellePraesEntwurf(paketId: number, teacherId: number | null): Promise<PraesKiErgebnis> {
  const running = laufend.get(paketId);
  if (running) return running;
  const job = (async (): Promise<PraesKiErgebnis> => {
    try {
      const p = getLernpaket(paketId);
      if (!p) return { ok: false, error: "Dieses Lernpaket gibt es nicht." };
      if (p.status !== "geprueft") return { ok: false, error: "Eine Präsentation lässt sich erst aus einem geprüften Lernpaket erstellen." };
      if (!p.schritte.length) return { ok: false, error: "Das Lernpaket hat noch keine Schritte." };
      const aus = praesKiAusGrund();
      if (aus) return { ok: false, error: aus };
      const a = auftragAus(p);
      const { system, prompt } = praesentationAnfrage(a, bekannteNamen());
      // no student and no unit: the router adds no KI-Hinweise, and the per-student cap does not apply
      const out = await runAI("praesentation", PraesentationKiSchema, system, prompt, { meta: { teacherId, trigger: "praesentation" } });
      if (!out.ok) return { ok: false, error: out.message };
      const gezahlt = kiKosten(out.callId);
      const kosten = gezahlt?.usd ? ` Die Anfrage hat ${gezahlt.cent} Cent gekostet.` : "";
      const deck = deckAusAntwort(out.data, a, a.schritte);
      if ("fehler" in deck) return { ok: false, error: `${deck.fehler}${kosten}` };
      const conn = db();
      const id = conn.transaction(() => {
        conn.prepare("UPDATE praesentation_entwuerfe SET status = 'verworfen', updated_at = datetime('now') WHERE paket_id = ? AND status = 'vorschlag'").run(paketId);
        return Number(conn.prepare("INSERT INTO praesentation_entwuerfe (paket_id, inhalt, call_id, teacher_id) VALUES (?, ?, ?, ?)").run(paketId, JSON.stringify(deck), out.callId, teacherId).lastInsertRowid);
      })();
      return { ok: true, id };
    } catch (err) {
      console.error("[Präsentation KI]", err instanceof Error ? err.message : err);
      return { ok: false, error: "Die Präsentation konnte nicht erstellt werden." };
    }
  })().finally(() => laufend.delete(paketId));
  laufend.set(paketId, job);
  return job;
}

/** The files of a proposal as a teacher would upload them: index.html and lernheft-notizen.json in one ZIP. */
export function praesZip(d: Deck): { html: string; zip: Buffer } {
  const html = deckHtml(d);
  const notizen = JSON.stringify(notizenDatei(notizenAus(d)), null, 2);
  return { html, zip: zipDatei([{ pfad: "index.html", daten: Buffer.from(html, "utf8") }, { pfad: NOTIZEN_DATEI, daten: Buffer.from(notizen, "utf8") }]) };
}

export const dateiName = (titel: string) =>
  `praesentation-${
    titel
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "lernpaket"
  }.zip`;

/**
 * „Übernehmen“: the proposal becomes a Präsentation (checked like an upload), „von der KI“ and „Ungeprüft“, linked to
 * the package; each step's `folie` becomes the first slide that belongs to it (none: empty). An older presentation
 * of the package stays under Mehr › Präsentationen.
 */
export function uebernimmPraesEntwurf(entwurfId: number, teacherId: number | null): { ok: true; praesId: number; paketId: number } | { fehler: string } {
  const e = getPraesEntwurf(entwurfId);
  if (!e || e.status !== "vorschlag" || e.paket_id === null) return { fehler: "Diesen Vorschlag gibt es nicht mehr." };
  const p = getLernpaket(e.paket_id);
  if (!p || p.status === "archiviert") return { fehler: "Das Lernpaket ist archiviert. Erst wiederherstellen." };
  const { html, zip } = praesZip(e.deck);
  if (externeQuellen(html).length) return { fehler: "Die Präsentation würde Dateien von außen laden. Sie wurde nicht gespeichert." };
  const r = importierePraesentation(
    { name: dateiName(e.deck.titel || p.title), data: zip },
    { title: (e.deck.titel || p.title).slice(0, 120), fach: p.fach, schulart: p.schulart, klasse: p.klasse, thema: p.thema, skill_ids: p.skill_ids, schwierigkeit: p.schwierigkeit, beschreibung: `Zum Lernpaket „${p.title}“.` },
    teacherId,
    { quelle: "ki", kiCallId: e.call_id },
  );
  if ("pdf" in r) return { fehler: "Die Präsentation konnte nicht gespeichert werden." };
  if ("fehler" in r) return { fehler: `Die Präsentation hat die Prüfung nicht bestanden: ${r.fehler.slice(0, 3).join(" ")}` };
  const folien = folieJeSchritt(e.deck);
  const conn = db();
  conn.transaction(() => {
    conn.prepare("UPDATE lernpakete SET praesentation_id = ?, updated_at = datetime('now') WHERE id = ?").run(r.id, p.id);
    const setze = conn.prepare("UPDATE lernpaket_schritte SET folie = ? WHERE id = ? AND paket_id = ?");
    for (const s of p.schritte) setze.run(folien.get(s.id) ?? null, s.id, p.id);
    conn.prepare("UPDATE praesentation_entwuerfe SET status = 'uebernommen', praesentation_id = ?, updated_at = datetime('now') WHERE id = ?").run(r.id, e.id);
  })();
  return { ok: true, praesId: r.id, paketId: p.id };
}

/** „Verwerfen“: the proposal is set aside; nothing else changes. */
export function verwirfPraesEntwurf(entwurfId: number): { paketId: number } | null {
  const e = getPraesEntwurf(entwurfId);
  if (!e || e.paket_id === null) return null;
  db().prepare("UPDATE praesentation_entwuerfe SET status = 'verworfen', updated_at = datetime('now') WHERE id = ? AND status = 'vorschlag'").run(e.id);
  return { paketId: e.paket_id };
}

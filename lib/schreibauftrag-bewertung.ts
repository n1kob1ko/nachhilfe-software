/**
 * Erwartungshorizont und Bewertung eines Schreibauftrags (Plan 4.2), gespeichert in `auftrag_erwartungen` und
 * `text_bewertungen`.
 *
 * - **Erwartungshorizont** je Auftrag und Kriterium: die Lehrkraft schreibt ihn (oder nimmt die Vorlage der Textsorte)
 *   oder lässt ihn mit KI vorschlagen. Ein Vorschlag ist „Ungeprüft“, bis die Lehrkraft speichert; nur Gespeichertes
 *   gilt. Schüler sehen ihn nur, wenn die Lehrkraft ihn freigibt, und dann nur die gespeicherten Punkte.
 * - **Bewertung** eines abgegebenen Texts: „Bewertung vorschlagen“ fragt die KI nach einer Stufe und einer Begründung
 *   je Kriterium. Das ist ein Vorschlag; als Bewertung gilt nur, was die Lehrkraft bestätigt. Nichts davon geht in
 *   den Lernstand, die Diagnose oder die Dokumentation.
 * - Jedes Zitat und jede Zeilenangabe der KI prüft die App im Text (lib/zitatpruefung.ts).
 */
import { createHash } from "node:crypto";
import { aiEnabled, breakerState, budgetUsedUp, schuelerGestoppt } from "./ai/router";
import { grenzeErreichtText } from "./ai/schueler-kosten";
import { kiBewertung, kiErwartung, type AuftragDaten, type KriteriumVorschlag } from "./ai/schreibauftrag-bewertung";
import { erwartungLeer, KRITERIEN, parseBewertung, parseErwartung, vorlageFor, type Bewertung, type Erwartung } from "./bewertung-kriterien";
import { db } from "./db";
import { auftragFor } from "./schreibauftrag-store";
import type { AuftragView } from "./schreibauftrag";
import { blockText, parseDoc } from "./text-doc";
import { foundNames, levelOfText, maskText, namePattern, namesToHide } from "./text-correction";
import { bareText, cleanStory } from "./textinterpretation";
import { getText, type TextView } from "./texts";
import { pruefgrundlage, type GefundenerBeleg } from "./zitatpruefung";

const iso = () => new Date().toISOString();

/** Woran die App merkt, dass die Textbeilage seit dem Speichern geändert wurde (Zeilenangaben prüfen). */
export const beilageHash = (a: Pick<AuftragView, "text" | "countBlank">) => createHash("sha256").update(`${a.countBlank ? 1 : 0}\n${cleanStory(a.text)}`).digest("hex").slice(0, 16);

// ---------- Erwartungshorizont ----------

type ErwartungRow = {
  text_id: number;
  kriterien: string;
  beilage_hash: string;
  gespeichert_at: string | null;
  freigegeben: number;
  vorschlag: string;
  vorschlag_verworfen: number;
  vorschlag_at: string | null;
};

export type ErwartungInfo = {
  /** was die Lehrkraft gespeichert hat; null: noch nichts */
  gespeichert: Erwartung | null;
  gespeichertAt: string | null;
  freigegeben: boolean;
  /** der Vorschlag der KI, ungeprüft, bis die Lehrkraft speichert */
  vorschlag: Erwartung | null;
  /** so viele Punkte hat die Zitatprüfung aus dem Vorschlag genommen */
  verworfen: number;
  vorschlagAt: string | null;
  /** die Vorlage aus der Textsorte (ohne KI), für ein leeres Formular */
  vorlage: Erwartung;
  /** die Textbeilage wurde nach dem Speichern geändert */
  beilageGeaendert: boolean;
};

const erwartungRow = (textId: number) => (db().prepare("SELECT * FROM auftrag_erwartungen WHERE text_id = ?").get(textId) as ErwartungRow | undefined) ?? null;

export function erwartungInfo(textId: number): ErwartungInfo | null {
  const a = auftragFor(textId);
  const text = getText(textId);
  if (!a || !text) return null;
  const r = erwartungRow(textId);
  const gespeichert = parseErwartung(r?.kriterien);
  return {
    gespeichert,
    gespeichertAt: r?.gespeichert_at ?? null,
    freigegeben: Boolean(r?.freigegeben) && gespeichert !== null,
    vorschlag: parseErwartung(r?.vorschlag),
    verworfen: r?.vorschlag ? r.vorschlag_verworfen : 0,
    vorschlagAt: r?.vorschlag ? r.vorschlag_at : null,
    vorlage: vorlageFor(a, text.prompt),
    beilageGeaendert: Boolean(gespeichert && r?.beilage_hash && r.beilage_hash !== beilageHash(a)),
  };
}

function ensureErwartung(textId: number) {
  db().prepare("INSERT OR IGNORE INTO auftrag_erwartungen (text_id) VALUES (?)").run(textId);
}

/** Speichert den Erwartungshorizont der Lehrkraft; ein offener Vorschlag ist damit erledigt. Alles leer: gelöscht. */
export function speichereErwartung(textId: number, e: Erwartung, teacherId: number | null): boolean {
  const a = auftragFor(textId);
  if (!a) return false;
  ensureErwartung(textId);
  if (erwartungLeer(e)) {
    db().prepare("UPDATE auftrag_erwartungen SET kriterien = '', freigegeben = 0, gespeichert_at = NULL, vorschlag = '', vorschlag_at = NULL, vorschlag_verworfen = 0 WHERE text_id = ?").run(textId);
    return true;
  }
  db()
    .prepare("UPDATE auftrag_erwartungen SET kriterien = ?, beilage_hash = ?, gespeichert_at = ?, gespeichert_von = ?, vorschlag = '', vorschlag_at = NULL, vorschlag_verworfen = 0 WHERE text_id = ?")
    .run(JSON.stringify(e), beilageHash(a), iso(), teacherId, textId);
  return true;
}

/** Freigeben für den Schüler, nur einen gespeicherten Erwartungshorizont. */
export function setzeFreigabe(textId: number, on: boolean): boolean {
  const r = erwartungRow(textId);
  if (on && !parseErwartung(r?.kriterien)) return false;
  if (!r) return !on;
  db().prepare("UPDATE auftrag_erwartungen SET freigegeben = ? WHERE text_id = ?").run(on ? 1 : 0, textId);
  return true;
}

export function verwirfErwartungVorschlag(textId: number) {
  db().prepare("UPDATE auftrag_erwartungen SET vorschlag = '', vorschlag_at = NULL, vorschlag_verworfen = 0 WHERE text_id = ?").run(textId);
}

/**
 * Was der Schüler beim Schreiben sieht: nur ein gespeicherter und freigegebener Erwartungshorizont, nie ein Vorschlag.
 * null: nichts freigegeben.
 */
export function freigegebeneErwartung(textId: number): { name: string; punkte: string[] }[] | null {
  const r = erwartungRow(textId);
  if (!r?.freigegeben) return null;
  const e = parseErwartung(r.kriterien);
  if (!e) return null;
  return KRITERIEN.map((k) => ({ name: k.name, punkte: e[k.key] })).filter((k) => k.punkte.length);
}

// ---------- KI: whether it can be asked, and what it gets ----------

/** Ob die KI jetzt gefragt werden kann; sonst der Grund in Worten. */
export function kiStatus(fn: "erwartung" | "bewertung", studentId: number): { moeglich: boolean; grund: string | null } {
  const grund = !aiEnabled(fn)
    ? "Die KI ist aus oder nicht eingerichtet. Du kannst alles selbst eintragen."
    : budgetUsedUp(fn)
      ? "Das KI-Budget für diesen Monat ist aufgebraucht. Du kannst alles selbst eintragen."
      : schuelerGestoppt(fn, studentId)
        ? grenzeErreichtText()
        : breakerState().paused
          ? "Die KI war zuletzt nicht erreichbar und pausiert ein paar Minuten."
          : null;
  return { moeglich: grund === null, grund };
}

/**
 * Wer verborgen wird: Schüler, Lehrkräfte und weitere Namen, die die App im Text findet, außer Namen, die in der
 * Textbeilage stehen (Figuren, Autorin): die Textbeilage geht ohnehin mit, und Zitate daraus müssen sich finden lassen.
 */
function namenMuster(text: TextView, a: AuftragView): RegExp | null {
  const doc = parseDoc(text.body);
  const beilage = ` ${bareText(`${a.text} ${a.author}`)} `;
  const gefunden = foundNames(text, doc).filter((n) => !bareText(n).split(" ").every((w) => beilage.includes(` ${w} `)));
  return namePattern([...namesToHide(text), ...gefunden]);
}

function auftragDaten(text: TextView, a: AuftragView, muster: RegExp | null): AuftragDaten {
  return {
    auftrag: { ...a, situation: maskText(a.situation, muster).masked },
    arbeitsauftrag: maskText(text.prompt, muster).masked,
    stufe: levelOfText(text).label,
  };
}

const laufend = new Map<string, Promise<VorschlagErgebnis>>();
export type VorschlagErgebnis = { ok: true; verworfen: number } | { ok: false; error: string };

/** „Mit KI vorschlagen“: ein Vorschlag für den Erwartungshorizont, ungeprüft, bis die Lehrkraft speichert. */
export function erwartungVorschlagen(textId: number, teacherId: number | null): Promise<VorschlagErgebnis> {
  const key = `e${textId}`;
  const running = laufend.get(key);
  if (running) return running;
  const job = (async (): Promise<VorschlagErgebnis> => {
    const text = getText(textId);
    const a = auftragFor(textId);
    if (!text || !a) return { ok: false, error: "Diesen Schreibauftrag gibt es nicht." };
    const geht = kiStatus("erwartung", text.student_id);
    if (!geht.moeglich) return { ok: false, error: geht.grund! };
    const muster = namenMuster(text, a);
    const g = pruefgrundlage({ beilage: a.text, countBlank: a.countBlank, titel: a.title, medium: a.medium });
    const out = await kiErwartung(auftragDaten(text, a, muster), g, { teacherId, studentId: text.student_id, trigger: "erwartung" });
    if (!out.ok) return { ok: false, error: out.error };
    ensureErwartung(textId);
    db().prepare("UPDATE auftrag_erwartungen SET vorschlag = ?, vorschlag_verworfen = ?, vorschlag_at = ?, vorschlag_call_id = ? WHERE text_id = ?").run(JSON.stringify(out.erwartung), out.verworfen, iso(), out.callId, textId);
    return { ok: true, verworfen: out.verworfen };
  })().finally(() => laufend.delete(key));
  laufend.set(key, job);
  return job;
}

// ---------- Bewertung ----------

type BewertungRow = {
  text_id: number;
  kriterien: string;
  note: number | null;
  version: number | null;
  bestaetigt_at: string | null;
  vorschlag: string;
  vorschlag_version: number | null;
  vorschlag_verworfen: number;
  vorschlag_at: string | null;
};

export type BewertungVorschlag = { kriterien: KriteriumVorschlag[]; verworfen: number; version: number | null; at: string | null };

export type BewertungInfo = {
  /** nur das zählt: von der Lehrkraft bestätigt */
  bestaetigt: Bewertung | null;
  bestaetigtAt: string | null;
  /** die Fassung des Texts, die bestätigt wurde */
  version: number | null;
  vorschlag: BewertungVorschlag | null;
};

const bewertungRow = (textId: number) => (db().prepare("SELECT * FROM text_bewertungen WHERE text_id = ?").get(textId) as BewertungRow | undefined) ?? null;

function parseVorschlag(json: string): KriteriumVorschlag[] | null {
  if (!json) return null;
  try {
    const list = JSON.parse(json) as KriteriumVorschlag[];
    return Array.isArray(list) ? list.map((k) => ({ ...k, belege: Array.isArray(k.belege) ? (k.belege as GefundenerBeleg[]) : [] })) : null;
  } catch {
    return null;
  }
}

export function bewertungInfo(textId: number): BewertungInfo {
  const r = bewertungRow(textId);
  const v = parseVorschlag(r?.vorschlag ?? "");
  return {
    bestaetigt: parseBewertung(r?.kriterien),
    bestaetigtAt: r?.bestaetigt_at ?? null,
    version: r?.version ?? null,
    vorschlag: v && r ? { kriterien: v, verworfen: r.vorschlag_verworfen, version: r.vorschlag_version, at: r.vorschlag_at } : null,
  };
}

/** Ab so vielen Wörtern gibt es einen Vorschlag; die Lehrkraft kann jeden Text selbst bewerten. */
export const BEWERTUNG_MIN_WORDS = 30;
export const BEWERTUNG_MAX_WORDS = 2_500;

/** Ob „Bewertung vorschlagen“ für diesen Text geht; sonst der Grund. */
export function bewertungMoeglich(text: TextView): string | null {
  if (text.status !== "fertig") return "Den Vorschlag gibt es, sobald der Text abgegeben ist.";
  if (text.words < BEWERTUNG_MIN_WORDS) return `Für einen Vorschlag braucht der Text mindestens ${BEWERTUNG_MIN_WORDS} Wörter.`;
  if (text.words > BEWERTUNG_MAX_WORDS) return `Für einen Vorschlag ist der Text zu lang (höchstens ${BEWERTUNG_MAX_WORDS.toLocaleString("de-AT")} Wörter).`;
  return kiStatus("bewertung", text.student_id).grund;
}

/**
 * „Bewertung vorschlagen“, nach der Zustimmung der Lehrkraft: der Text ohne Namen, der Erwartungshorizont (gespeichert,
 * sonst die Vorlage der Textsorte, nie ein ungeprüfter Vorschlag) und die Textbeilage gehen an die KI. Der Vorschlag
 * ersetzt einen älteren Vorschlag; eine bestätigte Bewertung bleibt, bis die Lehrkraft eine neue bestätigt.
 */
export function bewertungVorschlagen(textId: number, teacherId: number | null, o: { zustimmung: boolean }): Promise<VorschlagErgebnis> {
  if (!o.zustimmung) return Promise.resolve({ ok: false, error: "Bitte zuerst bestätigen, dass der Text ohne Namen an die KI gehen darf." });
  const key = `b${textId}`;
  const running = laufend.get(key);
  if (running) return running;
  const job = (async (): Promise<VorschlagErgebnis> => {
    const text = getText(textId);
    const a = auftragFor(textId);
    if (!text || !a) return { ok: false, error: "Diesen Schreibauftrag gibt es nicht." };
    const nicht = bewertungMoeglich(text);
    if (nicht) return { ok: false, error: nicht };
    const muster = namenMuster(text, a);
    const absaetze = parseDoc(text.body)
      .map((b) => maskText(blockText(b), muster).masked.replace(/\s*\n\s*/g, " ").trim())
      .filter(Boolean);
    const e = erwartungInfo(textId)!;
    const g = pruefgrundlage({ beilage: a.text, countBlank: a.countBlank, schueler: absaetze, titel: a.title, medium: a.medium });
    const out = await kiBewertung(
      { ...auftragDaten(text, a, muster), erwartung: e.gespeichert ?? e.vorlage, erwartungGespeichert: e.gespeichert !== null, absaetze, woerter: text.words },
      g,
      { teacherId, studentId: text.student_id, trigger: "bewertung" },
    );
    if (!out.ok) return { ok: false, error: out.error };
    db().prepare("INSERT OR IGNORE INTO text_bewertungen (text_id) VALUES (?)").run(textId);
    db()
      .prepare("UPDATE text_bewertungen SET vorschlag = ?, vorschlag_version = ?, vorschlag_verworfen = ?, vorschlag_at = ?, vorschlag_call_id = ? WHERE text_id = ?")
      .run(JSON.stringify(out.kriterien), text.version, out.verworfen, iso(), out.callId, textId);
    return { ok: true, verworfen: out.verworfen };
  })().finally(() => laufend.delete(key));
  laufend.set(key, job);
  return job;
}

/** Die Lehrkraft bestätigt die Bewertung: nur diese Werte gelten. Ein offener Vorschlag ist damit erledigt. */
export function bestaetigeBewertung(textId: number, b: Bewertung, teacherId: number | null): boolean {
  const text = getText(textId);
  if (!text || !auftragFor(textId)) return false;
  db().prepare("INSERT OR IGNORE INTO text_bewertungen (text_id) VALUES (?)").run(textId);
  db()
    .prepare("UPDATE text_bewertungen SET kriterien = ?, note = ?, version = ?, bestaetigt_at = ?, bestaetigt_von = ?, vorschlag = '', vorschlag_version = NULL, vorschlag_verworfen = 0, vorschlag_at = NULL WHERE text_id = ?")
    .run(JSON.stringify(b), b.note, text.version, iso(), teacherId, textId);
  return true;
}

export function verwirfBewertungVorschlag(textId: number) {
  db().prepare("UPDATE text_bewertungen SET vorschlag = '', vorschlag_version = NULL, vorschlag_verworfen = 0, vorschlag_at = NULL WHERE text_id = ?").run(textId);
}

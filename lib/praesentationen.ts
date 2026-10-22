/**
 * Präsentationen: animated HTML presentations (claude.ai, reveal.js, iSpring, Articulate …) a teacher
 * uploads as one HTML file or a ZIP, with a Vortragstext per slide. The animations stay because the
 * browser plays the deck as it is. PowerPoint itself cannot be played faithfully: a PDF goes to Material.
 *
 * Safety (docs/praesentation-format.md): the ZIP is unpacked by lib/praesentation-zip.ts; the files lie in
 * uploads/praesentationen/<token>/ and are served only on the presentation address
 * (lib/praesentation-host.ts), only if listed in the row's `dateien`, in a sandbox without access to the
 * app. The Vortragstext lives only in the database and is only shown on teacher pages; the notes file
 * of a ZIP is read, never served.
 *
 * Never deleted: archiving keeps it retrievable, like a Lernpaket.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { db, json } from "./db";
import type { Difficulty } from "./curriculum";
import { pruefeMeta } from "./lernpakete";
import { uploadsDir } from "./materials";
import { BRUECKE, MAX_FOLIE } from "./praesentation-protokoll";
import { istHtml, leseHtml, leseZip, typVon, uploadArt, GRENZEN as ZIP_GRENZEN } from "./praesentation-zip";
import { schulstufe } from "./school";

export const NOTIZEN_FORMAT = "lernheft-praesentation-notizen";
export const NOTIZEN_VERSION = 1;
export const NOTIZ_MAX = 4000;

export const PRAES_STATUS = { aktiv: "Aktiv", archiviert: "Archiviert" } as const;
export type PraesStatus = keyof typeof PRAES_STATUS;

export type Praesentation = {
  id: number;
  title: string;
  fach: string;
  schulart: string;
  klasse: number | null;
  schulstufe: number | null;
  thema: string;
  skill_ids: string[];
  schwierigkeit: Difficulty;
  beschreibung: string;
  /** random; names the folder and the deck's address */
  token: string;
  start_pfad: string;
  /** the only files that are served */
  dateien: { pfad: string; groesse: number }[];
  groesse: number;
  datei_name: string;
  /** hosts the deck wants to load from outside (blocked) */
  extern: string[];
  /** Vortragstext per slide number. Teacher pages only. */
  notizen: Record<number, string>;
  status: PraesStatus;
  created_by: number | null;
  created_at: string;
  updated_at: string;
};

/** What the upload form and the edit form give: the data of a Lernpaket, with a description instead of a goal. */
export type PraesMeta = {
  title: string;
  fach: string;
  schulart: string;
  klasse: number | null;
  thema: string;
  skill_ids: string[];
  schwierigkeit: Difficulty;
  beschreibung: string;
};

// ---------- notes ----------

const NotizenSchema = z.strictObject({
  format: z.literal(NOTIZEN_FORMAT),
  version: z.literal(NOTIZEN_VERSION),
  folien: z
    .array(
      z.strictObject({
        folie: z.number().int().min(1).max(MAX_FOLIE),
        notiz: z.string().max(NOTIZ_MAX),
      }),
    )
    .max(MAX_FOLIE),
});

/**
 * Reads a notes file (lernheft-notizen.json, docs/praesentation-format.md): one Vortragstext per slide.
 * Empty notes are left out; a slide twice is an error.
 */
export function leseNotizen(roh: string): { ok: true; notizen: Record<number, string> } | { ok: false; fehler: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(roh.replace(/^﻿/, ""));
  } catch (e) {
    return { ok: false, fehler: [`lernheft-notizen.json ist kein gültiges JSON (${e instanceof Error ? e.message : "nicht lesbar"}).`] };
  }
  const r = NotizenSchema.safeParse(raw);
  if (!r.success) {
    return {
      ok: false,
      fehler: r.error.issues.slice(0, 8).map((i) => {
        const wo = i.path.length ? `„${i.path.map((k) => (typeof k === "number" ? k + 1 : String(k))).join(" › ")}“` : "Datei";
        if (i.path[0] === "format") return `lernheft-notizen.json: „format“ muss „${NOTIZEN_FORMAT}“ sein.`;
        if (i.path[0] === "version") return `lernheft-notizen.json: unterstützt wird „version“: ${NOTIZEN_VERSION}.`;
        if (i.path.at(-1) === "folie") return `lernheft-notizen.json, ${wo}: eine Foliennummer von 1 bis ${MAX_FOLIE}.`;
        if (i.path.at(-1) === "notiz") return `lernheft-notizen.json, ${wo}: ein Text bis ${NOTIZ_MAX} Zeichen.`;
        if (i.code === "unrecognized_keys") return `lernheft-notizen.json, ${wo}: unbekanntes Feld ${i.keys.map((k) => `„${k}“`).join(", ")}.`;
        return `lernheft-notizen.json, ${wo}: ${i.message}`;
      }),
    };
  }
  const notizen: Record<number, string> = {};
  for (const f of r.data.folien) {
    if (f.folie in notizen) return { ok: false, fehler: [`lernheft-notizen.json: Folie ${f.folie} steht zweimal.`] };
    const t = f.notiz.trim();
    if (t) notizen[f.folie] = t;
  }
  return { ok: true, notizen };
}

/** The notes as a file, for export and for the documentation's example. */
export function notizenDatei(notizen: Record<number, string>) {
  return {
    format: NOTIZEN_FORMAT,
    version: NOTIZEN_VERSION,
    folien: Object.entries(notizen)
      .map(([k, v]) => ({ folie: Number(k), notiz: v }))
      .sort((a, b) => a.folie - b.folie),
  };
}

// ---------- storage ----------

export const praesentationsOrdner = () => path.join(/*turbopackIgnore: true*/ uploadsDir(), "praesentationen");
const TOKEN = /^[A-Za-z0-9_-]{24}$/;

/** A file of a deck on disk; only for paths that passed pfadProblem (checked again here). */
function ziel(ordner: string, pfad: string): string {
  const voll = path.resolve(ordner, ...pfad.split("/"));
  if (!voll.startsWith(path.resolve(ordner) + path.sep)) throw new Error("Pfad außerhalb des Ordners.");
  return voll;
}

/** Writes the files into a fresh folder and moves it into place at once: never a half-written deck. */
function schreibeDateien(token: string, dateien: { pfad: string; daten: Buffer }[]) {
  const basis = praesentationsOrdner();
  fs.mkdirSync(/*turbopackIgnore: true*/ basis, { recursive: true });
  const tmp = path.join(basis, `.neu-${token}`);
  fs.rmSync(/*turbopackIgnore: true*/ tmp, { recursive: true, force: true });
  try {
    for (const d of dateien) {
      const z = ziel(tmp, d.pfad);
      fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(z), { recursive: true });
      fs.writeFileSync(/*turbopackIgnore: true*/ z, d.daten, { mode: 0o600, flag: "wx" });
    }
    fs.renameSync(/*turbopackIgnore: true*/ tmp, path.join(basis, token));
  } catch (e) {
    fs.rmSync(/*turbopackIgnore: true*/ tmp, { recursive: true, force: true });
    throw e;
  }
}

/** pruefeMeta speaks of „das Paket“; the same checks apply to a presentation (with no duration). */
const praesWort = (f: string) => f.replace("das Paket ist", "die Präsentation ist");

const sauberName = (n: string) => n.replace(/[\\/]/g, "_").replace(/[\u0000-\u001f]/g, "").slice(0, 160);

export type ImportErgebnis = { id: number; extern: string[] } | { fehler: string[] } | { pdf: true };

/**
 * An upload from the teacher: one HTML file or a ZIP. Checked (lib/praesentation-zip.ts), the notes file
 * read, the files written, the row stored. A PDF is not a presentation here: the caller puts it under Material.
 */
export function importierePraesentation(datei: { name: string; data: Buffer }, m: PraesMeta, teacherId: number | null): ImportErgebnis {
  if (!datei.data.length) return { fehler: ["Bitte eine Datei wählen."] };
  if (datei.data.length > ZIP_GRENZEN.upload) return { fehler: [`Die Datei ist zu groß (höchstens ${ZIP_GRENZEN.upload / 1024 / 1024} MB).`] };
  const art = uploadArt(datei.name, datei.data);
  if (art === "pdf") return { pdf: true };
  if (art === "pptx")
    return {
      fehler: [
        "PowerPoint kann Lernheft nicht mit Animationen abspielen. Entweder als HTML exportieren (z. B. mit iSpring oder als Web-Präsentation) und die ZIP-Datei hochladen, oder als PDF speichern und hier hochladen (dann ohne Animationen, unter Material).",
      ],
    };
  if (art === "unbekannt") return { fehler: ["Bitte eine .html- oder .zip-Datei wählen (oder ein PDF ohne Animationen)."] };
  const meta = pruefeMeta({ ...m, title: m.title || datei.name.replace(/\.[a-z0-9]{2,4}$/i, ""), dauer_minuten: 1, ziel: m.beschreibung }, { ziel: "beschreibung" });
  if ("fehler" in meta) return { fehler: meta.fehler.map(praesWort) };
  const r = art === "zip" ? leseZip(datei.data) : leseHtml(datei.data);
  if (!r.ok) return { fehler: [r.fehler] };
  let notizen: Record<number, string> = {};
  if (r.wert.notizen !== null) {
    const n = leseNotizen(r.wert.notizen);
    if (!n.ok) return { fehler: n.fehler };
    notizen = n.notizen;
  }
  const token = crypto.randomBytes(18).toString("base64url");
  schreibeDateien(token, r.wert.dateien);
  const w = meta.wert;
  const res = db()
    .prepare(
      `INSERT INTO praesentationen (title, fach, schulart, klasse, schulstufe, thema, skill_ids, schwierigkeit, beschreibung, token, start_pfad, dateien, groesse, datei_name, extern, notizen, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      w.title, w.fach, w.schulart, w.klasse, w.schulart && w.klasse ? schulstufe(w.schulart, w.klasse) : null, w.thema, JSON.stringify(w.skill_ids), w.schwierigkeit, w.ziel,
      token, r.wert.start, JSON.stringify(r.wert.dateien.map((d) => ({ pfad: d.pfad, groesse: d.daten.length }))), r.wert.dateien.reduce((n, d) => n + d.daten.length, 0),
      sauberName(datei.name), JSON.stringify(r.wert.extern), JSON.stringify(notizen), teacherId,
    );
  return { id: Number(res.lastInsertRowid), extern: r.wert.extern };
}

/**
 * The bridge script goes in before the last </body> (or at the end). Works on the bytes, so a page in
 * another encoding than UTF-8 stays as it is (the script is plain ASCII).
 */
export function mitBruecke(html: Buffer): Buffer {
  const tag = Buffer.from(`<script>${BRUECKE}</script>`, "latin1");
  const i = html.toString("latin1").toLowerCase().lastIndexOf("</body>");
  return i < 0 ? Buffer.concat([html, Buffer.from("\n"), tag]) : Buffer.concat([html.subarray(0, i), tag, html.subarray(i)]);
}

/** A page that names its own charset keeps it; otherwise UTF-8. */
const htmlTyp = (html: Buffer) => (/<meta[^>]+charset/i.test(html.subarray(0, 2048).toString("latin1")) ? "text/html" : "text/html; charset=utf-8");

/**
 * A deck's file for the deck route: only by a valid token and only a path listed in `dateien`, so nothing
 * outside the deck's folder is ever read. HTML gets the bridge script.
 */
export function deckDatei(token: string, teile: string[]): { daten: Buffer; typ: string } | null {
  if (!TOKEN.test(token)) return null;
  const p = getPraesentationNachToken(token);
  if (!p) return null;
  const pfad = teile.join("/");
  if (!p.dateien.some((d) => d.pfad === pfad)) return null;
  const typ = typVon(pfad);
  if (!typ) return null;
  let daten: Buffer;
  try {
    daten = fs.readFileSync(/*turbopackIgnore: true*/ ziel(path.join(praesentationsOrdner(), token), pfad));
  } catch {
    return null;
  }
  if (istHtml(pfad)) return { daten: mitBruecke(daten), typ: htmlTyp(daten) };
  return { daten, typ };
}

/** Are the deck's files on this server (they may be missing after a restore of only the database)? */
export function dateienDa(p: Pick<Praesentation, "token" | "start_pfad">): boolean {
  try {
    return fs.statSync(/*turbopackIgnore: true*/ ziel(path.join(praesentationsOrdner(), p.token), p.start_pfad)).isFile();
  } catch {
    return false;
  }
}

// ---------- reading ----------

type Row = Omit<Praesentation, "skill_ids" | "dateien" | "extern" | "notizen"> & { skill_ids: string; dateien: string; extern: string; notizen: string };
const toPraes = (r: Row): Praesentation => ({
  ...r,
  skill_ids: json<string[]>(r.skill_ids, []),
  dateien: json<{ pfad: string; groesse: number }[]>(r.dateien, []),
  extern: json<string[]>(r.extern, []),
  notizen: json<Record<number, string>>(r.notizen, {}),
});

export function getPraesentation(id: number): Praesentation | null {
  const r = db().prepare("SELECT * FROM praesentationen WHERE id = ?").get(id) as Row | undefined;
  return r ? toPraes(r) : null;
}

export function getPraesentationNachToken(token: string): Praesentation | null {
  const r = db().prepare("SELECT * FROM praesentationen WHERE token = ?").get(token) as Row | undefined;
  return r ? toPraes(r) : null;
}

export type PraesFilter = { fach?: string; schulart?: string; klasse?: number | null; thema?: string; skillId?: string; schwierigkeit?: string; status?: PraesStatus; q?: string };

/** Presentations matching the filter, the most recently changed first; without a status the active ones. */
export function listPraesentationen(f: PraesFilter = {}): Praesentation[] {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, ...p: unknown[]) => (where.push(sql), params.push(...p));
  add("p.status = ?", f.status && Object.hasOwn(PRAES_STATUS, f.status) ? f.status : "aktiv");
  if (f.fach) add("p.fach = ?", f.fach);
  if (f.schulart) add("p.schulart = ?", f.schulart);
  if (f.klasse) add("p.klasse = ?", f.klasse);
  if (f.thema) add("p.thema = ?", f.thema);
  if (f.schwierigkeit) add("p.schwierigkeit = ?", f.schwierigkeit);
  if (f.skillId)
    add("EXISTS (SELECT 1 FROM json_each(p.skill_ids) j LEFT JOIN skills k ON k.id = j.value WHERE j.value = ? OR k.parent_id = ?)", f.skillId, f.skillId);
  if (f.q?.trim()) {
    const like = `%${f.q.trim()}%`;
    add("(p.title LIKE ? OR p.thema LIKE ? OR p.beschreibung LIKE ?)", like, like, like);
  }
  return (db().prepare(`SELECT p.* FROM praesentationen p WHERE ${where.join(" AND ")} ORDER BY p.updated_at DESC, p.id DESC`).all(...params) as Row[]).map(toPraes);
}

/** What the filters can offer: only values that occur. */
export function praesentationFacetten() {
  const alle = (db().prepare("SELECT * FROM praesentationen").all() as Row[]).map(toPraes);
  const uniq = <T,>(xs: T[]) => [...new Set(xs)];
  return {
    gesamt: alle.length,
    faecher: uniq(alle.map((p) => p.fach)).sort((a, b) => a.localeCompare(b, "de")),
    stufen: uniq(alle.filter((p) => p.schulart).map((p) => `${p.schulart}|${p.klasse ?? ""}`)),
    themen: uniq(alle.map((p) => p.thema).filter(Boolean)).sort((a, b) => a.localeCompare(b, "de")),
    skills: uniq(alle.flatMap((p) => p.skill_ids)),
    schwierigkeiten: uniq(alle.map((p) => p.schwierigkeit)),
    status: { aktiv: alle.filter((p) => p.status === "aktiv").length, archiviert: alle.filter((p) => p.status === "archiviert").length },
  };
}

// ---------- writing ----------

export function updatePraesentation(id: number, m: PraesMeta): { ok: true } | { fehler: string[] } {
  if (!getPraesentation(id)) return { fehler: ["Diese Präsentation gibt es nicht."] };
  const out = pruefeMeta({ ...m, dauer_minuten: 1, ziel: m.beschreibung }, { ziel: "beschreibung" });
  if ("fehler" in out) return { fehler: out.fehler.map(praesWort) };
  const w = out.wert;
  db()
    .prepare("UPDATE praesentationen SET title = ?, fach = ?, schulart = ?, klasse = ?, schulstufe = ?, thema = ?, skill_ids = ?, schwierigkeit = ?, beschreibung = ?, updated_at = datetime('now') WHERE id = ?")
    .run(w.title, w.fach, w.schulart, w.klasse, w.schulart && w.klasse ? schulstufe(w.schulart, w.klasse) : null, w.thema, JSON.stringify(w.skill_ids), w.schwierigkeit, w.ziel, id);
  return { ok: true };
}

/** The Vortragstext of one slide; an empty text removes it. */
export function setzeNotiz(id: number, folie: number, text: string): { ok: true } | { fehler: string } {
  const p = getPraesentation(id);
  if (!p) return { fehler: "Diese Präsentation gibt es nicht." };
  if (!Number.isInteger(folie) || folie < 1 || folie > MAX_FOLIE) return { fehler: `Folie: eine Nummer von 1 bis ${MAX_FOLIE}.` };
  const t = text.replace(/\r\n/g, "\n").trim();
  if (t.length > NOTIZ_MAX) return { fehler: `Der Vortragstext ist zu lang (höchstens ${NOTIZ_MAX} Zeichen).` };
  const notizen = { ...p.notizen };
  if (t) notizen[folie] = t;
  else delete notizen[folie];
  db().prepare("UPDATE praesentationen SET notizen = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(notizen), id);
  return { ok: true };
}

/** A notes file uploaded on its own: its slides replace the ones there, the others stay. */
export function importiereNotizen(id: number, roh: string): { ok: true; anzahl: number } | { fehler: string[] } {
  const p = getPraesentation(id);
  if (!p) return { fehler: ["Diese Präsentation gibt es nicht."] };
  const n = leseNotizen(roh);
  if (!n.ok) return { fehler: n.fehler };
  db().prepare("UPDATE praesentationen SET notizen = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify({ ...p.notizen, ...n.notizen }), id);
  return { ok: true, anzahl: Object.keys(n.notizen).length };
}

export function archivierePraesentation(id: number): boolean {
  return db().prepare("UPDATE praesentationen SET status = 'archiviert', updated_at = datetime('now') WHERE id = ? AND status <> 'archiviert'").run(id).changes > 0;
}

export function stellePraesentationWiederHer(id: number): boolean {
  return db().prepare("UPDATE praesentationen SET status = 'aktiv', updated_at = datetime('now') WHERE id = ? AND status = 'archiviert'").run(id).changes > 0;
}

// ---------- Lernpakete ----------

/** Links a Lernpaket to a presentation (null removes the link). */
export function verknuepfeLernpaket(paketId: number, praesId: number | null): { ok: true } | { fehler: string } {
  if (praesId !== null && !getPraesentation(praesId)) return { fehler: "Diese Präsentation gibt es nicht." };
  const n = db().prepare("UPDATE lernpakete SET praesentation_id = ?, updated_at = datetime('now') WHERE id = ?").run(praesId, paketId).changes;
  return n ? { ok: true } : { fehler: "Dieses Lernpaket gibt es nicht." };
}

/** Lernpakete that use this presentation (not archived ones). */
export function lernpaketeMit(praesId: number): { id: number; title: string }[] {
  return db().prepare("SELECT id, title FROM lernpakete WHERE praesentation_id = ? AND status <> 'archiviert' ORDER BY title").all(praesId) as { id: number; title: string }[];
}

export type SchrittZurFolie = { folie: number; paketId: number; paket: string; schritt: string; lehrer_sagt: string; lehrer_fragt: string };

/** For the notes panel: the steps of linked Lernpakete that show a slide, with what the teacher says and asks there. */
export function schritteZuFolien(praesId: number): SchrittZurFolie[] {
  return db()
    .prepare(
      `SELECT s.folie, p.id AS paketId, p.title AS paket, s.titel AS schritt, s.lehrer_sagt, s.lehrer_fragt
       FROM lernpaket_schritte s JOIN lernpakete p ON p.id = s.paket_id
       WHERE p.praesentation_id = ? AND p.status <> 'archiviert' AND s.folie IS NOT NULL AND (s.lehrer_sagt <> '' OR s.lehrer_fragt <> '')
       ORDER BY p.title, s.position`,
    )
    .all(praesId) as SchrittZurFolie[];
}

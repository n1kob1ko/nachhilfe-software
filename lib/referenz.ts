/**
 * Referenzsammlung (Plan 4.3, Entscheidung des Inhabers 23.10.2026). Mathematik: Aufgaben mit Quelle, Grundkompetenz, Format und
 * Lösungserwartung, nur für Lehrer. Sprachen: nur Aufbau, Format und Bewertungsraster, keine fremden Texte.
 *
 * 1. **Lesen** (`liesReferenz`): der Lehrer lädt ein PDF, das er von Hand heruntergeladen hat (z. B. von
 *    aufgabenpool.at). Die KI liest es einmal (`leseReferenzAufgaben`, Funktion `referenz` im Router); die Datei wird
 *    nicht gespeichert. Jede Aufgabe wird ein Eintrag „Ungeprüft“. Die Quelle gibt der Lehrer an; die Kennung kommt
 *    nur von der Seite oder aus dem Dateinamen, nie erfunden. Ohne KI legt der Lehrer Einträge von Hand an.
 * 2. **Prüfen** (`speichereEintrag`): erst was ein Lehrer gespeichert hat, ist geprüft und geht als Vorbild an die KI.
 * 3. **Dritte**: ein Eintrag mit Texten oder Bildern Dritter bleibt Referenz für Aufbau und Format. Die KI schreibt
 *    solche Texte nicht ab, sondern beschreibt sie in eckigen Klammern; was der Lehrer davon behält, entscheidet er.
 * 4. **In die Bibliothek** (`inBibliothek`): ein geprüfter Mathematik-Eintrag ohne Material Dritter aus einer freien
 *    Quelle (lib/referenz-regeln.ts FREIE_QUELLEN) wird eine offene Aufgabe der Bibliothek, geprüft wie eine
 *    importierte (pruefeDateiAufgabe). Die Quelle bleibt an der Aufgabe (`tasks.quelle`) und steht auf dem Blatt und
 *    beim Schüler als „Quelle: …“.
 * 5. **Vorbilder** (`referenzVorbilder`): schreibt die KI neue Aufgaben zu einer Fähigkeit (Übungs-Builder,
 *    „Lernpaket mit KI“), bekommt sie bis zu drei geprüfte Einträge derselben Fähigkeit oder desselben Formats als
 *    Beispiele mit.
 *
 * Kein automatisches Herunterladen von irgendeiner Seite.
 */
import { aiEnabled, aiReadsImages, leseReferenzAufgaben, type ReferenzGelesen } from "./ai";
import { categoriesFor } from "./curriculum";
import { db, json } from "./db";
import { getSource, saveSource } from "./lehrplan";
import { pruefeDateiAufgabe } from "./lernpakete";
import { createLibraryTask, titleFromPrompt } from "./library";
import { MAX_ANALYSIS_IMAGE_BYTES, MAX_ANALYSIS_PDF_BYTES, sniffType } from "./materials";
import * as repo from "./repo";
import {
  freieQuelle,
  kennungAusDatei,
  MAX_VORBILDER,
  nurAufbau,
  quelleMitKennung,
  REFERENZ_FAECHER,
  REFERENZ_GRENZEN as G,
  type ReferenzStatus,
  type Vorbild,
} from "./referenz-regeln";

export * from "./referenz-regeln";

export type ReferenzEintrag = {
  id: number;
  fach: string;
  skill_id: string | null;
  grundkompetenz: string;
  format: string;
  aufgabe: string;
  loesung: string;
  quelle: string;
  dritte: boolean;
  status: ReferenzStatus;
  /** was beim Lesen auffiel (nur bis zum Prüfen) */
  hinweise: string[];
  /** der Name der Datei, aus der der Eintrag gelesen wurde ("" = von Hand) */
  datei: string;
  worksheet_id: number | null;
  teacher_id: number | null;
  geprueft_von: number | null;
  geprueft_von_name: string | null;
  geprueft_am: string | null;
  created_at: string;
};

type Row = Omit<ReferenzEintrag, "dritte" | "hinweise"> & { dritte: number; hinweise: string };
const SELECT = "SELECT r.*, t.name AS geprueft_von_name FROM referenz_eintraege r LEFT JOIN teachers t ON t.id = r.geprueft_von";
const toEintrag = (r: Row): ReferenzEintrag => ({ ...r, dritte: Boolean(r.dritte), hinweise: json<string[]>(r.hinweise, []) });

const eineZeile = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
/** Mehrzeiliger Text: Zeilen bleiben, Leerraum am Rand und mehr als eine Leerzeile nicht. */
const absatz = (s: unknown, max: number) =>
  String(s ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((z) => z.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);

const istFach = (fach: string): fach is (typeof REFERENZ_FAECHER)[number] => (REFERENZ_FAECHER as readonly string[]).includes(fach);

/** Die Aufgabentypen eines Fachs, aus denen ein Eintrag wählt (ohne „Auswendig schreiben“). */
export function formateFuer(fach: string): { key: string; label: string; offen: boolean }[] {
  return categoriesFor(fach)
    .filter((c) => !c.formats.includes("memorize"))
    .map((c) => ({ key: c.key, label: c.label, offen: c.formats.includes("free") }));
}

/** Die Fähigkeiten eines Fachs, aus denen ein Eintrag wählt. */
export function faehigkeitenFuer(fach: string): { id: string; name: string; area: string }[] {
  return repo
    .listSkills()
    .filter((s) => s.subject === fach)
    .map((s) => ({ id: s.id, name: s.name, area: s.area }));
}

/** Ob eine Datei jetzt gelesen werden kann; sonst der Grund, in Worten für den Lehrer. */
export function referenzLesbar(): { ok: true } | { ok: false; grund: string } {
  if (!aiEnabled("referenz")) return { ok: false, grund: "Lesen kann nur die KI, und die ist gerade nicht eingerichtet. Leg die Einträge von Hand an." };
  if (!aiReadsImages("referenz")) return { ok: false, grund: "Im eingestellten KI-Modus kann die KI keine Dateien lesen. Leg die Einträge von Hand an." };
  return { ok: true };
}

// ---------- Lesen ----------

export type ReferenzEntwurf = Pick<ReferenzEintrag, "fach" | "skill_id" | "grundkompetenz" | "format" | "aufgabe" | "loesung" | "quelle" | "dritte" | "hinweise">;

/**
 * Prüft, was die KI gelesen hat: nur Fähigkeiten und Aufgabentypen aus den Listen, die Kennung nur von der Seite oder
 * aus dem Dateinamen, die Quelle vom Lehrer. Was nicht passt, bleibt leer und steht als Hinweis am Eintrag.
 */
export function entwuerfeAusGelesen(
  g: ReferenzGelesen,
  o: { fach: string; quelle: string; dateiKennung: string; skills: Set<string>; formate: Set<string> },
): { entwuerfe: ReferenzEntwurf[]; hinweise: string[] } {
  const hinweise: string[] = [];
  const entwuerfe: ReferenzEntwurf[] = [];
  const sprache = nurAufbau(o.fach);
  for (const a of g.aufgaben.slice(0, G.eintraege)) {
    const aufgabe = absatz(a.aufgabe, G.aufgabe);
    if (!aufgabe) continue;
    const vonSeite = eineZeile(a.kennung, G.kennung);
    const eigene: string[] = [];
    const skill = a.faehigkeit && o.skills.has(a.faehigkeit) ? a.faehigkeit : null;
    const loesung = absatz(a.loesung, G.loesung);
    if (a.unsicher) eigene.push("Nicht alles war sicher lesbar.");
    if (!skill) eigene.push("Bitte die Fähigkeit wählen.");
    if (!loesung) eigene.push(sprache ? "In der Datei steht kein Bewertungsraster." : "In der Datei steht keine Lösungserwartung.");
    if (!vonSeite && o.dateiKennung) eigene.push("Die Kennung kommt aus dem Dateinamen.");
    if (a.dritte) eigene.push("Enthält Texte oder Bilder Dritter: bleibt Referenz.");
    entwuerfe.push({
      fach: o.fach,
      skill_id: skill,
      grundkompetenz: eineZeile(a.grundkompetenz, G.grundkompetenz),
      format: a.format && o.formate.has(a.format) ? a.format : "",
      aufgabe,
      loesung,
      quelle: quelleMitKennung(o.quelle, vonSeite || o.dateiKennung),
      dritte: Boolean(a.dritte),
      hinweise: eigene,
    });
  }
  if (g.aufgaben.length > G.eintraege) hinweise.push(`Nur die ersten ${G.eintraege} Aufgaben übernommen.`);
  for (const u of g.unsicher.slice(0, 4)) {
    const t = eineZeile(u, 140);
    if (t) hinweise.push(`Unsicher: ${t}`);
  }
  return { entwuerfe, hinweise };
}

function speichereEntwurf(e: ReferenzEntwurf, o: { datei: string; teacherId: number | null }): number {
  return Number(
    db()
      .prepare(
        `INSERT INTO referenz_eintraege (fach, skill_id, grundkompetenz, format, aufgabe, loesung, quelle, dritte, status, hinweise, datei, teacher_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ungeprueft', ?, ?, ?)`,
      )
      .run(e.fach, e.skill_id, e.grundkompetenz, e.format, e.aufgabe, e.loesung, e.quelle, e.dritte ? 1 : 0, JSON.stringify(e.hinweise.slice(0, G.hinweise)), o.datei, o.teacherId).lastInsertRowid,
  );
}

/**
 * Liest eine hochgeladene Datei (PDF oder Foto) mit der KI und legt jede Aufgabe als ungeprüften Eintrag an. Die Datei
 * wird nicht gespeichert. Wirft einen Fehler mit einem Satz für den Lehrer.
 */
export async function liesReferenz(o: { datei: { name: string; data: Buffer }; fach: string; quelle: string; teacherId: number | null }): Promise<{ ids: number[]; hinweise: string[] }> {
  if (!istFach(o.fach)) throw new Error("Bitte das Fach wählen.");
  const quelle = eineZeile(o.quelle, G.quelle);
  if (!quelle) throw new Error("Bitte die Quelle angeben, z. B. aufgabenpool.at.");
  const type = sniffType(o.datei.data);
  if (!type) throw new Error("Nur PDF-Dateien und Fotos (JPG, PNG, WebP) sind möglich.");
  const pdf = type.mime === "application/pdf";
  const max = pdf ? MAX_ANALYSIS_PDF_BYTES : MAX_ANALYSIS_IMAGE_BYTES;
  if (o.datei.data.length > max) throw new Error(`${pdf ? "Das PDF" : "Das Foto"} ist zu groß für die KI (höchstens ${max / 1024 / 1024} MB).`);
  const geht = referenzLesbar();
  if (!geht.ok) throw new Error(geht.grund);
  const formate = formateFuer(o.fach);
  const skills = faehigkeitenFuer(o.fach);
  const gelesen = await leseReferenzAufgaben(
    { mime: type.mime as "application/pdf" | "image/jpeg" | "image/png" | "image/webp", base64: o.datei.data.toString("base64") },
    { fach: o.fach, nurAufbau: nurAufbau(o.fach), formate, skills },
    { teacherId: o.teacherId, trigger: "referenz" },
  );
  if (!gelesen) throw new Error("Die KI hat die Datei nicht gelesen. Leg die Einträge bitte von Hand an.");
  const { entwuerfe, hinweise } = entwuerfeAusGelesen(gelesen, {
    fach: o.fach,
    quelle,
    dateiKennung: kennungAusDatei(o.datei.name),
    skills: new Set(skills.map((s) => s.id)),
    formate: new Set(formate.map((f) => f.key)),
  });
  if (!entwuerfe.length) throw new Error("In der Datei wurden keine Aufgaben gefunden.");
  const datei = eineZeile(o.datei.name.split(/[\\/]/).pop(), 120);
  const ids = db().transaction(() => entwuerfe.map((e) => speichereEntwurf(e, { datei, teacherId: o.teacherId })))();
  return { ids, hinweise };
}

/** Ein leerer Eintrag von Hand (ohne KI); er öffnet sich zum Ausfüllen und ist ungeprüft, bis er gespeichert ist. */
export function neuerEintrag(o: { fach: string; quelle: string; teacherId: number | null }): { id: number } | { fehler: string } {
  if (!istFach(o.fach)) return { fehler: "Bitte das Fach wählen." };
  const quelle = eineZeile(o.quelle, G.quelle);
  if (!quelle) return { fehler: "Bitte die Quelle angeben, z. B. aufgabenpool.at, 1_234." };
  const id = speichereEntwurf({ fach: o.fach, skill_id: null, grundkompetenz: "", format: "", aufgabe: "", loesung: "", quelle, dritte: false, hinweise: [] }, { datei: "", teacherId: o.teacherId });
  return { id };
}

// ---------- Lesen aus der Datenbank ----------

export function getEintrag(id: number): ReferenzEintrag | null {
  const r = db().prepare(`${SELECT} WHERE r.id = ?`).get(id) as Row | undefined;
  return r ? toEintrag(r) : null;
}

export function listeEintraege(f: { fach?: string; status?: ReferenzStatus } = {}): ReferenzEintrag[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.fach) where.push("r.fach = ?"), params.push(f.fach);
  if (f.status) where.push("r.status = ?"), params.push(f.status);
  return (db().prepare(`${SELECT}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY r.status = 'geprueft', r.id DESC`).all(...params) as Row[]).map(toEintrag);
}

// ---------- Prüfen ----------

export type ReferenzEingabe = { fach: string; skillId: string | null; grundkompetenz: string; format: string; aufgabe: string; loesung: string; quelle: string; dritte: boolean };

/** Prüft ein ausgefülltes Formular. Ohne Quelle wird nichts gespeichert. */
export function pruefeEingabe(e: ReferenzEingabe): { wert: ReferenzEingabe } | { fehler: string[] } {
  const fehler: string[] = [];
  if (!istFach(e.fach)) fehler.push("Bitte das Fach wählen.");
  const quelle = eineZeile(e.quelle, G.quelle + 1);
  if (!quelle) fehler.push("Bitte die Quelle angeben (z. B. aufgabenpool.at, 1_234). Ohne Quelle wird nichts gespeichert.");
  if (quelle.length > G.quelle) fehler.push(`Die Quelle ist zu lang (höchstens ${G.quelle} Zeichen).`);
  const aufgabe = absatz(e.aufgabe, G.aufgabe + 1);
  if (!aufgabe) fehler.push(nurAufbau(e.fach) ? "Bitte den Aufbau beschreiben." : "Bitte den Aufgabentext eintragen.");
  if (aufgabe.length > G.aufgabe) fehler.push(`Der Text ist zu lang (höchstens ${G.aufgabe} Zeichen).`);
  const loesung = absatz(e.loesung, G.loesung + 1);
  if (loesung.length > G.loesung) fehler.push(`Die Lösungserwartung ist zu lang (höchstens ${G.loesung} Zeichen).`);
  const skillId = e.skillId?.trim() || null;
  if (skillId) {
    const s = repo.getSkill(skillId);
    if (!s) fehler.push("Diese Fähigkeit gibt es nicht.");
    else if (s.subject !== e.fach) fehler.push(`Die Fähigkeit gehört zu ${s.subject}, der Eintrag ist ${e.fach}.`);
  }
  const format = e.format.trim();
  if (format && !formateFuer(e.fach).some((f) => f.key === format)) fehler.push("Unbekannter Aufgabentyp.");
  if (fehler.length) return { fehler };
  return { wert: { fach: e.fach, skillId, grundkompetenz: eineZeile(e.grundkompetenz, G.grundkompetenz), format, aufgabe, loesung, quelle, dritte: Boolean(e.dritte) } };
}

/** Speichert die Angaben des Lehrers; damit ist der Eintrag geprüft. Eine Bibliotheksaufgabe daraus bleibt, wie sie ist. */
export function speichereEintrag(id: number, e: ReferenzEingabe, teacherId: number | null): { ok: true } | { fehler: string[] } {
  if (!getEintrag(id)) return { fehler: ["Diesen Eintrag gibt es nicht mehr."] };
  const p = pruefeEingabe(e);
  if ("fehler" in p) return p;
  const w = p.wert;
  db()
    .prepare(
      `UPDATE referenz_eintraege SET fach = ?, skill_id = ?, grundkompetenz = ?, format = ?, aufgabe = ?, loesung = ?, quelle = ?, dritte = ?,
         status = 'geprueft', hinweise = '[]', geprueft_von = ?, geprueft_am = datetime('now') WHERE id = ?`,
    )
    .run(w.fach, w.skillId, w.grundkompetenz, w.format, w.aufgabe, w.loesung, w.quelle, w.dritte ? 1 : 0, teacherId, id);
  return { ok: true };
}

export function loescheEintrag(id: number): boolean {
  return db().prepare("DELETE FROM referenz_eintraege WHERE id = ?").run(id).changes > 0;
}

// ---------- In die Bibliothek ----------

/** Warum ein Eintrag (noch) nicht in die Bibliothek kann; null, wenn er kann. */
export function uebernahmeGrund(e: Pick<ReferenzEintrag, "status" | "dritte" | "fach" | "quelle" | "skill_id" | "loesung" | "aufgabe">): string | null {
  if (nurAufbau(e.fach)) return "In Sprachen bleibt ein Eintrag Referenz: nur Aufbau, Format und Bewertungsraster.";
  if (e.dritte) return "Enthält Texte oder Bilder Dritter: bleibt Referenz für Aufbau und Format.";
  if (!freieQuelle(e.quelle)) return "In die Bibliothek dürfen nur Aufgaben von aufgabenpool.at. Andere Quellen bleiben Referenz.";
  if (e.status !== "geprueft") return "Erst prüfen und speichern.";
  if (!e.aufgabe.trim()) return "Der Aufgabentext fehlt.";
  if (!e.skill_id) return "Bitte eine Fähigkeit wählen und speichern.";
  if (!e.loesung.trim()) return "Bitte die Lösungserwartung eintragen und speichern.";
  return null;
}

/** Die Quelle als content_source (für Herkunft und Lizenz in der Bibliothek), beim ersten Mal angelegt. */
function quelleId(key: string): number {
  const q = freieQuelle(key)!;
  return (
    getSource(q.key)?.id ??
    saveSource({ key: q.key, name: q.name, source_type: "lizenz", url: q.url, publisher: q.name, license: q.license, attribution_text: q.name, commercial_use_allowed: 1, derivatives_allowed: 1, copy_allowed: 1, notes: q.notes })
  );
}

/**
 * Macht aus einem geprüften Eintrag eine offene Aufgabe der Bibliothek (Antwortformat im Editor änderbar), geprüft wie
 * eine importierte Aufgabe. Die Quelle bleibt an der Aufgabe. Ein zweites Mal gibt die schon vorhandene zurück.
 */
export function inBibliothek(id: number, teacherId: number | null): { libraryId: number; vorhanden: boolean } | { fehler: string } {
  const e = getEintrag(id);
  if (!e) return { fehler: "Diesen Eintrag gibt es nicht mehr." };
  if (e.worksheet_id && repo.getWorksheet(e.worksheet_id)) return { libraryId: e.worksheet_id, vorhanden: true };
  const grund = uebernahmeGrund(e);
  if (grund) return { fehler: grund };
  const skill = repo.getSkill(e.skill_id!);
  if (!skill) return { fehler: "Diese Fähigkeit gibt es nicht mehr." };
  const typ = formateFuer(e.fach).find((f) => f.key === e.format && f.offen);
  const zeilen = Math.min(12, Math.max(3, Math.ceil(e.loesung.length / 80)));
  const geprueft = pruefeDateiAufgabe(
    { type: "free", skillId: skill.id, category: typ?.key ?? null, difficulty: "mittel", prompt: e.aufgabe, data: { lines: zeilen }, answer: { sample: e.loesung, criteria: [] }, solution: e.loesung, hints: [], errorMap: [] },
    { skillIds: [skill.id], schwierigkeit: "mittel", fach: e.fach },
  );
  if ("fehler" in geprueft) return { fehler: `Die Aufgabe hat die Prüfung nicht bestanden: ${geprueft.fehler}` };
  const libraryId = db().transaction(() => {
    const neu = createLibraryTask(
      { subject: e.fach, schoolType: "", klasse: null, topic: skill.area, tags: ["Referenz", ...(e.grundkompetenz ? [e.grundkompetenz] : [])], title: titleFromPrompt(e.aufgabe), teacherId },
      { ...geprueft.aufgabe, sourceType: "lizenz", sourceId: quelleId(e.quelle), quelle: e.quelle },
    );
    db().prepare("UPDATE referenz_eintraege SET worksheet_id = ? WHERE id = ?").run(neu, id);
    return neu;
  })();
  return { libraryId, vorhanden: false };
}

// ---------- Vorbilder für die KI ----------

/**
 * Bis zu drei geprüfte Einträge als Vorbilder: zuerst derselben Fähigkeit (auch ihrer Oberfähigkeit), dabei das
 * gewünschte Format vorn; reicht das nicht für zwei, dazu Einträge desselben Formats im Fach. Leer, wenn es keine gibt.
 */
export function referenzVorbilder(o: { fach: string; skillIds: string[]; formate?: string[] }): Vorbild[] {
  if (!istFach(o.fach) || !o.skillIds.length) return [];
  const ids = new Set(o.skillIds);
  for (const id of o.skillIds) {
    const parent = repo.getSkill(id)?.parent_id;
    if (parent) ids.add(parent);
  }
  const formate = new Set((o.formate ?? []).filter(Boolean));
  const rows = (db().prepare(`${SELECT} WHERE r.status = 'geprueft' AND r.fach = ? AND r.aufgabe != '' ORDER BY r.id DESC LIMIT 400`).all(o.fach) as Row[]).map(toEintrag);
  const passend = rows.filter((r) => r.skill_id && ids.has(r.skill_id)).sort((a, b) => Number(formate.has(b.format)) - Number(formate.has(a.format)));
  const gewaehlt = passend.slice(0, MAX_VORBILDER);
  if (gewaehlt.length < 2 && formate.size) gewaehlt.push(...rows.filter((r) => formate.has(r.format) && !gewaehlt.includes(r)).slice(0, MAX_VORBILDER - gewaehlt.length));
  const formatName = new Map(formateFuer(o.fach).map((f) => [f.key, f.label]));
  return gewaehlt.map((r) => {
    const s = r.skill_id ? repo.getSkill(r.skill_id) : null;
    return {
      faehigkeit: s ? `${s.area} › ${s.name}` : "",
      format: formatName.get(r.format) ?? "",
      grundkompetenz: r.grundkompetenz,
      aufgabe: r.aufgabe,
      loesung: r.loesung,
      nurAufbau: nurAufbau(r.fach),
    };
  });
}

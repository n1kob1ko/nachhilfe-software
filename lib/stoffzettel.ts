/**
 * Stoffzettel (niko, 19.10.2026): „wenn ich jetzt einen schularbeitsstoff erhalte von einem schüler wie kann ich
 * das hochladen damit es eingetragen ist für den schüler“. Der Lehrer fotografiert den Zettel mit dem Stoff einer
 * Schularbeit (oder wählt das PDF), am Profil unter Prüfungen. Die Datei bleibt als Material des Schülers und hängt
 * an der Schularbeit; die KI liest auf Klick Art, Fach, Termin, Bezeichnung und Stoff ab und füllt damit das
 * Formular vor. Gespeichert wird erst, wenn der Lehrer auf „Eintragen“ tippt.
 *
 * - Der Zettel geht nur nach der Bestätigung „kein Name darauf“ an die KI. Kein Name aus der App geht mit, nur das
 *   heutige Datum und die Fächer des Schülers (für die Schreibweise).
 * - Was die KI liest, wird hier geprüft: nur bekannte Arten und Fächer, ein Termin nur, wenn er echt ist und
 *   nicht weit weg liegt. Was nicht passt, bleibt leer und steht als Hinweis da (lieber leer als falsch).
 * - Ohne KI wird der Zettel nur angehängt; Fach, Termin und Stoff tippt der Lehrer wie bisher.
 * - Der Lernstand ändert sich dadurch nicht.
 */
import fs from "node:fs";
import { aiEnabled, aiReadsImages, leseStoffzettel, type StoffzettelGelesen } from "./ai";
import { db } from "./db";
import { daysUntil } from "./exams";
import { fachNamen } from "./faecher";
import { getMaterial, hatDatei, materialFile, MAX_ANALYSIS_IMAGE_BYTES, MAX_ANALYSIS_PDF_BYTES, sniffType } from "./materials";
import { PRUEFUNGSARTEN } from "./pruefungsarten";
import * as repo from "./repo";
import { fachAus, fachVorschlaege } from "./school";

/** Titel eines frisch hochgeladenen Zettels; beim Eintragen bekommt er den Namen der Schularbeit. */
export const STOFFZETTEL_TITEL = "Stoffzettel";
const THEMEN = 12;

export type Pruefungsart = (typeof PRUEFUNGSARTEN)[number];
/** Was das Formular vorfüllt. Leere Felder hat die KI nicht (sicher) gefunden; `hinweise` sagt, was zu prüfen ist. */
export type StoffzettelVorschlag = { art: Pruefungsart | null; fach: string | null; datum: string | null; titel: string; themen: string[]; hinweise: string[] };

/** Ob ein Zettel jetzt gelesen werden kann; sonst der Grund, in Worten für den Lehrer. */
export function stoffzettelLesbar(): { ok: true } | { ok: false; grund: string } {
  if (!aiEnabled("stoffzettel")) return { ok: false, grund: "Lesen kann nur die KI, und die ist gerade nicht eingerichtet. Trag Fach, Datum und Stoff selbst ein." };
  if (!aiReadsImages("stoffzettel")) return { ok: false, grund: "Im eingestellten KI-Modus kann die KI keine Fotos lesen. Trag Fach, Datum und Stoff selbst ein." };
  return { ok: true };
}

const eineZeile = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);

/** Kurzformen von Fächern, wie sie auf Zetteln stehen („M-SA“, „Bio“). */
const KURZ: Record<string, string> = {
  m: "Mathematik", mathe: "Mathematik", d: "Deutsch", e: "Englisch", engl: "Englisch", f: "Französisch", franz: "Französisch",
  l: "Latein", sp: "Spanisch", it: "Italienisch", bio: "Biologie", bu: "Biologie", ch: "Chemie", ph: "Physik", geo: "Geographie",
  gw: "Geographie", gwk: "Geographie", geografie: "Geographie", gsk: "Geschichte", gs: "Geschichte", gsp: "Geschichte", inf: "Informatik", rw: "Rechnungswesen", bw: "Betriebswirtschaft", bwl: "Betriebswirtschaft",
};

/** Ein gelesenes Fach in der Schreibweise der App, oder null, wenn es kein bekanntes Fach ist. */
export function fachVomZettel(roh: string | null, eigene: string[]): string | null {
  const v = eineZeile(roh ?? "", 60);
  if (!v) return null;
  const bekannt = fachVorschlaege(eigene);
  const fach = fachAus(KURZ[v.toLowerCase().replace(/[.:]$/, "")] ?? v, eigene);
  return bekannt.includes(fach) ? fach : null;
}

/** Die gelesene Art als eine der Arten im Formular („2. Schularbeit“ → Schularbeit), sonst null. */
export function artVomZettel(roh: string | null): Pruefungsart | null {
  const v = (roh ?? "").toLowerCase();
  if (!v.trim()) return null;
  const genau = PRUEFUNGSARTEN.find((a) => a.toLowerCase() === v.trim());
  if (genau) return genau;
  if (/schularbeit|\bsa\b/.test(v)) return "Schularbeit";
  if (/vokabel/.test(v)) return "Vokabeltest";
  if (/mündlich|muendlich/.test(v)) return "Mündliche Prüfung";
  if (/referat|präsentation/.test(v)) return "Referat";
  if (/test/.test(v)) return "Test";
  return null;
}

const echtesDatum = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;

/**
 * Prüft, was die KI gelesen hat, und macht daraus den Vorschlag fürs Formular. Ein Termin zählt nur, wenn es den
 * Tag gibt und er höchstens 30 Tage zurück und höchstens ein Jahr voraus liegt.
 */
export function vorschlagAusGelesen(g: StoffzettelGelesen, o: { heute: string; faecher: string[] }): StoffzettelVorschlag {
  const hinweise: string[] = [];
  const art = artVomZettel(g.art);

  const fach = fachVomZettel(g.fach, o.faecher);
  if (!fach) hinweise.push(g.fach?.trim() ? `Fach „${eineZeile(g.fach, 40)}“ nicht erkannt. Bitte wählen.` : "Kein Fach gefunden. Bitte wählen.");

  let datum: string | null = null;
  const roh = (g.datum ?? "").trim();
  if (!roh) hinweise.push("Kein Datum gefunden. Bitte eintragen.");
  else if (!echtesDatum(roh)) hinweise.push(`Das Datum „${eineZeile(roh, 20)}“ gibt es nicht. Bitte eintragen.`);
  else {
    const tage = daysUntil(roh, o.heute);
    if (tage < -30 || tage > 366) hinweise.push("Das Datum auf dem Zettel liegt weit weg. Bitte eintragen.");
    else {
      datum = roh;
      if (tage < 0) hinweise.push("Das Datum liegt in der Vergangenheit. Bitte prüfen.");
    }
  }

  const gesehen = new Set<string>();
  const themen: string[] = [];
  // ein Komma trennt im Feld „Stoff“ die Themen: „Kürzen, Erweitern“ sind zwei
  for (const t of g.themen.flatMap((x) => x.split(/[,;\n]+/))) {
    const thema = eineZeile(t.replace(/^\s*(?:[-•*·]\s*|\d{1,2}[.)]\s+)/, ""), 80);
    const key = thema.toLowerCase();
    if (!thema || gesehen.has(key)) continue;
    gesehen.add(key);
    themen.push(thema);
  }
  if (themen.length > THEMEN) hinweise.push(`Nur die ersten ${THEMEN} Themen übernommen.`);
  if (!themen.length) hinweise.push("Keinen Stoff gefunden. Bitte eintragen.");

  for (const u of g.unsicher.slice(0, 4)) {
    const text = eineZeile(u, 140);
    if (text) hinweise.push(`Unsicher: ${text}`);
  }
  return { art, fach, datum, titel: eineZeile(g.titel ?? "", 120), themen: themen.slice(0, THEMEN), hinweise };
}

/**
 * Liest einen gespeicherten Zettel (Material) mit der KI. Wirft einen Fehler mit einem Satz für den Lehrer; der
 * Zettel bleibt dann gespeichert und angehängt.
 */
export async function liesStoffzettel(o: { materialId: number; studentId: number; teacherId: number | null; heute: string }): Promise<StoffzettelVorschlag> {
  const geht = stoffzettelLesbar();
  if (!geht.ok) throw new Error(geht.grund);
  const m = getMaterial(o.materialId);
  if (!m || !hatDatei(m)) throw new Error("Den Zettel gibt es nicht mehr. Bitte noch einmal hochladen.");
  let data: Buffer;
  try {
    data = fs.readFileSync(materialFile(m));
  } catch {
    throw new Error("Die Datei des Zettels fehlt. Bitte noch einmal hochladen.");
  }
  const type = sniffType(data);
  if (!type) throw new Error("Nur Fotos (JPG, PNG, WebP) und PDF-Dateien sind möglich.");
  const pdf = type.mime === "application/pdf";
  const max = pdf ? MAX_ANALYSIS_PDF_BYTES : MAX_ANALYSIS_IMAGE_BYTES;
  if (data.length > max) throw new Error(`${pdf ? "Das PDF" : "Das Foto"} ist zu groß für die KI (höchstens ${max / 1024 / 1024} MB).`);
  const faecher = repo.getStudent(o.studentId)?.subjects ?? [];
  const gelesen = await leseStoffzettel(
    { mime: type.mime as "application/pdf" | "image/jpeg" | "image/png" | "image/webp", base64: data.toString("base64") },
    { heute: o.heute, faecher },
    { teacherId: o.teacherId, studentId: o.studentId, trigger: "stoffzettel" },
  );
  if (!gelesen) throw new Error("Die KI hat den Zettel nicht gelesen. Trag Fach, Datum und Stoff bitte selbst ein.");
  // ein gelesenes Fach zählt, wenn es beim Schüler oder in der Fächerliste steht (Mehr › Fächer)
  return vorschlagAusGelesen(gelesen, { heute: o.heute, faecher: [...faecher, ...fachNamen()] });
}

/**
 * Der Zettel einer eingetragenen Schularbeit, wenn es ihn (als Datei) gibt. Ein Zettel, der noch „Stoffzettel“
 * heißt und zu diesem Schüler gehört, bekommt dabei Name, Fach und Stoff der Schularbeit, damit er unter Material
 * zu finden ist.
 */
export function stoffzettelFuer(materialId: number, t: { student_id: number; title: string; kind: string; subject: string; topics: string[] }): number | null {
  const m = materialId ? getMaterial(materialId) : null;
  if (!m || !hatDatei(m)) return null;
  if (m.title === STOFFZETTEL_TITEL && m.student_id === t.student_id) {
    db()
      .prepare("UPDATE materials SET title = ?, subject = ?, topic = ? WHERE id = ?")
      .run(`Stoffzettel ${t.title || `${t.kind} ${t.subject}`}`.slice(0, 120), t.subject, t.topics.join(", ").slice(0, 160), m.id);
  }
  return m.id;
}

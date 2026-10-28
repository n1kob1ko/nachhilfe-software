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
import { aiEnabled, aiReadsImages, type StoffzettelGelesen } from "./ai";
import { db } from "./db";
import { daysUntil } from "./exams";
import { fachNamen } from "./faecher";
import { getMaterial, hatDatei } from "./materials";
import { fuerPruefung, liesPruefungsstoff, MAX_THEMEN, ordneZu, type Lesung } from "./pruefungsstoff";
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
export function vorschlagAusGelesen(g: StoffzettelGelesen, o: { heute: string; faecher: string[]; maxThemen?: number }): StoffzettelVorschlag {
  const max = o.maxThemen ?? THEMEN;
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
  if (themen.length > max) hinweise.push(`Nur die ersten ${max} Themen übernommen.`);
  if (!themen.length) hinweise.push("Keinen Stoff gefunden. Bitte eintragen.");

  for (const u of g.unsicher.slice(0, 4)) {
    const text = eineZeile(u, 140);
    if (text) hinweise.push(`Unsicher: ${text}`);
  }
  return { art, fach, datum, titel: eineZeile(g.titel ?? "", 120), themen: themen.slice(0, max), hinweise };
}

/** Was „Lesen und ausfüllen“ außer dem Formular zurückgibt: die Lesung und wie viele Punkte wie zugeordnet sind. */
export type Erkannt = { lesung: number; neu: boolean; punkte: number; sicher: number; unklar: number; keine: number; ausgeschlossen: number; offen: number; dokumente: string[] };

/** Zahlen für die Zeile „Erkannt: …“ im Formular, mit Fach und Stufe des Schülers zugeordnet (ohne KI-Anfrage). */
export function erkanntAus(l: Lesung, o: { lesungId: number; neu: boolean; fach: string; student: Pick<repo.Student, "school_type" | "klasse" | "grade"> }): Erkannt {
  const p = ordneZu(fuerPruefung(l.punkte), { fach: o.fach, student: o.student, ki: true });
  const n = (f: (x: (typeof p)[number]) => boolean) => p.filter(f).length;
  const ROLLE = { stoffzettel: "Stoffzettel", inhaltsverzeichnis: "Inhaltsverzeichnis", erklaerung: "Erklärung", aufgaben: "Blatt mit Aufgaben", sonstiges: "weiteres Blatt" } as const;
  return {
    lesung: o.lesungId,
    neu: o.neu,
    punkte: p.length,
    sicher: n((x) => x.status === "pruefung" && x.zuordnung === "sicher"),
    unklar: n((x) => x.status !== "ausgeschlossen" && x.zuordnung === "unklar"),
    keine: n((x) => x.status === "pruefung" && x.gruppe !== "umfang" && x.zuordnung === "keine"),
    ausgeschlossen: n((x) => x.status === "ausgeschlossen"),
    offen: n((x) => x.status === "unklar"),
    dokumente: l.dokumente.map((d) => ROLLE[d.rolle]),
  };
}

/**
 * Liest gespeicherte Zettel (Material, ein Foto, mehrere Fotos oder PDFs einer Prüfung) mit der KI, alle zusammen in
 * einer Anfrage (lib/pruefungsstoff.ts). Dieselben Dateien kosten nur beim ersten Mal. Wirft einen Fehler mit einem Satz
 * für den Lehrer; die Zettel bleiben dann gespeichert und angehängt.
 */
export async function liesStoffzettel(o: { materialId?: number; materialIds?: number[]; studentId: number; teacherId: number | null; heute: string; fach?: string }): Promise<StoffzettelVorschlag & { erkannt: Erkannt }> {
  const ids = o.materialIds?.length ? o.materialIds : o.materialId ? [o.materialId] : [];
  if (!ids.length || ids.some((id) => !getMaterial(id) || !hatDatei(getMaterial(id)!))) throw new Error("Den Zettel gibt es nicht mehr. Bitte noch einmal hochladen.");
  const student = repo.getStudent(o.studentId);
  if (!student) throw new Error("Diesen Schüler gibt es nicht.");
  const r = await liesPruefungsstoff({ materialIds: ids, studentId: o.studentId, teacherId: o.teacherId, heute: o.heute, fach: o.fach, trigger: "stoffzettel" });
  // ein gelesenes Fach zählt, wenn es beim Schüler oder in der Fächerliste steht (Mehr › Fächer)
  const v = vorschlagAusGelesen(r.lesung.kopf, { heute: o.heute, faecher: [...student.subjects, ...fachNamen()], maxThemen: MAX_THEMEN });
  if (r.hinweise) v.hinweise.push(...r.hinweise);
  if (r.lesung.weggelassen) v.hinweise.push(`${r.lesung.weggelassen === 1 ? "Ein Punkt" : `${r.lesung.weggelassen} Punkte`} außerhalb des Umfangs oder doppelt: weggelassen.`);
  return { ...v, erkannt: erkanntAus(r.lesung, { lesungId: r.id, neu: r.neu, fach: v.fach ?? o.fach ?? "", student }) };
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

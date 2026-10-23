/**
 * Prüfungen eintragen (Plan 3.1, niko): „Der Schüler fotografiert einen Stoffzettel und lädt ihn hoch. Danach soll die
 * Verarbeitung automatisch erfolgen. … Unklare Angaben sollen zur Überprüfung angeboten werden. Keine erfundenen
 * Termine automatisch eintragen.“ Der Schüler trägt in seiner App Art, Fach, Datum (darf leer bleiben), Stoff, Notiz
 * und Fotos oder PDFs vom Stoffzettel ein.
 *
 * - Die Fotos werden Material des Schülers (Titel „Stoffzettel“, wie in lib/stoffzettel.ts). Hat der Schüler bestätigt,
 *   dass kein Name darauf steht, liest die vorhandene Erkennung (liesStoffzettel) sie gleich nach dem Hochladen, jedes
 *   Foto höchstens einmal. Die Kosten zählen für diesen Schüler (Grenze je Schüler, lib/ai/schueler-kosten.ts).
 * - Ist danach alles klar (automatischMoeglich: ein sicheres Datum ab heute, nichts widerspricht sich), wird gleich
 *   eine Schularbeit eingetragen (tests.quelle = 'schueler', Stand „automatisch“): sie zählt für Planung und Cockpit
 *   und steht als „vom Schüler eingetragen“ da. Sonst bleibt der Eintrag „eingereicht“ und wartet in der Prüfliste.
 *   Ein unklares oder fehlendes Datum wird nie geraten; ohne Datum gibt es keinen Termin.
 * - In der Prüfliste (Profil › Stoff & Prüfungen, „Zu erledigen“) ändert der Lehrer jedes Feld und übernimmt oder
 *   verwirft, auch einen schon automatisch eingetragenen Eintrag.
 * - Bearbeiten dürfen nur die Lehrer des Schülers (students.teacher_id, leer = alle) und der Admin.
 * - Der Schüler sieht seine Einträge und den Stand, nie Notizen des Lehrers oder Hinweise vom Lesen.
 */
import { schuelerGestoppt } from "./ai/router";
import { grenzeErreichtText } from "./ai/schueler-kosten";
import { db } from "./db";
import { alleFachNamen } from "./faecher";
import { splitTopics } from "./lehrplan";
import { deleteMaterial, getMaterial, MAX_ANALYSIS_IMAGE_BYTES, MAX_ANALYSIS_PDF_BYTES, saveUpload, sniffType } from "./materials";
import { tagAddieren } from "./planung/zeit";
import { PRUEFUNGSARTEN } from "./pruefungsarten";
import * as repo from "./repo";
import { fachAus, fachVorschlaege } from "./school";
import { liesStoffzettel, stoffzettelFuer, stoffzettelLesbar, STOFFZETTEL_TITEL, type Pruefungsart, type StoffzettelVorschlag } from "./stoffzettel";

/** Höchstens so viele Fotos je Eintrag. */
export const MAX_FOTOS = 4;
/** So viele Einträge darf ein Schüler offen haben, bevor ein Lehrer sie ansieht, und so viele am Tag eintragen. */
export const MAX_OFFEN = 10;
export const MAX_PRO_TAG = 6;
export const STOFF_MAX = 400;
export const NOTIZ_MAX = 500;
/** Ein Foto muss lesbar bleiben: dieselben Grenzen wie beim Lesen eines Stoffzettels. */
export const MAX_FOTO_BYTES = MAX_ANALYSIS_IMAGE_BYTES;
export const MAX_PDF_BYTES = MAX_ANALYSIS_PDF_BYTES;
const THEMEN = 12;
const THEMEN_TEST = 15;
/** tests.quelle einer Prüfung, die der Schüler eingetragen hat. */
export const QUELLE_SCHUELER = "schueler";

export type EinreichungStatus = "eingereicht" | "automatisch" | "uebernommen" | "verworfen";
/** Was der Schüler sieht, in einfachen Worten. */
export const STATUS_LABEL: Record<EinreichungStatus, string> = { eingereicht: "eingereicht", automatisch: "eingetragen", uebernommen: "übernommen", verworfen: "nicht übernommen" };

export type Eingabe = { art: string; fach: string; datum: string; stoff: string; notiz: string };
export type FotoDatei = { name: string; data: Buffer };

/** Eine Zeile für den Schüler: seine Angaben (oder die eingetragene Prüfung, ohne Notizen) und der Stand. */
export type SchuelerEintrag = { id: number; art: string; fach: string; datum: string | null; stoff: string; fotos: number; status: EinreichungStatus; eingereichtAm: string };

export type Foto = { id: number; materialId: number | null; mime: string | null; gelesen: boolean; vorschlag: StoffzettelVorschlag | null; fehler: string };
/** Eine Zeile der Prüfliste (nur für Lehrer). `test`: die schon eingetragene Prüfung (Stand automatisch). */
export type Einreichung = {
  id: number;
  studentId: number;
  art: string;
  fach: string;
  datum: string | null;
  stoff: string;
  notiz: string;
  keineNamen: boolean;
  status: EinreichungStatus;
  testId: number | null;
  eingereichtAm: string;
  fotos: Foto[];
  test: { kind: string; subject: string; date: string; title: string; topics: string[]; notes: string } | null;
};

const eineZeile = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);
const echtesDatum = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;
const istArt = (s: string): s is Pruefungsart => (PRUEFUNGSARTEN as readonly string[]).includes(s);

// ---------- wer darf ----------

/** Die Prüfliste eines Schülers: der Admin und seine Lehrer (students.teacher_id; ohne Lehrer jeder, wie bei „Zu erledigen“). */
export function darfPruefliste(akteur: { id: number; is_admin: number }, studentId: number): boolean {
  const s = repo.getStudent(studentId);
  if (!s) return false;
  return Number(akteur.is_admin) === 1 || s.teacher_id == null || s.teacher_id === akteur.id;
}

// ---------- der Schüler trägt ein ----------

/**
 * Prüft die Angaben des Schülers. Art nur aus der Liste, Fach nur ein bekanntes (seine oder die der Fächerliste),
 * ein Datum nur, wenn es den Tag gibt; sonst bleibt es leer. Stoff oder ein Foto muss dabei sein.
 */
export function pruefeEingabe(e: Eingabe, o: { faecher: string[]; alle: readonly string[]; fotos: number }): { ok: true; werte: Omit<Eingabe, "datum"> & { datum: string | null } } | { ok: false; fehler: string } {
  const fach = fachAus(e.fach, o.faecher, o.alle);
  if (!fach || !fachVorschlaege(o.faecher, o.alle).includes(fach)) return { ok: false, fehler: "Bitte ein Fach wählen." };
  const stoff = eineZeile(e.stoff, STOFF_MAX);
  if (!stoff && o.fotos === 0) return { ok: false, fehler: "Bitte den Stoff eintragen oder den Stoffzettel fotografieren." };
  const datum = e.datum.trim();
  return {
    ok: true,
    werte: { art: istArt(e.art.trim()) ? e.art.trim() : PRUEFUNGSARTEN[0], fach, datum: echtesDatum(datum) ? datum : null, stoff, notiz: e.notiz.trim().slice(0, NOTIZ_MAX) },
  };
}

/** Ein Foto oder PDF des Schülers: Art aus dem Inhalt, Größe so, dass es noch gelesen werden kann. */
export function pruefeFoto(f: FotoDatei): string | null {
  if (!f.data.length) return "Ein Foto ist leer. Bitte noch einmal wählen.";
  const type = sniffType(f.data);
  if (!type) return "Bitte nur Fotos (JPG, PNG, WebP) oder PDF-Dateien wählen.";
  const max = type.mime === "application/pdf" ? MAX_PDF_BYTES : MAX_FOTO_BYTES;
  if (f.data.length > max) return `${type.mime === "application/pdf" ? "Das PDF" : "Ein Foto"} ist zu groß (höchstens ${max / 1024 / 1024} MB).`;
  return null;
}

/**
 * Speichert einen Eintrag des Schülers mit seinen Fotos. Ohne Fotos wird gleich entschieden (entscheide); mit Fotos
 * sagt `verarbeiten`, ob sie jetzt gelesen werden dürfen (der Schüler hat „kein Name darauf“ bestätigt). Wirft einen
 * Fehler mit einem Satz für den Schüler.
 */
export function reicheEin(studentId: number, e: Eingabe, fotos: FotoDatei[], o: { keineNamen?: boolean; now?: Date; heute: string }): { id: number; verarbeiten: boolean } {
  const now = o.now ?? new Date();
  const student = repo.getStudent(studentId);
  if (!student) throw new Error("Diesen Link gibt es nicht mehr.");
  if (fotos.length > MAX_FOTOS) throw new Error(`Höchstens ${MAX_FOTOS} Fotos.`);
  for (const f of fotos) {
    const fehler = pruefeFoto(f);
    if (fehler) throw new Error(fehler);
  }
  const g = pruefeEingabe(e, { faecher: student.subjects, alle: alleFachNamen(), fotos: fotos.length });
  if (!g.ok) throw new Error(g.fehler);
  const conn = db();
  const offen = (conn.prepare("SELECT COUNT(*) AS n FROM pruefung_einreichungen WHERE student_id = ? AND status = 'eingereicht'").get(studentId) as { n: number }).n;
  if (offen >= MAX_OFFEN) throw new Error("Du hast schon viele Prüfungen eingetragen, die noch niemand angesehen hat. Bitte warte, bis dein Lehrer sie ansieht.");
  const seit = new Date(now.getTime() - 86_400_000).toISOString();
  const heute = (conn.prepare("SELECT COUNT(*) AS n FROM pruefung_einreichungen WHERE student_id = ? AND created_at >= ?").get(studentId, seit) as { n: number }).n;
  if (heute >= MAX_PRO_TAG) throw new Error("Für heute sind es genug Einträge. Bitte morgen weitermachen.");

  const w = g.werte;
  const keineNamen = Boolean(o.keineNamen) && fotos.length > 0;
  // die Dateien zuerst (das Speichern prüft sie noch einmal), dann alles in einem Schritt in die Datenbank
  const materialien = fotos.map((f) => saveUpload(f, { title: STOFFZETTEL_TITEL, subject: w.fach, studentId, teacherId: null, at: now }));
  const id = conn.transaction(() => {
    const neu = Number(
      conn
        .prepare("INSERT INTO pruefung_einreichungen (student_id, art, fach, datum, stoff, notiz, keine_namen, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'eingereicht', ?)")
        .run(studentId, w.art, w.fach, w.datum, w.stoff, w.notiz, keineNamen ? 1 : 0, now.toISOString()).lastInsertRowid,
    );
    const foto = conn.prepare("INSERT INTO pruefung_einreichung_fotos (einreichung_id, material_id, neu) VALUES (?, ?, ?)");
    for (const m of materialien) foto.run(neu, m.id, m.existing ? 0 : 1);
    return neu;
  })();
  if (!fotos.length) entscheide(id, o.heute);
  return { id, verarbeiten: keineNamen && stoffzettelLesbar().ok };
}

/**
 * Gleich nach dem Hochladen, ohne Klick: liest die Fotos (nur nach „kein Name darauf“) und entscheidet, ob der Eintrag
 * gleich eine Prüfung wird. Ohne KI oder an der Grenze je Schüler wird nichts gelesen; dann prüft der Lehrer.
 */
export async function verarbeite(id: number, o: { heute: string; now?: Date }): Promise<EinreichungStatus | null> {
  const e = getEinreichung(id);
  if (!e) return null;
  if (e.status !== "eingereicht" || !e.keineNamen) return e.status;
  const lehrer = repo.getStudent(e.studentId)?.teacher_id ?? null;
  try {
    await liesFotos(id, { teacherId: lehrer, heute: o.heute, now: o.now });
  } catch {
    // nicht lesbar (keine KI, Grenze erreicht): der Eintrag wartet in der Prüfliste
  }
  return entscheide(id, o.heute);
}

/** Die Einträge des Schülers für seine App: die offenen und die der letzten 60 Tage, das Neueste zuerst. */
export function eintraegeFuerSchueler(studentId: number, now = new Date()): SchuelerEintrag[] {
  const seit = new Date(now.getTime() - 60 * 86_400_000).toISOString();
  // die eigenen Angaben, nach dem Eintragen die der Prüfung; nie Notizen, nichts vom Lesen
  const rows = db()
    .prepare(
      `SELECT e.id, e.art, e.fach, e.datum, e.stoff, e.status, e.created_at AS eingereichtAm,
        (SELECT COUNT(*) FROM pruefung_einreichung_fotos f WHERE f.einreichung_id = e.id) AS fotos,
        t.kind AS t_kind, t.subject AS t_subject, t.date AS t_date, t.topic AS t_topic
       FROM pruefung_einreichungen e LEFT JOIN tests t ON t.id = e.test_id AND e.status IN ('automatisch', 'uebernommen')
       WHERE e.student_id = ? AND (e.status = 'eingereicht' OR e.created_at >= ?)
       ORDER BY e.created_at DESC, e.id DESC LIMIT 20`,
    )
    .all(studentId, seit) as (SchuelerEintrag & { t_kind: string | null; t_subject: string | null; t_date: string | null; t_topic: string | null })[];
  return rows.map(({ t_kind, t_subject, t_date, t_topic, ...r }) => (t_kind ? { ...r, art: t_kind, fach: t_subject ?? r.fach, datum: t_date, stoff: t_topic ?? r.stoff } : r));
}

// ---------- die Prüfliste des Lehrers ----------

type Row = { id: number; student_id: number; art: string; fach: string; datum: string | null; stoff: string; notiz: string; keine_namen: number; status: EinreichungStatus; test_id: number | null; created_at: string };
type FotoRow = { id: number; material_id: number | null; mime: string | null; gelesen_am: string | null; vorschlag: string | null; fehler: string };

function fotosVon(id: number): Foto[] {
  return (
    db()
      .prepare("SELECT f.id, f.material_id, m.mime, f.gelesen_am, f.vorschlag, f.fehler FROM pruefung_einreichung_fotos f LEFT JOIN materials m ON m.id = f.material_id WHERE f.einreichung_id = ? ORDER BY f.id")
      .all(id) as FotoRow[]
  ).map((f) => {
    let vorschlag: StoffzettelVorschlag | null = null;
    try {
      vorschlag = f.vorschlag ? (JSON.parse(f.vorschlag) as StoffzettelVorschlag) : null;
    } catch {
      vorschlag = null;
    }
    return { id: f.id, materialId: f.material_id, mime: f.mime, gelesen: f.gelesen_am != null, vorschlag, fehler: f.fehler };
  });
}
function zuEinreichung(r: Row): Einreichung {
  const t = r.test_id ? repo.getTest(r.test_id) : null;
  return {
    id: r.id, studentId: r.student_id, art: r.art, fach: r.fach, datum: r.datum, stoff: r.stoff, notiz: r.notiz, keineNamen: r.keine_namen === 1, status: r.status, testId: r.test_id, eingereichtAm: r.created_at,
    fotos: fotosVon(r.id),
    test: t ? { kind: t.kind, subject: t.subject, date: t.date, title: t.title ?? "", topics: t.topics?.length ? t.topics : splitTopics(t.topic), notes: t.notes } : null,
  };
}

export function getEinreichung(id: number): Einreichung | null {
  const r = db().prepare("SELECT * FROM pruefung_einreichungen WHERE id = ?").get(id) as Row | undefined;
  return r ? zuEinreichung(r) : null;
}

/**
 * Was in der Prüfliste eines Schülers auf den Lehrer wartet, das Älteste zuerst: die zu prüfenden und die schon
 * eingetragenen, die noch kein Lehrer bestätigt hat (solange es die Prüfung gibt).
 */
export function offeneEinreichungen(studentId: number): Einreichung[] {
  return (
    db()
      .prepare("SELECT * FROM pruefung_einreichungen WHERE student_id = ? AND (status = 'eingereicht' OR (status = 'automatisch' AND test_id IS NOT NULL)) ORDER BY created_at, id")
      .all(studentId) as Row[]
  ).map(zuEinreichung);
}

/**
 * Die gelesenen Fotos eines Eintrags als ein Vorschlag (je Foto der Vorschlag oder null). Ein Foto: so, wie es
 * gelesen wurde. Mehrere: Art und Bezeichnung vom ersten, das sie nennt; Fach und Datum nur, wenn alle Fotos, die
 * eines nennen, dasselbe sagen (sonst leer, mit Hinweis); der Stoff aller Fotos ohne Doppelte; die Hinweise mit der
 * Nummer des Fotos.
 */
export function zusammenfuehren(vorschlaege: (StoffzettelVorschlag | null)[]): StoffzettelVorschlag | null {
  const da = vorschlaege.map((v, i) => ({ v, nr: i + 1 })).filter((x): x is { v: StoffzettelVorschlag; nr: number } => x.v != null);
  if (!da.length) return null;
  if (vorschlaege.length === 1) return da[0].v;
  const hinweise: string[] = [];
  const einig = (werte: (string | null)[], hinweis: string) => {
    const genannt = [...new Set(werte.filter((x): x is string => Boolean(x)))];
    if (genannt.length > 1) hinweise.push(hinweis);
    return genannt.length === 1 ? genannt[0] : null;
  };
  const fach = einig(da.map((x) => x.v.fach), "Die Fotos nennen verschiedene Fächer. Bitte wählen.");
  const datum = einig(da.map((x) => x.v.datum), "Die Fotos nennen verschiedene Termine. Bitte eintragen.");
  const gesehen = new Set<string>();
  const themen: string[] = [];
  for (const t of da.flatMap((x) => x.v.themen)) {
    if (gesehen.has(t.toLowerCase())) continue;
    gesehen.add(t.toLowerCase());
    themen.push(t);
  }
  for (const x of da) for (const h of x.v.hinweise) hinweise.push(`Foto ${x.nr}: ${h}`);
  return {
    art: da.find((x) => x.v.art)?.v.art ?? null,
    fach,
    datum,
    titel: da.find((x) => x.v.titel)?.v.titel ?? "",
    themen: themen.slice(0, THEMEN),
    hinweise,
  };
}

type Feld = "art" | "fach" | "datum" | "titel" | "stoff";
export type Formular = { art: string; fach: string; datum: string; titel: string; stoff: string; notiz: string; vomFoto: Feld[]; konflikte: Feld[]; abweichungen: string[] };

/**
 * Was das Formular der Prüfliste vorfüllt: die Angaben des Schülers; ein leeres Feld bekommt den Wert vom Foto.
 * Sagt das Foto etwas anderes als der Schüler, bleibt seine Angabe und das Foto steht als Hinweis darunter.
 * Ohne Datum bleibt das Feld leer, nie „heute“.
 */
export function formular(e: Pick<Einreichung, "art" | "fach" | "datum" | "stoff" | "notiz">, v: StoffzettelVorschlag | null): Formular {
  const f: Formular = { art: e.art, fach: e.fach, datum: e.datum ?? "", titel: "", stoff: e.stoff, notiz: e.notiz, vomFoto: [], konflikte: [], abweichungen: [] };
  if (!v) return f;
  if (v.art && v.art !== e.art) {
    f.konflikte.push("art");
    f.abweichungen.push(`Art auf dem Foto: ${v.art}`);
  }
  if (v.fach && v.fach !== e.fach) {
    f.konflikte.push("fach");
    f.abweichungen.push(`Fach auf dem Foto: ${v.fach}`);
  }
  if (v.datum && !e.datum) {
    f.datum = v.datum;
    f.vomFoto.push("datum");
  } else if (v.datum && v.datum !== e.datum) {
    f.konflikte.push("datum");
    f.abweichungen.push(`Datum auf dem Foto: ${v.datum.split("-").reverse().join(".")}`);
  }
  if (v.titel) {
    f.titel = v.titel;
    f.vomFoto.push("titel");
  }
  if (v.themen.length && !e.stoff.trim()) {
    f.stoff = v.themen.join(", ");
    f.vomFoto.push("stoff");
  } else if (v.themen.length) {
    const schon = new Set(splitTopics(e.stoff).map((t) => t.toLowerCase()));
    const mehr = v.themen.filter((t) => !schon.has(t.toLowerCase()));
    if (mehr.length) f.abweichungen.push(`Auf dem Foto außerdem: ${mehr.join(", ")}`);
  }
  return f;
}

export type Uebernahme = { art: string; fach: string; datum: string; titel: string; stoff: string; notiz: string };

/**
 * Ob ein Eintrag ohne Lehrer eine Prüfung werden darf, und mit welchen Werten. Nur wenn alles klar ist: jedes Foto
 * gelesen, nichts widerspricht dem Schüler (Art, Fach, Datum), und ein Datum ab heute und höchstens ein Jahr voraus.
 * Ein Datum vom Foto zählt nicht, wenn beim Lesen etwas unsicher war oder ein Hinweis den Termin betrifft.
 * Der Stoff ist der des Schülers und der vom Foto zusammen.
 */
export function automatischMoeglich(e: Pick<Einreichung, "art" | "fach" | "datum" | "stoff" | "notiz" | "fotos">, heute: string): { ok: true; werte: Uebernahme } | { ok: false; grund: string } {
  if (e.fotos.some((f) => !f.vorschlag)) return { ok: false, grund: "Nicht jedes Foto wurde gelesen." };
  const v = zusammenfuehren(e.fotos.map((f) => f.vorschlag));
  const f = formular(e, v);
  if (f.konflikte.length) return { ok: false, grund: "Foto und Angaben passen nicht zusammen." };
  if (!f.datum) return { ok: false, grund: "Kein sicheres Datum." };
  if (f.datum < heute || f.datum > tagAddieren(heute, 366)) return { ok: false, grund: "Das Datum liegt nicht in den nächsten zwölf Monaten." };
  if (f.vomFoto.includes("datum") && v?.hinweise.some((h) => /unsicher|datum|termin/i.test(h))) return { ok: false, grund: "Das Datum auf dem Foto ist nicht sicher." };
  const themen = [...splitTopics(e.stoff), ...(v?.themen ?? [])].filter((t, i, alle) => alle.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i);
  return { ok: true, werte: { art: f.art, fach: f.fach, datum: f.datum, titel: f.titel, stoff: themen.join(", "), notiz: f.notiz } };
}

/** Die Werte einer Prüfung, wie sie gespeichert werden; null mit Satz, wenn etwas fehlt. */
function testWerte(studentId: number, u: Uebernahme): { kind: string; subject: string; date: string; title: string; topics: string[]; notes: string } | { fehler: string } {
  const datum = u.datum.trim();
  if (!echtesDatum(datum)) return { fehler: "Bitte das Datum der Prüfung eintragen." };
  const student = repo.getStudent(studentId);
  if (!student) return { fehler: "Diesen Schüler gibt es nicht mehr." };
  const subject = fachAus(u.fach, student.subjects, alleFachNamen());
  if (!subject) return { fehler: "Bitte ein Fach wählen." };
  return {
    kind: istArt(u.art.trim()) ? u.art.trim() : PRUEFUNGSARTEN[0],
    subject,
    date: datum,
    title: eineZeile(u.titel, 120),
    topics: splitTopics(u.stoff).slice(0, THEMEN_TEST),
    notes: u.notiz.trim().slice(0, NOTIZ_MAX),
  };
}

/** Legt die Prüfung an, mit dem ersten Foto als Stoffzettel; jedes Foto bekommt Name und Stoff der Prüfung. */
function legeAn(e: Einreichung, w: { kind: string; subject: string; date: string; title: string; topics: string[]; notes: string }, teacherId: number | null): number {
  const t = { student_id: e.studentId, title: w.title, kind: w.kind, subject: w.subject, topics: w.topics };
  const zettel = e.fotos.map((f) => (f.materialId ? stoffzettelFuer(f.materialId, t) : null)).filter((x): x is number => x != null);
  // Fähigkeiten werden nicht verknüpft: das geht wie bei jedem Stoffzettel in der Vorbereitung
  const testId = repo.addTest({ ...t, date: w.date, topic: w.topics.join(", "), grade: null, points: null, max_points: null, notes: w.notes, skill_ids: [], teacher_id: teacherId, material_id: zettel[0] ?? null });
  db().prepare("UPDATE tests SET quelle = ? WHERE id = ?").run(QUELLE_SCHUELER, testId);
  db().prepare("UPDATE pruefung_einreichungen SET test_id = ? WHERE id = ?").run(testId, e.id);
  return testId;
}

/**
 * Ohne Lehrer: ist alles klar (automatischMoeglich), wird der Eintrag gleich eine Prüfung (Stand automatisch);
 * sonst bleibt er eingereicht und wartet in der Prüfliste. Gibt den Stand danach zurück.
 */
export function entscheide(id: number, heute: string): EinreichungStatus | null {
  const e = getEinreichung(id);
  if (!e) return null;
  if (e.status !== "eingereicht") return e.status;
  const a = automatischMoeglich(e, heute);
  if (!a.ok) return "eingereicht";
  const w = testWerte(e.studentId, a.werte);
  if ("fehler" in w) return "eingereicht";
  const conn = db();
  return conn.transaction(() => {
    const frei = conn.prepare("UPDATE pruefung_einreichungen SET status = 'automatisch' WHERE id = ? AND status = 'eingereicht'").run(id);
    if (!frei.changes) return getEinreichung(id)?.status ?? null;
    legeAn(e, w, repo.getStudent(e.studentId)?.teacher_id ?? null);
    return "automatisch" as const;
  })();
}

/**
 * Liest die noch nicht gelesenen Fotos eines Eintrags mit der vorhandenen Erkennung (lib/stoffzettel.ts). Jedes Foto
 * höchstens einmal: es gilt als gelesen, bevor die Anfrage losgeht, auch wenn sie scheitert. Ohne KI oder an der
 * Grenze je Schüler wird nichts gelesen und nichts vermerkt. Gibt die Zahl der gelesenen Fotos zurück.
 */
export async function liesFotos(id: number, o: { teacherId: number | null; heute: string; now?: Date }): Promise<number> {
  const e = getEinreichung(id);
  if (!e || e.status !== "eingereicht") throw new Error("Dieser Eintrag ist schon erledigt.");
  const geht = stoffzettelLesbar();
  if (!geht.ok) throw new Error(geht.grund);
  let gelesen = 0;
  for (const f of e.fotos) {
    if (f.gelesen || !f.materialId) continue;
    // an der Grenze je Schüler: nichts vermerken, später (nächster Monat, höhere Grenze) geht es noch
    if (schuelerGestoppt("stoffzettel", e.studentId)) {
      if (!gelesen) throw new Error(grenzeErreichtText());
      break;
    }
    const mein = db().prepare("UPDATE pruefung_einreichung_fotos SET gelesen_am = ? WHERE id = ? AND gelesen_am IS NULL").run((o.now ?? new Date()).toISOString(), f.id);
    if (!mein.changes) continue; // ein zweiter Aufruf zur gleichen Zeit
    try {
      const v = await liesStoffzettel({ materialId: f.materialId, studentId: e.studentId, teacherId: o.teacherId, heute: o.heute });
      db().prepare("UPDATE pruefung_einreichung_fotos SET vorschlag = ? WHERE id = ?").run(JSON.stringify(v), f.id);
      gelesen++;
    } catch (err) {
      db().prepare("UPDATE pruefung_einreichung_fotos SET fehler = ? WHERE id = ?").run((err instanceof Error ? err.message : "Das Foto konnte nicht gelesen werden.").slice(0, 300), f.id);
    }
  }
  return gelesen;
}

/**
 * Der Lehrer übernimmt den Eintrag mit den Werten aus seinem Formular: ein zu prüfender wird eine Prüfung, bei einem
 * schon eingetragenen wird die Prüfung so geändert. Danach ist er erledigt.
 */
export function uebernimm(id: number, teacherId: number, u: Uebernahme): { testId: number } | { fehler: string } {
  const e = getEinreichung(id);
  if (!e) return { fehler: "Diesen Eintrag gibt es nicht mehr." };
  if (e.status !== "eingereicht" && e.status !== "automatisch") return { fehler: "Dieser Eintrag ist schon erledigt." };
  if (e.status === "automatisch" && !e.test) return { fehler: "Die Prüfung dazu gibt es nicht mehr." };
  const w = testWerte(e.studentId, u);
  if ("fehler" in w) return w;
  const conn = db();
  return conn.transaction(() => {
    // wer zuerst entscheidet: ein zweiter Klick legt keine zweite Prüfung an
    const frei = conn
      .prepare("UPDATE pruefung_einreichungen SET status = 'uebernommen', entschieden_von = ?, entschieden_am = ? WHERE id = ? AND status = ?")
      .run(teacherId, new Date().toISOString(), id, e.status);
    if (!frei.changes) return { fehler: "Dieser Eintrag ist schon erledigt." };
    if (e.status === "eingereicht") return { testId: legeAn(e, w, teacherId) };
    conn
      .prepare("UPDATE tests SET kind = ?, subject = ?, date = ?, title = ?, topic = ?, topics = ?, notes = ? WHERE id = ?")
      .run(w.kind, w.subject, w.date, w.title, w.topics.join(", "), JSON.stringify(w.topics), w.notes, e.testId);
    return { testId: e.testId! };
  })();
}

/**
 * Verwirft den Eintrag; eine schon eingetragene Prüfung ohne Ergebnis wird gelöscht. Fotos, die mit ihm hochgeladen
 * wurden und sonst nirgends hängen (keine Prüfung, kein anderer Eintrag, unter Material nicht eingeordnet), werden
 * mit ihrem Material gelöscht.
 */
export function verwirf(id: number, teacherId: number): { ok: true } | { fehler: string } {
  const e = getEinreichung(id);
  if (!e) return { fehler: "Diesen Eintrag gibt es nicht mehr." };
  const conn = db();
  const frei = conn
    .prepare("UPDATE pruefung_einreichungen SET status = 'verworfen', entschieden_von = ?, entschieden_am = ? WHERE id = ? AND status IN ('eingereicht', 'automatisch')")
    .run(teacherId, new Date().toISOString(), id);
  if (!frei.changes) return { fehler: "Dieser Eintrag ist schon erledigt." };
  if (e.status === "automatisch" && e.testId) {
    const t = repo.getTest(e.testId);
    if (t && t.quelle === QUELLE_SCHUELER && t.grade == null && t.points == null) repo.deleteTest(t.id);
  }
  const neu = conn.prepare("SELECT material_id FROM pruefung_einreichung_fotos WHERE einreichung_id = ? AND neu = 1 AND material_id IS NOT NULL").all(id) as { material_id: number }[];
  for (const { material_id: mid } of neu) {
    const benutzt = conn
      .prepare("SELECT (SELECT COUNT(*) FROM tests WHERE material_id = @mid) + (SELECT COUNT(*) FROM pruefung_einreichung_fotos WHERE material_id = @mid AND einreichung_id <> @id) AS n")
      .get({ mid, id }) as { n: number };
    // ein Material, das der Lehrer unter Material schon eingeordnet hat, bleibt
    const m = getMaterial(mid);
    if (!benutzt.n && m && m.status === "hochgeladen") deleteMaterial(mid);
  }
  return { ok: true };
}

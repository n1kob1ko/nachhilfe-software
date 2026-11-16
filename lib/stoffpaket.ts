/**
 * **Stoff vorbereiten** (niko, 16.11.2026): Bisher machte niko das im Claude-Chat: alle Fotos vom Buch, von den
 * Arbeitszetteln und vom Stoff hochladen, daraus eine Präsentation, ein PDF mit den Infos, einen Test mit Lösungen und einen
 * Vorbereitungstest machen lassen. Hier geht das in der App in einem Schritt, beim Schüler:
 *
 * 1. Die Lehrkraft wählt Fotos oder PDFs (oder vorhandenes Material) und schreibt optional dazu, was sie braucht.
 * 2. Eine Anfrage an die KI (lib/ai/stoffpaket.ts) mit dem, was die App über den Schüler weiß: Schulart, Klasse, die nächste
 *    Prüfung im Fach mit ihrem Stoff, offene Fehlermuster, schwache Fähigkeiten. Die Lehrkraft muss das nicht dazuschreiben.
 * 3. Daraus entstehen: ein Lernzettel (A4 und in der Schüler-App), ein Übungsblatt, ein Test (zur nächsten Schularbeit als
 *    Probeschularbeit mit Punkten und Note), ein Vorbereitungstest und ein Lernpaket mit Präsentation (eine zweite Anfrage,
 *    lib/praesentation-ki.ts, nur mit dem Ablauf, ohne Schülerdaten). Alles als Entwurf.
 * 4. Die Lehrkraft sieht alles in einer Vorschau und übernimmt es mit einem Knopf: dann ist das Lernpaket geprüft, die
 *    Präsentation gespeichert, das Paket für die laufende oder die nächste Einheit des Schülers gewählt (Cockpit), und der
 *    Lernzettel steht in der Schüler-App. Die Blätter schickt sie wie jede Übung aufs Gerät oder druckt sie.
 *
 * Die Anfrage läuft im Server weiter, auch wenn die Seite zugeht; die Seite zeigt solange „wird erstellt“. Ein Lauf, der beim
 * Neustart des Servers hängen bleibt, gilt nach 20 Minuten als abgebrochen. Der Lernstand ändert sich erst durch die Antworten
 * des Schülers, wie bei jeder Übung.
 */
import fs from "node:fs";
import { loescheSatz, setzeAktiv, speichereSatz, spielkartenVon } from "./spielkarten";
import { ALLE_TEILE, ANZAHL, STOFFPAKET_SYSTEM, StoffpaketSchema, stoffpaketAusAntwort, stoffpaketText, TEILE, type Blatt, type Lernzettel, type StoffpaketAuftrag, type Teil } from "./ai/stoffpaket";
import { budget, costOf, isLocalModel, routeFor } from "./ai/config";
import { jsonSchemaOf } from "./ai/providers/schema";
import { aiEnabled, aiReadsImages, budgetUsedUp, runAI, schuelerGestoppt } from "./ai/router";
import type { Part } from "./ai/providers/types";
import { grenzeErreichtText } from "./ai/schueler-kosten";
import { bereiteVor, hatBegonnen, leseStand, waehlePaket } from "./cockpit";
import { db, json } from "./db";
import { dayOf } from "./exams";
import { listErkenntnisse } from "./erkenntnisse";
import { fachNamen } from "./faecher";
import { skillsForPrompt } from "./lehrplan";
import { archiviereLernpaket, getLernpaket, importiereLernpaket, markiereGeprueft } from "./lernpakete";
import { getMaterial, hatDatei, materialFile, MAX_ANALYSIS_IMAGE_BYTES, MAX_ANALYSIS_PDF_BYTES, sniffType } from "./materials";
import { wienerDatum } from "./planung/zeit";
import { bekannteNamen, erstellePraesEntwurf, getPraesEntwurf, praesKostenSchaetzung, uebernimmPraesEntwurf, verwirfPraesEntwurf } from "./praesentation-ki";
import { markierePraesentationGeprueft } from "./praesentationen";
import { angabeOhneNamen, stoffDerPruefung } from "./pruefungsstoff";
import * as repo from "./repo";
import { checkLevel, klassenLabel } from "./school";
import { analyzeStudent } from "./service";
import { getUnit, runningUnitForStudent } from "./units";
import { kommendeTermine } from "./vorbereitung-auto";

/** So viele Fotos oder PDFs gehen zusammen an die KI. */
export const MAX_DATEIEN = 10;
export const MAX_GESAMT_BYTES = 40 * 1024 * 1024;
export const ANWEISUNG_MAX = 1500;
/** Nach so vielen Minuten gilt ein Lauf, der noch „läuft“, als abgebrochen (der Server wurde neu gestartet). */
const HAENGT_MIN = 20;

export type StoffpaketStatus = "laeuft" | "fertig" | "fehler" | "uebernommen" | "verworfen";

export type Stoffpaket = {
  id: number;
  student_id: number;
  teacher_id: number | null;
  unit_id: number | null;
  status: StoffpaketStatus;
  /** was gerade läuft, in Worten („Fotos lesen“, „Präsentation erstellen“) */
  schritt: string;
  fach: string;
  thema: string;
  anweisung: string;
  teile: Teil[];
  dateien: number[];
  skill_ids: string[];
  lernzettel: Lernzettel | null;
  uebung_id: number | null;
  test_id: number | null;
  vorbereitung_id: number | null;
  paket_id: number | null;
  praes_entwurf_id: number | null;
  praesentation_id: number | null;
  pruefung_id: number | null;
  unsicher: string[];
  weggelassen: string[];
  fehler: string;
  call_ids: number[];
  created_at: string;
  fertig_at: string | null;
  uebernommen_at: string | null;
};

type Row = Omit<Stoffpaket, "teile" | "dateien" | "skill_ids" | "lernzettel" | "unsicher" | "weggelassen" | "call_ids"> & {
  teile: string;
  dateien: string;
  skill_ids: string;
  lernzettel: string | null;
  unsicher: string;
  weggelassen: string;
  call_ids: string;
};

const alsPaket = (r: Row): Stoffpaket => ({
  ...r,
  teile: json<Teil[]>(r.teile, []),
  dateien: json<number[]>(r.dateien, []),
  skill_ids: json<string[]>(r.skill_ids, []),
  lernzettel: r.lernzettel ? json<Lernzettel | null>(r.lernzettel, null) : null,
  unsicher: json<string[]>(r.unsicher, []),
  weggelassen: json<string[]>(r.weggelassen, []),
  call_ids: json<number[]>(r.call_ids, []),
});

/** Ein Lauf, der zu lange „läuft“, ist beim Neustart des Servers abgebrochen. */
function aufraeumen() {
  db()
    .prepare(`UPDATE stoffpakete SET status = 'fehler', schritt = '', fehler = 'Das Erstellen wurde unterbrochen (der Server wurde neu gestartet). Bitte noch einmal starten, die Fotos sind gespeichert.' WHERE status = 'laeuft' AND created_at < datetime('now', ?)`)
    .run(`-${HAENGT_MIN} minutes`);
}

export function getStoffpaket(id: number): Stoffpaket | null {
  aufraeumen();
  const r = db().prepare("SELECT * FROM stoffpakete WHERE id = ?").get(id) as Row | undefined;
  return r ? alsPaket(r) : null;
}

/** Die Stoffpakete eines Schülers, das neueste zuerst; verworfene nicht. */
export function listStoffpakete(studentId: number, o: { mitVerworfenen?: boolean } = {}): Stoffpaket[] {
  aufraeumen();
  return (db().prepare(`SELECT * FROM stoffpakete WHERE student_id = ? ${o.mitVerworfenen ? "" : "AND status <> 'verworfen'"} ORDER BY id DESC`).all(studentId) as Row[]).map(alsPaket);
}

/** Die übernommenen Lernzettel eines Schülers für die Schüler-App, der neueste zuerst. */
export function lernzettelFuer(studentId: number): { id: number; titel: string; fach: string; datum: string }[] {
  return listStoffpakete(studentId)
    .filter((p) => p.status === "uebernommen" && p.lernzettel)
    .map((p) => ({ id: p.id, titel: p.lernzettel!.titel, fach: p.fach, datum: (p.uebernommen_at ?? p.created_at).slice(0, 10) }));
}

/** Das Fach, das das Formular vorschlägt: das der laufenden Einheit, der nächsten Prüfung, sonst das einzige des Schülers. */
export function vorschlagFach(student: repo.Student): string {
  const unit = runningUnitForStudent(student.id);
  if (unit?.subject) return unit.subject;
  const pruefung = repo.upcomingTests(dayOf(new Date()), student.id)[0];
  if (pruefung?.subject) return pruefung.subject;
  return student.subjects.length === 1 ? student.subjects[0] : "";
}

/** Die Fächer zur Wahl: die des Schülers zuerst, dann alle anderen. */
export function faecherZurWahl(student: repo.Student): string[] {
  return [...new Set([...student.subjects, ...fachNamen()])];
}

/** Ob jetzt erstellt werden kann; sonst der Grund in Worten für die Lehrkraft. */
export function stoffpaketMoeglich(o: { studentId: number; dateien: number }): { ok: true } | { ok: false; grund: string } {
  if (!aiEnabled("stoffpaket")) return { ok: false, grund: "Das macht die KI, und die ist gerade nicht eingerichtet (Erweitert › KI-Kosten)." };
  if (o.dateien && !aiReadsImages("stoffpaket")) return { ok: false, grund: "Im eingestellten KI-Modus kann die KI keine Fotos lesen." };
  if (budgetUsedUp("stoffpaket")) return { ok: false, grund: "Das KI-Budget für diesen Monat ist aufgebraucht." };
  if (schuelerGestoppt("stoffpaket", o.studentId)) return { ok: false, grund: grenzeErreichtText() };
  return { ok: true };
}

/**
 * Was ein Lauf kostet, vor dem Klick: die Anfrage mit etwa 4 Fotos (je rund 1 600 Tokens), Schülerdaten und Liste der
 * Fähigkeiten (rund 6 000 Tokens), 12 000 bis 26 000 Tokens Antwort mit Denken (mit den Spielkarten), dazu die Präsentation.
 */
export function kostenSchaetzung(o: { dateien?: number; praesentation?: boolean } = {}): string {
  const route = routeFor("stoffpaket");
  if (route.provider === "manual") return "kostet nichts (manueller Modus)";
  if (isLocalModel(route.provider)) return "kostet nichts (lokales Modell)";
  const input = Math.round((STOFFPAKET_SYSTEM.length + JSON.stringify(jsonSchemaOf(StoffpaketSchema)).length) / 3.2) + 6_000 + (o.dateien ?? 4) * 1_600;
  const usd = (output: number) => costOf(route.model, "standard", { input, output, cacheWrite: 0, cacheRead: 0 });
  const praes = o.praesentation === false ? { usdVon: 0, usdBis: 0 } : praesKostenSchaetzung();
  const cent = (x: number) => Math.round((x / budget().usdPerEur) * 100);
  return `etwa ${cent(usd(12_000) + praes.usdVon)}–${cent(usd(26_000) + praes.usdBis)} Cent`;
}

/** Die nächste geplante Prüfung im Fach (heute oder später), mit ihrem Stoff in Worten. */
function naechstePruefung(studentId: number, fach: string): { test: repo.TestResult; text: string } | null {
  const heute = dayOf(new Date());
  const t = repo.upcomingTests(heute, studentId).find((x) => x.subject === fach && x.status !== "abgesagt");
  if (!t) return null;
  const stoff = stoffDerPruefung(t.id)
    .filter((z) => z.status !== "ausgeschlossen")
    .map((z) => z.inhalt || z.original)
    .filter(Boolean)
    .slice(0, 20);
  const datum = `${Number(t.date.slice(8, 10))}.${Number(t.date.slice(5, 7))}.${t.date.slice(0, 4)}`;
  return { test: t, text: `${t.kind || "Prüfung"} am ${datum}${t.title ? ` („${t.title}“)` : ""}${stoff.length ? `; Stoff laut Stoffzettel: ${stoff.join("; ")}` : ""}` };
}

/** Was die App über den Schüler im Fach weiß, ohne Namen und ohne freie Notizen (wie contextForAI im Builder). */
function schuelerText(student: repo.Student, fach: string): string {
  const a = analyzeStudent(student.id);
  if (!a) return "";
  const imFach = (ids: string[]) => ids.some((id) => repo.getSkill(id)?.subject === fach);
  const schwach = a.weaknesses.filter((w) => w.skill.subject === fach).slice(0, 6);
  const fehler = a.errors.filter((e) => imFach(e.skillIds)).slice(0, 6);
  const z: string[] = [];
  if (schwach.length) z.push(`Schwache Fähigkeiten: ${schwach.map((w) => `${w.skill.name} (${Math.round((w.mastery ?? 0) * 100)} %)`).join(", ")}`);
  if (fehler.length) z.push(`Häufige Fehler: ${fehler.map((e) => `${e.label} (${e.count}×)`).join(", ")}`);
  return z.join("\n");
}

export type StartEingabe = {
  studentId: number;
  teacherId: number | null;
  unitId?: number | null;
  fach: string;
  anweisung: string;
  materialIds: number[];
  teile: Teil[];
  /** „Auf den Blättern steht kein Name“ ist bestätigt (lib/kein-name.ts) */
  keinName: boolean;
};

/**
 * Prüft die Eingabe, legt den Lauf an und startet ihn im Hintergrund. Gibt die Id zurück, oder einen Satz für die Lehrkraft.
 * Die Seite des Laufs zeigt, was gerade passiert, und lädt sich neu, bis er fertig ist.
 */
export function starteStoffpaket(e: StartEingabe): { id: number } | { fehler: string } {
  const student = repo.getStudent(e.studentId);
  if (!student) return { fehler: "Diesen Schüler gibt es nicht." };
  const fach = e.fach.trim();
  if (!fach) return { fehler: "Bitte ein Fach wählen." };
  const ids = [...new Set(e.materialIds)];
  if (ids.length > MAX_DATEIEN) return { fehler: `Höchstens ${MAX_DATEIEN} Fotos oder PDFs auf einmal.` };
  const anweisung = e.anweisung.trim() ? angabeOhneNamen(e.anweisung.slice(0, ANWEISUNG_MAX), student.name) : "";
  if (!ids.length && !anweisung) return { fehler: "Bitte Fotos oder PDFs wählen oder kurz schreiben, um welchen Stoff es geht." };
  if (ids.length && !e.keinName) return { fehler: "Bitte bestätigen, dass auf den Blättern kein Name steht (oder er abgedeckt ist)." };
  for (const id of ids) {
    const m = getMaterial(id);
    if (!m || !hatDatei(m) || m.student_id !== student.id) return { fehler: "Eine Datei gibt es nicht mehr. Bitte noch einmal hochladen." };
  }
  const teile = ALLE_TEILE.filter((t) => e.teile.includes(t));
  if (!teile.length) return { fehler: "Bitte mindestens einen Teil wählen." };
  const geht = stoffpaketMoeglich({ studentId: student.id, dateien: ids.length });
  if (!geht.ok) return { fehler: geht.grund };
  // one run per student at a time: a double tap does not pay twice
  const laeuft = db().prepare("SELECT id FROM stoffpakete WHERE student_id = ? AND status = 'laeuft' AND created_at >= datetime('now', ?)").get(student.id, `-${HAENGT_MIN} minutes`) as { id: number } | undefined;
  if (laeuft) return { id: laeuft.id };
  const unit = e.unitId ? getUnit(e.unitId) : null;
  const id = Number(
    db()
      .prepare("INSERT INTO stoffpakete (student_id, teacher_id, unit_id, status, schritt, fach, anweisung, teile, dateien) VALUES (?, ?, ?, 'laeuft', 'Unterlagen lesen', ?, ?, ?, ?)")
      .run(student.id, e.teacherId, unit && unit.student_id === student.id ? unit.id : null, fach, anweisung, JSON.stringify(teile), JSON.stringify(ids)).lastInsertRowid,
  );
  const job = fuehreAus(id).catch((err) => {
    console.error("[Stoffpaket]", err instanceof Error ? err.message : err);
    setze(id, { status: "fehler", schritt: "", fehler: "Das Erstellen ging nicht. Bitte noch einmal versuchen." });
  });
  laufend.set(id, job);
  void job.finally(() => laufend.delete(id));
  return { id };
}

const laufend = ((globalThis as unknown as { __stoffpaketLaufend?: Map<number, Promise<unknown>> }).__stoffpaketLaufend ??= new Map());
/** Für die Tests: warten, bis ein Lauf fertig ist. */
export const warteAuf = (id: number) => laufend.get(id) ?? Promise.resolve();

function setze(id: number, f: Partial<Record<keyof Row, string | number | null>>) {
  const keys = Object.keys(f);
  if (!keys.length) return;
  db()
    .prepare(`UPDATE stoffpakete SET ${keys.map((k) => `${k} = @${k}`).join(", ")} WHERE id = @id`)
    .run({ ...f, id });
}

/** Die Dateien für die Anfrage; wirft mit einem Satz für die Lehrkraft. */
function teileFuer(ids: number[]): Part[] {
  let gesamt = 0;
  return ids.map((id) => {
    const m = getMaterial(id);
    if (!m || !hatDatei(m)) throw new Error("Eine Datei gibt es nicht mehr. Bitte noch einmal hochladen.");
    let data: Buffer;
    try {
      data = fs.readFileSync(materialFile(m));
    } catch {
      throw new Error("Eine Datei fehlt. Bitte noch einmal hochladen.");
    }
    const type = sniffType(data);
    if (!type) throw new Error("Nur Fotos (JPG, PNG, WebP) und PDF-Dateien sind möglich.");
    const pdf = type.mime === "application/pdf";
    const max = pdf ? MAX_ANALYSIS_PDF_BYTES : MAX_ANALYSIS_IMAGE_BYTES;
    if (data.length > max) throw new Error(`${pdf ? "Ein PDF" : "Ein Foto"} ist zu groß für die KI (höchstens ${max / 1024 / 1024} MB).`);
    gesamt += data.length;
    if (gesamt > MAX_GESAMT_BYTES) throw new Error(`Die Dateien sind zusammen zu groß (höchstens ${MAX_GESAMT_BYTES / 1024 / 1024} MB).`);
    const base64 = data.toString("base64");
    return pdf ? { type: "pdf" as const, base64 } : { type: "image" as const, mime: type.mime as "image/jpeg" | "image/png" | "image/webp", base64 };
  });
}

const BLATT_TITEL: Record<Blatt, string> = { uebung: "Übungsblatt", test: "Test", vorbereitung: "Vorbereitungstest" };

/** Der eigentliche Lauf: Anfrage, Blätter, Lernpaket, Präsentation. Schreibt Fortschritt und Ergebnis in die Zeile. */
async function fuehreAus(id: number): Promise<void> {
  const p = getStoffpaket(id);
  if (!p) return;
  const student = repo.getStudent(p.student_id);
  if (!student) return setze(id, { status: "fehler", schritt: "", fehler: "Diesen Schüler gibt es nicht mehr." });
  let dateien: Part[];
  try {
    dateien = teileFuer(p.dateien);
  } catch (err) {
    return setze(id, { status: "fehler", schritt: "", fehler: err instanceof Error ? err.message : "Die Dateien konnten nicht gelesen werden." });
  }
  const level = checkLevel(student.school_type, student.klasse, student.grade);
  const stufe = student.school_type ? `${klassenLabel(student.school_type, student.klasse)}${level.status === "eindeutig" ? ` (Schulstufe ${level.schulstufe})` : ""}` : "";
  const pruefung = naechstePruefung(student.id, p.fach);
  const faehigkeiten = skillsForPrompt(student, p.fach);
  const auftrag: StoffpaketAuftrag = {
    fach: p.fach,
    stufe,
    anweisung: p.anweisung,
    schueler: schuelerText(student, p.fach),
    fehlermuster: listErkenntnisse(student.id, { subject: p.fach, status: "offen", art: "fehler" }).map((x) => x.text),
    pruefung: pruefung?.text ?? "",
    faehigkeiten: faehigkeiten.map(({ id: sid, name, area }) => ({ id: sid, name, area })),
    teile: p.teile,
    dateien: dateien.length,
  };
  const out = await runAI("stoffpaket", StoffpaketSchema, STOFFPAKET_SYSTEM, [...dateien, { type: "text", text: stoffpaketText(auftrag, bekannteNamen()) }], {
    meta: { teacherId: p.teacher_id, studentId: student.id, unitId: p.unit_id, trigger: "stoffpaket" },
  });
  const calls = out.callId ? [out.callId] : [];
  if (!out.ok) return setze(id, { status: "fehler", schritt: "", fehler: out.message, call_ids: JSON.stringify(calls) });

  const entwurf = stoffpaketAusAntwort(out.data, { fach: p.fach, teile: p.teile, faehigkeiten, schulart: student.school_type, klasse: student.klasse });
  const thema = entwurf.thema || p.fach;
  const first = student.name.split(" ")[0];
  const grade = level.status === "eindeutig" ? level.schulstufe! : (student.grade ?? 5);
  // the test belongs to the next Schularbeit in this subject: then it is a Probeschularbeit with points and grade
  const probe = pruefung && /schularbeit|test|lzk|lernzielkontrolle/i.test(pruefung.test.kind || "") ? pruefung.test : null;
  const ws: Partial<Record<Blatt, number>> = {};
  for (const b of ["uebung", "test", "vorbereitung"] as Blatt[]) {
    const tasks = entwurf.blaetter[b];
    if (!tasks.length) continue;
    const w = repo.createWorksheet(
      {
        title: `${first} – ${BLATT_TITEL[b]}: ${thema}`.slice(0, 120),
        subject: p.fach,
        grade,
        school_type: student.school_type,
        klasse: student.klasse,
        topic: thema.slice(0, 200),
        difficulty: "gemischt",
        task_type: "mixed",
        kind: b === "uebung" ? "uebung" : "ueberpruefung",
        source: "ki",
        skill_ids: [...new Set(tasks.flatMap((t) => [t.skillId, ...(t.skillIds ?? [])]).filter((x): x is string => Boolean(x)))],
        student_id: student.id,
        teacher_id: p.teacher_id,
        status: "entwurf",
        settings: JSON.stringify({ stoffpaket: { id, rolle: b }, useAI: true, ...(b === "test" && probe ? { dauer: 50 } : {}) }),
      },
      tasks,
    );
    if (b === "test" && probe) db().prepare("UPDATE worksheets SET probe_test_id = ? WHERE id = ?").run(probe.id, w);
    ws[b] = w;
  }

  let paketId: number | null = null;
  const weggelassen = [...entwurf.weggelassen];
  // Spielkarten: gespeichert, aber erst mit „Alles übernehmen“ im Spiel (lib/spielkarten.ts)
  let spielkarten = 0;
  if (entwurf.spielkarten) {
    const r = speichereSatz({ studentId: student.id, teacherId: p.teacher_id, titel: thema.slice(0, 80), fach: p.fach, text: entwurf.spielkarten, aktiv: false, skillId: entwurf.skillIds[0] ?? null, stoffpaketId: id });
    if (r.ok) spielkarten = r.id;
    else weggelassen.push(`Spielkarten: ${r.fehler.slice(0, 2).join(" ")}`);
  } else if (p.teile.includes("spielkarten")) weggelassen.push("Spielkarten: Die KI hat keine brauchbaren Karten geliefert.");
  if (entwurf.lernpaket) {
    const r = importiereLernpaket(entwurf.lernpaket, p.teacher_id, { quelle: "ki", kiCallId: out.callId });
    if ("fehler" in r) weggelassen.push(`Ablauf für die Präsentation: ${r.fehler.slice(0, 2).join(" ")}`);
    else paketId = r.id;
  }
  setze(id, {
    thema: thema.slice(0, 200),
    skill_ids: JSON.stringify(entwurf.skillIds),
    lernzettel: entwurf.lernzettel ? JSON.stringify(entwurf.lernzettel) : null,
    uebung_id: ws.uebung ?? null,
    test_id: ws.test ?? null,
    vorbereitung_id: ws.vorbereitung ?? null,
    paket_id: paketId,
    pruefung_id: probe?.id ?? null,
    unsicher: JSON.stringify(entwurf.unsicher),
    weggelassen: JSON.stringify(weggelassen),
    call_ids: JSON.stringify(calls),
  });

  if (paketId && p.teile.includes("praesentation")) {
    setze(id, { schritt: "Präsentation erstellen" });
    const pr = await erstellePraesEntwurf(paketId, p.teacher_id, { auchUngeprueft: true });
    if (pr.ok) {
      const e = getPraesEntwurf(pr.id);
      setze(id, { praes_entwurf_id: pr.id, call_ids: JSON.stringify(e?.call_id ? [...calls, e.call_id] : calls) });
    } else {
      weggelassen.push(`Präsentation: ${pr.error}`);
      setze(id, { weggelassen: JSON.stringify(weggelassen) });
    }
  } else if (p.teile.includes("praesentation") && !paketId) {
    weggelassen.push("Präsentation: Die KI hat keinen brauchbaren Ablauf geliefert.");
    setze(id, { weggelassen: JSON.stringify(weggelassen) });
  }
  const leer = !entwurf.lernzettel && !ws.uebung && !ws.test && !ws.vorbereitung && !paketId && !spielkarten;
  if (leer) return setze(id, { status: "fehler", schritt: "", fehler: "Die KI hat nichts Brauchbares geliefert. Bitte noch einmal versuchen, eventuell mit schärferen Fotos." });
  setze(id, { status: "fertig", schritt: "", fertig_at: new Date().toISOString() });
}

/** Was die KI für diesen Lauf gekostet hat, in US-Dollar (alle Anfragen zusammen). */
export function kostenUsd(p: Pick<Stoffpaket, "call_ids">): number {
  if (!p.call_ids.length) return 0;
  return (db().prepare(`SELECT COALESCE(SUM(cost_usd), 0) AS usd FROM ai_calls WHERE id IN (${p.call_ids.map(() => "?").join(",")})`).get(...p.call_ids) as { usd: number }).usd;
}

/** Die Einheit, für die übernommen wird: die laufende des Schülers, sonst der nächste Termin (Datum), sonst heute. */
export function zielDerUebernahme(p: Pick<Stoffpaket, "student_id">, teacherId: number): { art: "einheit"; unitId: number } | { art: "termin"; datum: string } {
  const unit = runningUnitForStudent(p.student_id);
  if (unit) return { art: "einheit", unitId: unit.id };
  const termin = kommendeTermine(teacherId).find((t) => t.studentId === p.student_id);
  return { art: "termin", datum: termin?.datum ?? wienerDatum() };
}

/**
 * „Alles übernehmen“: das Lernpaket ist geprüft (die Lehrkraft hat die Vorschau gesehen), die Präsentation wird gespeichert
 * und gehört zum Paket, das Paket ist für die laufende Einheit (solange darin noch nichts getan ist) oder den nächsten
 * Termin gewählt, der Lernzettel steht in der Schüler-App. Die Blätter bleiben Entwürfe, bis sie gesendet werden.
 */
export function uebernimmStoffpaket(id: number, teacherId: number): { ok: true; ziel: string } | { fehler: string } {
  const p = getStoffpaket(id);
  if (!p) return { fehler: "Diesen Stoff gibt es nicht mehr." };
  if (p.status === "uebernommen") return { ok: true, ziel: "" };
  if (p.status !== "fertig") return { fehler: "Das ist noch nicht fertig." };
  let ziel = "";
  if (p.paket_id) {
    const paket = getLernpaket(p.paket_id);
    if (paket && paket.status !== "archiviert") {
      if (paket.status !== "geprueft") {
        const g = markiereGeprueft(paket.id, teacherId, { hinweiseGeprueft: true });
        if ("fehler" in g) return g;
      }
      if (p.praes_entwurf_id) {
        const e = getPraesEntwurf(p.praes_entwurf_id);
        if (e?.status === "vorschlag") {
          const r = uebernimmPraesEntwurf(e.id, teacherId);
          if ("fehler" in r) return r;
          markierePraesentationGeprueft(r.praesId, teacherId);
          setze(id, { praesentation_id: r.praesId });
        }
      }
      const z = zielDerUebernahme(p, teacherId);
      if (z.art === "einheit") {
        if (!hatBegonnen(leseStand(z.unitId))) {
          waehlePaket(z.unitId, paket.id);
          ziel = "Der Ablauf steht in der laufenden Einheit bereit.";
        } else ziel = "Die Einheit läuft schon; das Lernpaket steht unter „Anderes Thema“ zur Wahl.";
      } else {
        bereiteVor(p.student_id, z.datum, paket.id, teacherId);
        ziel = z.datum === wienerDatum() ? "Der Ablauf steht für die nächste Einheit bereit." : `Der Ablauf steht für die Einheit am ${Number(z.datum.slice(8, 10))}.${Number(z.datum.slice(5, 7))}. bereit.`;
      }
    }
  }
  // die Spielkarten kommen ins Spiel: „Dein Stoff“ und Blockwerk in der Schüler-App
  for (const s of spielkartenVon(id)) setzeAktiv(s.id, true);
  setze(id, { status: "uebernommen", uebernommen_at: new Date().toISOString() });
  return { ok: true, ziel };
}

/** „Verwerfen“: Blätter ohne Zuweisung werden gelöscht, das Lernpaket archiviert, die Präsentation verworfen. */
export function verwirfStoffpaket(id: number): boolean {
  const p = getStoffpaket(id);
  if (!p || p.status === "laeuft" || p.status === "verworfen") return false;
  for (const w of [p.uebung_id, p.test_id, p.vorbereitung_id]) {
    if (w && !repo.listAssignmentsForWorksheet(w).length && repo.getWorksheet(w)?.status === "entwurf") repo.deleteWorksheet(w);
  }
  for (const s of spielkartenVon(id)) {
    if (p.status === "uebernommen") setzeAktiv(s.id, false);
    else loescheSatz(s.id);
  }
  if (p.status !== "uebernommen") {
    if (p.praes_entwurf_id) verwirfPraesEntwurf(p.praes_entwurf_id);
    if (p.paket_id) archiviereLernpaket(p.paket_id);
  }
  setze(id, { status: "verworfen" });
  return true;
}

/** Die Blätter eines Stoffpakets in der Reihenfolge der Vorschau, mit Id (null = nicht erstellt). */
export function blaetterVon(p: Stoffpaket): { blatt: Blatt; titel: string; id: number | null; verlangt: boolean; anzahl: number }[] {
  return (["vorbereitung", "uebung", "test"] as Blatt[]).map((b) => {
    const wid = b === "uebung" ? p.uebung_id : b === "test" ? p.test_id : p.vorbereitung_id;
    return { blatt: b, titel: TEILE[b], id: wid && repo.getWorksheet(wid) ? wid : null, verlangt: p.teile.includes(b), anzahl: wid ? repo.listTasks(wid).length : 0 };
  });
}

export { ANZAHL, TEILE, ALLE_TEILE, type Teil };

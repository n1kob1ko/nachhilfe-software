/**
 * Das **Cockpit** einer laufenden Einheit (niko, 2026-10-22: „die KI bereitet vor und dokumentiert, der Lehrer
 * unterrichtet“): welches Lernpaket heute dran ist, der Schritt auf dem Schirm, was erledigt und was
 * übersprungen ist und die Notizen des Lehrers je Schritt. Ohne Lernpaket steht dort die Fähigkeit der
 * Einheit. Alles hier ohne KI.
 *
 * Das Paket selbst ändert sich nie: Reihenfolge, Erledigt und Übersprungen gelten nur für diese Einheit
 * (Tabelle `einheit_cockpit`, eine Zeile je Einheit). So zeigt ein zweites Gerät oder ein Neuladen denselben
 * Stand. Beim Beenden kommen nur Tatsachen in die Dokumentation: welche Schritte erledigt, übersprungen oder
 * nicht erreicht wurden (`dokumentiereAblauf`). Der Lernstand bleibt unberührt.
 *
 * Notizen und Inhalt des Pakets bleiben beim Lehrer. Zum Schüler kommen nur die Aufgaben, die der Lehrer
 * mit „Übung senden“ schickt, ohne die Prüfhinweise des Pakets (`data.pruefen`).
 */
import { checkTask } from "./builder";
import { difficultyFor } from "./curriculum";
import { db, json } from "./db";
import { autoFelderVon } from "./einschaetzung";
import { getLernpaket, getSchritt, type LernpaketMitSchritten, type LernpaketSchritt, type PaketQuelle } from "./lernpakete";
import { wienerDatum } from "./planung/zeit";
import { nextSteps } from "./recommend";
import * as repo from "./repo";
import { schulstufe } from "./school";
import { analyzeStudent, buildWorksheet } from "./service";
import type { TaskDraft } from "./tasks";
import { getUnit } from "./units";
import { autoFuerEinheit, vorschlagErlauben, type Passung, type Signal } from "./vorbereitung-auto";

/** Höchstlänge einer Notiz je Schritt. */
export const NOTIZ_MAX = 2000;

export type Stand = {
  unit_id: number;
  paket_id: number | null;
  /** ohne Lernpaket: die Fähigkeit, um die es heute geht */
  skill_id: string | null;
  /** Schritt-Ids in der Reihenfolge dieser Einheit; leer = die des Pakets */
  reihenfolge: number[];
  /** der Schritt auf dem Schirm; null = der erste offene */
  aktuell: number | null;
  erledigt: number[];
  uebersprungen: number[];
  /** Notiz des Lehrers je Schritt-Id */
  notizen: Record<string, string>;
  /** gesendete Übungen je Schritt-Id */
  gesendet: Record<string, number[]>;
  /** noch nicht gespeichert, aus „Einheit vorbereiten“ übernommen */
  vorbereitet: boolean;
  /** noch nicht gespeichert: der Vorschlag der App (lib/vorbereitung-auto.ts), nicht die Wahl des Lehrers */
  automatisch: { warum: string; passung: Passung; luecke: Signal | null } | null;
  updated_at: string | null;
};

const leer = (unitId: number): Stand => ({ unit_id: unitId, paket_id: null, skill_id: null, reihenfolge: [], aktuell: null, erledigt: [], uebersprungen: [], notizen: {}, gesendet: {}, vorbereitet: false, automatisch: null, updated_at: null });

// ---------- the rules, without the database ----------

/**
 * Die Reihenfolge der Schritte in dieser Einheit: die gespeicherte, soweit es die Schritte noch gibt, dann
 * die übrigen in der Reihenfolge des Pakets (etwa ein Schritt, der während der Einheit dazukam).
 */
export function ablauf(schritte: Pick<LernpaketSchritt, "id">[], reihenfolge: number[]): number[] {
  const da = new Set(schritte.map((s) => s.id));
  const vorne = [...new Set(reihenfolge)].filter((id) => da.has(id));
  const gesetzt = new Set(vorne);
  return [...vorne, ...schritte.map((s) => s.id).filter((id) => !gesetzt.has(id))];
}

const istOffen = (s: Pick<Stand, "erledigt" | "uebersprungen">, id: number) => !s.erledigt.includes(id) && !s.uebersprungen.includes(id);

/** Der Schritt auf dem Schirm: der gewählte, sonst der erste offene; null, wenn alle durch sind. */
export function aktuellerSchritt(order: number[], s: Pick<Stand, "aktuell" | "erledigt" | "uebersprungen">): number | null {
  if (s.aktuell !== null && order.includes(s.aktuell)) return s.aktuell;
  return order.find((id) => istOffen(s, id)) ?? null;
}

/** Der nächste offene Schritt nach `id`, sonst der erste offene davor; null, wenn keiner mehr offen ist. */
function naechsterOffener(order: number[], s: Pick<Stand, "erledigt" | "uebersprungen">, id: number): number | null {
  const i = order.indexOf(id);
  const danach = [...order.slice(i + 1), ...order.slice(0, Math.max(0, i))];
  return danach.find((x) => istOffen(s, x)) ?? null;
}

export type Markierung = "erledigt" | "uebersprungen" | "offen";

/**
 * „Erledigt / Weiter“ und „Überspringen“: der Schritt wird markiert und der nächste offene kommt auf den
 * Schirm. „offen“ nimmt die Markierung zurück und zeigt den Schritt wieder.
 */
export function markiere<S extends Pick<Stand, "aktuell" | "erledigt" | "uebersprungen">>(s: S, order: number[], id: number, was: Markierung): S {
  const erledigt = s.erledigt.filter((x) => x !== id);
  const uebersprungen = s.uebersprungen.filter((x) => x !== id);
  if (was === "erledigt") erledigt.push(id);
  if (was === "uebersprungen") uebersprungen.push(id);
  const neu = { ...s, erledigt, uebersprungen };
  return { ...neu, aktuell: was === "offen" ? id : naechsterOffener(order, neu, id) };
}

/** Einen Schritt für diese Einheit nach vorne (-1) oder hinten (+1) schieben. */
export function verschiebe(order: number[], id: number, richtung: -1 | 1): number[] {
  const i = order.indexOf(id);
  const j = i + richtung;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const neu = [...order];
  [neu[i], neu[j]] = [neu[j], neu[i]];
  return neu;
}

export type Zusammenfassung<T> = { erledigt: T[]; uebersprungen: T[]; nichtErreicht: T[] };

/** Was aus dem Paket in dieser Einheit geschah, in der Reihenfolge der Einheit. */
export function zusammenfassung<T extends { id: number }>(schritte: T[], order: number[], s: Pick<Stand, "erledigt" | "uebersprungen">): Zusammenfassung<T> {
  const byId = new Map(schritte.map((x) => [x.id, x]));
  const liste = order.map((id) => byId.get(id)).filter((x): x is T => Boolean(x));
  return {
    erledigt: liste.filter((x) => s.erledigt.includes(x.id)),
    uebersprungen: liste.filter((x) => s.uebersprungen.includes(x.id)),
    nichtErreicht: liste.filter((x) => istOffen(s, x.id)),
  };
}

export type DokuTexte = { gemacht: string; wiederholen: string | null; naechstesMal: string | null };

/** Anfang der Zeilen, die das Cockpit in die Dokumentation schreibt (zum Ersetzen beim zweiten Mal). */
const ZEILE = { gemacht: "Lernpaket „", wiederholen: "Übersprungen in „", naechstesMal: "Weiter mit „" } as const;

/**
 * Die Sätze für die Dokumentation, nur aus dem, was der Lehrer getippt hat. Ohne erledigten oder
 * übersprungenen Schritt null: dann wurde das Cockpit nicht benutzt, und „nicht erreicht“ wäre geraten.
 */
export function dokuTexte(titel: string, z: Zusammenfassung<{ titel: string }>): DokuTexte | null {
  if (!z.erledigt.length && !z.uebersprungen.length) return null;
  const gesamt = z.erledigt.length + z.uebersprungen.length + z.nichtErreicht.length;
  const namen = (xs: { titel: string }[]) => xs.map((x) => x.titel).join(", ");
  const teile = [`${ZEILE.gemacht}${titel}“: ${z.erledigt.length} von ${gesamt} Schritten erledigt${z.erledigt.length ? ` (${namen(z.erledigt)})` : ""}.`];
  if (z.uebersprungen.length) teile.push(`Übersprungen: ${namen(z.uebersprungen)}.`);
  if (z.nichtErreicht.length) teile.push(`Nicht erreicht: ${namen(z.nichtErreicht)}.`);
  return {
    gemacht: teile.join(" "),
    wiederholen: z.uebersprungen.length ? `${ZEILE.wiederholen}${titel}“: ${namen(z.uebersprungen)}` : null,
    naechstesMal: z.nichtErreicht.length ? `${ZEILE.naechstesMal}${titel}“: ${namen(z.nichtErreicht)}` : null,
  };
}

/** Ersetzt die Zeile des Cockpits in einem Feld (oder hängt sie an); `neu` null entfernt sie. */
export function mitZeile(text: string, anfang: string, neu: string | null): string {
  const zeilen = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((z) => !z.startsWith(anfang));
  return [...zeilen, ...(neu ? [neu] : [])].filter((z) => z.trim()).join("\n");
}

// ---------- reading and writing ----------

type Row = { unit_id: number; paket_id: number | null; skill_id: string | null; reihenfolge: string; aktuell: number | null; erledigt: string; uebersprungen: string; notizen: string; gesendet: string; updated_at: string };

const zuStand = (r: Row): Stand => ({
  unit_id: r.unit_id,
  paket_id: r.paket_id,
  skill_id: r.skill_id,
  reihenfolge: json<number[]>(r.reihenfolge, []),
  aktuell: r.aktuell,
  erledigt: json<number[]>(r.erledigt, []),
  uebersprungen: json<number[]>(r.uebersprungen, []),
  notizen: json<Record<string, string>>(r.notizen, {}),
  gesendet: json<Record<string, number[]>>(r.gesendet, {}),
  vorbereitet: false,
  automatisch: null,
  updated_at: r.updated_at,
});

function gespeichert(unitId: number): Stand | null {
  const r = db().prepare("SELECT * FROM einheit_cockpit WHERE unit_id = ?").get(unitId) as Row | undefined;
  return r ? zuStand(r) : null;
}

/** Der Tag einer Einheit in Wien, für „Einheit vorbereiten“. */
const tagDerEinheit = (startedAt: string) => wienerDatum(new Date(startedAt));

/**
 * Der Stand des Cockpits einer Einheit. Ist noch nichts gespeichert, gilt das Lernpaket aus „Einheit
 * vorbereiten“ für diesen Schüler und Tag (noch ungespeichert, `vorbereitet`); hat der Lehrer keines gewählt,
 * der Vorschlag der App für die laufende Einheit (`automatisch`, lib/vorbereitung-auto.ts, ohne KI).
 */
export function leseStand(unitId: number): Stand {
  const s = gespeichert(unitId);
  if (s) return s;
  const unit = getUnit(unitId);
  const v = unit ? vorbereitung(unit.student_id, tagDerEinheit(unit.started_at)) : null;
  if (v && getLernpaket(v.paket_id)) return { ...leer(unitId), paket_id: v.paket_id, vorbereitet: true };
  const a = unit ? autoFuerEinheit(unit) : null;
  if (a?.art === "paket") return { ...leer(unitId), paket_id: a.paket.id, vorbereitet: true, automatisch: { warum: a.warum, passung: a.passung, luecke: a.luecke } };
  return leer(unitId);
}

function speichere(s: Stand) {
  db()
    .prepare(
      `INSERT INTO einheit_cockpit (unit_id, paket_id, skill_id, reihenfolge, aktuell, erledigt, uebersprungen, notizen, gesendet, updated_at)
       VALUES (@unit_id, @paket_id, @skill_id, @reihenfolge, @aktuell, @erledigt, @uebersprungen, @notizen, @gesendet, datetime('now'))
       ON CONFLICT(unit_id) DO UPDATE SET paket_id = excluded.paket_id, skill_id = excluded.skill_id, reihenfolge = excluded.reihenfolge, aktuell = excluded.aktuell,
         erledigt = excluded.erledigt, uebersprungen = excluded.uebersprungen, notizen = excluded.notizen, gesendet = excluded.gesendet, updated_at = excluded.updated_at`,
    )
    .run({
      unit_id: s.unit_id,
      paket_id: s.paket_id,
      skill_id: s.skill_id,
      reihenfolge: JSON.stringify(s.reihenfolge),
      aktuell: s.aktuell,
      erledigt: JSON.stringify(s.erledigt),
      uebersprungen: JSON.stringify(s.uebersprungen),
      notizen: JSON.stringify(s.notizen),
      gesendet: JSON.stringify(s.gesendet),
    });
}

/** Lesen, ändern, speichern in einem Zug (zwei Geräte zugleich überschreiben einander nicht halb). */
function aendere(unitId: number, f: (s: Stand) => Stand): Stand {
  const conn = db();
  let neu = leer(unitId);
  conn.transaction(() => {
    neu = f(leseStand(unitId));
    speichere(neu);
  })();
  return neu;
}

export type CockpitDaten = {
  stand: Stand;
  paket: LernpaketMitSchritten | null;
  /** die Schritte in der Reihenfolge dieser Einheit */
  schritte: LernpaketSchritt[];
  /** der Schritt auf dem Schirm; null = alle durch (oder kein Paket) */
  aktuell: LernpaketSchritt | null;
  /** Minute, ab der ein Schritt geplant ist, je Schritt-Id */
  ab: Map<number, number>;
};

/** Alles, was die Seite für das Cockpit braucht. */
export function cockpit(unitId: number): CockpitDaten {
  const stand = leseStand(unitId);
  const paket = stand.paket_id ? getLernpaket(stand.paket_id) : null;
  if (!paket) return { stand, paket: null, schritte: [], aktuell: null, ab: new Map() };
  const order = ablauf(paket.schritte, stand.reihenfolge);
  const byId = new Map(paket.schritte.map((s) => [s.id, s]));
  const schritte = order.map((id) => byId.get(id)!);
  const ab = new Map<number, number>();
  schritte.reduce((min, s) => (ab.set(s.id, min), min + s.minuten), 0);
  const id = aktuellerSchritt(order, stand);
  return { stand, paket, schritte, aktuell: id === null ? null : byId.get(id)!, ab };
}

/** Ein Lernpaket für die Einheit wählen (null: ohne Lernpaket). Ein anderes Paket fängt von vorne an. */
export function waehlePaket(unitId: number, paketId: number | null): { ok: true } | { fehler: string } {
  const p = paketId ? getLernpaket(paketId) : null;
  if (paketId && (!p || p.status === "archiviert")) return { fehler: "Dieses Lernpaket gibt es nicht mehr." };
  if (p && !p.schritte.length) return { fehler: "Dieses Lernpaket hat noch keine Schritte." };
  aendere(unitId, (s) => (s.paket_id === paketId && !s.vorbereitet ? s : { ...s, paket_id: paketId, reihenfolge: [], aktuell: null, erledigt: [], uebersprungen: [] }));
  return { ok: true };
}

/** Ohne Lernpaket: die Fähigkeit, um die es heute geht. */
export function waehleFaehigkeit(unitId: number, skillId: string | null): { ok: true } | { fehler: string } {
  if (skillId && !repo.getSkill(skillId)) return { fehler: "Diese Fähigkeit gibt es nicht." };
  aendere(unitId, (s) => ({ ...s, paket_id: null, skill_id: skillId, reihenfolge: [], aktuell: null, erledigt: [], uebersprungen: [] }));
  return { ok: true };
}

/** Prüft, dass der Schritt zum Paket der Einheit gehört, und gibt die Reihenfolge mit. */
function mitSchritt(unitId: number, schrittId: number, f: (s: Stand, order: number[]) => Stand): boolean {
  const s = leseStand(unitId);
  const p = s.paket_id ? getLernpaket(s.paket_id) : null;
  if (!p || !p.schritte.some((x) => x.id === schrittId)) return false;
  aendere(unitId, (cur) => f(cur, ablauf(p.schritte, cur.reihenfolge)));
  return true;
}

export const markiereSchritt = (unitId: number, schrittId: number, was: Markierung) => mitSchritt(unitId, schrittId, (s, order) => markiere(s, order, schrittId, was));

export const zeigeSchritt = (unitId: number, schrittId: number) => mitSchritt(unitId, schrittId, (s) => ({ ...s, aktuell: schrittId }));

export const verschiebeSchritt = (unitId: number, schrittId: number, richtung: -1 | 1) =>
  mitSchritt(unitId, schrittId, (s, order) => ({ ...s, reihenfolge: verschiebe(order, schrittId, richtung) }));

export function setzeNotiz(unitId: number, schrittId: number, text: string): boolean {
  const t = text.replace(/\r\n/g, "\n").trim().slice(0, NOTIZ_MAX);
  return mitSchritt(unitId, schrittId, (s) => {
    const notizen = { ...s.notizen };
    if (t) notizen[schrittId] = t;
    else delete notizen[schrittId];
    return { ...s, notizen };
  });
}

// ---------- sending the tasks of a step ----------

/**
 * Woher die Aufgaben eines Pakets stammen (`tasks.source_type`); das Paket speichert es nicht je Aufgabe.
 * Ein importiertes Paket hat keine geprüfte Quelle mit Lizenz: es zählt als „importiert“ (lib/library.ts).
 */
export const HERKUNFT: Record<PaketQuelle, string> = { hand: "eigen", ki: "ki", import: "importiert" };

/** Eine Aufgabe des Pakets, wie sie zum Schüler geht: ohne Prüfhinweise, mit Herkunft. */
export function aufgabeFuerSchueler(a: TaskDraft, quelle: PaketQuelle): TaskDraft {
  const { pruefen: _p, ...data } = a.data;
  void _p;
  const { sourceId: _i, ...rest } = a;
  void _i;
  return { ...rest, data, sourceType: HERKUNFT[quelle] };
}

/**
 * „Übung senden“: die Aufgaben eines Schritts als Übung an den Schüler **dieser** Einheit, auch wenn der
 * Lehrer zwei Einheiten zugleich hat. Gibt Übung und Zuweisung zurück; aufs Gerät bringt sie die Aktion.
 */
export function sendeSchritt(unitId: number, schrittId: number, teacherId: number | null): { worksheetId: number; assignmentId: number } | { fehler: string } {
  const unit = getUnit(unitId);
  if (!unit || unit.status !== "gestartet") return { fehler: "Diese Einheit läuft nicht mehr." };
  const s = leseStand(unitId);
  const schritt = getSchritt(schrittId);
  const p = s.paket_id ? getLernpaket(s.paket_id) : null;
  if (!p || !schritt || schritt.paket_id !== p.id) return { fehler: "Dieser Schritt gehört nicht zum Lernpaket der Einheit." };
  if (!schritt.aufgaben.length) return { fehler: "Dieser Schritt hat keine Aufgaben." };
  const tasks = schritt.aufgaben.map((a) => aufgabeFuerSchueler(a, p.quelle));
  for (const [i, t] of tasks.entries()) {
    const problem = checkTask(t);
    if (problem) return { fehler: `Aufgabe ${i + 1}: ${problem}` };
  }
  const student = repo.getStudent(unit.student_id);
  if (!student) return { fehler: "Schüler nicht gefunden." };
  const typen = [...new Set(tasks.map((t) => t.type))];
  const conn = db();
  let worksheetId = 0;
  let assignmentId = 0;
  conn.transaction(() => {
    worksheetId = repo.createWorksheet(
      {
        title: `${student.name.split(" ")[0]} – ${p.title}: ${schritt.titel}`.slice(0, 160),
        subject: p.fach,
        grade: student.klasse ? schulstufe(student.school_type, student.klasse) : student.grade,
        school_type: student.school_type,
        klasse: student.klasse,
        topic: p.thema || p.title,
        difficulty: p.schwierigkeit,
        task_type: typen.length === 1 ? typen[0] : "mixed",
        kind: schritt.art === "kontrolle" ? "ueberpruefung" : "uebung",
        source: p.quelle === "ki" ? "ki" : "manuell",
        skill_ids: [...new Set(tasks.flatMap((t) => [t.skillId, ...(t.skillIds ?? [])]).filter((x): x is string => Boolean(x)))],
        student_id: student.id,
        teacher_id: teacherId,
        status: "freigegeben",
      },
      tasks,
    );
    assignmentId = repo.assignWorksheet(worksheetId, student.id, "", unit.id);
  })();
  aendere(unitId, (cur) => ({ ...cur, gesendet: { ...cur.gesendet, [schrittId]: [...(cur.gesendet[schrittId] ?? []), worksheetId] } }));
  return { worksheetId, assignmentId };
}

// ---------- documentation when the unit ends ----------

/**
 * Schreibt beim Beenden, was mit dem Lernpaket geschah: „Was gemacht“ bekommt erledigte, übersprungene und
 * nicht erreichte Schritte, „Wiederholen“ die übersprungenen, „Nächstes Lernziel“ die nicht erreichten.
 * Nur in leere oder noch automatische Felder; was der Lehrer geschrieben hat, bleibt. Ein zweiter Lauf
 * ersetzt die eigenen Zeilen, statt sie zu verdoppeln.
 */
export function dokumentiereAblauf(lessonId: number, unitId: number): DokuTexte | null {
  const s = gespeichert(unitId);
  const p = s?.paket_id ? getLernpaket(s.paket_id) : null;
  const lesson = repo.getLesson(lessonId);
  if (!s || !p || !lesson) return null;
  const t = dokuTexte(p.title, zusammenfassung(p.schritte, ablauf(p.schritte, s.reihenfolge), s));
  if (!t) return null;
  const auto = autoFelderVon(lesson);
  const werte = json<Record<string, unknown>>(lesson.auto_felder, {});
  const neu: Partial<Record<"activities" | "review_topics" | "next_steps", string>> = {};
  const setze = (feld: "activities" | "review_topics" | "next_steps", anfang: string, zeile: string | null) => {
    const bisher = lesson[feld] ?? "";
    if (bisher.trim() && !auto.has(feld)) return;
    const wert = mitZeile(bisher, anfang, zeile);
    neu[feld] = wert;
    if (wert.trim()) werte[feld] = wert;
    else delete werte[feld];
  };
  setze("activities", ZEILE.gemacht, t.gemacht);
  setze("review_topics", ZEILE.wiederholen, t.wiederholen);
  setze("next_steps", ZEILE.naechstesMal, t.naechstesMal);
  if (!Object.keys(neu).length) return t;
  repo.saveLesson({ ...lesson, ...neu }, lesson.id);
  db().prepare("UPDATE lessons SET auto_felder = ? WHERE id = ?").run(JSON.stringify(werte), lesson.id);
  return t;
}

// ---------- „Einheit vorbereiten“ ----------

export type Vorbereitung = { student_id: number; datum: string; paket_id: number; teacher_id: number | null; created_at: string };

export function vorbereitung(studentId: number, datum: string): Vorbereitung | null {
  return (db().prepare("SELECT * FROM einheit_vorbereitung WHERE student_id = ? AND datum = ?").get(studentId, datum) as Vorbereitung | undefined) ?? null;
}

/** Das Lernpaket für die Einheit eines Schülers an einem Tag (null nimmt die Wahl zurück). */
export function bereiteVor(studentId: number, datum: string, paketId: number | null, teacherId: number | null): { ok: true } | { fehler: string } {
  if (paketId === null) {
    db().prepare("DELETE FROM einheit_vorbereitung WHERE student_id = ? AND datum = ?").run(studentId, datum);
    return { ok: true };
  }
  const p = getLernpaket(paketId);
  if (!p || p.status === "archiviert") return { fehler: "Dieses Lernpaket gibt es nicht mehr." };
  if (!p.schritte.length) return { fehler: "Dieses Lernpaket hat noch keine Schritte." };
  db()
    .prepare(
      `INSERT INTO einheit_vorbereitung (student_id, datum, paket_id, teacher_id) VALUES (?, ?, ?, ?)
       ON CONFLICT(student_id, datum) DO UPDATE SET paket_id = excluded.paket_id, teacher_id = excluded.teacher_id, created_at = datetime('now')`,
    )
    .run(studentId, datum, paketId, teacherId);
  // chosen by hand: a removed suggestion no longer counts for this day
  vorschlagErlauben(studentId, datum);
  return { ok: true };
}

// ---------- without a package: new tasks from the generators ----------

/**
 * Ohne Lernpaket: eine neue Übung zur Fähigkeit aus den eingebauten Generatoren und Aufgabenbanken (nie die
 * KI), an den Schüler dieser Einheit. Wie viele und wie schwer, sagt die Empfehlung, sonst der Lernstand.
 */
export async function sendeAusGenerator(unitId: number, skillId: string, teacherId: number | null): Promise<{ worksheetId: number; assignmentId: number } | { fehler: string }> {
  const unit = getUnit(unitId);
  if (!unit || unit.status !== "gestartet") return { fehler: "Diese Einheit läuft nicht mehr." };
  const student = repo.getStudent(unit.student_id);
  const skill = repo.getSkill(skillId);
  if (!student || !skill) return { fehler: "Diese Fähigkeit gibt es nicht." };
  const empfehlung = nextSteps(student.id, { today: wienerDatum(), limit: Infinity }).find((s) => s.skill.id === skill.id);
  const mastery = analyzeStudent(student.id)?.skills.find((s) => s.skill.id === skill.id)?.mastery ?? null;
  let worksheetId = 0;
  try {
    worksheetId = (
      await buildWorksheet({
        subject: skill.subject,
        schoolType: student.school_type,
        klasse: student.klasse ?? 1,
        skillIds: [skill.id],
        difficulty: empfehlung?.difficulty ?? difficultyFor(mastery),
        count: empfehlung?.count ?? 8,
        taskType: "mixed",
        kind: empfehlung?.kind ?? "uebung",
        title: `${student.name.split(" ")[0]} – ${skill.area} › ${skill.name}`,
        useAI: false,
        teacherId,
        studentId: student.id,
      })
    ).id;
  } catch (e) {
    return { fehler: e instanceof Error ? e.message : "Die Übung konnte nicht erstellt werden." };
  }
  if (!repo.listTasks(worksheetId).length) {
    repo.deleteWorksheet(worksheetId);
    return { fehler: "Für diese Fähigkeit gibt es keine Aufgaben ohne KI. Bitte im Builder erstellen." };
  }
  return { worksheetId, assignmentId: repo.assignWorksheet(worksheetId, student.id, "", unit.id) };
}

/**
 * **Neue Aufgaben der KI mit Vorschau** (D2, KI-Budget je Einheit; niko: „Darunter erstellt die KI fehlende Aufgaben ohne Extra-Klick.“
 * „Es dürfen keine unkontrollierten Kosten entstehen.“). Wo Bestand und Generator nichts haben, fehlen Aufgaben:
 * - in einem Schritt des Plans, wenn ohne KI weniger als drei passende Aufgaben bleiben (Regel aus B0: nur Aufgaben der Fähigkeit
 *   des Schritts, lib/material-passt.ts);
 * - in der Anpassung im Unterricht (lib/steuerung.ts), wenn nur „Neue passende Aufgabe erstellen“ (C) übrig ist;
 * - im Live-Status unter „KI-Hinweis“ („Passende Aufgaben erstellen“), nur auf Tippen (D3).
 *
 * Ist für die Einheit ein Betrag gesetzt (lib/ai/einheit-budget.ts) und bleiben Kosten, laufende Anfragen und die Schätzung darunter,
 * fragt die App die KI ohne Tippen, über denselben Weg wie „Neue passende Aufgabe erstellen“ (`generateWithAI`, Funktion
 * `neue_aufgabe`), höchstens einmal je Schritt und Runde bzw. je Vorschlag. Darf sie nicht (0 €, Budget erreicht, KI aus, manueller
 * Modus, Monatsbudget, Grenze des Schülers), bleibt es beim Tippen mit Kosten und dem Grund.
 *
 * Die neuen Aufgaben gehen nie ungesehen zum Schüler: sie liegen als „neu erstellt, ungeprüft“ in `einheit_ki_aufgaben` und stehen als
 * Vorschau mit Lösung im Unterricht. Erst „Senden“ schickt genau diese Aufgaben. Aufgaben, die die App zum Prüfen markiert, und
 * Aufgaben einer anderen Fähigkeit fallen vorher weg.
 */
import { automatischFrei, einheitBudget, type EinheitBudget } from "./ai/einheit-budget";
import { budget } from "./ai/config";
import { generateWithAI } from "./ai/features";
import { kiGrund, kiGrundText, protokolliere } from "./ai/grund";
import { latestInsight } from "./ai/insights";
import { ohneAusgeblendete } from "./bewertungen";
import { aufgabenOhneKi, cockpit, leseStand, planHatUebung, sendeAusGenerator, type CockpitDaten, type PlanStep } from "./cockpit";
import { DIFFICULTIES, levelOf } from "./curriculum";
import { db, json } from "./db";
import { oberfaehigkeit, passtZurFaehigkeit } from "./material-passt";
import * as repo from "./repo";
import { klassenLabel, schulstufe } from "./school";
import { kiTor, kostenNeueAufgabeUsd, sendeKiAufgaben, vorschlagDerEinheit, type Anzeige } from "./steuerung";
import type { Art, KiTor, Option } from "./steuerung-regeln";
import type { TaskDraft } from "./tasks";
import { getUnit } from "./units";

/** Im Vorschlag: so viele wie „Neue passende Aufgabe erstellen“ auf Tippen. */
export const ANZAHL_VORSCHLAG = 2;
/** Im Schritt: bis drei; weniger passende Aufgaben ohne KI sind zu wenig (B0). */
export const ANZAHL_SCHRITT = 3;

/**
 * `art`: „schritt“ im Planschritt, „live“ aus dem KI-Hinweis im Live-Status, „empfehlung“ und „diagnose“ ohne Einheit
 * (lib/ki-vorschau.ts, dann mit `blatt`), sonst die Art des Vorschlags.
 */
export type NachschubZiel = { art: Art | "schritt" | "live" | "empfehlung" | "diagnose"; skillId: string; level: number; fokus: string | null; kontrolle: boolean; anzahl: number; blatt?: VorschauBlatt };
/**
 * Ohne Einheit: wie die Übung aussieht, die „Senden“ anlegt (Titel, Art, Notiz der Zuweisung), und in welcher Reihenfolge die Aufgaben
 * stehen (`reihenfolge`: Stellen in [...dazu, ...aufgaben]; ohne sie erst die ohne KI, dann die neuen).
 */
export type VorschauBlatt = {
  titel: string;
  subject: string;
  schoolType: string;
  klasse: number;
  topic: string;
  difficulty: string;
  taskType: string;
  kind: repo.Worksheet["kind"];
  skillIds: string[];
  notiz: string;
  /** die Übung gehört dem Schüler (wie eine Diagnose), sonst wie eine Empfehlung bisher */
  fuerSchueler: boolean;
  reihenfolge?: number[];
};
export type NachschubStatus = "laeuft" | "bereit" | "gesendet" | "verworfen" | "fehler";
export type Nachschub = {
  id: number;
  /** null: ohne Einheit (Empfehlung, Diagnose), dann mit `studentId` */
  unitId: number | null;
  studentId: number | null;
  schluessel: string;
  schrittId: number | null;
  ziel: NachschubZiel;
  automatisch: boolean;
  status: NachschubStatus;
  /** die neuen Aufgaben der KI */
  aufgaben: TaskDraft[];
  /** die Aufgaben ohne KI, die mitgehen (im Schritt, wenn es schon eine oder zwei gab) */
  dazu: TaskDraft[];
  /** warum es nicht ging (status „fehler“) */
  problem: string;
  callId: number | null;
  worksheetId: number | null;
  createdAt: string;
};

type Row = { id: number; unit_id: number | null; student_id: number | null; schluessel: string; schritt_id: number | null; ziel: string; automatisch: number; status: NachschubStatus; aufgaben: string; dazu: string; fehler: string; call_id: number | null; worksheet_id: number | null; created_at: string };

const zeile = (r: Row): Nachschub => ({
  id: r.id,
  unitId: r.unit_id,
  studentId: r.student_id ?? null,
  schluessel: r.schluessel,
  schrittId: r.schritt_id,
  ziel: json<NachschubZiel>(r.ziel, { art: "schritt", skillId: "", level: 3, fokus: null, kontrolle: false, anzahl: ANZAHL_SCHRITT }),
  automatisch: r.automatisch === 1,
  status: r.status,
  aufgaben: json<TaskDraft[]>(r.aufgaben, []),
  dazu: json<TaskDraft[]>(r.dazu, []),
  // a short reason only (lib/ai/grund.ts), also for rows stored before with the provider's own text
  problem: r.status === "fehler" ? kiGrundText(r.fehler) : r.fehler,
  callId: r.call_id,
  worksheetId: r.worksheet_id,
  createdAt: r.created_at,
});

export function nachschub(id: number): Nachschub | null {
  const r = db().prepare("SELECT * FROM einheit_ki_aufgaben WHERE id = ?").get(id) as Row | undefined;
  return r ? zeile(r) : null;
}

/** Der neueste Eintrag zu diesem Schlüssel in der Einheit, oder null. */
export function nachschubZu(unitId: number, schluessel: string): Nachschub | null {
  const r = db().prepare("SELECT * FROM einheit_ki_aufgaben WHERE unit_id = ? AND schluessel = ? ORDER BY id DESC LIMIT 1").get(unitId, schluessel) as Row | undefined;
  return r ? zeile(r) : null;
}

export function nachschubDerEinheit(unitId: number): Nachschub[] {
  return (db().prepare("SELECT * FROM einheit_ki_aufgaben WHERE unit_id = ? ORDER BY id").all(unitId) as Row[]).map(zeile);
}

/** Wofür: ein Schritt in seiner Runde (wie oft aus ihm schon gesendet wurde), ein Vorschlag seit der letzten Reaktion. */
export const schluesselSchritt = (schrittId: number, skillId: string, runde: number) => `schritt:${schrittId}:${skillId}:${runde}`;
export const schluesselVorschlag = (bis: number, o: Pick<Option, "art" | "skillId" | "level">) => `vorschlag:${bis}:${o.art}:${o.skillId}:${o.level}`;
/** Aus dem Live-Status einer je Einheit: solange eine Vorschau offen ist, kommt sie wieder, statt neu zu fragen. */
export const SCHLUESSEL_LIVE = "live";

/**
 * Die Aufgaben der Vorschau in der Reihenfolge, in der „Senden“ sie schickt; `neu` = von der KI. Im Unterricht erst die ohne KI, dann
 * die neuen; ohne Einheit wie in `blatt.reihenfolge` (eine Diagnose: leicht zuerst).
 */
export function vorschauAufgaben(n: Pick<Nachschub, "dazu" | "aufgaben" | "ziel">): { t: TaskDraft; neu: boolean }[] {
  const alle = [...n.dazu.map((t) => ({ t, neu: false })), ...n.aufgaben.map((t) => ({ t, neu: true }))];
  const r = n.ziel.blatt?.reihenfolge;
  const ganz = r && r.length === alle.length && new Set(r).size === r.length && r.every((i) => Number.isInteger(i) && i >= 0 && i < alle.length);
  return ganz ? r.map((i) => alle[i]) : alle;
}

// ---------- Kosten ----------

/** Was eine Anfrage für `anzahl` Aufgaben etwa kostet, in US-Dollar (die Schätzung für zwei Aufgaben, mehr anteilig). */
export const schaetzungUsd = (anzahl: number) => kostenNeueAufgabeUsd() * Math.max(1, anzahl / 2);

/** „ca. 2 Cent“ für `anzahl` Aufgaben; im manuellen Modus oder mit lokalem Modell sagt es `kiTor`. */
function kostenText(tor: KiTor, anzahl: number): string | null {
  if (!tor.erlaubt) return null;
  const usd = schaetzungUsd(anzahl);
  return usd > 0 ? `ca. ${Math.max(1, Math.round((usd / budget().usdPerEur) * 100))} Cent` : tor.kosten;
}

// what runs right now counts against the unit's budget until it is logged
const shared = globalThis as unknown as { __kiNachschub?: { reserviert: Map<number, number> } };
const reserviert = (shared.__kiNachschub ??= { reserviert: new Map() }).reserviert;
const reserve = (unitId: number, usd: number) => {
  const v = (reserviert.get(unitId) ?? 0) + usd;
  if (v > 1e-12) reserviert.set(unitId, v);
  else reserviert.delete(unitId);
};

export type NachschubTor = { ki: KiTor; automatisch: { erlaubt: true } | { erlaubt: false; grund: string } };

/** Darf die KI für diese Einheit neue Aufgaben machen: auf Tippen (`ki`, lib/steuerung.ts kiTor) und von selbst (`automatisch`, im Budget)? */
export function nachschubTor(unitId: number, studentId: number, anzahl: number): NachschubTor {
  const ki = kiTor(studentId);
  return { ki, automatisch: ki.erlaubt ? automatischFrei(unitId, schaetzungUsd(anzahl), reserviert.get(unitId) ?? 0) : { erlaubt: false, grund: ki.grund } };
}

// ---------- wo Aufgaben fehlen ----------

export type NachschubBedarf = { schluessel: string; schrittId: number | null; ziel: NachschubZiel; dazu: TaskDraft[] };

/**
 * Fehlen in diesem Planschritt Aufgaben? Nur bei einem Schritt, der seine Übung aus dem Generator baut (kein Paket, kein Bestand,
 * kein Schreibauftrag) und ohne KI weniger als drei passende Aufgaben bekommt. Dann fehlen so viele bis drei.
 */
export function bedarfImSchritt(unitId: number, c: CockpitDaten, s: PlanStep, student: repo.Student): NachschubBedarf | null {
  if (c.paket || !s.skillId) return null;
  const ohne = aufgabenOhneKi(unitId, s, c.planQuellen, student);
  if (!ohne || ohne.aufgaben.length >= ANZAHL_SCHRITT) return null;
  const runde = c.stand.gesendet[s.id]?.length ?? 0;
  return {
    schluessel: schluesselSchritt(s.id, s.skillId, runde),
    schrittId: s.id,
    ziel: { art: "schritt", skillId: s.skillId, level: levelOf(ohne.difficulty), fokus: null, kontrolle: s.art === "kontrolle", anzahl: ANZAHL_SCHRITT - ohne.aufgaben.length },
    dazu: ohne.aufgaben,
  };
}

/**
 * Im Vorschlag der Anpassung im Unterricht: „Neue passende Aufgabe erstellen“ (C), weil A und B nichts haben. `bis`: die letzte Reaktion
 * (`steuerung.bis`), danach gilt ein neuer Vorschlag; `schrittId`: der Schritt auf dem Schirm.
 */
export function bedarfImVorschlag(bis: number, schrittId: number | null, v: Pick<Anzeige, "andere"> | null): NachschubBedarf | null {
  const k = v?.andere.find((x) => x.quelle === "C");
  return k ? bedarfAusOption(bis, schrittId, k.option) : null;
}

/**
 * Derselbe Bedarf aus einer Möglichkeit, wie sie der Knopf „Neue passende Aufgabe erstellen“ (C) schickt: auf Tippen geht sie
 * denselben Weg wie von selbst, über die Vorschau (niko: nichts von der KI geht ungeprüft an den Schüler).
 */
export function bedarfAusOption(bis: number, schrittId: number | null, o: Option): NachschubBedarf | null {
  if (!o.skillId || !o.level) return null;
  return { schluessel: schluesselVorschlag(bis, o), schrittId, ziel: { art: o.art, skillId: o.skillId, level: o.level, fokus: o.fokus, kontrolle: false, anzahl: ANZAHL_VORSCHLAG }, dazu: [] };
}

/**
 * Wo die App jetzt von selbst fragen würde: der Vorschlag mit C, der Schritt auf dem Schirm (solange aus ihm nichts gesendet ist) und
 * der nächste offene Schritt mit Übung, wie die bereite Übung (lib/cockpit.ts haltBereit). Nie weiter voraus.
 */
export function automatischeZiele(unitId: number, c: CockpitDaten, student: repo.Student): NachschubBedarf[] {
  const out: NachschubBedarf[] = [];
  const v = bedarfImVorschlag(c.stand.steuerung.bis, c.paket ? (c.aktuell?.id ?? null) : (c.planAktuell?.id ?? null), vorschlagDerEinheit(unitId, c));
  if (v) out.push(v);
  const jetzt = !c.paket ? c.planAktuell : null;
  if (jetzt) {
    if (!c.stand.gesendet[jetzt.id]?.length) {
      const b = bedarfImSchritt(unitId, c, jetzt, student);
      if (b) out.push(b);
    }
    const offen = (s: PlanStep) => !c.stand.erledigt.includes(s.id) && !c.stand.uebersprungen.includes(s.id) && !c.verschoben.has(s.id);
    const naechster = c.plan.slice(c.plan.indexOf(jetzt) + 1).find((s) => offen(s) && planHatUebung(s, c.planQuellen));
    const b = naechster ? bedarfImSchritt(unitId, c, naechster, student) : null;
    if (b) out.push(b);
  }
  return out;
}

/**
 * Im Live-Status (Details › KI-Hinweis, „Passende Aufgaben erstellen“): zwei Aufgaben zu dem, was die KI zuletzt sah (Fähigkeit,
 * Schwierigkeit, Fehlerbild), sonst zur Fähigkeit und Stufe der letzten Antwort. Wie bisher (lib/ai/realtime.ts), nur jetzt über die
 * Vorschau statt gleich zum Schüler (niko: nichts von der KI geht ungeprüft an den Schüler).
 */
export function bedarfImLiveHinweis(unitId: number): NachschubBedarf | { fehler: string } {
  const unit = getUnit(unitId);
  if (!unit || unit.status !== "gestartet") return { fehler: "Diese Einheit läuft nicht mehr." };
  const last = db().prepare("SELECT task_id FROM attempts WHERE unit_id = ? ORDER BY id DESC LIMIT 1").pluck().get(unitId) as number | undefined;
  const task = last ? repo.getTask(last) : null;
  const live = latestInsight(unitId, "echtzeit");
  const block = latestInsight(unitId, "block");
  const ref = [live, block].filter((x) => x !== null).sort((a, b) => b!.id - a!.id)[0] ?? null;
  const skillId = ref?.data.next_skill ?? task?.skillId ?? null;
  if (!skillId || !repo.getSkill(skillId)) return { fehler: "In dieser Einheit wurde noch keine Aufgabe gelöst." };
  const level = Math.max(1, Math.min(5, (task?.level ?? levelOf(task?.difficulty)) + (ref?.data.difficulty_adjustment ?? 0)));
  const fokus = live && live.id === ref?.id ? live.data.misconception : null;
  return { schluessel: SCHLUESSEL_LIVE, schrittId: null, ziel: { art: "live", skillId, level, fokus, kontrolle: false, anzahl: ANZAHL_VORSCHLAG }, dazu: [] };
}

// ---------- erstellen ----------

/**
 * Neue Aufgaben der KI für einen Bedarf, auf Tippen (`automatisch` false) oder von selbst (nur im Budget der Einheit, nur einmal je
 * Schlüssel). Läuft schon eine Anfrage oder liegt eine Vorschau bereit, kommt sie zurück, ohne neu zu fragen. Die Antwort wird geprüft
 * (Fähigkeit, „Bitte prüfen“, schlecht bewertet) und als Vorschau gespeichert; nichts geht an den Schüler.
 */
export async function erstelleNachschub(unitId: number, b: NachschubBedarf, o: { automatisch: boolean; teacherId: number | null }): Promise<Nachschub | { fehler: string }> {
  const unit = getUnit(unitId);
  if (!unit || unit.status !== "gestartet") return { fehler: "Diese Einheit läuft nicht mehr." };
  const student = repo.getStudent(unit.student_id);
  const skill = repo.getSkill(b.ziel.skillId);
  if (!student || !skill || !(b.ziel.level >= 1 && b.ziel.level <= 5) || !(b.ziel.anzahl >= 1 && b.ziel.anzahl <= ANZAHL_SCHRITT)) return { fehler: "Diese Fähigkeit gibt es nicht." };
  const schon = nachschubZu(unitId, b.schluessel);
  if (schon && (schon.status === "laeuft" || schon.status === "bereit")) return schon;
  // von selbst nie zweimal für dasselbe: nach einem Fehler oder „Verwerfen“ bleibt es beim Tippen
  if (o.automatisch && schon) return { fehler: "Dafür hat die App schon einmal selbst gefragt." };
  const tor = nachschubTor(unitId, student.id, b.ziel.anzahl);
  if (!tor.ki.erlaubt) return { fehler: tor.ki.grund };
  if (o.automatisch && !tor.automatisch.erlaubt) return { fehler: tor.automatisch.grund };
  // check and insert without waiting in between: a second request for the same need finds this row
  const schaetzung = schaetzungUsd(b.ziel.anzahl);
  const id = Number(
    db()
      .prepare("INSERT INTO einheit_ki_aufgaben (unit_id, schluessel, schritt_id, ziel, automatisch, status, dazu, teacher_id) VALUES (?, ?, ?, ?, ?, 'laeuft', ?, ?)")
      .run(unitId, b.schluessel, b.schrittId, JSON.stringify(b.ziel), o.automatisch ? 1 : 0, JSON.stringify(b.dazu), o.teacherId).lastInsertRowid,
  );
  reserve(unitId, schaetzung);
  try {
    const vorher = db().prepare("SELECT COALESCE(MAX(id), 0) FROM ai_calls").pluck().get() as number;
    const difficulty = DIFFICULTIES[b.ziel.level - 1];
    const used = (db().prepare("SELECT t.prompt FROM tasks t JOIN assignments a ON a.worksheet_id = t.worksheet_id WHERE a.unit_id = ?").all(unitId) as { prompt: string }[]).map((u) => u.prompt);
    let tasks: TaskDraft[] | null = null;
    let problem = "";
    try {
      const { contextForAI, studentContext, wortartenSetting } = await import("./builder");
      const ctx = studentContext(student.id);
      tasks = await generateWithAI(
        {
          subject: skill.subject,
          level: klassenLabel(student.school_type, student.klasse),
          skills: [{ id: skill.id, name: skill.name, area: skill.area, difficulty }],
          count: b.ziel.anzahl,
          categories: [],
          studentContext: ctx ? contextForAI(ctx, [skill.id]) : null,
          focusNote: b.ziel.fokus ? `Gezielt üben: ${b.ziel.fokus}` : b.ziel.kontrolle ? "Kurze Lernkontrolle: ein Versuch, ohne Hilfen." : undefined,
          avoid: [...used, ...b.dazu.map((t) => t.prompt)],
          wortarten: wortartenSetting([skill.id], student.school_type, student.klasse ?? 1, ctx),
        },
        { teacherId: o.teacherId, unitId, trigger: o.automatisch ? "nachschub_automatisch" : "nachschub" },
        "neue_aufgabe",
      );
    } catch (e) {
      protokolliere("Neue Aufgaben im Schritt", e);
      problem = kiGrund(e);
    }
    const call = db().prepare("SELECT id FROM ai_calls WHERE id > ? AND fn = 'neue_aufgabe' AND unit_id = ? ORDER BY id DESC LIMIT 1").pluck().get(vorher, unitId) as number | undefined;
    const gut = ohneAusgeblendete((tasks ?? []).map((t) => (t.skillId ? t : { ...t, skillId: skill.id }))).filter((t) => !t.data.pruefen?.length && passtZurFaehigkeit(t, skill.id, oberfaehigkeit));
    if (gut.length)
      db().prepare("UPDATE einheit_ki_aufgaben SET status = 'bereit', aufgaben = ?, call_id = ? WHERE id = ?").run(JSON.stringify(gut.slice(0, b.ziel.anzahl)), call ?? null, id);
    else db().prepare("UPDATE einheit_ki_aufgaben SET status = 'fehler', fehler = ?, call_id = ? WHERE id = ?").run((problem || "Die KI hat keine passenden Aufgaben geliefert.").slice(0, 300), call ?? null, id);
  } finally {
    reserve(unitId, -schaetzung);
  }
  return nachschub(id)!;
}

/**
 * Von selbst, nach dem Zeigen des Unterrichts (components/cockpit/Ablauf.tsx, `after`): für jeden Bedarf eine Anfrage, nacheinander, jede
 * mit neuer Prüfung des Budgets. Bei 0 € (Standard) fragt nichts, wie bisher. Gibt die Zahl der neu gestellten Anfragen zurück.
 */
export async function nachschubAutomatisch(unitId: number): Promise<number> {
  const unit = getUnit(unitId);
  if (!unit || unit.status !== "gestartet" || !einheitBudget(unitId).automatisch) return 0;
  const student = repo.getStudent(unit.student_id);
  if (!student) return 0;
  let n = 0;
  for (const b of automatischeZiele(unitId, cockpit(unitId, { mitPlan: true }), student)) {
    const vorher = nachschubZu(unitId, b.schluessel);
    if (vorher) continue;
    const r = await erstelleNachschub(unitId, b, { automatisch: true, teacherId: unit.teacher_id });
    if (!("fehler" in r)) n++;
  }
  return n;
}

// ---------- senden, verwerfen ----------

/**
 * „Senden“ in der Vorschau: genau diese Aufgaben an den Schüler dieser Einheit, im Schritt wie „Passende Übungen senden“ (Plan
 * festhalten, beim Schritt merken, Lernkontrolle als Test), im Vorschlag wie „Leichtere Aufgabe senden“ (danach zählen nur neue Antworten).
 */
export async function sendeNachschub(unitId: number, id: number, teacherId: number | null): Promise<{ worksheetId: number; assignmentId: number } | { fehler: string }> {
  const n = nachschub(id);
  const art = n?.ziel.art;
  // ohne Einheit (Empfehlung, Diagnose) sendet lib/ki-vorschau.ts
  if (!n || n.unitId !== unitId || art === "empfehlung" || art === "diagnose" || !art) return { fehler: "Diese Aufgaben gehören nicht zu dieser Einheit." };
  if (n.status !== "bereit") return { fehler: n.status === "gesendet" ? "Diese Aufgaben sind schon gesendet." : "Diese Aufgaben gibt es nicht mehr." };
  // a double tap sends once
  if (!db().prepare("UPDATE einheit_ki_aufgaben SET status = 'gesendet' WHERE id = ? AND status = 'bereit'").run(id).changes) return { fehler: "Diese Aufgaben sind schon gesendet." };
  const aufgaben = [...n.dazu, ...n.aufgaben];
  const out =
    art === "schritt"
      ? await sendeAusGenerator(unitId, n.ziel.skillId, teacherId, n.schrittId, "senden", aufgaben)
      : art === "live"
        ? sendeLive(unitId, n, teacherId)
        : sendeKiAufgaben(unitId, { art, skillId: n.ziel.skillId, level: n.ziel.level, fokus: n.ziel.fokus }, teacherId, aufgaben);
  if ("fehler" in out) {
    db().prepare("UPDATE einheit_ki_aufgaben SET status = 'bereit' WHERE id = ?").run(id);
    return out;
  }
  db().prepare("UPDATE einheit_ki_aufgaben SET worksheet_id = ? WHERE id = ?").run(out.worksheetId, id);
  return { worksheetId: out.worksheetId, assignmentId: out.assignmentId };
}

/** Aus dem Live-Status: eine kleine Übung „… · Nachschub“ wie bisher, jetzt erst nach dem Blick der Lehrkraft. */
function sendeLive(unitId: number, n: Nachschub, teacherId: number | null): { worksheetId: number; assignmentId: number } | { fehler: string } {
  const unit = getUnit(unitId);
  if (!unit || unit.status !== "gestartet") return { fehler: "Diese Einheit läuft nicht mehr." };
  const student = repo.getStudent(unit.student_id);
  const skill = repo.getSkill(n.ziel.skillId);
  if (!student || !skill) return { fehler: "Diese Fähigkeit gibt es nicht." };
  let worksheetId = 0;
  let assignmentId = 0;
  db().transaction(() => {
    worksheetId = repo.createWorksheet(
      {
        title: `${skill.area}: ${skill.name} · Nachschub`,
        subject: skill.subject,
        grade: schulstufe(student.school_type, student.klasse ?? 1),
        school_type: student.school_type,
        klasse: student.klasse,
        topic: skill.area,
        difficulty: DIFFICULTIES[n.ziel.level - 1],
        task_type: "mixed",
        kind: "uebung",
        source: "ki",
        skill_ids: [skill.id],
        student_id: student.id,
        teacher_id: teacherId,
        status: "freigegeben",
      },
      n.aufgaben,
    );
    assignmentId = repo.assignWorksheet(worksheetId, student.id, "", unit.id);
  })();
  return { worksheetId, assignmentId };
}

/** „Verwerfen“: die Vorschau weg; die App fragt dafür nicht noch einmal von selbst, auf Tippen schon. */
export function verwirfNachschub(unitId: number, id: number): boolean {
  return db().prepare("UPDATE einheit_ki_aufgaben SET status = 'verworfen' WHERE id = ? AND unit_id = ? AND status IN ('bereit', 'fehler')").run(id, unitId).changes > 0;
}

// ---------- was der Unterricht zeigt ----------

export type NachschubAnzeige = {
  bedarf: NachschubBedarf;
  /** der neueste Eintrag dazu: läuft, bereit (Vorschau) oder vorbei */
  eintrag: Nachschub | null;
  tor: NachschubTor;
  /** „ca. 2 Cent“ auf dem Knopf zum Tippen; null, wenn die KI nicht darf */
  kosten: string | null;
  /** der Grund unter dem Knopf: KI gesperrt, Budget der Einheit erreicht, oder warum es von selbst nicht ging */
  hinweis: string | null;
  budget: EinheitBudget;
  /** noch nichts gefragt, aber die App fragt gleich von selbst (nach dem Zeigen der Seite, `nachschubAutomatisch`) */
  gleich: boolean;
};

/** `vonSelbst`: ob `automatischeZiele` diesen Bedarf von selbst nimmt (im Schritt nur, solange aus ihm nichts gesendet ist). */
export function nachschubAnzeige(unitId: number, b: NachschubBedarf, studentId: number, vonSelbst = true): NachschubAnzeige {
  const eintrag = nachschubZu(unitId, b.schluessel);
  const tor = nachschubTor(unitId, studentId, b.ziel.anzahl);
  const bu = einheitBudget(unitId);
  const hinweis = !tor.ki.erlaubt
    ? tor.ki.grund
    : eintrag?.status === "fehler"
      ? `Ging gerade nicht: ${eintrag.problem}`
      : bu.automatisch && !tor.automatisch.erlaubt
        ? `${tor.automatisch.grund}. Neue Aufgaben nur auf Tippen.`
        : null;
  return { bedarf: b, eintrag, tor, kosten: kostenText(tor.ki, b.ziel.anzahl), hinweis, budget: bu, gleich: vonSelbst && !eintrag && bu.automatisch && tor.automatisch.erlaubt };
}

/** Für die Karte eines Planschritts (components/cockpit/Ablauf.tsx): null, wenn ohne KI genug Aufgaben da sind. */
export function nachschubImSchritt(unitId: number, c: CockpitDaten, s: PlanStep, student: repo.Student): NachschubAnzeige | null {
  const b = bedarfImSchritt(unitId, c, s, student);
  return b ? nachschubAnzeige(unitId, b, student.id, !c.stand.gesendet[s.id]?.length) : null;
}

/**
 * Für den KI-Hinweis im Live-Status (components/device/LiveStatus.tsx): Kosten, Vorschau und Grund wie im Schritt; null, solange in der
 * Einheit nichts gelöst ist. Nur auf Tippen, darum ohne den Satz zum Budget der Einheit.
 */
export function nachschubImLiveHinweis(unitId: number): NachschubAnzeige | null {
  const unit = getUnit(unitId);
  const b = bedarfImLiveHinweis(unitId);
  if (!unit || "fehler" in b) return null;
  const a = nachschubAnzeige(unitId, b, unit.student_id, false);
  return { ...a, hinweis: !a.tor.ki.erlaubt ? a.tor.ki.grund : a.eintrag?.status === "fehler" ? `Ging gerade nicht: ${a.eintrag.problem}` : null };
}

/** Für den Vorschlag der Anpassung im Unterricht (components/cockpit/Steuerung.tsx): der Bedarf zu C, wenn es ihn gibt. */
export function nachschubImVorschlag(unitId: number, schrittId: number | null, v: Pick<Anzeige, "andere">): NachschubAnzeige | null {
  const unit = getUnit(unitId);
  const b = unit ? bedarfImVorschlag(leseStand(unitId).steuerung.bis, schrittId, v) : null;
  return b && unit ? nachschubAnzeige(unitId, b, unit.student_id) : null;
}

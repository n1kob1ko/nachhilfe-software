/**
 * **Hausübung zurück** (E2, niko: „Wenn sie bearbeitet wird, sollen die Ergebnisse wieder in den Lernstand und die nächste
 * Unterrichtsvorbereitung einfließen.“ „Lernstand und Bewertungen müssen auf überprüfbaren Ergebnissen beruhen.“ „Die Software darf
 * keine Leistungen oder Fortschritte erfinden.“). Kein zweites System: gelesen wird, was ohnehin gespeichert ist.
 *
 * - Eine Hausübung mit Übung (`homework.assignment_id`, so legt „Hausübung freigeben“ sie an, lib/hausuebung.ts) bekommt ihre
 *   Antworten an genau dieser Zuweisung: am Gerät im Schülerportal wie jede Übung, auf Papier über „Arbeit fotografieren“
 *   (lib/papier-einheit.ts, gegen die Original-Aufgaben, `papier_arbeiten.homework_id`). Antworten, die auf die Lehrkraft warten
 *   (`review = 'offen'`), zählen nirgends, bis sie bewertet sind (lib/zu-bewerten.ts, Chip „Hausübung“).
 * - Stand je Hausübung (`hausuebungStatus`): offen, abgegeben (n von m bearbeitet), bewertet (x von y richtig, teilweise halb) oder
 *   nicht abgegeben (nach der Fälligkeit, nichts da). „Nicht abgegeben“ ist nie falsch und kommt nie in den Lernstand: es gibt dann
 *   keine Antwort, also nichts zu zählen.
 * - Für die nächste Einheit (`hausuebungFuerEinheit`): die zuletzt gegebene Hausübung, die noch nicht besprochen ist. Heute-Karte und
 *   Unterricht zeigen sie in einer Zeile (`briefingZeile`), der Plan bekommt vorne „Hausübung besprechen“ (lib/stundenplan.ts), und
 *   Themen, die in der Hausübung noch schwierig waren, kommen wie andere geprüfte Ergebnisse nach vorne (`hausuebungSignale`).
 * - Im Abschluss der nächsten Einheit (`abschlussZeilen`): „Hausübung vom 28.10.: 6 von 9 richtig (bewertet)“ oder „nicht
 *   abgegeben“; „besser“ nur, wenn es für dieselbe Fähigkeit vorher (in der Einheit, in der sie gegeben wurde) und nachher (in der
 *   Hausübung) ein geprüftes Ergebnis gibt.
 */
import { db, json } from "./db";
import { tagAddieren, wienerDatum } from "./planung/zeit";
import * as repo from "./repo";
import type { Signal } from "./vorbereitung-auto";

/** Ein gespeicherter Zeitpunkt in ms: SQLite „YYYY-MM-DD HH:MM:SS“ ist UTC ohne Zone, sonst ISO (wie lib/analysis.ts `parseTime`). */
const zeit = (s: string) => (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s) ? Date.parse(`${s.replace(" ", "T")}Z`) : Date.parse(s));

// ---------- Regeln ----------

export type HuStatus = "offen" | "abgegeben" | "bewertet" | "nicht_abgegeben";
export const HU_STATUS_LABEL: Record<HuStatus, string> = { offen: "offen", abgegeben: "abgegeben", bewertet: "bewertet", nicht_abgegeben: "nicht abgegeben" };

/** Wie eine Aufgabe der Hausübung steht: ohne Antwort, wartet auf die Lehrkraft, oder geprüft. */
export type HuBewertung = "unbearbeitet" | "offen" | "richtig" | "teilweise" | "falsch";
/** Unter so viel richtig (Anteil, teilweise halb) ist ein Thema der Hausübung „noch schwierig“ (wie im Vorschlag, lib/hausuebung.ts). */
export const SCHWIERIG_UNTER = 0.5;
/** So viele Aufgaben macht „Hausübung nicht abgegeben“ gemeinsam. */
export const ZUSAMMEN = 3;
/** Eine Hausübung, die länger her ist, kommt nicht mehr in die Vorbereitung. */
export const HU_ALTER_TAGE = 45;

export type HuZahlen = {
  /** Aufgaben der Hausübung */
  aufgaben: number;
  /** davon mit einer abgeschlossenen Antwort (auch die, die noch auf die Lehrkraft warten) */
  bearbeitet: number;
  /** davon geprüft (richtig, teilweise, falsch) */
  bewertet: number;
  richtig: number;
  teilweise: number;
  /** warten auf die Lehrkraft (Zu bewerten) */
  offen: number;
};

/** Zählt die Bewertungen der Aufgaben. */
export function zahlen(xs: HuBewertung[]): HuZahlen {
  const n = (b: HuBewertung) => xs.filter((x) => x === b).length;
  return { aufgaben: xs.length, bearbeitet: xs.filter((x) => x !== "unbearbeitet").length, bewertet: n("richtig") + n("teilweise") + n("falsch"), richtig: n("richtig"), teilweise: n("teilweise"), offen: n("offen") };
}

/** Richtig mit teilweise halb: 6 richtig und 1 teilweise = 6,5. */
export const punkte = (z: Pick<HuZahlen, "richtig" | "teilweise">) => z.richtig + z.teilweise / 2;
/** „6“, „6,5“ */
export const zahl = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1).replace(".", ","));

/**
 * Der Stand einer Hausübung am Tag `stichtag` (Wiener Datum). `zumUnterricht`: für die Einheit an diesem Tag, dann ist eine heute
 * fällige Hausübung ohne Antwort schon „nicht abgegeben“ (sie war bis zur Stunde zu machen); sonst erst am Tag danach.
 * - nichts bearbeitet: abgegeben, wenn die Lehrkraft sie abgehakt hat (nichts eingelesen); nach der Fälligkeit nicht abgegeben;
 *   sonst offen. Ohne Fälligkeit nie „nicht abgegeben“.
 * - etwas bearbeitet: bewertet, wenn nichts mehr auf die Lehrkraft wartet und alles bearbeitet ist (oder die Übung fertig, abgehakt
 *   oder die Fälligkeit vorbei ist); sonst abgegeben.
 */
export function hausuebungStatus(
  z: Pick<HuZahlen, "aufgaben" | "bearbeitet" | "offen">,
  o: { faellig: string | null; stichtag: string; zumUnterricht?: boolean; abgehakt?: boolean; fertig?: boolean },
): HuStatus {
  const vorbei = Boolean(o.faellig) && (o.stichtag > o.faellig! || (Boolean(o.zumUnterricht) && o.stichtag >= o.faellig!));
  if (!z.bearbeitet) return o.abgehakt ? "abgegeben" : vorbei ? "nicht_abgegeben" : "offen";
  if (!z.offen && (z.bearbeitet >= z.aufgaben || o.fertig || o.abgehakt || vorbei)) return "bewertet";
  return "abgegeben";
}

/** Wie ein Thema in der Hausübung lief, nur aus geprüften Antworten. */
export type HuThema = { skillId: string; name: string; von: number; punkte: number; stand: "schwierig" | "teilweise" | "gut" };

/** Je Fähigkeit: so viele geprüft, so viel richtig (teilweise halb); schwierig unter der Hälfte, gut ab zwei und alle richtig. */
export function themenAus(xs: { skillId: string | null; bewertung: HuBewertung }[], name: (id: string) => string): HuThema[] {
  const ids = [...new Set(xs.map((x) => x.skillId).filter((x): x is string => Boolean(x)))];
  return ids.flatMap((id) => {
    const z = zahlen(xs.filter((x) => x.skillId === id).map((x) => x.bewertung));
    if (!z.bewertet) return [];
    const p = punkte(z);
    const stand = p / z.bewertet < SCHWIERIG_UNTER ? "schwierig" : p === z.bewertet && z.bewertet >= 2 ? "gut" : "teilweise";
    return [{ skillId: id, name: name(id), von: z.bewertet, punkte: p, stand }];
  });
}

/** Ob ein geprüftes Ergebnis besser ist als ein früheres zur selben Fähigkeit: nur, wenn es beide gibt. */
export function besser(vorher: { punkte: number; von: number } | null, nachher: { punkte: number; von: number } | null): boolean {
  if (!vorher?.von || !nachher?.von) return false;
  return nachher.punkte / nachher.von > vorher.punkte / vorher.von;
}

// ---------- Texte ----------

const WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
/** „28.10.“ */
export const tagKurz = (d: string) => `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}.`;
/** „Di 4.11.“ */
export const tagMitWochentag = (d: string) => `${WT[new Date(`${d.slice(0, 10)}T12:00:00Z`).getUTCDay()]} ${tagKurz(d)}`;
const antworten = (n: number) => `${n} ${n === 1 ? "Antwort" : "Antworten"}`;

/** Was zum Stand dazugehört: „fällig Di 4.11.“, „5 von 9 bearbeitet, 2 Antworten zu bewerten“, „6,5 von 9 richtig“; leer, wenn nichts. */
export function statusDetail(e: Pick<HuErgebnis, "status" | "faellig"> & HuZahlen): string {
  switch (e.status) {
    case "offen":
      return e.faellig ? `fällig ${tagMitWochentag(e.faellig)}` : "";
    case "nicht_abgegeben":
      return e.faellig ? `war fällig ${tagMitWochentag(e.faellig)}` : "";
    case "abgegeben":
      if (!e.bearbeitet) return "nichts eingelesen";
      return `${e.bearbeitet} von ${e.aufgaben} bearbeitet${e.offen ? `, ${antworten(e.offen)} zu bewerten` : ""}`;
    case "bewertet":
      return `${zahl(punkte(e))} von ${e.bewertet} richtig${e.bearbeitet < e.aufgaben ? `, ${e.bearbeitet} von ${e.aufgaben} bearbeitet` : ""}`;
  }
}

/** Der Stand in Worten: „offen, fällig Di 4.11.“, „abgegeben (5 von 9 bearbeitet)“, „bewertet (6,5 von 9 richtig)“, „nicht abgegeben“. */
export function statusText(e: Pick<HuErgebnis, "status" | "faellig"> & HuZahlen): string {
  const d = statusDetail(e);
  if (!d || e.status === "nicht_abgegeben") return HU_STATUS_LABEL[e.status];
  return e.status === "offen" ? `offen, ${d}` : `${HU_STATUS_LABEL[e.status]} (${d})`;
}

const schwierigNamen = (e: Pick<HuErgebnis, "themen">) => e.themen.filter((t) => t.stand === "schwierig").map((t) => t.name);

/**
 * Die Zeile für Heute-Karte und Unterricht: „Hausübung: 6 von 9 richtig · Past Simple Questions noch schwierig“. Nur geprüfte
 * Antworten zählen; was noch wartet, steht als „zu bewerten“ da.
 */
export function briefingZeile(e: HuErgebnis): string {
  const schwierig = schwierigNamen(e);
  const teile: string[] = [];
  if (e.status === "offen") teile.push(e.faellig ? `noch offen, fällig ${tagMitWochentag(e.faellig)}` : "noch offen");
  else if (e.status === "nicht_abgegeben") teile.push(`nicht abgegeben${e.faellig ? ` (fällig ${tagMitWochentag(e.faellig)})` : ""}`);
  else if (!e.bearbeitet) teile.push("abgegeben, noch nicht eingelesen");
  else {
    if (e.status === "abgegeben") teile.push(`${e.bearbeitet} von ${e.aufgaben} bearbeitet`);
    if (e.bewertet) teile.push(`${e.status === "abgegeben" ? "bisher " : ""}${zahl(punkte(e))} von ${e.bewertet} richtig`);
    if (e.offen) teile.push(`${antworten(e.offen)} zu bewerten`);
  }
  if (schwierig.length) teile.push(`${schwierig.join(", ")} noch schwierig`);
  return `Hausübung: ${teile.join(" · ")}`;
}

/** Woher die Zeile kommt: „Hausübung vom 28.10., am Gerät“ / „auf Papier“ / „am Gerät und auf Papier“. */
export function quelleText(e: Pick<HuErgebnis, "gegeben" | "geraet" | "papier">): string {
  const wo = e.geraet && e.papier ? "am Gerät und auf Papier" : e.papier ? "auf Papier, von dir geprüft" : e.geraet ? "am Gerät" : "";
  return `Hausübung${e.gegeben ? ` vom ${tagKurz(e.gegeben)}` : ""}${wo ? `, ${wo}` : ""}`;
}

/**
 * Die Zeilen für den Abschluss der nächsten Einheit: `zeile` unter „Heute gemacht“ („Hausübung vom 28.10.: 6 von 9 richtig
 * (bewertet)“, „…: nicht abgegeben“), `schwierig` unter „Noch schwierig“, `besser` nur mit geprüftem Ergebnis vorher und nachher.
 * Eine noch offene Hausübung (nicht fällig, nichts da) sagt nichts.
 */
export function abschlussZeilen(e: HuErgebnis, vorher: Map<string, { punkte: number; von: number }> = new Map()): { zeile: string; schwierig: string[]; besser: string[] } | null {
  if (e.status === "offen") return null;
  const kopf = `Hausübung${e.gegeben ? ` vom ${tagKurz(e.gegeben)}` : ""}`;
  const text =
    e.status === "nicht_abgegeben"
      ? "nicht abgegeben"
      : e.status === "bewertet"
        ? `${zahl(punkte(e))} von ${e.bewertet} richtig (bewertet)`
        : !e.bearbeitet
          ? "abgegeben, nicht eingelesen"
          : `${e.bearbeitet} von ${e.aufgaben} bearbeitet${e.bewertet ? `, bisher ${zahl(punkte(e))} von ${e.bewertet} richtig` : ""}${e.offen ? `, ${antworten(e.offen)} zu bewerten` : ""}`;
  const schwierig = e.themen.filter((t) => t.stand === "schwierig").map((t) => `${kopf}: ${t.name} ${zahl(t.punkte)} von ${t.von} richtig`);
  const besserZeilen = e.themen.flatMap((t) => {
    const v = vorher.get(t.skillId) ?? null;
    return v && besser(v, t) ? [`${t.name} besser als in der Einheit${e.gegeben ? ` vom ${tagKurz(e.gegeben)}` : ""}: ${zahl(t.punkte)} von ${t.von} richtig (vorher ${zahl(v.punkte)} von ${v.von})`] : [];
  });
  return { zeile: `${kopf}: ${text}`, schwierig, besser: besserZeilen };
}

// ---------- aus der Datenbank ----------

/** Eine Aufgabe der Hausübung mit ihrer Bewertung; `nr` wie auf dem Blatt. */
export type HuAufgabeStand = { taskId: number; nr: string; skillId: string | null; bewertung: HuBewertung; attemptId: number | null; antwort: string | null };

export type HuErgebnis = HuZahlen & {
  homeworkId: number;
  studentId: number;
  fach: string;
  /** die Einheit, in deren Abschluss sie freigegeben wurde; null = von Hand eingetragen */
  unitId: number | null;
  assignmentId: number;
  worksheetId: number;
  /** wann gegeben (Wiener Datum): der Tag der Einheit, sonst der Tag der Zuweisung */
  gegeben: string | null;
  /** wann zugewiesen (wie gespeichert, UTC) */
  zugewiesen: string;
  faellig: string | null;
  status: HuStatus;
  /** Antworten am Gerät / auf Papier übernommen */
  geraet: boolean;
  papier: boolean;
  themen: HuThema[];
  aufgabenStand: HuAufgabeStand[];
};

type HwRow = repo.Homework & { worksheet_id: number; assigned_at: string; completed_at: string | null; a_archived: string | null };

const HW_SQL = `SELECT h.*, a.worksheet_id, a.assigned_at, a.completed_at, a.archived_at AS a_archived
  FROM homework h JOIN assignments a ON a.id = h.assignment_id`;

/** Die Hausübung zu einer Zuweisung (die Antworten am Gerät tragen sie über `attempts.assignment_id`), oder null. */
export function hausuebungZurZuweisung(assignmentId: number): number | null {
  return (db().prepare("SELECT id FROM homework WHERE assignment_id = ? ORDER BY id DESC LIMIT 1").pluck().get(assignmentId) as number | undefined) ?? null;
}

/** Bewertung einer abgeschlossenen Antwort: offen wartet, teilweise ist halb, Lösung angesehen ist falsch. */
function bewertungVon(a: repo.Attempt | undefined): HuBewertung {
  if (!a) return "unbearbeitet";
  if (a.review === "offen") return "offen";
  if (a.review === "teilweise") return "teilweise";
  if (a.solution_viewed) return "falsch";
  return a.correct ? "richtig" : "falsch";
}

function ergebnisAus(h: HwRow, o: { stichtag: string; zumUnterricht?: boolean }): HuErgebnis {
  const tasks = repo.listTasks(h.worksheet_id);
  const finals = repo.listAttemptsForAssignment(h.assignment_id!).filter((x) => x.final);
  const papierIds = new Set(
    (db().prepare("SELECT task_ids FROM papier_arbeiten WHERE assignment_id = ?").pluck().all(h.assignment_id) as (string | null)[]).flatMap((x) => json<number[]>(x ?? "", [])),
  );
  const aufgabenStand: HuAufgabeStand[] = tasks.map((t, i) => {
    const f = [...finals].reverse().find((x) => x.task_id === t.id);
    return { taskId: t.id, nr: t.data.nummer?.trim() || String(i + 1), skillId: t.skillId, bewertung: bewertungVon(f), attemptId: f?.id ?? null, antwort: f?.answer ?? null };
  });
  const z = zahlen(aufgabenStand.map((x) => x.bewertung));
  const mitAntwort = aufgabenStand.filter((x) => x.attemptId !== null);
  const unit = h.unit_id ? (db().prepare("SELECT started_at FROM units WHERE id = ?").get(h.unit_id) as { started_at: string } | undefined) : undefined;
  const gegeben = unit ? wienerDatum(new Date(zeit(unit.started_at))) : h.assigned_at ? wienerDatum(new Date(zeit(h.assigned_at))) : null;
  return {
    ...z,
    homeworkId: h.id,
    studentId: h.student_id,
    fach: h.subject,
    unitId: h.unit_id ?? null,
    assignmentId: h.assignment_id!,
    worksheetId: h.worksheet_id,
    gegeben,
    zugewiesen: h.assigned_at,
    faellig: h.due_date || null,
    status: hausuebungStatus(z, { faellig: h.due_date || null, stichtag: o.stichtag, zumUnterricht: o.zumUnterricht, abgehakt: h.status === "erledigt", fertig: Boolean(h.completed_at) }),
    geraet: mitAntwort.some((x) => !papierIds.has(x.taskId)),
    papier: mitAntwort.some((x) => papierIds.has(x.taskId)),
    themen: themenAus(aufgabenStand, (id) => repo.getSkill(id)?.name ?? id),
    aufgabenStand,
  };
}

/** Das Ergebnis einer Hausübung mit Übung am Tag `stichtag` (Standard heute); null ohne Übung. */
export function hausuebungErgebnis(homeworkId: number, o: { stichtag?: string; zumUnterricht?: boolean } = {}): HuErgebnis | null {
  const h = db().prepare(`${HW_SQL} WHERE h.id = ?`).get(homeworkId) as HwRow | undefined;
  if (!h) return null;
  return ergebnisAus(h, { stichtag: o.stichtag ?? wienerDatum(new Date()), zumUnterricht: o.zumUnterricht });
}

/**
 * Ist die Hausübung noch offen (Profil)? Nein, wenn abgehakt oder ihre Übung fertig ist (repo.homeworkOpen), und auch nicht, wenn sie
 * mit Übung schon „bewertet“ ist, etwa auf Papier nur zum Teil gemacht und nach der Fälligkeit geprüft.
 */
export function hausuebungOffen(h: Pick<repo.HomeworkView, "id" | "status" | "assignment_id" | "assignment_completed_at">, stichtag = wienerDatum(new Date())): boolean {
  if (!repo.homeworkOpen(h)) return false;
  return !h.assignment_id || hausuebungErgebnis(h.id, { stichtag })?.status !== "bewertet";
}

/**
 * Die Hausübung, die in eine Einheit gehört, die zum Zeitpunkt `vor` (ISO oder wie gespeichert) beginnt: die zuletzt zugewiesene
 * Hausübung mit Übung dieses Schülers (im Fach der Einheit, wenn sie eines hat), höchstens `HU_ALTER_TAGE` alt, die noch nicht
 * besprochen ist. Besprochen ist sie, wenn eine spätere beendete Einheit (nicht `ausser`, nicht die, in der sie gegeben wurde) am oder
 * nach dem Fälligkeitstag begann oder „Hausübung besprechen“ zu ihr in ihrem Plan hatte. Null, wenn keine passt.
 */
export function hausuebungFuerEinheit(studentId: number, o: { vor: string; fach?: string; ausser?: number | null }): HuErgebnis | null {
  const vorMs = zeit(o.vor);
  const stichtag = wienerDatum(new Date(vorMs));
  const fach = o.fach ?? "";
  const rows = db()
    .prepare(`${HW_SQL} WHERE h.student_id = ? AND a.student_id = h.student_id AND a.archived_at IS NULL AND (? = '' OR h.subject = '' OR h.subject = ?) ORDER BY a.assigned_at DESC, h.id DESC LIMIT 5`)
    .all(studentId, fach, fach) as HwRow[];
  const h = rows.find((r) => zeit(r.assigned_at) < vorMs);
  if (!h || wienerDatum(new Date(zeit(h.assigned_at))) < tagAddieren(stichtag, -HU_ALTER_TAGE)) return null;
  const spaeter = (
    db()
      .prepare("SELECT id, started_at, subject FROM units WHERE student_id = ? AND status = 'beendet' AND id <> ? AND id <> ?")
      .all(studentId, o.ausser ?? 0, h.unit_id ?? 0) as { id: number; started_at: string; subject: string | null }[]
  ).filter((u) => {
    const t = zeit(u.started_at);
    return t > zeit(h.assigned_at) && t < vorMs && (!h.subject || !u.subject || u.subject === h.subject);
  });
  const imPlan = db().prepare("SELECT 1 FROM einheit_cockpit c, json_each(COALESCE(c.plan, '[]')) j WHERE c.unit_id = ? AND json_extract(j.value, '$.hausuebung') = ? LIMIT 1");
  const besprochen = spaeter.some((u) => (h.due_date && wienerDatum(new Date(zeit(u.started_at))) >= h.due_date) || Boolean(imPlan.get(u.id, h.id)));
  if (besprochen) return null;
  return ergebnisAus(h, { stichtag, zumUnterricht: true });
}

/**
 * Die Einheiten, deren Abschluss diese Hausübung nennt (die erste, in die sie gehört), für das Neu-Schreiben der Dokumentation nach
 * einer späteren Bewertung (lib/abschluss.ts `hausuebungInDoku`).
 */
export function einheitenMitHausuebung(homeworkId: number): number[] {
  const h = db().prepare(`${HW_SQL} WHERE h.id = ?`).get(homeworkId) as HwRow | undefined;
  if (!h) return [];
  const units = (db().prepare("SELECT id, started_at, subject FROM units WHERE student_id = ? AND status = 'beendet' AND id <> ? ORDER BY started_at LIMIT 400").all(h.student_id, h.unit_id ?? 0) as { id: number; started_at: string; subject: string | null }[]).filter(
    (u) => zeit(u.started_at) > zeit(h.assigned_at),
  );
  return units.filter((u) => hausuebungFuerEinheit(h.student_id, { vor: u.started_at, fach: u.subject ?? "", ausser: u.id })?.homeworkId === h.id).map((u) => u.id).slice(0, 3);
}

/**
 * Die geprüften Ergebnisse je Fähigkeit in der Einheit, in der die Hausübung gegeben wurde („vorher“ für `abschlussZeilen`): nur
 * gezählte, abgeschlossene Antworten dieser Einheit, teilweise halb.
 */
export function vorherInEinheit(unitId: number | null): Map<string, { punkte: number; von: number }> {
  const out = new Map<string, { punkte: number; von: number }>();
  if (!unitId) return out;
  for (const a of repo.listAttemptsForUnit(unitId)) {
    if (!a.final || !a.skill_id) continue;
    const x = out.get(a.skill_id) ?? { punkte: 0, von: 0 };
    const b = bewertungVon(a);
    x.von++;
    x.punkte += b === "richtig" ? 1 : b === "teilweise" ? 0.5 : 0;
    out.set(a.skill_id, x);
  }
  return out;
}

// ---------- in die Vorbereitung ----------

/**
 * Themen, die in der Hausübung noch schwierig waren (nur geprüfte Antworten): als offenes Ziel wie eine bewertete Textarbeit
 * (lib/vorbereitung-auto.ts `textSignale`), mit dem Ergebnis als „Warum“.
 */
export function hausuebungSignale(e: HuErgebnis | null): Signal[] {
  if (!e) return [];
  return e.themen
    .filter((t) => t.stand === "schwierig")
    .map((t) => ({ art: "ziel" as const, fach: e.fach, skill_ids: [t.skillId], stoff: [], thema: t.name, warum: `Hausübung${e.gegeben ? ` vom ${tagKurz(e.gegeben)}` : ""}: ${t.name} ${zahl(t.punkte)} von ${t.von} richtig` }));
}

/** Die Minuten für „Hausübung besprechen“: 5, bei mehr als zwei falschen Aufgaben (oder nicht abgegeben) 10; in Einheiten bis 50 Minuten 5. */
export function besprechenMinuten(e: Pick<HuErgebnis, "status" | "aufgabenStand">, einheit: number): number {
  if (einheit <= 50) return 5;
  if (e.status === "nicht_abgegeben") return 10;
  return e.aufgabenStand.filter((x) => x.bewertung === "falsch" || x.bewertung === "teilweise").length > 2 ? 10 : 5;
}

/** Braucht die Hausübung einen Schritt am Anfang? Ja, wenn etwas da ist oder sie nicht abgegeben wurde; eine noch offene nicht. */
export const schrittNoetig = (e: HuErgebnis | null): e is HuErgebnis => Boolean(e && e.status !== "offen");

/**
 * Der Schritt „Hausübung besprechen“ (oder „Hausübung nicht abgegeben“) am Anfang des Plans, ohne Id und Minuten: was er sagt, und
 * die Aufgaben, um die es geht (falsch oder teilweise gelöste; nicht abgegeben: die ersten `ZUSAMMEN` zum gemeinsamen Lösen).
 */
export function besprechenSchritt(e: HuErgebnis): { titel: string; beschreibung: string; taskIds: number[] } {
  if (e.status === "nicht_abgegeben") {
    const zusammen = e.aufgabenStand.slice(0, ZUSAMMEN).map((x) => x.taskId);
    return {
      titel: "Hausübung nicht abgegeben",
      beschreibung: `Die Hausübung${e.gegeben ? ` vom ${tagKurz(e.gegeben)}` : ""} ist nicht abgegeben. Sie zählt nicht als falsch. Löst ${zusammen.length === 1 ? "eine Aufgabe" : `${zusammen.length} Aufgaben`} daraus gemeinsam.`,
      taskIds: zusammen,
    };
  }
  const falsch = e.aufgabenStand.filter((x) => x.bewertung === "falsch" || x.bewertung === "teilweise").map((x) => x.taskId);
  const zeile = briefingZeile(e).replace(/^Hausübung: /, "");
  const was = falsch.length
    ? `Besprecht ${falsch.length === 1 ? "die falsch gelöste Aufgabe" : `die ${falsch.length} falsch oder teilweise gelösten Aufgaben`}.`
    : e.bewertet
      ? "Alles Geprüfte ist richtig. Kurz nachfragen, wie es ging."
      : "Noch nichts ist geprüft. Erst bewerten, dann besprechen.";
  return { titel: "Hausübung besprechen", beschreibung: `${zeile}.\n${was}`, taskIds: falsch };
}

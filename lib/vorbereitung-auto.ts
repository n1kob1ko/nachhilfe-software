/**
 * **Stunden automatisch vorbereiten** (niko, 2026-10-23: „der Lehrer öffnet Lernheft und die nächste Stunde ist
 * schon vorbereitet“). Für jede kommende Einheit sucht die App nach festen Regeln, ohne KI und ohne Kosten, das
 * passende **geprüfte** Lernpaket aus. Die Signale, das stärkste zuerst (`SIGNAL_RANG`, niko 25.10.2026: „Prüfungen >
 * Schulstoff > vom Schüler gemeldete Probleme > wiederholte Fehler > offene Ziele > Wiederholung“):
 *   1. Prüfung: eine Prüfung in den nächsten 30 Tagen in diesem Fach, ihre Fähigkeiten (Stoff zugeordnet) oder ihr
 *      Stoff; die frühere vor der späteren
 *   2. Schulstoff: der aktuelle Stoff (lib/recommend.ts „Aktueller Stoff“), dann die aktuellen Themen im Profil
 *   3. Vom Schüler gemeldet: was er in der Schüler-App unter „Für nächstes Mal“ oder „Was war heute schwer?“
 *      geschrieben hat, soweit die Wörter eine Fähigkeit nennen (lib/schueler-notiz.ts, `wuenscheFuer`)
 *   4. Wiederholte Fehler: derselbe Fehler mindestens zweimal in den letzten 14 Tagen (lib/recommend.ts)
 *   5. Offene Ziele: ein begonnenes Paket mit nicht erreichten Schritten, „Nächstes Mal“ der letzten Dokumentation,
 *      eine offene Hausübung (soweit ihre Wörter eine Fähigkeit nennen), eine Textarbeit mit übernommener Note und
 *      schwachem Kriterium (`textSignale`; ein Vorschlag der KI zählt nie)
 *   6. Lernstand: Schwäche oder Voraussetzung ohne wiederholten Fehler (niko nennt sie nicht; sie stehen unter den
 *      offenen Zielen, weil die Lehrkraft dort selbst geplant hat)
 *   7. Wiederholung: deutlich gefallen oder lange nicht geübt
 *   8. die letzte Einheit: ihr Thema
 * Über allem steht die **Vorgabe für heute** (niko, 25.10.2026: „Die konkrete Anweisung des Lehrers für heute hat Vorrang
 * vor allgemeinen Empfehlungen“): was die Lehrkraft nach dem Start der Einheit unter „Was steht heute an?“ angibt
 * (lib/vorgabe.ts). Für die Wahl eines Pakets auf Heute zählt dann nur sie; der Plan für die ganze Einheit
 * (lib/stundenplan.ts) nimmt ihre Themen zuerst und füllt die restliche Zeit mit den übrigen Signalen.
 * Dazu müssen Fach, Schulart und Schulstufe passen. Entwürfe und ungeprüfte Pakete werden nie vorausgewählt,
 * nur als „Entwurf“ genannt. Findet sich keines, sagt die App „Kein Paket für …“ und bietet „Mit KI entwerfen“
 * mit ausgefüllten Angaben an; die KI läuft erst, wenn der Lehrer dort auf „Entwurf erstellen“ tippt.
 *
 * Es ist nur ein Vorschlag: nichts davon wird gespeichert und nichts über den Schüler festgehalten. Was der Lehrer
 * selbst wählt (`einheit_vorbereitung`, das Cockpit der Einheit), gilt immer vor dem Vorschlag; „Entfernen“
 * merkt sich nur, dass er für diesen Tag kein Paket will (`vorbereitung_ohne_paket`).
 */
import type { Fokus } from "./briefing";
import { frueher, stoffPasst, zitat } from "./cockpit-vorschlag";
import { db, json } from "./db";
import { daysUntil } from "./exams";
import { ungeprueft, listLernpakete, getLernpaket, type Lernpaket } from "./lernpakete";
import { einheitenFuerTag, istNichtStattgefunden, mitNamen } from "./planung/repo";
import { datumLabel, minutenLabel, tagAddieren, wienerDatum } from "./planung/zeit";
import { nextSteps, RULE_LABEL, type NextStep } from "./recommend";
import * as repo from "./repo";
import { faehigkeitenAus, schuelerWorte } from "./schueler-notiz";
import { KRITERIUM_KEYS, KRITERIUM_KURZ } from "./bewertung-kriterien";
import { bestaetigteTextErgebnisse, SCHWACHE_STUFE, type TextErgebnis } from "./text-note";

/** Wie weit eine Prüfung voraus zählt. */
export const PRUEFUNG_TAGE = 30;
/** Wie viele Tage die Liste „Nächste Einheiten“ vorausschaut. */
export const VORAUS_TAGE = 7;

export type SignalArt = "vorgabe" | "pruefung" | "schulstoff" | "wunsch" | "fehler" | "ziel" | "lernstand" | "wiederholung" | "letzte_einheit";

/**
 * Die Stärke der Signale: das höhere gewinnt, bei gleicher Art die frühere Prüfung (`tage`), sonst das frühere in der
 * Liste. Der Wunsch des Schülers steht unter Prüfung und Schulstoff und über allem, was die App aus Antworten liest.
 */
export const SIGNAL_RANG: Record<SignalArt, number> = { vorgabe: 9, pruefung: 8, schulstoff: 7, wunsch: 6, fehler: 5, ziel: 4, lernstand: 3, wiederholung: 2, letzte_einheit: 1 };
export const SIGNAL_LABEL: Record<SignalArt, string> = {
  vorgabe: "Vorgabe für heute",
  pruefung: "Prüfung",
  schulstoff: "Schulstoff",
  wunsch: "Vom Schüler gemeldet",
  fehler: "Wiederholte Fehler",
  ziel: "Offenes Ziel",
  lernstand: "Lernstand",
  wiederholung: "Wiederholung",
  letzte_einheit: "Letzte Einheit",
};

/** Ein Grund, ein Thema zu nehmen, aus dem, was die App schon weiß. */
export type Signal = {
  art: SignalArt;
  /** Fach des Signals; leer = jedes */
  fach: string;
  skill_ids: string[];
  /** Stoff als Wörter („Die vier Fälle“), verglichen mit Titel und Thema des Pakets */
  stoff: string[];
  /** ein Paket direkt (in der letzten Einheit begonnen) */
  paket_ids?: number[];
  /** wofür ein Paket fehlt: „Kein Paket für …“ */
  thema: string;
  /** „Warum“ in einer Zeile */
  warum: string;
  /** bei einer Prüfung: in wie vielen Tagen (die frühere zählt bei gleicher Art mehr) */
  tage?: number;
};

/**
 * Welche Art Signal eine Empfehlung der App ist (lib/recommend.ts). Prüfung (1) kommt aus den Prüfungen selbst,
 * „Weiter“ (7) ist kein Grund für heute. Eine Schwäche mit wiederholtem Fehler zählt als wiederholter Fehler.
 */
export function artVonEmpfehlung(s: Pick<NextStep, "rule" | "repeatedError">): SignalArt | null {
  switch (s.rule) {
    case 2:
      return "schulstoff";
    case 4:
      return "fehler";
    case 3:
    case 5:
      return s.repeatedError ? "fehler" : "lernstand";
    case 6:
      return "wiederholung";
    default:
      return null;
  }
}

/**
 * Der **Wunsch des Schülers** für die nächste Einheit: ein Satz aus der Schüler-App („Für nächstes Mal“ oder „Was
 * war heute schwer?“) mit den Fähigkeiten, die seine Wörter sicher nennen (`faehigkeitenAus`, lib/schueler-notiz.ts).
 * `name` ist sein Vorname. Es sind seine Worte, keine Tatsache über ihn: berechnet beim Anzeigen, nie gespeichert.
 */
export type WunschDesSchuelers = { text: string; name: string; skill_ids: string[]; fach?: string; thema?: string };

/** Nur ein Wunsch, der eine Fähigkeit nennt, ist ein Signal; sonst ändert er nichts. „Warum“ zitiert den Schüler. */
export function wunschSignal(w: WunschDesSchuelers): Signal | null {
  const text = w.text.replace(/\s+/g, " ").trim();
  if (!text || !w.skill_ids.length) return null;
  return { art: "wunsch", fach: w.fach ?? "", skill_ids: w.skill_ids, stoff: [], thema: w.thema ?? "", warum: `${w.name} schreibt: „${zitat(text)}“` };
}

/**
 * Was der Schüler vor der Einheit `unitId` geschrieben hat (ohne Einheit: was gerade offen ist, für seine nächste),
 * je Satz mit den Fähigkeiten, die er nennt; „Für nächstes Mal“ zuerst. Sätze ohne Treffer fallen weg.
 */
export function wuenscheFuer(studentId: number, unitId: number | null): WunschDesSchuelers[] {
  const student = repo.getStudent(studentId);
  const w = student ? schuelerWorte(studentId, unitId) : null;
  if (!student || !w) return [];
  const name = student.name.split(" ")[0];
  return w.treffer.map((t) => {
    const faecher = new Set(t.skills.map((s) => s.subject));
    return { text: t.text, name, skill_ids: t.skills.map((s) => s.id), fach: faecher.size === 1 ? t.skills[0].subject : "", thema: t.skills[0].name };
  });
}

/** Wie ein Paket zum Signal passt: über die Fähigkeit, als genau dieses Paket, oder nur über ein Stichwort (unsicher). */
export type Passung = "faehigkeit" | "paket" | "stichwort";
export const GUETE: Record<Passung, number> = { paket: 3, faehigkeit: 2, stichwort: 1 };

export type SchuelerStufe = { school_type: string; grade: number | null; subjects: string[]; stufe_status?: "eindeutig" | "unklar" };

export type AutoEingabe = {
  pakete: Lernpaket[];
  student: SchuelerStufe;
  /** Fach der Einheit; leer = die Fächer im Profil */
  fach: string;
  signale: Signal[];
  /** gleiche Fähigkeit, oder die eine ist Teilfähigkeit der anderen */
  verwandt: (a: string, b: string) => boolean;
};

export type AutoWahl =
  | {
      art: "paket";
      paket: Lernpaket;
      signal: Signal;
      warum: string;
      passung: Passung;
      /** nur über ein Stichwort gefunden: als unsicher zeigen */
      unsicher: boolean;
      /** ein stärkeres Signal, für das es kein geprüftes Paket gibt */
      luecke: Signal | null;
      entwuerfe: Lernpaket[];
    }
  | { art: "kein_paket"; signal: Signal; thema: string; entwuerfe: Lernpaket[] }
  | { art: "ohne_signal" };

/** Schulart und Schulstufe: beide gleich, wo das Paket sie nennt. Bei unklarer Stufe des Schülers nur Pakete ohne Stufe. */
export function stufePasst(p: Pick<Lernpaket, "schulart" | "schulstufe">, s: SchuelerStufe): boolean {
  if (p.schulart && s.school_type && p.schulart !== s.school_type) return false;
  if (p.schulstufe && (s.stufe_status === "unklar" || !s.grade)) return false;
  if (p.schulstufe && s.grade && p.schulstufe !== s.grade) return false;
  return true;
}

/** Die Fächer, in denen die Einheit liegen kann: das Fach der Einheit, sonst die im Profil; leer = jedes. */
const faecherVon = (e: Pick<AutoEingabe, "fach" | "student">) => (e.fach ? [e.fach] : e.student.subjects);

/** Passt das Paket zum Signal, und wie? */
export function treffer(p: Pick<Lernpaket, "id" | "fach" | "skill_ids" | "title" | "thema">, s: Signal, verwandt: AutoEingabe["verwandt"]): Passung | null {
  if (s.fach && p.fach !== s.fach) return null;
  if (s.paket_ids?.includes(p.id)) return "paket";
  if (p.skill_ids.some((id) => s.skill_ids.some((x) => verwandt(id, x)))) return "faehigkeit";
  if (s.stoff.some((x) => stoffPasst(x, p))) return "stichwort";
  return null;
}

/**
 * Die Signale in der Reihenfolge ihrer Stärke (`SIGNAL_RANG`), bei gleicher Art die frühere Prüfung, sonst wie sie
 * kamen. Signale in einem anderen Fach als dem der Einheit fallen weg.
 */
export function ordneSignale(e: Pick<AutoEingabe, "fach" | "student" | "signale">): Signal[] {
  const faecher = faecherVon(e);
  return e.signale
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !s.fach || !faecher.length || faecher.includes(s.fach))
    .sort((a, b) => SIGNAL_RANG[b.s.art] - SIGNAL_RANG[a.s.art] || (a.s.tage ?? Infinity) - (b.s.tage ?? Infinity) || a.i - b.i)
    .map(({ s }) => s);
}

/** Die geprüften Pakete, die für den Schüler in Frage kommen: mit Schritten, im Fach (sonst seinen Fächern), Schulart und Stufe passend. */
export const geprueftePakete = (e: Pick<AutoEingabe, "pakete" | "fach" | "student">): Lernpaket[] => {
  const faecher = faecherVon(e);
  return e.pakete.filter((p) => p.status === "geprueft" && !ungeprueft(p) && p.schritt_zahl > 0 && (!faecher.length || faecher.includes(p.fach)) && stufePasst(p, e.student));
};

/**
 * Ein neuer Schüler ohne jedes Signal (`ohne_signal`): die geprüften Pakete zum Wählen auf Heute, höchstens drei, nach
 * Titel. Gewählt wird nie von selbst; ein Tippen legt das Paket für die Einheit fest (lib/cockpit.ts `bereiteVor`).
 */
export const paketeZumWaehlen = (e: Pick<AutoEingabe, "pakete" | "fach" | "student">): Lernpaket[] => geprueftePakete(e).sort((a, b) => a.title.localeCompare(b.title, "de")).slice(0, 3);

/**
 * Das eine Paket für die Einheit, nach den Regeln oben. Nur geprüfte Pakete mit Schritten, im Fach der Einheit
 * und für Schulart und Stufe des Schülers. Bei gleich starkem Signal: Fähigkeit vor Stichwort, dann wie viele
 * andere Signale das Paket noch trifft, dann der Titel.
 */
export function waehleAutomatisch(e: AutoEingabe): AutoWahl {
  const faecher = faecherVon(e);
  const signale = ordneSignale(e);
  const passend = e.pakete.filter((p) => p.status !== "archiviert" && p.schritt_zahl > 0 && (!faecher.length || faecher.includes(p.fach)) && stufePasst(p, e.student));
  const geprueft = geprueftePakete(e);
  const entwuerfe = passend.filter((p) => !geprueft.includes(p) && signale.some((s) => treffer(p, s, e.verwandt))).sort((a, b) => a.title.localeCompare(b.title, "de"));
  if (!signale.length) return { art: "ohne_signal" };
  // the teacher's word for today: a package for it, otherwise the plan from the data with it in front, never something else
  if (signale[0].art === "vorgabe") signale.splice(1);
  const weitere = (p: Lernpaket) => signale.filter((s) => treffer(p, s, e.verwandt)).length;
  for (const [i, s] of signale.entries()) {
    const kandidaten = geprueft.flatMap((p) => {
      const t = treffer(p, s, e.verwandt);
      return t ? [{ p, t }] : [];
    });
    if (!kandidaten.length) continue;
    kandidaten.sort((a, b) => GUETE[b.t] - GUETE[a.t] || weitere(b.p) - weitere(a.p) || a.p.title.localeCompare(b.p.title, "de") || a.p.id - b.p.id);
    const { p, t } = kandidaten[0];
    return { art: "paket", paket: p, signal: s, warum: s.warum, passung: t, unsicher: t === "stichwort", luecke: i > 0 ? signale[0] : null, entwuerfe };
  }
  return { art: "kein_paket", signal: signale[0], thema: signale[0].thema, entwuerfe };
}

// ---------- „Mit KI entwerfen“, ausgefüllt ----------

export type KiVorgabe = { skillId: string | null; fach: string; thema: string; schulart: string; klasse: number | null; dauer: number };

/** Die Angaben für „Mit KI entwerfen“ aus dem Signal, dem Schüler und der Einheit; kein Schülername geht mit. */
export function kiVorgabe(s: Signal, student: Pick<repo.Student, "school_type" | "klasse" | "subjects">, o: { fach: string; dauer: number; gibtSkill: (id: string) => boolean }): KiVorgabe {
  const skillId = s.skill_ids.find(o.gibtSkill) ?? null;
  return {
    skillId,
    fach: s.fach || o.fach || student.subjects[0] || "",
    thema: s.thema,
    schulart: student.school_type,
    klasse: student.school_type ? student.klasse : null,
    dauer: Math.max(10, Math.min(240, Math.round(o.dauer) || 50)),
  };
}

/** Der Link auf das ausgefüllte Formular unter Mehr › Lernpakete; dort erst kostet ein Klick. */
export function kiHref(v: KiVorgabe): string {
  const q = new URLSearchParams({ ki: "1" });
  if (v.skillId) q.set("ki_skill", v.skillId);
  if (v.fach) q.set("ki_fach", v.fach);
  if (v.thema) q.set("ki_thema", v.thema);
  if (v.schulart) q.set("ki_schulart", v.schulart);
  if (v.klasse) q.set("ki_klasse", String(v.klasse));
  q.set("ki_dauer", String(v.dauer));
  return `/mehr/lernpakete?${q.toString()}`;
}

// ---------- the signals from the database ----------

/** „4.11.“ aus „2026-11-04“ */
export const tagMonat = (d: string) => `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}.`;

/** Fähigkeiten verwandt: gleich, oder die eine ist Teilfähigkeit der anderen. */
export function verwandtschaft(): AutoEingabe["verwandt"] {
  const skills = new Map(repo.listSkills().map((s) => [s.id, s]));
  return (a, b) => a === b || skills.get(a)?.parent_id === b || skills.get(b)?.parent_id === a;
}

/** Was je Schüler einmal gerechnet wird, auch wenn er mehrere Einheiten in der Woche hat. */
export type SchuelerBasis = { student: repo.Student; schritte: NextStep[]; lessons: repo.Lesson[]; hausuebungen?: Pick<repo.Homework, "subject" | "description">[]; texte?: TextErgebnis[] };

export function schuelerBasis(student: repo.Student, now: Date): SchuelerBasis {
  return {
    student,
    schritte: nextSteps(student.id, { today: wienerDatum(now), now: now.getTime(), limit: 8 }),
    lessons: repo.listLessons(student.id),
    hausuebungen: db()
      .prepare(
        "SELECT h.subject, h.description FROM homework h WHERE h.student_id = ? AND h.status = 'offen' AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.id = h.assignment_id AND a.completed_at IS NOT NULL) ORDER BY h.due_date IS NULL, h.due_date LIMIT 3",
      )
      .all(student.id) as Pick<repo.Homework, "subject" | "description">[],
    texte: bestaetigteTextErgebnisse(student.id),
  };
}

/** Wie lange eine schwache Note einer Textarbeit als offenes Ziel zählt. */
export const TEXT_ZIEL_TAGE = 30;

/**
 * Schwächen aus Textarbeiten für die nächste Vorbereitung: je Fähigkeit zählt die zuletzt übernommene Bewertung (neueste
 * zuerst in `texte`). Ist ihre Note oder ein Kriterium ab Stufe 4 und liegt sie höchstens 30 Tage zurück, ist sie ein
 * offenes Ziel. Eine spätere gute Note derselben Fähigkeit nimmt es weg. Nur bestätigte Bewertungen kommen herein
 * (lib/text-note.ts `bestaetigteTextErgebnisse`), nie ein Vorschlag der KI.
 */
export function textSignale(texte: TextErgebnis[], datum: string): Signal[] {
  const out: Signal[] = [];
  const gesehen = new Set<string>();
  for (const t of texte) {
    if (gesehen.has(t.skillId)) continue;
    gesehen.add(t.skillId);
    const tag = wienerDatum(new Date(t.at));
    const alter = daysUntil(datum, tag);
    if (alter < 0 || alter > TEXT_ZIEL_TAGE) continue;
    const schwach = KRITERIUM_KEYS.filter((k) => t.stufen[k] >= SCHWACHE_STUFE);
    if (!schwach.length && !(t.note && t.note >= SCHWACHE_STUFE)) continue;
    const sorte = t.textsorte.trim() || "Textarbeit";
    const note = t.note ? `Note ${t.note}` : "bewertet";
    out.push({ art: "ziel", fach: t.fach, skill_ids: [t.skillId], stoff: [], thema: t.skillName, warum: `${sorte} am ${tagMonat(tag)}: ${note}${schwach.length ? `, schwach: ${schwach.map((k) => KRITERIUM_KURZ[k]).join(", ")}` : ""}` });
  }
  return out;
}

/**
 * Die Signale für eine Einheit am `datum` im `fach` (leer = Fächer im Profil). `ausser` ist die Einheit selbst
 * (sie zählt nicht als „letzte“). `wuensche`: was der Schüler für diese Einheit geschrieben hat (`wuenscheFuer`).
 */
export function signaleFuer(b: SchuelerBasis, o: { datum: string; fach: string; ausser?: number | null; wuensche?: WunschDesSchuelers[]; vorgabe?: Signal | null }): Signal[] {
  const faecher = o.fach ? [o.fach] : b.student.subjects;
  const imFach = (f: string) => !faecher.length || faecher.includes(f);
  const out: Signal[] = o.vorgabe ? [o.vorgabe] : [];

  for (const t of repo.upcomingTests(o.datum, b.student.id)) {
    const tage = daysUntil(t.date, o.datum);
    if (!imFach(t.subject) || tage > PRUEFUNG_TAGE) continue;
    const stoff = (t.topics?.length ? t.topics : t.topic ? [t.topic] : []).filter(Boolean);
    if (!stoff.length && !t.skill_ids.length) continue;
    const name = t.kind || "Prüfung";
    out.push({ art: "pruefung", fach: t.subject, skill_ids: t.skill_ids, stoff, thema: stoff[0] || t.title || name, warum: `${name} am ${tagMonat(t.date)}${stoff.length ? ` – ${stoff.slice(0, 2).join(", ")}` : ""}`, tage });
  }

  // the app's recommendations: current material, repeated errors, weak skills and prerequisites, repetition
  for (const s of b.schritte) {
    const art = artVonEmpfehlung(s);
    if (!art || !imFach(s.skill.subject)) continue;
    const fakt = art === "fehler" && s.rule !== 4 ? s.repeatedError : s.facts[0];
    out.push({ art, fach: s.skill.subject, skill_ids: [s.skill.id], stoff: [], thema: s.skill.name, warum: `${art === "fehler" ? "Fehler" : RULE_LABEL[s.rule]}: ${s.skill.name}${fakt ? ` – ${fakt}` : ""}` });
  }

  // the topics the school is doing now, as the teacher wrote them in the profile (only what names a skill or a word)
  const themen = b.student.current_topics
    .split(/[\n;,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (themen.length) {
    const skills = faehigkeitenAus(themen.join(", "), b.student).filter((k) => imFach(k.subject));
    const faecher = new Set(skills.map((k) => k.subject));
    out.push({ art: "schulstoff", fach: faecher.size === 1 ? skills[0].subject : "", skill_ids: skills.map((k) => k.id), stoff: themen, thema: skills[0]?.name ?? themen[0], warum: `Schulstoff laut Profil: ${zitat(themen.join(", "), 80)}` });
  }

  for (const w of o.wuensche ?? []) {
    const s = wunschSignal(w);
    if (s && (!s.fach || imFach(s.fach))) out.push(s);
  }

  // open goals: a package begun and not finished (steps not reached), the last „Nächstes Mal“, open homework
  const begonnen = [...frueher(b.student.id, o.ausser ?? null)]
    .filter(([, f]) => f.offen > 0 && f.erledigt > 0 && wienerDatum(new Date(f.datum)) < o.datum)
    .sort((x, y) => y[1].datum.localeCompare(x[1].datum))[0];
  const bp = begonnen ? getLernpaket(begonnen[0]) : null;
  if (begonnen && bp && imFach(bp.fach)) {
    const f = begonnen[1];
    out.push({ art: "ziel", fach: bp.fach, skill_ids: [], stoff: [], paket_ids: [bp.id], thema: bp.thema || bp.title, warum: `Am ${tagMonat(wienerDatum(new Date(f.datum)))} begonnen: ${f.erledigt} von ${f.gesamt} Schritten, ${f.offen} nicht erreicht` });
  }
  const letzte = b.lessons.find((l) => l.kind === "stunde" && l.status === "abgeschlossen" && l.starts_at.slice(0, 10) < o.datum && (!l.subject || imFach(l.subject)) && (l.topic.trim() || l.skill_ids.length || l.next_steps.trim()));
  const ziel = (text: string, warum: (skills: repo.Skill[]) => string) => {
    const skills = text.trim() ? faehigkeitenAus(text, b.student).filter((k) => imFach(k.subject)) : [];
    if (!skills.length) return;
    const faecher = new Set(skills.map((k) => k.subject));
    out.push({ art: "ziel", fach: faecher.size === 1 ? skills[0].subject : "", skill_ids: skills.map((k) => k.id), stoff: [], thema: skills[0].name, warum: warum(skills) });
  };
  if (letzte?.next_steps.trim()) ziel(letzte.next_steps, () => `Nächstes Mal (Einheit am ${tagMonat(letzte.starts_at)}): ${zitat(letzte.next_steps, 80)}`);
  // a Textarbeit the teacher graded with a weak criterion (only confirmed grades, never a proposal)
  for (const t of textSignale(b.texte ?? [], o.datum)) if (imFach(t.fach)) out.push(t);
  for (const h of b.hausuebungen ?? []) {
    if (h.subject && !imFach(h.subject)) continue;
    ziel(h.description, () => `Hausübung offen: ${zitat(h.description, 80)}`);
  }

  // the last unit's topic
  if (letzte && (letzte.topic.trim() || letzte.skill_ids.length)) {
    const thema = letzte.topic.trim();
    out.push({ art: "letzte_einheit", fach: letzte.subject, skill_ids: letzte.skill_ids, stoff: thema ? [thema] : [], thema: thema || (repo.getSkill(letzte.skill_ids[0])?.name ?? ""), warum: `Letzte Einheit am ${tagMonat(letzte.starts_at)}${thema ? `: ${thema}` : ""}` });
  }
  return out;
}

/** Der Vorschlag für einen Schüler an einem Tag. Liest nur; keine KI. */
export function autoWahl(b: SchuelerBasis, o: { datum: string; fach: string; ausser?: number | null; wuensche?: WunschDesSchuelers[]; vorgabe?: Signal | null; pakete?: Lernpaket[]; verwandt?: AutoEingabe["verwandt"] }): AutoWahl {
  return waehleAutomatisch({
    pakete: o.pakete ?? listLernpakete(),
    student: { school_type: b.student.school_type, grade: b.student.grade || null, subjects: b.student.subjects, stufe_status: b.student.stufe_status },
    fach: o.fach,
    signale: signaleFuer(b, o),
    verwandt: o.verwandt ?? verwandtschaft(),
  });
}

// ---------- „Entfernen“: für diesen Tag kein Paket ----------

export function ohnePaketMarkiert(studentId: number, datum: string): boolean {
  return Boolean(db().prepare("SELECT 1 FROM vorbereitung_ohne_paket WHERE student_id = ? AND datum = ?").get(studentId, datum));
}

/** „Entfernen“: der Vorschlag kommt für diesen Schüler und Tag nicht mehr; eine Wahl von Hand fällt weg. */
export function entferneVorschlag(studentId: number, datum: string, teacherId: number | null) {
  const conn = db();
  conn.transaction(() => {
    conn.prepare("DELETE FROM einheit_vorbereitung WHERE student_id = ? AND datum = ?").run(studentId, datum);
    conn.prepare("INSERT INTO vorbereitung_ohne_paket (student_id, datum, teacher_id) VALUES (?, ?, ?) ON CONFLICT(student_id, datum) DO NOTHING").run(studentId, datum, teacherId);
  })();
}

/** Der Vorschlag darf wieder kommen (nach „Entfernen“ oder wenn der Lehrer selbst ein Paket wählt). */
export function vorschlagErlauben(studentId: number, datum: string) {
  db().prepare("DELETE FROM vorbereitung_ohne_paket WHERE student_id = ? AND datum = ?").run(studentId, datum);
}

// ---------- the running unit (Cockpit) ----------

/**
 * Der Vorschlag für eine laufende Einheit ohne Wahl: null, wenn sie nicht läuft oder der Lehrer den Vorschlag
 * für diesen Tag entfernt hat. Ob schon etwas gewählt ist, prüft der Aufrufer (lib/cockpit.ts).
 */
export function autoFuerEinheit(unit: { id: number; student_id: number; subject: string; status: string; started_at: string }, now: Date = new Date()): AutoWahl | null {
  if (unit.status !== "gestartet") return null;
  const datum = wienerDatum(new Date(unit.started_at));
  const vorgabe = vorgabeSignal(unit.id, unit.subject ?? "");
  // „Entfernen“ means no package from the suggestion; the teacher's own word for today still counts
  if (!vorgabe && ohnePaketMarkiert(unit.student_id, datum)) return null;
  const student = repo.getStudent(unit.student_id);
  if (!student) return null;
  return autoWahl(schuelerBasis(student, now), { datum, fach: unit.subject ?? "", ausser: unit.id, wuensche: wuenscheFuer(student.id, unit.id), vorgabe });
}

/**
 * Die **Vorgabe für heute** einer laufenden Einheit als Signal (lib/vorgabe.ts speichert sie): ihre Fähigkeiten und
 * Lerninhalte. Null ohne Vorgabe oder wenn sie weder eine Fähigkeit noch einen Lerninhalt nennt. „Warum“ nennt nur die
 * Lerninhalte, nie den getippten Text.
 */
export function vorgabeSignal(unitId: number, fach: string): Signal | null {
  const r = db().prepare("SELECT skill_ids, punkte FROM einheit_vorgabe WHERE unit_id = ?").get(unitId) as { skill_ids: string; punkte: string } | undefined;
  if (!r) return null;
  const skillIds = json<string[]>(r.skill_ids, []).filter((id) => repo.getSkill(id));
  const punkte = json<{ inhalt: string; status: string; gruppe: string }[]>(r.punkte, []).filter((p) => p.status !== "ausgeschlossen" && p.gruppe !== "umfang");
  const stoff = [...new Set(punkte.map((p) => p.inhalt).filter(Boolean))].slice(0, 6);
  if (!skillIds.length && !stoff.length) return null;
  const fachDerSkills = new Set(skillIds.map((id) => repo.getSkill(id)!.subject));
  return {
    art: "vorgabe",
    fach: fach || (fachDerSkills.size === 1 ? [...fachDerSkills][0] : ""),
    skill_ids: skillIds,
    stoff,
    thema: stoff[0] ?? repo.getSkill(skillIds[0])?.name ?? "",
    warum: `Deine Vorgabe für heute: ${zitat(stoff.join(", ") || skillIds.map((id) => repo.getSkill(id)?.name ?? "").join(", "), 100)}`,
  };
}

// ---------- the coming units (start page) ----------

/** Was für eine kommende Einheit gilt: die Wahl des Lehrers, „Entfernt“, oder der Vorschlag. */
export type Vorbereitet = { art: "gewaehlt"; paket: Lernpaket } | { art: "entfernt" } | AutoWahl;

/** Das Signal einer Wahl als Zeile für den Plan: der Wunsch des Schülers ohne seine Worte (sie bleiben beim Zitat). */
const planZeile = (s: Signal) => (s.art === "wunsch" ? `${SIGNAL_LABEL.wunsch}: ${s.thema}` : s.warum);

/**
 * Der Schwerpunkt einer Wahl für Briefing und „Plan für heute“ (lib/briefing.ts): das Signal, das gewählt hat, beim
 * Paket des Lehrers dessen Fähigkeiten. Null, wenn nichts gewählt ist („Entfernt“ oder kein Signal).
 */
export function fokusAus(w: Vorbereitet | null): Fokus | null {
  if (!w) return null;
  if (w.art === "gewaehlt") return { art: "gewaehlt", skill_ids: w.paket.skill_ids, thema: w.paket.thema || w.paket.title, beschreibung: `Lernpaket „${w.paket.title}“`, paket_id: w.paket.id };
  if (w.art === "paket")
    return { art: w.signal.art, skill_ids: w.signal.skill_ids.length ? w.signal.skill_ids : w.paket.skill_ids, thema: w.signal.thema || w.paket.thema || w.paket.title, beschreibung: planZeile(w.signal), paket_id: w.paket.id };
  if (w.art === "kein_paket") return { art: w.signal.art, skill_ids: w.signal.skill_ids, thema: w.thema, beschreibung: planZeile(w.signal), paket_id: null };
  return null;
}

/** Das Fach, in dem die Wahl liegt: das des Pakets, sonst das des Signals; leer, wenn sie keines festlegt. */
export function fachVon(w: Vorbereitet | null): string {
  if (!w) return "";
  if (w.art === "gewaehlt" || w.art === "paket") return w.paket.fach;
  if (w.art === "kein_paket") return w.signal.fach;
  return "";
}

export type NaechsteEinheit = {
  key: string;
  datum: string;
  /** „Mo, 27. Okt.“ */
  tag: string;
  heute: boolean;
  /** „15:30“ */
  zeit: string;
  studentId: number;
  studentName: string;
  fach: string;
  /** geplante Dauer in Minuten */
  dauer: number;
  wahl: Vorbereitet;
  /** für „Mit KI entwerfen“, wenn ein Paket fehlt */
  ki: KiVorgabe | null;
};

/** Eine kommende Einheit, wie sie aus Wochenplan oder Dokumentation kommt. */
export type Termin = { key: string; datum: string; start_min: number; studentId: number; studentName: string; fach: string; dauer: number };

/**
 * Die Einheiten der nächsten `tage` Tage ab `heute`: veröffentlichte Plätze ohne Einheit, die noch nicht vorbei
 * sind, und von Hand geplante Einheiten ohne Platz. Laufende, beendete und abgebrochene Einheiten fallen weg,
 * ebenso heute ein Schüler, dessen Einheit heute schon begonnen hat, und Schüler, die es nicht mehr gibt.
 */
export function kommendeTermine(teacherId: number, now: Date = new Date(), tage = VORAUS_TAGE): Termin[] {
  const heute = wienerDatum(now);
  const out: Termin[] = [];
  const mitPlatz = new Set<string>();
  for (let i = 0; i < tage; i++) {
    const datum = tagAddieren(heute, i);
    for (const z of mitNamen(einheitenFuerTag(datum, { status: "veroeffentlicht", teacherId }))) {
      mitPlatz.add(`${z.student_id}|${datum}`);
      if (z.unit_id !== null || istNichtStattgefunden(z, now)) continue;
      out.push({ key: `platz-${z.id}`, datum, start_min: z.start_min, studentId: z.student_id, studentName: z.student_name, fach: "", dauer: z.geplante_dauer });
    }
  }
  const nowMs = now.getTime();
  // a student whose unit already started today (running or ended) needs no preparation for today any more
  const heuteBegonnen = new Set(
    (db().prepare("SELECT student_id, started_at FROM units WHERE status <> 'abgebrochen' AND started_at >= ?").all(new Date(nowMs - 2 * 86_400_000).toISOString()) as { student_id: number; started_at: string }[])
      .filter((u) => wienerDatum(new Date(u.started_at)) === heute)
      .map((u) => u.student_id),
  );
  for (const l of repo.lessonsBetween(`${heute}T00:00`, `${tagAddieren(heute, tage)}T00:00`)) {
    const datum = l.starts_at.slice(0, 10);
    if (l.status !== "geplant" || l.unit_id || (l.teacher_id && l.teacher_id !== teacherId) || mitPlatz.has(`${l.student_id}|${datum}`)) continue;
    const start = new Date(l.starts_at.replace(" ", "T"));
    if (start.getTime() + (l.duration_min || 0) * 60_000 < nowMs && datum === heute) continue;
    const startMin = l.duration_min ? start.getHours() * 60 + start.getMinutes() : 0;
    out.push({ key: `lesson-${l.id}`, datum, start_min: startMin, studentId: l.student_id, studentName: l.student_name, fach: l.subject, dauer: l.duration_min || 0 });
  }
  return out
    .filter((t) => t.datum !== heute || !heuteBegonnen.has(t.studentId))
    .sort((a, b) => a.datum.localeCompare(b.datum) || a.start_min - b.start_min || a.studentName.localeCompare(b.studentName, "de"));
}

/** Was für den Schüler an diesem Tag gilt: das Paket, das der Lehrer gewählt hat, „Entfernt“, sonst der Vorschlag. */
export function wahlAm(b: SchuelerBasis, o: Parameters<typeof autoWahl>[1]): Vorbereitet {
  const v = db().prepare("SELECT paket_id FROM einheit_vorbereitung WHERE student_id = ? AND datum = ?").get(b.student.id, o.datum) as { paket_id: number } | undefined;
  const gewaehlt = v ? getLernpaket(v.paket_id) : null;
  if (gewaehlt) return { art: "gewaehlt", paket: gewaehlt };
  if (ohnePaketMarkiert(b.student.id, o.datum)) return { art: "entfernt" };
  return autoWahl(b, o);
}

/**
 * Für jede kommende Einheit: die Wahl des Lehrers, sonst der Vorschlag. Nur lesen, keine KI. Was der Schüler für
 * nächstes Mal geschrieben hat, zählt nur für seine nächste Einheit (`wuensche`, sonst `wuenscheFuer`).
 */
export function naechsteEinheiten(teacherId: number, now: Date = new Date(), o: { tage?: number; wuensche?: (studentId: number) => WunschDesSchuelers[]; nur?: number } = {}): NaechsteEinheit[] {
  const termine = kommendeTermine(teacherId, now, o.tage).filter((t) => o.nur === undefined || t.studentId === o.nur);
  if (!termine.length) return [];
  const pakete = listLernpakete();
  const verwandt = verwandtschaft();
  const basen = new Map<number, SchuelerBasis | null>();
  const wunschVon = o.wuensche ?? ((id: number) => wuenscheFuer(id, null));
  const schonGeplant = new Set<number>();
  const heute = wienerDatum(now);
  const out: NaechsteEinheit[] = [];
  for (const t of termine) {
    if (!basen.has(t.studentId)) {
      const s = repo.getStudent(t.studentId);
      basen.set(t.studentId, s ? schuelerBasis(s, now) : null);
    }
    const b = basen.get(t.studentId);
    if (!b) continue;
    const naechste = !schonGeplant.has(t.studentId);
    schonGeplant.add(t.studentId);
    const wahl = wahlAm(b, { datum: t.datum, fach: t.fach, wuensche: naechste ? wunschVon(t.studentId) : undefined, pakete, verwandt });
    const fehlt = wahl.art === "kein_paket" ? wahl.signal : wahl.art === "paket" ? wahl.luecke : null;
    out.push({
      key: t.key,
      datum: t.datum,
      tag: datumLabel(t.datum),
      heute: t.datum === heute,
      zeit: t.start_min || t.dauer ? minutenLabel(t.start_min) : "–",
      studentId: t.studentId,
      studentName: t.studentName,
      fach: t.fach,
      dauer: t.dauer,
      wahl,
      ki: fehlt ? kiVorgabe(fehlt, b.student, { fach: t.fach, dauer: t.dauer || 50, gibtSkill: (id) => Boolean(repo.getSkill(id)) }) : null,
    });
  }
  return out;
}

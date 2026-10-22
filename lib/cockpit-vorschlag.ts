/**
 * Welches Lernpaket heute? Vorschläge für das **Cockpit** nach festen Regeln, ohne KI, aus dem, was die App
 * schon weiß:
 *   1. eine Schularbeit in den nächsten 30 Tagen: ihre Fähigkeiten (Stoff zugeordnet) oder ihr Stoff als Wort
 *      im Titel oder Thema des Pakets („Brüche“ ↔ „Bruchrechnung“)
 *   2. die Empfehlung der App (`nextSteps`, lib/recommend.ts): Prüfung, aktueller Stoff, Schwäche, Fehler …
 *   3. das Paket wurde in einer früheren Einheit begonnen und nicht fertig
 * Dazu passen Fach (Fach der Einheit oder Fächer im Profil) und Schulstufe (höchstens eine daneben); ein
 * Paket, das schon ganz durch ist, rückt nach hinten. Geprüfte Pakete gehen vor; ungeprüfte stehen nur mit
 * dem Hinweis „Ungeprüft“ da. Der Lehrer kann jedes Paket nehmen oder keines.
 */
import { briefingDaten, einfachesBriefing, kandidaten, type BriefingInhalt, type Kandidat } from "./briefing";
import { ablauf, zusammenfassung } from "./cockpit";
import { db } from "./db";
import { daysUntil } from "./exams";
import { EXPLAIN } from "./generators";
import { skillsForStudent } from "./lehrplan";
import { getLernpaket, listLernpakete, ungeprueft, type Lernpaket } from "./lernpakete";
import { wienerDatum } from "./planung/zeit";
import { nextSteps, type NextStep } from "./recommend";
import * as repo from "./repo";
import { typischeFehler } from "./themen";

const wann = (days: number) => (days === 0 ? "heute" : days === 1 ? "morgen" : `in ${days} Tagen`);
const datumKurz = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("de-AT", { day: "numeric", month: "short", timeZone: "UTC" });

/** Eine Schularbeit, soweit sie für die Wahl zählt. */
export type Pruefung = { days: number; subject: string; skill_ids: string[]; topics: string[]; label: string };

/** Was mit einem Paket in einer früheren Einheit dieses Schülers geschah (die letzte zählt). */
export type Frueher = { datum: string; erledigt: number; gesamt: number; offen: number };

export type VorschlagEingabe = {
  pakete: Lernpaket[];
  /** Schulstufe des Schülers, null wenn unklar */
  schulstufe: number | null;
  /** Fach der Einheit, sonst leer */
  fach: string;
  /** Fächer im Profil */
  faecher: string[];
  schritte: Pick<NextStep, "skill" | "rule" | "reason">[];
  pruefung: Pruefung | null;
  frueher: Map<number, Frueher>;
  /** gleiche Fähigkeit, oder die eine ist Teilfähigkeit der anderen */
  verwandt: (a: string, b: string) => boolean;
};

export type Vorschlag = {
  paket: Lernpaket;
  score: number;
  /** die Tatsachen, das Wichtigste zuerst */
  gruende: string[];
  /** „Warum heute“ in einer Zeile */
  warum: string;
  ungeprueft: boolean;
};

/** Wörter ab fünf Buchstaben, ohne Umlaute und klein, für den Vergleich mit dem Stoff. */
const woerter = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 5);

/** Der Stoff passt zum Paket, wenn ein Wort mit denselben fünf Buchstaben beginnt („Brüche“, „Bruchrechnung“). */
export function stoffPasst(stoff: string, p: Pick<Lernpaket, "title" | "thema">): boolean {
  const paket = woerter(`${p.title} ${p.thema}`).map((w) => w.slice(0, 5));
  return woerter(stoff).some((w) => paket.includes(w.slice(0, 5)));
}

/** Passt das Paket nach Fach und Schulstufe überhaupt? */
export function passtZumSchueler(p: Pick<Lernpaket, "fach" | "schulstufe">, e: Pick<VorschlagEingabe, "fach" | "faecher" | "schulstufe">): boolean {
  const faecher = [e.fach, ...e.faecher].filter(Boolean);
  if (faecher.length && !faecher.includes(p.fach)) return false;
  if (p.schulstufe && e.schulstufe && Math.abs(p.schulstufe - e.schulstufe) > 1) return false;
  return true;
}

/** Die Vorschläge, der beste zuerst; nur Pakete mit mindestens einem Grund aus den Daten. */
export function schlageVor(e: VorschlagEingabe): Vorschlag[] {
  const out: Vorschlag[] = [];
  for (const p of e.pakete) {
    if (p.status === "archiviert" || !p.schritt_zahl || !passtZumSchueler(p, e)) continue;
    const gruende: { g: number; text: string }[] = [];
    const t = e.pruefung;
    if (t && t.days <= 30 && t.subject === p.fach) {
      const skill = p.skill_ids.some((id) => t.skill_ids.some((x) => e.verwandt(id, x)));
      const stoff = t.topics.find((x) => stoffPasst(x, p));
      if (skill || stoff) gruende.push({ g: 100 - t.days, text: `${t.label}${stoff ? `, Stoff: ${stoff}` : ""}` });
    }
    const pruefungGenannt = gruende.length > 0;
    e.schritte.forEach((s, i) => {
      if (s.rule === 1 && pruefungGenannt) return; // the Schularbeit is named already
      if (p.skill_ids.some((id) => e.verwandt(id, s.skill.id))) gruende.push({ g: 60 - 5 * i, text: `${s.skill.name}: ${s.reason}` });
    });
    const f = e.frueher.get(p.id);
    if (f && f.offen > 0 && f.erledigt > 0) gruende.push({ g: 50, text: `Am ${datumKurz(f.datum)} begonnen: ${f.erledigt} von ${f.gesamt} Schritten erledigt` });
    if (!gruende.length) continue;
    gruende.sort((a, b) => b.g - a.g);
    let score = gruende[0].g + (gruende.length - 1) * 5;
    if (p.status === "geprueft") score += 15;
    if (ungeprueft(p)) score -= 10;
    if (p.schulstufe && e.schulstufe && p.schulstufe !== e.schulstufe) score -= 10;
    if (e.fach && p.fach === e.fach) score += 5;
    const texte = [...new Set(gruende.map((x) => x.text))];
    if (f && f.offen === 0) {
      score -= 40;
      texte.push(`schon am ${datumKurz(f.datum)} durchgenommen`);
    }
    out.push({ paket: p, score, gruende: texte, warum: texte.slice(0, 2).join(" · "), ungeprueft: ungeprueft(p) });
  }
  return out.sort((a, b) => b.score - a.score || a.paket.title.localeCompare(b.paket.title, "de"));
}

/** Alle Pakete zum Wählen: die zum Schüler passenden zuerst, geprüfte vor den anderen. */
export function alleZurWahl(pakete: Lernpaket[], e: Pick<VorschlagEingabe, "fach" | "faecher" | "schulstufe">): { passend: Lernpaket[]; andere: Lernpaket[] } {
  const ordne = (xs: Lernpaket[]) => [...xs].sort((a, b) => Number(b.status === "geprueft") - Number(a.status === "geprueft") || a.title.localeCompare(b.title, "de"));
  const mit = pakete.filter((p) => p.status !== "archiviert" && p.schritt_zahl > 0);
  return { passend: ordne(mit.filter((p) => passtZumSchueler(p, e))), andere: ordne(mit.filter((p) => !passtZumSchueler(p, e))) };
}

// ---------- from the database ----------

/** Was mit den Paketen in früheren Einheiten dieses Schülers geschah (ohne die Einheit `ausser`). */
export function frueher(studentId: number, ausser: number | null): Map<number, Frueher> {
  const rows = db()
    .prepare(
      `SELECT c.paket_id, c.reihenfolge, c.erledigt, c.uebersprungen, u.started_at FROM einheit_cockpit c JOIN units u ON u.id = c.unit_id
       WHERE u.student_id = ? AND c.paket_id IS NOT NULL AND u.id <> ? AND u.status <> 'abgebrochen' ORDER BY u.started_at DESC`,
    )
    .all(studentId, ausser ?? 0) as { paket_id: number; reihenfolge: string; erledigt: string; uebersprungen: string; started_at: string }[];
  const out = new Map<number, Frueher>();
  for (const r of rows) {
    if (out.has(r.paket_id)) continue;
    const p = getLernpaket(r.paket_id);
    if (!p) continue;
    const s = { erledigt: JSON.parse(r.erledigt) as number[], uebersprungen: JSON.parse(r.uebersprungen) as number[] };
    if (!s.erledigt.length && !s.uebersprungen.length) continue;
    const z = zusammenfassung(p.schritte, ablauf(p.schritte, JSON.parse(r.reihenfolge) as number[]), s);
    out.set(r.paket_id, { datum: r.started_at, erledigt: z.erledigt.length, gesamt: p.schritte.length, offen: z.nichtErreicht.length });
  }
  return out;
}

export type PaketWahl = {
  vorschlaege: Vorschlag[];
  passend: Lernpaket[];
  andere: Lernpaket[];
  /** wie viele Lernpakete es überhaupt gibt (ohne archivierte) */
  gesamt: number;
};

/**
 * Die Wahl für einen Schüler: Vorschläge mit „Warum heute“ und alle Pakete. `fach` ist das Fach der Einheit,
 * `ausser` die laufende Einheit (sie zählt nicht als „früher“).
 */
export function paketWahl(studentId: number, o: { fach?: string; ausser?: number | null; now?: Date } = {}): PaketWahl {
  const student = repo.getStudent(studentId);
  const pakete = listLernpakete();
  if (!student || !pakete.length) return { vorschlaege: [], passend: [], andere: [], gesamt: pakete.length };
  const now = o.now ?? new Date();
  const heute = wienerDatum(now);
  const skills = new Map(repo.listSkills().map((s) => [s.id, s]));
  const verwandt = (a: string, b: string) => a === b || skills.get(a)?.parent_id === b || skills.get(b)?.parent_id === a;
  const t = repo.upcomingTests(heute, studentId)[0];
  const days = t ? daysUntil(t.date, heute) : null;
  const pruefung: Pruefung | null =
    t && days !== null ? { days, subject: t.subject, skill_ids: t.skill_ids, topics: t.topics?.length ? t.topics : t.topic ? [t.topic] : [], label: `${t.title || `${t.kind} ${t.subject}`} ${wann(days)}` } : null;
  const e: VorschlagEingabe = {
    pakete,
    schulstufe: student.grade || null,
    fach: o.fach ?? "",
    faecher: student.subjects,
    schritte: nextSteps(studentId, { today: heute, now: now.getTime(), limit: 8 }),
    pruefung,
    frueher: frueher(studentId, o.ausser ?? null),
    verwandt,
  };
  return { vorschlaege: schlageVor(e).slice(0, 3), ...alleZurWahl(pakete, e), gesamt: pakete.length };
}

// ---------- without a package ----------

export type OhnePaket = {
  /** das Tagesbriefing aus den Daten (lib/briefing.ts), ohne KI */
  briefing: BriefingInhalt | null;
  minuten: number | null;
  /** die Empfehlungen der App, im Fach der Einheit zuerst */
  empfohlen: NextStep[];
  /** alle Fähigkeiten zum Wählen: Fächer im Profil, Schulstufe des Schülers */
  waehlbar: repo.Skill[];
  skill: repo.Skill | null;
  /** die Empfehlung zur gewählten Fähigkeit, wenn es eine gibt */
  empfehlung: NextStep | null;
  erklaerung: string | null;
  typischeFehler: string[];
  /** passende Übungen aus dem Bestand: Übungen, Bibliothek, Vorlagen, Material, Aufgabenbanken */
  uebungen: Kandidat[];
};

/** Was es zur Fähigkeit der Einheit schon gibt, wenn kein Lernpaket gewählt ist. Geht auch ohne ein einziges Paket. */
export function ohnePaket(studentId: number, o: { skillId: string | null; fach?: string; now?: Date }): OhnePaket | null {
  const d = briefingDaten(studentId, { now: o.now });
  if (!d) return null;
  const fach = o.fach ?? "";
  const imFach = d.schritte.filter((s) => !fach || s.skill.subject === fach);
  const empfohlen = [...imFach, ...d.schritte.filter((s) => !imFach.includes(s))];
  const faecher = [...new Set([fach, ...d.student.subjects].filter(Boolean))];
  const waehlbar = (faecher.length ? faecher : [undefined]).flatMap((f) => skillsForStudent(d.student, f));
  const skill = (o.skillId ? repo.getSkill(o.skillId) : null) ?? empfohlen[0]?.skill ?? null;
  return {
    briefing: einfachesBriefing(d),
    minuten: d.minuten,
    empfohlen,
    waehlbar,
    skill,
    empfehlung: skill ? (empfohlen.find((s) => s.skill.id === skill.id) ?? null) : null,
    erklaerung: skill ? (EXPLAIN[skill.id] ?? (skill.parent_id ? EXPLAIN[skill.parent_id] : undefined) ?? null) : null,
    typischeFehler: skill ? typischeFehler(skill.id) : [],
    uebungen: skill ? kandidaten(d.student, new Map([[skill.id, 10]]), 8) : [],
  };
}

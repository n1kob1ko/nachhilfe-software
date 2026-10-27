/**
 * Die **Vorgabe für heute** (niko, 25.10.2026: „Die konkrete Anweisung des Lehrers für heute hat Vorrang vor allgemeinen
 * Empfehlungen“). Nach dem Start einer Einheit kann die Lehrkraft unter „Was steht heute an?“ kurz schreiben, was heute
 * dran ist („Present Simple und Signal Words, nächste Woche Test“), Fotos oder ein PDF dazugeben oder eine Prüfung
 * wählen. Ohne Eingabe ändert sich nichts, der Start bleibt so schnell wie bisher.
 *
 * Gelesen wird wie der Prüfungsstoff (lib/pruefungsstoff.ts): getippter Text ohne Namen, Fotos nur nach „kein Name
 * darauf“, alles in einer Anfrage, dieselbe Eingabe nie zweimal bezahlt. Ohne KI (aus, Budget aufgebraucht, Grenze des
 * Schülers erreicht) zerlegt die App den Text selbst (`regelLesung`); die Fotos bleiben angehängt.
 *
 * Die Vorgabe ist das stärkste Signal der automatischen Vorbereitung (lib/vorbereitung-auto.ts `vorgabeSignal`, Rang
 * über der Prüfung). Hat die Lehrkraft noch nichts getan, richtet sich der Ablauf gleich danach (`wendeVorgabeAn`);
 * sonst bietet die Karte „Plan anpassen“ an. Ein Datum („nächste Woche Test“) wird nie von selbst eingetragen, nur
 * zum Bestätigen angeboten (`pruefungAusVorgabe`). Weicht die Vorgabe von der nächsten Prüfung ab, sagt die Karte das
 * in einem Satz (`abweichung`).
 *
 * Art der Unterlagen (niko, 27.10.2026: „Das Fotografieren einer beliebigen Schulübung ist nicht automatisch dasselbe wie
 * das Erfassen des gesamten Schularbeitsstoffs“): je Datei eine Rolle (lib/pruefungsstoff.ts). Eine Erklärung oder ein Blatt
 * mit Aufgaben gibt die Themen für heute, nie den Prüfungsstoff; nur der Stoffzettel (mit den Einzelheiten des
 * Inhaltsverzeichnisses) zählt für die Abweichung und „Prüfung eintragen“. Die Lehrkraft ändert eine Rolle mit einem
 * Tippen (`aendereRolle`), ohne neue Anfrage. Vorhandenes Material des Schülers kann sie statt eines neuen Fotos wählen;
 * was schon gelesen ist, kostet nichts mehr (`gespeicherteLesung`).
 */
import { planNeu, hatBegonnen, leseStand } from "./cockpit";
import { db, json } from "./db";
import { merkeZuordnung, splitTopics, stoffVorschlag } from "./lehrplan";
import { getMaterial, hatDatei, listMaterials } from "./materials";
import {
  fuerPruefung,
  gespeicherteLesung,
  getLesung,
  gewaehlteRolle,
  GRUPPE_LABEL,
  istRolle,
  liesPruefungsstoff,
  MAX_DATEIEN,
  nurFuerHeute,
  ordneZu,
  pruefungsstoffLesbar,
  setzeRolle,
  skillsAus,
  speichereStoff,
  stoffDerPruefung,
  type Gruppe,
  type Lesung,
  type RohPunkt,
  type Rolle,
  type StoffPunkt,
} from "./pruefungsstoff";
import * as repo from "./repo";
import { SUCHWOERTER } from "./themen";
import { getUnit } from "./units";
import { autoFuerEinheit, PRUEFUNG_TAGE } from "./vorbereitung-auto";
import { daysUntil } from "./exams";
import { tagAddieren, wochentagVon } from "./planung/zeit";

/** Höchstlänge des getippten Texts. */
export const VORGABE_MAX = 1500;

export type Vorgabe = {
  unitId: number;
  studentId: number;
  text: string;
  /** was heute dran ist, zugeordnet (Fähigkeit sicher, unklar oder keine) */
  punkte: StoffPunkt[];
  /** die Fähigkeiten für heute, nur sicher oder bestätigt zugeordnet */
  skillIds: string[];
  schwierigkeiten: string[];
  testId: number | null;
  lesungId: number | null;
  /** angehängte Fotos oder PDFs (Material des Schülers) */
  materialIds: number[];
  /** ein Termin im Text („nächste Woche Test“): nur zum Bestätigen */
  terminText: string;
  /** ein Satz für die Lehrkraft, z. B. warum ohne KI gelesen wurde */
  hinweis: string;
  /** der Ablauf richtet sich schon danach */
  angewendet: boolean;
  teacherId: number | null;
  updatedAt: string;
};

type Row = {
  unit_id: number;
  student_id: number;
  text: string;
  punkte: string;
  skill_ids: string;
  schwierigkeiten: string;
  test_id: number | null;
  lesung_id: number | null;
  material_ids: string;
  termin_text: string;
  hinweis: string;
  angewendet: number;
  teacher_id: number | null;
  updated_at: string;
};

const alsVorgabe = (r: Row): Vorgabe => ({
  unitId: r.unit_id,
  studentId: r.student_id,
  text: r.text,
  punkte: json<StoffPunkt[]>(r.punkte, []),
  skillIds: json<string[]>(r.skill_ids, []),
  schwierigkeiten: json<string[]>(r.schwierigkeiten, []),
  testId: r.test_id,
  lesungId: r.lesung_id,
  materialIds: json<number[]>(r.material_ids, []),
  terminText: r.termin_text,
  hinweis: r.hinweis,
  angewendet: r.angewendet === 1,
  teacherId: r.teacher_id,
  updatedAt: r.updated_at,
});

/** Die Vorgabe einer Einheit; null ohne. Eine Abfrage, auch beim Start ohne Vorgabe. */
export function vorgabeDerEinheit(unitId: number): Vorgabe | null {
  const r = db().prepare("SELECT * FROM einheit_vorgabe WHERE unit_id = ?").get(unitId) as Row | undefined;
  return r ? alsVorgabe(r) : null;
}

// ---------- ohne KI ----------

/** Ein ganzes Wort (auch mit Umlaut am Rand, wo \b nicht greift). */
const wort = (quelle: string, flags = "iu") => new RegExp(`(?<![\\p{L}\\p{N}])(${quelle})(?![\\p{L}\\p{N}])`, flags);
/** Ein Satz über eine Schwierigkeit: er geht nicht in den Stoff, sondern in „schwierig“. */
const SCHWER_WORTE = "schwer|schwierig\\p{L}*|probleme?|hakt|unsicher|verwechselt|versteht[^.]*nicht|nicht verstanden";
const SCHWER = wort(SCHWER_WORTE);
/** Ein Termin im Text. Nie selbst eingetragen, nur angeboten. */
const TERMIN = wort(
  "(?:über)?nächste[nr]?\\s+woche|kommende[nr]?\\s+woche|übermorgen|morgen|in\\s+(?:\\d+|zwei|drei|vier)\\s+(?:tagen|wochen)|(?:am\\s+)?(?:montag|dienstag|mittwoch|donnerstag|freitag)|(?:am\\s+)?\\d{1,2}\\.\\s?\\d{1,2}\\.(?:\\d{2,4})?",
);
const PRUEFUNG_WORT = wort("test|schularbeit|sa|prüfung|lzk|lernzielkontrolle|klassenarbeit|vokabeltest|ansage|wiederholung");
/** Füllwörter, die kein Lerninhalt sind. */
const FUELL = wort(
  "heute|bitte|wir|machen|üben|wiederholen|nochmal|noch einmal|vor allem|schwerpunkt|mit (?:ihm|ihr)|er|sie|soll|sollen|muss|müssen|unbedingt|dran|ist|sind|steht an|kommt|lernen|vorbereiten|für|auf|zum|zur|die|der|das|den|dem|ein|eine|und zwar|außerdem|auch|noch|dazu|zusätzlich|besonders|bis",
  "giu",
);

const GRAMMATIK = /tense|simple|continuous|progressive|perfect|grammar|grammatik|question|frage|verneinung|negation|irregular|verb|adjektiv|adverb|plural|pronoun|comparison|steigerung|signal|word order|wortstellung|passive|if-clause|going to|will-future|should|can\b|must\b/i;
export function gruppeVon(t: string): Gruppe {
  if (/\b(?:units?|kapitel|lektion|chapter)\s*\d/i.test(t)) return "umfang";
  if (/writing|e-?mail|letter|brief|story|geschichte|postcard|postkarte|invitation|einladung|dialog|aufsatz/i.test(t)) return "writing";
  if (/reading|listening|leseverst|hörverst|\blesen\b|\bhören\b/i.test(t)) return "reading_listening";
  if (GRAMMATIK.test(t)) return "grammatik";
  if (/vocab|vokabel|wortschatz|\bwords?\b|wörter/i.test(t)) return "wortschatz";
  return "sonstiges";
}

/**
 * Ohne KI: der Text in Lerninhalte, Schwierigkeiten und einen Termin zerlegt. Erfunden wird nichts, jeder Punkt ist
 * ein Stück des Texts.
 */
export function regelLesung(text: string): Pick<Lesung, "punkte" | "schwierigkeiten" | "termin_text"> {
  const punkte: RohPunkt[] = [];
  const schwierigkeiten: string[] = [];
  let termin: string | null = null;
  for (const satz of text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean)) {
    let rest = satz;
    const t = satz.match(TERMIN);
    const p = satz.match(PRUEFUNG_WORT);
    if (t && p && !termin) {
      termin = `${p[1]} ${t[1]}`.replace(/\s+/g, " ").slice(0, 60);
      rest = rest.replace(TERMIN, " ").replace(PRUEFUNG_WORT, " ");
    }
    if (SCHWER.test(satz)) {
      schwierigkeiten.push(satz.slice(0, 160));
      rest = rest.replace(wort(SCHWER_WORTE, "giu"), " ").replace(wort("tut sich|tun sich|hat|haben|mit|bei|beim", "giu"), " ");
    }
    rest = rest.replace(FUELL, " ").replace(wort("test|schularbeit|prüfung", "giu"), " ");
    for (const roh of splitTopics(rest.replace(/[.!?:]+/g, ","))) {
      const s = roh.replace(/^[\s\-–•*·]+|[\s\-–]+$/g, "").replace(/\s+/g, " ");
      if (s.length < 3 || !/\p{L}{3}/u.test(s)) continue;
      if (punkte.some((x) => x.original.toLowerCase() === s.toLowerCase())) continue;
      punkte.push({ gruppe: gruppeVon(s), original: s.slice(0, 200), inhalt: s.slice(0, 120), einheit: "", dokument: 0, quelle: "lehrer", status: "pruefung", grund: "", skill_id: null });
    }
  }
  return { punkte: punkte.slice(0, 12), schwierigkeiten: schwierigkeiten.slice(0, 5), termin_text: termin };
}

/** Wörter, die zwei Lerninhalte in einem Punkt verbinden („Gleichungen mit negativen Zahlen“). „und“ trennt schon `splitTopics`. */
const VERBINDER = /\s+(?:mit|bei|sowie|samt|plus|inklusive|inkl\.)\s+/i;

/** Die Teile eines Punkts an „mit“, „bei“, „sowie“ …; ein Teil allein, wenn es nur einen gibt. Jeder Teil ist ein Stück des Texts. */
export function teileVon(text: string): string[] {
  const teile = text
    .split(VERBINDER)
    .map((t) => t.replace(/^[\s,–-]+|[\s,–-]+$/g, "").replace(/\s+/g, " "))
    .filter((t) => /\p{L}{3}/u.test(t));
  return teile.length >= 2 ? teile : [text];
}

/**
 * Ohne KI: ein Punkt aus zwei Lerninhalten („Gleichungen mit negativen Zahlen“) wird zu einem Punkt je Teil, damit jeder
 * Teil seine eigenen Fähigkeiten zur Auswahl bekommt. Nicht, wenn der ganze Punkt schon klar zu einer Fähigkeit passt
 * (genau ihr Name, ein Suchwort, gemerkt oder ein bis zwei sichere Treffer).
 */
export function teileRegelPunkte(punkte: RohPunkt[], fach: string, student: Pick<repo.Student, "school_type" | "klasse" | "grade">): RohPunkt[] {
  if (!fach) return punkte;
  return punkte
    .flatMap((p) => {
      const teile = teileVon(p.original);
      if (teile.length < 2) return [p];
      const ganz = stoffVorschlag([p.original], fach, student)[0];
      const genau = ganz?.skills.some((s) => [s.name, ...(SUCHWOERTER[s.id] ?? [])].some((w) => klein(w) === klein(p.original)));
      if (ganz && (ganz.gemerkt || genau || (ganz.best.length >= 1 && ganz.best.length <= 2))) return [p];
      return teile.map((t) => ({ ...p, original: t.slice(0, 200), inhalt: t.slice(0, 120), gruppe: gruppeVon(t) }));
    })
    .filter((p, i, alle) => alle.findIndex((x) => klein(x.original) === klein(p.original)) === i)
    .slice(0, 12);
}

// ---------- speichern ----------

/**
 * Was heute dran ist: die Punkte der Lehrkraft und was eine Erklärung oder ein Blatt mit Aufgaben übt (ohne Kapitel); ohne
 * beides die Punkte der Blätter, die zur Prüfung gehören. Derselbe Lerninhalt steht einmal da.
 */
export function heutePunkte(punkte: StoffPunkt[]): StoffPunkt[] {
  const heute = punkte.filter((p) => p.status !== "ausgeschlossen" && (p.quelle === "lehrer" || (nurFuerHeute(p.quelle) && p.gruppe !== "umfang")));
  const out = heute.length ? heute : punkte.filter((p) => p.status === "pruefung" && p.gruppe !== "umfang" && p.quelle !== "inhaltsverzeichnis");
  return out.filter((p, i) => p.quelle === "lehrer" || out.findIndex((x) => klein(x.inhalt) === klein(p.inhalt)) === i);
}

/** Die Punkte und Fähigkeiten für heute aus den Punkten der Lehrkraft und der Blätter; mit einer gewählten Prüfung ohne Text ihr Stoff. */
function fuerHeute(punkte: StoffPunkt[], test: repo.TestResult | null, text: string): { heute: StoffPunkt[]; skillIds: string[] } {
  let heute = heutePunkte(punkte);
  let skillIds = skillsAus(heute.map((p) => ({ ...p, status: "pruefung" as const })));
  if (test && !text) {
    // „heute: diese Prüfung“: ihr Stoff und ihre Fähigkeiten
    const zeilen = stoffDerPruefung(test.id).filter((z) => z.status === "pruefung" && z.gruppe !== "umfang");
    if (!heute.length) heute = zeilen;
    skillIds = [...new Set([...skillIds, ...skillsAus(zeilen), ...test.skill_ids])];
  }
  return { heute, skillIds: skillIds.filter((id) => repo.getSkill(id)) };
}

export type VorgabeEingabe = {
  unitId: number;
  teacherId: number | null;
  text: string;
  materialIds: number[];
  testId: number | null;
  /** „Auf den Fotos steht kein Name“: nur dann werden sie gelesen */
  keinName: boolean;
  heute: string;
};

/**
 * Speichert die Vorgabe für heute (ersetzt eine frühere) und richtet den Ablauf danach, wenn die Lehrkraft noch nichts
 * getan hat. Liest Text und Fotos in einer Anfrage, ohne KI den Text allein (`regelLesung`).
 */
export async function speichereVorgabe(o: VorgabeEingabe): Promise<{ ok: true; vorgabe: Vorgabe; angewendet: boolean; neu: boolean } | { fehler: string }> {
  const unit = getUnit(o.unitId);
  if (!unit || unit.status !== "gestartet") return { fehler: "Diese Einheit läuft nicht mehr." };
  const student = repo.getStudent(unit.student_id);
  if (!student) return { fehler: "Diesen Schüler gibt es nicht." };
  const text = o.text.replace(/\r\n/g, "\n").trim().slice(0, VORGABE_MAX);
  const ids = [...new Set(o.materialIds)].filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length > MAX_DATEIEN) return { fehler: `Höchstens ${MAX_DATEIEN} Fotos oder PDFs auf einmal.` };
  const test = o.testId ? repo.getTest(o.testId) : null;
  if (o.testId && (!test || test.student_id !== student.id)) return { fehler: "Diese Prüfung gibt es nicht." };
  if (!text && !ids.length && !test) return { fehler: "Bitte kurz schreiben, was heute dran ist, Fotos wählen oder eine Prüfung auswählen." };

  const hinweise: string[] = [];
  const zuordnen = { fach: unit.subject, student };
  // files read before (also as the Stoffzettel of a Prüfung): the stored reading, no new request and no KI needed
  const schon = ids.length ? gespeicherteLesung({ materialIds: ids, studentId: student.id, fach: unit.subject || undefined }) : null;
  // without KI the files are stored and the teacher is told plainly that only the KI reads them
  const lesbar = ids.length && !schon ? pruefungsstoffLesbar({ dateien: ids.length, studentId: student.id }) : ({ ok: true } as const);
  const lesen = ids.length > 0 && o.keinName && !schon && lesbar.ok;
  const gespeichert = (grund: string) => `${grund} Die Fotos und PDFs sind gespeichert${/^Lesen kann nur die KI|keine Fotos lesen/.test(grund) ? "" : "; lesen kann sie nur die KI"}.`;
  if (!lesbar.ok) hinweise.push(gespeichert(lesbar.grund));
  else if (ids.length && !schon && !o.keinName) hinweise.push("Die Fotos sind angehängt, aber nicht gelesen: dafür bestätigen, dass kein Name darauf steht.");
  let blatt: StoffPunkt[] = schon ? ordneZu(schon.lesung.punkte.filter((p) => p.quelle !== "lehrer"), { ...zuordnen, ki: true }) : [];
  let lehrer: StoffPunkt[] = [];
  let schwierigkeiten: string[] = [];
  let terminGelesen: string | null = null;
  let lesungId: number | null = schon?.id ?? null;
  let neu = false;
  if (lesen || text) {
    try {
      const r = await liesPruefungsstoff({ materialIds: lesen ? ids : [], angabe: text, studentId: student.id, teacherId: o.teacherId, heute: o.heute, fach: unit.subject || undefined, trigger: "vorgabe" });
      const alle = ordneZu(r.lesung.punkte, { ...zuordnen, ki: true });
      lehrer = alle.filter((p) => p.quelle === "lehrer");
      if (!schon) blatt = alle.filter((p) => p.quelle !== "lehrer");
      schwierigkeiten = r.lesung.schwierigkeiten;
      terminGelesen = r.lesung.termin_text;
      // the files' reading stays the one to compare and to change roles in; a text alone has none to show
      if (!schon) lesungId = r.id;
      neu = r.neu;
    } catch (e) {
      // the provider's own words in brackets („503: {"error": …}“) stay in the cost log, not on the teacher's card
      const grund = (e instanceof Error ? e.message : "Lesen ging gerade nicht.").replace(/^(Die KI war nicht erreichbar) \(.*$/s, "$1.");
      const regel = text ? regelLesung(text) : { punkte: [], schwierigkeiten: [], termin_text: null };
      lehrer = ordneZu(teileRegelPunkte(regel.punkte, unit.subject, student), { ...zuordnen, ki: false });
      schwierigkeiten = regel.schwierigkeiten;
      terminGelesen = regel.termin_text;
      const gesagt = !lesbar.ok && lesbar.grund === grund;
      if (lesen) hinweise.push(gespeichert(grund));
      else if (!gesagt) hinweise.push(grund);
      if (text) hinweise.push("Lernheft hat deinen Text selbst zerlegt.");
    }
  }
  const { heute, skillIds } = fuerHeute([...lehrer, ...blatt], test, text);
  const terminText = test ? "" : (terminGelesen ?? "");

  db()
    .prepare(
      `INSERT INTO einheit_vorgabe (unit_id, student_id, text, punkte, skill_ids, schwierigkeiten, test_id, lesung_id, material_ids, termin_text, hinweis, angewendet, teacher_id, updated_at)
       VALUES (@unit_id, @student_id, @text, @punkte, @skill_ids, @schwierigkeiten, @test_id, @lesung_id, @material_ids, @termin_text, @hinweis, 0, @teacher_id, datetime('now'))
       ON CONFLICT(unit_id) DO UPDATE SET text = excluded.text, punkte = excluded.punkte, skill_ids = excluded.skill_ids, schwierigkeiten = excluded.schwierigkeiten,
         test_id = excluded.test_id, lesung_id = excluded.lesung_id, material_ids = excluded.material_ids, termin_text = excluded.termin_text, hinweis = excluded.hinweis,
         angewendet = 0, teacher_id = excluded.teacher_id, updated_at = excluded.updated_at`,
    )
    .run({
      unit_id: unit.id,
      student_id: student.id,
      text,
      punkte: JSON.stringify(heute),
      skill_ids: JSON.stringify(skillIds),
      schwierigkeiten: JSON.stringify(schwierigkeiten),
      test_id: test?.id ?? null,
      lesung_id: lesungId,
      material_ids: JSON.stringify(ids),
      termin_text: terminText,
      hinweis: hinweise.join(" "),
      teacher_id: o.teacherId,
    });
  const angewendet = wendeVorgabeAn(unit.id).angewendet;
  return { ok: true, vorgabe: vorgabeDerEinheit(unit.id)!, angewendet, neu };
}

/**
 * Richtet den Ablauf nach der Vorgabe: ein geprüftes Lernpaket zu ihr, sonst der Plan aus den Daten mit ihr vorne.
 * Hat die Lehrkraft schon etwas getan (`hatBegonnen`), nur mit `erzwingen` („Plan anpassen“).
 */
export function wendeVorgabeAn(unitId: number, o: { erzwingen?: boolean } = {}): { angewendet: boolean } {
  const unit = getUnit(unitId);
  const v = vorgabeDerEinheit(unitId);
  if (!unit || unit.status !== "gestartet" || !v) return { angewendet: false };
  if (!o.erzwingen && hatBegonnen(leseStand(unitId))) return { angewendet: false };
  const a = autoFuerEinheit(unit);
  const out = planNeu(unitId, a?.art === "paket" ? a.paket.id : null);
  if ("fehler" in out) return { angewendet: false };
  db().prepare("UPDATE einheit_vorgabe SET angewendet = 1 WHERE unit_id = ?").run(unitId);
  return { angewendet: true };
}

/**
 * Die kurze Bestätigung unklarer Punkte der Vorgabe: je Punkt (Index in `punkte`) die gewählten Fähigkeiten (eine oder
 * mehrere) oder keine. Mehrere werden je ein Punkt mit derselben Angabe. Gemerkt für dieselben Wörter (lib/lehrplan.ts
 * `merkeZuordnung`); danach richtet sich der Ablauf neu, wenn noch nichts getan ist.
 */
export function bestaetigeVorgabe(unitId: number, wahl: Map<number, string | null | (string | null)[]>, teacherId: number | null): boolean {
  const v = vorgabeDerEinheit(unitId);
  const unit = getUnit(unitId);
  if (!v || !unit) return false;
  const punkte = v.punkte.flatMap((p, i): StoffPunkt[] => {
    const roh = wahl.get(i);
    const liste = Array.isArray(roh) ? roh : [roh ?? null];
    if (!wahl.has(i) || !liste.length || p.zuordnung !== "unklar") return [p];
    const ok = [...new Set(liste)].filter((id): id is string => Boolean(id && p.vorschlaege.includes(id) && repo.getSkill(id)));
    merkeZuordnung(unit.subject, p.inhalt && klein(p.inhalt) !== klein(p.original) ? `${p.inhalt} (${p.original})` : p.original, ok, teacherId);
    if (!ok.length) return [{ ...p, skill_id: null, zuordnung: "keine" }];
    return ok.map((id) => ({ ...p, skill_id: id, zuordnung: "bestaetigt" as const, vorschlaege: p.vorschlaege.filter((x) => x !== id) }));
  });
  const skillIds = [...new Set([...v.skillIds, ...skillsAus(punkte.map((p) => ({ ...p, status: "pruefung" as const })))])];
  db().prepare("UPDATE einheit_vorgabe SET punkte = ?, skill_ids = ?, updated_at = datetime('now') WHERE unit_id = ?").run(JSON.stringify(punkte), JSON.stringify(skillIds), unitId);
  wendeVorgabeAn(unitId);
  return true;
}

// ---------- Art der Unterlagen ----------

export type VorgabeDatei = { materialId: number; art: "Foto" | "PDF"; gelesen: boolean; rolle: Rolle | null };

/**
 * Die Rolle einer Datei, die nicht gelesen wurde, nach einfachen Regeln ohne KI: die an der Datei gespeicherte, sonst
 * „legt den Prüfungsstoff fest“ für den Stoffzettel einer eingetragenen Prüfung; sonst unbekannt.
 */
export function rolleOhneKi(materialId: number): Rolle | null {
  const m = getMaterial(materialId);
  if (!m) return null;
  if (istRolle(m.rolle)) return m.rolle;
  const anPruefung = db().prepare("SELECT 1 FROM tests WHERE material_id = ? LIMIT 1").get(materialId);
  return anPruefung || /^stoffzettel\b/i.test(m.title) ? "stoffzettel" : null;
}

/** Die Dateien der Vorgabe mit ihrer Rolle: gelesen aus der Lesung (mit der Wahl der Lehrkraft), sonst nach den Regeln. */
export function dateienDerVorgabe(v: Pick<Vorgabe, "materialIds" | "lesungId">): VorgabeDatei[] {
  const l = getLesung(v.lesungId);
  return v.materialIds.map((id) => {
    const nr = (l?.dateien.findIndex((d) => d.material_id === id) ?? -1) + 1;
    const gelesen = nr > 0 ? (l!.lesung.dokumente.find((d) => d.nr === nr)?.rolle ?? null) : null;
    return { materialId: id, art: getMaterial(id)?.mime === "application/pdf" ? "PDF" : "Foto", gelesen: nr > 0, rolle: gewaehlteRolle(id) ?? gelesen ?? rolleOhneKi(id) };
  });
}

/**
 * Die Lehrkraft ändert die Rolle einer Datei der Vorgabe (ein Tippen): an der Datei gespeichert, dann wird die Vorgabe aus
 * der gespeicherten Lesung neu gemacht, ohne KI-Anfrage. Die Punkte der Lehrkraft bleiben, wie sie sind (auch bestätigte).
 */
export function aendereRolle(unitId: number, materialId: number, rolle: Rolle): boolean {
  const v = vorgabeDerEinheit(unitId);
  const unit = getUnit(unitId);
  const student = unit ? repo.getStudent(unit.student_id) : null;
  if (!v || !unit || !student || !v.materialIds.includes(materialId) || !setzeRolle(materialId, rolle)) return false;
  const l = getLesung(v.lesungId);
  if (!l || !l.dateien.some((d) => d.material_id === materialId)) return true;
  const blatt = ordneZu(l.lesung.punkte.filter((p) => p.quelle !== "lehrer"), { fach: unit.subject, student, ki: true });
  const test = v.testId ? repo.getTest(v.testId) : null;
  const { heute, skillIds } = fuerHeute([...v.punkte.filter((p) => p.quelle === "lehrer"), ...blatt], test, v.text);
  // the same points: the plan stays as it is
  if (JSON.stringify(heute) === JSON.stringify(v.punkte) && JSON.stringify(skillIds) === JSON.stringify(v.skillIds)) return true;
  db().prepare("UPDATE einheit_vorgabe SET punkte = ?, skill_ids = ?, angewendet = 0, updated_at = datetime('now') WHERE unit_id = ?").run(JSON.stringify(heute), JSON.stringify(skillIds), unitId);
  wendeVorgabeAn(unitId);
  return true;
}

/**
 * Vorhandenes Material des Schülers für „Was steht heute an?“: hochgeladene Fotos und PDFs (keine Druckblätter), das neueste
 * zuerst. Mit der Rolle, wenn sie bekannt ist.
 */
export function materialZurWahl(studentId: number, max = 24): { id: number; titel: string; art: "Foto" | "PDF"; datum: string; rolle: Rolle | null }[] {
  return listMaterials({ studentId })
    .filter(hatDatei)
    .slice(0, max)
    .map((m) => ({ id: m.id, titel: m.title, art: m.mime === "application/pdf" ? "PDF" : "Foto", datum: m.created_at.slice(0, 10), rolle: istRolle(m.rolle) ? m.rolle : null }));
}

/** Die Vorgabe entfernen. Hat die Lehrkraft noch nichts getan, gilt wieder der Ablauf ohne sie. */
export function entferneVorgabe(unitId: number) {
  const v = vorgabeDerEinheit(unitId);
  if (!v) return;
  db().prepare("DELETE FROM einheit_vorgabe WHERE unit_id = ?").run(unitId);
  const unit = getUnit(unitId);
  if (v.angewendet && unit?.status === "gestartet" && !hatBegonnen(leseStand(unitId))) {
    const a = autoFuerEinheit(unit);
    planNeu(unitId, a?.art === "paket" ? a.paket.id : null);
  }
}

// ---------- Abweichung von der Prüfung ----------

type Vergleich = Pick<StoffPunkt, "gruppe" | "inhalt" | "original" | "skill_id" | "status" | "quelle">;
export type PruefungZumVergleich = { quelle: string; testId: number | null; zeilen: Vergleich[] };

/**
 * Womit die Vorgabe verglichen wird: die gewählte Prüfung, sonst die nächste im Fach (höchstens PRUEFUNG_TAGE weg), sonst
 * die mitgelesenen Blätter, wenn sie einen Stoffzettel enthalten. Null ohne.
 */
export function pruefungZurVorgabe(v: Vorgabe, fach: string, heute: string): PruefungZumVergleich | null {
  const aus = (t: repo.TestResult): PruefungZumVergleich => {
    const zeilen = stoffDerPruefung(t.id);
    const quelle = zeilen.some((z) => z.quelle === "stoffzettel") ? "Stoffzettel" : `${t.kind || "Prüfung"} am ${Number(t.date.slice(8, 10))}.${Number(t.date.slice(5, 7))}.`;
    if (zeilen.length) return { quelle, testId: t.id, zeilen };
    return { quelle, testId: t.id, zeilen: t.skill_ids.map((id) => ({ gruppe: "grammatik", inhalt: repo.getSkill(id)?.name ?? id, original: "", skill_id: id, status: "pruefung", quelle: "sonstiges" })) };
  };
  if (v.testId) {
    const t = repo.getTest(v.testId);
    return t ? aus(t) : null;
  }
  const naechste = repo.upcomingTests(heute, v.studentId).find((t) => (!fach || t.subject === fach) && daysUntil(t.date, heute) <= PRUEFUNG_TAGE && (t.skill_ids.length || stoffDerPruefung(t.id).length));
  if (naechste) return aus(naechste);
  // with the roles the teacher chose: a worksheet never stands in for the Stoffzettel
  const blaetter = getLesung(v.lesungId)?.lesung.punkte.filter((p) => p.quelle === "stoffzettel") ?? [];
  return blaetter.length ? { quelle: "Stoffzettel", testId: null, zeilen: blaetter } : null;
}

const SPRACHFACH = /deutsch|englisch|französisch|franzoesisch|latein|spanisch|italienisch/i;
const ENGLISCH_GRUPPE: Partial<Record<Gruppe, string>> = { writing: "Writing", reading_listening: "Reading und Listening", wortschatz: "Vokabeln" };
const liste = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} und ${xs[xs.length - 1]}`);
const klein = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Was die Prüfung verlangt und heute nicht geplant ist, und was heute geplant ist, die Prüfung aber ausschließt. Je ein
 * kurzer Satz; leer, wenn alles passt. Grammatik einzeln (höchstens drei, die mit Fähigkeit zuerst), die anderen
 * Gruppen als ganze („Writing“); Umfang, Lektüre und Sonstiges nicht.
 */
export function abweichung(heute: Pick<StoffPunkt, "gruppe" | "inhalt" | "original" | "skill_id">[], skillIds: string[], p: PruefungZumVergleich, fach = ""): string[] {
  const skills = new Set(skillIds);
  for (const id of skillIds) {
    const s = repo.getSkill(id);
    if (s?.parent_id) skills.add(s.parent_id);
  }
  const texte = heute.flatMap((h) => [klein(h.inhalt), klein(h.original)]).filter((t) => t.length >= 3);
  const gedeckt = (z: Vergleich) => {
    if (z.skill_id && (skills.has(z.skill_id) || skills.has(repo.getSkill(z.skill_id)?.parent_id ?? ""))) return true;
    const t = [klein(z.inhalt), klein(z.original)].filter((x) => x.length >= 3);
    // contained in each other and of similar length: „Present Simple“ covers „Present Simple (Wiederholung)“, „Fragen“ no long sentence
    return t.some((a) => texte.some((b) => (a.includes(b) || b.includes(a)) && Math.min(a.length, b.length) / Math.max(a.length, b.length) >= 0.4));
  };
  const zaehlt = p.zeilen.filter((z) => z.status === "pruefung" && z.quelle !== "inhaltsverzeichnis" && !nurFuerHeute(z.quelle));
  // grammar one by one, those with a skill first, at most three; the other groups as a whole
  const grammatik = zaehlt
    .filter((z) => z.gruppe === "grammatik" && !gedeckt(z))
    .sort((a, b) => Number(!a.skill_id) - Number(!b.skill_id))
    .map((z) => z.inhalt)
    .filter((t, i, alle) => alle.indexOf(t) === i);
  const fehlt = grammatik.slice(0, 3);
  // the Fähigkeiten of a Mathematik exam stand in this group too: there it is „weitere Themen“, not grammar
  if (grammatik.length > 3) fehlt.push(SPRACHFACH.test(fach) ? "weitere Grammatik" : "weitere Themen");
  for (const g of ["wortschatz", "writing", "reading_listening"] as Gruppe[]) {
    const zeilen = zaehlt.filter((z) => z.gruppe === g);
    if (zeilen.length && !zeilen.some(gedeckt) && !heute.some((h) => h.gruppe === g)) fehlt.push((/englisch/i.test(fach) && ENGLISCH_GRUPPE[g]) || GRUPPE_LABEL[g]);
  }
  const out: string[] = [];
  if (fehlt.length && heute.length) out.push(`Laut ${p.quelle} auch ${liste(fehlt)} – heute nicht geplant.`);
  const ausgeschlossen = p.zeilen.filter((z) => z.status === "ausgeschlossen");
  const widerspricht = heute.filter((h) => ausgeschlossen.some((z) => [klein(z.inhalt), klein(z.original)].some((a) => a.length >= 4 && (a.includes(klein(h.inhalt)) || klein(h.inhalt).includes(a)))));
  if (widerspricht.length) out.push(`Laut ${p.quelle} nicht Stoff: ${liste(widerspricht.map((h) => h.inhalt).slice(0, 3))}.`);
  return out;
}

// ---------- Termin ----------

const ZAHLWORT: Record<string, number> = { zwei: 2, drei: 3, vier: 4 };
/** ISO: Index 1 = Montag … 7 = Sonntag (lib/planung/zeit.ts) */
const WOCHENTAG = ["", "montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag", "sonntag"];

/** Ungefähr wann der Termin im Text ist (YYYY-MM-DD), oder null, wenn der Text kein Datum hergibt. */
export function terminDatum(text: string, heute: string): string | null {
  const t = text.toLowerCase();
  const plus = (tage: number) => tagAddieren(heute, tage);
  let m = t.match(/(\d{1,2})\.\s?(\d{1,2})\.(\d{2,4})?/);
  if (m) {
    const jahr = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : Number(heute.slice(0, 4));
    const d = `${jahr}-${String(Number(m[2])).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`;
    if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d)) return null;
    // „8.11.“ without a year in January: the coming one
    return !m[3] && d < heute ? `${jahr + 1}${d.slice(4)}` : d;
  }
  m = t.match(/in\s+(\d+|zwei|drei|vier)\s+(tagen|wochen)/);
  if (m) return plus((ZAHLWORT[m[1]] ?? Number(m[1])) * (m[2] === "wochen" ? 7 : 1));
  if (/übernächste[nr]?\s+woche/.test(t)) return plus(14);
  if (/(nächste[nr]?|kommende[nr]?)\s+woche/.test(t)) return plus(7);
  if (/übermorgen/.test(t)) return plus(2);
  if (/morgen/.test(t)) return plus(1);
  const tag = WOCHENTAG.findIndex((w) => w && t.includes(w));
  if (tag > 0) return plus((tag - wochentagVon(heute) + 7) % 7 || 7);
  return null;
}

/** Die Art einer Prüfung im Text, wie das Formular sie vorschlägt. */
export const terminArt = (text: string) => (/schularbeit|\bsa\b/i.test(text) ? "Schularbeit" : /\btest\b|lzk|lernzielkontrolle/i.test(text) ? "Test" : "");

/**
 * „Prüfung eintragen“ ist nicht nötig, wenn dieselbe Prüfung schon eingetragen ist: im Fach der Einheit, gleiche Art (wenn
 * der Text sie nennt) und um das Datum im Text (eine Woche davor oder danach), ohne Datum in den nächsten 30 Tagen.
 */
export function schonEingetragen<T extends Pick<repo.TestResult, "date" | "subject" | "kind">>(terminText: string, tests: T[], heute: string, fach: string): T | null {
  if (!terminText.trim()) return null;
  const datum = terminDatum(terminText, heute);
  const art = terminArt(terminText);
  const von = datum ? tagAddieren(datum, -7) : heute;
  const bis = datum ? tagAddieren(datum, 7) : tagAddieren(heute, 30);
  return tests.find((t) => t.date >= heute && t.date >= von && t.date <= bis && (!fach || !t.subject || t.subject === fach) && (!art || t.kind === art)) ?? null;
}

/**
 * „Prüfung eintragen“ aus einer Vorgabe: nur mit einem Datum, das die Lehrkraft bestätigt hat. Der Stoff der Vorgabe
 * (und der mitgelesenen Blätter) kommt als Prüfungsstoff dazu.
 */
export function pruefungAusVorgabe(unitId: number, o: { datum: string; art: string; teacherId: number | null; heute: string }): { ok: true; testId: number } | { fehler: string } {
  const v = vorgabeDerEinheit(unitId);
  const unit = getUnit(unitId);
  if (!v || !unit) return { fehler: "Diese Vorgabe gibt es nicht mehr." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.datum) || o.datum < o.heute) return { fehler: "Bitte ein Datum ab heute wählen." };
  const art = ["Schularbeit", "Test", "Prüfung"].includes(o.art) ? o.art : "Test";
  const blaetter = getLesung(v.lesungId)?.lesung.punkte.filter((p) => p.quelle !== "lehrer") ?? [];
  const student = repo.getStudent(v.studentId);
  // the teacher's points and what the sheets say; what only a worksheet or an explanation says is still to clarify
  const gelesen = student && blaetter.length ? ordneZu(blaetter, { fach: unit.subject, student, ki: true }) : [];
  const stoff = fuerPruefung([...v.punkte.filter((p) => p.quelle === "lehrer" || !gelesen.length), ...gelesen]);
  const topics = [...new Set(stoff.filter((p) => p.status === "pruefung" && p.gruppe !== "umfang").map((p) => p.inhalt))].slice(0, 24);
  // the Stoffzettel goes with the Prüfung, never a worksheet
  const dateien = dateienDerVorgabe(v);
  const zettel = dateien.find((d) => d.rolle === "stoffzettel") ?? dateien.find((d) => !d.rolle || d.rolle === "sonstiges");
  const testId = repo.addTest({
    student_id: v.studentId,
    date: o.datum,
    subject: unit.subject,
    kind: art,
    topic: "",
    grade: null,
    points: null,
    max_points: null,
    notes: "",
    skill_ids: skillsAus(stoff),
    title: "",
    topics,
    status: "geplant",
    teacher_id: o.teacherId,
    material_id: zettel?.materialId ?? null,
  });
  if (stoff.length) speichereStoff(testId, stoff, { lesungId: v.lesungId });
  db().prepare("UPDATE einheit_vorgabe SET termin_text = '', test_id = ? WHERE unit_id = ?").run(testId, unitId);
  return { ok: true, testId };
}

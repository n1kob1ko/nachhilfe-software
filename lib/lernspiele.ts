/**
 * Lernspiele in der Schüler-App (niko 2026-11-11: „nicht nur da, sondern beim aktuellen Stoff helfen“).
 *
 * - **Welches Spiel**: die App wählt es nach dem Stoff des Schülers (`spielVorschlaege`), in dieser Reihenfolge:
 *   eine Prüfung in den nächsten 21 Tagen mit passender Fähigkeit, der aktuelle Stoff im Profil, die letzte
 *   Einheit (14 Tage), eine unsichere Fähigkeit im Lernstand, sonst das Fach (Deutsch-Spiele mit Deutsch, Vokabel-Paare mit Englisch
 *   oder einer eigenen Vokabelliste).
 * - **Welche Karten**: aus den geprüften Aufgabenbanken (lib/lernspiele-karten.ts), Stufe nach Schulstufe und
 *   Lernstand, Fehler der letzten Runden kommen wieder. „Vokabel-Paare“ (Englisch) nimmt die eigenen Vokabellisten
 *   des Schülers, sonst eine Themenliste (`vokabelPlan`, lib/lernspiele-vokabeln.ts). Die Englisch-Spiele mit Kisten
 *   nehmen die Sätze der Englisch-Generatoren; „English Tenses“ und „English Grammar“ spielen je Runde ein Thema
 *   (`themenPlan`, lib/lernspiele-englisch.ts).
 * - **Was zählt**: die erste Wahl je Karte. Der Server prüft sie an den Karten, die er beim Start gespeichert hat.
 *   Eine beendete Runde ist ein Beleg für den Lernstand mit Gewicht 1,5 (`SOURCE_WEIGHT.spiel`), so viel wie eine
 *   dokumentierte Stunde und viel weniger als die Aufgaben einer Übung. Abgebrochene Runden zählen nicht.
 */
import { parseTime } from "./analysis";
import { materialSkills, activeMaterial } from "./current-material";
import { db, json } from "./db";
import { englischKandidaten, GRAMMATIK_THEMEN, IRREGULAR_SKILL, SPIEL_THEMEN, themaPasst, themenFuerStufe, spielbareThemen, ZEITEN_THEMEN, type SpielThema } from "./lernspiele-englisch";
import { stufenFuer, waehleKarten } from "./lernspiele-karten";
import { istSpielArt, SPIEL_FACH, sterneFuer, type SpielAntwort, type SpielArt, type SpielKarte, type SpielVorschlag } from "./lernspiele-typen";
import { PAARE_MIN, vokabelKandidaten, vokabelKey, vokabelStufen, waehleVokabeln, type VokabelKandidat } from "./lernspiele-vokabeln";
import { tagAddieren, wienerDatum } from "./planung/zeit";
import * as repo from "./repo";
import { THEMEN } from "./themen";
import { leseListe } from "./vokabeln";
import { EIGENE_VOKABELN } from "./vokabeln-pruefen";
import { listenVon, vokabelQuelle } from "./vokabellisten";
import { VOKABEL_THEMEN } from "./vokabeln-themen";

/** Die Fähigkeit, die ein Spiel übt, und welche Fähigkeiten im Stoff zu ihm führen. */
export const SPIEL_SKILL: Record<SpielArt, string> = {
  artikel: "deutsch.grammatik.artikel",
  praepositionen: "deutsch.grammatik.praepositionen",
  deklination: "deutsch.grammatik.adjektivdeklination",
  faelle: "deutsch.grammatik.faelle",
  dasdass: "deutsch.recht.dasdass",
  satzteile: "deutsch.satz.hauptsatz-gliedsatz",
  perfekt: "deutsch.grammatik.perfekt",
  praeteritum: "deutsch.grammatik.praeteritum",
  // Satzbau übt, wo das Verb steht: die Umstellprobe der Satzglieder (Volksschule: satzbauSkill)
  satzbau: "deutsch.satz.satzglieder",
  // Vokabel-Paare: die eigenen Listen; spielt jemand eine Themenliste, hängt die Fähigkeit an der Runde (vokabelPlan)
  vokabeln: EIGENE_VOKABELN,
  irregular: IRREGULAR_SKILL,
  // Themenspiele: die Fähigkeit hängt an der Runde (themenPlan); hier steht nur, was ohne Runde gilt
  zeiten: "englisch.tenses.mixed",
  grammatik: "englisch.grammar",
};
/** Ab welcher Schulstufe ein Spiel zum Weiterüben angeboten wird (der Stoff selbst kann es früher bringen). */
const SPIEL_AB: Record<SpielArt, number> = { artikel: 1, praepositionen: 3, deklination: 5, faelle: 5, dasdass: 5, satzteile: 5, perfekt: 4, praeteritum: 4, satzbau: 3, vokabeln: 3, irregular: 6, zeiten: 5, grammatik: 5 };
/** Fähigkeiten im Stoff und die Spiele dazu, das passendste zuerst. Unterfähigkeiten („….ersatzprobe“) zählen mit. */
const FUEHRT_ZU: Record<string, SpielArt[]> = {
  "deutsch.grammatik.artikel": ["artikel"],
  "deutsch.wortarten.nomen": ["artikel"],
  "deutsch.grammatik.praepositionen": ["praepositionen"],
  // „Die vier Fälle“: Fälle bestimmen und der Fall nach der Präposition
  "deutsch.grammatik.faelle": ["faelle", "praepositionen"],
  "deutsch.grammatik.adjektivdeklination": ["deklination"],
  "deutsch.recht.dasdass": ["dasdass"],
  "deutsch.satz.hauptsatz-gliedsatz": ["satzteile", "satzbau"],
  "deutsch.satz.satzreihe-gefuege": ["satzteile", "satzbau"],
  "deutsch.satz.satzglieder": ["satzbau"],
  "deutsch.vs.sprache.satzglieder": ["satzbau"],
  "deutsch.grammatik.zeiten": ["perfekt", "praeteritum"],
  "deutsch.grammatik.perfekt": ["perfekt"],
  "deutsch.grammatik.praeteritum": ["praeteritum"],
  // jede Themenliste des Vokabeltrainers und die eigenen Listen
  ...Object.fromEntries([...Object.keys(VOKABEL_THEMEN), EIGENE_VOKABELN].map((id) => [id, ["vokabeln"] as SpielArt[]])),
  // Englisch: die unregelmäßigen Verben zuerst, dann jede Zeit und jedes Grammatik-Thema mit eigenen Sätzen
  [IRREGULAR_SKILL]: ["irregular"],
  "englisch.tenses.pastsimple.irregular": ["irregular"],
  ...Object.fromEntries(ZEITEN_THEMEN.flatMap((t) => [t.skill, ...(t.auch ?? [])]).map((id) => [id, ["zeiten"] as SpielArt[]])),
  ...Object.fromEntries(GRAMMATIK_THEMEN.flatMap((t) => [t.skill, ...(t.auch ?? [])]).map((id) => [id, ["grammatik"] as SpielArt[]])),
};

export const spieleZuSkills = (ids: string[]): SpielArt[] => [
  ...new Set(ids.flatMap((id) => Object.entries(FUEHRT_ZU).flatMap(([skill, arten]) => (id === skill || id.startsWith(`${skill}.`) ? arten : [])))),
];

const PRUEFUNG_TAGE = 21;
const EINHEIT_TAGE = 14;
const UNSICHER = 0.6;

/**
 * Welche Spiele gerade zum Stoff passen, das wichtigste zuerst; jedes Spiel einmal. `lernstand` ist der Lernstand
 * je Fähigkeit (lib/service.ts analyzeStudent), `heute` das Wiener Datum.
 */
export function spielVorschlaege(student: repo.Student, o: { heute: string; lernstand?: Map<string, number | null> }): SpielVorschlag[] {
  const out: SpielVorschlag[] = [];
  const add = (arten: SpielArt[], grund: string, quelle: SpielVorschlag["quelle"]) => {
    for (const art of arten) if (!out.some((v) => v.art === art)) out.push({ art, grund, quelle });
  };

  for (const q of stoffQuellen(student, o.heute)) add(spieleZuSkills(q.ids), q.grund, q.quelle);
  // eine eigene Vokabelliste ist aktueller Stoff: die Lehrkraft hat sie für genau diese Wörter angelegt
  if (eigeneVokabeln(student.id).length >= PAARE_MIN) add(["vokabeln"], "Deine Vokabelliste", "stoff");

  for (const art of Object.keys(SPIEL_SKILL) as SpielArt[]) {
    const m = o.lernstand?.get(art === "satzbau" ? satzbauSkill(student) : SPIEL_SKILL[art]);
    if (m != null && m < UNSICHER) add([art], "Da bist du noch unsicher", "lernstand");
  }

  if (student.subjects.includes("Deutsch") || out.some((v) => SPIEL_FACH[v.art] === "Deutsch")) {
    // die übrigen zum Weiterüben; Artikel für die Kleinen zuerst, Endungen erst ab der Unterstufe
    const reihe: SpielArt[] = student.grade <= 4 ? ["artikel", "satzbau", "praepositionen", "perfekt", "praeteritum"] : ["praepositionen", "deklination", "faelle", "dasdass", "satzteile", "satzbau", "perfekt", "praeteritum", "artikel"];
    add(
      reihe.filter((art) => student.grade >= SPIEL_AB[art]),
      "Zum Üben",
      "fach",
    );
  }
  if (student.subjects.includes("Englisch"))
    add(
      (["vokabeln", "irregular", "zeiten", "grammatik"] as SpielArt[]).filter((art) => student.grade >= SPIEL_AB[art]),
      "Zum Üben",
      "fach",
    );
  return out;
}

/**
 * Der Stoff des Schülers als Fähigkeiten, das Dringendste zuerst: Prüfungen der nächsten 21 Tage, der aktuelle Stoff
 * im Profil, die letzte Einheit (14 Tage).
 */
function stoffQuellen(student: repo.Student, heute: string): { ids: string[]; grund: string; quelle: SpielVorschlag["quelle"] }[] {
  const out: { ids: string[]; grund: string; quelle: SpielVorschlag["quelle"] }[] = [];
  const bis = tagAddieren(heute, PRUEFUNG_TAGE);
  const pruefungen = repo
    .listTests(student.id)
    .filter((t) => (t.status ?? "geplant") === "geplant" && t.date >= heute && t.date <= bis)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const t of pruefungen) {
    const tage = Math.round((Date.parse(t.date) - Date.parse(heute)) / 86_400_000);
    const wann = tage === 0 ? "heute" : tage === 1 ? "morgen" : `in ${tage} Tagen`;
    out.push({ ids: t.skill_ids, grund: `${t.title || t.kind || "Prüfung"} ${wann}`, quelle: "pruefung" });
  }
  for (const m of activeMaterial(student.id)) out.push({ ids: materialSkills(m, student).ids, grund: "Dein aktueller Stoff", quelle: "stoff" });
  const seit = tagAddieren(heute, -EINHEIT_TAGE);
  const letzte = repo
    .listLessons(student.id)
    .filter((l) => l.kind === "stunde" && l.starts_at.slice(0, 10) >= seit)
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
  if (letzte) out.push({ ids: letzte.skill_ids, grund: "Aus deiner letzten Einheit", quelle: "einheit" });
  return out;
}

// ---------- Vokabel-Paare: welche Wörter ----------

/** Die spielbaren Wörter der eigenen Listen (alle Listen, jedes Paar einmal). */
const eigeneVokabeln = (studentId: number): VokabelKandidat[] => vokabelKandidaten(vokabelQuelle(studentId).eintraege, EIGENE_VOKABELN);

const istVolksschule = (student: Pick<repo.Student, "grade" | "school_type">) => student.school_type === "Volksschule" || student.grade <= 4;
/** Die Themenlisten für die Schulart, in der Reihenfolge des Vokabeltrainers. */
export const vokabelThemen = (volksschule: boolean): string[] => Object.keys(VOKABEL_THEMEN).filter((id) => id.includes(".vs.") === volksschule);
/** „Wortschatz: Familie“ → „Familie“ */
export const themaName = (skillId: string) => (THEMEN.find((t) => t.id === skillId)?.name ?? "Vokabeln").replace(/^Wortschatz:\s*/, "");

/** So gut muss eine Runde sein, damit sie für „Thema geschafft“ zählt, und so viele solche Runden braucht es. */
const THEMA_ANTEIL = 0.8;
const THEMA_RUNDEN = 2;

export type VokabelPlan = {
  /** die Fähigkeit der Runde: die eigenen Listen oder das Thema */
  skillId: string;
  eigene: boolean;
  /** für den Schüler: „Deine Liste „Unit 3““ oder „Thema: Familie“ */
  titel: string;
  pool: VokabelKandidat[];
  /** eigene Listen: die Wörter der neuesten Liste kommen zuerst */
  vorrang?: Set<string>;
};

/**
 * Welche Wörter die nächste Runde „Vokabel-Paare“ hat. Hat der Schüler eigene Listen (mindestens vier Wörter), spielt
 * er sie; die neueste zuerst. Sonst eine Themenliste: ein Thema aus seinem Stoff, sonst das erste Thema seiner
 * Schulart, das er noch nicht geschafft hat (zwei Runden mit mindestens 80 %). Sind alle geschafft, das Thema, das am
 * längsten her ist.
 */
export function vokabelPlan(student: repo.Student, heute: string): VokabelPlan {
  const eigene = eigeneVokabeln(student.id);
  if (eigene.length >= PAARE_MIN) {
    const listen = listenVon(student.id);
    const neueste = listen[0];
    return {
      skillId: EIGENE_VOKABELN,
      eigene: true,
      titel: listen.length === 1 ? `Deine Liste „${neueste.title}“` : "Deine Vokabellisten",
      pool: eigene,
      vorrang: listen.length > 1 ? new Set(leseListe(neueste.text).eintraege.map(vokabelKey)) : undefined,
    };
  }
  const ausStoff = stoffQuellen(student, heute)
    .flatMap((q) => q.ids)
    .map((id) => Object.keys(VOKABEL_THEMEN).find((thema) => id === thema || id.startsWith(`${thema}.`)))
    .find((id): id is string => Boolean(id));
  const skillId = ausStoff ?? naechstesThema(student);
  return { skillId, eigene: false, titel: `Thema: ${themaName(skillId)}`, pool: vokabelKandidaten(VOKABEL_THEMEN[skillId], skillId) };
}

const naechstesThema = (student: repo.Student): string => naechstesOffene(student.id, "vokabeln", vokabelThemen(istVolksschule(student)));

/**
 * Das erste Thema der Liste, das noch nicht geschafft ist (zwei Runden mit mindestens 80 %); sind alle geschafft, das
 * Thema, das am längsten her ist.
 */
function naechstesOffene(studentId: number, art: SpielArt, themen: string[]): string {
  const runden = db()
    .prepare("SELECT id, skill_id, richtig, anzahl FROM spielrunden WHERE student_id = ? AND art = ? AND beendet_at IS NOT NULL AND anzahl > 0")
    .all(studentId, art) as { id: number; skill_id: string; richtig: number; anzahl: number }[];
  const gut = (thema: string) => runden.filter((r) => r.skill_id === thema && r.richtig / r.anzahl >= THEMA_ANTEIL).length;
  const offen = themen.find((thema) => gut(thema) < THEMA_RUNDEN);
  if (offen) return offen;
  const zuletzt = (thema: string) => Math.max(0, ...runden.filter((r) => r.skill_id === thema).map((r) => r.id));
  return [...themen].sort((a, b) => zuletzt(a) - zuletzt(b))[0];
}

// ---------- Themenspiele (English Tenses, English Grammar): welches Thema ----------

export type ThemenPlan = { skillId: string; /** für den Schüler: „Thema: Past Simple“ */ titel: string };

/**
 * Welches Thema die nächste Runde eines Themenspiels hat: ein Thema aus dem Stoff des Schülers (Prüfung, aktueller
 * Stoff, letzte Einheit), sonst das erste Thema seiner Schulstufe, das er noch nicht geschafft hat (das Neueste zuerst).
 * null für Spiele ohne Themen.
 */
export function themenPlan(student: repo.Student, art: SpielArt, heute: string): ThemenPlan | null {
  if (!SPIEL_THEMEN[art]) return null;
  const themen = spielbareThemen(art);
  const ausStoff = stoffQuellen(student, heute)
    .flatMap((q) => q.ids)
    .map((id) => themen.find((t) => themaPasst(t, id)))
    .find((t): t is SpielThema => Boolean(t));
  const reihe = themenFuerStufe(art, student.grade);
  const thema = ausStoff ?? reihe.find((t) => t.skill === naechstesOffene(student.id, art, reihe.map((t) => t.skill))) ?? reihe[0];
  return { skillId: thema.skill, titel: `Thema: ${thema.name}` };
}

/** Woher die Karten der nächsten Runde kommen, für den Schüler („Thema: Familie“, „Deine Liste …“); leer bei festen Spielen. */
export function spielWoher(student: repo.Student, art: SpielArt, heute: string): string | undefined {
  if (art === "vokabeln") return vokabelPlan(student, heute).titel;
  return themenPlan(student, art, heute)?.titel;
}

/** Die Kisten einer Karte des Themas, für den Anfang des Spiels (damit dort nicht „some, any“ steht, wenn es um if-Sätze geht). */
export function spielVorschau(student: repo.Student, art: SpielArt, heute: string): string[] | undefined {
  const plan = themenPlan(student, art, heute);
  if (!plan) return undefined;
  // von den ersten Karten die mit den kürzesten Aufschriften: drei kleine Kisten in einer Zeile
  const laenge = (f: string[]) => f.join("").length;
  return englischKandidaten(plan.skillId)
    .slice(0, 24)
    .map((k) => k.karte.faecher)
    .sort((x, y) => laenge(x) - laenge(y))[0];
}

/** Satzbau in der Volksschule hängt an der Fähigkeit der Volksschule, sonst an der Umstellprobe der Unterstufe. */
const satzbauSkill = (student: Pick<repo.Student, "grade" | "school_type">) => (istVolksschule(student) ? "deutsch.vs.sprache.satzglieder" : SPIEL_SKILL.satzbau);

/** Die Fähigkeit, an der die nächste Runde eines Spiels hängt (für den Stand auf der Kachel und im Spiel). */
export function skillFuerSpiel(student: repo.Student, art: SpielArt, heute: string): string {
  if (art === "vokabeln") return vokabelPlan(student, heute).skillId;
  if (art === "satzbau") return satzbauSkill(student);
  return themenPlan(student, art, heute)?.skillId ?? SPIEL_SKILL[art];
}

/** Karten für ein Duell „Vokabel-Paare“: eine Themenliste für die jüngere Schulstufe, für beide dieselbe. */
export function duellVokabeln(schulstufe: number, volksschule: boolean, rng: () => number = Math.random): SpielKarte[] {
  const themen = vokabelThemen(volksschule);
  const thema = themen[Math.floor(rng() * themen.length)];
  return waehleVokabeln(vokabelKandidaten(VOKABEL_THEMEN[thema], thema), { stufen: vokabelStufen(schulstufe, volksschule, null), rng });
}

/** Karten für ein Duell in einem Themenspiel: ein Thema, das für die jüngere Schulstufe schon dran war, für beide dasselbe. */
export function duellThema(art: SpielArt, schulstufe: number, rng: () => number = Math.random): SpielKarte[] {
  const themen = themenFuerStufe(art, schulstufe);
  const thema = themen[Math.floor(rng() * themen.length)];
  return waehleKarten(art, { pool: englischKandidaten(thema.skill), stufen: stufenFuer(art, schulstufe, null), rng });
}

// ---------- Runden ----------

type Zeile = {
  id: number;
  student_id: number;
  art: string;
  skill_id: string;
  grund: string;
  karten: string;
  antworten: string;
  anzahl: number;
  richtig: number;
  created_at: string;
  beendet_at: string | null;
};

type GespeicherteAntwort = SpielAntwort & { richtig: boolean };

/** Keys der Karten, die in den letzten beendeten Runden zuerst falsch waren und seither nicht richtig. */
export function offeneFehler(studentId: number, art: SpielArt, runden = 5): string[] {
  const rows = db()
    .prepare("SELECT antworten FROM spielrunden WHERE student_id = ? AND art = ? AND beendet_at IS NOT NULL ORDER BY id DESC LIMIT ?")
    .all(studentId, art, runden) as { antworten: string }[];
  const erledigt = new Set<string>();
  const offen: string[] = [];
  for (const r of rows) {
    for (const a of json<GespeicherteAntwort[]>(r.antworten, [])) {
      if (a.richtig) erledigt.add(a.key);
      else if (!erledigt.has(a.key) && !offen.includes(a.key)) offen.push(a.key);
    }
  }
  return offen;
}

/** Karten der letzten zwei Runden: kommen in der nächsten nicht gleich wieder (außer als Fehler). */
function zuletztGespielt(studentId: number, art: SpielArt): string[] {
  const rows = db().prepare("SELECT karten FROM spielrunden WHERE student_id = ? AND art = ? ORDER BY id DESC LIMIT 2").all(studentId, art) as { karten: string }[];
  return rows.flatMap((r) => json<SpielKarte[]>(r.karten, []).map((k) => k.key));
}

/** Startet eine Runde: wählt die Karten und merkt sie sich, damit das Ergebnis nur gegen sie geprüft wird. */
export function starteRunde(student: repo.Student, art: SpielArt, o: { grund?: SpielVorschlag["quelle"]; lernstand?: number | null; rng?: () => number; heute?: string } = {}): { rundeId: number; karten: SpielKarte[] } {
  // nicht beendete Runden von gestern und früher räumen sich selbst weg
  db().prepare("DELETE FROM spielrunden WHERE student_id = ? AND beendet_at IS NULL AND duell_id IS NULL AND created_at < datetime('now', '-1 day')").run(student.id);
  let karten: SpielKarte[];
  if (art === "vokabeln") {
    const plan = vokabelPlan(student, o.heute ?? wienerDatum());
    karten = waehleVokabeln(plan.pool, {
      // eigene Listen haben keine Stufen: alle Wörter sind Stoff
      stufen: plan.eigene ? undefined : vokabelStufen(student.grade, istVolksschule(student), o.lernstand ?? null),
      wiederholen: offeneFehler(student.id, art),
      zuletzt: zuletztGespielt(student.id, art),
      vorrang: plan.vorrang,
      rng: o.rng,
    });
  } else {
    const plan = themenPlan(student, art, o.heute ?? wienerDatum());
    karten = waehleKarten(art, {
      pool: plan ? englischKandidaten(plan.skillId) : undefined,
      stufen: stufenFuer(art, student.grade, o.lernstand ?? null),
      wiederholen: offeneFehler(student.id, art),
      zuletzt: zuletztGespielt(student.id, art),
      rng: o.rng,
    });
  }
  const r = db()
    .prepare("INSERT INTO spielrunden (student_id, art, skill_id, grund, karten, anzahl) VALUES (?, ?, ?, ?, ?, ?)")
    .run(student.id, art, karten[0]?.skill ?? (art === "satzbau" ? satzbauSkill(student) : SPIEL_SKILL[art]), o.grund ?? "fach", JSON.stringify(karten), karten.length);
  return { rundeId: Number(r.lastInsertRowid), karten };
}

/**
 * Startet eine Runde mit vorgegebenen Karten (Duell, lib/duelle.ts): beide Spieler bekommen dieselben Karten. Zählt im
 * Lernstand wie jede andere Runde.
 */
export function starteRundeMitKarten(studentId: number, art: SpielArt, karten: SpielKarte[], duellId: number): number {
  const r = db()
    .prepare("INSERT INTO spielrunden (student_id, art, skill_id, grund, karten, anzahl, duell_id) VALUES (?, ?, ?, 'duell', ?, ?, ?)")
    .run(studentId, art, karten[0]?.skill ?? SPIEL_SKILL[art], JSON.stringify(karten), karten.length, duellId);
  return Number(r.lastInsertRowid);
}

export type RundenErgebnis = { richtig: number; anzahl: number; sterne: 1 | 2 | 3; nochmal: SpielKarte[] };

/**
 * Beendet eine Runde mit der ersten Wahl je Karte. Gezählt wird nur gegen die gespeicherten Karten; fehlt eine
 * Antwort, zählt die Karte als falsch. Eine Runde lässt sich nur einmal beenden (ein zweiter Aufruf liefert das
 * gespeicherte Ergebnis, damit ein doppelter Tipp nichts doppelt zählt).
 */
export function beendeRunde(studentId: number, rundeId: number, antworten: SpielAntwort[]): RundenErgebnis | null {
  const z = db().prepare("SELECT * FROM spielrunden WHERE id = ? AND student_id = ?").get(rundeId, studentId) as Zeile | undefined;
  if (!z) return null;
  const karten = json<SpielKarte[]>(z.karten, []);
  if (z.beendet_at) {
    const alt = json<GespeicherteAntwort[]>(z.antworten, []);
    const falsch = new Set(alt.filter((a) => !a.richtig).map((a) => a.key));
    return { richtig: z.richtig, anzahl: z.anzahl, sterne: sterneFuer(z.richtig, z.anzahl), nochmal: karten.filter((k) => falsch.has(k.key)) };
  }
  const wahl = new Map<string, string>();
  for (const a of antworten) if (typeof a?.key === "string" && typeof a?.wahl === "string" && !wahl.has(a.key)) wahl.set(a.key, a.wahl);
  const gespeichert: GespeicherteAntwort[] = karten.map((k) => ({ key: k.key, wahl: wahl.get(k.key) ?? "", richtig: wahl.get(k.key) === k.richtig }));
  const richtig = gespeichert.filter((a) => a.richtig).length;
  db().prepare("UPDATE spielrunden SET antworten = ?, richtig = ?, beendet_at = datetime('now') WHERE id = ?").run(JSON.stringify(gespeichert), richtig, rundeId);
  return { richtig, anzahl: karten.length, sterne: sterneFuer(richtig, karten.length), nochmal: karten.filter((k) => !wahl.has(k.key) || wahl.get(k.key) !== k.richtig) };
}

/** Die Fähigkeit einer Runde dieses Schülers (null, wenn es sie nicht gibt). */
export function rundenSkill(studentId: number, rundeId: number): string | null {
  const z = db().prepare("SELECT skill_id FROM spielrunden WHERE id = ? AND student_id = ?").get(rundeId, studentId) as { skill_id: string } | undefined;
  return z?.skill_id ?? null;
}

/** Wiener Datum einer Zeit aus SQLite (UTC). */
const tagVon = (s: string) => wienerDatum(new Date(parseTime(s)));

/** Tage am Stück mit mindestens einer beendeten Runde, bis heute (oder bis gestern, wenn heute noch keine war). */
export function serie(studentId: number, heute: string): number {
  const tage = new Set(
    (db().prepare("SELECT beendet_at FROM spielrunden WHERE student_id = ? AND beendet_at IS NOT NULL ORDER BY id DESC LIMIT 400").all(studentId) as { beendet_at: string }[]).map((r) =>
      tagVon(r.beendet_at),
    ),
  );
  let tag = tage.has(heute) ? heute : tagAddieren(heute, -1);
  let n = 0;
  while (tage.has(tag)) {
    n++;
    tag = tagAddieren(tag, -1);
  }
  return n;
}

/** Beendete Runden als Belege für den Lernstand (lib/analysis.ts collectEvidence). */
export function spielBelege(studentId: number): { skillId: string; score: number; at: string }[] {
  return (
    db().prepare("SELECT skill_id, richtig, anzahl, beendet_at FROM spielrunden WHERE student_id = ? AND beendet_at IS NOT NULL AND anzahl > 0").all(studentId) as {
      skill_id: string;
      richtig: number;
      anzahl: number;
      beendet_at: string;
    }[]
  ).map((r) => ({ skillId: r.skill_id, score: r.richtig / r.anzahl, at: r.beendet_at }));
}

export type SpielUebersicht = {
  runden: { art: SpielArt; richtig: number; anzahl: number; tag: string }[];
  /** Was zuletzt öfter falsch war, mit der richtigen Lösung („die Haustür“) */
  fehler: { loesung: string; mal: number }[];
};

/** Für den Lehrer im Profil: die letzten Runden der letzten 30 Tage und die häufigsten Fehler. */
export function spielUebersicht(studentId: number, heute: string): SpielUebersicht {
  const rows = db()
    .prepare("SELECT * FROM spielrunden WHERE student_id = ? AND beendet_at IS NOT NULL ORDER BY id DESC LIMIT 60")
    .all(studentId) as Zeile[];
  const seit = tagAddieren(heute, -30);
  const frisch = rows.filter((r) => tagVon(r.beendet_at!) >= seit && istSpielArt(r.art));
  const zaehler = new Map<string, number>();
  for (const r of frisch) {
    const karten = new Map(json<SpielKarte[]>(r.karten, []).map((k) => [k.key, k]));
    for (const a of json<GespeicherteAntwort[]>(r.antworten, [])) {
      const k = karten.get(a.key);
      if (!a.richtig && k) zaehler.set(k.loesung, (zaehler.get(k.loesung) ?? 0) + 1);
    }
  }
  return {
    runden: frisch.map((r) => ({ art: r.art as SpielArt, richtig: r.richtig, anzahl: r.anzahl, tag: tagVon(r.beendet_at!) })),
    fehler: [...zaehler.entries()]
      .map(([loesung, mal]) => ({ loesung, mal }))
      .sort((a, b) => b.mal - a.mal)
      .slice(0, 6),
  };
}

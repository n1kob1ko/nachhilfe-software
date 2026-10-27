/**
 * **Prüfungsstoff** (niko, 25.10.2026: „Mehrere Fotos gemeinsam auswerten“ und „Stoff erkennen“). Lehrer oder Schüler
 * laden für eine Prüfung mehrere Fotos oder ein PDF mit mehreren Seiten hoch: den Stoffzettel, dazu etwa das
 * Inhaltsverzeichnis des Buchs. Alle Seiten gehen in **einer** Anfrage an die KI (Funktion `stoffzettel`), zusammen mit
 * den Fähigkeiten der App für Fach und Schulstufe. Die KI sagt je Datei, was sie ist (Stoffzettel, Inhaltsverzeichnis,
 * Erklärung, Aufgaben, sonstiges; niko, 27.10.2026: „Lernheft muss unterscheiden, ob das Dokument ein Thema erklärt, eine
 * Aufgabe enthält oder den Prüfungsumfang festlegt“), und je Punkt: Gruppe, Wortlaut, Lerninhalt, Unit, Quelle, ob er zur
 * Prüfung gehört (pruefung, ausgeschlossen, unklar) und eine passende Fähigkeit.
 *
 * Die App prüft die Antwort (`lesungAusAntwort`):
 * - der Stoffzettel legt den Umfang fest: nennt er Units 1–3, fällt ein Punkt des Inhaltsverzeichnisses aus Unit 4 weg;
 * - was der Stoffzettel ausschließt („Nicht Stoff sind videos (Stones, Twins), songs“), ist auch im Inhaltsverzeichnis
 *   ausgeschlossen („A song 4 U“, „The Twins 1“);
 * - eine Überschrift einer Unit („How embarrassing!“) ist Umfang und nie eine Fähigkeit;
 * - eine Erklärung oder ein Blatt mit Aufgaben legt nie den Umfang fest: ihre Punkte sind Themen für heute (lib/vorgabe.ts),
 *   an einer Prüfung nur „noch zu klären“ (`fuerPruefung`).
 * Die Rolle einer Datei kann die Lehrkraft ändern (`setzeRolle`, an der Datei gespeichert); die Lesung wird dann ohne neue
 * Anfrage aus der gespeicherten Antwort neu gemacht.
 *
 * Dann ordnet sie zu (`ordneZu`): Fähigkeit der KI und der Vorschlag aus den Wörtern (lib/lehrplan.ts `stoffVorschlag`)
 * stimmen überein → **sicher**, sie wird gleich verknüpft; widersprechen sie sich oder ist nur einer unsicher dafür →
 * **unklar**, eine kurze Bestätigung in „Erkannt“; nichts passt → **keine**, der Punkt bleibt als Prüfungsstoff
 * gespeichert. Nie wird eine falsche Fähigkeit erzwungen, nie geht Prüfungsstoff verloren.
 *
 * Kosten: dieselben Dateien (gleiche sha256, gleiche Fassung des Prompts, gleiche Fähigkeiten) werden nie ein zweites
 * Mal bezahlt; das Ergebnis steht in `stoff_lesungen`. Gelesen wird nur auf das Hochladen von Lehrer oder Schüler hin,
 * nie im Hintergrund, und nur nach „kein Name darauf“.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { aiEnabled, aiReadsImages, lesePruefungsstoff, STOFF_GRUPPEN, STOFF_ROLLEN, STOFF_STATUS, type PruefungsstoffGelesen, type StoffKandidat, type StoffzettelGelesen } from "./ai";
import { budgetUsedUp, schuelerGestoppt } from "./ai/router";
import { grenzeErreichtText } from "./ai/schueler-kosten";
import { db, json } from "./db";
import { merkeZuordnung, skillsForPrompt, skillsForStudent, stoffVorschlag } from "./lehrplan";
import { getMaterial, hatDatei, materialFile, MAX_ANALYSIS_IMAGE_BYTES, MAX_ANALYSIS_PDF_BYTES, sniffType } from "./materials";
import { detectNames, namesAfterRelation } from "./name-detection";
import * as repo from "./repo";
import { checkLevel } from "./school";
import { maskText, namePattern } from "./text-correction-core";
import { SUCHWOERTER } from "./themen";

/** Höchstens so viele Dateien (Fotos oder PDFs) je Prüfung auf einmal. */
export const MAX_DATEIEN = 8;
/** Höchstens so viel zusammen in einer Anfrage ans Hochladen (Fotos werden im Browser verkleinert). */
export const MAX_GESAMT_BYTES = 40 * 1024 * 1024;
/** Fassung des Prompts: ändert sie sich, wird eine Datei neu gelesen (das alte Ergebnis passt nicht mehr). */
export const PROMPT_FASSUNG = "pruefungsstoff-2";
/** Höchstens so viele Punkte je Lesung. */
export const MAX_PUNKTE = 80;
/** Höchstens so viele Themen für `tests.topics`. */
export const MAX_THEMEN = 24;

export type Gruppe = (typeof STOFF_GRUPPEN)[number];
export type Rolle = (typeof STOFF_ROLLEN)[number];
export type StoffStatus = (typeof STOFF_STATUS)[number];
export type Quelle = "stoffzettel" | "inhaltsverzeichnis" | "erklaerung" | "aufgaben" | "lehrer" | "sonstiges";
/** sicher: gleich verknüpft; bestaetigt: vom Lehrer gewählt; unklar: kurz bestätigen; keine: es passt keine Fähigkeit. */
export type Zuordnung = "sicher" | "bestaetigt" | "unklar" | "keine";

export const GRUPPE_LABEL: Record<Gruppe, string> = {
  umfang: "Umfang",
  grammatik: "Grammatik",
  wortschatz: "Wortschatz",
  writing: "Schreiben",
  reading_listening: "Lesen und Hören",
  lektuere: "Lektüre",
  sonstiges: "Weiteres",
};
export const QUELLE_LABEL: Record<Quelle, string> = {
  stoffzettel: "Stoffzettel",
  inhaltsverzeichnis: "Inhaltsverzeichnis",
  erklaerung: "Erklärung",
  aufgaben: "Blatt mit Aufgaben",
  lehrer: "Deine Angabe",
  sonstiges: "Weiteres Blatt",
};
/** Die Rolle einer Datei in wenigen Worten („Foto 2: erklärt ein Thema“), auch für die Auswahl. */
export const ROLLE_SATZ: Record<Rolle, string> = {
  stoffzettel: "legt den Prüfungsstoff fest",
  inhaltsverzeichnis: "ist ein Inhaltsverzeichnis",
  erklaerung: "erklärt ein Thema",
  aufgaben: "enthält Aufgaben",
  sonstiges: "etwas anderes",
};
/** Erklärung und Aufgaben: Themen für heute, nie Prüfungsumfang. */
export const nurFuerHeute = (q: Quelle) => q === "erklaerung" || q === "aufgaben";
/** Was den Umfang festlegen oder etwas ausschließen darf: Stoffzettel, Angabe der Lehrkraft, ein weiteres Blatt. */
const legtUmfangFest = (q: Quelle) => q !== "inhaltsverzeichnis" && !nurFuerHeute(q);
export const STATUS_LABEL: Record<StoffStatus, string> = { pruefung: "Prüfungsstoff", ausgeschlossen: "ausgeschlossen", unklar: "noch zu klären" };

/** Ein Punkt, wie ihn die App aus der Antwort übernimmt; `skill_id` ist der Vorschlag der KI (noch nicht geprüft). */
export type RohPunkt = { gruppe: Gruppe; original: string; inhalt: string; einheit: string; dokument: number; quelle: Quelle; status: StoffStatus; grund: string; skill_id: string | null };
/** Ein Punkt nach dem Zuordnen: `skill_id` nur bei sicher oder bestätigt; `vorschlaege` die Fähigkeiten zur Auswahl bei unklar. */
export type StoffPunkt = Omit<RohPunkt, "skill_id"> & { skill_id: string | null; zuordnung: Zuordnung; vorschlaege: string[] };
export type StoffZeile = StoffPunkt & { id: number; test_id: number; pos: number };

export type Lesung = {
  kopf: StoffzettelGelesen;
  dokumente: { nr: number; rolle: Rolle; titel: string }[];
  punkte: RohPunkt[];
  schwierigkeiten: string[];
  termin_text: string | null;
  /** Punkte, die die App weggelassen hat (außerhalb des Umfangs oder doppelt) */
  weggelassen: number;
};

const eineZeile = (s: unknown, max: number) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const istGruppe = (x: unknown): x is Gruppe => (STOFF_GRUPPEN as readonly unknown[]).includes(x);
export const istRolle = (x: unknown): x is Rolle => (STOFF_ROLLEN as readonly unknown[]).includes(x);
const istStatus = (x: unknown): x is StoffStatus => (STOFF_STATUS as readonly unknown[]).includes(x);

/** Eine Überschrift eines Kapitels: „Unit 2: How embarrassing!“, „Kapitel 4“. */
const UEBERSCHRIFT = /^\s*(?:unit|units|kapitel|chapter|lektion|lesson|module|modul)\s*\d+\b/i;

/** Die Nummern der Units, die der Stoffzettel nennt („More Units 1-3“, „Unit 1, 2 und 3“); leer, wenn keine. */
export function unitsImUmfang(texte: string[]): Set<number> {
  const out = new Set<number>();
  for (const t of texte) {
    for (const m of t.matchAll(/\b(?:units?|kapitel|chapters?|lektion(?:en)?|lessons?|modules?|module?)\s*((?:\d+\s*(?:[-–—]|bis|to|,|und|and|&)\s*)*\d+)/gi)) {
      const teil = m[1];
      for (const r of teil.matchAll(/(\d+)\s*(?:[-–—]|bis|to)\s*(\d+)/g)) for (let i = Number(r[1]); i <= Math.min(Number(r[2]), Number(r[1]) + 40); i++) out.add(i);
      for (const z of teil.matchAll(/\d+/g)) out.add(Number(z[0]));
    }
  }
  return out;
}
/** Die Nummer der Unit eines Punkts aus `einheit` oder dem Wortlaut („Unit 4: …“); null, wenn keine. */
const unitVon = (p: Pick<RohPunkt, "einheit" | "original">) => {
  const m = `${p.einheit} ${p.original}`.match(/\b(?:unit|kapitel|chapter|lektion|lesson|module|modul)\s*(\d+)/i);
  return m ? Number(m[1]) : null;
};

/** Wörter, die beim Ausschließen nichts sagen. */
const AUSSCHLUSS_STOPP = new Set(["nicht", "stoff", "sind", "kein", "keine", "etc", "usw", "alle", "auch", "the", "and", "und", "oder", "with", "mit"]);
/** Die Wörter eines Wortlauts, klein und ohne Plural-s („Videos“ → video, „Twins“ → twin). */
const woerter = (s: string) =>
  s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 4 && !AUSSCHLUSS_STOPP.has(w))
    .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w));

/**
 * Prüft die Antwort der KI und macht daraus die Lesung. Nimmt auch die frühere Antwort (nur Themen) an. Was nicht passt,
 * wird verbessert oder fällt weg; erfunden wird nichts. `dateien`: wie viele Dateien gelesen wurden; `rollen`: Rollen, die
 * die Lehrkraft gewählt hat (Nummer der Datei → Rolle), gehen der KI vor.
 */
export function lesungAusAntwort(g: PruefungsstoffGelesen | StoffzettelGelesen, o: { dateien: number; rollen?: Map<number, Rolle> }): Lesung {
  const voll = "punkte" in g && Array.isArray(g.punkte);
  const dokumente = new Map<number, Rolle>();
  if (voll) for (const d of (g as PruefungsstoffGelesen).dokumente ?? []) if (Number.isInteger(d?.nr) && d.nr >= 1 && d.nr <= o.dateien && istRolle(d.rolle)) dokumente.set(d.nr, d.rolle);
  for (const [nr, rolle] of o.rollen ?? []) if (nr >= 1 && nr <= o.dateien) dokumente.set(nr, rolle);
  // a single file without a role is the Stoffzettel
  if (o.dateien === 1 && !dokumente.size) dokumente.set(1, "stoffzettel");
  const quelleVon = (nr: number): Quelle => (nr === 0 ? "lehrer" : (dokumente.get(nr) ?? "sonstiges"));

  const roh: RohPunkt[] = voll
    ? (g as PruefungsstoffGelesen).punkte.map((p) => {
        const original = eineZeile(p?.original, 200);
        const nr = Number.isInteger(p?.dokument) && p.dokument >= 0 && p.dokument <= o.dateien ? p.dokument : o.dateien ? 1 : 0;
        const gruppe: Gruppe = UEBERSCHRIFT.test(original) ? "umfang" : istGruppe(p?.gruppe) ? p.gruppe : "sonstiges";
        const status: StoffStatus = istStatus(p?.status) ? p.status : "pruefung";
        return {
          gruppe,
          original,
          inhalt: eineZeile(p?.inhalt, 120) || original.slice(0, 120),
          einheit: eineZeile(p?.einheit, 40),
          dokument: nr,
          quelle: quelleVon(nr),
          status,
          grund: status === "pruefung" ? "" : eineZeile(p?.grund, 200),
          skill_id: gruppe === "umfang" || gruppe === "lektuere" || status === "ausgeschlossen" ? null : eineZeile(p?.skill_id, 80) || null,
        };
      })
    : // the earlier answer: topics only, all from the sheet
      (g as StoffzettelGelesen).themen
        .flatMap((t) => String(t).split(/[,;\n]+/))
        .map((t) => eineZeile(t.replace(/^\s*(?:[-•*·]\s*|\d{1,2}[.)]\s+)/, ""), 200))
        .filter(Boolean)
        .map((t) => ({ gruppe: "sonstiges" as const, original: t, inhalt: t.slice(0, 120), einheit: "", dokument: o.dateien ? 1 : 0, quelle: quelleVon(o.dateien ? 1 : 0), status: "pruefung" as const, grund: "", skill_id: null }));

  let weggelassen = 0;
  const gesehen = new Set<string>();
  const punkte: RohPunkt[] = [];
  for (const p of roh) {
    const key = `${p.gruppe}|${p.dokument}|${p.original.toLowerCase()}`;
    if (!p.original || gesehen.has(key)) {
      if (p.original) weggelassen++;
      continue;
    }
    gesehen.add(key);
    punkte.push(p);
  }

  // the Stoffzettel sets the scope: a point of the table of contents from another unit is no Prüfungsstoff; the „Unit 4“
  // of a worksheet sets nothing
  const umfang = unitsImUmfang(punkte.filter((p) => p.gruppe === "umfang" && p.status === "pruefung" && legtUmfangFest(p.quelle)).map((p) => `${p.original} ${p.inhalt}`));
  // what the Stoffzettel excludes is excluded in the table of contents too („videos (Stones, Twins)“ → „The Twins 1“)
  const aus = punkte.filter((p) => p.status === "ausgeschlossen" && legtUmfangFest(p.quelle)).map((p) => ({ p, w: new Set(woerter(p.original)) }));
  const gefiltert: RohPunkt[] = [];
  for (const p of punkte) {
    if (p.quelle === "inhaltsverzeichnis" && umfang.size) {
      const u = unitVon(p);
      if (u !== null && !umfang.has(u)) {
        weggelassen++;
        continue;
      }
    }
    if (p.quelle !== "stoffzettel" && p.quelle !== "lehrer" && p.status !== "ausgeschlossen") {
      const treffer = aus.find((a) => woerter(p.original).some((w) => a.w.has(w)));
      if (treffer) {
        gefiltert.push({ ...p, status: "ausgeschlossen", grund: `Laut Stoffzettel nicht Stoff: ${treffer.p.original}`.slice(0, 200), skill_id: null });
        continue;
      }
    }
    gefiltert.push(p);
  }
  weggelassen += Math.max(0, gefiltert.length - MAX_PUNKTE);
  const fertig = gefiltert.slice(0, MAX_PUNKTE);

  const kopf: StoffzettelGelesen = {
    art: g.art ?? null,
    fach: g.fach ?? null,
    datum: g.datum ?? null,
    titel: g.titel ?? null,
    themen: themenAus(fertig),
    unsicher: (g.unsicher ?? []).map((u) => eineZeile(u, 140)).filter(Boolean).slice(0, 6),
  };
  return {
    kopf,
    dokumente: [...dokumente].sort((a, b) => a[0] - b[0]).map(([nr, rolle]) => ({ nr, rolle, titel: eineZeile((voll ? (g as PruefungsstoffGelesen).dokumente.find((d) => d.nr === nr)?.titel : "") ?? "", 120) })),
    punkte: fertig,
    schwierigkeiten: voll ? ((g as PruefungsstoffGelesen).schwierigkeiten ?? []).map((s) => eineZeile(s, 160)).filter(Boolean).slice(0, 5) : [],
    termin_text: voll ? eineZeile((g as PruefungsstoffGelesen).termin_text, 60) || null : null,
    weggelassen,
  };
}

/**
 * Die Themen für das Feld „Stoff“ einer Prüfung (`tests.topics`): die Lerninhalte, die zur Prüfung gehören, ohne
 * Umfang; zuerst die vom Stoffzettel und der Angabe der Lehrkraft (das Inhaltsverzeichnis ergänzt nur), ohne Doppelte.
 * Eine Erklärung oder ein Blatt mit Aufgaben gibt keine Themen der Prüfung.
 */
export function themenAus(punkte: Pick<RohPunkt, "gruppe" | "status" | "quelle" | "inhalt" | "original">[]): string[] {
  const zaehlt = punkte.filter((p) => p.status === "pruefung" && p.gruppe !== "umfang" && !nurFuerHeute(p.quelle));
  const vorne = zaehlt.filter((p) => p.quelle !== "inhaltsverzeichnis");
  const out: string[] = [];
  for (const p of vorne.length ? vorne : zaehlt) {
    const t = p.inhalt || p.original;
    if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out.slice(0, MAX_THEMEN);
}

/**
 * Die Punkte für den Prüfungsstoff einer Prüfung: was nur von einer Erklärung oder einem Blatt mit Aufgaben stammt, legt
 * den Umfang nicht fest. Es geht nicht verloren, sondern ist „noch zu klären“ (zählt erst nach „Gehört dazu“).
 */
export function fuerPruefung<T extends Pick<RohPunkt, "quelle" | "status" | "grund">>(punkte: T[]): T[] {
  return punkte.map((p) =>
    nurFuerHeute(p.quelle) && p.status === "pruefung" ? { ...p, status: "unklar" as const, grund: `Nur auf ${p.quelle === "aufgaben" ? "einem Blatt mit Aufgaben" : "einer Erklärung"}, nicht auf dem Stoffzettel` } : p,
  );
}

// ---------- zuordnen ----------

/** Was mit den Wörtern verglichen wird: der Lerninhalt und, wenn anders, der Wortlaut auf dem Blatt. */
/** Der Bereich einer Gruppe in den Themen einer Fähigkeit (Englisch: Tenses, Grammar, Vocabulary …). */
const BEREICH: Partial<Record<Gruppe, RegExp>> = {
  grammatik: /tense|grammar|grammatik|zeitform/i,
  wortschatz: /vocab|wortschatz/i,
  writing: /writing|schreib/i,
  reading_listening: /reading|listening|lesen|hören/i,
};
const BEKANNT = [...Object.values(BEREICH), /speaking|sprechen/i];
/**
 * Passt eine Fähigkeit zur Gruppe des Punkts? Ein Vorschlag nur aus den Wörtern ohne Zustimmung der KI wird so
 * gefiltert („Vokabeln in Sätzen verwenden“ ist kein Lesen). Ein Bereich, den keine Gruppe kennt (Mathematik), passt immer.
 */
const imBereich = (id: string, gruppe: Gruppe) => {
  const area = repo.getSkill(id)?.area ?? "";
  const r = BEREICH[gruppe];
  return !r || !BEKANNT.some((x) => x!.test(area)) || r.test(area);
};

const vergleichstext = (p: Pick<RohPunkt, "inhalt" | "original">) => (p.inhalt && p.inhalt.toLowerCase() !== p.original.toLowerCase() ? `${p.inhalt} (${p.original})` : p.original);

/**
 * Ordnet jedem Punkt eine Fähigkeit zu, ohne KI-Anfrage: den Vorschlag der KI (`skill_id`, nur aus Fach und Stufe des
 * Schülers) und den Vorschlag aus den Wörtern (`stoffVorschlag`, mit dem Gedächtnis der Lehrer).
 * - Gedächtnis: was ein Lehrer für dieselben Wörter gewählt hat, gilt (auch „nichts“).
 * - Beide gleich, oder die KI nennt die erste Fähigkeit, für die die Wörter sprechen: sicher.
 * - Die KI nennt eine, die Wörter eine andere oder keine: unklar, beide zur Auswahl.
 * - Die KI nennt keine, die Wörter sind sicher (eine oder zwei) und im Bereich der Gruppe (Grammatik, Wortschatz,
 *   Schreiben, Lesen und Hören): unklar. Ein ganzes Thema (mehr als zwei) oder ein anderer Bereich: keine. Ein Punkt aus
 *   dem Text der Lehrkraft („Writing“) ist auch als ganzes Thema unklar, mit denselben Vorschlägen wie ohne KI.
 * - Ohne KI-Antwort (`ki` false): die Wörter allein; sicher, wenn der Punkt genau so heißt wie eine Fähigkeit (oder eine
 *   ihrer anderen Bezeichnungen) oder die Wörter eine oder zwei Fähigkeiten sicher nennen, sonst unklar mit den Vorschlägen.
 * Umfang und Ausgeschlossenes bekommen nie eine Fähigkeit, eine Lektüre nur über die Bestätigung.
 */
export function ordneZu(punkte: RohPunkt[], o: { fach: string; student: Pick<repo.Student, "school_type" | "klasse" | "grade">; ki: boolean }): StoffPunkt[] {
  const pool = new Set(skillsForStudent(o.student, o.fach, { earlier: true }).map((s) => s.id));
  const welche = punkte.map((p, i) => ({ p, i })).filter(({ p }) => p.status !== "ausgeschlossen" && p.gruppe !== "umfang");
  const regel = o.fach ? stoffVorschlag(welche.map(({ p }) => vergleichstext(p)), o.fach, o.student) : [];
  const nachIndex = new Map(welche.map(({ i }, j) => [i, regel[j]]));
  const uniq = (xs: string[]) => [...new Set(xs.filter((id) => pool.has(id)))];
  return punkte.map((p, i) => {
    const basis = { ...p, skill_id: null as string | null, zuordnung: "keine" as Zuordnung, vorschlaege: [] as string[] };
    const v = nachIndex.get(i);
    if (!v) return basis;
    const sicher = (id: string, rest: string[] = []): StoffPunkt => ({ ...basis, skill_id: id, zuordnung: "sicher", vorschlaege: uniq(rest).filter((x) => x !== id).slice(0, 3) });
    const unklar = (ids: string[]): StoffPunkt => (uniq(ids).length ? { ...basis, zuordnung: "unklar", vorschlaege: uniq(ids).slice(0, 4) } : basis);
    const best = uniq(v.best);
    const kandidaten = uniq(v.skills.map((s) => s.id));
    const ki = o.ki && p.skill_id && pool.has(p.skill_id) ? p.skill_id : null;
    if (v.gemerkt) return best.length ? sicher(best[0], best.slice(1)) : basis;
    if (p.gruppe === "lektuere") return ki ? unklar([ki]) : basis;
    // without KI: a point that is exactly the name of a skill or one of its other names („Present Simple“) is clear
    const genau = kandidaten.find((id) => [repo.getSkill(id)?.name ?? "", ...(SUCHWOERTER[id] ?? [])].some((w) => [p.inhalt, p.original].some((t) => t.trim().toLowerCase() === w.trim().toLowerCase())));
    if (!o.ki && genau) return sicher(genau, best);
    if (!o.ki) return best.length && best.length <= 2 ? sicher(best[0], best.slice(1)) : unklar([...best, ...kandidaten].filter((id) => imBereich(id, p.gruppe)).slice(0, 3));
    if (ki) {
      if (best.includes(ki) || (!best.length && kandidaten[0] === ki)) return sicher(ki, best);
      return unklar([ki, ...best, ...kandidaten]);
    }
    // the KI saw the list and named none: only words of the same area are worth a question
    const passend = best.filter((id) => imBereich(id, p.gruppe));
    if (passend.length && best.length <= 2) return unklar(passend);
    // what the teacher typed („Writing“) is today's topic even when it is a whole one: the same choice as without KI
    return p.quelle === "lehrer" ? unklar([...best, ...kandidaten].filter((id) => imBereich(id, p.gruppe)).slice(0, 3)) : basis;
  });
}

/** Die Fähigkeiten, die zur Prüfung zählen: sicher oder bestätigt zugeordnet, und der Punkt gehört zur Prüfung. */
export const skillsAus = (punkte: Pick<StoffPunkt, "status" | "zuordnung" | "skill_id">[]): string[] => [
  ...new Set(punkte.filter((p) => p.status === "pruefung" && (p.zuordnung === "sicher" || p.zuordnung === "bestaetigt") && p.skill_id).map((p) => p.skill_id!)),
];

// ---------- die Anfrage ----------

/**
 * Die Fähigkeiten, die mit der Anfrage gehen: je Fach des Schülers (oder dem genannten) die seiner Stufe und der drei
 * davor (`skillsForPrompt`), mit Thema und bis zu vier anderen Bezeichnungen.
 */
export function kandidatenFuer(student: Pick<repo.Student, "school_type" | "klasse" | "grade" | "subjects">, fach?: string): StoffKandidat[] {
  const faecher = [...new Set([fach, ...student.subjects].filter((f): f is string => Boolean(f)))];
  return faecher.flatMap((f) => skillsForPrompt(student, f).map((s) => ({ id: s.id, name: s.name, area: s.area, subject: s.subject, woerter: (SUCHWOERTER[s.id] ?? []).slice(0, 4) })));
}

/** Ob jetzt gelesen werden kann; sonst der Grund, in Worten für den Lehrer. `dateien` 0: nur eine getippte Angabe. */
export function pruefungsstoffLesbar(o: { dateien: number; studentId: number | null }): { ok: true } | { ok: false; grund: string } {
  if (!aiEnabled("stoffzettel")) return { ok: false, grund: "Lesen kann nur die KI, und die ist gerade nicht eingerichtet." };
  if (o.dateien && !aiReadsImages("stoffzettel")) return { ok: false, grund: "Im eingestellten KI-Modus kann die KI keine Fotos lesen." };
  if (budgetUsedUp("stoffzettel")) return { ok: false, grund: "Das KI-Budget für diesen Monat ist aufgebraucht." };
  if (o.studentId != null && schuelerGestoppt("stoffzettel", o.studentId)) return { ok: false, grund: grenzeErreichtText() };
  return { ok: true };
}

/** Namen in einer getippten Angabe: der Schüler, alle Lehrer und Schüler der App und jeder Name, den die App im Text findet. */
export function angabeOhneNamen(text: string, studentName: string): string {
  const bekannt = (db().prepare("SELECT name FROM teachers UNION SELECT name FROM students").all() as { name: string }[]).map((r) => r.name);
  const namen = [...new Set([studentName, ...bekannt, ...detectNames([text]), ...namesAfterRelation([text])])].filter(Boolean);
  return maskText(text.replace(/\s+/g, " ").trim(), namePattern(namen)).masked;
}

type Mime = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
export type LesungGespeichert = { id: number; studentId: number | null; dateien: { material_id: number; sha256: string }[]; lesung: Lesung; callId: number | null; createdAt: string };

type LesungRow = { id: number; schluessel: string; student_id: number | null; dateien: string; ergebnis: string; antwort: string | null; call_id: number | null; created_at: string };
const LEER: Lesung = { kopf: { art: null, fach: null, datum: null, titel: null, themen: [], unsicher: [] }, dokumente: [], punkte: [], schwierigkeiten: [], termin_text: null, weggelassen: 0 };

/** Die Rolle, die die Lehrkraft einer Datei gegeben hat; null, wenn sie keine gewählt hat. */
export function gewaehlteRolle(materialId: number): Rolle | null {
  const r = db().prepare("SELECT rolle FROM materials WHERE id = ? AND rolle_geprueft = 1").pluck().get(materialId);
  return istRolle(r) ? r : null;
}

/**
 * Die Lesung mit den Rollen, die die Lehrkraft gewählt hat: aus der gespeicherten Antwort der KI neu gemacht, ohne Anfrage.
 * Eine ältere Lesung ohne Antwort bekommt nur die neue Quelle je Punkt.
 */
function mitRollen(r: LesungRow): Lesung {
  const lesung = json<Lesung>(r.ergebnis, LEER);
  const dateien = json<{ material_id: number }[]>(r.dateien, []);
  const rollen = new Map<number, Rolle>();
  dateien.forEach((d, i) => {
    const rolle = gewaehlteRolle(d.material_id);
    if (rolle && lesung.dokumente.find((x) => x.nr === i + 1)?.rolle !== rolle) rollen.set(i + 1, rolle);
  });
  if (!rollen.size) return lesung;
  const antwort = r.antwort ? json<PruefungsstoffGelesen | null>(r.antwort, null) : null;
  if (antwort) return lesungAusAntwort(antwort, { dateien: dateien.length, rollen });
  const dokumente = dateien.map((_, i) => ({ nr: i + 1, rolle: rollen.get(i + 1) ?? lesung.dokumente.find((x) => x.nr === i + 1)?.rolle ?? "sonstiges", titel: lesung.dokumente.find((x) => x.nr === i + 1)?.titel ?? "" }));
  const punkte = lesung.punkte.map((p) => (p.dokument >= 1 && rollen.has(p.dokument) ? { ...p, quelle: rollen.get(p.dokument)! } : p));
  return { ...lesung, dokumente, punkte, kopf: { ...lesung.kopf, themen: themenAus(punkte) } };
}
const alsLesung = (r: LesungRow): LesungGespeichert => ({ id: r.id, studentId: r.student_id, dateien: json(r.dateien, []), lesung: mitRollen(r), callId: r.call_id, createdAt: r.created_at });

/**
 * Die Lehrkraft ändert die Rolle einer Datei („enthält Aufgaben“ statt „legt den Prüfungsstoff fest“). Gespeichert an der
 * Datei (Material), damit sie überall gilt und ein Blatt mit Aufgaben später gefunden wird; jede Lesung mit ihr folgt ohne
 * neue Anfrage.
 */
export function setzeRolle(materialId: number, rolle: Rolle): boolean {
  if (!istRolle(rolle)) return false;
  return db().prepare("UPDATE materials SET rolle = ?, rolle_geprueft = 1 WHERE id = ?").run(rolle, materialId).changes > 0;
}

export function getLesung(id: number | null | undefined): LesungGespeichert | null {
  if (!id) return null;
  const r = db().prepare("SELECT * FROM stoff_lesungen WHERE id = ?").get(id) as LesungRow | undefined;
  return r ? alsLesung(r) : null;
}

/** Der Schlüssel einer Lesung: Fassung des Prompts, die sortierten Dateien, die Angabe (ohne Namen), die Fähigkeiten der Anfrage. */
export function lesungsSchluessel(o: { hashes: string[]; angabe: string; kandidaten: string[] }): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify([PROMPT_FASSUNG, [...o.hashes].sort(), o.angabe, [...o.kandidaten].sort()]))
    .digest("hex");
}

/**
 * Liest alle Dateien (Material des Schülers) und die getippte Angabe in einer Anfrage. Dieselben Dateien mit derselben
 * Angabe kosten nur beim ersten Mal (`neu`); danach kommt das gespeicherte Ergebnis, auch ohne KI. Wirft einen Fehler mit
 * einem Satz für den Lehrer; die Dateien bleiben gespeichert. Die Angabe wird vorher ohne Namen geschrieben.
 */
export async function liesPruefungsstoff(o: { materialIds: number[]; angabe?: string; studentId: number; teacherId: number | null; heute: string; fach?: string; trigger?: string }): Promise<{ id: number; lesung: Lesung; neu: boolean }> {
  const student = repo.getStudent(o.studentId);
  if (!student) throw new Error("Diesen Schüler gibt es nicht.");
  const ids = [...new Set(o.materialIds)];
  if (ids.length > MAX_DATEIEN) throw new Error(`Höchstens ${MAX_DATEIEN} Fotos oder PDFs auf einmal.`);
  const angabe = o.angabe?.trim() ? angabeOhneNamen(o.angabe.slice(0, 1500), student.name) : "";
  if (!ids.length && !angabe) throw new Error("Bitte Fotos wählen oder kurz schreiben, was heute dran ist.");
  const dateien = dateienFuer(ids);
  const kandidaten = kandidatenFuer(student, o.fach);
  const schluessel = lesungsSchluessel({ hashes: dateien.map((d) => d.sha256), angabe, kandidaten: kandidaten.map((k) => k.id) });
  const schon = db().prepare("SELECT * FROM stoff_lesungen WHERE schluessel = ?").get(schluessel) as LesungRow | undefined;
  if (schon) return { id: schon.id, lesung: alsLesung(schon).lesung, neu: false };

  const geht = pruefungsstoffLesbar({ dateien: dateien.length, studentId: student.id });
  if (!geht.ok) throw new Error(geht.grund);
  const level = checkLevel(student.school_type, student.klasse, student.grade);
  const vorher = (db().prepare("SELECT COALESCE(MAX(id), 0) AS n FROM ai_calls").get() as { n: number }).n;
  const gelesen = await lesePruefungsstoff(
    dateien.map((d) => ({ mime: d.mime, base64: d.data.toString("base64") })),
    { heute: o.heute, faecher: student.subjects, schulstufe: level.status === "eindeutig" ? level.schulstufe : null, dateien: dateien.length, angabe, kandidaten },
    { teacherId: o.teacherId, studentId: student.id, trigger: o.trigger ?? "pruefungsstoff" },
  );
  if (!gelesen) throw new Error("Die KI hat die Unterlagen nicht gelesen.");
  const lesung = lesungAusAntwort(gelesen, { dateien: dateien.length });
  const call = db().prepare("SELECT id FROM ai_calls WHERE id > ? AND fn = 'stoffzettel' ORDER BY id DESC LIMIT 1").get(vorher) as { id: number } | undefined;
  const id = Number(
    db()
      .prepare("INSERT INTO stoff_lesungen (schluessel, student_id, dateien, ergebnis, antwort, call_id) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(schluessel) DO UPDATE SET ergebnis = excluded.ergebnis, antwort = excluded.antwort RETURNING id")
      .pluck()
      .get(schluessel, student.id, JSON.stringify(dateien.map((d) => ({ material_id: d.material_id, sha256: d.sha256 }))), JSON.stringify(lesung), JSON.stringify(gelesen), call?.id ?? null),
  );
  // the role on the file, so a worksheet can be found later; a role the teacher chose stays
  const rolle = db().prepare("UPDATE materials SET rolle = ? WHERE id = ? AND rolle_geprueft = 0");
  for (const d of lesung.dokumente) if (dateien[d.nr - 1]) rolle.run(d.rolle, dateien[d.nr - 1].material_id);
  // a role chosen earlier for one of these files counts at once
  return { id, lesung: getLesung(id)!.lesung, neu: true };
}

/**
 * Eine schon bezahlte Lesung genau dieser Dateien, ohne Anfrage und ohne KI; null, wenn es keine gibt. Zuerst die ohne
 * Angabe, sonst die neueste dieser Fassung mit denselben Dateien für diesen Schüler (gleiche sha256, auch zusammen mit einem
 * Text der Lehrkraft gelesen: dessen Punkte haben Dokument 0 und gehören nicht dazu). So kostet vorhandenes Material, das
 * schon gelesen wurde, nichts mehr, auch wenn heute ein anderer Text dazukommt.
 */
export function gespeicherteLesung(o: { materialIds: number[]; studentId: number; fach?: string }): { id: number; lesung: Lesung } | null {
  const student = repo.getStudent(o.studentId);
  const ids = [...new Set(o.materialIds)];
  if (!student || !ids.length || ids.length > MAX_DATEIEN) return null;
  let dateien: ReturnType<typeof dateienFuer>;
  try {
    dateien = dateienFuer(ids, { ohneDaten: true });
  } catch {
    return null;
  }
  const schluessel = lesungsSchluessel({ hashes: dateien.map((d) => d.sha256), angabe: "", kandidaten: kandidatenFuer(student, o.fach).map((k) => k.id) });
  const genau = db().prepare("SELECT * FROM stoff_lesungen WHERE schluessel = ?").get(schluessel) as LesungRow | undefined;
  // only readings with the stored answer are of this version of the prompt (older ones know fewer roles)
  const gleich = (r: LesungRow) => JSON.stringify(json<{ sha256: string }[]>(r.dateien, []).map((d) => d.sha256).sort()) === JSON.stringify(dateien.map((d) => d.sha256).sort());
  const r = genau ?? (db().prepare("SELECT * FROM stoff_lesungen WHERE student_id = ? AND antwort IS NOT NULL AND dateien != '[]' ORDER BY id DESC").all(student.id) as LesungRow[]).find(gleich);
  return r ? { id: r.id, lesung: alsLesung(r).lesung } : null;
}

/**
 * Die Dateien einer Lesung mit Prüfsumme und Inhalt; `ohneDaten`: nur die Prüfsumme, wenn sie am Material steht. Wirft mit
 * einem Satz für den Lehrer.
 */
function dateienFuer(ids: number[], o: { ohneDaten?: boolean } = {}): { material_id: number; sha256: string; mime: Mime; data: Buffer }[] {
  return ids.map((id) => {
    const m = getMaterial(id);
    if (!m || !hatDatei(m)) throw new Error("Eine Datei gibt es nicht mehr. Bitte noch einmal hochladen.");
    if (o.ohneDaten && m.sha256) return { material_id: m.id, sha256: m.sha256, mime: m.mime as Mime, data: Buffer.alloc(0) };
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
    return { material_id: m.id, sha256: m.sha256 || crypto.createHash("sha256").update(data).digest("hex"), mime: type.mime as Mime, data };
  });
}

// ---------- gespeichert an der Prüfung ----------

type ZeilenRow = Omit<StoffZeile, "vorschlaege"> & { vorschlaege: string };
const alsZeile = (r: ZeilenRow): StoffZeile => ({ ...r, vorschlaege: json<string[]>(r.vorschlaege, []) });

/** Der Prüfungsstoff einer Prüfung in der Reihenfolge der Blätter. */
export function stoffDerPruefung(testId: number): StoffZeile[] {
  return (db().prepare("SELECT * FROM pruefungsstoff WHERE test_id = ? ORDER BY pos, id").all(testId) as ZeilenRow[]).map(alsZeile);
}

/**
 * Die Fähigkeiten der Prüfung nach dem Prüfungsstoff: was die Zeilen sicher oder bestätigt nennen, dazu was ein Lehrer
 * sonst verknüpft hat (eine Fähigkeit, die keine Zeile nennt).
 */
function aktualisiereSkills(testId: number) {
  const t = repo.getTest(testId);
  if (!t) return;
  const zeilen = stoffDerPruefung(testId);
  const genannt = new Set(zeilen.flatMap((z) => [z.skill_id, ...z.vorschlaege]).filter(Boolean));
  const eigene = t.skill_ids.filter((id) => !genannt.has(id));
  repo.setTestSkills(testId, [...new Set([...skillsAus(zeilen), ...eigene])].filter((id) => repo.getSkill(id)));
}

/** Speichert den Prüfungsstoff einer Prüfung (ersetzt den alten) und füllt ihre Fähigkeiten danach. */
export function speichereStoff(testId: number, punkte: StoffPunkt[], o: { lesungId?: number | null } = {}) {
  const conn = db();
  conn.transaction(() => {
    conn.prepare("DELETE FROM pruefungsstoff WHERE test_id = ?").run(testId);
    const add = conn.prepare(
      `INSERT INTO pruefungsstoff (test_id, pos, gruppe, original, inhalt, einheit, quelle, dokument, status, grund, skill_id, zuordnung, vorschlaege)
       VALUES (@test_id, @pos, @gruppe, @original, @inhalt, @einheit, @quelle, @dokument, @status, @grund, @skill_id, @zuordnung, @vorschlaege)`,
    );
    punkte.forEach((p, pos) => add.run({ ...p, test_id: testId, pos, vorschlaege: JSON.stringify(p.vorschlaege) }));
    if (o.lesungId !== undefined) conn.prepare("UPDATE tests SET lesung_id = ? WHERE id = ?").run(o.lesungId, testId);
    aktualisiereSkills(testId);
  })();
}

/**
 * Der Prüfungsstoff aus einer Lesung an die Prüfung: zuordnen mit Fach und Stufe des Schülers, speichern. Was nur von einer
 * Erklärung oder einem Blatt mit Aufgaben stammt, ist noch zu klären.
 */
export function stoffAusLesung(testId: number, lesungId: number): StoffZeile[] {
  const t = repo.getTest(testId);
  const l = getLesung(lesungId);
  const student = t ? repo.getStudent(t.student_id) : null;
  if (!t || !l || !student) return [];
  speichereStoff(testId, ordneZu(fuerPruefung(l.lesung.punkte), { fach: t.subject, student, ki: true }), { lesungId });
  return stoffDerPruefung(testId);
}

/**
 * Die kurze Bestätigung einer unklaren Zuordnung: die gewählte Fähigkeit (bestätigt) oder keine. Gemerkt wird sie für
 * dieselben Wörter beim nächsten Mal (lib/lehrplan.ts `merkeZuordnung`).
 */
export function bestaetigeZuordnung(testId: number, zeileId: number, skillId: string | null, teacherId: number | null): boolean {
  const t = repo.getTest(testId);
  const z = stoffDerPruefung(testId).find((x) => x.id === zeileId);
  if (!t || !z || z.gruppe === "umfang") return false;
  const id = skillId && repo.getSkill(skillId) ? skillId : null;
  db().prepare("UPDATE pruefungsstoff SET skill_id = ?, zuordnung = ? WHERE id = ?").run(id, id ? "bestaetigt" : "keine", zeileId);
  merkeZuordnung(t.subject, vergleichstext(z), id ? [id] : [], teacherId);
  aktualisiereSkills(testId);
  return true;
}

/** „Gehört dazu“ oder „Gehört nicht dazu“ für einen Punkt, der noch zu klären war. */
export function setzeStatus(testId: number, zeileId: number, status: "pruefung" | "ausgeschlossen"): boolean {
  const z = stoffDerPruefung(testId).find((x) => x.id === zeileId);
  if (!z) return false;
  db()
    .prepare("UPDATE pruefungsstoff SET status = ?, grund = ? WHERE id = ?")
    .run(status, status === "ausgeschlossen" ? "Vom Lehrer ausgeschlossen" : "", zeileId);
  aktualisiereSkills(testId);
  return true;
}

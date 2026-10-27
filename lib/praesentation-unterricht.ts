/**
 * **Präsentation im Unterricht** (niko, 27.10.2026: „Wenn der Lehrer eine Präsentation verwenden möchte, soll er direkt im geführten
 * Unterricht auswählen können: Präsentation erstellen. Lernheft kennt bereits Fach, Schulstufe, Thema, Lernziele, Unterrichtsschritt.
 * […] Bereits vorhandene passende Präsentationen sollen bevorzugt angeboten werden. […] Solange [die sichere Wiedergabedomain] fehlt,
 * darf die Oberfläche keine funktionierende Präsentationswiedergabe vortäuschen.“)
 *
 * Am Schritt unter „Das zeigst du“ (components/cockpit/PraesentationSchritt.tsx):
 * - **passende zuerst** (`angebotFuer`): die Präsentation, die in dieser Einheit schon bei diesem Schritt lief, die Folie des
 *   Lernpakets, sonst bei Erklären und Grundlage die beste vorhandene: gleiche Fähigkeit, sonst gleiches Thema in Fach und
 *   Schulstufe; geprüfte vor ungeprüften, die gleiche Schulstufe vor anderen (`passendePraesentationen`).
 * - **Abspielen** nur, wenn die eigene Adresse für Präsentationen eingerichtet ist und die Dateien da sind (`wiedergabe`); sonst
 *   zeigt die App die Folien als Text (`folienText`: Titel, Punkte, Fragen, Vortragstext; nichts davon wird ausgeführt).
 * - **erstellen**, wenn nichts passt (`erstelleSchrittEntwurf`): eine Anfrage über den Router wie aus einem Lernpaket
 *   (lib/praesentation-ki.ts), mit Fach, Schulstufe, Thema, Fähigkeit, Lernziel und dem, was der Schritt sagt und fragt. Mit
 *   Monatsbudget und Grenze je Schüler (die Anfrage nennt die Einheit, nie den Schüler). Das Ergebnis ist ein **Vorschlag**
 *   (praesentation_entwuerfe ohne Paket); erst „Übernehmen“ speichert ihn als Präsentation („Ungeprüft“) und verknüpft ihn mit
 *   diesem Schritt. „Verwerfen“ löscht ihn.
 *
 * Welche Präsentation bei welchem Schritt lief, steht in `einheit_praesentationen`; der Abschluss sagt „Präsentation … verwendet“.
 * Nur Lehrerseiten; der Schüler sieht eine Präsentation nur, wenn der Lehrer sie am Gerät zeigt (ohne Vortragstext).
 */
import fs from "node:fs";
import path from "node:path";
import type { Deck, PraesAuftrag, PraesSchritt } from "./ai/praesentation";
import { deckAusAntwort, folieJeSchritt, praesentationAnfrage, PraesentationKiSchema } from "./ai/praesentation";
import { breakerState, runAI, schuelerGestoppt } from "./ai/router";
import { grenzeErreichtText } from "./ai/schueler-kosten";
import { gespeicherteErklaerung, schulstufeVon } from "./ausfuehrlich";
import { cockpit, erklaerungZu, paketQuelle, type CockpitDaten } from "./cockpit";
import { db, json } from "./db";
import { kiKosten } from "./lernpaket-ki";
import { SCHRITT_ARTEN, type LernpaketMitSchritten, type LernpaketSchritt } from "./lernpakete";
import { deckEinrichtungsProblem, type Env } from "./praesentation-host";
import { bekannteNamen, dateiName, getPraesEntwurf, praesKiAusGrund, praesKostenFuer, praesZip, toEntwurf, type PraesEntwurf, type PraesKiErgebnis } from "./praesentation-ki";
import { externeQuellen } from "./praesentation-zip";
import { dateienDa, getPraesentation, importierePraesentation, listPraesentationen, praesentationsOrdner, praesUngeprueft, type Praesentation } from "./praesentationen";
import * as repo from "./repo";
import { fachAus, klassenLabel, schoolType } from "./school";
import { typischeFehler } from "./themen";
import { getUnit } from "./units";

/** Schritte, bei denen etwas erklärt wird: dort sucht die App eine Präsentation und bietet „Präsentation erstellen“ an. */
export const ZEIG_ARTEN_PAKET: readonly LernpaketSchritt["art"][] = ["erklaerung", "beispiel"];
export const ZEIG_ARTEN_PLAN: readonly string[] = ["erklaeren", "grundlage"];

/** Was die App über einen Schritt der Einheit weiß, für die Suche und für „Präsentation erstellen“. Nichts davon nennt den Schüler. */
export type ZeigeSchritt = {
  unitId: number;
  schrittId: number;
  titel: string;
  /** „Erklärung“, „Grundlage“ … */
  art: string;
  minuten: number;
  skillId: string | null;
  skillName: string | null;
  fach: string;
  schulart: string;
  klasse: number | null;
  schulstufe: number | null;
  thema: string;
  /** das Lernziel des Schritts */
  ziel: string;
  sagt: string;
  fragt: string;
  antwort: string;
  beiFehler: string;
  /** die Folie der Präsentation des Lernpakets, wenn der Schritt eine hat */
  paketFolie: { praesId: number; folie: number } | null;
  /** Erklären oder Grundlage: passende suchen und „Präsentation erstellen“ */
  erklaert: boolean;
};

const einzeilig = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Ein Schritt eines Lernpakets (auch eingebettet im Plan) als ZeigeSchritt. */
function ausPaketSchritt(unitId: number, id: number, p: LernpaketMitSchritten, s: LernpaketSchritt, minuten: number, thema: string | null, stufe: Pick<ZeigeSchritt, "schulart" | "klasse" | "schulstufe">): ZeigeSchritt {
  const skillId = s.aufgaben.find((a) => a.skillId)?.skillId ?? p.skill_ids[0] ?? null;
  const skill = skillId ? repo.getSkill(skillId) : null;
  return {
    unitId,
    schrittId: id,
    titel: s.titel,
    art: SCHRITT_ARTEN[s.art] ?? s.art,
    minuten,
    skillId: skill?.id ?? null,
    skillName: skill?.name ?? null,
    fach: p.fach,
    ...stufe,
    thema: thema || p.thema || p.title,
    ziel: einzeilig(p.ziel),
    sagt: s.lehrer_sagt.trim(),
    fragt: s.lehrer_fragt.trim(),
    antwort: s.erwartete_antwort.trim(),
    beiFehler: s.bei_fehler.trim(),
    paketFolie: p.praesentation_id && s.folie ? { praesId: p.praesentation_id, folie: s.folie } : null,
    erklaert: ZEIG_ARTEN_PAKET.includes(s.art),
  };
}

/**
 * Der Schritt `schrittId` der laufenden Einheit, wie die Präsentation ihn braucht: aus dem Lernpaket der Einheit, aus einem Paket im
 * Plan oder aus dem Plan selbst (Fähigkeit, ihre Erklärung, eine gespeicherte ausführliche Erklärung mit Frage und Antwort). Liest nur.
 */
export function schrittDerEinheit(unitId: number, schrittId: number, c: CockpitDaten = cockpit(unitId, { mitPlan: true })): ZeigeSchritt | null {
  const unit = getUnit(unitId);
  const student = unit ? repo.getStudent(unit.student_id) : null;
  if (!unit || !student) return null;
  const art = schoolType(student.school_type);
  const stufe = { schulart: art?.name ?? "", klasse: art ? (student.klasse ?? null) : null, schulstufe: schulstufeVon(student) || null };
  if (c.paket) {
    const s = c.schritte.find((x) => x.id === schrittId);
    return s ? ausPaketSchritt(unitId, s.id, c.paket, s, s.minuten, null, stufe) : null;
  }
  const s = c.plan.find((x) => x.id === schrittId);
  if (!s) return null;
  const minuten = c.minuten.get(s.id) ?? s.minuten;
  const q = paketQuelle(s) ? c.planQuellen.get(s.id) : null;
  if (q) return ausPaketSchritt(unitId, s.id, q.paket, q.schritt, minuten, s.thema ?? null, stufe);
  const skill = s.skillId ? repo.getSkill(s.skillId) : null;
  const aus = skill && stufe.schulstufe ? gespeicherteErklaerung(skill.id, stufe.schulstufe) : null;
  return {
    unitId,
    schrittId: s.id,
    titel: s.titel,
    art: s.art === "grundlage" ? "Grundlage" : s.art === "erklaeren" ? "Erklären" : (s.art ?? "Schritt"),
    minuten,
    skillId: skill?.id ?? null,
    skillName: skill?.name ?? null,
    fach: skill?.subject || unit.subject || "",
    ...stufe,
    thema: s.thema || skill?.name || s.titel,
    // the Lehrplan's goal of the skill; „Das machst du“ of the step only without a skill (it says what to do, not what to reach)
    ziel: einzeilig(skill?.learning_objective) || (skill ? `${skill.name} verstehen und anwenden` : einzeilig(s.beschreibung) || einzeilig(s.titel)),
    sagt: (aus?.sagt || erklaerungZu(skill?.id ?? null) || s.beschreibung).trim(),
    fragt: aus?.frage?.trim() ?? "",
    antwort: aus?.antwort?.trim() ?? "",
    beiFehler: skill ? typischeFehler(skill.id).slice(0, 3).join(" ") : "",
    paketFolie: null,
    erklaert: Boolean(s.art && ZEIG_ARTEN_PLAN.includes(s.art)),
  };
}

// ---------- passende Präsentationen ----------

export type Suche = { skillId: string | null; fach: string; schulstufe: number | null; thema: string };
export type Treffer = { p: Praesentation; grund: "einheit" | "paket" | "faehigkeit" | "thema"; folie: number | null };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Gleiches Thema: gleich, oder das eine steckt im anderen (ab 4 Zeichen, damit „Bruch“ nicht „Buch“ trifft). */
function gleichesThema(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x === y || (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x)));
}

/**
 * Vorhandene Präsentationen, die zu einem Schritt passen, die beste zuerst. Passend ist eine aktive Präsentation mit der Fähigkeit
 * des Schritts (oder ihrer Ober- oder einer Teilfähigkeit), sonst eine im selben Fach mit demselben Thema und derselben Schulstufe
 * (oder ohne Schulstufe). Innerhalb davon: geprüfte vor ungeprüften (eine KI-Präsentation, die noch niemand angesehen hat), die
 * gleiche Schulstufe vor anderen, dann die zuletzt geänderte. Vorschläge (praesentation_entwuerfe) sind keine Präsentationen und
 * kommen nie vor.
 */
export function passendePraesentationen(q: Suche, alle: Praesentation[] = listPraesentationen()): Treffer[] {
  const skill = q.skillId ? repo.getSkill(q.skillId) : null;
  const verwandt = (id: string) => {
    if (!skill) return false;
    if (id === skill.id || id === skill.parent_id) return true;
    return repo.getSkill(id)?.parent_id === skill.id;
  };
  const treffer: (Treffer & { rang: number })[] = [];
  for (const p of alle) {
    if (p.status !== "aktiv") continue;
    const stufeGleich = q.schulstufe !== null && p.schulstufe === q.schulstufe;
    if (skill && p.skill_ids.some(verwandt)) treffer.push({ p, grund: "faehigkeit", folie: null, rang: 0 });
    else if (q.fach && p.fach === q.fach && (stufeGleich || p.schulstufe === null) && (gleichesThema(p.thema, q.thema) || gleichesThema(p.title, q.thema)))
      treffer.push({ p, grund: "thema", folie: null, rang: 1 });
  }
  const stufe = (p: Praesentation) => (q.schulstufe !== null && p.schulstufe === q.schulstufe ? 0 : 1);
  // listPraesentationen is newest first; sort is stable, so that order stays within the same rank
  return treffer.sort((a, b) => a.rang - b.rang || Number(praesUngeprueft(a.p)) - Number(praesUngeprueft(b.p)) || stufe(a.p) - stufe(b.p)).map(({ p, grund, folie }) => ({ p, grund, folie }));
}

/** Die Präsentation, die in dieser Einheit bei diesem Schritt schon lief (oder für ihn erstellt wurde), oder null. */
export function praesentationImSchritt(unitId: number, schrittId: number): { praesId: number; folie: number | null; erstellt: boolean } | null {
  const r = db().prepare("SELECT praesentation_id, folie, erstellt FROM einheit_praesentationen WHERE unit_id = ? AND schritt_id = ?").get(unitId, schrittId) as
    | { praesentation_id: number; folie: number | null; erstellt: number }
    | undefined;
  return r ? { praesId: r.praesentation_id, folie: r.folie, erstellt: r.erstellt === 1 } : null;
}

/**
 * Was der Schritt unter „Das zeigst du“ anbietet: die Präsentation, die in dieser Einheit hier schon lief, die Folie des Lernpakets,
 * sonst bei Erklären und Grundlage die beste passende. null: nichts (dann gibt es bei Erklären und Grundlage „Präsentation erstellen“).
 */
export function angebotFuer(z: ZeigeSchritt, alle?: Praesentation[]): Treffer | null {
  const schon = praesentationImSchritt(z.unitId, z.schrittId);
  const da = schon ? getPraesentation(schon.praesId) : null;
  if (da && da.status === "aktiv") return { p: da, grund: "einheit", folie: schon!.folie };
  const pf = z.paketFolie ? getPraesentation(z.paketFolie.praesId) : null;
  if (pf && pf.status === "aktiv") return { p: pf, grund: "paket", folie: z.paketFolie!.folie };
  if (!z.erklaert) return null;
  return passendePraesentationen({ skillId: z.skillId, fach: z.fach, schulstufe: z.schulstufe, thema: z.thema }, alle)[0] ?? null;
}

/**
 * Kann diese Präsentation hier abgespielt werden? Nur mit eingerichteter Präsentations-Adresse (PRESENTATION_ORIGIN, ein anderer
 * Rechnername, diese App-Adresse erlaubt) und mit ihren Dateien auf dem Server. Sonst `grund`; die Oberfläche zeigt dann die Folien
 * als Text und keinen Knopf zum Abspielen.
 */
export function wiedergabe(p: Pick<Praesentation, "token" | "start_pfad">, appHost: string | null, proto: string | null, env: Env = process.env): { abspielen: true } | { abspielen: false; grund: string; einrichtung: boolean } {
  const problem = deckEinrichtungsProblem(appHost, proto, env);
  if (problem) return { abspielen: false, grund: problem, einrichtung: true };
  if (!dateienDa(p)) return { abspielen: false, grund: "Die Dateien dieser Präsentation fehlen auf diesem Server.", einrichtung: false };
  return { abspielen: true };
}

/** Merkt sich, welche Präsentation bei diesem Schritt der Einheit gezeigt wird (ein Schritt, eine Präsentation). */
export function merkePraesentation(unitId: number, schrittId: number, praesId: number, folie: number | null, teacherId: number | null, erstellt = false): void {
  db()
    .prepare(
      `INSERT INTO einheit_praesentationen (unit_id, schritt_id, praesentation_id, folie, erstellt, teacher_id) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(unit_id, schritt_id) DO UPDATE SET praesentation_id = excluded.praesentation_id, folie = excluded.folie,
         erstellt = CASE WHEN excluded.praesentation_id = einheit_praesentationen.praesentation_id THEN MAX(einheit_praesentationen.erstellt, excluded.erstellt) ELSE excluded.erstellt END,
         teacher_id = excluded.teacher_id`,
    )
    .run(unitId, schrittId, praesId, folie, erstellt ? 1 : 0, teacherId);
}

/** Die Präsentationen, die in einer Einheit gezeigt wurden, in der Reihenfolge der ersten Verwendung (für den Abschluss). */
export function praesentationenDerEinheit(unitId: number): { id: number; title: string }[] {
  return db()
    .prepare(
      `SELECT p.id, p.title FROM einheit_praesentationen e JOIN praesentationen p ON p.id = e.praesentation_id
       WHERE e.unit_id = ? GROUP BY p.id ORDER BY MIN(e.created_at), MIN(e.rowid)`,
    )
    .all(unitId) as { id: number; title: string }[];
}

// ---------- die Folien als Text ----------

/** Eine Folie zum Lesen: Titel, Punkte, Fragen an den Schüler und der Vortragstext. Alles nur Text. */
export type TextFolie = { nr: number; titel: string; punkte: string[]; fragen: string[]; notiz: string };

const ohneFett = (s: string) => s.replace(/\*\*([^*\n]+?)\*\*/g, "$1");

/** Die Folien eines Vorschlags der KI als Text (dieselbe Form wie `folienText`). */
export function folienAusDeck(d: Pick<Deck, "folien">, notizen?: Record<number, string>): TextFolie[] {
  return d.folien.map((f, i) => {
    const punkte: string[] = [];
    const fragen: string[] = [];
    for (const b of f.bloecke) {
      if (b.art === "frage") fragen.push(ohneFett(b.text));
      else if (b.art === "liste") punkte.push(...b.punkte.map(ohneFett));
      else if (b.art === "tabelle") punkte.push(...b.zeilen.map((r) => r.map(ohneFett).filter(Boolean).join(" · ")));
      else punkte.push(ohneFett(b.text));
    }
    return { nr: i + 1, titel: ohneFett(f.titel), punkte: punkte.filter(Boolean), fragen, notiz: notizen ? (notizen[i + 1] ?? "") : f.notiz };
  });
}

const ENTITAETEN: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß",
  ndash: "–", mdash: "—", hellip: "…", bdquo: "„", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", laquo: "«", raquo: "»", middot: "·", times: "×", divide: "÷", minus: "−", deg: "°", euro: "€",
};

/** Text aus HTML: Entitäten aufgelöst, Steuerzeichen weg. Das Ergebnis wird nie als HTML eingesetzt (React escapt es). */
function entitaeten(s: string): string {
  return s
    .replace(/&#(\d{1,7});/g, (m, n) => (Number(n) > 0 && Number(n) <= 0x10ffff ? String.fromCodePoint(Number(n)) : m))
    .replace(/&#x([0-9a-f]{1,6});/gi, (m, n) => (parseInt(n, 16) > 0 && parseInt(n, 16) <= 0x10ffff ? String.fromCodePoint(parseInt(n, 16)) : m))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITAETEN[n] ?? m)
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ");
}

/** Die Zeilen eines Stücks HTML: Block-Tags werden zu Zeilenumbrüchen, alle Tags fallen weg. */
function zeilenAus(html: string): string[] {
  return entitaeten(html.replace(/<\/?(?:br|p|li|ul|ol|h[1-6]|div|tr|table|section|article|blockquote|pre|figcaption)\b[^>]*>/gi, "\n").replace(/<\/t[dh]>/gi, " · ").replace(/<[^>]*>/g, ""))
    .split("\n")
    .map((z) => z.replace(/\s+/g, " ").replace(/^[\s·]+|[\s·]+$/g, ""))
    .filter(Boolean);
}

/** Höchstens so viele Folien und Zeilen je Folie liest die Vorschau aus einer hochgeladenen Präsentation. */
export const TEXT_GRENZEN = { folien: 60, zeilen: 8, zeichen: 200, datei: 3_000_000 } as const;

/**
 * Die Folien einer hochgeladenen HTML-Präsentation als Text, ohne etwas auszuführen: Skripte, Styles und Kommentare fallen weg, die
 * Folien sind die Elemente mit der Klasse „folie“ (Präsentationen aus Lernheft und dem Skill), sonst die `<section>` (reveal.js),
 * sonst die ganze Seite. Je Folie die erste Überschrift als Titel und die übrigen Zeilen, Fragen (endet mit „?“) getrennt.
 */
export function folienAusHtml(html: string): Omit<TextFolie, "notiz">[] {
  const sauber = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|template|noscript|svg|head|aside)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style)\b[^>]*\/?>/gi, "");
  const folieTag = /<(?:div|section|article)\b[^>]*\bclass\s*=\s*["'][^"']*\bfolie\b[^"']*["'][^>]*>/i;
  const teile = folieTag.test(sauber) ? sauber.split(folieTag).slice(1) : /<section\b/i.test(sauber) ? sauber.split(/<section\b[^>]*>/i).slice(1) : [sauber.replace(/^[\s\S]*?<body\b[^>]*>/i, "")];
  const out: Omit<TextFolie, "notiz">[] = [];
  for (const teil of teile) {
    if (out.length >= TEXT_GRENZEN.folien) break;
    const kopf = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]\s*>/i.exec(teil);
    const titel = kopf ? zeilenAus(kopf[1]).join(" ").slice(0, TEXT_GRENZEN.zeichen) : "";
    const zeilen = zeilenAus(kopf ? teil.replace(kopf[0], "\n") : teil).map((z) => z.slice(0, TEXT_GRENZEN.zeichen));
    if (!titel && !zeilen.length) continue;
    const fragen = zeilen.filter((z) => /\?["“”»)]*$/.test(z)).slice(0, TEXT_GRENZEN.zeilen);
    out.push({ nr: out.length + 1, titel, punkte: zeilen.filter((z) => !fragen.includes(z)).slice(0, TEXT_GRENZEN.zeilen), fragen });
  }
  return out;
}

/**
 * Die Folien einer Präsentation als Text, für die Vorschau in der App, wenn sie hier nicht abgespielt werden kann: aus dem
 * übernommenen Vorschlag der KI (genau ihr Inhalt), sonst aus der Startseite der hochgeladenen Dateien. Der Vortragstext kommt aus der
 * Datenbank; eine Folie, die nur Vortragstext hat, steht trotzdem da. Liest nur, führt nichts aus.
 */
export function folienText(p: Praesentation): TextFolie[] {
  const r = db().prepare("SELECT inhalt FROM praesentation_entwuerfe WHERE praesentation_id = ? AND status = 'uebernommen' ORDER BY id DESC LIMIT 1").get(p.id) as { inhalt: string } | undefined;
  const deck = r ? json<Deck | null>(r.inhalt, null) : null;
  let folien: TextFolie[] = deck?.folien?.length ? folienAusDeck(deck, p.notizen) : [];
  if (!folien.length) {
    let html = "";
    try {
      const ordner = path.resolve(praesentationsOrdner(), p.token);
      const datei = path.resolve(ordner, ...p.start_pfad.split("/"));
      if (datei.startsWith(ordner + path.sep) && fs.statSync(/*turbopackIgnore: true*/ datei).size <= TEXT_GRENZEN.datei) html = fs.readFileSync(/*turbopackIgnore: true*/ datei, "utf8");
    } catch {
      html = "";
    }
    folien = folienAusHtml(html).map((f) => ({ ...f, notiz: p.notizen[f.nr] ?? "" }));
  }
  // slides that only have a Vortragstext (the deck could not be read)
  const da = new Set(folien.map((f) => f.nr));
  for (const [k, v] of Object.entries(p.notizen)) {
    const nr = Number(k);
    if (!da.has(nr) && nr <= TEXT_GRENZEN.folien) folien.push({ nr, titel: "", punkte: [], fragen: [], notiz: v });
  }
  return folien.sort((a, b) => a.nr - b.nr);
}

/** Verständnisfragen eines Vorschlags mit der erwarteten Antwort aus dem Vortragstext („Erwartete Antwort: …“), je Folie. */
export function fragenMitAntwort(d: Pick<Deck, "folien">): { folie: number; frage: string; antwort: string }[] {
  return d.folien.flatMap((f, i) => {
    const antworten = [...f.notiz.matchAll(/erwartete antwort:?\s*([^\n]+)/gi)].map((m) => m[1].trim());
    return f.bloecke
      .filter((b) => b.art === "frage")
      .map((b, j) => ({ folie: i + 1, frage: ohneFett(b.text), antwort: antworten[j] ?? antworten[0] ?? "" }));
  });
}

// ---------- „Präsentation erstellen“ ----------

/** Was aus dem Schritt in die Anfrage geht: Fach, Schulstufe, Thema, Ziel und der eine Schritt. Kein Schüler, keine Notiz. */
export function auftragFuerSchritt(z: ZeigeSchritt): PraesAuftrag & { schritte: (PraesSchritt & { id: number })[] } {
  const stufe = z.schulart ? `${klassenLabel(z.schulart, z.klasse)}${z.schulstufe ? ` (Schulstufe ${z.schulstufe})` : ""}` : z.schulstufe ? `Schulstufe ${z.schulstufe}` : "";
  return {
    titel: z.thema || z.titel,
    fach: z.fach,
    stufe,
    thema: [z.thema, z.skillName && z.skillName !== z.thema ? `Fähigkeit: ${z.skillName}` : ""].filter(Boolean).join(" · "),
    ziel: z.ziel,
    dauer: z.minuten,
    schritt: true,
    schritte: [{ id: z.schrittId, nr: 1, art: z.art, titel: z.titel, minuten: z.minuten, lehrer_sagt: z.sagt, lehrer_fragt: z.fragt, erwartete_antwort: z.antwort, bei_fehler: z.beiFehler, folie: null }],
  };
}

/** Geschätzte Kosten für „Präsentation erstellen“ an diesem Schritt (wie aus einem Lernpaket, lib/praesentation-ki.ts). */
export const kostenFuerSchritt = (z: ZeigeSchritt) => praesKostenFuer(auftragFuerSchritt(z)).text;

/**
 * Darf die KI jetzt eine Präsentation für diesen Schritt erstellen? Dieselben kurzen Gründe wie auf der Seite eines Lernpakets (aus,
 * kein Schlüssel, Budget aufgebraucht), dazu: nach Ausfällen pausiert, Grenze je Schüler erreicht. Vorhandene Präsentationen gehen
 * immer.
 */
export function erstellenTor(z: Pick<ZeigeSchritt, "unitId">): { erlaubt: true } | { erlaubt: false; grund: string } {
  const aus = praesKiAusGrund();
  if (aus) return { erlaubt: false, grund: aus };
  if (breakerState().paused) return { erlaubt: false, grund: "Die KI war zuletzt nicht erreichbar und pausiert ein paar Minuten." };
  const unit = getUnit(z.unitId);
  if (unit && schuelerGestoppt("praesentation", unit.student_id)) return { erlaubt: false, grund: grenzeErreichtText() };
  return { erlaubt: true };
}

/** Wie die Präsentation nach „Übernehmen“ heißt und eingeordnet wird (aus dem Schritt, beim Erstellen festgehalten). */
type Einordnung = { title: string; fach: string; schulart: string; klasse: number | null; thema: string; skill_ids: string[]; beschreibung: string };

function einordnungAus(z: ZeigeSchritt): Einordnung {
  const fach = fachAus(z.fach);
  const skill = z.skillId ? repo.getSkill(z.skillId) : null;
  return {
    title: (z.thema || z.titel).slice(0, 120),
    fach,
    schulart: z.schulart,
    klasse: z.schulart ? z.klasse : null,
    thema: z.thema.slice(0, 120),
    skill_ids: skill && skill.subject === fach ? [skill.id] : [],
    beschreibung: `Im Unterricht erstellt, zum Schritt „${z.titel}“.`.slice(0, 1000),
  };
}

/** Der offene Vorschlag zu einem Schritt einer Einheit, oder null. */
export function offenerSchrittEntwurf(unitId: number, schrittId: number): PraesEntwurf | null {
  const r = db().prepare("SELECT * FROM praesentation_entwuerfe WHERE unit_id = ? AND schritt_id = ? AND status = 'vorschlag' ORDER BY id DESC LIMIT 1").get(unitId, schrittId) as Parameters<typeof toEntwurf>[0] | undefined;
  return r ? toEntwurf(r) : null;
}

/** Eine Anfrage je Schritt zur Zeit: ein Doppeltippen wartet auf die laufende, statt zweimal zu zahlen. */
const laufend = ((globalThis as unknown as { __praesSchrittLaufend?: Map<string, Promise<PraesKiErgebnis>> }).__praesSchrittLaufend ??= new Map());

/**
 * „Präsentation erstellen“ an einem Schritt der laufenden Einheit: eine Anfrage über den Router (Monatsbudget, Grenze je Schüler,
 * Protokoll mit der Einheit), das Ergebnis als Vorschlag. Wirft nie: ohne KI, mit leerem Budget, bei Zeitüberschreitung oder einer
 * unbrauchbaren Antwort kommt eine Meldung und nichts wird gespeichert. Ein älterer offener Vorschlag zum Schritt fällt weg.
 */
export function erstelleSchrittEntwurf(unitId: number, schrittId: number, teacherId: number | null): Promise<PraesKiErgebnis> {
  const key = `${unitId}:${schrittId}`;
  const running = laufend.get(key);
  if (running) return running;
  const job = (async (): Promise<PraesKiErgebnis> => {
    try {
      const unit = getUnit(unitId);
      if (!unit || unit.status !== "gestartet") return { ok: false, error: "Die Einheit läuft nicht mehr." };
      const z = schrittDerEinheit(unitId, schrittId);
      if (!z) return { ok: false, error: "Diesen Schritt gibt es nicht mehr." };
      if (!z.fach) return { ok: false, error: "Zu diesem Schritt ist kein Fach bekannt." };
      const tor = erstellenTor(z);
      if (!tor.erlaubt) return { ok: false, error: tor.grund };
      const a = auftragFuerSchritt(z);
      const { system, prompt } = praesentationAnfrage(a, bekannteNamen());
      // the unit names the student for the budget and the protocol; the request itself has no student data
      const out = await runAI("praesentation", PraesentationKiSchema, system, prompt, { meta: { teacherId, unitId, trigger: "praesentation-unterricht" } });
      if (!out.ok) return { ok: false, error: out.message };
      const gezahlt = kiKosten(out.callId);
      const kosten = gezahlt?.usd ? ` Die Anfrage hat ${gezahlt.cent} Cent gekostet.` : "";
      const deck = deckAusAntwort(out.data, a, a.schritte);
      if ("fehler" in deck) return { ok: false, error: `${deck.fehler}${kosten}` };
      const conn = db();
      const id = conn.transaction(() => {
        conn.prepare("DELETE FROM praesentation_entwuerfe WHERE unit_id = ? AND schritt_id = ? AND status = 'vorschlag'").run(unitId, schrittId);
        return Number(
          conn
            .prepare("INSERT INTO praesentation_entwuerfe (paket_id, unit_id, schritt_id, auftrag, inhalt, call_id, teacher_id) VALUES (NULL, ?, ?, ?, ?, ?, ?)")
            .run(unitId, schrittId, JSON.stringify(einordnungAus(z)), JSON.stringify(deck), out.callId, teacherId).lastInsertRowid,
        );
      })();
      return { ok: true, id };
    } catch (err) {
      console.error("[Präsentation im Unterricht]", err instanceof Error ? err.message : err);
      return { ok: false, error: "Die Präsentation konnte nicht erstellt werden." };
    }
  })().finally(() => laufend.delete(key));
  laufend.set(key, job);
  return job;
}

/**
 * „Übernehmen“ (die Freigabe des Lehrers): der Vorschlag wird über denselben Weg wie ein Upload als Präsentation gespeichert („mit KI
 * erstellt“, „Ungeprüft“), mit Fach, Schulstufe, Thema und Fähigkeit des Schritts, damit sie beim nächsten Schüler gefunden wird, und
 * bei diesem Schritt der Einheit vermerkt (ab der ersten Folie, die zu ihm gehört).
 */
export function uebernimmSchrittEntwurf(entwurfId: number, teacherId: number | null): { ok: true; praesId: number; unitId: number } | { fehler: string; unitId: number | null } {
  const r = db().prepare("SELECT * FROM praesentation_entwuerfe WHERE id = ?").get(entwurfId) as (Parameters<typeof toEntwurf>[0] & { auftrag: string | null }) | undefined;
  const e = r ? toEntwurf(r) : null;
  if (!e || e.status !== "vorschlag" || e.unit_id === null || e.schritt_id === null) return { fehler: "Diesen Vorschlag gibt es nicht mehr.", unitId: e?.unit_id ?? null };
  const m = json<Einordnung | null>(r!.auftrag, null);
  if (!m) return { fehler: "Zu diesem Vorschlag fehlen die Angaben aus dem Schritt.", unitId: e.unit_id };
  const { html, zip } = praesZip(e.deck);
  if (externeQuellen(html).length) return { fehler: "Die Präsentation würde Dateien von außen laden. Sie wurde nicht gespeichert.", unitId: e.unit_id };
  const out = importierePraesentation(
    { name: dateiName(e.deck.titel || m.title), data: zip },
    { title: (e.deck.titel || m.title).slice(0, 120), fach: m.fach, schulart: m.schulart, klasse: m.klasse, thema: m.thema, skill_ids: m.skill_ids, schwierigkeit: "mittel", beschreibung: m.beschreibung },
    teacherId,
    { quelle: "ki", kiCallId: e.call_id },
  );
  if ("pdf" in out) return { fehler: "Die Präsentation konnte nicht gespeichert werden.", unitId: e.unit_id };
  if ("fehler" in out) return { fehler: `Die Präsentation hat die Prüfung nicht bestanden: ${out.fehler.slice(0, 3).join(" ")}`, unitId: e.unit_id };
  const folie = folieJeSchritt(e.deck).get(e.schritt_id) ?? 1;
  const conn = db();
  conn.transaction(() => {
    conn.prepare("UPDATE praesentation_entwuerfe SET status = 'uebernommen', praesentation_id = ?, updated_at = datetime('now') WHERE id = ?").run(out.id, e.id);
    merkePraesentation(e.unit_id!, e.schritt_id!, out.id, folie, teacherId, true);
  })();
  return { ok: true, praesId: out.id, unitId: e.unit_id };
}

/** „Verwerfen“: der Vorschlag ist weg; nichts anderes ändert sich (die Kosten bleiben im Protokoll). */
export function verwirfSchrittEntwurf(entwurfId: number): { unitId: number } | null {
  const e = getPraesEntwurf(entwurfId);
  if (!e || e.unit_id === null || e.status !== "vorschlag") return null;
  db().prepare("DELETE FROM praesentation_entwuerfe WHERE id = ? AND status = 'vorschlag'").run(e.id);
  return { unitId: e.unit_id };
}

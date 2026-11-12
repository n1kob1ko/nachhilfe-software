/**
 * Alles, was der Schüler in einer Einheit gemacht hat, mit Dauer (niko 2026-11-12: „alles was Schüler machen sollte immer dazu
 * kommen, wie lange sie für etwas brauchen usw.“). Eine Zeile je Tätigkeit, in der Reihenfolge, in der sie lief:
 *
 * - **Übungen** am Gerät (auch Lückentext, Leseverständnis, Rechenweg …): je Zuweisung bearbeitet, richtig, teilweise, noch zu
 *   bewerten; Dauer = Summe der gemessenen Zeit je Versuch (`attempts.time_ms`, vom Zeigen der Aufgabe bis zur Abgabe).
 * - **Minitest**, **Lernkontrolle**, **Probeschularbeit**: wie eine Übung, mit eigenem Namen.
 * - **Auf Papier**: übernommene Papier-Übungen (lib/papier-einheit.ts), ohne Dauer (die kennt die App nicht).
 * - **Am Whiteboard**: Aufgaben, die die Lehrkraft an der Tafel bewertet hat (lib/whiteboard-grades.ts); Dauer ungefähr: vom
 *   Schicken der Aufgaben auf die Tafel bis zur letzten Bewertung. Ohne Aufgaben: wie viele Seiten beschrieben wurden.
 * - **Lernspiele** und **Duelle** (lib/lernspiele.ts, `spielrunden`) und **Vokabeln üben** (lib/vokabel-training.ts): die
 *   beendeten Runden des Schülers zwischen Beginn und Ende der Einheit, am Tablet oder in der Schüler-App; abgebrochene Runden
 *   zählen nicht (wie beim Lernstand). Dauer = Start bis Ende jeder Runde.
 * - **Textarbeit**: Wörter dazu; Dauer ungefähr: erstes bis letztes Speichern in dieser Einheit (`text_units`).
 *
 * Nur Gespeichertes, keine KI, nichts geschätzt außer dem, was als „ca.“ dasteht.
 */
import { parseTime } from "./analysis";
import { db } from "./db";
import { SPIEL_SKILL } from "./lernspiele";
import { istSpielArt, SPIEL_TITEL } from "./lernspiele-typen";
import { wienerZeitstempel } from "./planung/zeit";
import { isMinitest, LERNKONTROLLE } from "./quick-round";
import * as repo from "./repo";
import { getUnit } from "./units";
import { BOARD_ANSWER } from "./whiteboard-grades";

export type AktivitaetArt = "uebung" | "minitest" | "lernkontrolle" | "probe" | "papier" | "whiteboard" | "spiel" | "duell" | "vokabeln" | "text";

export type Aktivitaet = {
  art: AktivitaetArt;
  /** Name der Übung, des Spiels, der Liste, des Texts (ohne Vorname davor); leer: das Whiteboard ohne Aufgaben */
  titel: string;
  /** Beginn und Ende in ms (UTC) */
  start: number;
  ende: number;
  /** so lange gebraucht; null: unbekannt (Papier, Whiteboard ohne Aufgaben) */
  dauerMs: number | null;
  /** die Dauer ist nur ungefähr (Whiteboard, Textarbeit): „ca.“ */
  ungefaehr?: boolean;
  assignmentId?: number;
  /** Aufgaben der Übung insgesamt und davon bearbeitet */
  aufgaben?: number;
  bearbeitet?: number;
  richtig: number;
  teilweise?: number;
  /** Antworten, die noch auf die Lehrkraft warten */
  offen?: number;
  /** Karten oder Wörter einer Runde (Spiel, Vokabeln) */
  anzahl?: number;
  runden?: number;
  endlos?: boolean;
  /** Textarbeit: Wörter dazu in dieser Einheit */
  woerter?: number;
  /** Whiteboard ohne Aufgaben: beschriebene Seiten */
  seiten?: number;
};

/** Eine Runde, die so lang dauert, lag offen herum: sie zählt höchstens so lang. */
export const RUNDE_MAX_MS = 30 * 60_000;

/** „40 s“, „12 min“, „1 h 05 min“. */
export function dauerText(ms: number): string {
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))} s`;
  const min = Math.round(ms / 60_000);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

const zahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;

/** Wie die Tätigkeit heißt: „Übung „Brüche kürzen““, „Lernspiel Wortschatz (Endlos)“, „Minitest“. */
export function aktivitaetName(a: Pick<Aktivitaet, "art" | "titel" | "endlos">): string {
  const q = a.titel ? ` „${a.titel}“` : "";
  switch (a.art) {
    case "uebung":
      return `Übung${q}`;
    case "minitest":
      return "Minitest";
    case "lernkontrolle":
      return `Lernkontrolle${q}`;
    case "probe":
      return `Probeschularbeit${q}`;
    case "papier":
      return `Auf Papier${q}`;
    case "whiteboard":
      return a.titel ? `Am Whiteboard${q}` : "Whiteboard";
    case "spiel":
      return `Lernspiel ${a.titel}${a.endlos ? " (Endlos)" : ""}`;
    case "duell":
      return `Duell ${a.titel}`;
    case "vokabeln":
      return `Vokabeln${q}`;
    case "text":
      return `Textarbeit${q}`;
  }
}

/** Das Ergebnis: „8 von 10 richtig“, „6 von 10 Aufgaben, 5 richtig, 1 teilweise“, „17 Punkte in 2 Runden“, „120 Wörter dazu“. */
export function aktivitaetErgebnis(a: Aktivitaet): string {
  if (a.art === "text") return a.woerter && a.woerter > 0 ? `${a.woerter} Wörter dazu` : "weitergeschrieben";
  if (a.art === "whiteboard" && !a.titel) return zahl(a.seiten ?? 0, "Seite", "Seiten");
  if (a.art === "spiel" || a.art === "duell" || a.art === "vokabeln") {
    const was = a.endlos ? zahl(a.richtig, "Punkt", "Punkte") : `${a.richtig} von ${a.anzahl ?? 0} richtig`;
    return a.runden && a.runden > 1 ? `${was} in ${a.runden} Runden` : was;
  }
  const bearbeitet = a.bearbeitet ?? 0;
  // noch offene Antworten zählen erst nach der Bewertung: „richtig“ nur von den bewerteten
  const bewertet = bearbeitet - (a.offen ?? 0);
  const teil = Boolean(a.aufgaben && bearbeitet < a.aufgaben);
  const teile: string[] = [];
  if (teil) teile.push(`${bearbeitet} von ${a.aufgaben} Aufgaben`);
  if (bewertet > 0) teile.push(teil ? `${a.richtig} richtig` : `${a.richtig} von ${bewertet} richtig`);
  if (a.teilweise) teile.push(`${a.teilweise} teilweise`);
  if (a.offen) teile.push(`${zahl(a.offen, "Antwort", "Antworten")} noch zu bewerten`);
  return teile.join(", ") || "nichts abgegeben";
}

/** Die Dauer, wie sie dasteht: „12 min“, „ca. 9 min“; '' ohne Dauer. */
export function aktivitaetDauer(a: Pick<Aktivitaet, "dauerMs" | "ungefaehr">): string {
  return a.dauerMs !== null && a.dauerMs > 0 ? `${a.ungefaehr ? "ca. " : ""}${dauerText(a.dauerMs)}` : "";
}

/** Eine Zeile für die Dokumentation: „Lernspiel Wortschatz: 10 von 12 richtig, 3 min“. */
export function aktivitaetZeile(a: Aktivitaet): string {
  const dauer = aktivitaetDauer(a);
  return `${aktivitaetName(a)}: ${aktivitaetErgebnis(a)}${dauer ? `, ${dauer}` : ""}`;
}

/** Zusammen gebraucht (nur bekannte Dauern). */
export const gesamtDauer = (xs: Aktivitaet[]) => xs.reduce((s, a) => s + (a.dauerMs ?? 0), 0);

/** „Max – Brüche“ → „Brüche“; „Probeschularbeit: Brüche“ → „Brüche“. */
function ohneVorname(titel: string, vorname: string) {
  const t = vorname && titel.startsWith(`${vorname} – `) ? titel.slice(vorname.length + 3) : titel;
  return t.replace(/^Probeschularbeit: /, "");
}

/** ISO oder SQLite-Zeit → SQLite-Zeit (UTC), für Vergleiche mit datetime('now'). */
const sqlZeit = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");

type Versuch = Pick<repo.Attempt, "assignment_id" | "task_id" | "answer" | "correct" | "final" | "time_ms" | "created_at"> & { review: string | null; review_at: string | null };

/** Alle Tätigkeiten des Schülers in dieser Einheit, nach Beginn geordnet. Leer, wenn es die Einheit nicht gibt. */
export function aktivitaetenDerEinheit(unitId: number, now = Date.now()): Aktivitaet[] {
  const unit = getUnit(unitId);
  if (!unit) return [];
  const vorname = unit.student_name.split(" ")[0] ?? "";
  const beginn = Date.parse(unit.started_at);
  const schluss = unit.ended_at ? Date.parse(unit.ended_at) : now;
  const out: Aktivitaet[] = [];

  // ---------- Antworten: Übungen, Minitest, Lernkontrolle, Probeschularbeit, Papier, Whiteboard ----------
  const versuche = db()
    .prepare("SELECT assignment_id, task_id, answer, correct, final, time_ms, created_at, review, review_at FROM attempts WHERE unit_id = ? ORDER BY created_at, id")
    .all(unitId) as Versuch[];
  const papier = new Set(db().prepare("SELECT assignment_id FROM papier_arbeiten WHERE unit_id = ?").pluck().all(unitId) as number[]);
  const gruppen = new Map<string, Versuch[]>();
  for (const v of versuche) {
    // an der Tafel bewertet (nicht eine Antwort am Gerät, die die Lehrkraft dort nachbewertet hat)
    const tafel = v.answer === BOARD_ANSWER && v.time_ms === 0;
    const ws = tafel ? repo.getAssignment(v.assignment_id)?.worksheet_id : null;
    const key = tafel && ws ? `wb:${ws}` : `a:${v.assignment_id}`;
    gruppen.set(key, [...(gruppen.get(key) ?? []), v]);
  }
  const board = db().prepare("SELECT id FROM whiteboards WHERE unit_id = ?").pluck().get(unitId) as number | undefined;
  const inserts = board
    ? (db().prepare("SELECT payload, created_at FROM whiteboard_inserts WHERE board_id = ? ORDER BY id").all(board) as { payload: string; created_at: string }[]).flatMap((r) => {
        try {
          const p = JSON.parse(r.payload) as { kind?: string; worksheetId?: number; tasks?: { taskId?: number }[] };
          return p.kind === "tasks" ? [{ ws: p.worksheetId ?? null, tasks: (p.tasks ?? []).flatMap((t) => (t.taskId ? [t.taskId] : [])), at: Date.parse(r.created_at) }] : [];
        } catch {
          return [];
        }
      })
    : [];

  for (const [key, vs] of gruppen) {
    const assignment = repo.getAssignment(vs[0].assignment_id);
    if (!assignment) continue;
    const ws = repo.getWorksheet(assignment.worksheet_id);
    if (!ws) continue;
    // je Aufgabe der letzte Stand: die abgeschlossene Antwort (oder die offene, die auf die Lehrkraft wartet)
    const proAufgabe = new Map<number, Versuch>();
    for (const v of vs) if (v.final || v.review === "offen") proAufgabe.set(v.task_id, v);
    const fertig = [...proAufgabe.values()];
    const richtig = fertig.filter((v) => v.review !== "offen" && v.review !== "teilweise" && (v.review === "richtig" || v.correct)).length;
    const teilweise = fertig.filter((v) => v.review === "teilweise").length;
    const offen = fertig.filter((v) => v.review === "offen").length;
    const zeiten = vs.map((v) => parseTime(v.created_at));
    const start = Math.min(...vs.map((v) => parseTime(v.created_at) - v.time_ms));
    const ende = Math.max(...zeiten, ...vs.map((v) => (v.review_at ? parseTime(v.review_at) : 0)));
    const summe = vs.reduce((s, v) => s + v.time_ms, 0);
    const titel = ohneVorname(ws.title, vorname);
    const basis = { titel, assignmentId: assignment.id, richtig, ...(teilweise ? { teilweise } : {}), ...(offen ? { offen } : {}) };

    if (key.startsWith("wb:")) {
      // ungefähr: vom Schicken dieser Aufgaben auf die Tafel bis zur letzten Bewertung
      const taskIds = new Set(fertig.map((v) => v.task_id));
      const geschickt = inserts.filter((i) => (i.ws === ws.id || i.tasks.some((t) => taskIds.has(t))) && i.at <= ende).map((i) => i.at);
      const von = geschickt.length ? Math.max(Math.min(...geschickt), beginn) : Math.min(...zeiten);
      out.push({ ...basis, art: "whiteboard", start: von, ende, dauerMs: geschickt.length ? ende - von : null, ungefaehr: true, aufgaben: fertig.length, bearbeitet: fertig.length });
      continue;
    }
    const art: AktivitaetArt = papier.has(assignment.id)
      ? "papier"
      : ws.probe_test_id
        ? "probe"
        : assignment.note === LERNKONTROLLE
          ? "lernkontrolle"
          : isMinitest(assignment.mode)
            ? "minitest"
            : "uebung";
    out.push({ ...basis, art, start, ende, dauerMs: art === "papier" || summe <= 0 ? null : summe, aufgaben: repo.listTasks(ws.id).length, bearbeitet: fertig.length });
  }

  // Whiteboard ohne an der Tafel bewertete Aufgaben: wie viele Seiten beschrieben wurden (von wem, weiß die App nicht)
  if (board && !out.some((a) => a.art === "whiteboard")) {
    const seiten = db()
      .prepare(
        `SELECT COUNT(*) AS n, MIN(updated_at) AS von, MAX(updated_at) AS bis FROM whiteboard_pages p WHERE p.board_id = ?
           AND EXISTS (SELECT 1 FROM json_each(p.elements) e WHERE COALESCE(json_extract(e.value, '$.isDeleted'), 0) = 0)`,
      )
      .get(board) as { n: number; von: string | null; bis: string | null };
    if (seiten.n > 0) {
      const bis = seiten.bis ? Date.parse(seiten.bis) : beginn;
      out.push({ art: "whiteboard", titel: "", start: bis, ende: bis, dauerMs: null, richtig: 0, seiten: seiten.n });
    }
  }

  // ---------- Lernspiele und Duelle: beendete Runden zwischen Beginn und Ende ----------
  const runden = db()
    .prepare("SELECT id, art, skill_id, grund, anzahl, richtig, created_at, beendet_at, duell_id, endlos FROM spielrunden WHERE student_id = ? AND beendet_at IS NOT NULL AND anzahl > 0 AND created_at >= ? AND created_at <= ? ORDER BY id")
    .all(unit.student_id, sqlZeit(beginn), sqlZeit(schluss)) as { id: number; art: string; skill_id: string; grund: string; anzahl: number; richtig: number; created_at: string; beendet_at: string; duell_id: number | null; endlos: number | null }[];
  const spiele = new Map<string, Aktivitaet>();
  for (const r of runden) {
    if (!istSpielArt(r.art)) continue;
    const duell = r.duell_id !== null || r.grund === "duell";
    const key = duell ? `d:${r.duell_id ?? r.id}` : r.endlos !== null ? `e:${r.endlos}` : `s:${r.art}:${r.skill_id}`;
    const start = parseTime(r.created_at);
    const ende = parseTime(r.beendet_at);
    const dauer = Math.min(Math.max(0, ende - start), RUNDE_MAX_MS);
    const x = spiele.get(key);
    if (x) {
      x.richtig += r.richtig;
      x.anzahl = (x.anzahl ?? 0) + r.anzahl;
      x.runden = (x.runden ?? 1) + 1;
      x.ende = Math.max(x.ende, ende);
      x.dauerMs = (x.dauerMs ?? 0) + dauer;
      continue;
    }
    // ein Themenspiel übt je Runde ein Thema: das steht dabei („English Tenses (Past Simple)“)
    const thema = r.skill_id !== SPIEL_SKILL[r.art] ? repo.getSkill(r.skill_id)?.name : undefined;
    const titel = `${SPIEL_TITEL[r.art]}${thema ? ` (${thema})` : ""}`;
    spiele.set(key, { art: duell ? "duell" : "spiel", titel, start, ende, dauerMs: dauer, richtig: r.richtig, anzahl: r.anzahl, runden: 1, ...(r.endlos !== null && !duell ? { endlos: true } : {}) });
  }
  out.push(...spiele.values());

  // ---------- Vokabeln üben ----------
  const vok = db()
    .prepare(
      `SELECT r.liste_id, l.title, r.anzahl, r.richtig, r.created_at, r.beendet_at FROM vokabelrunden r JOIN vokabellisten l ON l.id = r.liste_id
       WHERE r.student_id = ? AND r.beendet_at IS NOT NULL AND r.anzahl > 0 AND r.created_at >= ? AND r.created_at <= ? ORDER BY r.id`,
    )
    .all(unit.student_id, sqlZeit(beginn), sqlZeit(schluss)) as { liste_id: number; title: string; anzahl: number; richtig: number; created_at: string; beendet_at: string }[];
  const listen = new Map<number, Aktivitaet>();
  for (const r of vok) {
    const start = parseTime(r.created_at);
    const ende = parseTime(r.beendet_at);
    const dauer = Math.min(Math.max(0, ende - start), RUNDE_MAX_MS);
    const x = listen.get(r.liste_id);
    if (x) {
      x.richtig += r.richtig;
      x.anzahl = (x.anzahl ?? 0) + r.anzahl;
      x.runden = (x.runden ?? 1) + 1;
      x.ende = Math.max(x.ende, ende);
      x.dauerMs = (x.dauerMs ?? 0) + dauer;
    } else listen.set(r.liste_id, { art: "vokabeln", titel: r.title, start, ende, dauerMs: dauer, richtig: r.richtig, anzahl: r.anzahl, runden: 1 });
  }
  out.push(...listen.values());

  // ---------- Textarbeit ----------
  const texte = db()
    .prepare("SELECT x.title, tu.words_before, tu.words_after, tu.first_at, tu.last_at FROM text_units tu JOIN texts x ON x.id = tu.text_id WHERE tu.unit_id = ? ORDER BY tu.first_at, x.id")
    .all(unitId) as { title: string; words_before: number; words_after: number; first_at: string; last_at: string }[];
  for (const t of texte) {
    const start = parseTime(t.first_at);
    const ende = parseTime(t.last_at);
    out.push({ art: "text", titel: t.title, start, ende, dauerMs: ende > start ? ende - start : null, ungefaehr: true, richtig: 0, woerter: t.words_after - t.words_before });
  }

  return out.sort((a, b) => a.start - b.start || a.ende - b.ende);
}

/** Die Uhrzeit in Wien, „15:05“. */
export const uhrzeit = (ms: number) => wienerZeitstempel(ms).slice(11, 16);

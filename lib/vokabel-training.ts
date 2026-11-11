/**
 * Vokabeln üben in der Schüler-App (niko, 11.11.2026: „… und dann kann der Schüler die Vokabeln üben, die er auch
 * braucht“). Der Schüler übt seine eigenen Listen (lib/vokabellisten.ts) selbst, ohne KI und ohne dass der Lehrer
 * eine Übung erstellt.
 *
 * - **Welche Wörter**: eine Runde hat bis zu 10. Zuerst die, die zuletzt falsch waren, dann die, die wieder dran sind
 *   (Karteikasten: Fach 0 bis 5, ein Wort im Fach 2 kommt nach einem Tag wieder, im Fach 5 nach zwei Wochen), dann
 *   höchstens 5 neue in der Reihenfolge der Liste. Ist nichts dran, kommen die unsichersten zum Weiterüben.
 * - **Wie gefragt wird**: nach dem Fach. Neue Wörter mit Auswahl (3 Antworten), dann 4 Antworten, dann geschrieben
 *   in beide Richtungen, sicher gewusste Deutsch → Englisch oder in der Lücke ihres Beispielsatzes. Die Aufgaben
 *   und die Prüfung sind dieselben wie in einer Übung (lib/vokabeln.ts, lib/vokabeln-pruefen.ts).
 * - **Was zählt**: die erste Antwort je Wort und Runde. Richtig → ein Fach weiter, falsch → zurück in Fach 1 (neue
 *   bleiben in 0). Was die App nicht sicher entscheiden kann (ein anderes Wort, das nicht in der Liste steht), sagt
 *   der Schüler selbst: „Meins war auch richtig“ oder „Weiter“. Ein falsches Wort kommt am Ende der Runde noch
 *   einmal, ohne zu zählen.
 * - **Was der Lehrer sieht**: je Liste, wie viele Wörter sitzen (Fach 3 und höher), welche noch geübt werden und
 *   welche oft falsch waren (Schüler › Vokabellisten). Der Lernstand ändert sich nicht.
 */
import { db, json } from "./db";
import { wienerDatum, tagAddieren } from "./planung/zeit";
import * as repo from "./repo";
import { checkAnswer, type TaskDraft } from "./tasks";
import { getListe, listenVon } from "./vokabellisten";
import {
  leseListe,
  vokabelAufgabe,
  type Quelle,
  type Vokabel,
} from "./vokabeln";
import { schluesselEn, teileDe } from "./vokabeln-pruefen";
import { LEXIKON } from "./vokabeln-themen";
import type { Difficulty } from "./curriculum";
import type { Rng } from "./schulbuch-zahlen";

export const RUNDE = 10;
export const NEU_JE_RUNDE = 5;
export const FAECHER = 5;
/** Ab diesem Fach sitzt ein Wort. */
export const SITZT_AB = 3;
/** Nach so vielen Tagen ist ein Wort im Fach wieder dran (Fach 0 und 1 gleich am selben Tag). */
export const TAGE_JE_FACH = [0, 0, 1, 3, 7, 14] as const;

/** Der Schlüssel eines Worts in einer Liste (wie beim Zusammenlegen in lib/vokabellisten.ts vokabelQuelle). */
export const wortKey = (e: Pick<Vokabel, "en" | "de">) =>
  `${e.en.map((x) => schluesselEn(x)).join(";")}=${e.de.map((x) => teileDe(x).key).join(";")}`;

type StandZeile = {
  wort: string;
  fach: number;
  richtig: number;
  falsch: number;
  zuletzt: string | null;
  zuletzt_falsch: number;
};

function standVon(studentId: number, listeId: number): Map<string, StandZeile> {
  const rows = db()
    .prepare(
      "SELECT wort, fach, richtig, falsch, zuletzt, zuletzt_falsch FROM vokabel_stand WHERE student_id = ? AND liste_id = ?",
    )
    .all(studentId, listeId) as StandZeile[];
  return new Map(rows.map((r) => [r.wort, r]));
}

/** Ob ein schon geübtes Wort heute wieder dran ist. */
export function istDran(
  s: Pick<StandZeile, "fach" | "zuletzt" | "zuletzt_falsch">,
  heute: string,
): boolean {
  if (s.zuletzt_falsch || !s.zuletzt) return true;
  const fach = Math.max(0, Math.min(FAECHER, s.fach));
  return tagAddieren(s.zuletzt, TAGE_JE_FACH[fach]) <= heute;
}

export type ListenStand = {
  id: number;
  title: string;
  woerter: number;
  sitzt: number;
  ueben: number;
  neu: number;
  dran: number;
  schwer: { wort: string; falsch: number; richtig: number }[];
};

/** Der Stand einer Liste: sitzt, wird geübt, neu, heute dran (geübte, die dran sind, plus neue bis 5). */
export function listenStand(
  studentId: number,
  liste: { id: number; title: string; text: string },
  heute = wienerDatum(),
): ListenStand {
  const eintraege = leseListe(liste.text).eintraege;
  const stand = standVon(studentId, liste.id);
  let sitzt = 0;
  let ueben = 0;
  let neu = 0;
  let dran = 0;
  const schwer: ListenStand["schwer"] = [];
  const gesehen = new Set<string>();
  for (const e of eintraege) {
    const k = wortKey(e);
    if (gesehen.has(k)) continue;
    gesehen.add(k);
    const s = stand.get(k);
    if (!s) {
      neu++;
      continue;
    }
    if (s.fach >= SITZT_AB && !s.zuletzt_falsch) sitzt++;
    else ueben++;
    if (istDran(s, heute)) dran++;
    if (s.falsch > 0)
      schwer.push({
        wort: `${e.en[0]} = ${e.de[0]}`,
        falsch: s.falsch,
        richtig: s.richtig,
      });
  }
  schwer.sort((a, b) => b.falsch - a.falsch || a.richtig - b.richtig);
  return {
    id: liste.id,
    title: liste.title,
    woerter: gesehen.size,
    sitzt,
    ueben,
    neu,
    dran: dran + Math.min(neu, NEU_JE_RUNDE),
    schwer: schwer.slice(0, 8),
  };
}

/** Alle Listen eines Schülers mit ihrem Stand, die zuletzt geänderte zuerst; Listen ohne Wörter fehlen. */
export function alleListenStand(
  studentId: number,
  heute = wienerDatum(),
): ListenStand[] {
  return listenVon(studentId)
    .map((l) => listenStand(studentId, l, heute))
    .filter((l) => l.woerter > 0);
}

/** Die Wörter einer Runde: zuletzt falsche, dann fällige (unsicherste zuerst), dann neue, sonst die unsichersten. */
export function waehleWoerter(
  eintraege: Vokabel[],
  stand: Map<string, Pick<StandZeile, "fach" | "zuletzt" | "zuletzt_falsch">>,
  heute: string,
  n = RUNDE,
): Vokabel[] {
  const einmal: Vokabel[] = [];
  const keys = new Set<string>();
  for (const e of eintraege) {
    const k = wortKey(e);
    if (!keys.has(k)) {
      keys.add(k);
      einmal.push(e);
    }
  }
  const mit = einmal.map((e, i) => ({ e, i, s: stand.get(wortKey(e)) }));
  const nachFach = (a: (typeof mit)[number], b: (typeof mit)[number]) =>
    a.s!.fach - b.s!.fach ||
    (a.s!.zuletzt ?? "").localeCompare(b.s!.zuletzt ?? "") ||
    a.i - b.i;
  const falsch = mit.filter((x) => x.s?.zuletzt_falsch).sort(nachFach);
  const dran = mit
    .filter((x) => x.s && !x.s.zuletzt_falsch && istDran(x.s, heute))
    .sort(nachFach);
  const neu = mit.filter((x) => !x.s);
  const rest = mit
    .filter((x) => x.s && !x.s.zuletzt_falsch && !istDran(x.s, heute))
    .sort(nachFach);
  const out: typeof mit = [];
  const nimm = (xs: typeof mit, max = n) => {
    for (const x of xs) {
      if (out.length >= n || max <= 0) return;
      if (out.includes(x)) continue;
      out.push(x);
      max--;
    }
  };
  nimm(falsch);
  nimm(dran);
  nimm(neu, NEU_JE_RUNDE);
  nimm(rest);
  // eine kurze Liste oder alles sitzt: dann doch mehr neue
  nimm(neu);
  return out.map((x) => x.e);
}

/** Wie ein Wort in seinem Fach gefragt wird (Aufgabentyp und Stufe für vokabelAufgabe). */
function formFuer(
  fach: number,
  mitSatz: boolean,
  rng: Rng,
): { category: string; difficulty: Difficulty } {
  if (fach <= 0) return { category: "mc", difficulty: "leicht" };
  if (fach === 1) return { category: "mc", difficulty: "schwer" };
  if (fach === 2) return { category: "kurz", difficulty: "mittel" };
  return {
    category: mitSatz && rng() < 0.5 ? "gap" : "translation",
    difficulty: "schwer",
  };
}

/** Eine Karte, wie sie zum Schüler geht: ohne Lösung. */
export type VokabelKarte = {
  i: number;
  frage: string;
  wort: string;
  art: "auswahl" | "schreiben";
  optionen?: string[];
  sprache: "en" | "de";
  tipp: string | null;
};

type GespeicherteKarte = { wort: string; task: TaskDraft };

const sprache = (t: TaskDraft): "en" | "de" =>
  (t.answer.vokabel?.sprache ?? (/englische/i.test(t.prompt) ? "en" : "de")) as
    | "en"
    | "de";

function alsKarte(k: GespeicherteKarte, i: number): VokabelKarte {
  const [frage, ...rest] = k.task.prompt.split("\n");
  const mc = k.task.type === "mc" && Array.isArray(k.task.data.options);
  return {
    i,
    frage,
    wort: rest.join("\n").trim(),
    art: mc ? "auswahl" : "schreiben",
    ...(mc ? { optionen: k.task.data.options as string[] } : {}),
    sprache: mc ? (/englische/i.test(frage) ? "en" : "de") : sprache(k.task),
    tipp: k.task.hints?.[0] ?? null,
  };
}

/** Startet eine Runde für eine Liste des Schülers; null, wenn es die Liste (für ihn) nicht gibt oder sie leer ist. */
export function starteVokabelRunde(
  studentId: number,
  listeId: number,
  o: { heute?: string; rng?: Rng } = {},
): { rundeId: number; karten: VokabelKarte[] } | null {
  const liste = getListe(listeId);
  if (!liste || liste.student_id !== studentId) return null;
  const eintraege = leseListe(liste.text).eintraege;
  if (!eintraege.length) return null;
  const heute = o.heute ?? wienerDatum();
  const rng = o.rng ?? Math.random;
  const stand = standVon(studentId, listeId);
  const student = repo.getStudent(studentId);
  const q: Quelle = {
    eintraege,
    thema: false,
    lexikon: LEXIKON,
    vs: student?.school_type === "Volksschule",
  };
  const karten: GespeicherteKarte[] = [];
  for (const e of waehleWoerter(eintraege, stand, heute)) {
    const fach = stand.get(wortKey(e))?.fach ?? 0;
    const out = vokabelAufgabe(q, {
      ...formFuer(fach, Boolean(e.satz), rng),
      rng,
      wort: e,
    });
    if (out) karten.push({ wort: wortKey(e), task: out.task });
  }
  if (!karten.length) return null;
  // nicht beendete Runden von gestern und früher räumen sich selbst weg
  db()
    .prepare(
      "DELETE FROM vokabelrunden WHERE student_id = ? AND beendet_at IS NULL AND created_at < datetime('now', '-1 day')",
    )
    .run(studentId);
  const r = db()
    .prepare(
      "INSERT INTO vokabelrunden (student_id, liste_id, karten, anzahl) VALUES (?, ?, ?, ?)",
    )
    .run(studentId, listeId, JSON.stringify(karten), karten.length);
  return { rundeId: Number(r.lastInsertRowid), karten: karten.map(alsKarte) };
}

type RundeZeile = {
  id: number;
  student_id: number;
  liste_id: number;
  karten: string;
  erste: string;
  anzahl: number;
  richtig: number;
  beendet_at: string | null;
};

const rundeVon = (studentId: number, rundeId: number) =>
  db()
    .prepare("SELECT * FROM vokabelrunden WHERE id = ? AND student_id = ?")
    .get(rundeId, studentId) as RundeZeile | undefined;

/** Die Antwort auf eine Karte. `offen`: die App weiß es nicht sicher, der Schüler entscheidet selbst. */
export type VokabelAntwort = {
  ergebnis: "richtig" | "falsch" | "offen";
  text: string;
  richtig: string;
  loesung: string;
  satz: string | null;
  gezaehlt: boolean;
};

/** Merkt sich die erste Antwort eines Worts in der Runde und schiebt es ein Fach weiter oder zurück. */
function zaehle(
  r: RundeZeile,
  i: number,
  wort: string,
  richtig: boolean,
  heute: string,
): boolean {
  const erste = json<Record<string, boolean>>(r.erste, {});
  if (String(i) in erste) return false;
  erste[String(i)] = richtig;
  db()
    .prepare("UPDATE vokabelrunden SET erste = ? WHERE id = ?")
    .run(JSON.stringify(erste), r.id);
  const alt = db()
    .prepare(
      "SELECT fach FROM vokabel_stand WHERE student_id = ? AND liste_id = ? AND wort = ?",
    )
    .get(r.student_id, r.liste_id, wort) as { fach: number } | undefined;
  const fach = richtig
    ? Math.min(FAECHER, (alt?.fach ?? 0) + 1)
    : Math.min(alt?.fach ?? 0, 1);
  db()
    .prepare(
      `INSERT INTO vokabel_stand (student_id, liste_id, wort, fach, richtig, falsch, zuletzt, zuletzt_falsch) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(student_id, liste_id, wort) DO UPDATE SET fach = excluded.fach, richtig = richtig + excluded.richtig, falsch = falsch + excluded.falsch, zuletzt = excluded.zuletzt, zuletzt_falsch = excluded.zuletzt_falsch`,
    )
    .run(
      r.student_id,
      r.liste_id,
      wort,
      fach,
      richtig ? 1 : 0,
      richtig ? 0 : 1,
      heute,
      richtig ? 0 : 1,
    );
  return true;
}

/** Hauptform der richtigen Antwort und der Beispielsatz, aus der Lösung der Aufgabe. */
function loesungVon(t: TaskDraft): { loesung: string; satz: string | null } {
  const zeilen = t.solution.split("\n");
  const satz =
    zeilen
      .find((z) => z.startsWith("Beispiel: "))
      ?.slice("Beispiel: ".length) ?? (t.type === "cloze" ? zeilen[0] : null);
  const paar = t.type === "cloze" ? (zeilen[1] ?? zeilen[0]) : zeilen[0];
  return { loesung: paar, satz };
}

/**
 * Prüft eine Antwort. `selbst`: der Schüler sagt nach „offen“, ob seins auch stimmt (zählt dann wie richtig bzw.
 * falsch). Nur die erste gewertete Antwort je Karte zählt; Wiederholungen am Ende der Runde zählen nicht.
 */
export function pruefeVokabelKarte(
  studentId: number,
  rundeId: number,
  i: number,
  gegeben: string,
  o: { selbst?: boolean; heute?: string } = {},
): VokabelAntwort | null {
  const r = rundeVon(studentId, rundeId);
  if (!r || r.beendet_at) return null;
  const karten = json<GespeicherteKarte[]>(r.karten, []);
  const k = karten[i];
  if (!k) return null;
  const heute = o.heute ?? wienerDatum();
  const { loesung, satz } = loesungVon(k.task);
  const check = checkAnswer(k.task, gegeben);
  let ergebnis: VokabelAntwort["ergebnis"] =
    check.correct === true
      ? "richtig"
      : check.correct === false
        ? "falsch"
        : "offen";
  if (ergebnis === "offen" && o.selbst !== undefined)
    ergebnis = o.selbst ? "richtig" : "falsch";
  const gezaehlt =
    ergebnis === "offen"
      ? false
      : zaehle(r, i, k.wort, ergebnis === "richtig", heute);
  const text =
    ergebnis === "richtig"
      ? check.correct === true
        ? check.feedback
        : "Gut, zählt als richtig."
      : ergebnis === "falsch"
        ? check.correct === false && check.errorLabel
          ? `${check.errorLabel}.`
          : "Nicht ganz."
        : "Das steht so nicht in der Liste. Stimmt deins trotzdem?";
  const a = k.task.answer;
  const richtig =
    Array.isArray(k.task.data.options) && typeof a.correct === "number"
      ? String(k.task.data.options[a.correct])
      : (a.accepted?.[0] ?? a.blanks?.[0]?.[0] ?? "");
  return { ergebnis, text, richtig, loesung, satz, gezaehlt };
}

export type VokabelRundenEnde = {
  richtig: number;
  anzahl: number;
  nochmal: string[];
  stand: ListenStand;
};

/** Beendet eine Runde: wie viele beim ersten Mal stimmten, welche Wörter noch üben, der neue Stand der Liste. */
export function beendeVokabelRunde(
  studentId: number,
  rundeId: number,
  heute = wienerDatum(),
): VokabelRundenEnde | null {
  const r = rundeVon(studentId, rundeId);
  if (!r) return null;
  const liste = getListe(r.liste_id);
  if (!liste) return null;
  const karten = json<GespeicherteKarte[]>(r.karten, []);
  const erste = json<Record<string, boolean>>(r.erste, {});
  const richtig = Object.values(erste).filter(Boolean).length;
  if (!r.beendet_at)
    db()
      .prepare(
        "UPDATE vokabelrunden SET richtig = ?, beendet_at = datetime('now') WHERE id = ?",
      )
      .run(richtig, r.id);
  const nochmal = karten
    .filter((_, i) => erste[String(i)] === false)
    .map((k) => loesungVon(k.task).loesung);
  return {
    richtig,
    anzahl: karten.length,
    nochmal,
    stand: listenStand(studentId, liste, heute),
  };
}

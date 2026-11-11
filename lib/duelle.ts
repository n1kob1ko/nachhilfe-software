/**
 * Duelle (niko 2026-11-11, Konzepte B und C): zwei Schüler spielen **dieselben Karten**. Gewonnen hat, wer mehr beim ersten
 * Versuch richtig hat; bei Gleichstand der Schnellere.
 *
 * - **Per Code** (live = 0): ein Schüler erstellt ein Duell und bekommt einen Code mit vier Zeichen, den er weitergibt.
 *   Wer den Code eingibt, nimmt an; dann haben beide 24 Stunden Zeit, jeder spielt, wann er will. Nicht angenommene
 *   Codes verfallen nach 48 Stunden. Danach gibt es eine Revanche mit neuen Karten ohne neuen Code.
 * - **Live im Unterricht** (live = 1): sitzen zwei Schüler gleichzeitig beim Lehrer (D26), startet er ein Duell. Beide
 *   tippen „Bereit“, dann zählt es 3 Sekunden herunter und beide spielen 2 Minuten lang gegeneinander.
 * - **Fair**: die Karten kommen aus den Stufen für den jüngeren Spieler, ohne die eigenen Fehler-Wiederholungen.
 *   Jede erste Wahl speichert der Server sofort (zuege_*), ein Neuladen ändert also nichts mehr.
 * - Jede Duell-Runde ist auch eine normale Runde (Lernstand, Serie, Ligapunkte).
 * - Andere Schüler sehen nur Spitzname und Bild (lib/spielprofil.ts). Per Code darf nur duellieren, wer ein Profil mit
 *   Duellen hat und mitmachen darf; live entscheidet der Lehrer, die beiden sitzen ja nebeneinander.
 */
import { parseTime } from "./analysis";
import { db, json } from "./db";
import { beendeRunde, duellVokabeln, starteRundeMitKarten } from "./lernspiele";
import { stufenFuer, waehleKarten } from "./lernspiele-karten";
import { istSpielArt, type SpielArt, type SpielKarte } from "./lernspiele-typen";
import * as repo from "./repo";
import { aktivesProfil, BILDER, profilVon } from "./spielprofil";

export const CODE_ZEICHEN = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ANNEHMEN_STUNDEN = 48;
export const SPIELEN_STUNDEN = 24;
export const LIVE_SEKUNDEN = 120;
export const LIVE_COUNTDOWN = 4;
/** Live-Duelle, die so lange keiner startet, verfallen */
export const LIVE_WARTEN_MINUTEN = 15;
const OFFENE_MAX = 5;

type Zug = { key: string; wahl: string; richtig: boolean; at: number };
type Zeile = {
  id: number;
  code: string | null;
  art: string;
  live: number;
  status: "offen" | "laeuft" | "fertig" | "abgelaufen";
  von_id: number;
  gegen_id: number | null;
  karten: string;
  von_runde: number | null;
  gegen_runde: number | null;
  zuege_von: string;
  zuege_gegen: string;
  von_bereit: number;
  gegen_bereit: number;
  revanche_von: number | null;
  lehrer_id: number | null;
  created_at: string;
  angenommen_at: string | null;
  start_at: string | null;
  ende_at: string | null;
};

const iso = (ms: number) => new Date(ms).toISOString();
const zeile = (id: number) => db().prepare("SELECT * FROM spielduelle WHERE id = ?").get(id) as Zeile | undefined;
const rolleVon = (d: Zeile, studentId: number): "von" | "gegen" | null => (d.von_id === studentId ? "von" : d.gegen_id === studentId ? "gegen" : null);

function neuerCode(rng: () => number = Math.random): string {
  for (let i = 0; i < 50; i++) {
    const code = Array.from({ length: 4 }, () => CODE_ZEICHEN[Math.floor(rng() * CODE_ZEICHEN.length)]).join("");
    if (!db().prepare("SELECT 1 FROM spielduelle WHERE code = ?").get(code)) return code;
  }
  throw new Error("Kein freier Code");
}

/** Codes vergleicht man ohne Leerzeichen und Groß/klein; 0/O und 1/I gibt es nicht, damit nichts verwechselt wird. */
export const normCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");

function karten(art: SpielArt, a: repo.Student, b: repo.Student, rng?: () => number): SpielKarte[] {
  const stufe = Math.min(a.grade, b.grade);
  // Vokabel-Paare: eine Themenliste, für beide dieselbe (eigene Listen hat nur einer von beiden)
  if (art === "vokabeln") return duellVokabeln(stufe, stufe <= 4, rng);
  return waehleKarten(art, { stufen: stufenFuer(art, stufe, null), rng });
}

// ---------- Duell per Code ----------

export type Antwort<T> = ({ ok: true } & T) | { ok: false; fehler: string };

export function erstelleDuell(student: repo.Student, art: string, rng?: () => number): Antwort<{ id: number; code: string }> {
  if (!istSpielArt(art)) return { ok: false, fehler: "Dieses Spiel gibt es nicht." };
  if (!aktivesProfil(student)?.duelle) return { ok: false, fehler: "Für Duelle brauchst du ein Spielprofil mit Duellen." };
  aufraeumen();
  const offen = (db().prepare("SELECT COUNT(*) AS n FROM spielduelle WHERE von_id = ? AND status = 'offen' AND live = 0").get(student.id) as { n: number }).n;
  if (offen >= OFFENE_MAX) return { ok: false, fehler: `Du hast schon ${OFFENE_MAX} offene Codes. Warte, bis jemand annimmt.` };
  const code = neuerCode(rng);
  const r = db().prepare("INSERT INTO spielduelle (code, art, von_id) VALUES (?, ?, ?)").run(code, art, student.id);
  return { ok: true, id: Number(r.lastInsertRowid), code };
}

export function nimmAn(student: repo.Student, codeEingabe: string, rng?: () => number): Antwort<{ id: number }> {
  if (!aktivesProfil(student)?.duelle) return { ok: false, fehler: "Für Duelle brauchst du ein Spielprofil mit Duellen." };
  aufraeumen();
  const code = normCode(codeEingabe);
  const d = db().prepare("SELECT * FROM spielduelle WHERE code = ? AND live = 0").get(code) as Zeile | undefined;
  if (!d || d.status === "abgelaufen") return { ok: false, fehler: "Diesen Code gibt es nicht (mehr)." };
  if (d.von_id === student.id) return { ok: false, fehler: "Das ist dein eigener Code. Gib ihn jemandem weiter." };
  if (d.status !== "offen") return d.gegen_id === student.id ? { ok: true, id: d.id } : { ok: false, fehler: "Dieses Duell hat schon jemand angenommen." };
  const von = repo.getStudent(d.von_id);
  if (!von || !aktivesProfil(von)?.duelle) return { ok: false, fehler: "Dieses Duell gibt es nicht mehr." };
  const k = karten(d.art as SpielArt, von, student, rng);
  const jetzt = Date.now();
  db()
    .prepare("UPDATE spielduelle SET gegen_id = ?, karten = ?, status = 'laeuft', angenommen_at = ?, ende_at = ? WHERE id = ? AND status = 'offen'")
    .run(student.id, JSON.stringify(k), iso(jetzt), iso(jetzt + SPIELEN_STUNDEN * 3_600_000), d.id);
  return { ok: true, id: d.id };
}

/** Revanche: neues Duell mit denselben beiden, neue Karten, sofort angenommen. Gibt es schon eine, dann die. */
export function revanche(student: repo.Student, duellId: number, rng?: () => number): Antwort<{ id: number }> {
  const d = zeile(duellId);
  if (!d || !rolleVon(d, student.id) || d.live) return { ok: false, fehler: "Dieses Duell gibt es nicht." };
  const da = db().prepare("SELECT id FROM spielduelle WHERE revanche_von = ?").get(d.id) as { id: number } | undefined;
  if (da) return { ok: true, id: da.id };
  if (d.status !== "fertig" && d.status !== "abgelaufen") return { ok: false, fehler: "Erst fertig spielen." };
  const anderer = repo.getStudent(d.von_id === student.id ? d.gegen_id! : d.von_id);
  if (!anderer || !aktivesProfil(student)?.duelle || !aktivesProfil(anderer)?.duelle) return { ok: false, fehler: "Revanche geht gerade nicht." };
  const jetzt = Date.now();
  const r = db()
    .prepare("INSERT INTO spielduelle (art, von_id, gegen_id, karten, status, revanche_von, angenommen_at, ende_at) VALUES (?, ?, ?, ?, 'laeuft', ?, ?, ?)")
    .run(d.art, student.id, anderer.id, JSON.stringify(karten(d.art as SpielArt, student, anderer, rng)), d.id, iso(jetzt), iso(jetzt + SPIELEN_STUNDEN * 3_600_000));
  return { ok: true, id: Number(r.lastInsertRowid) };
}

// ---------- Live im Unterricht ----------

/** Der Lehrer startet ein Live-Duell zwischen zwei Schülern; beide sehen es sofort in ihrer App. */
export function starteLiveDuell(lehrerId: number, aId: number, bId: number, art: string, rng?: () => number): Antwort<{ id: number }> {
  if (!istSpielArt(art)) return { ok: false, fehler: "Dieses Spiel gibt es nicht." };
  const a = repo.getStudent(aId);
  const b = repo.getStudent(bId);
  if (!a || !b || a.id === b.id) return { ok: false, fehler: "Dafür braucht es zwei Schüler." };
  // ein neues Live-Duell ersetzt ein noch nicht begonnenes der beiden
  db()
    .prepare("UPDATE spielduelle SET status = 'abgelaufen' WHERE live = 1 AND status = 'offen' AND (von_id IN (?, ?) OR gegen_id IN (?, ?))")
    .run(a.id, b.id, a.id, b.id);
  const r = db()
    .prepare("INSERT INTO spielduelle (art, live, von_id, gegen_id, karten, status, lehrer_id, angenommen_at) VALUES (?, 1, ?, ?, ?, 'offen', ?, ?)")
    .run(art, a.id, b.id, JSON.stringify(karten(art, a, b, rng)), lehrerId, iso(Date.now()));
  return { ok: true, id: Number(r.lastInsertRowid) };
}

/** Wer spielt in einem Duell? */
export function duellTeilnehmer(duellId: number): { von: number; gegen: number | null } | null {
  const d = zeile(duellId);
  return d ? { von: d.von_id, gegen: d.gegen_id } : null;
}

/** Ein Schüler tippt „Bereit“. Sind beide bereit, beginnt der Countdown. */
export function bereit(studentId: number, duellId: number, jetzt = Date.now()) {
  const d = zeile(duellId);
  const rolle = d && rolleVon(d, studentId);
  if (!d || !rolle || !d.live || d.status !== "offen") return;
  db().prepare(`UPDATE spielduelle SET ${rolle}_bereit = 1 WHERE id = ?`).run(d.id);
  const neu = zeile(d.id)!;
  if (neu.von_bereit && neu.gegen_bereit) {
    const start = jetzt + LIVE_COUNTDOWN * 1000;
    db().prepare("UPDATE spielduelle SET status = 'laeuft', start_at = ?, ende_at = ? WHERE id = ? AND status = 'offen'").run(iso(start), iso(start + LIVE_SEKUNDEN * 1000), d.id);
  }
}

/** Ein Live-Duell, das auf diesen Schüler wartet oder gerade läuft und das er noch nicht fertig hat. */
export function wartendesLiveDuell(studentId: number): number | null {
  aufraeumen();
  const d = db()
    .prepare("SELECT * FROM spielduelle WHERE live = 1 AND status IN ('offen', 'laeuft') AND (von_id = ? OR gegen_id = ?) ORDER BY id DESC LIMIT 1")
    .get(studentId, studentId) as Zeile | undefined;
  if (!d) return null;
  const meine = d.von_id === studentId ? d.von_runde : d.gegen_runde;
  return rundeFertig(meine) ? null : d.id;
}

/** Der Lehrer bricht ein Live-Duell ab (zählt dann nicht als Duell; gespielte Runden bleiben im Lernstand). */
export function brichAb(lehrerId: number, duellId: number) {
  db().prepare("UPDATE spielduelle SET status = 'abgelaufen' WHERE id = ? AND live = 1 AND lehrer_id = ? AND status IN ('offen', 'laeuft')").run(duellId, lehrerId);
}

// ---------- Spielen ----------

/** Startet (oder setzt fort) die eigene Runde eines Duells; die Karten sind für beide gleich. */
export function duellRunde(student: repo.Student, duellId: number, jetzt = Date.now()): Antwort<{ rundeId: number; karten: SpielKarte[]; schonGewaehlt: Zug[] }> {
  aufraeumen();
  const d = zeile(duellId);
  const rolle = d && rolleVon(d, student.id);
  if (!d || !rolle) return { ok: false, fehler: "Dieses Duell gibt es nicht." };
  if (d.status !== "laeuft") return { ok: false, fehler: d.status === "offen" ? "Das Duell hat noch nicht begonnen." : "Dieses Duell ist schon vorbei." };
  if (d.live && d.start_at && jetzt < parseTime(d.start_at) - 1000) return { ok: false, fehler: "Gleich geht es los." };
  const k = json<SpielKarte[]>(d.karten, []);
  let rundeId = rolle === "von" ? d.von_runde : d.gegen_runde;
  if (rundeId) {
    const r = db().prepare("SELECT beendet_at FROM spielrunden WHERE id = ?").get(rundeId) as { beendet_at: string | null } | undefined;
    if (r?.beendet_at) return { ok: false, fehler: "Du hast schon gespielt. Jetzt ist der andere dran." };
    if (!r) rundeId = null;
  }
  if (!rundeId) {
    rundeId = starteRundeMitKarten(student.id, d.art as SpielArt, k, d.id);
    db().prepare(`UPDATE spielduelle SET ${rolle}_runde = ? WHERE id = ?`).run(rundeId, d.id);
  }
  return { ok: true, rundeId, karten: k, schonGewaehlt: json<Zug[]>(rolle === "von" ? d.zuege_von : d.zuege_gegen, []) };
}

/** Speichert die erste Wahl zu einer Karte sofort (eine zweite zählt nicht). Liefert, ob sie richtig war. */
export function duellZug(studentId: number, duellId: number, key: string, wahl: string, jetzt = Date.now()): { richtig: boolean } | null {
  const d = zeile(duellId);
  const rolle = d && rolleVon(d, studentId);
  if (!d || !rolle || d.status !== "laeuft") return null;
  if (d.ende_at && jetzt > parseTime(d.ende_at) + (d.live ? 3000 : 0)) return null;
  const karte = json<SpielKarte[]>(d.karten, []).find((k) => k.key === key);
  if (!karte || typeof wahl !== "string") return null;
  const spalte = rolle === "von" ? "zuege_von" : "zuege_gegen";
  const zuege = json<Zug[]>(rolle === "von" ? d.zuege_von : d.zuege_gegen, []);
  const da = zuege.find((z) => z.key === key);
  if (da) return { richtig: da.richtig };
  zuege.push({ key, wahl, richtig: wahl === karte.richtig, at: jetzt });
  db().prepare(`UPDATE spielduelle SET ${spalte} = ? WHERE id = ?`).run(JSON.stringify(zuege), d.id);
  return { richtig: wahl === karte.richtig };
}

/**
 * Beendet die eigene Runde. Es zählen die sofort gespeicherten ersten Wahlen; was dort fehlt, kommt aus `antworten`.
 * Sind beide fertig, ist das Duell fertig.
 */
export function beendeDuellRunde(student: repo.Student, duellId: number, antworten: { key: string; wahl: string }[]) {
  const d = zeile(duellId);
  const rolle = d && rolleVon(d, student.id);
  if (!d || !rolle) return null;
  for (const a of antworten.slice(0, 100)) if (a && typeof a.key === "string") duellZug(student.id, d.id, a.key, a.wahl);
  const frisch = zeile(d.id)!;
  const rundeId = rolle === "von" ? frisch.von_runde : frisch.gegen_runde;
  if (!rundeId) return null;
  const zuege = json<Zug[]>(rolle === "von" ? frisch.zuege_von : frisch.zuege_gegen, []);
  const e = beendeRunde(student.id, rundeId, zuege.map((z) => ({ key: z.key, wahl: z.wahl })));
  pruefeFertig(d.id);
  return e ? { rundeId, ...e } : null;
}

function rundeFertig(rundeId: number | null): boolean {
  if (!rundeId) return false;
  const r = db().prepare("SELECT beendet_at FROM spielrunden WHERE id = ?").get(rundeId) as { beendet_at: string | null } | undefined;
  return !!r?.beendet_at;
}

function pruefeFertig(duellId: number) {
  const d = zeile(duellId);
  if (d && d.status === "laeuft" && rundeFertig(d.von_runde) && rundeFertig(d.gegen_runde)) db().prepare("UPDATE spielduelle SET status = 'fertig' WHERE id = ?").run(d.id);
}

/**
 * Räumt auf: nicht angenommene Codes verfallen, abgelaufene Duelle werden beendet (angefangene Runden mit den gespeicherten
 * Wahlen; wer gar nicht gespielt hat, verliert kampflos). Läuft bei jedem Aufruf mit, es gibt keinen Zeitplaner.
 */
export function aufraeumen(jetzt = Date.now()) {
  db()
    .prepare("UPDATE spielduelle SET status = 'abgelaufen' WHERE status = 'offen' AND live = 0 AND created_at < datetime('now', ?)")
    .run(`-${ANNEHMEN_STUNDEN} hours`);
  db()
    .prepare("UPDATE spielduelle SET status = 'abgelaufen' WHERE status = 'offen' AND live = 1 AND created_at < datetime('now', ?)")
    .run(`-${LIVE_WARTEN_MINUTEN} minutes`);
  const vorbei = (db().prepare("SELECT * FROM spielduelle WHERE status = 'laeuft' AND ende_at IS NOT NULL").all() as Zeile[]).filter(
    (d) => jetzt > parseTime(d.ende_at!) + (d.live ? 5000 : 0),
  );
  for (const d of vorbei) {
    for (const rolle of ["von", "gegen"] as const) {
      const rundeId = rolle === "von" ? d.von_runde : d.gegen_runde;
      const sid = rolle === "von" ? d.von_id : d.gegen_id;
      if (rundeId && sid && !rundeFertig(rundeId)) {
        const zuege = json<Zug[]>(rolle === "von" ? d.zuege_von : d.zuege_gegen, []);
        beendeRunde(sid, rundeId, zuege.map((z) => ({ key: z.key, wahl: z.wahl })));
      }
    }
    db().prepare("UPDATE spielduelle SET status = 'fertig' WHERE id = ?").run(d.id);
  }
}

// ---------- Ansicht ----------

export type DuellSeite = { name: string; bild: string; richtig: number; beantwortet: number; fertig: boolean; gespielt: boolean; sekunden: number | null; bereit: boolean };
export type DuellSicht = {
  id: number;
  art: SpielArt;
  live: boolean;
  status: Zeile["status"];
  code: string | null;
  anzahl: number;
  ich: DuellSeite;
  gegner: DuellSeite | null;
  /** nur wenn fertig */
  ausgang: "gewonnen" | "verloren" | "gleich" | null;
  /** Lösungen, die beide beim ersten Versuch falsch hatten (das lernen beide gerade) */
  beideFalsch: string[];
  startAt: number | null;
  endeAt: number | null;
  revancheId: number | null;
  /** muss ich noch spielen? */
  binDran: boolean;
};

function seite(d: Zeile, rolle: "von" | "gegen", ohneProfil: string): DuellSeite | null {
  const sid = rolle === "von" ? d.von_id : d.gegen_id;
  if (!sid) return null;
  const p = profilVon(sid);
  const zuege = json<Zug[]>(rolle === "von" ? d.zuege_von : d.zuege_gegen, []);
  const rundeId = rolle === "von" ? d.von_runde : d.gegen_runde;
  const r = rundeId ? (db().prepare("SELECT created_at, beendet_at FROM spielrunden WHERE id = ?").get(rundeId) as { created_at: string; beendet_at: string | null } | undefined) : undefined;
  return {
    name: p?.name ?? ohneProfil,
    bild: p ? (BILDER[p.bild] ?? "🙂") : "🙂",
    richtig: zuege.filter((z) => z.richtig).length,
    beantwortet: zuege.length,
    fertig: !!r?.beendet_at,
    gespielt: !!rundeId,
    sekunden: r?.beendet_at ? Math.round((parseTime(r.beendet_at) - parseTime(r.created_at)) / 1000) : null,
    bereit: !!(rolle === "von" ? d.von_bereit : d.gegen_bereit),
  };
}

/** Wer liegt vorne? >0: a, <0: b. Erst mehr richtig, live dann mehr beantwortet, dann schneller fertig. */
export function vergleiche(a: DuellSeite, b: DuellSeite, live: boolean): number {
  if (a.gespielt !== b.gespielt) return a.gespielt ? 1 : -1;
  if (a.richtig !== b.richtig) return a.richtig - b.richtig;
  if (live && a.beantwortet !== b.beantwortet) return a.beantwortet - b.beantwortet;
  if (a.sekunden !== null && b.sekunden !== null && a.sekunden !== b.sekunden) return b.sekunden - a.sekunden;
  return 0;
}

/**
 * Das Duell aus Sicht eines Schülers. `namen` (nur live, für den Lehrer oder Schüler ohne Profil): wie die beiden heißen,
 * wenn sie kein Profil haben; per Code steht dort nie ein echter Name.
 */
export function duellSicht(studentId: number, duellId: number, namen?: { von: string; gegen: string }): DuellSicht | null {
  aufraeumen();
  const d = zeile(duellId);
  const rolle = d && rolleVon(d, studentId);
  if (!d || !rolle || !istSpielArt(d.art)) return null;
  const andere = rolle === "von" ? "gegen" : "von";
  const ich = seite(d, rolle, (d.live && namen?.[rolle]) || "Du")!;
  const gegner = seite(d, andere, (d.live && namen?.[andere]) || "Mitspieler");
  let ausgang: DuellSicht["ausgang"] = null;
  if (d.status === "fertig" && gegner) {
    const v = vergleiche(ich, gegner, !!d.live);
    ausgang = v > 0 ? "gewonnen" : v < 0 ? "verloren" : "gleich";
  }
  let beideFalsch: string[] = [];
  if (d.status === "fertig") {
    const k = new Map(json<SpielKarte[]>(d.karten, []).map((x) => [x.key, x]));
    const f1 = new Set(json<Zug[]>(d.zuege_von, []).filter((z) => !z.richtig).map((z) => z.key));
    beideFalsch = json<Zug[]>(d.zuege_gegen, [])
      .filter((z) => !z.richtig && f1.has(z.key))
      .map((z) => k.get(z.key)?.loesung ?? "")
      .filter(Boolean);
  }
  const rev = db().prepare("SELECT id FROM spielduelle WHERE revanche_von = ?").get(d.id) as { id: number } | undefined;
  return {
    id: d.id,
    art: d.art,
    live: !!d.live,
    status: d.status,
    code: d.status === "offen" && rolle === "von" ? d.code : null,
    anzahl: json<SpielKarte[]>(d.karten, []).length,
    ich,
    gegner,
    ausgang,
    beideFalsch,
    startAt: d.start_at ? parseTime(d.start_at) : null,
    endeAt: d.ende_at ? parseTime(d.ende_at) : null,
    revancheId: rev?.id ?? null,
    binDran: d.status === "laeuft" && !ich.fertig,
  };
}

/** Die Duelle per Code der letzten 7 Tage: zuerst, wo ich dran bin, dann offene Codes, dann Ergebnisse. */
export function meineDuelle(studentId: number): DuellSicht[] {
  aufraeumen();
  const ids = db()
    .prepare("SELECT id FROM spielduelle WHERE live = 0 AND (von_id = ? OR gegen_id = ?) AND created_at >= datetime('now', '-7 day') ORDER BY id DESC LIMIT 30")
    .all(studentId, studentId) as { id: number }[];
  const rang = (s: DuellSicht) => (s.binDran ? 0 : s.status === "offen" ? 1 : s.status === "laeuft" ? 2 : 3);
  return ids
    .map((x) => duellSicht(studentId, x.id))
    .filter((s): s is DuellSicht => !!s && s.status !== "abgelaufen")
    .sort((a, b) => rang(a) - rang(b) || b.id - a.id);
}

/** Für den Lehrer: das Live-Duell zwischen den beiden (das neueste der letzten Stunde), mit Vornamen. */
export function liveDuellFuerLehrer(lehrerId: number, aId: number, bId: number): (DuellSicht & { vonId: number }) | null {
  aufraeumen();
  const d = db()
    .prepare(
      "SELECT * FROM spielduelle WHERE live = 1 AND lehrer_id = ? AND ((von_id = ? AND gegen_id = ?) OR (von_id = ? AND gegen_id = ?)) AND created_at >= datetime('now', '-1 hour') ORDER BY id DESC LIMIT 1",
    )
    .get(lehrerId, aId, bId, bId, aId) as Zeile | undefined;
  if (!d) return null;
  const vorname = (id: number | null) => (id ? (repo.getStudent(id)?.name.split(" ")[0] ?? "") : "");
  const s = duellSicht(d.von_id, d.id, { von: vorname(d.von_id), gegen: vorname(d.gegen_id) });
  if (!s) return null;
  // für den Lehrer immer Vornamen, auch wenn ein Spitzname existiert
  return { ...s, vonId: d.von_id, ich: { ...s.ich, name: vorname(d.von_id) }, gegner: s.gegner ? { ...s.gegner, name: vorname(d.gegen_id) } : null };
}

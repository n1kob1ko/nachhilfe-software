/**
 * Tauschbörse (niko, 2026-11-07, ohne KI): Schüler tauschen Termine untereinander, ohne den Partner selbst zu suchen.
 *
 * - Ein Schüler stellt einen **veröffentlichten** Termin in die Börse und sagt, welche anderen Termine **desselben
 *   Lehrers** ihm stattdessen passen (oder „jede andere Zeit“).
 * - Ein anderer Schüler desselben Lehrers, dessen Termin auf dieser Liste steht, sieht in seiner App das Angebot,
 *   nur als Zeit: „Di 14:00 statt deinem Do 15:00“. Ein Tipp auf „Tauschen“ genügt, denn beide haben zugestimmt.
 * - Getauscht wird **sofort** (Entscheidung niko: „Automatisch, Verwaltung informiert“), mit derselben Prüfung wie im
 *   Wochenplan (`legePlaetzeNeu`: Lehrer, Schüler, Raum, gesperrte Plätze, gleichzeitig). Eine bestätigte Terminanfrage
 *   mit `quelle = 'boerse'` hält den Tausch fest; die Verwaltung sieht ihn in „Zu erledigen“ und unter Planung und kann
 *   ihn zurücktauschen (`tauscheZurueck` in lib/planung/terminanfragen.ts).
 * - Frist: beide Termine müssen noch mindestens FRIST_STUNDEN entfernt sein; danach gilt ein Angebot nicht mehr.
 *   Ein Angebot gilt auch nicht mehr, sobald der Termin anders liegt, eine Einheit hat oder eine offene Terminanfrage.
 *
 * Ein Schüler sieht nie den Namen eines anderen Schülers. Rechte prüft diese Datei selbst; die Server Actions sind Hüllen.
 */
import { db, json } from "../db";
import { einheitenFuerWoche, getGeplanteEinheit, legePlaetzeNeu, type GeplanteEinheitZeile } from "./repo";
import {
  anfragbar,
  fuerSchueler,
  gleicheLage,
  istKuenftig,
  lageLabel,
  lageVon,
  neueLagen,
  offeneAnfrageZu,
  tauschPartnerOk,
  vorherVon,
  type Ergebnis,
  type Lage,
  type Wahl,
} from "./terminanfragen";
import { tagAddieren, wienerWochenstart } from "./zeit";

/** So lange vor einem Termin schließt die Börse für ihn. */
export const FRIST_STUNDEN = 24;
const ALLE = "alle";

type AngebotZeile = {
  id: number;
  platz_id: number;
  student_id: number;
  vorher: string;
  passende: string;
  status: "offen" | "getauscht" | "zurueckgezogen";
  anfrage_id: number | null;
  created_at: string;
};

const nein = (fehler: string): Ergebnis => ({ ok: false, fehler });

/** Liegt der Termin noch mindestens FRIST_STUNDEN vor uns? */
export function vorFrist(l: Lage, now: Date = new Date()): boolean {
  return istKuenftig(l, new Date(now.getTime() + FRIST_STUNDEN * 3_600_000));
}

/** Ein Platz, der in die Börse darf oder mit dem man ein Angebot annehmen kann. */
function tauschbar(z: GeplanteEinheitZeile, now: Date): boolean {
  return anfragbar(z, now) && vorFrist(z, now) && !offeneAnfrageZu(z.id);
}

/** Die veröffentlichten Plätze von dieser und nächster Woche, die getauscht werden dürfen. */
function tauschbarePlaetze(now: Date): GeplanteEinheitZeile[] {
  const diese = wienerWochenstart(now);
  return [diese, tagAddieren(diese, 7)].flatMap((w) => einheitenFuerWoche(w, { status: "veroeffentlicht" })).filter((z) => tauschbar(z, now));
}

function passendeIds(a: AngebotZeile): number[] | null {
  if (a.passende === "") return null;
  return json<unknown[]>(a.passende, []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
}

function offenesAngebotZu(platzId: number): AngebotZeile | null {
  return (db().prepare("SELECT * FROM tauschangebote WHERE platz_id = ? AND status = 'offen' ORDER BY id DESC LIMIT 1").get(platzId) as AngebotZeile | undefined) ?? null;
}

/** Gilt das Angebot noch? Dann der Platz dazu. */
function gueltigerPlatz(a: AngebotZeile, now: Date): GeplanteEinheitZeile | null {
  if (a.status !== "offen") return null;
  const platz = getGeplanteEinheit(a.platz_id);
  if (!platz || platz.student_id !== a.student_id || !gleicheLage(platz, vorherVon(a)) || !tauschbar(platz, now)) return null;
  return platz;
}

/** Die anderen Termine desselben Lehrers, die zu einem Platz passen könnten (für die Auswahl beim Anbieten). */
function kandidaten(platz: GeplanteEinheitZeile, alle: GeplanteEinheitZeile[], now: Date): GeplanteEinheitZeile[] {
  return alle.filter((p) => tauschPartnerOk(platz, p, now));
}

// ---------- anbieten, zurückziehen ----------

export type AngebotEingabe = { platzId: unknown; passende: unknown };

/**
 * `passende`: „alle“ oder eine Liste von Platz-IDs (aus `boerseFuerSchueler().anbieten[].kandidaten`). Nur Termine
 * desselben Lehrers, die gerade tauschbar sind, werden gemerkt; mindestens einer muss es sein.
 */
export function bieteAn(studentId: number, e: AngebotEingabe, now: Date = new Date()): Ergebnis {
  const platz = getGeplanteEinheit(Number(e.platzId));
  if (!platz || platz.student_id !== studentId) return nein("Termin nicht gefunden.");
  if (!anfragbar(platz, now) || !vorFrist(platz, now)) return nein(`In die Tauschbörse dürfen nur Termine, die noch mindestens ${FRIST_STUNDEN} Stunden entfernt sind.`);
  if (offeneAnfrageZu(platz.id)) return nein("Zu diesem Termin gibt es schon eine offene Anfrage.");
  const altes = offenesAngebotZu(platz.id);
  if (altes && gueltigerPlatz(altes, now)) return nein("Dieser Termin ist schon in der Tauschbörse.");
  // ein Angebot, das nicht mehr gilt (Termin inzwischen verschoben), macht Platz für ein neues
  if (altes) db().prepare("UPDATE tauschangebote SET status = 'zurueckgezogen', updated_at = datetime('now') WHERE id = ?").run(altes.id);
  const roh = Array.isArray(e.passende) ? e.passende.map(String) : [String(e.passende ?? "")];
  let passende = "";
  if (!roh.includes(ALLE)) {
    const moeglich = new Set(kandidaten(platz, tauschbarePlaetze(now), now).map((p) => p.id));
    const ids = [...new Set(roh.map(Number).filter((n) => moeglich.has(n)))];
    if (ids.length === 0) return nein("Bitte mindestens eine Zeit wählen, die dir stattdessen passt.");
    // alle angehakt = jede Zeit, auch eine, die später dazukommt
    passende = ids.length === moeglich.size ? "" : JSON.stringify(ids);
  }
  db()
    .prepare("INSERT INTO tauschangebote (platz_id, student_id, vorher, passende) VALUES (?, ?, ?, ?)")
    .run(platz.id, studentId, JSON.stringify(lageVon(platz)), passende);
  return { ok: true, hinweis: "Dein Termin ist in der Tauschbörse. Nimmt jemand an, wird gleich getauscht und du siehst es hier." };
}

export function zieheAngebotZurueck(studentId: number, id: number): Ergebnis {
  const r = db().prepare("UPDATE tauschangebote SET status = 'zurueckgezogen', updated_at = datetime('now') WHERE id = ? AND student_id = ? AND status = 'offen'").run(id, studentId);
  return r.changes ? { ok: true, hinweis: "Aus der Tauschbörse genommen." } : nein("Angebot nicht gefunden.");
}

// ---------- annehmen ----------

/** Passt mein Platz zum Angebot? Dann die Prüfung des Tauschs (ohne zu schreiben). */
function passt(a: AngebotZeile, angebotPlatz: GeplanteEinheitZeile, mein: GeplanteEinheitZeile, now: Date): boolean {
  const ids = passendeIds(a);
  return tauschPartnerOk(angebotPlatz, mein, now) && (ids === null || ids.includes(mein.id));
}

/**
 * Ein Schüler nimmt ein Angebot mit einem seiner Termine an: sofort getauscht, wenn alles noch gilt und die Prüfung des
 * Wochenplans besteht. Sonst ändert sich nichts.
 */
export function nimmAngebot(studentId: number, angebotId: number, platzId: number, now: Date = new Date()): Ergebnis {
  const tx = db().transaction((): Ergebnis => {
    const a = (db().prepare("SELECT * FROM tauschangebote WHERE id = ?").get(angebotId) as AngebotZeile | undefined) ?? null;
    if (!a || a.student_id === studentId) return nein("Dieses Angebot gibt es nicht mehr.");
    const angebotPlatz = gueltigerPlatz(a, now);
    if (!angebotPlatz) return nein("Dieses Angebot gibt es nicht mehr.");
    const mein = getGeplanteEinheit(platzId);
    if (!mein || mein.student_id !== studentId) return nein("Termin nicht gefunden.");
    if (!tauschbar(mein, now)) return nein(`Getauscht wird nur bis ${FRIST_STUNDEN} Stunden vor dem Termin und ohne offene Anfrage.`);
    if (!passt(a, angebotPlatz, mein, now)) return nein("Dieses Angebot passt nicht zu deinem Termin.");
    const vorher = lageVon(angebotPlatz);
    const ziel = lageVon(mein);
    const r = legePlaetzeNeu(neueLagen(angebotPlatz, ziel, mein));
    if (!r.ok) return nein(fuerSchueler(r));
    const jetzt = new Date(now).toISOString();
    const anfrage = db()
      .prepare(
        `INSERT INTO terminanfragen (art, status, platz_id, student_id, vorher, ziel_week_start, ziel_weekday, ziel_start_min, partner_platz_id, partner_student_id,
          von, zugestimmt, zugestimmt_at, entschieden_von, entschieden_at, quelle)
         VALUES ('tauschen', 'bestaetigt', @platz, @student, @vorher, @zw, @zt, @zs, @pp, @ps, 'schueler', 'schueler', @jetzt, 'boerse', @jetzt, 'boerse')`,
      )
      .run({
        platz: angebotPlatz.id,
        student: angebotPlatz.student_id,
        vorher: JSON.stringify(vorher),
        zw: ziel.week_start,
        zt: ziel.weekday,
        zs: ziel.start_min,
        pp: mein.id,
        ps: mein.student_id,
        jetzt,
      });
    db().prepare("UPDATE tauschangebote SET status = 'getauscht', anfrage_id = ?, updated_at = datetime('now') WHERE id = ?").run(Number(anfrage.lastInsertRowid), a.id);
    // mein eigenes Angebot zu diesem Termin hat sich damit erledigt
    db().prepare("UPDATE tauschangebote SET status = 'zurueckgezogen', updated_at = datetime('now') WHERE platz_id = ? AND status = 'offen'").run(mein.id);
    return { ok: true, hinweis: `Getauscht! Dein Termin ist jetzt ${lageLabel(vorher, mein.geplante_dauer)}.` };
  });
  return tx();
}

// ---------- für die Schüler-App ----------

export type PassendesAngebot = {
  angebotId: number;
  /** mein Termin, mit dem ich tausche */
  platzId: number;
  meins: string;
  /** meine neue Zeit (mit meiner Dauer) */
  neu: string;
};
export type EigenesAngebot = { id: number; platzId: number; label: string; passende: string[] | null };
export type Anbietbar = { platzId: number; kandidaten: Wahl[] };

export type BoerseSicht = {
  /** Angebote anderer, die zu einem meiner Termine passen und die Prüfung bestehen */
  passend: PassendesAngebot[];
  /** meine offenen Angebote */
  eigene: EigenesAngebot[];
  /** meine Termine, die ich anbieten kann, mit den möglichen Gegen-Terminen (nur als Zeit, mit meiner Dauer) */
  anbietbar: Anbietbar[];
};

/** Alles für die Schüler-App, ohne Namen: passende Angebote, eigene Angebote, was angeboten werden kann. */
export function boerseFuerSchueler(studentId: number, now: Date = new Date()): BoerseSicht {
  const alle = tauschbarePlaetze(now);
  const meine = alle.filter((z) => z.student_id === studentId);
  if (meine.length === 0) return { passend: [], eigene: [], anbietbar: [] };
  const offene = db().prepare("SELECT * FROM tauschangebote WHERE status = 'offen' ORDER BY id").all() as AngebotZeile[];

  const passend: PassendesAngebot[] = [];
  const eigene: EigenesAngebot[] = [];
  for (const a of offene) {
    const angebotPlatz = gueltigerPlatz(a, now);
    if (!angebotPlatz) continue;
    if (a.student_id === studentId) {
      const ids = passendeIds(a);
      eigene.push({
        id: a.id,
        platzId: a.platz_id,
        label: lageLabel(angebotPlatz, angebotPlatz.geplante_dauer),
        passende: ids === null ? null : ids.map((id) => getGeplanteEinheit(id)).filter((p): p is GeplanteEinheitZeile => !!p).map((p) => lageLabel(p, angebotPlatz.geplante_dauer)),
      });
      continue;
    }
    for (const mein of meine) {
      if (!passt(a, angebotPlatz, mein, now)) continue;
      if (!legePlaetzeNeu(neueLagen(angebotPlatz, lageVon(mein), mein), { nurPruefen: true }).ok) continue;
      passend.push({ angebotId: a.id, platzId: mein.id, meins: lageLabel(mein, mein.geplante_dauer), neu: lageLabel(lageVon(angebotPlatz), mein.geplante_dauer) });
    }
  }
  const angeboten = new Set(eigene.map((e) => e.platzId));
  const anbietbar = meine
    .filter((z) => !angeboten.has(z.id))
    .map((z) => ({ platzId: z.id, kandidaten: kandidaten(z, alle, now).map((p) => ({ wert: String(p.id), label: lageLabel(p, z.geplante_dauer) })) }))
    .filter((x) => x.kandidaten.length > 0);
  return { passend, eigene, anbietbar };
}

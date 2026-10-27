/**
 * Terminanfragen (Plan 3.3, ohne KI): ein Schüler (in seiner App) oder ein Lehrer bittet darum, einen
 * **veröffentlichten** Platz zu verschieben oder mit einem anderen Platz desselben Lehrers zu tauschen.
 *
 * Der Ablauf:
 * - Verschieben: die Anfrage ist sofort **offen** und wartet auf die Verwaltung.
 * - Tauschen: die Anfrage **wartet auf Zustimmung** der anderen Seite (der andere Schüler in seiner App oder
 *   sein Lehrer). Stellt sie der Lehrer des anderen Platzes selbst, gilt seine Zustimmung gleich mit.
 * - Die Verwaltung **bestätigt** oder **lehnt ab** (mit kurzem Grund). Bewegt wird erst beim Bestätigen, und
 *   zwar über `legePlaetzeNeu` in `lib/planung/repo.ts`: dieselbe Doppelbuchungsprüfung wie im Wochenplan
 *   (Lehrer, Schüler, Raum, gesperrte Plätze, gleichzeitig), zum Zeitpunkt des Bestätigens. Geht es nicht,
 *   ändert sich nichts und der Grund steht da.
 *
 * Ein Schüler sieht nie den Namen eines anderen Schülers: ein Tauschpartner ist für ihn nur eine Zeit, und
 * die Notiz zur Anfrage sehen nur Lehrer und Verwaltung. Rechte prüft diese Datei selbst, wie
 * `lib/planung/aktionen.ts`; die Server Actions sind nur Hüllen.
 */
import { db, json } from "../db";
import { istAdmin, type Akteur } from "./berechtigungen";
import { einheitenFuerWoche, getGeplanteEinheit, getLehrerPlanung, getRaum, legePlaetzeNeu, listRaeume, slotDatum, verfuegbarkeitFuer, wochenStatus, type GeplanteEinheitZeile, type NeueLage, type PruefErgebnis } from "./repo";
import { MINUTEN_PRO_TAG, auf10, datumLabel, istDatum, minutenLabel, tagAddieren, wienerDatum, wienerMinuten, wienerWochenstart, wochenstartVon, wochentagVon, wochentageDerWoche } from "./zeit";

export type AnfrageArt = "verschieben" | "tauschen";
export type AnfrageStatus = "wartet" | "offen" | "bestaetigt" | "abgelehnt";
export const STATUS_LABEL: Record<AnfrageStatus, string> = { wartet: "Wartet auf Zustimmung", offen: "Offen", bestaetigt: "Bestätigt", abgelehnt: "Abgelehnt" };
export const STATUS_TONE: Record<AnfrageStatus, "amber" | "neutral" | "green" | "red"> = { wartet: "amber", offen: "neutral", bestaetigt: "green", abgelehnt: "red" };

/** Wer etwas tut: ein Schüler über seinen geheimen Link oder ein angemeldeter Lehrer. */
export type Wer = { schuelerId: number } | { lehrer: Akteur };
export type Ergebnis = { ok: true; hinweis?: string; id?: number } | { ok: false; fehler: string };

/** Wo ein Platz liegt: Woche, Tag, Startzeit. */
export type Lage = { week_start: string; weekday: number; start_min: number };

/** Wie lange erledigte Anfragen in den Listen bleiben. */
export const ERLEDIGT_TAGE = 14;
const GRUND_MAX = 200;
const PARTNER_SCHUELER_GRUND = "Der andere Termin passt nicht.";

type Zeile = {
  id: number;
  art: AnfrageArt;
  status: AnfrageStatus;
  platz_id: number;
  student_id: number;
  vorher: string;
  ziel_week_start: string;
  ziel_weekday: number;
  ziel_start_min: number;
  ziel_raum_id: number | null;
  partner_platz_id: number | null;
  partner_student_id: number | null;
  von: "schueler" | "lehrer";
  von_teacher_id: number | null;
  notiz: string;
  zugestimmt: string;
  grund: string;
  entschieden_von: string;
  entschieden_at: string | null;
  created_at: string;
};

const nein = (fehler: string): Ergebnis => ({ ok: false, fehler });
const istSchueler = (wer: Wer): wer is { schuelerId: number } => "schuelerId" in wer;
const lageVon = (z: Lage): Lage => ({ week_start: z.week_start, weekday: z.weekday, start_min: z.start_min });
const gleicheLage = (a: Lage, b: Lage) => a.week_start === b.week_start && a.weekday === b.weekday && a.start_min === b.start_min;
const vorherVon = (z: Zeile): Lage => {
  const v = json<Partial<Lage>>(z.vorher, {});
  return { week_start: String(v.week_start ?? ""), weekday: Number(v.weekday), start_min: Number(v.start_min) };
};
const zielVon = (z: Zeile): Lage => ({ week_start: z.ziel_week_start, weekday: z.ziel_weekday, start_min: z.ziel_start_min });

/** „Do, 23. Okt. 15:00–16:40“ */
export function lageLabel(l: Lage, dauer: number): string {
  return `${datumLabel(slotDatum(l.week_start, l.weekday))} ${minutenLabel(l.start_min)}–${minutenLabel(l.start_min + dauer)}`;
}

/** Liegt die Lage noch vor uns (Europe/Vienna)? Ein Termin, der schon begonnen hat, wird nicht mehr bewegt. */
export function istKuenftig(l: Lage, now: Date = new Date()): boolean {
  const datum = slotDatum(l.week_start, l.weekday);
  const heute = wienerDatum(now);
  return datum > heute || (datum === heute && l.start_min > wienerMinuten(now));
}

/** Ein Platz, zu dem man fragen kann: veröffentlicht, noch ohne Einheit und noch nicht begonnen. */
export function anfragbar(z: GeplanteEinheitZeile, now: Date = new Date()): boolean {
  return z.status === "veroeffentlicht" && z.unit_id === null && istKuenftig(z, now);
}

function offeneAnfrageZu(platzId: number): boolean {
  return !!db().prepare("SELECT 1 FROM terminanfragen WHERE status IN ('wartet', 'offen') AND (platz_id = ? OR partner_platz_id = ?)").get(platzId, platzId);
}

function darfPlatzAnfragen(wer: Wer, z: GeplanteEinheitZeile): boolean {
  if (istSchueler(wer)) return z.student_id === wer.schuelerId;
  return z.teacher_id === wer.lehrer.id || istAdmin(wer.lehrer);
}

/** Getauscht wird mit einem anderen Schüler desselben Lehrers; beide Plätze müssen noch frei zu ändern sein. */
function tauschPartnerOk(platz: GeplanteEinheitZeile, partner: GeplanteEinheitZeile, now: Date): boolean {
  return partner.id !== platz.id && partner.teacher_id === platz.teacher_id && partner.student_id !== platz.student_id && anfragbar(partner, now);
}

/** Die neuen Lagen beim Bestätigen: verschieben = ein Platz, tauschen = beide Plätze samt Raum. */
function neueLagen(platz: GeplanteEinheitZeile, ziel: Lage, partner: GeplanteEinheitZeile | null, roomId?: number | null): NeueLage[] {
  if (!partner) return [{ id: platz.id, ...ziel, ...(roomId === undefined ? {} : { room_id: roomId }) }];
  return [
    { id: platz.id, ...lageVon(partner), room_id: partner.room_id },
    { id: partner.id, ...lageVon(platz), room_id: platz.room_id },
  ];
}

/** Die Absage für einen Schüler: ohne Namen von Lehrern, anderen Schülern oder Räumen. */
function fuerSchueler(p: PruefErgebnis): string {
  if (p.ok) return "";
  if (p.art === "lehrer") return "Zu dieser Zeit ist dein Lehrer schon verplant.";
  if (p.art === "schueler") return "Zu dieser Zeit ist schon ein Termin eingetragen.";
  if (p.art === "raum") return "Der Raum ist zu dieser Zeit belegt.";
  return p.fehler;
}

// ---------- Anfrage stellen ----------

/**
 * `wahl` ist eine vorgeschlagene freie Zeit (`freieZeiten`, Wert „Datum|Start|Raum“); sonst gelten `datum` und
 * `startMin` (eine selbst gewählte Zeit).
 */
export type AnfrageEingabe = { art: unknown; platzId: unknown; partnerPlatzId?: unknown; wahl?: unknown; datum?: unknown; startMin?: unknown; notiz?: unknown };

/** „2026-10-23|900|3“ → Tag, Start und Raum einer vorgeschlagenen Zeit. */
function leseWahl(wahl: unknown): { datum: string; startMin: number; raumId: number | null } | null {
  const [datum, start, raum] = String(wahl ?? "").split("|");
  if (!istDatum(datum) || start === undefined || start === "" || !Number.isFinite(Number(start))) return null;
  const raumId = Number(raum);
  return { datum, startMin: Number(start), raumId: Number.isInteger(raumId) && raumId > 0 ? raumId : null };
}

export function stelleAnfrage(wer: Wer, e: AnfrageEingabe, now: Date = new Date()): Ergebnis {
  const art: AnfrageArt | null = e.art === "verschieben" || e.art === "tauschen" ? e.art : null;
  if (!art) return nein("Bitte verschieben oder tauschen wählen.");
  const platz = getGeplanteEinheit(Number(e.platzId));
  if (!platz || !darfPlatzAnfragen(wer, platz)) return nein("Termin nicht gefunden.");
  if (!anfragbar(platz, now)) return nein("Dieser Termin lässt sich nicht mehr ändern.");
  if (offeneAnfrageZu(platz.id)) return nein("Zu diesem Termin gibt es schon eine offene Anfrage.");

  let ziel: Lage;
  let partner: GeplanteEinheitZeile | null = null;
  let zielRaum: number | null = null;
  if (art === "verschieben") {
    const gewaehlt = leseWahl(e.wahl);
    if (gewaehlt?.raumId && getRaum(gewaehlt.raumId)?.active) zielRaum = gewaehlt.raumId;
    const datum = gewaehlt?.datum ?? String(e.datum ?? "");
    if (!istDatum(datum)) return nein("Bitte eine Zeit wählen.");
    const roh = gewaehlt ? gewaehlt.startMin : e.startMin === "" || e.startMin === null || e.startMin === undefined ? Number.NaN : Number(e.startMin);
    const start = auf10(roh);
    if (!Number.isFinite(start) || start < 0 || start + platz.geplante_dauer > MINUTEN_PRO_TAG) return nein("Bitte eine Uhrzeit wählen.");
    ziel = { week_start: wochenstartVon(datum), weekday: wochentagVon(datum), start_min: start };
    if (gleicheLage(ziel, platz)) return nein("Das ist schon die Zeit des Termins.");
    if (!istKuenftig(ziel, now)) return nein("Die neue Zeit liegt schon in der Vergangenheit.");
    if (ziel.week_start !== platz.week_start && wochenStatus(ziel.week_start) !== "veroeffentlicht")
      return nein("Für diese Woche gibt es noch keinen veröffentlichten Plan. Bitte einen Tag in derselben Woche wählen.");
  } else {
    partner = getGeplanteEinheit(Number(e.partnerPlatzId));
    if (!partner || !tauschPartnerOk(platz, partner, now)) return nein("Bitte einen anderen Termin zum Tauschen wählen.");
    if (offeneAnfrageZu(partner.id)) return nein("Zu diesem Termin gibt es schon eine offene Anfrage.");
    ziel = lageVon(partner);
  }

  // gleich prüfen, damit niemand auf eine Zeit wartet, die sicher nicht geht; bewegt wird erst beim Bestätigen.
  // Ein belegter Raum hält eine Verschiebung nicht auf: beim Bestätigen wählt die Verwaltung einen anderen.
  const vorab = legePlaetzeNeu(neueLagen(platz, ziel, partner, zielRaum ?? undefined), { nurPruefen: true });
  const raumBelegt = !vorab.ok && art === "verschieben" && vorab.art === "raum";
  if (!vorab.ok && !raumBelegt) return nein(istSchueler(wer) ? fuerSchueler(vorab) : vorab.fehler);

  // stellt der Lehrer des anderen Platzes den Tausch selbst, hat die andere Seite schon zugestimmt
  const lehrerStimmtZu = art === "tauschen" && !istSchueler(wer) && partner!.teacher_id === wer.lehrer.id;
  const status: AnfrageStatus = art === "tauschen" && !lehrerStimmtZu ? "wartet" : "offen";
  const res = db()
    .prepare(
      `INSERT INTO terminanfragen (art, status, platz_id, student_id, vorher, ziel_week_start, ziel_weekday, ziel_start_min, ziel_raum_id, partner_platz_id, partner_student_id,
        von, von_teacher_id, notiz, zugestimmt, zugestimmt_at)
       VALUES (@art, @status, @platz_id, @student_id, @vorher, @zw, @zt, @zs, @zr, @pp, @ps, @von, @vt, @notiz, @zugestimmt, @zugestimmt_at)`,
    )
    .run({
      art,
      status,
      platz_id: platz.id,
      student_id: platz.student_id,
      vorher: JSON.stringify(lageVon(platz)),
      zw: ziel.week_start,
      zt: ziel.weekday,
      zs: ziel.start_min,
      zr: raumBelegt ? null : zielRaum,
      pp: partner?.id ?? null,
      ps: partner?.student_id ?? null,
      von: istSchueler(wer) ? "schueler" : "lehrer",
      vt: istSchueler(wer) ? null : wer.lehrer.id,
      notiz: String(e.notiz ?? "").trim().slice(0, GRUND_MAX),
      zugestimmt: lehrerStimmtZu ? "lehrer" : "",
      zugestimmt_at: lehrerStimmtZu ? new Date(now).toISOString() : null,
    });
  const hinweis =
    status === "wartet"
      ? "Anfrage gestellt. Zuerst stimmt die andere Seite zu, dann bestätigt die Verwaltung. Bis dahin bleibt alles, wie es ist."
      : `Anfrage gestellt. Die Verwaltung bestätigt sie; bis dahin bleibt der Termin, wie er ist.${raumBelegt ? " Der Raum ist zu dieser Zeit belegt, die Verwaltung wählt dann einen anderen." : ""}`;
  return { ok: true, id: Number(res.lastInsertRowid), hinweis };
}

// ---------- zustimmen, ablehnen, zurückziehen, bestätigen ----------

function getZeile(id: number): Zeile | null {
  return (db().prepare("SELECT * FROM terminanfragen WHERE id = ?").get(id) as Zeile | undefined) ?? null;
}

/** Ist `wer` die andere Seite eines Tauschs: der andere Schüler oder der Lehrer des anderen Platzes? */
function istPartner(wer: Wer, z: Zeile): boolean {
  if (z.art !== "tauschen" || z.partner_platz_id === null) return false;
  if (istSchueler(wer)) return z.partner_student_id === wer.schuelerId;
  return getGeplanteEinheit(z.partner_platz_id)?.teacher_id === wer.lehrer.id;
}

export function stimmeZu(wer: Wer, id: number, now: Date = new Date()): Ergebnis {
  const z = getZeile(id);
  if (!z || !istPartner(wer, z)) return nein("Anfrage nicht gefunden.");
  if (z.status !== "wartet") return nein("Diese Anfrage wartet nicht mehr auf eine Zustimmung.");
  db()
    .prepare("UPDATE terminanfragen SET status = 'offen', zugestimmt = ?, zugestimmt_at = ? WHERE id = ? AND status = 'wartet'")
    .run(istSchueler(wer) ? "schueler" : "lehrer", new Date(now).toISOString(), id);
  return { ok: true, hinweis: "Zugestimmt. Jetzt bestätigt die Verwaltung den Tausch." };
}

/**
 * Ablehnen mit kurzem Grund. Die Verwaltung darf jede unentschiedene Anfrage ablehnen, die andere Seite eines
 * Tauschs nur, solange er auf ihre Zustimmung wartet. Ein Schüler schreibt keinen Grund (der andere Schüler
 * würde ihn lesen); bei ihm steht ein fester Satz.
 */
export function lehneAb(wer: Wer, id: number, grund: unknown, now: Date = new Date()): Ergebnis {
  const z = getZeile(id);
  if (!z) return nein("Anfrage nicht gefunden.");
  const verwaltung = !istSchueler(wer) && istAdmin(wer.lehrer);
  if (!verwaltung && !istPartner(wer, z)) return nein("Anfrage nicht gefunden.");
  if (verwaltung ? z.status !== "wartet" && z.status !== "offen" : z.status !== "wartet") return nein("Diese Anfrage ist schon entschieden.");
  const text = istSchueler(wer) ? PARTNER_SCHUELER_GRUND : String(grund ?? "").trim().replace(/\s+/g, " ").slice(0, GRUND_MAX);
  if (!text) return nein("Bitte einen kurzen Grund angeben.");
  db()
    .prepare("UPDATE terminanfragen SET status = 'abgelehnt', grund = ?, entschieden_von = ?, entschieden_teacher_id = ?, entschieden_at = ? WHERE id = ?")
    .run(text, verwaltung ? "verwaltung" : "partner", istSchueler(wer) ? null : wer.lehrer.id, new Date(now).toISOString(), id);
  return { ok: true, hinweis: "Abgelehnt." };
}

/** Wer gefragt hat, kann seine Anfrage zurückziehen, solange sie nicht entschieden ist; sie verschwindet dann. */
export function zieheZurueck(wer: Wer, id: number): Ergebnis {
  const z = getZeile(id);
  const eigene = z && (istSchueler(wer) ? z.von === "schueler" && z.student_id === wer.schuelerId : z.von === "lehrer" && z.von_teacher_id === wer.lehrer.id);
  if (!z || !eigene) return nein("Anfrage nicht gefunden.");
  if (z.status !== "wartet" && z.status !== "offen") return nein("Diese Anfrage ist schon entschieden.");
  db().prepare("DELETE FROM terminanfragen WHERE id = ?").run(id);
  return { ok: true, hinweis: "Anfrage zurückgezogen." };
}

/**
 * Die Verwaltung bestätigt: erst jetzt wird bewegt, mit der Doppelbuchungsprüfung des Wochenplans in diesem
 * Moment. Wurde ein Platz inzwischen im Wochenplan geändert, hat begonnen oder ist die Prüfung nicht bestanden,
 * ändert sich nichts und der Grund kommt zurück. `roomId` (nur beim Verschieben): ein anderer Raum; ohne gilt der Raum der gewählten freien Zeit, sonst bleibt er.
 */
export function bestaetige(akteur: Akteur, id: number, opts: { roomId?: number | null } = {}, now: Date = new Date()): Ergebnis {
  if (!istAdmin(akteur)) return nein("Dafür fehlt die Berechtigung.");
  const z = getZeile(id);
  if (!z) return nein("Anfrage nicht gefunden.");
  if (z.status === "wartet") return nein("Die andere Seite hat dem Tausch noch nicht zugestimmt.");
  if (z.status !== "offen") return nein("Diese Anfrage ist schon entschieden.");
  const platz = getGeplanteEinheit(z.platz_id);
  const partner = z.partner_platz_id === null ? null : getGeplanteEinheit(z.partner_platz_id);
  const ziel = zielVon(z);
  if (!platz || (z.art === "tauschen" && !partner)) return nein("Der Termin steht nicht mehr im Wochenplan.");
  if (!gleicheLage(platz, vorherVon(z)) || (partner && !gleicheLage(partner, ziel)))
    return nein("Der Termin wurde inzwischen im Wochenplan geändert. Bitte ablehnen; die Anfrage kann neu gestellt werden.");
  if (!anfragbar(platz, now) || (partner && !anfragbar(partner, now)) || !istKuenftig(ziel, now))
    return nein("Der Termin hat schon begonnen oder ist vorbei. Bitte ablehnen.");
  if (!partner && ziel.week_start !== platz.week_start && wochenStatus(ziel.week_start) !== "veroeffentlicht")
    return nein("Die Zielwoche ist nicht mehr veröffentlicht.");
  let roomId: number | null | undefined;
  const raumWunsch = opts.roomId !== undefined && opts.roomId !== null && opts.roomId > 0 ? opts.roomId : z.ziel_raum_id;
  if (!partner && raumWunsch) {
    const raum = getRaum(raumWunsch);
    if (!raum || !raum.active) return nein("Raum nicht gefunden.");
    roomId = raum.id;
  }
  const r = legePlaetzeNeu(neueLagen(platz, ziel, partner, roomId));
  if (!r.ok) return nein(`Nicht bestätigt: ${r.fehler}`);
  db()
    .prepare("UPDATE terminanfragen SET status = 'bestaetigt', entschieden_von = 'verwaltung', entschieden_teacher_id = ?, entschieden_at = ? WHERE id = ?")
    .run(akteur.id, new Date(now).toISOString(), id);
  return { ok: true, hinweis: `Bestätigt: ${z.art === "tauschen" ? "die Termine sind getauscht" : "der Termin ist verschoben"}.${r.hinweis ? ` ${r.hinweis}` : ""}` };
}

// ---------- für die Formulare ----------

export type Wahl = { wert: string; label: string };
export type AnfragbarerTermin = {
  id: number;
  label: string;
  /** nur in Lehreransichten: der Schüler */
  schueler?: string;
  /** Tage zum Verschieben: die Woche des Termins und jede veröffentlichte Woche bis nächste Woche, ab heute */
  tage: Wahl[];
  /** andere Termine desselben Lehrers zum Tauschen; für Schüler nur als Zeit */
  tausch: Wahl[];
  /** freie Zeiten zum Verschieben, geprüft wie beim Bestätigen (`freieZeiten`); nur für Schüler */
  frei: Wahl[];
};

/** Wie viele freie Zeiten vorgeschlagen werden, höchstens je Tag, und das Raster der Vorschläge. */
export const FREI_MAX = 6;
const FREI_JE_TAG = 2;
const FREI_RASTER = 30;

/**
 * Freie Zeiten zum Verschieben eines Platzes: in den Wochen, in die er darf (seine Woche und jede veröffentlichte
 * bis nächste Woche), ab jetzt, innerhalb der Verfügbarkeit des Lehrers und, wenn eingetragen, der des Schülers
 * (beide samt Wochenabweichung). Jede Zeit geht durch dieselbe Prüfung wie beim Bestätigen (`legePlaetzeNeu`):
 * Lehrer, Schüler, Raum, gesperrte Plätze, von Hand geplante Einheiten. Ist der eigene Raum belegt, wird ein
 * freier Raum derselben Art gesucht (Wunschräume des Lehrers zuerst). Wert: „Datum|Start|Raum“.
 */
export function freieZeiten(platz: GeplanteEinheitZeile, wochen: string[], now: Date = new Date(), max = FREI_MAX): Wahl[] {
  const eigenerRaum = platz.room_id === null ? null : getRaum(platz.room_id);
  const wunsch = getLehrerPlanung(platz.teacher_id)?.preferred_room_ids ?? [];
  const andere = listRaeume()
    .filter((r) => eigenerRaum && r.id !== eigenerRaum.id && r.mode === eigenerRaum.mode)
    .sort((a, b) => (wunsch.includes(a.id) ? wunsch.indexOf(a.id) : 999) - (wunsch.includes(b.id) ? wunsch.indexOf(b.id) : 999));
  const raeume: (number | null)[] = [platz.room_id, ...andere.map((r) => r.id)];
  const heute = wienerDatum(now);
  const out: Wahl[] = [];
  for (const woche of wochen) {
    const lehrer = verfuegbarkeitFuer("teacher", platz.teacher_id, woche).availability;
    const schueler = verfuegbarkeitFuer("student", platz.student_id, woche).availability;
    const schuelerEingetragen = Object.values(schueler).some((sp) => sp && sp.length > 0);
    for (const { datum, tag } of wochentageDerWoche(woche)) {
      if (datum < heute) continue;
      let amTag = 0;
      for (const sp of lehrer[String(tag) as keyof typeof lehrer] ?? []) {
        for (let start = Math.ceil(sp.start / FREI_RASTER) * FREI_RASTER; start + platz.geplante_dauer <= sp.end && amTag < FREI_JE_TAG && out.length < max; start += FREI_RASTER) {
          const lage = { week_start: woche, weekday: tag, start_min: start };
          if (gleicheLage(lage, platz) || !istKuenftig(lage, now)) continue;
          const ende = start + platz.geplante_dauer;
          if (schuelerEingetragen && !(schueler[String(tag) as keyof typeof schueler] ?? []).some((s) => s.start <= start && ende <= s.end)) continue;
          // erst mit dem eigenen Raum; nur wenn der Raum belegt ist, die anderen probieren
          const eigen = legePlaetzeNeu([{ id: platz.id, ...lage }], { nurPruefen: true });
          const raum = eigen.ok ? platz.room_id : eigen.art === "raum" ? raeume.slice(1).find((r) => legePlaetzeNeu([{ id: platz.id, ...lage, room_id: r }], { nurPruefen: true }).ok) : undefined;
          if (raum === undefined) continue;
          out.push({ wert: `${datum}|${start}|${raum ?? ""}`, label: lageLabel(lage, platz.geplante_dauer) });
          amTag++;
          start += Math.max(0, Math.ceil(platz.geplante_dauer / FREI_RASTER) - 1) * FREI_RASTER; // nicht zweimal fast dieselbe Zeit
        }
      }
    }
  }
  return out;
}

function namen(tabelle: "students" | "teachers"): Map<number, string> {
  return new Map((db().prepare(`SELECT id, name FROM ${tabelle}`).all() as { id: number; name: string }[]).map((r) => [r.id, r.name]));
}

/**
 * Die Termine, zu denen `wer` fragen kann (diese und nächste Woche, veröffentlicht, ohne Einheit, noch nicht
 * begonnen, ohne offene Anfrage), mit den Tagen zum Verschieben und den Tauschpartnern.
 */
export function anfragbareTermine(wer: Wer, now: Date = new Date()): AnfragbarerTermin[] {
  const diese = wienerWochenstart(now);
  const wochen = [diese, tagAddieren(diese, 7)];
  const heute = wienerDatum(now);
  const alle = wochen.flatMap((w) => einheitenFuerWoche(w, { status: "veroeffentlicht" })).filter((z) => anfragbar(z, now) && !offeneAnfrageZu(z.id));
  const schueler = istSchueler(wer) ? null : namen("students");
  const eigene = alle.filter((z) => (istSchueler(wer) ? z.student_id === wer.schuelerId : z.teacher_id === wer.lehrer.id));
  const veroeffentlicht = new Map(wochen.map((w) => [w, wochenStatus(w) === "veroeffentlicht"]));
  return eigene.map((z) => {
    const erlaubt = wochen.filter((w) => w === z.week_start || veroeffentlicht.get(w));
    return {
      id: z.id,
      label: lageLabel(z, z.geplante_dauer),
      schueler: schueler?.get(z.student_id),
      // Vorschläge nur in der Schüler-App: ein Lehrer hat viele Plätze und kennt seine Woche
      frei: istSchueler(wer) ? freieZeiten(z, erlaubt, now) : [],
      tage: erlaubt
        .flatMap((w) => wochentageDerWoche(w))
        .filter((t) => t.datum >= heute)
        .map((t) => ({ wert: t.datum, label: datumLabel(t.datum) })),
      tausch: alle
        .filter((p) => tauschPartnerOk(z, p, now))
        .map((p) => ({ wert: String(p.id), label: schueler ? `${lageLabel(p, p.geplante_dauer)} · ${schueler.get(p.student_id) ?? ""}` : lageLabel(p, p.geplante_dauer) })),
    };
  });
}

// ---------- Listen ----------

export type AnfrageSicht = {
  id: number;
  art: AnfrageArt;
  status: AnfrageStatus;
  /** aus Sicht des Betrachters: selbst gefragt, die andere Seite eines Tauschs, oder die Verwaltung */
  rolle: "eigene" | "partner" | "verwaltung" | "lehrer";
  /** „Di, 21. Okt. 16:00–17:40“: der Termin, um den es dem Betrachter geht, vorher und nachher */
  von: string;
  nach: string;
  /** beim Tausch der andere Termin; für Schüler nur die Zeit */
  anderer: string | null;
  /** nur in Lehreransichten */
  schueler: string | null;
  partnerSchueler: string | null;
  lehrer: string | null;
  /** nur in Lehreransichten */
  notiz: string;
  /** beim Verschieben: der jetzige Raum und der Raum der gewählten freien Zeit (nur in Lehreransichten) */
  raumId: number | null;
  zielRaumId: number | null;
  grund: string;
  /** Wochen, in denen die Plätze liegen (für den Link zur Planung) */
  woche: string;
  platzIds: number[];
  datum: string;
  kannZustimmen: boolean;
  kannAblehnen: boolean;
  kannZurueckziehen: boolean;
  kannBestaetigen: boolean;
};

function sicht(z: Zeile, wer: Wer | "verwaltung", namenSchueler: Map<number, string> | null, namenLehrer: Map<number, string> | null): AnfrageSicht | null {
  const platz = getGeplanteEinheit(z.platz_id);
  if (!platz) return null;
  const partner = z.partner_platz_id === null ? null : getGeplanteEinheit(z.partner_platz_id);
  const vorher = vorherVon(z);
  const ziel = zielVon(z);
  const offen = z.status === "wartet" || z.status === "offen";
  const alsPartner = wer !== "verwaltung" && istPartner(wer, z);
  const eigene = wer !== "verwaltung" && (istSchueler(wer) ? z.student_id === wer.schuelerId : z.von === "lehrer" && z.von_teacher_id === wer.lehrer.id);
  const rolle: AnfrageSicht["rolle"] = wer === "verwaltung" ? "verwaltung" : alsPartner && !eigene ? "partner" : eigene ? "eigene" : "lehrer";
  // der andere Schüler sieht seinen eigenen Termin: von der Lage des anderen Platzes auf die Lage des ersten
  const dauer = platz.geplante_dauer;
  const partnerDauer = partner?.geplante_dauer ?? dauer;
  const ausPartnerSicht = rolle === "partner" && wer !== "verwaltung" && istSchueler(wer);
  return {
    id: z.id,
    art: z.art,
    status: z.status,
    rolle,
    von: ausPartnerSicht ? lageLabel(ziel, partnerDauer) : lageLabel(vorher, dauer),
    nach: ausPartnerSicht ? lageLabel(vorher, partnerDauer) : lageLabel(ziel, dauer),
    anderer: z.art === "tauschen" ? (ausPartnerSicht ? lageLabel(vorher, dauer) : lageLabel(ziel, partnerDauer)) : null,
    schueler: namenSchueler?.get(z.student_id) ?? null,
    partnerSchueler: z.partner_student_id === null ? null : (namenSchueler?.get(z.partner_student_id) ?? null),
    lehrer: namenLehrer?.get(platz.teacher_id) ?? null,
    notiz: namenSchueler || eigene ? z.notiz : "",
    raumId: namenSchueler ? platz.room_id : null,
    zielRaumId: namenSchueler ? z.ziel_raum_id : null,
    grund: z.grund,
    woche: vorher.week_start,
    platzIds: partner ? [platz.id, partner.id] : [platz.id],
    datum: z.created_at,
    kannZustimmen: z.status === "wartet" && alsPartner,
    kannAblehnen: offen && (wer === "verwaltung" || (z.status === "wartet" && alsPartner)),
    kannZurueckziehen: offen && eigene,
    kannBestaetigen: wer === "verwaltung" && z.status === "offen",
  };
}

/** unentschieden oder in den letzten ERLEDIGT_TAGE Tagen entschieden */
// mit der Uhr des Aufrufers (wie stelleAnfrage und bestaetige), nicht mit der Uhr der Datenbank
const aktuell = (now: Date, a = "") =>
  `(${a}status IN ('wartet', 'offen') OR datetime(${a}entschieden_at) >= datetime('${new Date(now).toISOString()}', '-${ERLEDIGT_TAGE} days'))`;

/** Für die Schüler-App: eigene Anfragen und Tauschanfragen an ihn, ohne Namen und ohne fremde Notizen. */
export function anfragenFuerSchueler(studentId: number, now: Date = new Date()): AnfrageSicht[] {
  const zeilen = db()
    .prepare(`SELECT * FROM terminanfragen WHERE (student_id = ? OR partner_student_id = ?) AND ${aktuell(now)} ORDER BY id DESC`)
    .all(studentId, studentId) as Zeile[];
  return zeilen.map((z) => sicht(z, { schuelerId: studentId }, null, null)).filter((s): s is AnfrageSicht => s !== null);
}

/** Für „Meine Woche“: Anfragen zu den eigenen Plätzen, an den Lehrer als andere Seite und die eigenen. */
export function anfragenFuerLehrer(akteur: Akteur, now: Date = new Date()): AnfrageSicht[] {
  const zeilen = db()
    .prepare(
      `SELECT a.* FROM terminanfragen a JOIN geplante_einheiten p ON p.id = a.platz_id LEFT JOIN geplante_einheiten q ON q.id = a.partner_platz_id
       WHERE (p.teacher_id = @me OR q.teacher_id = @me OR a.von_teacher_id = @me) AND ${aktuell(now, "a.")} ORDER BY a.id DESC`,
    )
    .all({ me: akteur.id }) as Zeile[];
  const s = namen("students");
  const t = namen("teachers");
  return zeilen.map((z) => sicht(z, { lehrer: akteur }, s, t)).filter((x): x is AnfrageSicht => x !== null);
}

/** Für die Verwaltung (Planung): alle unentschiedenen und die zuletzt entschiedenen. */
export function anfragenFuerVerwaltung(now: Date = new Date()): AnfrageSicht[] {
  const zeilen = db().prepare(`SELECT * FROM terminanfragen WHERE ${aktuell(now)} ORDER BY CASE status WHEN 'offen' THEN 0 WHEN 'wartet' THEN 1 ELSE 2 END, id DESC`).all() as Zeile[];
  const s = namen("students");
  const t = namen("teachers");
  return zeilen.map((z) => sicht(z, "verwaltung", s, t)).filter((x): x is AnfrageSicht => x !== null);
}

/**
 * Was in „Zu erledigen“ steht: für die Verwaltung jede offene Anfrage (bestätigen oder ablehnen), für einen
 * Lehrer jeder Tausch, der auf seine Zustimmung als andere Seite wartet.
 */
export function anfragenZuErledigen(akteur: Akteur): { id: number; aufgabe: "bestaetigen" | "zustimmen"; studentId: number; studentName: string; beschreibung: string; href: string; datum: string }[] {
  const out: ReturnType<typeof anfragenZuErledigen> = [];
  const zeilen = db().prepare("SELECT * FROM terminanfragen WHERE status IN ('wartet', 'offen') ORDER BY id").all() as Zeile[];
  const s = namen("students");
  for (const z of zeilen) {
    const aufgabe = z.status === "offen" && istAdmin(akteur) ? "bestaetigen" : z.status === "wartet" && istPartner({ lehrer: akteur }, z) && z.von_teacher_id !== akteur.id ? "zustimmen" : null;
    if (!aufgabe) continue;
    const v = sicht(z, "verwaltung", s, null);
    if (!v) continue;
    const studentId = aufgabe === "zustimmen" ? (z.partner_student_id ?? z.student_id) : z.student_id;
    out.push({
      id: z.id,
      aufgabe,
      studentId,
      studentName: s.get(studentId) ?? "",
      beschreibung: z.art === "tauschen" ? `${v.von} ↔ ${v.anderer}` : `${v.von} → ${v.nach}`,
      href: aufgabe === "bestaetigen" ? `/planung?woche=${v.woche}#terminanfragen` : "/mehr/uebersicht?tab=woche#terminanfragen",
      datum: z.created_at,
    });
  }
  return out;
}

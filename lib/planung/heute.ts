/**
 * „Heute“ für das Dashboard (Phase 4 des Merges, D17): die **veröffentlichten** Plätze des heutigen
 * Tages in Europe/Vienna.
 *
 * Warum nicht UTC: ein Platz ist als lokales Datum + Minuten ab Mitternacht gespeichert (§6), damit
 * die Zeitumstellung im März und Oktober nichts verschiebt. „Heute“ und „jetzt“ kommen deshalb
 * ausschließlich aus `lib/planung/zeit.ts`. Entwürfe sind hier nie dabei — die sieht nur die
 * Verwaltung; Lehrer und Schüler sehen ihren veröffentlichten Plan.
 */
import {
  minutenLabel,
  wienerDatum,
  wienerMinuten,
  wochenstartVon,
  wochentagVon,
  type Wochentag,
} from "./zeit";
import { einheitenFuerTag, istNichtStattgefunden, mitNamen, slotDatum, type GeplanteEinheitZeile, type PlatzMitNamen } from "./repo";

/**
 * Das geplante Zeitfenster eines Platzes, so wie es Lehrer und Schüler lesen (niko, 21.10.2026:
 * „wann der Schüler kommt und bis wann er aus hat“): „14:00–15:40“, dazu Beginn und Ende einzeln
 * und, nur am Tag des Platzes, die Minuten bis zum Ende (negativ = über der Zeit) und bis zum Beginn.
 */
export type Zeitfenster = {
  von: string;
  bis: string;
  /** „14:00–15:40“ */
  label: string;
  /** Minuten bis zum geplanten Ende; null, wenn der Platz nicht heute ist */
  restMinuten: number | null;
  /** Minuten bis zum geplanten Beginn (negativ = schon begonnen); null, wenn nicht heute */
  bisBeginn: number | null;
};

export function zeitfenster(zeile: Pick<GeplanteEinheitZeile, "week_start" | "weekday" | "start_min" | "geplante_dauer">, now: Date = new Date()): Zeitfenster {
  const ende = zeile.start_min + zeile.geplante_dauer;
  const heute = wienerDatum(now) === slotDatum(zeile.week_start, zeile.weekday);
  const jetzt = wienerMinuten(now);
  return {
    von: minutenLabel(zeile.start_min),
    bis: minutenLabel(ende),
    label: `${minutenLabel(zeile.start_min)}–${minutenLabel(ende)}`,
    restMinuten: heute ? ende - jetzt : null,
    bisBeginn: heute ? zeile.start_min - jetzt : null,
  };
}

/** „in 40 min“, „in 2 h 10 min“, „jetzt“ (schon begonnen) — für die Zeile „Als Nächstes“. */
export function bisBeginnLabel(minuten: number): string {
  if (minuten <= 0) return "jetzt";
  if (minuten < 60) return `in ${minuten} min`;
  return `in ${Math.floor(minuten / 60)} h ${String(minuten % 60).padStart(2, "0")} min`;
}

export type HeutePlatz = PlatzMitNamen & {
  /** "14:00–15:40" — so, wie es auf dem Dashboard steht. */
  zeit_label: string;
  /** Veröffentlicht, ohne Einheit und die geplante Zeit ist vorbei (D17). */
  nicht_stattgefunden: boolean;
};

function alsHeutePlatz(zeile: GeplanteEinheitZeile, now: Date): HeutePlatz {
  return {
    ...mitNamen([zeile])[0],
    zeit_label: `${minutenLabel(zeile.start_min)}–${minutenLabel(zeile.start_min + zeile.geplante_dauer)}`,
    nicht_stattgefunden: istNichtStattgefunden(zeile, now),
  };
}

/**
 * Die heutigen veröffentlichten Plätze, nach Startzeit. Ohne `teacherId` kommen die Plätze aller
 * Lehrer (Verwaltung), mit `teacherId` nur die eines Lehrers.
 */
export function heutigeEinheiten(teacherId?: number, now: Date = new Date()): HeutePlatz[] {
  const zeilen = einheitenFuerTag(wienerDatum(now), { status: "veroeffentlicht", teacherId });
  return zeilen.map((z) => alsHeutePlatz(z, now));
}

/** Die heutigen veröffentlichten Plätze eines Schülers (für `/lernen/[token]` und das Profil). */
export function heutigeEinheitenFuerSchueler(studentId: number, now: Date = new Date()): HeutePlatz[] {
  const zeilen = einheitenFuerTag(wienerDatum(now), { status: "veroeffentlicht", studentId });
  return zeilen.map((z) => alsHeutePlatz(z, now));
}

/**
 * Die heutigen veröffentlichten Plätze eines Schülers, die noch **keine** Einheit haben — daraus
 * wählt `lib/units.ts` beim Start einer Einheit den passenden Platz (D17): bevorzugt derselbe
 * Lehrer, dann die Startzeit, die „jetzt“ am nächsten liegt.
 */
export function offenePlaetzeHeute(studentId: number, opts: { teacherId?: number; now?: Date } = {}): HeutePlatz[] {
  const now = opts.now ?? new Date();
  const jetzt = wienerMinuten(now);
  return heutigeEinheitenFuerSchueler(studentId, now)
    .filter((p) => p.unit_id === null)
    .filter((p) => opts.teacherId === undefined || p.teacher_id === opts.teacherId)
    .sort((a, b) => Math.abs(a.start_min - jetzt) - Math.abs(b.start_min - jetzt) || a.start_min - b.start_min || a.id - b.id);
}

/** Der heutige Wochentag (ISO) in Europe/Vienna — für Ansichten, die „heute“ hervorheben. */
export function heutigerWochentag(now: Date = new Date()): Wochentag {
  return wochentagVon(wienerDatum(now));
}

/** Der Montag der laufenden Woche in Europe/Vienna. */
export function heutigerWochenstart(now: Date = new Date()): string {
  return wochenstartVon(wienerDatum(now));
}

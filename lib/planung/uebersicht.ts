/**
 * Die Sicht auf **eine Woche** (Phase 4 des Merges): alles, was die Wochenansicht
 * (`app/(tutor)/planung`), der Tab „Meine Woche“ auf dem Dashboard und der A4-Druck brauchen.
 *
 * Warum als eigene Datei: die Ansichten sollen **nichts rechnen**. Plätze mit Namen, Kennzahlen je
 * Lehrer und Schüler, die unnützen Lücken eines Lehrertags, die Summen und die Schüler, deren
 * Bedarf nicht gedeckt ist (`offen`, D18) entstehen hier auf dem Server; die Client-Komponenten
 * zeichnen nur noch. Die reinen Teile (`lueckenFuerTag`, `kennzahlen`) kommen ohne Datenbank aus
 * und werden in `uebersicht.test.ts` geprüft.
 *
 * Rechte prüft diese Datei **nicht** — das ist Sache der Seiten und Server Actions
 * (`lib/planung/berechtigungen.ts`, D23). Sie liest nur.
 */
import { listStudents } from "../repo";
import { leseRegeln } from "./regeln";
import {
  einheitenFuerWoche,
  getSchuelerPlanung,
  istNichtStattgefunden,
  listRaeume,
  mitNamen,
  wochenEingaben,
  wochenStatus,
  type ModusWunsch,
  type PlatzStatus,
  type RaumModus,
} from "./repo";
import { datumLabel, wochenLabel, wochenstartVon, wochentageDerWoche, type Wochentag } from "./zeit";
import { heutigerWochentag } from "./heute";
import type { Verfuegbarkeit } from "./verfuegbarkeit";

/** Vorgabe der Lückenschwelle, wenn keine Regeln gelesen werden können (Vorgabe in `regeln.ts`). */
const LUECKEN_SCHWELLE = 15;

export type UebersichtTage = { tag: Wochentag; datum: string; label: string };

export type UebersichtLehrer = {
  id: number;
  name: string;
  /** Wochenziel in Minuten; null = kein Ziel eingetragen. */
  zielMin: number | null;
  verfuegbarkeit: Verfuegbarkeit;
  /** Plätze dieser Woche in der betrachteten Sicht. */
  einheiten: number;
  minuten: number;
  /** Summe der unnützen Lücken (kürzer als `lueckenSchwelle`). */
  lueckenMinuten: number;
};

export type UebersichtSchueler = {
  id: number;
  name: string;
  teacherId: number | null;
  subjects: string[];
  einheitenProWoche: number;
  geplanteDauer: number;
  modus: ModusWunsch;
  einheiten: number;
  minuten: number;
};

export type UebersichtRaum = { id: number; name: string; building: string; mode: RaumModus };

export type UebersichtPlatz = {
  id: number;
  weekday: Wochentag;
  /** Minuten ab Mitternacht, Vielfaches von 10 (D19). */
  startMin: number;
  /** geplante Dauer (D3, D16): Das Ende ist `startMin + dauer`, es wird nicht gespeichert. */
  dauer: number;
  teacherId: number;
  teacherName: string;
  studentId: number;
  studentName: string;
  roomId: number | null;
  roomName: string | null;
  roomMode: RaumModus | null;
  roomBuilding: string | null;
  status: PlatzStatus;
  locked: boolean;
  unitId: number | null;
  /** Veröffentlicht, ohne Einheit und die geplante Zeit ist vorbei (D17). */
  nichtStattgefunden: boolean;
};

export type UebersichtLuecke = { teacherId: number; weekday: Wochentag; start: number; end: number };

/** Ein Schüler, dessen Bedarf diese Woche nicht gedeckt ist — die Liste des „Offen“-Schubfachs. */
export type UebersichtOffen = {
  studentId: number;
  studentName: string;
  /** bereits geplante Plätze und Minuten (gesperrte zählen mit). */
  geplanteEinheiten: number;
  geplanteMinuten: number;
  /** Bedarf: `einheiten_pro_woche` Plätze bzw. `einheiten_pro_woche × geplante_dauer` Minuten (D18). */
  einheitenProWoche: number;
  benoetigteMinuten: number;
  grund?: string;
};

export type WochenSummen = {
  einheiten: number;
  minuten: number;
  nichtStattgefunden: number;
  /** Schüler mit `einheiten_pro_woche > 0`, deren Plätze noch nicht reichen. */
  unterBedarf: number;
  /** 0–100: geplante Minuten im Verhältnis zu geplanten + unnützen Lückenminuten. */
  auslastung: number;
  lueckenMinuten: number;
};

export type WochenUebersicht = {
  /** Montag der Woche, YYYY-MM-DD. */
  woche: string;
  label: string;
  status: "leer" | "entwurf" | "veroeffentlicht";
  tage: UebersichtTage[];
  /** Heutiger Wochentag (ISO) in Europe/Vienna — die Ansicht hebt ihn hervor. */
  heute: Wochentag;
  plaetze: UebersichtPlatz[];
  lehrer: UebersichtLehrer[];
  schueler: UebersichtSchueler[];
  raeume: UebersichtRaum[];
  luecken: UebersichtLuecke[];
  /** Lücken unter dieser Länge gelten als unnütz (`regeln.gapUsefulMinutesThreshold`). */
  lueckenSchwelle: number;
  offen: UebersichtOffen[];
  summen: WochenSummen;
};

/**
 * Die Lücken eines Lehrertags: zwischen zwei aufeinanderfolgenden Blöcken, länger als 0 und kürzer
 * als `schwelle`. Kürzere Lücken sind laut Regeln unnütz und werden auch nur mit
 * `penaltyPer30MinGap` bewertet; ab der Schwelle gelten sie als Bruch (siehe `docs/planung.md`).
 */
export function lueckenFuerTag(bloecke: { start: number; end: number }[], schwelle: number): { start: number; end: number }[] {
  const sortiert = [...bloecke].sort((a, b) => a.start - b.start || a.end - b.end);
  const luecken: { start: number; end: number }[] = [];
  for (let i = 0; i < sortiert.length - 1; i++) {
    const start = sortiert[i].end;
    const ende = sortiert[i + 1].start;
    if (ende > start && ende - start < schwelle) luecken.push({ start, end: ende });
  }
  return luecken;
}

/** Alle unnützen Lücken einer Woche, je Lehrer und Tag. */
export function lueckenDerWoche(
  plaetze: { teacherId: number; weekday: number; startMin: number; dauer: number }[],
  schwelle: number,
): UebersichtLuecke[] {
  const proTag = new Map<string, { teacherId: number; weekday: Wochentag; bloecke: { start: number; end: number }[] }>();
  for (const p of plaetze) {
    const schluessel = `${p.teacherId}|${p.weekday}`;
    const eintrag = proTag.get(schluessel) ?? { teacherId: p.teacherId, weekday: p.weekday as Wochentag, bloecke: [] };
    eintrag.bloecke.push({ start: p.startMin, end: p.startMin + p.dauer });
    proTag.set(schluessel, eintrag);
  }
  const out: UebersichtLuecke[] = [];
  for (const eintrag of proTag.values())
    for (const luecke of lueckenFuerTag(eintrag.bloecke, schwelle)) out.push({ teacherId: eintrag.teacherId, weekday: eintrag.weekday, start: luecke.start, end: luecke.end });
  return out.sort((a, b) => a.teacherId - b.teacherId || a.weekday - b.weekday || a.start - b.start);
}

/**
 * Die Kennzahlen einer Woche: Anzahl und Minuten, ausgefallene Plätze, Schüler unter Bedarf und die
 * Auslastung (ein Maß dafür, wie geschlossen die Lehrertage sind — 100 % = keine unnütze Lücke).
 */
export function kennzahlen(
  plaetze: { teacherId: number; studentId: number; weekday: number; startMin: number; dauer: number; nichtStattgefunden?: boolean }[],
  schueler: { id: number; einheitenProWoche: number }[],
  lehrer: { id: number }[],
  schwelle: number = LUECKEN_SCHWELLE,
): WochenSummen {
  const minuten = plaetze.reduce((summe, p) => summe + p.dauer, 0);
  const luecken = lueckenDerWoche(
    plaetze.filter((p) => lehrer.some((l) => l.id === p.teacherId)),
    schwelle,
  );
  const lueckenMinuten = luecken.reduce((summe, l) => summe + (l.end - l.start), 0);
  const geplant = plaetze.filter((p) => lehrer.some((l) => l.id === p.teacherId)).reduce((summe, p) => summe + p.dauer, 0);
  const proSchueler = new Map<number, number>();
  for (const p of plaetze) proSchueler.set(p.studentId, (proSchueler.get(p.studentId) ?? 0) + 1);
  return {
    einheiten: plaetze.length,
    minuten,
    nichtStattgefunden: plaetze.filter((p) => p.nichtStattgefunden).length,
    unterBedarf: schueler.filter((s) => s.einheitenProWoche > 0 && (proSchueler.get(s.id) ?? 0) < s.einheitenProWoche).length,
    auslastung: geplant + lueckenMinuten === 0 ? 100 : Math.round((geplant / (geplant + lueckenMinuten)) * 100),
    lueckenMinuten,
  };
}

/**
 * Die Schüler, deren Bedarf diese Woche nicht gedeckt ist (D18): `einheiten_pro_woche` Plätze sind
 * verlangt, gezählt werden die Plätze der Woche (Entwurf **und** veröffentlicht). Das ist die
 * Liste des „Offen“-Schubfachs — sie kommt aus der Datenbank, nicht aus dem letzten Generierlauf,
 * und stimmt deshalb auch nach dem Verschieben eines einzelnen Platzes noch.
 */
export function offeneFuerWoche(weekStart: string): UebersichtOffen[] {
  const woche = wochenstartVon(weekStart);
  const eingaben = wochenEingaben(woche);
  const plaetze = einheitenFuerWoche(woche, { status: "alle" });
  const minuten = new Map<number, number>();
  const anzahl = new Map<number, number>();
  for (const p of plaetze) {
    minuten.set(p.student_id, (minuten.get(p.student_id) ?? 0) + p.geplante_dauer);
    anzahl.set(p.student_id, (anzahl.get(p.student_id) ?? 0) + 1);
  }
  const keineRaeume = eingaben.raeume.length === 0;
  const offen: UebersichtOffen[] = [];
  for (const s of eingaben.schueler) {
    const geplanteEinheiten = anzahl.get(s.id) ?? 0;
    if (geplanteEinheiten >= s.einheitenProWoche) continue;
    const benoetigteMinuten = s.einheitenProWoche * s.geplanteDauer;
    const geplanteMinuten = minuten.get(s.id) ?? 0;
    offen.push({
      studentId: s.id,
      studentName: s.name,
      geplanteEinheiten,
      geplanteMinuten,
      einheitenProWoche: s.einheitenProWoche,
      benoetigteMinuten,
      grund: keineRaeume ? "Keine Räume vorhanden." : undefined,
    });
  }
  return offen.sort((a, b) => b.benoetigteMinuten - b.geplanteMinuten - (a.benoetigteMinuten - a.geplanteMinuten) || a.studentName.localeCompare(b.studentName, "de"));
}

/**
 * Die ganze Sicht auf eine Woche. `status` grenzt ein, was gezeigt wird: die Verwaltung nimmt
 * `"alle"` (Entwurf und veröffentlicht), ein Lehrer nur `"veroeffentlicht"` (`nurLehrerId`), der
 * A4-Druck ebenso. `offen` rechnet immer über die **ganze** Woche, unabhängig von der Sicht.
 */
export function wochenUebersicht(weekStart: string, opts: { status?: PlatzStatus | "alle"; nurLehrerId?: number; now?: Date } = {}): WochenUebersicht {
  const woche = wochenstartVon(weekStart);
  const now = opts.now ?? new Date();
  const eingaben = wochenEingaben(woche);
  const regeln = leseRegeln();
  const schwelle = Number(regeln.gapUsefulMinutesThreshold) || LUECKEN_SCHWELLE;

  const zeilen = einheitenFuerWoche(woche, { status: opts.status ?? "alle" }).filter(
    (z) => opts.nurLehrerId === undefined || z.teacher_id === opts.nurLehrerId,
  );
  const plaetze: UebersichtPlatz[] = mitNamen(zeilen).map((z) => ({
    id: z.id,
    weekday: z.weekday,
    startMin: z.start_min,
    dauer: z.geplante_dauer,
    teacherId: z.teacher_id,
    teacherName: z.teacher_name,
    studentId: z.student_id,
    studentName: z.student_name,
    roomId: z.room_id,
    roomName: z.room_name,
    roomMode: z.room_mode,
    roomBuilding: z.room_building,
    status: z.status,
    locked: z.locked === 1,
    unitId: z.unit_id,
    nichtStattgefunden: istNichtStattgefunden(z, now),
  }));

  // Lehrerkacheln: Namen, Verfügbarkeit und Wochenziel kommen aus den Eingaben des Generators
  // (dort ist die Wochenabweichung schon eingerechnet), die Zahlen aus den gezeigten Plätzen.
  const lehrer: UebersichtLehrer[] = eingaben.lehrer
    .filter((l) => opts.nurLehrerId === undefined || l.id === opts.nurLehrerId)
    .map((l) => {
      const meine = plaetze.filter((p) => p.teacherId === l.id);
      const luecken = lueckenDerWoche(meine, schwelle);
      return {
        id: l.id,
        name: l.name,
        zielMin: l.weeklyTargetMinutes || null,
        verfuegbarkeit: l.availability,
        einheiten: meine.length,
        minuten: meine.reduce((summe, p) => summe + p.dauer, 0),
        lueckenMinuten: luecken.reduce((summe, x) => summe + (x.end - x.start), 0),
      };
    });

  // alle Schüler der Einrichtung (auch die ohne Bedarf — ein Platz von Hand ist möglich).
  // Eine eingegrenzte Sicht (Lehrer, `nurLehrerId`) kennt nur die Schüler, die in ihr vorkommen:
  // ein Lehrer soll nicht die Planung und den Bedarf fremder Schüler sehen (D23).
  const sichtbareSchuelerIds = new Set(plaetze.map((p) => p.studentId));
  const schueler: UebersichtSchueler[] = listStudents()
    .filter((s) => opts.nurLehrerId === undefined || sichtbareSchuelerIds.has(s.id))
    .map((s) => {
      const planung = getSchuelerPlanung(s.id);
      const meine = plaetze.filter((p) => p.studentId === s.id);
      return {
        id: s.id,
        name: s.name,
        teacherId: s.teacher_id,
        subjects: s.subjects,
        einheitenProWoche: planung?.einheiten_pro_woche ?? 0,
        geplanteDauer: planung?.geplante_dauer ?? 100,
        modus: planung?.modus_wunsch ?? "egal",
        einheiten: meine.length,
        minuten: meine.reduce((summe, p) => summe + p.dauer, 0),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  return {
    woche,
    label: wochenLabel(woche),
    status: wochenStatus(woche),
    tage: wochentageDerWoche(woche).map((t) => ({ ...t, label: datumLabel(t.datum) })),
    heute: heutigerWochentag(now),
    plaetze,
    lehrer,
    schueler,
    raeume: listRaeume().map((r) => ({ id: r.id, name: r.name, building: r.building, mode: r.mode })),
    luecken: lueckenDerWoche(plaetze, schwelle),
    lueckenSchwelle: schwelle,
    // Das Schubfach gehört der Verwaltung: es zeigt, wessen Bedarf die **ganze** Woche nicht deckt.
    // In einer eingegrenzten Sicht (Lehrer) bleibt es leer — er plant nicht.
    offen: opts.nurLehrerId === undefined ? offeneFuerWoche(woche) : [],
    summen: kennzahlen(plaetze, schueler, lehrer, schwelle),
  };
}

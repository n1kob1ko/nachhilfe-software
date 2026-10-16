/**
 * Die Regeln des Wochenplans (Entscheidung D2): Bewertungspunkte, harte Regeln und Paarregeln.
 *
 * Vorbild ist `config/scheduling-rules.json` des Quell-Repos, **ohne** die dort eingetragenen
 * konkreten Paar-Ids (die waren an dessen Datenbank gebunden). Abgelegt werden die Regeln in der
 * Tabelle `app_settings` unter dem Schlüssel `planung_regeln` als JSON und beim Lesen mit zod
 * geprüft:
 *
 * - **fehlend oder ungültig → die Vorgaben** (`STANDARD_REGELN`), ohne Absturz. Das ist das
 *   Verhalten zur Laufzeit; `pruefeRegeln` meldet den Fehler laut, damit Tests und der
 *   Schreibweg (Verwaltung) ihn sehen.
 * - Paarregeln nennen Schüler **als ganze Zahl** (`studentAId`/`studentBId`), nicht als Text-Id wie
 *   im Quell-Repo.
 *
 * Die Feldnamen sind die des Quell-Repos, damit ein dort gespeicherter Regelsatz hier lesbar bleibt
 * und der Port nachvollziehbar ist. Die Startzeiten liegen immer auf einem 10-Minuten-Raster (D19);
 * `snapMinutes` ist deshalb auf Vielfache von 10 begrenzt (Vorgabe 10).
 */
import { z } from "zod";
import { db } from "../db";

export const REGELN_SCHLUESSEL = "planung_regeln";

export const PAAR_STAERKEN = ["must", "should", "shouldnt", "mustnt"] as const;
export type PaarStaerke = (typeof PAAR_STAERKEN)[number];

/**
 * `must` versucht die beiden Schüler zur selben Zeit einzuplanen (hart, solange noch
 * Überlappungsbedarf besteht), `mustnt` verbietet dieselbe Zeit. `should`/`shouldnt` sind Punkte
 * bzw. Abzug — werden aber hart, sobald ihr Punktwert 999 erreicht (so liest der Generator sie,
 * wie im Quell-Repo).
 */
export type PaarRegel = {
  id: string;
  studentAId: number;
  studentBId: number;
  strength: PaarStaerke;
};

/**
 * Vorgaben = Werte der `config/scheduling-rules.json` des Quell-Repos, nur die konkreten Paar-Ids
 * fallen weg (`studentPairTimingRules: []`).
 */
export const STANDARD_REGELN = {
  snapMinutes: 10,
  gapUsefulMinutesThreshold: 15,
  pointsPreferredTeacher: 0,
  pointsAdjacentTeacher: 0,
  penaltyPer30MinGap: 999,
  penaltySingleLessonTeacherDay: 10,
  penaltyLessPlannedLessonsOverall: 980,
  pointsPerMinuteRemainingCapacity: 2,
  pointsStudentPairShouldSameTime: 25,
  penaltyStudentPairShouldntSameTime: 25,
  prioritizeMaxPlannedLessons: true,
  enforceSingleLessonPerStudentPerDay: true,
  enforceTeacherCapacity: false,
  enforceTeacherAvailability: true,
  enforceStudentAvailability: true,
  enforceTeacherRoomPreference: true,
  enforceNoTeacherBreaks: true,
  enforceStudentWeekWeekendDistribution: false,
  studentPairTimingRules: [] as PaarRegel[],
} as const;

export const regelnSchema = z.object({
  /** Raster der Startzeiten in Minuten; Vielfache von 10, damit D19 gilt. */
  snapMinutes: z
    .number()
    .int()
    .min(10)
    .max(60)
    .refine((n) => n % 10 === 0, { message: "Das Raster muss ein Vielfaches von 10 Minuten sein." })
    .default(STANDARD_REGELN.snapMinutes),
  /** Lücken unterhalb dieser Länge gelten als unnütz und werden bestraft. */
  gapUsefulMinutesThreshold: z.number().int().min(1).max(1440).default(STANDARD_REGELN.gapUsefulMinutesThreshold),
  pointsPreferredTeacher: z.number().int().min(0).max(100_000).default(STANDARD_REGELN.pointsPreferredTeacher),
  pointsAdjacentTeacher: z.number().int().min(0).max(100_000).default(STANDARD_REGELN.pointsAdjacentTeacher),
  penaltyPer30MinGap: z.number().int().min(0).max(100_000).default(STANDARD_REGELN.penaltyPer30MinGap),
  penaltySingleLessonTeacherDay: z.number().int().min(0).max(100_000).default(STANDARD_REGELN.penaltySingleLessonTeacherDay),
  penaltyLessPlannedLessonsOverall: z.number().int().min(0).max(100_000).default(STANDARD_REGELN.penaltyLessPlannedLessonsOverall),
  pointsPerMinuteRemainingCapacity: z.number().int().min(0).max(100_000).default(STANDARD_REGELN.pointsPerMinuteRemainingCapacity),
  pointsStudentPairShouldSameTime: z.number().int().min(0).max(100_000).default(STANDARD_REGELN.pointsStudentPairShouldSameTime),
  penaltyStudentPairShouldntSameTime: z.number().int().min(0).max(100_000).default(STANDARD_REGELN.penaltyStudentPairShouldntSameTime),
  prioritizeMaxPlannedLessons: z.boolean().default(STANDARD_REGELN.prioritizeMaxPlannedLessons),
  enforceSingleLessonPerStudentPerDay: z.boolean().default(STANDARD_REGELN.enforceSingleLessonPerStudentPerDay),
  enforceTeacherCapacity: z.boolean().default(STANDARD_REGELN.enforceTeacherCapacity),
  enforceTeacherAvailability: z.boolean().default(STANDARD_REGELN.enforceTeacherAvailability),
  enforceStudentAvailability: z.boolean().default(STANDARD_REGELN.enforceStudentAvailability),
  enforceTeacherRoomPreference: z.boolean().default(STANDARD_REGELN.enforceTeacherRoomPreference),
  enforceNoTeacherBreaks: z.boolean().default(STANDARD_REGELN.enforceNoTeacherBreaks),
  enforceStudentWeekWeekendDistribution: z.boolean().default(STANDARD_REGELN.enforceStudentWeekWeekendDistribution),
  studentPairTimingRules: z
    .array(
      z
        .object({
          id: z.string().trim().max(80).default(""),
          /** Schüler sind ganze Zahlen (Datenbank-Ids), nicht Text wie im Quell-Repo. */
          studentAId: z.number().int().positive(),
          studentBId: z.number().int().positive(),
          strength: z.enum(PAAR_STAERKEN),
        })
        .refine((r) => r.studentAId !== r.studentBId, { message: "Ein Schüler kann nicht mit sich selbst ein Paar bilden." }),
    )
    .max(200)
    .default([]),
});

export type PlanungsRegeln = z.infer<typeof regelnSchema>;

/** Eine frische Kopie der Vorgaben (nie das geteilte Objekt selbst, damit niemand hineinschreibt). */
export function standardRegeln(): PlanungsRegeln {
  return { ...STANDARD_REGELN, studentPairTimingRules: [] };
}

/** Prüft einen rohen Wert (Objekt oder JSON-Text) und meldet, was nicht passt. */
export function pruefeRegeln(roh: unknown): { ok: true; regeln: PlanungsRegeln } | { ok: false; fehler: string } {
  let daten: unknown = roh;
  if (typeof roh === "string") {
    if (!roh.trim()) return { ok: true, regeln: standardRegeln() };
    try {
      daten = JSON.parse(roh);
    } catch {
      return { ok: false, fehler: "Die Planungsregeln konnten nicht gelesen werden (kein JSON)." };
    }
  }
  if (daten === null || daten === undefined) return { ok: true, regeln: standardRegeln() };
  if (typeof daten !== "object" || Array.isArray(daten)) return { ok: false, fehler: "Die Planungsregeln müssen ein Objekt sein." };
  const geprüft = regelnSchema.safeParse(daten);
  if (!geprüft.success) {
    const erster = geprüft.error.issues[0];
    const feld = String(erster?.path[0] ?? "");
    return { ok: false, fehler: feld ? `${feld}: ${erster.message}` : (erster?.message ?? "Die Planungsregeln passen nicht.") };
  }
  return { ok: true, regeln: geprüft.data };
}

/**
 * Die Regeln aus `app_settings`. Fehlt der Eintrag oder ist er kaputt, gelten die Vorgaben —
 * die Planung darf an einer kaputten Einstellung nie scheitern. Wer den Fehler sehen will, ruft
 * `pruefeRegeln` mit dem gespeicherten Text.
 */
export function leseRegeln(): PlanungsRegeln {
  const roh = (db().prepare("SELECT value FROM app_settings WHERE key = ?").get(REGELN_SCHLUESSEL) as { value: string } | undefined)?.value;
  if (!roh) return standardRegeln();
  const geprüft = pruefeRegeln(roh);
  return geprüft.ok ? geprüft.regeln : standardRegeln();
}

/** Schreibt die Regeln validiert nach `app_settings`; ungültige Werte werden abgelehnt, nicht geglättet. */
export function schreibeRegeln(roh: unknown): { ok: true; regeln: PlanungsRegeln } | { ok: false; fehler: string } {
  const geprüft = pruefeRegeln(roh);
  if (!geprüft.ok) return geprüft;
  db()
    .prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(REGELN_SCHLUESSEL, JSON.stringify(geprüft.regeln));
  return geprüft;
}

/** Der gespeicherte Text, wie ihn die Verwaltung im Formular sieht (leer, wenn nichts gespeichert ist). */
export function regelnJson(): string {
  return (db().prepare("SELECT value FROM app_settings WHERE key = ?").get(REGELN_SCHLUESSEL) as { value: string } | undefined)?.value ?? "";
}

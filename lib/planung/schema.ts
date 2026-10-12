/**
 * zod-Schemata der Planung (Phase 3 des Merges): Verfügbarkeit, Raum, Wochenziel, Schülerplanung.
 * Alles, was aus einem Formular kommt, geht hier durch — auch die **geplante Dauer** (1–300, D3).
 */
import { z } from "zod";
import { TAG_SCHLUESSEL } from "./zeit";

export const tagSchluesselSchema = z.enum(TAG_SCHLUESSEL);

/** Eine Spanne innerhalb eines Tages, in Minuten ab Mitternacht. */
export const spanneSchema = z
  .object({
    start: z.number().int().min(0).max(1440),
    end: z.number().int().min(0).max(1440),
  })
  .refine((s) => s.end > s.start, { message: "Das Ende muss nach dem Beginn liegen." });

/** { "1": [{ start, end }], … }, ISO-Wochentag 1 = Montag … 7 = Sonntag. Fehlende Tage = frei. */
export const verfuegbarkeitSchema = z.partialRecord(tagSchluesselSchema, z.array(spanneSchema).max(24));

export const raumSchema = z.object({
  building: z.string().trim().min(1, "Bitte ein Gebäude angeben.").max(80),
  name: z.string().trim().min(1, "Bitte einen Raumnamen angeben.").max(80),
  mode: z.enum(["vor_ort", "online"]),
});

/** Wochenziel eines Lehrers in Minuten; 0 und leer heißen „kein Ziel“. */
export const wochenzielSchema = z.number().int().min(0).max(60 * 24);

export const idListeSchema = z.array(z.number().int().positive()).max(60);

export const schuelerPlanungSchema = z.object({
  einheiten_pro_woche: z.number().int().min(0).max(40),
  /** geplante Dauer: Vorgabe 100, erlaubt 1–300 (D3). */
  geplante_dauer: z
    .number()
    .int()
    .min(1, "Die geplante Dauer muss zwischen 1 und 300 Minuten liegen.")
    .max(300, "Die geplante Dauer muss zwischen 1 und 300 Minuten liegen."),
  modus_wunsch: z.enum(["vor_ort", "online", "egal"]),
  erlaubte_lehrer: idListeSchema,
  availability: verfuegbarkeitSchema,
});

export const abweichungSchema = z.object({
  owner_type: z.enum(["teacher", "student"]),
  owner_id: z.number().int().positive(),
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte eine Woche wählen."),
  availability: verfuegbarkeitSchema,
});

/** Erste Fehlermeldung eines zod-Fehlers, mit Feldnamen davor — so, wie sie in der App steht. */
export function fehlerText(fehler: z.ZodError, beschriftungen: Record<string, string> = {}): string {
  const erster = fehler.issues[0];
  if (!erster) return "Die Eingabe passt nicht.";
  const feld = String(erster.path[0] ?? "");
  const name = beschriftungen[feld];
  return name ? `${name}: ${erster.message}` : erster.message;
}

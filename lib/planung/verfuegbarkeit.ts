/**
 * Die Verfügbarkeit (Glossar: **Verfügbarkeit**) als Wert und als JSON-Spalte.
 *
 * Form: `{ "1": [{ start, end }], … }` — Schlüssel sind ISO-Wochentage **1 = Montag … 7 = Sonntag**
 * (siehe `lib/planung/zeit.ts`, die einzige Umrechnungsstelle), Werte sind Spannen in **Minuten ab
 * Mitternacht**. Ein fehlender Tag heißt: nicht verfügbar.
 *
 * Gelesen wird nachsichtig: eine kaputte Spalte ergibt eine leere Verfügbarkeit, nie einen Absturz.
 * Geschrieben wird streng (`parseVerfuegbarkeitStreng`), damit ein Formularfehler gemeldet wird.
 */
import { fehlerText, verfuegbarkeitSchema } from "./schema";
import { MINUTEN_PRO_TAG, TAG_SCHLUESSEL, WOCHENTAGE, WOCHENTAG_KURZ, minutenLabel, type TagSchluessel, type Wochentag } from "./zeit";

export type Spanne = { start: number; end: number };
export type Verfuegbarkeit = Partial<Record<TagSchluessel, Spanne[]>>;

export const LEERE_VERFUEGBARKEIT: Verfuegbarkeit = {};

/** Alle Tage in ISO-Reihenfolge (Montag zuerst). */
export const TAGE: readonly Wochentag[] = WOCHENTAGE;

/** Sortiert, verschmilzt Überlappungen und aneinandergrenzende Spannen, wirft Ungültiges weg. */
export function normalisiereVerfuegbarkeit(v: Verfuegbarkeit): Verfuegbarkeit {
  const out: Verfuegbarkeit = {};
  for (const tag of TAG_SCHLUESSEL) {
    const roh = v[tag];
    if (!Array.isArray(roh)) continue;
    const spannen = roh
      .filter((s) => s && Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
      .map((s) => ({
        start: Math.max(0, Math.min(MINUTEN_PRO_TAG, Math.round(s.start))),
        end: Math.max(0, Math.min(MINUTEN_PRO_TAG, Math.round(s.end))),
      }))
      .filter((s) => s.end > s.start)
      .sort((a, b) => a.start - b.start);
    const zusammen: Spanne[] = [];
    for (const s of spannen) {
      const letzte = zusammen[zusammen.length - 1];
      if (letzte && s.start <= letzte.end) letzte.end = Math.max(letzte.end, s.end);
      else zusammen.push({ ...s });
    }
    if (zusammen.length) out[tag] = zusammen;
  }
  return out;
}

/** Liest die Spalte. Kaputtes JSON oder eine falsche Form ergeben `{}` statt eines Fehlers. */
export function parseVerfuegbarkeit(raw: string | null | undefined): Verfuegbarkeit {
  if (!raw) return {};
  let daten: unknown;
  try {
    daten = JSON.parse(raw);
  } catch {
    return {};
  }
  const geprüft = verfuegbarkeitSchema.safeParse(daten);
  return geprüft.success ? normalisiereVerfuegbarkeit(geprüft.data) : {};
}

/** Für Schreibwege: meldet, was nicht passt (JSON-Fehler oder ungültige Spanne). */
export function parseVerfuegbarkeitStreng(raw: unknown): { ok: true; wert: Verfuegbarkeit } | { ok: false; fehler: string } {
  let daten: unknown = raw;
  if (typeof raw === "string") {
    if (!raw.trim()) return { ok: true, wert: {} };
    try {
      daten = JSON.parse(raw);
    } catch {
      return { ok: false, fehler: "Die Verfügbarkeit konnte nicht gelesen werden." };
    }
  }
  if (daten === null || daten === undefined) return { ok: true, wert: {} };
  const geprüft = verfuegbarkeitSchema.safeParse(daten);
  if (!geprüft.success) return { ok: false, fehler: fehlerText(geprüft.error) };
  return { ok: true, wert: normalisiereVerfuegbarkeit(geprüft.data) };
}

/** Immer dieselbe, sortierte Schreibweise — so ist ein Lese-Schreib-Umlauf identisch. */
export function serializeVerfuegbarkeit(v: Verfuegbarkeit): string {
  return JSON.stringify(normalisiereVerfuegbarkeit(v));
}

export function spannenFuerTag(v: Verfuegbarkeit, tag: Wochentag): Spanne[] {
  return v[String(tag) as TagSchluessel] ?? [];
}

export function istVerfuegbarkeitLeer(v: Verfuegbarkeit): boolean {
  return TAG_SCHLUESSEL.every((tag) => !(v[tag]?.length));
}

/** Summe der verfügbaren Minuten in der Woche. */
export function verfuegbarkeitMinuten(v: Verfuegbarkeit): number {
  let summe = 0;
  for (const tag of TAG_SCHLUESSEL) for (const s of v[tag] ?? []) summe += s.end - s.start;
  return summe;
}

/** "Mo 14:00–18:00 · Mi 09:00–11:00"; "keine" wenn nichts eingetragen ist. */
export function verfuegbarkeitLabel(v: Verfuegbarkeit, kurz: Record<Wochentag, string> = WOCHENTAG_KURZ): string {
  const teile: string[] = [];
  for (const tag of TAGE) {
    const spannen = spannenFuerTag(v, tag);
    if (spannen.length) teile.push(`${kurz[tag]} ${spannen.map((s) => `${minutenLabel(s.start)}–${minutenLabel(s.end)}`).join(", ")}`);
  }
  return teile.length ? teile.join(" · ") : "keine";
}

export type { TagSchluessel, Wochentag };

/**
 * Fächer (niko, 22.10.2026, „alle Schulfächer, zentral und erweiterbar“): die eine Liste, aus der jedes
 * Fach-Feld wählt — Profil, Einheit, Hausübung, Schularbeit, aktueller Stoff, Material, Texte. Beim Start
 * kommen die Schulfächer aus `SCHULFAECHER` (lib/school.ts) dazu; die Verwaltung legt eigene an und
 * deaktiviert, was niemand braucht. Umbenannt oder gelöscht wird nie: Einheiten, Schularbeiten und Profile
 * halten das Fach als Text, ein alter Eintrag („Klavier“) bleibt also gültig, auch wenn er hier fehlt.
 * Lehrplan, Generatoren und Lernstand gibt es weiter nur für `SUBJECTS` (Mathematik, Deutsch, Englisch).
 */
import { db } from "./db";
import { SUBJECTS } from "./curriculum";
import { fachAus } from "./school";

export type Fach = { id: number; name: string; aktiv: number; sort: number; created_at: string };

/** Hat das Fach Lehrplan, Übungen und Lernstand je Fähigkeit? */
export const mitUebungen = (name: string) => (SUBJECTS as readonly string[]).includes(name);

export function listFaecher(o: { mitInaktiven?: boolean } = {}): Fach[] {
  return db()
    .prepare(`SELECT id, name, aktiv, sort, created_at FROM faecher ${o.mitInaktiven ? "" : "WHERE aktiv = 1"} ORDER BY sort, id`)
    .all() as Fach[];
}

/** Die aktiven Fächer in ihrer Reihenfolge: das, was jedes Fach-Feld anbietet. */
export function fachNamen(): string[] {
  return listFaecher().map((f) => f.name);
}

/** Alle Fächer, auch deaktivierte: daran wird ein eingetipptes Fach in seine Schreibweise gebracht. */
export function alleFachNamen(): string[] {
  return listFaecher({ mitInaktiven: true }).map((f) => f.name);
}

/** „Weitere Fächer“ in einem Fach-Menü: die aktiven Fächer, die nicht schon die des Schülers sind. */
export function weitereFaecher(eigene: string[] = []): string[] {
  return fachNamen().filter((f) => !eigene.includes(f));
}

export type FachErgebnis = { ok: true; id: number; hinweis: string } | { ok: false; fehler: string };

/**
 * Ein neues Fach ans Ende der Liste, groß geschrieben („klavier“ → „Klavier“). Gibt es den Namen schon
 * deaktiviert, wird er wieder aktiv.
 */
export function addFach(roh: string): FachErgebnis {
  const v = fachAus(roh, [], alleFachNamen());
  const name = v.charAt(0).toLocaleUpperCase("de") + v.slice(1);
  if (name.length < 2) return { ok: false, fehler: "Bitte den Namen des Fachs eintragen." };
  if (/[,;]/.test(name)) return { ok: false, fehler: "Ein Fach ohne Beistrich, bitte. Mehrere Fächer einzeln anlegen." };
  const da = listFaecher({ mitInaktiven: true }).find((f) => f.name.toLowerCase() === name.toLowerCase());
  if (da) {
    if (da.aktiv) return { ok: false, fehler: `${da.name} steht schon in der Liste.` };
    db().prepare("UPDATE faecher SET aktiv = 1 WHERE id = ?").run(da.id);
    return { ok: true, id: da.id, hinweis: `${da.name} ist wieder aktiv.` };
  }
  const { n } = db().prepare("SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM faecher").get() as { n: number };
  const res = db().prepare("INSERT INTO faecher (name, sort) VALUES (?, ?)").run(name, n);
  return { ok: true, id: Number(res.lastInsertRowid), hinweis: `${name} ist angelegt.` };
}

/** Aktivieren oder deaktivieren. Mathematik, Deutsch und Englisch bleiben immer aktiv. */
export function setFachAktiv(id: number, aktiv: boolean): FachErgebnis {
  const f = db().prepare("SELECT id, name FROM faecher WHERE id = ?").get(id) as { id: number; name: string } | undefined;
  if (!f) return { ok: false, fehler: "Dieses Fach gibt es nicht." };
  if (!aktiv && mitUebungen(f.name)) return { ok: false, fehler: `${f.name} bleibt aktiv: daran hängen Lehrplan und Übungen.` };
  db().prepare("UPDATE faecher SET aktiv = ? WHERE id = ?").run(aktiv ? 1 : 0, id);
  return { ok: true, id, hinweis: aktiv ? `${f.name} ist wieder aktiv.` : `${f.name} ist deaktiviert. Alte Einträge behalten das Fach.` };
}

/**
 * Fächer, die in Einträgen stehen (Profil, Einheit, Hausübung, Schularbeit, Stoff, Material, Text),
 * aber nicht in der Liste — meist frei eingetippt. Die Verwaltung kann sie mit einem Tipp aufnehmen.
 */
export function fremdeFaecher(): { name: string; anzahl: number }[] {
  const conn = db();
  const zaehler = new Map<string, number>();
  const zaehle = (name: string, n = 1) => {
    const v = name.trim();
    if (v) zaehler.set(v, (zaehler.get(v) ?? 0) + n);
  };
  for (const t of ["lessons", "homework", "tests", "current_material", "materials", "texts"]) {
    for (const r of conn.prepare(`SELECT subject, COUNT(*) AS n FROM ${t} WHERE subject <> '' GROUP BY subject`).all() as { subject: string; n: number }[]) zaehle(r.subject, r.n);
  }
  for (const r of conn.prepare("SELECT subjects FROM students").all() as { subjects: string }[]) {
    try {
      for (const s of JSON.parse(r.subjects) as unknown[]) if (typeof s === "string") zaehle(s);
    } catch {
      // ein kaputtes Feld zählt nicht
    }
  }
  const bekannt = new Set(alleFachNamen().map((f) => f.toLowerCase()));
  return [...zaehler]
    .filter(([name]) => !bekannt.has(name.toLowerCase()))
    .map(([name, anzahl]) => ({ name, anzahl }))
    .sort((a, b) => b.anzahl - a.anzahl || a.name.localeCompare(b.name, "de"));
}

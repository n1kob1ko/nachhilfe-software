/**
 * Spielprofil für Wochenliga und Duelle (niko 2026-11-11: „ein Ranking, damit die Schüler gegeneinander spielen“).
 *
 * - **Freiwillig**: ohne Profil spielt der Schüler wie bisher allein. Liga und Duelle lassen sich einzeln ausschalten.
 * - **Der echte Name** (niko 2026-11-25: „ich will nicht mehr anonyme Usernames, es soll der Schülername angezeigt
 *   werden“): andere sehen den Vornamen und den ersten Buchstaben des Nachnamens („Max M.“, `spielName`), dazu das
 *   Tierbild. Vorher stand ein Spitzname aus zwei Listen da („Blitzfuchs“); die Spalte `spielprofile.name` gibt es noch
 *   als innerer Schlüssel, gezeigt wird sie nicht mehr.
 * - **Für alle erlaubt** (niko 2026-11-16: „mach die erlaubnis weg es soll generell erlaubt sein“): jede Schulstufe darf
 *   mitmachen. Der Lehrer kann es im Profil für einen Schüler ausschalten (students.wettspiel = „nein“). Vorher galt
 *   „ab der 9. Schulstufe, jünger nur mit Erlaubnis“.
 */
import { db } from "./db";
import { BILDER, BILD_SCHLUESSEL, NAME_HINTEN, NAME_VORNE } from "./spielprofil-listen";
import type { Student } from "./repo";

export { BILDER, BILD_SCHLUESSEL, NAME_HINTEN, NAME_VORNE } from "./spielprofil-listen";

export type Wettspiel = "" | "ja" | "nein";
/** Darf ein Schüler mit dieser Einstellung mitspielen? Alle, außer der Lehrer hat es ausgeschaltet. */
export const darfMitspielen = (wettspiel: string | null | undefined) => wettspiel !== "nein";

export type Spielprofil = { studentId: number; name: string; bild: string; liga: boolean; duelle: boolean };

/**
 * So steht ein Schüler in Bestenliste, Liga und Duell: Vorname und erster Buchstabe des Nachnamens („Max Muster“ →
 * „Max M.“), bei nur einem Namen dieser.
 */
export function spielName(name: string | null | undefined): string {
  const teile = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!teile.length) return "Mitspieler";
  if (teile.length === 1) return teile[0];
  return `${teile[0]} ${teile[teile.length - 1].charAt(0).toUpperCase()}.`;
}

/** Der Spielname eines Schülers aus der Datenbank. */
export function spielNameVon(studentId: number): string {
  const z = db().prepare("SELECT name FROM students WHERE id = ?").get(studentId) as { name: string } | undefined;
  return spielName(z?.name);
}

type Zeile = { student_id: number; name: string; schueler: string | null; bild: string; liga: number; duelle: number };
const alsProfil = (z: Zeile): Spielprofil => ({ studentId: z.student_id, name: spielName(z.schueler), bild: z.bild, liga: !!z.liga, duelle: !!z.duelle });

export function wettspielEinstellung(studentId: number): Wettspiel {
  const z = db().prepare("SELECT wettspiel FROM students WHERE id = ?").get(studentId) as { wettspiel: string } | undefined;
  return z?.wettspiel === "ja" || z?.wettspiel === "nein" ? z.wettspiel : "";
}

export function setzeWettspiel(studentId: number, wert: Wettspiel) {
  db().prepare("UPDATE students SET wettspiel = ? WHERE id = ?").run(wert, studentId);
}

/** Darf der Schüler bei Liga und Duellen mitmachen? `grund` sagt es dem Schüler, wenn nicht. */
export function erlaubnis(student: Pick<Student, "id" | "grade">): { darf: boolean; grund: string } {
  const e = wettspielEinstellung(student.id);
  if (!darfMitspielen(e)) return { darf: false, grund: "Dein Lehrer hat Liga und Duelle für dich ausgeschaltet." };
  return { darf: true, grund: "" };
}

export function profilVon(studentId: number): Spielprofil | null {
  const z = db().prepare("SELECT sp.*, s.name AS schueler FROM spielprofile sp LEFT JOIN students s ON s.id = sp.student_id WHERE sp.student_id = ?").get(studentId) as Zeile | undefined;
  return z ? alsProfil(z) : null;
}

/** Profil nur, wenn der Schüler auch mitmachen darf (für Liga und Duelle). */
export function aktivesProfil(student: Pick<Student, "id" | "grade">): Spielprofil | null {
  return erlaubnis(student).darf ? profilVon(student.id) : null;
}

/** Der innere Schlüssel eines Profils (früher der gezeigte Spitzname). */
export const spitzname = (vorne: string, hinten: string) => `${vorne}${hinten}`;

/** Teilt einen gespeicherten Schlüssel wieder in seine zwei Teile. */
export function namensTeile(name: string): { vorne: string; hinten: string } | null {
  for (const v of NAME_VORNE) if (name.startsWith(v) && (NAME_HINTEN as readonly string[]).includes(name.slice(v.length))) return { vorne: v, hinten: name.slice(v.length) };
  return null;
}

/** Ein freier Vorschlag für den Anfang, damit niemand lange suchen muss. */
export function vorschlag(rng: () => number = Math.random): { vorne: string; hinten: string; bild: string } {
  const belegt = new Set((db().prepare("SELECT name FROM spielprofile").all() as { name: string }[]).map((z) => z.name));
  for (let i = 0; i < 200; i++) {
    const vorne = NAME_VORNE[Math.floor(rng() * NAME_VORNE.length)];
    const hinten = NAME_HINTEN[Math.floor(rng() * NAME_HINTEN.length)];
    if (!belegt.has(spitzname(vorne, hinten))) return { vorne, hinten, bild: BILD_SCHLUESSEL[Math.floor(rng() * BILD_SCHLUESSEL.length)] };
  }
  return { vorne: NAME_VORNE[0], hinten: NAME_HINTEN[0], bild: BILD_SCHLUESSEL[0] };
}

/** Was der Schüler einstellt. `vorne`/`hinten` (der innere Schlüssel) sind frei: ohne sie bleibt der alte oder es gibt einen freien. */
export type ProfilEingabe = { vorne?: string; hinten?: string; bild: string; liga: boolean; duelle: boolean };

/** Ein freier innerer Schlüssel für dieses Profil: der alte, die gewünschten Teile, wenn sie frei sind, sonst ein freier. */
function schluesselFuer(studentId: number, e: ProfilEingabe): string | null {
  const alt = db().prepare("SELECT name FROM spielprofile WHERE student_id = ?").get(studentId) as { name: string } | undefined;
  const frei = (n: string) => !db().prepare("SELECT 1 FROM spielprofile WHERE name = ? AND student_id != ?").get(n, studentId);
  if (e.vorne && e.hinten && (NAME_VORNE as readonly string[]).includes(e.vorne) && (NAME_HINTEN as readonly string[]).includes(e.hinten)) {
    const n = spitzname(e.vorne, e.hinten);
    if (frei(n)) return n;
  }
  if (alt) return alt.name;
  for (let i = 0; i < 20; i++) {
    const v = vorschlag();
    const n = spitzname(v.vorne, v.hinten);
    if (frei(n)) return n;
  }
  for (let i = 0; i < 1000; i++) {
    const n = `s${studentId}-${i}`;
    if (frei(n)) return n;
  }
  return null;
}

/** Speichert das Profil (Bild, Liga, Duelle). Gezeigt wird immer der echte Name (`spielName`). */
export function speichereProfil(student: Pick<Student, "id" | "grade">, e: ProfilEingabe): { ok: true; profil: Spielprofil } | { ok: false; fehler: string } {
  const darf = erlaubnis(student);
  if (!darf.darf) return { ok: false, fehler: darf.grund };
  if (!BILDER[e.bild]) return { ok: false, fehler: "Wähl ein Bild." };
  const name = schluesselFuer(student.id, e);
  if (!name) return { ok: false, fehler: "Das hat nicht geklappt. Versuch es noch einmal." };
  db()
    .prepare(
      `INSERT INTO spielprofile (student_id, name, bild, liga, duelle) VALUES (@id, @name, @bild, @liga, @duelle)
       ON CONFLICT(student_id) DO UPDATE SET name = @name, bild = @bild, liga = @liga, duelle = @duelle`,
    )
    .run({ id: student.id, name, bild: e.bild, liga: e.liga ? 1 : 0, duelle: e.duelle ? 1 : 0 });
  return { ok: true, profil: profilVon(student.id)! };
}

/**
 * Gibt einem Schüler, der mitspielen darf, aber noch kein Profil hat, eines (Liga und Duelle an, ein Tierbild). So steht
 * jeder mit seinem Namen in der Bestenliste; das Bild ändern kann er unter Spiele › Duelle.
 */
export function sorgeFuerProfil(student: Pick<Student, "id" | "grade">): Spielprofil | null {
  if (!erlaubnis(student).darf) return null;
  const da = profilVon(student.id);
  if (da) return da;
  for (let i = 0; i < 5; i++) {
    const v = vorschlag();
    const r = speichereProfil(student, { ...v, liga: true, duelle: true });
    if (r.ok) return r.profil;
  }
  return null;
}

/** Der Lehrer setzt das Spielprofil zurück (Bild und Schalter); Ligapunkte bleiben. */
export function loescheProfil(studentId: number) {
  db().prepare("DELETE FROM spielprofile WHERE student_id = ?").run(studentId);
}

/** Wie ein Spieler anderen Schülern erscheint: sein Name („Max M.“) und sein Tierbild (ohne Profil 🙂). */
export function anzeige(studentId: number): { name: string; bild: string } {
  const p = profilVon(studentId);
  return { name: spielNameVon(studentId), bild: p ? (BILDER[p.bild] ?? "🙂") : "🙂" };
}

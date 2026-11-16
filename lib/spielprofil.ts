/**
 * Spielprofil für Wochenliga und Duelle (niko 2026-11-11: „ein Ranking, damit die Schüler gegeneinander spielen“).
 *
 * - **Freiwillig**: ohne Profil spielt der Schüler wie bisher allein. Liga und Duelle lassen sich einzeln ausschalten.
 * - **Nie der echte Name**: der Spitzname besteht aus zwei Teilen aus festen Listen („Blitz“ + „fuchs“), das Bild ist ein
 *   Tier. So kann niemand etwas Gemeines eintippen, und Schule, Klasse oder Name stehen nirgends.
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

type Zeile = { student_id: number; name: string; bild: string; liga: number; duelle: number };
const alsProfil = (z: Zeile): Spielprofil => ({ studentId: z.student_id, name: z.name, bild: z.bild, liga: !!z.liga, duelle: !!z.duelle });

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
  const z = db().prepare("SELECT * FROM spielprofile WHERE student_id = ?").get(studentId) as Zeile | undefined;
  return z ? alsProfil(z) : null;
}

/** Profil nur, wenn der Schüler auch mitmachen darf (für Liga und Duelle). */
export function aktivesProfil(student: Pick<Student, "id" | "grade">): Spielprofil | null {
  return erlaubnis(student).darf ? profilVon(student.id) : null;
}

export const spitzname = (vorne: string, hinten: string) => `${vorne}${hinten}`;

/** Teilt einen gespeicherten Spitznamen wieder in seine zwei Teile (für das Formular). */
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

export type ProfilEingabe = { vorne: string; hinten: string; bild: string; liga: boolean; duelle: boolean };

/** Speichert das Profil. Nur Teile aus den Listen; ein Spitzname gehört nur einem Schüler. */
export function speichereProfil(student: Pick<Student, "id" | "grade">, e: ProfilEingabe): { ok: true; profil: Spielprofil } | { ok: false; fehler: string } {
  const darf = erlaubnis(student);
  if (!darf.darf) return { ok: false, fehler: darf.grund };
  if (!(NAME_VORNE as readonly string[]).includes(e.vorne) || !(NAME_HINTEN as readonly string[]).includes(e.hinten)) return { ok: false, fehler: "Wähl beide Teile aus der Liste." };
  if (!BILDER[e.bild]) return { ok: false, fehler: "Wähl ein Bild." };
  const name = spitzname(e.vorne, e.hinten);
  const anderer = db().prepare("SELECT student_id FROM spielprofile WHERE name = ? AND student_id != ?").get(name, student.id);
  if (anderer) return { ok: false, fehler: `„${name}“ hat schon jemand. Probier eine andere Kombination.` };
  db()
    .prepare(
      `INSERT INTO spielprofile (student_id, name, bild, liga, duelle) VALUES (@id, @name, @bild, @liga, @duelle)
       ON CONFLICT(student_id) DO UPDATE SET name = @name, bild = @bild, liga = @liga, duelle = @duelle`,
    )
    .run({ id: student.id, name, bild: e.bild, liga: e.liga ? 1 : 0, duelle: e.duelle ? 1 : 0 });
  return { ok: true, profil: profilVon(student.id)! };
}

/**
 * Gibt einem Schüler, der mitspielen darf, aber noch keinen Spitznamen hat, einen freien aus den Listen (Liga und
 * Duelle an, wie beim Anlegen in der App). So steht jeder in der Bestenliste; ändern kann er ihn unter Spiele › Duelle.
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

/** Der Lehrer setzt den Spitznamen zurück (z. B. wenn ein Kind ihn tauschen will); Ligapunkte bleiben. */
export function loescheProfil(studentId: number) {
  db().prepare("DELETE FROM spielprofile WHERE student_id = ?").run(studentId);
}

/** Wie ein Spieler anderen Schülern erscheint. Ohne Profil (z. B. im Live-Duell): nur „Mitspieler“. */
export function anzeige(studentId: number): { name: string; bild: string } {
  const p = profilVon(studentId);
  return p ? { name: p.name, bild: BILDER[p.bild] ?? "🙂" } : { name: "Mitspieler", bild: "🙂" };
}

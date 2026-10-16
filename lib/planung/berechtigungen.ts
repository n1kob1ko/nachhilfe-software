/**
 * Wer darf was in der Planung (Entscheidung D23):
 *
 * | Handlung                                   | Admin | Lehrer |
 * |--------------------------------------------|-------|--------|
 * | eigene Verfügbarkeit, Wochenziel, Räume    | ja    | ja     |
 * | Verfügbarkeit eines anderen Lehrers        | ja    | **nein** |
 * | Planung der eigenen Schüler (`teacher_id`) | ja    | ja     |
 * | Planung fremder Schüler                    | ja    | **nein** |
 * | Räume anlegen/ändern/deaktivieren          | ja    | **nein** (nur sehen) |
 * | Wochenplan: generieren, Plätze setzen, veröffentlichen | ja | **nein** |
 * | veröffentlichte Woche sehen                | jede  | nur die **eigene** |
 *
 * Die Prüfungen stehen hier als reine Funktionen, damit Seiten und Server Actions dieselbe
 * Entscheidung treffen und Tests sie ohne Next.js aufrufen können. `is_admin` kommt aus der
 * Datenbank (`lib/auth.ts`), nie aus dem Formular.
 */
import { getStudent } from "../repo";

/** Der angemeldete Lehrer, so wie ihn `requireTeacher()` liefert. */
export type Akteur = { id: number; is_admin: number };

export function istAdmin(akteur: Akteur): boolean {
  return Number(akteur.is_admin) === 1;
}

/** Eigene Verfügbarkeit/Wochenziel/Raumwünsche; der Admin darf alle. */
export function darfLehrerPlanungBearbeiten(akteur: Akteur, teacherId: number): boolean {
  return istAdmin(akteur) || akteur.id === teacherId;
}

/** Planung eines Schülers: der Admin und der Lehrer des Schülers (`students.teacher_id`). */
export function darfSchuelerPlanungBearbeiten(akteur: Akteur, studentId: number): boolean {
  if (istAdmin(akteur)) return true;
  const student = getStudent(studentId);
  return !!student && student.teacher_id === akteur.id;
}

/** Räume sind Einrichtung der Verwaltung: nur der Admin ändert sie. */
export function darfRaeumeVerwalten(akteur: Akteur): boolean {
  return istAdmin(akteur);
}

/** Sehen darf sie jeder angemeldete Lehrer — er braucht sie für seine Raumwünsche. */
export function darfRaeumeSehen(_akteur: Akteur): boolean {
  return true;
}

/**
 * Den Wochenplan **ändern** (D23): generieren, neu generieren, Plätze setzen/verschieben/sperren,
 * veröffentlichen, Entwurf verwerfen, Regeln schreiben. Das darf ausschließlich die Verwaltung;
 * ein Lehrer liest nur seine eigene veröffentlichte Woche.
 */
export function darfWochenplanBearbeiten(akteur: Akteur): boolean {
  return istAdmin(akteur);
}

/**
 * Eine **Woche sehen**: die Verwaltung jede, ein Lehrer nur die eigene. `weekLehrerId` ist der
 * Lehrer, dessen Woche betrachtet wird (`?lehrer=`), nicht der, der gerade schaut.
 */
export function darfWocheSehen(akteur: Akteur, weekLehrerId: number): boolean {
  return istAdmin(akteur) || akteur.id === weekLehrerId;
}

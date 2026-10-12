/**
 * Die Schreibwege der Planung — **die** Stelle, an der Rechte und Eingaben geprüft werden.
 *
 * Die Server Actions in `app/planung-actions.ts` sind nur Hüllen: sie holen den angemeldeten Lehrer
 * (`requireTeacher()`), rufen eine dieser Funktionen und leiten mit dem Ergebnis zurück. Dadurch ist
 * die Rechteprüfung (D23) an einem Ort und ohne Next.js testbar — die Tests rufen genau diese
 * Funktionen auf, keine Nachbildung.
 *
 * Jede Funktion prüft in dieser Reihenfolge: Berechtigung → Existenz → zod-Schema → schreiben.
 */
import { darfLehrerPlanungBearbeiten, darfRaeumeVerwalten, darfSchuelerPlanungBearbeiten, darfWochenplanBearbeiten, type Akteur } from "./berechtigungen";
import * as repo from "./repo";
import { schreibeRegeln } from "./regeln";
import { fehlerText, idListeSchema, raumSchema, schuelerPlanungSchema, wochenzielSchema } from "./schema";
import { offeneFuerWoche } from "./uebersicht";
import { istDatum } from "./zeit";
import { parseVerfuegbarkeitStreng } from "./verfuegbarkeit";

export type Ergebnis = { ok: true; hinweis?: string } | { ok: false; fehler: string };

const KEINE_BERECHTIGUNG = "Dafür fehlt die Berechtigung.";

const DAUER_FEHLER = "Die geplante Dauer muss zwischen 1 und 300 Minuten liegen.";
const EINHEITEN_FEHLER = "Einheiten pro Woche: bitte eine ganze Zahl zwischen 0 und 40 angeben.";

function zahl(wert: unknown): number {
  return typeof wert === "number" ? wert : Number(wert);
}

function istGanzeZahl(wert: unknown): boolean {
  const n = zahl(wert);
  return Number.isInteger(n);
}

// ---------- Lehrer: Verfügbarkeit, Wochenziel, Raumwünsche ----------

export function speichereLehrerVerfuegbarkeit(akteur: Akteur, teacherId: number, availability: unknown): Ergebnis {
  if (!darfLehrerPlanungBearbeiten(akteur, teacherId)) return { ok: false, fehler: KEINE_BERECHTIGUNG };
  if (!repo.getLehrerPlanung(teacherId)) return { ok: false, fehler: "Lehrer nicht gefunden." };
  const geprüft = parseVerfuegbarkeitStreng(availability);
  if (!geprüft.ok) return { ok: false, fehler: geprüft.fehler };
  repo.setLehrerVerfuegbarkeit(teacherId, geprüft.wert);
  return { ok: true, hinweis: "Verfügbarkeit gespeichert." };
}

/** `minuten` null oder 0 = kein Wochenziel. */
export function speichereLehrerWochenziel(akteur: Akteur, teacherId: number, minuten: number | null): Ergebnis {
  if (!darfLehrerPlanungBearbeiten(akteur, teacherId)) return { ok: false, fehler: KEINE_BERECHTIGUNG };
  if (!repo.getLehrerPlanung(teacherId)) return { ok: false, fehler: "Lehrer nicht gefunden." };
  const wert = minuten === null || minuten === undefined || (typeof minuten === "number" && Number.isNaN(minuten)) ? null : zahl(minuten);
  const geprüft = wochenzielSchema.safeParse(wert === null ? 0 : wert);
  if (!geprüft.success) return { ok: false, fehler: "Das Wochenziel muss zwischen 0 und 1440 Minuten liegen." };
  repo.setLehrerWochenziel(teacherId, geprüft.data === 0 ? null : geprüft.data);
  return { ok: true, hinweis: "Wochenziel gespeichert." };
}

export function speichereLehrerRaumPraeferenzen(akteur: Akteur, teacherId: number, raumIds: unknown): Ergebnis {
  if (!darfLehrerPlanungBearbeiten(akteur, teacherId)) return { ok: false, fehler: KEINE_BERECHTIGUNG };
  if (!repo.getLehrerPlanung(teacherId)) return { ok: false, fehler: "Lehrer nicht gefunden." };
  const geprüft = idListeSchema.safeParse(Array.isArray(raumIds) ? raumIds.map(zahl) : []);
  if (!geprüft.success) return { ok: false, fehler: "Die Raumwünsche konnten nicht gelesen werden." };
  // nur Räume, die es wirklich gibt, und keine doppelten
  const vorhanden = new Set(repo.listRaeume({ mitInaktiven: true }).map((r) => r.id));
  const liste: number[] = [];
  for (const id of geprüft.data) if (vorhanden.has(id) && !liste.includes(id)) liste.push(id);
  repo.setLehrerRaumPraeferenzen(teacherId, liste);
  return { ok: true, hinweis: "Raumwünsche gespeichert." };
}

// ---------- Schüler: Planung ----------

export type SchuelerPlanungEingabe = {
  einheiten_pro_woche: unknown;
  geplante_dauer: unknown;
  modus_wunsch: unknown;
  erlaubte_lehrer: unknown;
  availability: unknown;
};

export function speichereSchuelerPlanung(akteur: Akteur, studentId: number, eingabe: SchuelerPlanungEingabe): Ergebnis {
  if (!darfSchuelerPlanungBearbeiten(akteur, studentId)) return { ok: false, fehler: KEINE_BERECHTIGUNG };
  if (!repo.getSchuelerPlanung(studentId)) return { ok: false, fehler: "Schüler nicht gefunden." };
  if (!istGanzeZahl(eingabe.einheiten_pro_woche)) return { ok: false, fehler: EINHEITEN_FEHLER };
  if (!istGanzeZahl(eingabe.geplante_dauer)) return { ok: false, fehler: DAUER_FEHLER };
  const availability = parseVerfuegbarkeitStreng(eingabe.availability);
  if (!availability.ok) return { ok: false, fehler: availability.fehler };
  const geprüft = schuelerPlanungSchema.safeParse({
    einheiten_pro_woche: zahl(eingabe.einheiten_pro_woche),
    geplante_dauer: zahl(eingabe.geplante_dauer),
    modus_wunsch: eingabe.modus_wunsch,
    erlaubte_lehrer: Array.isArray(eingabe.erlaubte_lehrer) ? eingabe.erlaubte_lehrer.map(zahl) : [],
    availability: availability.wert,
  });
  if (!geprüft.success) return { ok: false, fehler: fehlerText(geprüft.error, { einheiten_pro_woche: "Einheiten pro Woche", geplante_dauer: "Geplante Dauer", modus_wunsch: "Modus", erlaubte_lehrer: "Erlaubte Lehrer" }) };
  const vorhanden = new Set(repo.listLehrerIds());
  const erlaubte = geprüft.data.erlaubte_lehrer.filter((id) => vorhanden.has(id));
  repo.setSchuelerPlanung(studentId, { ...geprüft.data, erlaubte_lehrer: erlaubte });
  return { ok: true, hinweis: "Planung gespeichert." };
}

// ---------- Wochenabweichung ----------

function darfAbweichung(akteur: Akteur, ownerType: repo.OwnerTyp, ownerId: number): boolean {
  return ownerType === "teacher" ? darfLehrerPlanungBearbeiten(akteur, ownerId) : darfSchuelerPlanungBearbeiten(akteur, ownerId);
}

function ownerExistiert(ownerType: repo.OwnerTyp, ownerId: number): boolean {
  return ownerType === "teacher" ? !!repo.getLehrerPlanung(ownerId) : !!repo.getSchuelerPlanung(ownerId);
}

export function speichereAbweichung(akteur: Akteur, ownerType: repo.OwnerTyp, ownerId: number, weekStart: string, availability: unknown): Ergebnis {
  if (!darfAbweichung(akteur, ownerType, ownerId)) return { ok: false, fehler: KEINE_BERECHTIGUNG };
  if (!ownerExistiert(ownerType, ownerId)) return { ok: false, fehler: "Nicht gefunden." };
  if (!istDatum(weekStart)) return { ok: false, fehler: "Bitte eine Woche wählen." };
  const geprüft = parseVerfuegbarkeitStreng(availability);
  if (!geprüft.ok) return { ok: false, fehler: geprüft.fehler };
  repo.setAbweichung(ownerType, ownerId, weekStart, geprüft.wert);
  return { ok: true, hinweis: "Abweichung für diese Woche gespeichert." };
}

export function entferneAbweichung(akteur: Akteur, ownerType: repo.OwnerTyp, ownerId: number, weekStart: string): Ergebnis {
  if (!darfAbweichung(akteur, ownerType, ownerId)) return { ok: false, fehler: KEINE_BERECHTIGUNG };
  if (!ownerExistiert(ownerType, ownerId)) return { ok: false, fehler: "Nicht gefunden." };
  if (!istDatum(weekStart)) return { ok: false, fehler: "Bitte eine Woche wählen." };
  repo.loescheAbweichung(ownerType, ownerId, weekStart);
  return { ok: true, hinweis: "Abweichung entfernt, es gilt wieder die Regelverfügbarkeit." };
}

// ---------- Räume (nur Verwaltung, D23) ----------

export type RaumEingabe = { id?: unknown; building: unknown; name: unknown; mode: unknown };

export function speichereRaum(akteur: Akteur, eingabe: RaumEingabe): Ergebnis {
  if (!darfRaeumeVerwalten(akteur)) return { ok: false, fehler: KEINE_BERECHTIGUNG };
  const geprüft = raumSchema.safeParse({ building: eingabe.building, name: eingabe.name, mode: eingabe.mode });
  if (!geprüft.success) return { ok: false, fehler: fehlerText(geprüft.error, { building: "Gebäude", name: "Name", mode: "Art" }) };
  const id = Number(eingabe.id) || 0;
  const doppelt = repo
    .listRaeume({ mitInaktiven: true })
    .find((r) => r.id !== id && r.building.toLowerCase() === geprüft.data.building.toLowerCase() && r.name.toLowerCase() === geprüft.data.name.toLowerCase());
  if (doppelt) return { ok: false, fehler: "Diesen Raum gibt es in diesem Gebäude schon." };
  if (id) {
    if (!repo.getRaum(id)) return { ok: false, fehler: "Raum nicht gefunden." };
    repo.updateRaum(id, geprüft.data);
    return { ok: true, hinweis: "Raum gespeichert." };
  }
  repo.createRaum(geprüft.data);
  return { ok: true, hinweis: "Raum angelegt." };
}

export function setzeRaumAktiv(akteur: Akteur, roomId: number, aktiv: boolean): Ergebnis {
  if (!darfRaeumeVerwalten(akteur)) return { ok: false, fehler: KEINE_BERECHTIGUNG };
  if (!repo.getRaum(roomId)) return { ok: false, fehler: "Raum nicht gefunden." };
  repo.setRaumAktiv(roomId, aktiv);
  return { ok: true, hinweis: aktiv ? "Raum ist wieder aktiv." : "Raum ist deaktiviert; er bleibt in der Dokumentation erhalten." };
}

/**
 * Löschen nur, solange kein Platz auf den Raum zeigt — sonst wird deaktiviert (Glossar: **Raum**).
 * Der Aufrufer bekommt den Hinweis, statt dass ein Platz ins Leere zeigt.
 */
export function loescheRaum(akteur: Akteur, roomId: number): Ergebnis {
  if (!darfRaeumeVerwalten(akteur)) return { ok: false, fehler: KEINE_BERECHTIGUNG };
  const raum = repo.getRaum(roomId);
  if (!raum) return { ok: false, fehler: "Raum nicht gefunden." };
  const { geloescht, verweise } = repo.loescheRaum(roomId);
  if (!geloescht)
    return {
      ok: false,
      fehler: `${raum.name} wird von ${verweise} ${verweise === 1 ? "geplanter Einheit" : "geplanten Einheiten"} verwendet und kann deshalb nicht gelöscht werden. Bitte stattdessen deaktivieren.`,
    };
  return { ok: true, hinweis: "Raum gelöscht." };
}

// ---------- Wochenplan (Phase 4, D23: nur die Verwaltung) ----------

const NUR_VERWALTUNG = "Den Wochenplan darf nur die Verwaltung ändern.";

/** Was ein Generierlauf von außen mitbekommt: `seed` für ein wiederholbares Ergebnis, `zeitbudgetMs` gegen lange Rechenzeit (§6). */
export type GenerierOptionen = { seed?: number; zeitbudgetMs?: number };

/** Kurze Rückmeldung nach einem Generierlauf: wie viele Plätze entstanden sind und wer noch offen ist. */
function generierHinweis(anzahl: number, offen: number, zeitbudgetErreicht: boolean): string {
  const plaetze = `${anzahl} ${anzahl === 1 ? "Platz" : "Plätze"} geplant.`;
  const rest = offen === 0 ? " Alle Schüler sind eingeplant." : ` ${offen} ${offen === 1 ? "Schüler ist" : "Schüler sind"} noch offen.`;
  return zeitbudgetErreicht ? `${plaetze}${rest} Das Zeitbudget war aufgebraucht, der bis dahin beste Stand steht.` : `${plaetze}${rest}`;
}

function generiere(akteur: Akteur, weekStart: string, opts: GenerierOptionen, nurLeer: boolean): Ergebnis {
  if (!darfWochenplanBearbeiten(akteur)) return { ok: false, fehler: NUR_VERWALTUNG };
  if (!istDatum(weekStart)) return { ok: false, fehler: "Bitte eine Woche wählen." };
  const status = repo.wochenStatus(weekStart);
  if (status === "veroeffentlicht")
    return { ok: false, fehler: "Für diese Woche ist der Plan schon veröffentlicht. Dort lassen sich nur einzelne Plätze ändern." };
  if (nurLeer && status !== "leer")
    return { ok: false, fehler: "In dieser Woche gibt es schon einen Entwurf. Bitte „Neu generieren“ verwenden." };
  const ergebnis = repo.neuGenerieren(weekStart, opts);
  if (!ergebnis.ok) return { ok: false, fehler: ergebnis.fehler };
  return { ok: true, hinweis: generierHinweis(ergebnis.anzahl, offeneFuerWoche(weekStart).length, ergebnis.zeitbudgetErreicht) };
}

/** „Generieren“: nur in einer leeren Woche. Die Plätze entstehen als Entwurf (D24). */
export function erstelleWochenplan(akteur: Akteur, weekStart: string, opts: GenerierOptionen = {}): Ergebnis {
  return generiere(akteur, weekStart, opts, true);
}

/**
 * „Neu generieren“ (D24): arbeitet auf dem Entwurf — gesperrte Plätze bleiben stehen, alle anderen
 * Entwürfe werden ersetzt. In einer veröffentlichten Woche geht das nicht.
 */
export function generiereWocheNeu(akteur: Akteur, weekStart: string, opts: GenerierOptionen = {}): Ergebnis {
  return generiere(akteur, weekStart, opts, false);
}

/** „Vorwoche übernehmen“ (D24): die Plätze der Vorwoche als Entwurf, ohne Sperre und ohne Einheit. */
export function kopiereVorwoche(akteur: Akteur, weekStart: string): Ergebnis {
  if (!darfWochenplanBearbeiten(akteur)) return { ok: false, fehler: NUR_VERWALTUNG };
  if (!istDatum(weekStart)) return { ok: false, fehler: "Bitte eine Woche wählen." };
  const ergebnis = repo.uebernimmVorwoche(weekStart);
  if (!ergebnis.ok) return { ok: false, fehler: ergebnis.fehler };
  return { ok: true, hinweis: `${ergebnis.anzahl} ${ergebnis.anzahl === 1 ? "Platz" : "Plätze"} aus der Vorwoche als Entwurf übernommen.` };
}

/** Veröffentlichen (D25: ohne Benachrichtigung) — danach sind nur noch einzelne Plätze änderbar. */
export function veroeffentlicheWoche(akteur: Akteur, weekStart: string): Ergebnis {
  if (!darfWochenplanBearbeiten(akteur)) return { ok: false, fehler: NUR_VERWALTUNG };
  if (!istDatum(weekStart)) return { ok: false, fehler: "Bitte eine Woche wählen." };
  const ergebnis = repo.veroeffentlicheWoche(weekStart);
  if (!ergebnis.ok) return { ok: false, fehler: ergebnis.fehler };
  return { ok: true, hinweis: `Woche veröffentlicht: ${ergebnis.anzahl} ${ergebnis.anzahl === 1 ? "Platz" : "Plätze"}.` };
}

/** Nur den Entwurf wegwerfen; veröffentlichte Plätze bleiben, wo sie sind. */
export function verwerfeEntwurf(akteur: Akteur, weekStart: string): Ergebnis {
  if (!darfWochenplanBearbeiten(akteur)) return { ok: false, fehler: NUR_VERWALTUNG };
  if (!istDatum(weekStart)) return { ok: false, fehler: "Bitte eine Woche wählen." };
  const { anzahl } = repo.verwerfeEntwurf(weekStart);
  if (anzahl === 0) return { ok: false, fehler: "In dieser Woche gibt es keinen Entwurf." };
  return { ok: true, hinweis: `Entwurf verworfen (${anzahl} ${anzahl === 1 ? "Platz" : "Plätze"}).` };
}

export type PlatzEingabe = Parameters<typeof repo.legePlatzAn>[0];

/**
 * Einen Platz von Hand setzen. Prüfen (Raster, Überlappung von Lehrer, Schüler und Raum) tut
 * `repo.legePlatzAn` — hier steht nur die Berechtigung (D23) davor. In einer veröffentlichten
 * Woche wird der neue Platz sofort mitveröffentlicht, damit er sichtbar ist.
 */
export function setzePlatz(akteur: Akteur, eingabe: PlatzEingabe): Ergebnis {
  if (!darfWochenplanBearbeiten(akteur)) return { ok: false, fehler: NUR_VERWALTUNG };
  const ergebnis = repo.legePlatzAn(eingabe);
  if (!ergebnis.ok) return { ok: false, fehler: ergebnis.fehler };
  return { ok: true, hinweis: "Platz angelegt." };
}

/** Einen Platz verschieben oder umbesetzen; dieselbe Überlappungsprüfung, nur ohne sich selbst. */
export function aenderePlatz(akteur: Akteur, id: number, aenderung: Partial<PlatzEingabe>): Ergebnis {
  if (!darfWochenplanBearbeiten(akteur)) return { ok: false, fehler: NUR_VERWALTUNG };
  const ergebnis = repo.aenderePlatz(id, aenderung);
  if (!ergebnis.ok) return { ok: false, fehler: ergebnis.fehler };
  return { ok: true, hinweis: ergebnis.hinweis ?? "Platz gespeichert." };
}

/** Sperren oder entsperren: ein gesperrter Platz bleibt beim „Neu generieren“ stehen (Glossar: **gesperrt**). */
export function setzeGesperrt(akteur: Akteur, id: number, gesperrt: boolean): Ergebnis {
  if (!darfWochenplanBearbeiten(akteur)) return { ok: false, fehler: NUR_VERWALTUNG };
  const ergebnis = repo.setzeGesperrt(id, gesperrt);
  if (!ergebnis.ok) return { ok: false, fehler: ergebnis.fehler };
  return { ok: true, hinweis: ergebnis.hinweis ?? "Platz geändert." };
}

export function loeschePlatz(akteur: Akteur, id: number): Ergebnis {
  if (!darfWochenplanBearbeiten(akteur)) return { ok: false, fehler: NUR_VERWALTUNG };
  const ergebnis = repo.loeschePlatz(id);
  if (!ergebnis.ok) return { ok: false, fehler: ergebnis.fehler };
  return { ok: true, hinweis: "Platz gelöscht." };
}

/**
 * Das Ziel eines Ziehvorgangs prüfen, bevor etwas geschrieben wird: dieselbe Überlappungsprüfung wie
 * beim Speichern (`repo.pruefeUeberlappung`, dem **einzigen** Ort dafür), nur als Frage. Die
 * Wochenansicht färbt damit unzulässige Ziele aus, statt die Prüfung nachzubauen.
 */
export function pruefeZiel(akteur: Akteur, id: number, ziel: { teacherId?: number; studentId?: number; roomId?: number | null; weekday?: number; startMin?: number }): Ergebnis {
  if (!darfWochenplanBearbeiten(akteur)) return { ok: false, fehler: NUR_VERWALTUNG };
  const platz = repo.getGeplanteEinheit(id);
  if (!platz) return { ok: false, fehler: "Geplante Einheit nicht gefunden." };
  const ergebnis = repo.pruefeUeberlappung({
    week_start: platz.week_start,
    weekday: ziel.weekday ?? platz.weekday,
    start_min: ziel.startMin ?? platz.start_min,
    geplante_dauer: platz.geplante_dauer,
    teacher_id: ziel.teacherId ?? platz.teacher_id,
    student_id: ziel.studentId ?? platz.student_id,
    room_id: ziel.roomId === undefined ? platz.room_id : ziel.roomId,
    ausserId: id,
  });
  return ergebnis.ok ? { ok: true } : { ok: false, fehler: ergebnis.fehler };
}

/**
 * Die Regeln des Wochenplans schreiben. Geprüft wird von `schreibeRegeln` (zod); ungültige Werte
 * werden abgelehnt und **nicht** geglättet. Nur die Verwaltung (D23) — die Regeln gelten für alle.
 */
export function speichereRegeln(akteur: Akteur, roh: unknown): Ergebnis {
  if (!darfWochenplanBearbeiten(akteur)) return { ok: false, fehler: NUR_VERWALTUNG };
  const geprüft = schreibeRegeln(roh);
  if (!geprüft.ok) return { ok: false, fehler: geprüft.fehler };
  return { ok: true, hinweis: "Regeln gespeichert." };
}

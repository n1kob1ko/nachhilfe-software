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
import { darfLehrerPlanungBearbeiten, darfRaeumeVerwalten, darfSchuelerPlanungBearbeiten, type Akteur } from "./berechtigungen";
import * as repo from "./repo";
import { fehlerText, idListeSchema, raumSchema, schuelerPlanungSchema, wochenzielSchema } from "./schema";
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

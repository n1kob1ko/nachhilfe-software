/**
 * CSV-Import von **Schülern** und **Lehrern** (Phase 7 des Merges, Entscheidung D14) und der
 * **Dokumentation aus einem Formular** (D27, `lib/doku-import.ts`).
 *
 * Gelesen wird das Format, das `lib/exports.ts` schreibt (Semikolon, UTF-8 mit oder ohne BOM,
 * `parseCsv` in `lib/csv.ts`), und auch eine Datei mit Komma aus Google Tabellen. Zwei Schritte,
 * und nur der zweite schreibt:
 *
 * 1. `vorschauImport()` liest die Datei, prüft **jede Zeile mit zod** und meldet Fehler je Zeile
 *    sowie Dubletten (Schüler: gleicher Name **und** gleiche Klasse, fehlt auf einer Seite die
 *    Klasse, reicht der Name; Lehrer: Name oder Benutzername gibt es schon). Es wird nichts
 *    geschrieben — die Funktion liest nur.
 * 2. `importiere()` prüft dieselbe Datei noch einmal und schreibt sie. Hat auch nur eine Zeile
 *    einen Fehler, wird **nichts** geschrieben (alles oder nichts); Dubletten werden übersprungen.
 *
 * Zwei Regeln gelten überall:
 *
 * - **Nur die Verwaltung** (D23). Die Prüfung steht hier, damit sie ohne Next.js testbar ist;
 *   die Server Action in `app/import-actions.ts` prüft sie über `requireAdmin()` ein zweites Mal.
 * - **Formel-Einschleusung:** eine Zelle, die mit `=`, `+`, `-` oder `@` beginnt, bleibt **Text**.
 *   Sie wird nie in eine Zahl umgewandelt (`unprotectCell` entfernt nur die Textmarke `'`, die der
 *   Export gesetzt hat), und der nächste Export setzt sie wieder als Text (`lib/csv.ts`).
 */
import { z } from "zod";
import { parseCsv, unprotectCell } from "./csv";
import { db } from "./db";
import { INITIAL_PASSWORD, hashPassword } from "./password";
import { istAdmin, type Akteur } from "./planung/berechtigungen";
import { setSchuelerPlanung, type ModusWunsch } from "./planung/repo";
import { pruefeDokumentation, schreibeDokumentation, type DokuGeprueft } from "./doku-import";
import { createStudent, type StudentInput } from "./repo";
import { SCHOOL_TYPES, checkLevel, klassenLabel, schoolType, schulstufe } from "./school";

export type ImportArt = "schueler" | "lehrer" | "dokumentation";

export const IMPORT_ARTEN: { art: ImportArt; label: string; hinweis: string }[] = [
  { art: "dokumentation", label: "Dokumentation", hinweis: "Tabelle des Formulars, eine Zeile je Einheit" },
  { art: "schueler", label: "Schüler", hinweis: "Spalten des Exports „Schüler und Schülerprofile“" },
  { art: "lehrer", label: "Lehrer", hinweis: "Name, Benutzername und ob Verwaltung" },
];

export const artAus = (wert: unknown): ImportArt => (wert === "lehrer" || wert === "dokumentation" ? wert : "schueler");

export type ImportZeile = {
  /** Zeilennummer in der Datei; die Kopfzeile ist Zeile 1. */
  zeile: number;
  beschriftung: string;
  fehler: string[];
  /** "" = neu, "datei" = in der Datei doppelt, "datenbank" = gibt es schon. */
  dublette: "" | "datei" | "datenbank";
  /** Kein Fehler, nur ein Hinweis zur Zeile, z. B. „Klasse fehlt“ (Schulstufe bleibt unklar). */
  hinweis?: string;
};

export type ImportVorschau = {
  art: ImportArt;
  /** Erkannte Spalten, in der Reihenfolge der erwarteten Spalten. */
  spalten: string[];
  zeilen: ImportZeile[];
  gesamt: number;
  /** Zeilen, die angelegt würden (ohne Fehler und ohne Dublette). */
  gueltig: number;
  /** Schüler ohne eindeutige Schulstufe (Schulart oder Klasse fehlt): später im Profil nachtragen */
  stufeOffen: number;
  /** Nur Dokumentation: Schüler, die der Import neu anlegt, mit gleichen Vornamen in der App. */
  neueSchueler?: { name: string; einheiten: number; aehnlich: string[] }[];
  fehlerhaft: number;
  dubletten: number;
  /** Fehler der ganzen Datei (leer, Pflichtspalte fehlt): dann gibt es keine Zeilen. */
  fehler?: string;
};

export type ImportErgebnis = { ok: true; angelegt: number; uebersprungen: number; hinweis: string } | { ok: false; fehler: string; vorschau?: ImportVorschau };

const NICHT_ADMIN = "Nur die Verwaltung darf importieren.";

// ---------- Spalten ----------

type Spalte = { feld: string; label: string; titel: string[]; pflicht?: boolean };

/** Die Spalten des Exports „Schüler und Schülerprofile“ (`lib/exports.ts`), nach Namen gelesen. */
const SCHUELER_SPALTEN: Spalte[] = [
  { feld: "name", label: "Name", titel: ["name"], pflicht: true },
  // Schultyp und Klasse dürfen fehlen oder leer sein: der Schüler wird angelegt, seine Schulstufe
  // bleibt „unklar“, und das Profil bittet darum, sie nachzutragen (lib/school.ts `checkLevel`)
  { feld: "school_type", label: "Schultyp", titel: ["schultyp", "schulart", "schule typ"] },
  { feld: "klasse", label: "Klasse", titel: ["klasse"] },
  { feld: "school", label: "Schule", titel: ["schule"] },
  { feld: "subjects", label: "Fächer", titel: ["fächer", "faecher"] },
  { feld: "current_topics", label: "Aktuelle Themen", titel: ["aktuelle themen", "themen"] },
  { feld: "strengths_note", label: "Stärken", titel: ["stärken", "staerken"] },
  { feld: "weaknesses_note", label: "Schwächen", titel: ["schwächen", "schwaechen"] },
  { feld: "goals", label: "Ziele", titel: ["ziele"] },
  { feld: "notes", label: "Notizen", titel: ["notizen"] },
  // „KI-Hinweise“ kam mit Phase 6 dazu; steht sie nicht in der Datei, bleibt das Feld leer
  { feld: "ki_hinweise", label: "KI-Hinweise", titel: ["ki-hinweise", "ki hinweise"] },
  { feld: "lehrer", label: "Lehrer", titel: ["lehrer"] },
  { feld: "einheiten_pro_woche", label: "Einheiten pro Woche", titel: ["einheiten pro woche", "einheiten/woche"] },
  { feld: "geplante_dauer", label: "Geplante Dauer", titel: ["geplante dauer"] },
  { feld: "modus", label: "Modus", titel: ["modus"] },
];

/** Die Spalten des Exports „Lehrer“; „Aktiv“ und „Passwort noch zu ändern“ sind freiwillig. */
const LEHRER_SPALTEN: Spalte[] = [
  { feld: "name", label: "Name", titel: ["name"], pflicht: true },
  { feld: "username", label: "Benutzername", titel: ["benutzername", "benutzer", "username"], pflicht: true },
  { feld: "is_admin", label: "Verwaltung", titel: ["verwaltung", "admin", "ist admin"] },
  { feld: "active", label: "Aktiv", titel: ["aktiv", "active"] },
];

const normKopf = (s: string) => s.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");

// ---------- Werte ----------

/** Leer heißt „nicht angegeben“ und bekommt die Vorgabe der Datenbank. */
const zahlOderLeer = (label: string, min: number, max: number, standard: number) =>
  z
    .string()
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= min && Number(v) <= max), `${label}: bitte eine ganze Zahl zwischen ${min} und ${max} angeben.`)
    .transform((v) => (v === "" ? standard : Number(v)));

const jaNein = (label: string, standard: "ja" | "nein") =>
  z.enum(["ja", "nein"], `${label}: bitte „ja“ oder „nein“ angeben.`).transform((v) => v === "ja");

const jaNeinAus = (roh: string, standard: "ja" | "nein"): string => {
  const v = roh.trim().toLowerCase();
  if (v === "") return standard;
  if (["ja", "j", "1", "true", "wahr", "x"].includes(v)) return "ja";
  if (["nein", "n", "0", "false", "falsch"].includes(v)) return "nein";
  return roh;
};

const MODUS_FEHLER = "Modus: erlaubt sind „vor Ort“, „online“ oder „egal“.";

const modusAus = (roh: string): string => {
  const v = normKopf(roh);
  if (v === "" || v === "egal") return "egal";
  if (v === "online") return "online";
  if (["vor_ort", "vor ort", "vor-ort", "vorort", "präsenz", "praesenz"].includes(v)) return "vor_ort";
  return roh;
};

const teile = (roh: string) => [...new Set(roh.split(",").map((t) => t.trim()).filter(Boolean))];

// ---------- Zeilenschemata ----------

const schuelerZeileSchema = z
  .object({
    name: z.string().min(1, "Name fehlt."),
    // leer = noch nicht bekannt; ein Wert muss aber ein bekannter Schultyp sein
    school_type: z.string().refine((v) => v === "" || Boolean(schoolType(v)), `Schultyp unbekannt (${SCHOOL_TYPES.map((t) => t.name).join(", ")}).`),
    klasse: z
      .string()
      .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 13), "Klasse: bitte eine ganze Zahl zwischen 1 und 13 angeben oder leer lassen.")
      .transform((v) => (v === "" ? null : Number(v))),
    school: z.string(),
    subjects: z.string().transform(teile),
    current_topics: z.string(),
    strengths_note: z.string(),
    weaknesses_note: z.string(),
    goals: z.string(),
    notes: z.string(),
    ki_hinweise: z.string(),
    /** Benutzername des zuständigen Lehrers; leer heißt „noch keiner“. */
    lehrer: z.string(),
    einheiten_pro_woche: zahlOderLeer("Einheiten pro Woche", 0, 40, 0),
    geplante_dauer: zahlOderLeer("Geplante Dauer", 1, 300, 100),
    modus: z.enum(["vor_ort", "online", "egal"], MODUS_FEHLER),
  })
  // Klasse und Schultyp nach **derselben** Regel wie das Formular (lib/school.ts) — sobald beide da sind
  .superRefine((r, ctx) => {
    if (!r.school_type || r.klasse === null) return;
    const level = checkLevel(r.school_type, r.klasse);
    if (level.status !== "eindeutig") ctx.addIssue({ code: "custom", message: level.reason ?? "Klasse und Schultyp passen nicht zusammen." });
  });

const lehrerZeileSchema = z.object({
  name: z.string().min(1, "Name fehlt."),
  username: z
    .string()
    .min(1, "Benutzername fehlt.")
    .regex(/^[a-zA-Z0-9._-]+$/, "Benutzername: nur Buchstaben, Ziffern, Punkt, Strich und Unterstrich."),
  is_admin: jaNein("Verwaltung", "nein"),
  active: jaNein("Aktiv", "ja"),
});

type SchuelerGeprueft = z.infer<typeof schuelerZeileSchema>;

type SchuelerSatz = {
  input: StudentInput;
  einheiten_pro_woche: number;
  geplante_dauer: number;
  modus_wunsch: ModusWunsch;
};
type LehrerSatz = { name: string; username: string; is_admin: boolean; active: boolean };

type ZeileIntern = { anzeige: ImportZeile; schueler?: SchuelerSatz; lehrer?: LehrerSatz };
type Geprueft = { vorschau: ImportVorschau; intern: ZeileIntern[]; doku?: DokuGeprueft };

// ---------- Prüfen ----------

/**
 * Schüler, die es schon gibt (in der Datenbank oder weiter oben in der Datei): gleicher Name und
 * gleiche Klasse. Fehlt die Klasse auf einer der beiden Seiten, reicht der gleiche Name — sonst
 * entstünde jemand doppelt, der zuerst ohne und später mit Klasse kommt.
 */
class SchuelerBestand {
  private klassen = new Map<string, Set<number | null>>();
  private static schluessel = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
  add(name: string, klasse: number | null) {
    const k = SchuelerBestand.schluessel(name);
    this.klassen.set(k, (this.klassen.get(k) ?? new Set()).add(klasse));
  }
  has(name: string, klasse: number | null): boolean {
    const vorhanden = this.klassen.get(SchuelerBestand.schluessel(name));
    if (!vorhanden) return false;
    return klasse === null || vorhanden.has(null) || vorhanden.has(klasse);
  }
}

const meldungen = (fehler: z.ZodError) => [...new Set(fehler.issues.map((i) => i.message))];

/** Benutzername → Lehrer-Id, und die Namen, die es schon gibt. */
function lehrerBestand() {
  const rows = db().prepare("SELECT id, name, username FROM teachers").all() as { id: number; name: string; username: string | null }[];
  return {
    nachBenutzername: new Map(rows.filter((r) => r.username).map((r) => [String(r.username).toLowerCase(), r.id])),
    benutzernamen: new Set(rows.filter((r) => r.username).map((r) => String(r.username).toLowerCase())),
    namen: new Set(rows.map((r) => r.name.trim().toLowerCase())),
  };
}

function schuelerBestand(): SchuelerBestand {
  const bestand = new SchuelerBestand();
  for (const r of db().prepare("SELECT name, klasse FROM students").all() as { name: string; klasse: number | null }[]) bestand.add(r.name, r.klasse || null);
  return bestand;
}

function pruefe(art: ImportArt, text: string): Geprueft {
  if (art === "dokumentation") {
    const doku = pruefeDokumentation(text);
    return { vorschau: doku.vorschau, intern: [], doku };
  }
  const spalten = art === "lehrer" ? LEHRER_SPALTEN : SCHUELER_SPALTEN;
  const vorschau: ImportVorschau = { art, spalten: [], zeilen: [], gesamt: 0, gueltig: 0, stufeOffen: 0, fehlerhaft: 0, dubletten: 0 };
  const intern: ZeileIntern[] = [];
  const zeilen = parseCsv(text);
  if (!zeilen.length) return { vorschau: { ...vorschau, fehler: "Die Datei ist leer." }, intern };

  const kopf = zeilen[0].map(normKopf);
  const nummer = new Map<string, number>();
  for (const s of spalten) {
    const i = kopf.findIndex((k) => s.titel.includes(k));
    if (i >= 0) nummer.set(s.feld, i);
  }
  vorschau.spalten = spalten.filter((s) => nummer.has(s.feld)).map((s) => s.label);
  const fehlend = spalten.filter((s) => s.pflicht && !nummer.has(s.feld)).map((s) => s.label);
  if (fehlend.length) {
    return {
      vorschau: { ...vorschau, fehler: `In der Datei fehlen die Spalten: ${fehlend.join(", ")}. Erwartet wird der Aufbau des CSV-Exports (Semikolon, erste Zeile = Spaltennamen).` },
      intern,
    };
  }

  const daten = zeilen
    .slice(1)
    .map((z, i) => ({ z, nr: i + 2 }))
    .filter(({ z }) => z.some((v) => v.trim() !== ""));
  vorschau.gesamt = daten.length;

  const lehrer = lehrerBestand();
  const vorhanden = art === "schueler" ? schuelerBestand() : null;
  const inDatei = new Set<string>();
  const namenInDatei = new Set<string>();
  const schuelerInDatei = new SchuelerBestand();

  for (const { z, nr } of daten) {
    const wert = (feld: string) => {
      const i = nummer.get(feld);
      // die Textmarke `'` des Exports fällt hier weg — die Zelle bleibt sonst unverändert Text
      return i === undefined ? "" : unprotectCell(z[i] ?? "").trim();
    };
    const anzeige: ImportZeile = { zeile: nr, beschriftung: "", fehler: [], dublette: "" };

    if (art === "lehrer") {
      const geprueft = lehrerZeileSchema.safeParse({
        name: wert("name"),
        username: wert("username"),
        is_admin: jaNeinAus(wert("is_admin"), "nein"),
        active: jaNeinAus(wert("active"), "ja"),
      });
      if (!geprueft.success) {
        anzeige.fehler = meldungen(geprueft.error);
        anzeige.beschriftung = wert("name") || wert("username") || `Zeile ${nr}`;
      } else {
        const d = geprueft.data;
        const benutzername = d.username.toLowerCase();
        const name = d.name.toLowerCase();
        anzeige.beschriftung = `${d.name} (${d.username})`;
        // Name und Benutzername sind in `teachers` eindeutig: beides muss neu sein
        if (lehrer.benutzernamen.has(benutzername) || lehrer.namen.has(name)) anzeige.dublette = "datenbank";
        else if (inDatei.has(benutzername) || namenInDatei.has(name)) anzeige.dublette = "datei";
        else {
          inDatei.add(benutzername);
          namenInDatei.add(name);
        }
        intern.push({ anzeige, lehrer: { name: d.name, username: benutzername, is_admin: d.is_admin, active: d.active } });
      }
    } else {
      const geprueft = schuelerZeileSchema.safeParse({
        name: wert("name"),
        school_type: wert("school_type"),
        klasse: wert("klasse"),
        school: wert("school"),
        subjects: wert("subjects"),
        current_topics: wert("current_topics"),
        strengths_note: wert("strengths_note"),
        weaknesses_note: wert("weaknesses_note"),
        goals: wert("goals"),
        notes: wert("notes"),
        ki_hinweise: wert("ki_hinweise"),
        lehrer: wert("lehrer"),
        einheiten_pro_woche: wert("einheiten_pro_woche"),
        geplante_dauer: wert("geplante_dauer"),
        modus: modusAus(wert("modus")),
      });
      if (!geprueft.success) {
        anzeige.fehler = meldungen(geprueft.error);
        anzeige.beschriftung = wert("name") || `Zeile ${nr}`;
      } else {
        const d: SchuelerGeprueft = geprueft.data;
        const klasse = d.klasse;
        const level = checkLevel(d.school_type, klasse);
        anzeige.beschriftung = [d.name, klassenLabel(d.school_type, klasse)].filter(Boolean).join(" · ");
        if (level.status !== "eindeutig")
          anzeige.hinweis = !d.school_type && klasse === null ? "Schulart und Klasse fehlen" : !d.school_type ? "Schulart fehlt" : "Klasse fehlt";
        const teacherId = d.lehrer ? lehrer.nachBenutzername.get(d.lehrer.toLowerCase()) ?? null : null;
        // ein unbekannter Benutzername ist ein Zeilenfehler, keine stillschweigend leere Zuordnung
        if (d.lehrer && teacherId === null) anzeige.fehler.push(`Lehrer „${d.lehrer}“ ist unbekannt (die Spalte „Lehrer“ braucht den Benutzernamen).`);
        if (!anzeige.fehler.length) {
          if (vorhanden!.has(d.name, klasse)) anzeige.dublette = "datenbank";
          else if (schuelerInDatei.has(d.name, klasse)) anzeige.dublette = "datei";
          else schuelerInDatei.add(d.name, klasse);
          intern.push({
            anzeige,
            schueler: {
              input: {
                name: d.name,
                // ohne eindeutige Schulstufe 0 = „nicht bekannt“ (stufe_status wird „unklar“)
                grade: level.status === "eindeutig" && klasse !== null ? schulstufe(d.school_type, klasse) : 0,
                klasse,
                teacher_id: teacherId,
                school: d.school,
                school_type: d.school_type,
                subjects: d.subjects,
                current_topics: d.current_topics,
                strengths_note: d.strengths_note,
                weaknesses_note: d.weaknesses_note,
                goals: d.goals,
                notes: d.notes,
                ki_hinweise: d.ki_hinweise,
              },
              einheiten_pro_woche: d.einheiten_pro_woche,
              geplante_dauer: d.geplante_dauer,
              modus_wunsch: d.modus,
            },
          });
        }
      }
    }

    vorschau.zeilen.push(anzeige);
    if (anzeige.fehler.length) vorschau.fehlerhaft++;
    else if (anzeige.dublette) vorschau.dubletten++;
    else {
      vorschau.gueltig++;
      if (anzeige.hinweis) vorschau.stufeOffen++;
    }
  }
  return { vorschau, intern };
}

// ---------- Vorschau und Import ----------

/** Schritt 1: prüfen und anzeigen. Liest nur — es wird nichts geschrieben. */
export function vorschauImport(akteur: Akteur, art: ImportArt, text: string): ImportVorschau {
  if (!istAdmin(akteur)) return { art, spalten: [], zeilen: [], gesamt: 0, gueltig: 0, stufeOffen: 0, fehlerhaft: 0, dubletten: 0, fehler: NICHT_ADMIN };
  return pruefe(art, text).vorschau;
}

/**
 * Schritt 2: schreiben. Eine einzige Zeile mit Fehler lässt den ganzen Import scheitern, damit
 * keine halbe Liste in der Datenbank steht; Dubletten werden übersprungen und gemeldet.
 */
export function importiere(akteur: Akteur, art: ImportArt, text: string): ImportErgebnis {
  if (!istAdmin(akteur)) return { ok: false, fehler: NICHT_ADMIN };
  const { vorschau, intern, doku } = pruefe(art, text);
  if (vorschau.fehler) return { ok: false, fehler: vorschau.fehler, vorschau };
  if (vorschau.fehlerhaft) {
    return { ok: false, fehler: `${vorschau.fehlerhaft} ${vorschau.fehlerhaft === 1 ? "Zeile hat" : "Zeilen haben"} Fehler — es wurde nichts geschrieben. Bitte die Datei ausbessern und neu prüfen.`, vorschau };
  }

  const conn = db();
  if (doku) {
    try {
      return conn.transaction(() => schreibeDokumentation(doku))();
    } catch (e) {
      return { ok: false, fehler: `Der Import wurde abgebrochen, es wurde nichts geschrieben: ${e instanceof Error ? e.message : "unbekannter Fehler"}`, vorschau };
    }
  }
  let angelegt = 0;
  let uebersprungen = 0;
  try {
    conn.transaction(() => {
      for (const zeile of intern) {
        if (zeile.anzeige.dublette) {
          uebersprungen++;
          continue;
        }
        if (zeile.lehrer) {
          // ein neuer Lehrer bekommt das Startpasswort der Installation, niemals im Klartext gespeichert
          conn
            .prepare("INSERT INTO teachers (name, username, is_admin, active, password_hash, must_change_password) VALUES (?, ?, ?, ?, ?, 1)")
            .run(zeile.lehrer.name, zeile.lehrer.username, zeile.lehrer.is_admin ? 1 : 0, zeile.lehrer.active ? 1 : 0, hashPassword(INITIAL_PASSWORD));
        } else if (zeile.schueler) {
          // createStudent vergibt einen frischen access_token für den geheimen Link /lernen/[token]
          const id = createStudent(zeile.schueler.input);
          setSchuelerPlanung(id, {
            availability: {},
            einheiten_pro_woche: zeile.schueler.einheiten_pro_woche,
            geplante_dauer: zeile.schueler.geplante_dauer,
            modus_wunsch: zeile.schueler.modus_wunsch,
            erlaubte_lehrer: [],
          });
        }
        angelegt++;
      }
    })();
  } catch (e) {
    // die Transaktion hat alles zurückgerollt: es steht nichts von dieser Datei in der Datenbank
    return { ok: false, fehler: `Der Import wurde abgebrochen, es wurde nichts geschrieben: ${e instanceof Error ? e.message : "unbekannter Fehler"}`, vorschau };
  }

  const teile: string[] = [`${angelegt} ${art === "lehrer" ? "Lehrer" : "Schüler"} angelegt`];
  if (uebersprungen) teile.push(`${uebersprungen} übersprungen (gibt es schon)`);
  if (art === "lehrer" && angelegt) teile.push("Startpasswort ist das Startpasswort der Installation; es muss beim ersten Login geändert werden");
  return { ok: true, angelegt, uebersprungen, hinweis: `${teile.join(" · ")}.` };
}

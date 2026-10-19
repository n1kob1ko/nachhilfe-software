/**
 * Import der **Dokumentation aus einem Formular** (D27), z. B. der Google-Tabelle
 * „Dokumentation 26/27“: eine Zeile ist eine dokumentierte **Einheit**. Ein Teil des CSV-Imports
 * (`lib/csv-import.ts`, Art „dokumentation“): dieselben zwei Schritte (Vorschau, dann alles oder
 * nichts) und dieselbe Regel „nur die Verwaltung“.
 *
 * - **Lehrer** müssen in der App sein. Erkannt am Namen, am Benutzernamen oder am Vornamen, wenn
 *   ihn nur ein Lehrer hat. Ein unbekannter Lehrer ist ein Fehler in der Zeile.
 * - **Schüler** werden am Namen erkannt (Groß- und Kleinschreibung, Leerzeichen egal). Gibt es den
 *   Namen nicht, wird der Schüler angelegt: Name, Fächer aus der Tabelle, Lehrer mit den meisten
 *   Einheiten. Schulart und Klasse bleiben leer, die Schulstufe „unklar“; die Schülerliste zeigt
 *   ihn unter „Klasse fehlt“. Gibt es den Namen mehrmals, ist das ein Fehler: die Einheit landete
 *   sonst vielleicht beim falschen Kind.
 * - **Einheit:** eine abgeschlossene Dokumentationszeile (`lessons`, ohne `units`-Zeile). Das Datum
 *   steht ohne Uhrzeit (`T00:00`), die Dauer ist 0 = „nicht erfasst“. Die Mitarbeit 1–5 ist eine
 *   Schulnote (1 = sehr gut) und wird auf die Skala der App gedreht (5 = sehr aktiv). Der Lernstand
 *   ändert sich nicht: es gibt weder Verständnis noch Fähigkeiten, also keine Beobachtung.
 * - **Noch einmal importieren** ist sicher: eine Einheit mit gleichem Schüler, Tag, Lehrer, Fach und
 *   Thema gibt es schon und wird übersprungen. So lässt sich die weiter geführte Tabelle später
 *   erneut einlesen.
 */
import { z } from "zod";
import { parseCsv, unprotectCell } from "./csv";
import type { ImportErgebnis, ImportVorschau, ImportZeile } from "./csv-import";
import { db } from "./db";
import { createStudent, saveLesson, type LessonInput } from "./repo";

type Feld = "datum" | "lehrer" | "schueler" | "fach" | "thema" | "hausaufgaben" | "planung" | "beobachtung" | "mitarbeit";

/** Die Fragen des Formulars, nach Namen gelesen; die Reihenfolge der Spalten ist gleichgültig. */
export const DOKU_SPALTEN: { feld: Feld; label: string; titel: string[]; pflicht?: boolean }[] = [
  { feld: "datum", label: "Datum", titel: ["datum", "datum der einheit"], pflicht: true },
  { feld: "lehrer", label: "Lehrer", titel: ["lehrer", "lehrerin", "lehrer/in", "lehrer:in"], pflicht: true },
  { feld: "schueler", label: "Schüler", titel: ["schüler", "schueler", "schülerin", "schüler/in", "schüler:in"], pflicht: true },
  { feld: "fach", label: "Unterrichtsfach", titel: ["unterrichtsfach", "fach"] },
  { feld: "thema", label: "Behandelte Themen", titel: ["behandelte themen", "thema", "themen"] },
  { feld: "hausaufgaben", label: "Erteilte Hausaufgaben", titel: ["erteilte hausaufgaben", "hausaufgaben", "hausaufgabe", "hausübung", "hausuebung"] },
  { feld: "planung", label: "Planung für die nächste Einheit", titel: ["planung für die nächste einheit", "planung", "nächstes mal"] },
  { feld: "beobachtung", label: "Beobachtung & Fortschritte", titel: ["beobachtung & fortschritte des schülers", "beobachtung & fortschritte", "beobachtungen", "beobachtung"] },
  // bewusst nicht „Mitarbeit (1–5)“ aus dem Datenexport: dort ist 5 das Beste, hier die 1
  { feld: "mitarbeit", label: "Mitarbeit & Engagement", titel: ["mitarbeit & engagement in dieser einheit", "mitarbeit & engagement", "mitarbeit und engagement", "mitarbeit"] },
];

const kopf = (s: string) => s.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
const schluessel = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** „11.09.2026“, „1.9.2026“ oder „2026-09-11“ → „2026-09-11“; ein Tag, den es nicht gibt, ist null. */
export function datumAus(roh: string): string | null {
  const v = roh.trim();
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!de && !iso) return null;
  const [jahr, monat, tag] = de ? [Number(de[3]), Number(de[2]), Number(de[1])] : [Number(iso![1]), Number(iso![2]), Number(iso![3])];
  const d = new Date(Date.UTC(jahr, monat - 1, tag));
  if (jahr < 2000 || jahr > 2100 || d.getUTCMonth() !== monat - 1 || d.getUTCDate() !== tag) return null;
  return d.toISOString().slice(0, 10);
}

const wienerHeute = (jetzt = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(jetzt);

const text = (label: string, max: number) => z.string().max(max, `${label}: höchstens ${max} Zeichen.`);

const zeileSchema = z.object({
  datum: z
    .string()
    .min(1, "Datum fehlt.")
    .refine((v) => datumAus(v) !== null, "Datum: bitte als TT.MM.JJJJ angeben, z. B. 11.09.2026.")
    .transform((v) => datumAus(v)!),
  lehrer: z.string().min(1, "Lehrer fehlt."),
  schueler: z.string().min(1, "Schüler fehlt.").max(120, "Schüler: höchstens 120 Zeichen."),
  fach: text("Unterrichtsfach", 200),
  thema: text("Behandelte Themen", 2000),
  hausaufgaben: text("Erteilte Hausaufgaben", 2000),
  planung: text("Planung", 2000),
  beobachtung: text("Beobachtung", 4000),
  // Schulnote 1–5 → Skala der App 5–1 (1 = sehr gut wird 5 = sehr aktiv); niko, 2026-10-19
  mitarbeit: z
    .string()
    .refine((v) => v === "" || /^[1-5]$/.test(v), "Mitarbeit: 1 (sehr gut) bis 5 oder leer lassen.")
    .transform((v) => (v === "" ? null : 6 - Number(v))),
});

type Lehrer = { id: number; name: string };

/** Lehrer zu einem Eintrag der Tabelle: Name oder Benutzername, sonst ein Vorname, den nur einer hat. */
function lehrerFinder() {
  const rows = db().prepare("SELECT id, name, username FROM teachers").all() as { id: number; name: string; username: string | null }[];
  return (roh: string): Lehrer | "mehrdeutig" | null => {
    const k = schluessel(roh);
    const genau = rows.filter((r) => schluessel(r.name) === k || (r.username ?? "").toLowerCase() === k);
    const treffer = genau.length ? genau : rows.filter((r) => schluessel(r.name).split(" ")[0] === k);
    if (treffer.length > 1) return "mehrdeutig";
    return treffer[0] ? { id: treffer[0].id, name: treffer[0].name } : null;
  };
}

/** Ein Schüler, den der Import neu anlegt. */
type NeuerSchueler = { key: string; name: string; einheiten: number; lehrer: Map<number, number>; faecher: Map<string, number>; aehnlich: string[] };

type Einheit = Omit<LessonInput, "student_id"> & { student: { id: number } | { neu: string } };

export type DokuIntern = { anzeige: ImportZeile; einheit?: Einheit }[];
export type DokuGeprueft = { vorschau: ImportVorschau; intern: DokuIntern; neue: NeuerSchueler[] };

const leer = (): ImportVorschau => ({ art: "dokumentation", spalten: [], zeilen: [], gesamt: 0, gueltig: 0, stufeOffen: 0, fehlerhaft: 0, dubletten: 0 });

/** Liest und prüft die Datei; schreibt nichts. `heute` (JJJJ-MM-TT, Wien) nur für Tests. */
export function pruefeDokumentation(text: string, heute = wienerHeute()): DokuGeprueft {
  const vorschau = leer();
  const intern: DokuIntern = [];
  const zeilen = parseCsv(text);
  if (!zeilen.length) return { vorschau: { ...vorschau, fehler: "Die Datei ist leer." }, intern, neue: [] };

  const titel = zeilen[0].map(kopf);
  const nummer = new Map<Feld, number>();
  for (const s of DOKU_SPALTEN) {
    const i = titel.findIndex((k) => s.titel.includes(k));
    if (i >= 0) nummer.set(s.feld, i);
  }
  vorschau.spalten = DOKU_SPALTEN.filter((s) => nummer.has(s.feld)).map((s) => s.label);
  const fehlend = DOKU_SPALTEN.filter((s) => s.pflicht && !nummer.has(s.feld)).map((s) => s.label);
  if (fehlend.length) {
    return {
      vorschau: { ...vorschau, fehler: `In der Datei fehlen die Spalten: ${fehlend.join(", ")}. Erwartet wird die Tabelle des Formulars (erste Zeile = Fragen).` },
      intern,
      neue: [],
    };
  }

  const daten = zeilen
    .slice(1)
    .map((z, i) => ({ z, nr: i + 2 }))
    .filter(({ z }) => z.some((v) => v.trim() !== ""));
  vorschau.gesamt = daten.length;

  const findeLehrer = lehrerFinder();
  const schueler = new Map<string, { id: number; name: string }[]>();
  for (const r of db().prepare("SELECT id, name FROM students").all() as { id: number; name: string }[]) {
    const k = schluessel(r.name);
    schueler.set(k, [...(schueler.get(k) ?? []), r]);
  }
  const alleSchueler = [...schueler.values()].flat();
  // Einheiten, die es schon gibt: gleicher Schüler, Tag, Lehrer, Fach und Thema
  const einheitKey = (sid: number | string, tag: string, tid: number, fach: string, thema: string) => [sid, tag, tid, schluessel(fach), schluessel(thema)].join("|");
  const vorhanden = new Set(
    (db().prepare("SELECT student_id, substr(starts_at, 1, 10) AS tag, teacher_id, subject, topic FROM lessons WHERE kind = 'stunde'").all() as { student_id: number; tag: string; teacher_id: number | null; subject: string; topic: string }[]).map(
      (r) => einheitKey(r.student_id, r.tag, r.teacher_id ?? 0, r.subject, r.topic),
    ),
  );
  const inDatei = new Set<string>();
  const neue = new Map<string, NeuerSchueler>();

  for (const { z, nr } of daten) {
    const wert = (feld: Feld) => {
      const i = nummer.get(feld);
      return i === undefined ? "" : unprotectCell(z[i] ?? "").trim();
    };
    const anzeige: ImportZeile = { zeile: nr, beschriftung: [wert("datum"), wert("schueler"), wert("fach")].filter(Boolean).join(" · ") || `Zeile ${nr}`, fehler: [], dublette: "" };
    const geprueft = zeileSchema.safeParse({
      datum: wert("datum"),
      lehrer: wert("lehrer"),
      schueler: wert("schueler"),
      fach: wert("fach"),
      thema: wert("thema"),
      hausaufgaben: wert("hausaufgaben"),
      planung: wert("planung"),
      beobachtung: wert("beobachtung"),
      mitarbeit: wert("mitarbeit"),
    });
    if (!geprueft.success) {
      anzeige.fehler = [...new Set(geprueft.error.issues.map((i) => i.message))];
    } else {
      const d = geprueft.data;
      if (d.datum > heute) anzeige.fehler.push(`Datum ${wert("datum")} liegt in der Zukunft.`);
      const lehrer = findeLehrer(d.lehrer);
      if (lehrer === null) anzeige.fehler.push(`Lehrer „${d.lehrer}“ gibt es in der App nicht. Bitte zuerst unter Lehrer anlegen, mit dem Namen wie in der Tabelle.`);
      else if (lehrer === "mehrdeutig") anzeige.fehler.push(`„${d.lehrer}“ passt auf mehrere Lehrer. Bitte in der Tabelle den Benutzernamen eintragen.`);
      const k = schluessel(d.schueler);
      const bekannt = schueler.get(k) ?? [];
      if (bekannt.length > 1) anzeige.fehler.push(`Den Schüler „${d.schueler}“ gibt es in der App ${bekannt.length}-mal. Bitte dort die Namen unterscheidbar machen.`);
      if (typeof lehrer === "object" && lehrer) anzeige.beschriftung = `${anzeige.beschriftung} · ${lehrer.name}`;

      if (!anzeige.fehler.length && typeof lehrer === "object" && lehrer) {
        const sid: number | string = bekannt[0]?.id ?? `neu:${k}`;
        const key = einheitKey(sid, d.datum, lehrer.id, d.fach, d.thema);
        if (vorhanden.has(key)) anzeige.dublette = "datenbank";
        else if (inDatei.has(key)) anzeige.dublette = "datei";
        else inDatei.add(key);

        if (!bekannt[0]) {
          let neu = neue.get(k);
          if (!neu) {
            const vorname = k.split(" ")[0];
            // derselbe Vorname in der App: vielleicht dasselbe Kind unter längerem Namen
            const aehnlich = alleSchueler.filter((s) => schluessel(s.name).split(" ")[0] === vorname || schluessel(s.name).startsWith(`${k} `)).map((s) => s.name);
            neu = { key: k, name: d.schueler, einheiten: 0, lehrer: new Map(), faecher: new Map(), aehnlich };
            neue.set(k, neu);
            anzeige.hinweis = aehnlich.length ? "neuer Schüler · ähnlicher Name in der App" : "neuer Schüler, Klasse fehlt";
          }
          if (!anzeige.dublette) {
            neu.einheiten++;
            neu.lehrer.set(lehrer.id, (neu.lehrer.get(lehrer.id) ?? 0) + 1);
            for (const f of d.fach.split(",").map((t) => t.trim()).filter(Boolean)) neu.faecher.set(f, (neu.faecher.get(f) ?? 0) + 1);
          }
        }

        intern.push({
          anzeige,
          einheit: {
            student: bekannt[0] ? { id: bekannt[0].id } : { neu: k },
            teacher_id: lehrer.id,
            kind: "stunde",
            starts_at: `${d.datum}T00:00`,
            // 0 = nicht erfasst: die Tabelle kennt weder Uhrzeit noch Dauer
            duration_min: 0,
            subject: d.fach,
            topic: d.thema,
            status: "abgeschlossen",
            activities: "",
            mistakes: "",
            understanding: null,
            tutor_notes: d.beobachtung,
            next_steps: d.planung,
            homework_note: d.hausaufgaben,
            participation: d.mitarbeit,
            skill_ids: [],
          },
        });
      }
    }
    vorschau.zeilen.push(anzeige);
    if (anzeige.fehler.length) vorschau.fehlerhaft++;
    else if (anzeige.dublette) vorschau.dubletten++;
    else vorschau.gueltig++;
  }

  const angelegt = [...neue.values()].filter((n) => n.einheiten > 0);
  vorschau.stufeOffen = angelegt.length;
  vorschau.neueSchueler = angelegt.map((n) => ({ name: n.name, einheiten: n.einheiten, aehnlich: n.aehnlich }));
  return { vorschau, intern, neue: angelegt };
}

/** Der Lehrer mit den meisten Einheiten; bei Gleichstand der zuerst genannte. */
const hauptLehrer = (n: NeuerSchueler) => [...n.lehrer].reduce((a, b) => (b[1] > a[1] ? b : a))[0];

/**
 * Schreibt neue Schüler und Einheiten. Läuft innerhalb der Transaktion von `importiere()`; ein
 * Fehler rollt dort alles zurück.
 */
export function schreibeDokumentation(g: DokuGeprueft): Extract<ImportErgebnis, { ok: true }> {
  const ids = new Map<string, number>();
  for (const n of g.neue) {
    const faecher = [...n.faecher].sort((a, b) => b[1] - a[1]).map(([f]) => f);
    ids.set(
      n.key,
      createStudent({
        name: n.name,
        // 0 = Schulstufe nicht bekannt; createStudent setzt stufe_status „unklar“
        grade: 0,
        klasse: null,
        teacher_id: hauptLehrer(n),
        school: "",
        school_type: "",
        subjects: faecher,
        current_topics: "",
        strengths_note: "",
        weaknesses_note: "",
        goals: "",
        notes: "",
      }),
    );
  }
  let angelegt = 0;
  let uebersprungen = 0;
  for (const { anzeige, einheit } of g.intern) {
    if (!einheit) continue;
    if (anzeige.dublette) {
      uebersprungen++;
      continue;
    }
    const { student, ...rest } = einheit;
    saveLesson({ ...rest, student_id: "id" in student ? student.id : ids.get(student.neu)! });
    angelegt++;
  }
  const teile = [`${angelegt} ${angelegt === 1 ? "Einheit" : "Einheiten"} übernommen`];
  if (g.neue.length) teile.push(`${g.neue.length} ${g.neue.length === 1 ? "neuer Schüler" : "neue Schüler"} ohne Klasse (unter Schüler › „Klasse fehlt“ nachtragen)`);
  if (uebersprungen) teile.push(`${uebersprungen} übersprungen (gibt es schon)`);
  return { ok: true, angelegt, uebersprungen, hinweis: `${teile.join(" · ")}.` };
}

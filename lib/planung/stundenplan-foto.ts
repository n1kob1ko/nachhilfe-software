/**
 * Stundenplan-Fotos. niko, 2026-10-19: „außerdem bekommen wir gerade den stundenplan so wie in den fotos hier
 * ich möchte das die app wenn ich das so hochlade zb es automatisch dann eingetragen wird.“ Welcher Buchstabe
 * welcher Lehrer ist, steht nicht im Code: die Verwaltung wählt es beim ersten Mal, die App merkt es sich.
 *
 * Ein Foto ist der Wochenplan **eines** Lehrers: oben links ein Buchstabe, Spalten Mo–So, Zeilen sind
 * nummerierte Stunden zu 50 Minuten ab 08:50, farbige Felder mit Vornamen (über eine oder mehrere Stunden),
 * „Neu“ für einen neuen Schüler.
 *
 * 1. **Lesen** (`liesFoto`): die KI liest das Foto (`leseStundenplanFoto`, Funktion `stundenplan` im Router).
 *    Nur nach dem Haken, dass die Vornamen auf dem Foto an die KI gehen dürfen (niko, 2026-10-19: „Ja, nur
 *    Vornamen“). Das Foto wird **nicht gespeichert**, nur im Speicher gelesen.
 * 2. **Vorschlag** (`vorschlagAusGelesen`): rein und ohne KI. Buchstabe → Lehrer (die gespeicherte Zuordnung),
 *    Stunden → Uhrzeit (das Raster vom Foto, sonst 08:50 + 50 Minuten), Vorname → Schüler. Gesucht wird zuerst
 *    unter den Schülern dieses Lehrers. „Neu“, Unbekanntes und Mehrdeutiges ist nicht ausgewählt.
 * 3. **Prüfen und Eintragen** (`stundenplanEintragen`): nur die Verwaltung (D23). Jede Zeile hat der Lehrer in
 *    der Vorschau gesehen; geprüft wird mit derselben Überlappungsprüfung wie jeder Platz. Eingetragen wird
 *    **gesperrt** (bleibt bei „Neu generieren“ stehen), in den Zustand der Woche (leer/Entwurf → Entwurf).
 *    Zwei Schüler zur selben Zeit beim selben Lehrer bekommen den Haken „gleichzeitig“ (D26).
 */
import { aiEnabled, aiReadsImages, leseStundenplanFoto, type StundenplanGelesen } from "../ai";
import { getSetting, setSetting } from "../lehrplan";
import { db } from "../db";
import { darfWochenplanBearbeiten, type Akteur } from "./berechtigungen";
import { einheitenFuerWoche, legePlatzAn, loeschePlatz, wochenStatus } from "./repo";
import { istDatum, minutenLabel, wochenstartVon } from "./zeit";

/** Das Raster auf den Fotos: Stunde 1 beginnt um 08:50, jede dauert 50 Minuten, 16 Stunden bis 22:10. */
export const RASTER_STANDARD = { beginn: 8 * 60 + 50, dauer: 50, stunden: 16 } as const;
/** So groß darf ein Foto sein, das an die KI geht (die Seite verkleinert es vorher). */
export const MAX_FOTO_BYTES = 5 * 1024 * 1024;
const TAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;
const BUCHSTABEN_SCHLUESSEL = "stundenplan_buchstaben";

export type RasterZeile = { stunde: number; von: number; bis: number };

export function standardRaster(): RasterZeile[] {
  return Array.from({ length: RASTER_STANDARD.stunden }, (_, i) => {
    const von = RASTER_STANDARD.beginn + i * RASTER_STANDARD.dauer;
    return { stunde: i + 1, von, bis: von + RASTER_STANDARD.dauer };
  });
}

/** „08:50“, „8.50“ oder „8:50 Uhr“ → Minuten seit Mitternacht; sonst null. */
export function leseUhrzeit(roh: string): number | null {
  const m = /^\s*(\d{1,2})\s*[:.]\s*(\d{2})/.exec(roh ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/**
 * Das Raster vom Foto, wenn es stimmig ist (mindestens drei Zeilen, jede Zeile endet nach ihrem Beginn, die
 * Zeilen folgen aufeinander). Stunden, die auf dem Foto fehlen, kommen aus dem Standardraster. Sonst gilt
 * das Standardraster.
 */
export function rasterAus(gelesen: StundenplanGelesen["raster"]): { zeilen: Map<number, RasterZeile>; vomFoto: boolean } {
  const standard = new Map(standardRaster().map((z) => [z.stunde, z]));
  const vomFoto = gelesen
    .map((z) => ({ stunde: z.stunde, von: leseUhrzeit(z.von), bis: leseUhrzeit(z.bis) }))
    .filter((z): z is RasterZeile => Number.isInteger(z.stunde) && z.stunde > 0 && z.von !== null && z.bis !== null && z.bis > z.von)
    .sort((a, b) => a.stunde - b.stunde);
  const stimmig = vomFoto.length >= 3 && vomFoto.every((z, i) => i === 0 || (z.stunde > vomFoto[i - 1].stunde && z.von >= vomFoto[i - 1].bis));
  if (!stimmig) return { zeilen: standard, vomFoto: false };
  const zeilen = new Map(standard);
  for (const z of vomFoto) zeilen.set(z.stunde, z);
  return { zeilen, vomFoto: true };
}

// ---------- Buchstabe → Lehrer ----------

/** Welcher Lehrer welcher Buchstabe ist. Gespeichert beim Eintragen; vorher leer, dann wählt die Verwaltung. */
export function buchstabenZuordnung(): Record<string, number> {
  try {
    const roh = JSON.parse(getSetting(BUCHSTABEN_SCHLUESSEL, "{}")) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(roh).filter(([b, id]) => /^[A-Z]$/.test(b) && Number.isInteger(id) && Number(id) > 0)) as Record<string, number>;
  } catch {
    return {};
  }
}

export function speichereBuchstaben(neu: Record<string, number>) {
  const alt = buchstabenZuordnung();
  for (const [b, id] of Object.entries(neu)) {
    const buchstabe = normBuchstabe(b);
    if (buchstabe && Number.isInteger(id) && id > 0) alt[buchstabe] = id;
  }
  setSetting(BUCHSTABEN_SCHLUESSEL, JSON.stringify(alt));
}

/** „a“, „ A “, „A)“ → „A“; sonst null. */
export function normBuchstabe(roh: string | null | undefined): string | null {
  const m = /^[^A-Za-z]*([A-Za-z])[^A-Za-z]*$/.exec(roh ?? "");
  return m ? m[1].toUpperCase() : null;
}

// ---------- Vorname → Schüler ----------

export type SchuelerKurz = { id: number; name: string; teacher_id: number | null };
export type Treffer = "genau" | "aehnlich" | "mehrere" | "keiner" | "neu";

/** Kleinbuchstaben, ohne Akzente, nur Buchstaben, Bindestrich und einzelne Leerzeichen. */
export function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[^a-z\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function abstand(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let vorher = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const merk = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, vorher + (a[i - 1] === b[j - 1] ? 0 : 1));
      vorher = merk;
    }
  }
  return d[b.length];
}

/** Passt der Name vom Foto zu diesem Schüler? „Anna“ und „Anna H.“ passen zu „Anna Huber“. */
function passt(foto: string[], schueler: string[]): boolean {
  if (!foto.length || foto[0] !== schueler[0]) return false;
  return foto.slice(1).every((teil) => schueler.slice(1).some((s) => s.startsWith(teil)));
}

/**
 * Die Schüler zu einem Namen vom Foto. Zuerst unter den Schülern des Lehrers, dann unter allen. Ein Tippfehler
 * (ein Buchstabe anders, ab vier Buchstaben) ist „ähnlich“ und wird nur vorgeschlagen, wenn er eindeutig ist.
 */
export function findeSchueler(name: string, schueler: SchuelerKurz[], lehrerId: number | null): { ids: number[]; treffer: Exclude<Treffer, "neu"> } {
  const foto = normName(name).split(" ").filter(Boolean);
  if (!foto.length) return { ids: [], treffer: "keiner" };
  const teile = schueler.map((s) => ({ s, teile: normName(s.name).split(" ").filter(Boolean) }));
  const eigene = teile.filter((x) => lehrerId !== null && x.s.teacher_id === lehrerId);
  const gruppen = eigene.length ? [eigene, teile] : [teile];
  for (const gruppe of gruppen) {
    const ids = gruppe.filter((x) => passt(foto, x.teile)).map((x) => x.s.id);
    if (ids.length) return { ids, treffer: ids.length === 1 ? "genau" : "mehrere" };
  }
  if (foto[0].length >= 4)
    for (const gruppe of gruppen) {
      const ids = gruppe.filter((x) => x.teile[0] && abstand(foto[0], x.teile[0]) === 1).map((x) => x.s.id);
      if (ids.length) return { ids, treffer: ids.length === 1 ? "aehnlich" : "mehrere" };
    }
  return { ids: [], treffer: "keiner" };
}

// ---------- Vorschlag ----------

export type VorschlagZeile = {
  /** eindeutig innerhalb des Fotos */
  schluessel: string;
  tag: number;
  start: number;
  dauer: number;
  /** „Stunde 3–4“ */
  stunden: string;
  /** der Name, wie er auf dem Foto steht */
  text: string;
  /** im Feld steht „Neu“ */
  neu: boolean;
  treffer: Treffer;
  /** vorausgewählt nur bei „genau“ und eindeutig „ähnlich“ */
  studentId: number | null;
  kandidaten: number[];
};

export type FotoVorschlag = {
  buchstabe: string | null;
  teacherId: number | null;
  rasterVomFoto: boolean;
  zeilen: VorschlagZeile[];
  /** was die KI nicht sicher lesen konnte, und Felder, die nicht ins Raster passen */
  unsicher: string[];
};

/** Aus dem, was die KI gelesen hat, die Zeilen der Vorschau. Rein: keine KI, keine Datenbank. */
export function vorschlagAusGelesen(gelesen: StundenplanGelesen, o: { schueler: SchuelerKurz[]; zuordnung: Record<string, number>; lehrerIds: number[] }): FotoVorschlag {
  const buchstabe = normBuchstabe(gelesen.lehrer_buchstabe);
  const zugeordnet = buchstabe ? o.zuordnung[buchstabe] : undefined;
  const teacherId = zugeordnet && o.lehrerIds.includes(zugeordnet) ? zugeordnet : null;
  const raster = rasterAus(gelesen.raster ?? []);
  const unsicher = (gelesen.unsicher ?? []).map((u) => u.trim()).filter(Boolean).slice(0, 20);
  const zeilen: VorschlagZeile[] = [];
  gelesen.bloecke.forEach((b, i) => {
    const tag = TAGE.indexOf(b.tag) + 1;
    const von = raster.zeilen.get(b.von_stunde);
    const bis = raster.zeilen.get(b.bis_stunde);
    const wo = `${b.tag} Stunde ${b.von_stunde}${b.bis_stunde !== b.von_stunde ? `–${b.bis_stunde}` : ""}`;
    if (tag < 1 || !von || !bis || b.bis_stunde < b.von_stunde || bis.bis <= von.von) {
      unsicher.push(`${wo}: passt nicht ins Raster („${b.text.trim().slice(0, 40)}“)`);
      return;
    }
    const start = von.von;
    const dauer = bis.bis - von.von;
    const stunden = `Stunde ${b.von_stunde}${b.bis_stunde !== b.von_stunde ? `–${b.bis_stunde}` : ""}`;
    // „Neu“ kann auch im Namen stehen („Neu: Anna“); dann gilt das Feld als neu und der Name bleibt
    const ohneNeu = (n: string) => n.replace(/\(?\bneu\b\)?\s*:?/gi, " ").replace(/\s+/g, " ").trim();
    const neu = b.neu || b.namen.some((n) => /\bneu\b/i.test(n));
    const namen = b.namen.map(ohneNeu).filter(Boolean);
    if (!namen.length) {
      const text = ohneNeu(b.text) || (neu ? "Neu" : "?");
      zeilen.push({ schluessel: `${i}`, tag, start, dauer, stunden, text, neu, treffer: neu ? "neu" : "keiner", studentId: null, kandidaten: [] });
      return;
    }
    namen.forEach((name, j) => {
      // auch bei „Neu“ wird gesucht: ist der neue Schüler schon angelegt, steht er gleich da
      const f = findeSchueler(name, o.schueler, teacherId);
      const sicher = f.treffer === "genau" || f.treffer === "aehnlich";
      zeilen.push({ schluessel: `${i}.${j}`, tag, start, dauer, stunden, text: name, neu, treffer: f.treffer, studentId: sicher ? f.ids[0] : null, kandidaten: f.ids });
    });
  });
  zeilen.sort((a, b) => a.tag - b.tag || a.start - b.start);
  return { buchstabe, teacherId, rasterVomFoto: raster.vomFoto, zeilen, unsicher };
}

// ---------- Lesen ----------

/** Ob ein Stundenplan-Foto jetzt gelesen werden kann; sonst der Grund in Worten. */
export function stundenplanFotoMoeglich(): { ok: true } | { ok: false; grund: string } {
  if (!aiEnabled("stundenplan")) return { ok: false, grund: "Ein Foto lesen kann nur die KI, und die ist gerade nicht eingerichtet. Plätze legst du im Wochenplan selbst an." };
  if (!aiReadsImages("stundenplan"))
    return { ok: false, grund: "Im eingestellten KI-Modus kann die KI keine Fotos lesen (zum Beispiel im manuellen Modus). Plätze legst du im Wochenplan selbst an." };
  return { ok: true };
}

/** Liest ein Foto und macht daraus den Vorschlag. Wirft einen Fehler mit einem Satz für den Lehrer. */
export async function liesFoto(
  foto: { mime: "image/jpeg" | "image/png" | "image/webp"; data: Buffer },
  o: { teacherId: number; schueler: SchuelerKurz[]; lehrerIds: number[] },
): Promise<FotoVorschlag> {
  const geht = stundenplanFotoMoeglich();
  if (!geht.ok) throw new Error(geht.grund);
  if (foto.data.length > MAX_FOTO_BYTES) throw new Error(`Das Foto ist zu groß (höchstens ${MAX_FOTO_BYTES / 1024 / 1024} MB).`);
  let gelesen: StundenplanGelesen | null = null;
  let problem = "";
  try {
    gelesen = await leseStundenplanFoto({ mime: foto.mime, base64: foto.data.toString("base64") }, { teacherId: o.teacherId, trigger: "stundenplan" });
  } catch (e) {
    problem = e instanceof Error ? e.message : String(e);
  }
  if (!gelesen) throw new Error(`Die KI konnte das Foto nicht lesen.${problem ? ` ${problem}` : ""} Versuch es noch einmal oder mit einem schärferen Foto.`);
  return vorschlagAusGelesen(gelesen, { schueler: o.schueler, zuordnung: buchstabenZuordnung(), lehrerIds: o.lehrerIds });
}

// ---------- Prüfen und Eintragen ----------

export type ImportZeile = { teacherId: number; studentId: number; tag: number; start: number; dauer: number };
export type ImportErgebnis =
  | { ok: true; status: "leer" | "entwurf" | "veroeffentlicht"; zeilen: ({ ok: true } | { ok: false; fehler: string })[]; eingetragen: number; geloescht: number }
  | { ok: false; fehler: string };

/** Zwei Zeilen desselben Lehrers zur selben Zeit am selben Tag: beide „gleichzeitig“ (D26). */
export function gleichzeitigeZeilen(zeilen: ImportZeile[]): boolean[] {
  return zeilen.map((a, i) =>
    zeilen.some((b, j) => j !== i && a.teacherId === b.teacherId && a.tag === b.tag && a.start < b.start + b.dauer && b.start < a.start + a.dauer),
  );
}

class NurPruefen extends Error {}

/**
 * Trägt die bestätigten Zeilen in die Woche ein (oder prüft sie nur, `nurPruefen`: dasselbe in einer
 * Transaktion, die danach zurückgerollt wird). `ersetzen` löscht vorher die Plätze dieser Lehrer in der Woche;
 * das geht nur, solange die Woche nicht veröffentlicht ist. Eine Zeile, die die Prüfung nicht besteht, wird
 * nicht eingetragen; die anderen schon.
 */
export function stundenplanEintragen(akteur: Akteur, weekStart: string, zeilen: ImportZeile[], o: { ersetzen?: boolean; nurPruefen?: boolean } = {}): ImportErgebnis {
  if (!darfWochenplanBearbeiten(akteur)) return { ok: false, fehler: "Den Wochenplan ändert nur die Verwaltung." };
  if (!istDatum(weekStart)) return { ok: false, fehler: "Bitte eine Woche wählen." };
  if (!zeilen.length) return { ok: false, fehler: "Es ist keine Zeile ausgewählt." };
  if (zeilen.length > 200) return { ok: false, fehler: "Das sind zu viele Zeilen auf einmal." };
  const woche = wochenstartVon(weekStart);
  const status = wochenStatus(woche);
  if (o.ersetzen && status === "veroeffentlicht")
    return { ok: false, fehler: "Diese Woche ist schon veröffentlicht: vorhandene Plätze werden hier nicht gelöscht. Ändere sie im Wochenplan." };
  const zugleich = gleichzeitigeZeilen(zeilen);
  let ergebnis: Extract<ImportErgebnis, { ok: true }> | null = null;
  try {
    db().transaction(() => {
      let geloescht = 0;
      if (o.ersetzen) {
        const lehrer = new Set(zeilen.map((z) => z.teacherId));
        for (const p of einheitenFuerWoche(woche, { status: "alle" })) if (lehrer.has(p.teacher_id) && loeschePlatz(p.id).ok) geloescht++;
      }
      const je = zeilen.map((z, i) => {
        const r = legePlatzAn({
          week_start: woche,
          weekday: z.tag,
          start_min: z.start,
          geplante_dauer: z.dauer,
          teacher_id: z.teacherId,
          student_id: z.studentId,
          room_id: null,
          locked: true,
          gleichzeitig: zugleich[i],
        });
        // der Rat zum Haken „gleichzeitig“ gilt im Platz-Dialog, nicht hier: zwei Zeilen vom Foto bekommen ihn selbst
        return r.ok ? ({ ok: true } as const) : ({ ok: false, fehler: r.fehler.replace(/ Sollen beide Schüler zugleich kommen.*$/, "") } as const);
      });
      ergebnis = { ok: true, status, zeilen: je, eingetragen: je.filter((r) => r.ok).length, geloescht };
      if (o.nurPruefen) throw new NurPruefen();
    })();
  } catch (e) {
    if (!(e instanceof NurPruefen)) throw e;
  }
  return ergebnis!;
}

/** „Mo 08:50–10:30“ für Meldungen. */
export function zeitLabel(z: { tag: number; start: number; dauer: number }): string {
  return `${TAGE[z.tag - 1] ?? "?"} ${minutenLabel(z.start)}–${minutenLabel(z.start + z.dauer)}`;
}

/** Für die Vorschau: der Zustand der Woche und wie viele Plätze die Lehrer der Fotos dort schon haben. */
export function wocheFuerImport(weekStart: string, lehrerIds: number[]): { status: "leer" | "entwurf" | "veroeffentlicht"; vorhanden: number } {
  if (!istDatum(weekStart)) return { status: "leer", vorhanden: 0 };
  const woche = wochenstartVon(weekStart);
  const lehrer = new Set(lehrerIds);
  return { status: wochenStatus(woche), vorhanden: einheitenFuerWoche(woche, { status: "alle" }).filter((p) => lehrer.has(p.teacher_id)).length };
}

/** Die Zeilen, wie sie aus dem Browser kommen: nur ganze Zahlen, sonst null. */
export function leseImportZeilen(roh: unknown): ImportZeile[] | null {
  if (!Array.isArray(roh) || roh.length > 200) return null;
  const zeilen: ImportZeile[] = [];
  for (const z of roh) {
    if (!z || typeof z !== "object") return null;
    const { teacherId, studentId, tag, start, dauer } = z as Record<string, unknown>;
    const werte = [teacherId, studentId, tag, start, dauer];
    if (!werte.every((w) => typeof w === "number" && Number.isInteger(w))) return null;
    zeilen.push({ teacherId: teacherId as number, studentId: studentId as number, tag: tag as number, start: start as number, dauer: dauer as number });
  }
  return zeilen;
}

/**
 * Der Wochenplan-Generator — Port von `src/lib/services/ScheduleGenerator.ts` aus dem Quell-Repo
 * (Phase 4 des Merges, Entscheidung D2).
 *
 * Was gegenüber dem Quell-Repo anders ist:
 *
 * 1. **Dauer je Schüler (D3):** die Länge einer Einheit kommt aus `students.geplante_dauer`
 *    (1–300 Minuten), nicht mehr aus der fest verdrahteten 100. `end = start + geplante Dauer` (D19).
 * 2. **Bedarf (D18):** `einheiten_pro_woche` Plätze je Schüler; der Wochenbedarf in Minuten ist
 *    `einheiten_pro_woche × geplante_dauer`. Schon eingeplante (gesperrte) Plätze zählen mit — das
 *    sind die Ausnahmen, die von Hand gesetzt wurden.
 * 3. **10-Minuten-Raster (D19):** Startkandidaten liegen auf dem Raster aus `regeln.snapMinutes`
 *    (Vorgabe 10, immer ein Vielfaches von 10) und innerhalb der Verfügbarkeit des Schülers.
 * 4. **Reine Funktion:** kein Datenbankzugriff, keine Uhr außer der übergebenen. Gleicher `seed`
 *    ⇒ gleiches Ergebnis; `Math.random` kommt nicht vor.
 * 5. **Zeitbudget (§6):** die Berechnung ist synchrone CPU-Arbeit im einzigen Prozess der App, in
 *    dem auch die Whiteboard-SSE-Verbindungen laufen. Nach `zeitbudgetMs` (Vorgabe 2 s) bricht sie
 *    ab und gibt den **bis dahin besten Stand** zurück (`zeitbudgetErreicht: true`).
 *
 * Übernommene Regeln (alle aus `config/scheduling-rules.json`): eine Einheit je Schüler und Tag,
 * Lehrer-Verfügbarkeit, Lehrer-Kapazität (Wochenziel), Raumwunsch des Lehrers, keine Lücken im
 * Lehrertag („no-break“), ein Gebäude je Lehrer und Tag, Punkte für Nähe und Restkapazität, Abzug
 * für Lücken und Einzel-Einheiten-Tage, Paarregeln (must/should/shouldnt/mustnt) und die
 * Wochentag/Wochenende-Verteilung. Gesperrte Plätze sind Eingabe und werden nie verschoben.
 *
 * Nicht übernommen: `weekStartDate` (im Quell-Repo „reserved for future date-based rules“, nirgends
 * benutzt) und die dortige 20-Minuten-Vorgabe (hier 10, D19).
 */
import type { PlanungsRegeln } from "./regeln";
import { MINUTEN_PRO_TAG, WOCHENTAGE, type Wochentag } from "./zeit";
import { spannenFuerTag, verfuegbarkeitMinuten, type Spanne, type Verfuegbarkeit } from "./verfuegbarkeit";

export type RaumModus = "vor_ort" | "online";
export type ModusWunsch = "vor_ort" | "online" | "egal";

export type PlanungLehrer = {
  id: number;
  name: string;
  /** Wochenziel in Minuten; 0 oder fehlend heißt „kein Ziel“ (dann 9999 wie im Quell-Repo). */
  weeklyTargetMinutes: number;
  availability: Verfuegbarkeit;
  /** Wunschräume in der Reihenfolge der Wichtigkeit. */
  preferredRoomIds: number[];
};

export type PlanungSchueler = {
  id: number;
  name: string;
  /** Plätze, die dieser Schüler in der Woche haben soll (D18). */
  einheitenProWoche: number;
  /** geplante Dauer in Minuten, 1–300 (D3). */
  geplanteDauer: number;
  /** Klassenlehrer; bekommt Punkte, wenn er die Einheit übernimmt. */
  preferredTeacherId?: number | null;
  /** Wenn gesetzt, darf nur einer dieser Lehrer den Schüler einplanen. */
  allowedTeacherIds?: number[];
  modusWunsch: ModusWunsch;
  availability: Verfuegbarkeit;
};

export type PlanungRaum = { id: number; building: string; name: string; mode: RaumModus };

/** Ein Platz im Wochenplan. `id: null` heißt: gerade erzeugt, noch nicht gespeichert. */
export type GeplanteEinheit = {
  id: number | null;
  /** ISO: 1 = Montag … 7 = Sonntag (Umrechnung nur in `lib/planung/zeit.ts`). */
  weekday: Wochentag;
  /** Minuten ab Mitternacht, Vielfaches von 10 (D19). */
  start: number;
  /** `start + geplante Dauer` (D19); bei gesperrten Plätzen so, wie sie gespeichert sind. */
  end: number;
  teacherId: number;
  studentId: number;
  roomId: number | null;
  /** Von Hand gesetzt und deshalb unverrückbar. */
  locked: boolean;
};

/** Ein Schüler, der nicht (ganz) eingeplant werden konnte. */
export type OffenerEintrag = {
  studentId: number;
  studentName: string;
  /** bereits eingeplante Minuten (gesperrte Plätze zählen mit). */
  geplanteMinuten: number;
  /** Bedarf: `einheiten_pro_woche × geplante_dauer` (D18). */
  benoetigteMinuten: number;
  grund?: string;
};

export type GeneratorEingabe = {
  lehrer: PlanungLehrer[];
  schueler: PlanungSchueler[];
  raeume: PlanungRaum[];
  /** Gesperrte Plätze: Eingabe, die nie verschoben wird (D24). */
  gesperrte?: GeplanteEinheit[];
  regeln: PlanungsRegeln;
  /** Reihung bei Gleichstand; gleicher Wert ⇒ gleiches Ergebnis. */
  seed?: number;
  /** Obergrenze der Rechenzeit in Millisekunden (Vorgabe `STANDARD_ZEITBUDGET_MS`). */
  zeitbudgetMs?: number;
  /** Nur für Tests: die Uhr, mit der das Zeitbudget gemessen wird. */
  jetzt?: () => number;
};

export type GeneratorErgebnis = {
  /** Gesperrte Plätze zuerst, dann die erzeugten — in der Reihenfolge des Entstehens. */
  einheiten: GeplanteEinheit[];
  offen: OffenerEintrag[];
  /** true = das Zeitbudget war erreicht; das Ergebnis ist der bis dahin beste Stand (§6). */
  zeitbudgetErreicht: boolean;
  dauerMs: number;
};

/** Vorgabe des Zeitbudgets: 2 s synchrone Rechenzeit (§6, „single process“). */
export const STANDARD_ZEITBUDGET_MS = 2000;

// ---------- kleine Bausteine (Port der Hilfsfunktionen des Quell-Repos) ----------

/** Passt [start, end) ganz in eine der Spannen? */
function passtInSpannen(spannen: Spanne[] | undefined, start: number, end: number): boolean {
  if (!spannen?.length) return false;
  return spannen.some((s) => start >= s.start && end <= s.end);
}

/** Alle Startzeiten auf dem Raster, die mit der Dauer noch in die Spannen passen. */
function startKandidaten(spannen: Spanne[], raster: number, dauer: number): number[] {
  const starts: number[] = [];
  for (const s of spannen) {
    let t = Math.ceil(s.start / raster) * raster;
    while (t + dauer <= s.end) {
      if (!starts.includes(t)) starts.push(t);
      t += raster;
    }
  }
  return starts.sort((a, b) => a - b);
}

/** Minuten „unnützer“ Lücke zwischen den Einheiten eines Lehrers an einem Tag. */
function lueckenMinuten(einheiten: { start: number; end: number }[], schwelle: number): number {
  if (einheiten.length <= 1) return 0;
  const sortiert = [...einheiten].sort((a, b) => a.start - b.start);
  let luecke = 0;
  for (let i = 0; i < sortiert.length - 1; i++) {
    const dazwischen = sortiert[i + 1].start - sortiert[i].end;
    if (dazwischen > 0 && dazwischen < schwelle) luecke += dazwischen;
  }
  return luecke;
}

/**
 * Hat der Lehrer an diesem Tag eine Lücke zwischen zwei Einheiten? (Regel „no-break“)
 *
 * `toleranz` ist die kleinste Lücke, die als Bruch zählt. Im Quell-Repo war das jede Lücke > 0, weil
 * dessen Einheiten immer 100 Minuten lang waren und damit auf dem 20-Minuten-Raster endeten. Hier
 * ist die Dauer je Schüler verschieden (D3), das Ende liegt also oft nicht auf dem Raster (D19):
 * eine 45-Minuten-Einheit um 08:00 endet 08:45, die nächste dürfte frühstens 08:50 beginnen — mit
 * „jede Lücke > 0“ wäre der restliche Lehrertag danach unbrauchbar. Deshalb zählt eine Lücke erst ab
 * `gapUsefulMinutesThreshold` (Vorgabe 15 Minuten) als Bruch; kürzere Lücken sind laut denselben
 * Regeln ohnehin „unnütz“.
 */
function hatLuecken(einheiten: { start: number; end: number }[], toleranz: number): boolean {
  if (einheiten.length <= 1) return false;
  const sortiert = [...einheiten].sort((a, b) => a.start - b.start);
  for (let i = 0; i < sortiert.length - 1; i++) if (sortiert[i + 1].start - sortiert[i].end >= toleranz) return true;
  return false;
}

/** Bewertung eines Kandidaten: Restkapazität und Nähe bringen Punkte, Lücken und Einzel-Einheiten kosten. */
function bewertePlatz(
  teacherId: number,
  lehrerMaxMinuten: number,
  tag: Wochentag,
  start: number,
  end: number,
  schueler: PlanungSchueler,
  einheitenNachLehrer: Map<number, GeplanteEinheit[]>,
  regeln: PlanungsRegeln,
): number {
  const vorhanden = einheitenNachLehrer.get(teacherId) ?? [];
  const bisherMinuten = vorhanden.reduce((summe, e) => summe + (e.end - e.start), 0);
  const restKapazitaet = Math.max(0, lehrerMaxMinuten - bisherMinuten - (end - start));
  let punkte = restKapazitaet * regeln.pointsPerMinuteRemainingCapacity;

  if (schueler.preferredTeacherId != null && schueler.preferredTeacherId === teacherId) punkte += regeln.pointsPreferredTeacher;

  const heute = vorhanden.filter((e) => e.weekday === tag);
  const mitNeuem = [...heute.map((e) => ({ start: e.start, end: e.end })), { start, end }];
  const einzelVorher = heute.length === 1 ? regeln.penaltySingleLessonTeacherDay : 0;
  const einzelNachher = mitNeuem.length === 1 ? regeln.penaltySingleLessonTeacherDay : 0;
  const lueckeVorher = lueckenMinuten(heute.map((e) => ({ start: e.start, end: e.end })), regeln.gapUsefulMinutesThreshold);
  const lueckeNachher = lueckenMinuten(mitNeuem, regeln.gapUsefulMinutesThreshold);
  if (lueckeNachher < lueckeVorher) punkte += regeln.pointsAdjacentTeacher;
  const dazu = Math.max(0, lueckeNachher - lueckeVorher);
  punkte -= Math.ceil(dazu / 30) * regeln.penaltyPer30MinGap;
  punkte -= einzelNachher - einzelVorher;

  return punkte;
}

/** Ist schon jemand (Lehrer, Schüler oder Raum) in [start, end) an diesem Tag belegt? */
function ueberschneidet(
  tag: Wochentag,
  start: number,
  end: number,
  einheiten: GeplanteEinheit[],
  art: "lehrer" | "schueler" | "raum",
  id: number,
): boolean {
  return einheiten.some((e) => {
    if (e.weekday !== tag) return false;
    if (art === "lehrer" && e.teacherId !== id) return false;
    if (art === "schueler" && e.studentId !== id) return false;
    if (art === "raum" && e.roomId !== id) return false;
    return start < e.end && end > e.start;
  });
}

/** Dieselbe Zeit am selben Tag (für die Paarregeln)? */
function gleicherPlatz(einheit: GeplanteEinheit, tag: Wochentag, start: number, end: number): boolean {
  return einheit.weekday === tag && einheit.start === start && einheit.end === end;
}

function paarUeberlappungMinuten(einheiten: GeplanteEinheit[], aId: number, bId: number): number {
  const aEinheiten = einheiten.filter((e) => e.studentId === aId);
  const bEinheiten = einheiten.filter((e) => e.studentId === bId);
  let summe = 0;
  for (const a of aEinheiten) for (const b of bEinheiten) if (gleicherPlatz(b, a.weekday, a.start, a.end)) summe += a.end - a.start;
  return summe;
}

/**
 * Paarregeln (must/should/shouldnt/mustnt) für einen Kandidaten. `must` blockt, solange die beiden
 * Schüler noch gemeinsame Zeit brauchen; `should`/`shouldnt` werden hart, sobald ihr Punktwert 999
 * erreicht (so wie im Quell-Repo).
 */
function pruefePaarRegeln(
  schuelerId: number,
  tag: Wochentag,
  start: number,
  end: number,
  einheiten: GeplanteEinheit[],
  regeln: PlanungsRegeln,
  schuelerNachId: Map<number, PlanungSchueler>,
): { hartBlockiert: boolean; punkte: number } {
  let punkte = 0;
  const shouldAsMust = regeln.pointsStudentPairShouldSameTime >= 999;
  const shouldntAsMustnt = regeln.penaltyStudentPairShouldntSameTime >= 999;
  const bedarf = (id: number) => {
    const s = schuelerNachId.get(id);
    return s ? s.einheitenProWoche * s.geplanteDauer : 0;
  };

  for (const regel of regeln.studentPairTimingRules) {
    if (regel.studentAId !== schuelerId && regel.studentBId !== schuelerId) continue;
    const partnerId = regel.studentAId === schuelerId ? regel.studentBId : regel.studentAId;
    const partnerEinheiten = einheiten.filter((e) => e.studentId === partnerId);
    const hatPartnerEinheit = partnerEinheiten.length > 0;
    const gleichzeitig = partnerEinheiten.some((e) => gleicherPlatz(e, tag, start, end));
    const ziel = Math.min(bedarf(schuelerId), bedarf(partnerId));
    const bisher = paarUeberlappungMinuten(einheiten, schuelerId, partnerId);
    const nochNoetig = bisher < ziel;

    if (regel.strength === "must" || (regel.strength === "should" && shouldAsMust)) {
      if (nochNoetig && hatPartnerEinheit && !gleichzeitig) return { hartBlockiert: true, punkte: 0 };
      continue;
    }
    if (regel.strength === "mustnt" || (regel.strength === "shouldnt" && shouldntAsMustnt)) {
      if (gleichzeitig) return { hartBlockiert: true, punkte: 0 };
      continue;
    }
    if (regel.strength === "should" && gleichzeitig) {
      punkte += regeln.pointsStudentPairShouldSameTime;
      continue;
    }
    if (regel.strength === "shouldnt" && gleichzeitig) punkte -= regeln.penaltyStudentPairShouldntSameTime;
  }

  return { hartBlockiert: false, punkte };
}

/** Harte Regel: höchstens eine Einheit je Schüler und Tag. */
function schuelerHatEinheitAmTag(einheiten: GeplanteEinheit[], schuelerId: number, tag: Wochentag): boolean {
  return einheiten.some((e) => e.studentId === schuelerId && e.weekday === tag);
}

function istWochenende(tag: Wochentag): boolean {
  return tag === 6 || tag === 7; // Samstag, Sonntag (ISO)
}

/** Wie viele Wochentags- und Wochenend-Einheiten der Bedarf mindestens verlangt (Schwellen wie im Quell-Repo). */
function noetigeVerteilung(bedarfMinuten: number): { minWochentags: number; minWochenende: number } {
  if (bedarfMinuten >= 400) return { minWochentags: 2, minWochenende: 2 };
  if (bedarfMinuten >= 200) return { minWochentags: 1, minWochenende: 1 };
  return { minWochentags: 0, minWochenende: 0 };
}

function zaehleWochenTage(einheiten: GeplanteEinheit[], schuelerId: number): { wochentags: number; wochenende: number } {
  let wochentags = 0;
  let wochenende = 0;
  for (const e of einheiten) {
    if (e.studentId !== schuelerId) continue;
    if (istWochenende(e.weekday)) wochenende += 1;
    else wochentags += 1;
  }
  return { wochentags, wochenende };
}

/** Würde der Kandidat die Verteilung Wochentag/Wochenende unmöglich machen? */
function verletztVerteilung(
  schueler: PlanungSchueler,
  kandidatTag: Wochentag,
  einheiten: GeplanteEinheit[],
  restMinutenVorKandidat: number,
): boolean {
  const { minWochentags, minWochenende } = noetigeVerteilung(schueler.einheitenProWoche * schueler.geplanteDauer);
  if (minWochentags === 0 && minWochenende === 0) return false;

  const jetzt = zaehleWochenTage(einheiten, schueler.id);
  const wochentagsNachher = jetzt.wochentags + (istWochenende(kandidatTag) ? 0 : 1);
  const wochenendeNachher = jetzt.wochenende + (istWochenende(kandidatTag) ? 1 : 0);
  const restEinheitenNachher = Math.max(0, Math.floor((restMinutenVorKandidat - schueler.geplanteDauer) / schueler.geplanteDauer));

  const wochentagsNoetig = Math.max(0, minWochentags - wochentagsNachher);
  const wochenendeNoetig = Math.max(0, minWochenende - wochenendeNachher);
  return wochentagsNoetig + wochenendeNoetig > restEinheitenNachher;
}

function lehrerHatGebaeudekonflikt(
  lehrerEinheiten: GeplanteEinheit[],
  tag: Wochentag,
  kandidatGebaeude: string,
  gebaeudeNachRaumId: Map<number, string>,
): boolean {
  const heute = lehrerEinheiten.filter((e) => e.weekday === tag);
  if (heute.length === 0) return false;
  return heute.some((e) => (e.roomId == null ? "" : (gebaeudeNachRaumId.get(e.roomId) ?? "")) !== kandidatGebaeude);
}

/** Darf der Schüler in diesen Raum? (online / vor Ort / egal — D22) */
function raumPasstZumSchueler(schueler: PlanungSchueler, raum: PlanungRaum): boolean {
  if (schueler.modusWunsch === "egal") return true;
  if (schueler.modusWunsch === "online") return raum.mode === "online";
  return raum.mode === "vor_ort";
}

/** Kleiner, deterministischer Zufallsgeber (mulberry32) — nur für die Reihung, nie für Inhalte. */
function zufallsgeber(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Kandidat = { teacherId: number; roomId: number; weekday: Wochentag; start: number; end: number; punkte: number };

// ---------- der Generator ----------

/**
 * Plant eine Woche. Reine Funktion: kein Datenbankzugriff, keine Systemzeit außer der übergebenen
 * Uhr, gleicher `seed` ⇒ gleiches Ergebnis.
 */
export function generiereWochenplan(eingabe: GeneratorEingabe): GeneratorErgebnis {
  const regeln = eingabe.regeln;
  const uhr = eingabe.jetzt ?? (() => Date.now());
  const startZeit = uhr();
  const budget = Math.max(0, eingabe.zeitbudgetMs ?? STANDARD_ZEITBUDGET_MS);
  const raster = regeln.snapMinutes;
  const gesperrte = eingabe.gesperrte ?? [];
  const einheiten: GeplanteEinheit[] = [...gesperrte];
  const offen: OffenerEintrag[] = [];
  const schuelerNachId = new Map(eingabe.schueler.map((s) => [s.id, s]));
  const gebaeudeNachRaumId = new Map(eingabe.raeume.map((r) => [r.id, r.building]));
  const raumNachId = new Map(eingabe.raeume.map((r) => [r.id, r]));
  const alleRaumIds = eingabe.raeume.map((r) => r.id);

  let zeitbudgetErreicht = false;
  const zeitAus = () => uhr() - startZeit >= budget;

  // Die Reihung der Schüler: am knappsten Verfügbare zuerst, bei Gleichstand entscheidet der Seed.
  const zufall = zufallsgeber(eingabe.seed ?? 1);
  const rang = new Map(eingabe.schueler.map((s) => [s.id, zufall()]));
  const sortiert = [...eingabe.schueler].sort(
    (a, b) =>
      verfuegbarkeitMinuten(a.availability) - verfuegbarkeitMinuten(b.availability) ||
      (rang.get(a.id) ?? 0) - (rang.get(b.id) ?? 0) ||
      a.id - b.id,
  );

  const einheitenNachLehrer = new Map<number, GeplanteEinheit[]>();
  for (const e of einheiten) einheitenNachLehrer.set(e.teacherId, [...(einheitenNachLehrer.get(e.teacherId) ?? []), e]);

  const geplantNachSchueler = new Map<number, number>();
  for (const e of einheiten) geplantNachSchueler.set(e.studentId, (geplantNachSchueler.get(e.studentId) ?? 0) + (e.end - e.start));

  const lehrerMinuten = (teacherId: number) => (einheitenNachLehrer.get(teacherId) ?? []).reduce((summe, e) => summe + (e.end - e.start), 0);

  /** Bester Kandidat für diesen Schüler; gibt den bis dahin besten Stand zurück, wenn das Budget ausgeht. */
  function besterKandidat(schueler: PlanungSchueler, rest: number): { best: Kandidat | null; machbar: number; abgebrochen: boolean } {
    let best: Kandidat | null = null;
    let machbar = 0;
    let abgebrochen = false;
    const erlaubteLehrer =
      schueler.allowedTeacherIds && schueler.allowedTeacherIds.length > 0 ? new Set(schueler.allowedTeacherIds) : null;

    for (const tag of WOCHENTAGE) {
      if (zeitAus()) {
        abgebrochen = true;
        break;
      }
      if (regeln.enforceSingleLessonPerStudentPerDay && schuelerHatEinheitAmTag(einheiten, schueler.id, tag)) continue;
      const spannen = spannenFuerTag(schueler.availability, tag);
      if (regeln.enforceStudentAvailability && !spannen.length) continue;

      const starts = regeln.enforceStudentAvailability
        ? startKandidaten(spannen, raster, schueler.geplanteDauer)
        : startKandidaten([{ start: 0, end: MINUTEN_PRO_TAG }], raster, schueler.geplanteDauer);

      for (const start of starts) {
        if (zeitAus()) {
          abgebrochen = true;
          break;
        }
        const end = start + schueler.geplanteDauer;
        if (ueberschneidet(tag, start, end, einheiten, "schueler", schueler.id)) continue;
        if (regeln.enforceStudentWeekWeekendDistribution && verletztVerteilung(schueler, tag, einheiten, rest)) continue;

        for (const lehrer of eingabe.lehrer) {
          if (erlaubteLehrer && !erlaubteLehrer.has(lehrer.id)) continue;

          const maxMinuten = regeln.enforceTeacherCapacity ? lehrer.weeklyTargetMinutes || 9999 : Number.MAX_SAFE_INTEGER;
          if (regeln.enforceTeacherCapacity && lehrerMinuten(lehrer.id) + schueler.geplanteDauer > maxMinuten) continue;
          if (regeln.enforceTeacherAvailability && !passtInSpannen(spannenFuerTag(lehrer.availability, tag), start, end)) continue;
          if (ueberschneidet(tag, start, end, einheiten, "lehrer", lehrer.id)) continue;

          if (regeln.enforceNoTeacherBreaks) {
            const lehrerHeute = (einheitenNachLehrer.get(lehrer.id) ?? [])
              .filter((e) => e.weekday === tag)
              .map((e) => ({ start: e.start, end: e.end }));
            if (hatLuecken([...lehrerHeute, { start, end }], regeln.gapUsefulMinutesThreshold)) continue;
          }

          const moeglicheRaeume =
            regeln.enforceTeacherRoomPreference && lehrer.preferredRoomIds.length
              ? lehrer.preferredRoomIds.filter((id) => alleRaumIds.includes(id))
              : alleRaumIds;

          for (const roomId of moeglicheRaeume) {
            const raum = raumNachId.get(roomId);
            if (!raum) continue;
            if (!raumPasstZumSchueler(schueler, raum)) continue;
            if (ueberschneidet(tag, start, end, einheiten, "raum", roomId)) continue;
            if (lehrerHatGebaeudekonflikt(einheitenNachLehrer.get(lehrer.id) ?? [], tag, raum.building, gebaeudeNachRaumId)) continue;

            const punkte = bewertePlatz(lehrer.id, maxMinuten, tag, start, end, schueler, einheitenNachLehrer, regeln);
            const paar = pruefePaarRegeln(schueler.id, tag, start, end, einheiten, regeln, schuelerNachId);
            if (paar.hartBlockiert) continue;
            machbar += 1;

            const gesamt = punkte + paar.punkte;
            if (best === null || gesamt > best.punkte)
              best = { teacherId: lehrer.id, roomId, weekday: tag, start, end, punkte: gesamt };
          }
        }
      }
      if (abgebrochen) break;
    }
    return { best, machbar, abgebrochen };
  }

  function anwenden(schueler: PlanungSchueler, kandidat: Kandidat): void {
    const neu: GeplanteEinheit = {
      id: null,
      weekday: kandidat.weekday,
      start: kandidat.start,
      end: kandidat.end,
      teacherId: kandidat.teacherId,
      studentId: schueler.id,
      roomId: kandidat.roomId,
      locked: false,
    };
    einheiten.push(neu);
    einheitenNachLehrer.set(kandidat.teacherId, [...(einheitenNachLehrer.get(kandidat.teacherId) ?? []), neu]);
    geplantNachSchueler.set(schueler.id, (geplantNachSchueler.get(schueler.id) ?? 0) + schueler.geplanteDauer);
  }

  const restFuer = (schueler: PlanungSchueler) =>
    schueler.einheitenProWoche * schueler.geplanteDauer - (geplantNachSchueler.get(schueler.id) ?? 0);

  if (eingabe.raeume.length === 0) {
    // Ohne Raum gibt es keinen Platz; das ist dieselbe Abkürzung wie im Quell-Repo.
    for (const schueler of sortiert)
      if (restFuer(schueler) > 0)
        offen.push({
          studentId: schueler.id,
          studentName: schueler.name,
          geplanteMinuten: geplantNachSchueler.get(schueler.id) ?? 0,
          benoetigteMinuten: schueler.einheitenProWoche * schueler.geplanteDauer,
          grund: "Keine Räume vorhanden.",
        });
    return { einheiten, offen, zeitbudgetErreicht: false, dauerMs: Math.max(0, uhr() - startZeit) };
  }

  if (regeln.prioritizeMaxPlannedLessons) {
    let fortschritt = true;
    while (fortschritt) {
      fortschritt = false;
      let gewaehlt: PlanungSchueler | null = null;
      let gewaehlterKandidat: Kandidat | null = null;
      let besteGesamtpunkte = Number.NEGATIVE_INFINITY;

      for (const schueler of sortiert) {
        const rest = restFuer(schueler);
        if (rest < schueler.geplanteDauer) continue;
        const { best, machbar, abgebrochen } = besterKandidat(schueler, rest);
        if (best) {
          const knappheit = machbar > 0 ? 1 / machbar : 1;
          const gesamt = best.punkte + regeln.penaltyLessPlannedLessonsOverall * knappheit;
          if (gesamt > besteGesamtpunkte) {
            besteGesamtpunkte = gesamt;
            gewaehlt = schueler;
            gewaehlterKandidat = best;
          }
        }
        // Das Budget ist mitten in der Suche ausgegangen: den besten bisher gefundenen Kandidaten
        // noch setzen, dann aufhören — der Rest der Woche bleibt offen (§6, „best so far“).
        if (abgebrochen) {
          zeitbudgetErreicht = true;
          break;
        }
      }

      if (gewaehlt && gewaehlterKandidat) {
        anwenden(gewaehlt, gewaehlterKandidat);
        fortschritt = true;
      }
      if (!fortschritt) break; // niemand braucht mehr etwas
      if (zeitbudgetErreicht || zeitAus()) {
        zeitbudgetErreicht = true;
        break;
      }
    }
  } else {
    let abbruch = false;
    for (const schueler of sortiert) {
      if (abbruch) break;
      let rest = restFuer(schueler);
      while (rest >= schueler.geplanteDauer) {
        const { best, abgebrochen } = besterKandidat(schueler, rest);
        if (best) {
          anwenden(schueler, best);
          rest -= schueler.geplanteDauer;
        }
        if (abgebrochen) {
          zeitbudgetErreicht = true;
          abbruch = true;
          break;
        }
        if (!best) break;
        if (zeitAus()) {
          zeitbudgetErreicht = true;
          abbruch = true;
          break;
        }
      }
    }
  }

  for (const schueler of sortiert) {
    const geplant = geplantNachSchueler.get(schueler.id) ?? 0;
    const benoetigt = schueler.einheitenProWoche * schueler.geplanteDauer;
    if (geplant < benoetigt)
      offen.push({ studentId: schueler.id, studentName: schueler.name, geplanteMinuten: geplant, benoetigteMinuten: benoetigt });
  }

  return { einheiten, offen, zeitbudgetErreicht, dauerMs: Math.max(0, uhr() - startZeit) };
}

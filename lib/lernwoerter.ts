/**
 * Lernwörter je Schüler (niko 2026-11-27: „Lernwörter, das Wort wird vorgelesen und das Kind schreibt es; ich trage die
 * Liste der Klasse ein“). Die Lehrkraft schreibt die Liste beim Schüler unter „Lernwörter“ (lib/lernwoerter-text.ts
 * liest sie); ohne eigene Liste übt das Spiel den Grundwortschatz unten (`GRUNDWORTSCHATZ`).
 *
 * So steigert sich das Spiel je Wort, gezählt wird der erste Versuch in den beendeten Runden:
 * - neu oder zuletzt falsch: das Wort steht zuerst zum Anschauen da (und wird vorgelesen), dann wird es geschrieben;
 * - zuletzt richtig: es wird nur vorgelesen, wie beim Diktat;
 * - dreimal hintereinander richtig: es „sitzt“ und kommt nur noch selten (wenn die anderen gerade nicht reichen).
 *
 * Die Runden zählen für keine Fähigkeit im Lernstand (`LERNWORT_SKILL`): eine Liste der Klasse ist kein Thema des
 * Lehrplans. Wie es mit jedem Wort steht, sieht die Lehrkraft auf der Seite der Liste.
 */
import { db, json } from "./db";
import type { SpielKarte } from "./lernspiele-typen";
import { leseLernwoerter, lernwortKarte, lernwortKey, type LernwortEintrag } from "./lernwoerter-text";
import * as repo from "./repo";

export const LERNWORT_SKILL = "stoff.lernwoerter";
/** So oft hintereinander richtig, dann sitzt ein Wort. */
export const SITZT_NACH = 3;
/** Schreiben dauert länger als Tippen: weniger Karten je Runde als in den anderen Spielen. */
export const LERNWOERTER_JE_RUNDE = 8;
const RUNDEN_MAX = 400;

/**
 * Wenn die Lehrkraft keine Liste eingetragen hat: häufige Wörter der 3. und 4. Klasse Volksschule mit den Stellen, an
 * denen Kinder oft Fehler machen (ie, Dehnungs-h, Doppelbuchstaben, ck und tz, ß, ä und äu, v, d am Ende), je mit einem
 * kurzen Satz.
 */
export const GRUNDWORTSCHATZ = `fahren: Wir fahren mit dem Bus in die Stadt.
Fahrrad: Ich fahre mit dem Fahrrad zur Schule.
sehr: Das Eis schmeckt sehr gut.
ihm: Ich gebe ihm meinen Bleistift.
ihr: Habt ihr heute Zeit?
Uhr: Die Uhr zeigt acht.
Zahl: Sieben ist eine Zahl.
wohnen: Wir wohnen im dritten Stock.
fühlen: Ich kann den Wind fühlen.
Stuhl: Der Stuhl ist zu klein.
Kuh: Die Kuh steht auf der Weide.
Schuh: Mein Schuh ist nass.
gehen: Wir gehen in den Park.
sehen: Kannst du den Vogel sehen?
viel: Ich habe viel Hunger.
vielleicht: Es regnet vielleicht morgen.
wieder: Morgen spielen wir wieder.
spielen: Die Kinder spielen im Hof.
Tier: Das Tier frisst Gras.
Wiese: Auf der Wiese blühen Blumen.
Brief: Ich schreibe Oma einen Brief.
Spiegel: Im Spiegel sehe ich mich.
Biene: Die Biene sammelt Honig.
Ferien: In den Ferien fahren wir ans Meer.
immer: Ich putze immer meine Zähne.
Zimmer: Mein Zimmer ist aufgeräumt.
kommen: Wann kommen die Gäste?
schwimmen: Im Sommer gehen wir schwimmen.
Sonne: Die Sonne scheint warm.
Mutter: Meine Mutter liest gern.
Wasser: Ich trinke ein Glas Wasser.
essen: Wir essen um zwölf Uhr.
Klasse: Unsere Klasse macht einen Ausflug.
Ball: Der Ball rollt unter das Auto.
alle: Wir sind alle da.
Bett: Um acht gehe ich ins Bett.
Wetter: Das Wetter ist heute schön.
Treppe: Die Treppe führt in den Keller.
Suppe: Die Suppe ist heiß.
dick: Das Buch ist dick.
Glück: Viel Glück bei der Schularbeit!
Zucker: Ich nehme keinen Zucker in den Tee.
backen: Wir backen Kekse.
Rücken: Mein Rücken tut weh.
Katze: Die Katze schläft auf dem Sofa.
sitzen: Wir sitzen im Kreis.
Platz: Bitte setz dich auf deinen Platz.
jetzt: Wir sind jetzt fertig.
Straße: Die Straße ist nass.
groß: Der Elefant ist groß.
heiß: Der Tee ist heiß.
weiß: Der Schnee ist weiß.
Fuß: Ich habe mir den Fuß verletzt.
draußen: Wir spielen draußen.
Hund: Der Hund bellt laut.
Wald: Im Wald wohnen viele Tiere.
Geld: Ich spare mein Geld.
Kind: Das Kind lacht.
Hand: Gib mir die Hand.
Bild: Ich male ein Bild.
Berg: Wir wandern auf einen Berg.
Zug: Der Zug kommt pünktlich.
Tag: Heute ist ein schöner Tag.
Bäume: Im Herbst verlieren die Bäume ihre Blätter.
Häuser: In unserer Straße stehen alte Häuser.
läuft: Der Hund läuft schnell.
Äpfel: Wir pflücken Äpfel.
Hände: Ich wasche mir die Hände.
kälter: Im Winter ist es kälter.
Vogel: Der Vogel singt.
Vater: Mein Vater kocht heute.
vier: Ich habe vier Stifte.
vor: Der Bus hält vor der Schule.
von: Das Geschenk ist von Oma.
voll: Der Korb ist voll.
Freund: Mein Freund heißt Ben.
heute: Was machst du heute?
Leute: Viele Leute warten auf den Bus.
Feuer: Das Feuer ist heiß.
neu: Mein Fahrrad ist neu.
Schule: Die Schule beginnt um acht.
Fenster: Mach bitte das Fenster zu.
Weihnachten: Zu Weihnachten schneit es.
Pferd: Das Pferd frisst Heu.
nämlich: Ich komme nicht, ich bin nämlich krank.`;

export type LernwoerterRow = { student_id: number; teacher_id: number | null; text: string; updated_at: string };

export function lernwoerterListe(studentId: number): LernwoerterRow | null {
  return (db().prepare("SELECT * FROM lernwoerter WHERE student_id = ?").get(studentId) as LernwoerterRow | undefined) ?? null;
}

/** Die eigenen Lernwörter des Schülers (leer: keine Liste). */
export const eigeneLernwoerter = (studentId: number): LernwortEintrag[] => {
  const l = lernwoerterListe(studentId);
  return l ? leseLernwoerter(l.text).eintraege : [];
};

const grund = leseLernwoerter(GRUNDWORTSCHATZ).eintraege;
/** Die Wörter, die der Schüler übt: die eigene Liste, sonst der Grundwortschatz. */
export function lernwoerterVon(studentId: number): { eintraege: LernwortEintrag[]; eigene: boolean } {
  const eigene = eigeneLernwoerter(studentId);
  return eigene.length ? { eintraege: eigene, eigene: true } : { eintraege: grund, eigene: false };
}

export type Speichern = { ok: true } | { ok: false; fehler: string[] };

/** Speichert die Liste eines Schülers (ein leerer Text löscht sie). Zeilen mit Fehlern halten das Speichern auf. */
export function speichereLernwoerter(studentId: number, teacherId: number | null, roh: string): Speichern {
  const text = roh.replace(/\r\n?/g, "\n").trimEnd();
  const fehler = leseLernwoerter(text).fehler.map((m) => m.text);
  if (!repo.getStudent(studentId)) fehler.push("Diese Schülerin bzw. diesen Schüler gibt es nicht mehr.");
  if (fehler.length) return { ok: false, fehler };
  if (!text.trim()) {
    db().prepare("DELETE FROM lernwoerter WHERE student_id = ?").run(studentId);
    return { ok: true };
  }
  db()
    .prepare(
      "INSERT INTO lernwoerter (student_id, teacher_id, text, updated_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(student_id) DO UPDATE SET teacher_id = excluded.teacher_id, text = excluded.text, updated_at = excluded.updated_at",
    )
    .run(studentId, teacherId, text);
  return { ok: true };
}

export type LernwortStand = LernwortEintrag & {
  key: string;
  versuche: number;
  treffer: number;
  /** so oft zuletzt hintereinander richtig */
  folge: number;
  /** der letzte erste Versuch: richtig, falsch oder noch nie gespielt */
  zuletzt: boolean | null;
  sitzt: boolean;
};

/** Jedes Wort mit dem, was der Schüler damit gespielt hat (in der Reihenfolge der Liste). */
export function lernwortStand(studentId: number, eintraege = lernwoerterVon(studentId).eintraege): LernwortStand[] {
  const keys = new Set(eintraege.map((e) => lernwortKey(e.wort)));
  const rows = (
    db().prepare("SELECT antworten FROM spielrunden WHERE student_id = ? AND art = 'lernwoerter' AND beendet_at IS NOT NULL ORDER BY id DESC LIMIT ?").all(studentId, RUNDEN_MAX) as { antworten: string }[]
  ).reverse();
  const je = new Map<string, { versuche: number; treffer: number; folge: number; zuletzt: boolean | null }>();
  for (const r of rows)
    for (const a of json<{ key: string; richtig: boolean }[]>(r.antworten, []) ?? []) {
      if (!keys.has(a.key)) continue;
      const z = je.get(a.key) ?? { versuche: 0, treffer: 0, folge: 0, zuletzt: null };
      z.versuche++;
      z.zuletzt = a.richtig;
      if (a.richtig) {
        z.treffer++;
        z.folge++;
      } else z.folge = 0;
      je.set(a.key, z);
    }
  return eintraege.map((e) => {
    const key = lernwortKey(e.wort);
    const z = je.get(key) ?? { versuche: 0, treffer: 0, folge: 0, zuletzt: null };
    return { ...e, key, ...z, sitzt: z.folge >= SITZT_NACH };
  });
}

function mischen<T>(xs: T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Die Karten einer Runde: zuerst die zuletzt falschen, dann die neuen, dann die, die noch nicht sitzen, zuletzt die,
 * die sitzen; je Gruppe gemischt. Ein Wort, das zuletzt richtig war, kommt ohne Anschauen (nur vorgelesen).
 */
export function lernwortRunde(stand: LernwortStand[], o: { rng?: () => number; anzahl?: number } = {}): SpielKarte[] {
  const rng = o.rng ?? Math.random;
  const rang = (s: LernwortStand) => (s.zuletzt === false ? 0 : s.zuletzt === null ? 1 : !s.sitzt ? 2 : 3);
  const gruppen = [0, 1, 2, 3].map((r) => mischen(stand.filter((s) => rang(s) === r), rng));
  const wahl = gruppen.flat().slice(0, o.anzahl ?? LERNWOERTER_JE_RUNDE);
  return mischen(wahl, rng).map((s) => lernwortKarte(s, { skill: LERNWORT_SKILL, zeigen: s.zuletzt !== true }));
}

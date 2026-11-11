/**
 * Lernspiele in der Schüler-App (niko 2026-11-11: „nicht nur da, sondern beim aktuellen Stoff helfen“).
 *
 * - **Welches Spiel**: die App wählt es nach dem Stoff des Schülers (`spielVorschlaege`), in dieser Reihenfolge:
 *   eine Prüfung in den nächsten 21 Tagen mit passender Fähigkeit, der aktuelle Stoff im Profil, die letzte
 *   Einheit (14 Tage), eine unsichere Fähigkeit im Lernstand, sonst Deutsch als Fach. Ohne Deutsch kein Spiel.
 * - **Welche Karten**: aus den geprüften Aufgabenbanken (lib/lernspiele-karten.ts), Stufe nach Schulstufe und
 *   Lernstand, Fehler der letzten Runden kommen wieder.
 * - **Was zählt**: die erste Wahl je Karte. Der Server prüft sie an den Karten, die er beim Start gespeichert hat.
 *   Eine beendete Runde ist ein Beleg für den Lernstand mit Gewicht 1,5 (`SOURCE_WEIGHT.spiel`), so viel wie eine
 *   dokumentierte Stunde und viel weniger als die Aufgaben einer Übung. Abgebrochene Runden zählen nicht.
 */
import { parseTime } from "./analysis";
import { materialSkills, activeMaterial } from "./current-material";
import { db, json } from "./db";
import { stufenFuer, waehleKarten } from "./lernspiele-karten";
import { istSpielArt, sterneFuer, type SpielAntwort, type SpielArt, type SpielKarte, type SpielVorschlag } from "./lernspiele-typen";
import { tagAddieren, wienerDatum } from "./planung/zeit";
import * as repo from "./repo";

/** Die Fähigkeit, die ein Spiel übt, und welche Fähigkeiten im Stoff zu ihm führen. */
export const SPIEL_SKILL: Record<SpielArt, string> = {
  artikel: "deutsch.grammatik.artikel",
  praepositionen: "deutsch.grammatik.praepositionen",
  deklination: "deutsch.grammatik.adjektivdeklination",
};
const FUEHRT_ZU: Record<string, SpielArt> = {
  "deutsch.grammatik.artikel": "artikel",
  "deutsch.wortarten.nomen": "artikel",
  "deutsch.grammatik.praepositionen": "praepositionen",
  // „Die vier Fälle“: der Fall nach der Präposition ist der Teil, den man spielen kann
  "deutsch.grammatik.faelle": "praepositionen",
  "deutsch.grammatik.adjektivdeklination": "deklination",
};

export const spieleZuSkills = (ids: string[]): SpielArt[] => [...new Set(ids.map((id) => FUEHRT_ZU[id]).filter(Boolean))];

const PRUEFUNG_TAGE = 21;
const EINHEIT_TAGE = 14;
const UNSICHER = 0.6;

/**
 * Welche Spiele gerade zum Stoff passen, das wichtigste zuerst; jedes Spiel einmal. `lernstand` ist der Lernstand
 * je Fähigkeit (lib/service.ts analyzeStudent), `heute` das Wiener Datum.
 */
export function spielVorschlaege(student: repo.Student, o: { heute: string; lernstand?: Map<string, number | null> }): SpielVorschlag[] {
  const out: SpielVorschlag[] = [];
  const add = (arten: SpielArt[], grund: string, quelle: SpielVorschlag["quelle"]) => {
    for (const art of arten) if (!out.some((v) => v.art === art)) out.push({ art, grund, quelle });
  };

  const bis = tagAddieren(o.heute, PRUEFUNG_TAGE);
  const pruefungen = repo
    .listTests(student.id)
    .filter((t) => (t.status ?? "geplant") === "geplant" && t.date >= o.heute && t.date <= bis)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const t of pruefungen) {
    const tage = Math.round((Date.parse(t.date) - Date.parse(o.heute)) / 86_400_000);
    const wann = tage === 0 ? "heute" : tage === 1 ? "morgen" : `in ${tage} Tagen`;
    add(spieleZuSkills(t.skill_ids), `${t.title || t.kind || "Prüfung"} ${wann}`, "pruefung");
  }

  for (const m of activeMaterial(student.id)) add(spieleZuSkills(materialSkills(m, student).ids), "Dein aktueller Stoff", "stoff");

  const seit = tagAddieren(o.heute, -EINHEIT_TAGE);
  const letzte = repo
    .listLessons(student.id)
    .filter((l) => l.kind === "stunde" && l.starts_at.slice(0, 10) >= seit)
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
  if (letzte) add(spieleZuSkills(letzte.skill_ids), "Aus deiner letzten Einheit", "einheit");

  for (const [art, skill] of Object.entries(SPIEL_SKILL) as [SpielArt, string][]) {
    const m = o.lernstand?.get(skill);
    if (m != null && m < UNSICHER) add([art], "Da bist du noch unsicher", "lernstand");
  }

  if (out.length || student.subjects.includes("Deutsch")) {
    // die übrigen zum Weiterüben; Artikel für die Kleinen zuerst, Endungen erst ab der Unterstufe
    const rest: SpielArt[] = student.grade <= 4 ? ["artikel", "praepositionen"] : ["praepositionen", "deklination", "artikel"];
    add(rest, "Zum Üben", "fach");
  }
  return out;
}

// ---------- Runden ----------

type Zeile = {
  id: number;
  student_id: number;
  art: string;
  skill_id: string;
  grund: string;
  karten: string;
  antworten: string;
  anzahl: number;
  richtig: number;
  created_at: string;
  beendet_at: string | null;
};

type GespeicherteAntwort = SpielAntwort & { richtig: boolean };

/** Keys der Karten, die in den letzten beendeten Runden zuerst falsch waren und seither nicht richtig. */
export function offeneFehler(studentId: number, art: SpielArt, runden = 5): string[] {
  const rows = db()
    .prepare("SELECT antworten FROM spielrunden WHERE student_id = ? AND art = ? AND beendet_at IS NOT NULL ORDER BY id DESC LIMIT ?")
    .all(studentId, art, runden) as { antworten: string }[];
  const erledigt = new Set<string>();
  const offen: string[] = [];
  for (const r of rows) {
    for (const a of json<GespeicherteAntwort[]>(r.antworten, [])) {
      if (a.richtig) erledigt.add(a.key);
      else if (!erledigt.has(a.key) && !offen.includes(a.key)) offen.push(a.key);
    }
  }
  return offen;
}

/** Karten der letzten zwei Runden: kommen in der nächsten nicht gleich wieder (außer als Fehler). */
function zuletztGespielt(studentId: number, art: SpielArt): string[] {
  const rows = db().prepare("SELECT karten FROM spielrunden WHERE student_id = ? AND art = ? ORDER BY id DESC LIMIT 2").all(studentId, art) as { karten: string }[];
  return rows.flatMap((r) => json<SpielKarte[]>(r.karten, []).map((k) => k.key));
}

/** Startet eine Runde: wählt die Karten und merkt sie sich, damit das Ergebnis nur gegen sie geprüft wird. */
export function starteRunde(student: repo.Student, art: SpielArt, o: { grund?: SpielVorschlag["quelle"]; lernstand?: number | null; rng?: () => number } = {}): { rundeId: number; karten: SpielKarte[] } {
  // nicht beendete Runden von gestern und früher räumen sich selbst weg
  db().prepare("DELETE FROM spielrunden WHERE student_id = ? AND beendet_at IS NULL AND created_at < datetime('now', '-1 day')").run(student.id);
  const karten = waehleKarten(art, {
    stufen: stufenFuer(art, student.grade, o.lernstand ?? null),
    wiederholen: offeneFehler(student.id, art),
    zuletzt: zuletztGespielt(student.id, art),
    rng: o.rng,
  });
  const r = db()
    .prepare("INSERT INTO spielrunden (student_id, art, skill_id, grund, karten, anzahl) VALUES (?, ?, ?, ?, ?, ?)")
    .run(student.id, art, SPIEL_SKILL[art], o.grund ?? "fach", JSON.stringify(karten), karten.length);
  return { rundeId: Number(r.lastInsertRowid), karten };
}

export type RundenErgebnis = { richtig: number; anzahl: number; sterne: 1 | 2 | 3; nochmal: SpielKarte[] };

/**
 * Beendet eine Runde mit der ersten Wahl je Karte. Gezählt wird nur gegen die gespeicherten Karten; fehlt eine
 * Antwort, zählt die Karte als falsch. Eine Runde lässt sich nur einmal beenden (ein zweiter Aufruf liefert das
 * gespeicherte Ergebnis, damit ein doppelter Tipp nichts doppelt zählt).
 */
export function beendeRunde(studentId: number, rundeId: number, antworten: SpielAntwort[]): RundenErgebnis | null {
  const z = db().prepare("SELECT * FROM spielrunden WHERE id = ? AND student_id = ?").get(rundeId, studentId) as Zeile | undefined;
  if (!z) return null;
  const karten = json<SpielKarte[]>(z.karten, []);
  if (z.beendet_at) {
    const alt = json<GespeicherteAntwort[]>(z.antworten, []);
    const falsch = new Set(alt.filter((a) => !a.richtig).map((a) => a.key));
    return { richtig: z.richtig, anzahl: z.anzahl, sterne: sterneFuer(z.richtig, z.anzahl), nochmal: karten.filter((k) => falsch.has(k.key)) };
  }
  const wahl = new Map<string, string>();
  for (const a of antworten) if (typeof a?.key === "string" && typeof a?.wahl === "string" && !wahl.has(a.key)) wahl.set(a.key, a.wahl);
  const gespeichert: GespeicherteAntwort[] = karten.map((k) => ({ key: k.key, wahl: wahl.get(k.key) ?? "", richtig: wahl.get(k.key) === k.richtig }));
  const richtig = gespeichert.filter((a) => a.richtig).length;
  db().prepare("UPDATE spielrunden SET antworten = ?, richtig = ?, beendet_at = datetime('now') WHERE id = ?").run(JSON.stringify(gespeichert), richtig, rundeId);
  return { richtig, anzahl: karten.length, sterne: sterneFuer(richtig, karten.length), nochmal: karten.filter((k) => !wahl.has(k.key) || wahl.get(k.key) !== k.richtig) };
}

/** Die Fähigkeit einer Runde dieses Schülers (null, wenn es sie nicht gibt). */
export function rundenSkill(studentId: number, rundeId: number): string | null {
  const z = db().prepare("SELECT skill_id FROM spielrunden WHERE id = ? AND student_id = ?").get(rundeId, studentId) as { skill_id: string } | undefined;
  return z?.skill_id ?? null;
}

/** Wiener Datum einer Zeit aus SQLite (UTC). */
const tagVon = (s: string) => wienerDatum(new Date(parseTime(s)));

/** Tage am Stück mit mindestens einer beendeten Runde, bis heute (oder bis gestern, wenn heute noch keine war). */
export function serie(studentId: number, heute: string): number {
  const tage = new Set(
    (db().prepare("SELECT beendet_at FROM spielrunden WHERE student_id = ? AND beendet_at IS NOT NULL ORDER BY id DESC LIMIT 400").all(studentId) as { beendet_at: string }[]).map((r) =>
      tagVon(r.beendet_at),
    ),
  );
  let tag = tage.has(heute) ? heute : tagAddieren(heute, -1);
  let n = 0;
  while (tage.has(tag)) {
    n++;
    tag = tagAddieren(tag, -1);
  }
  return n;
}

/** Beendete Runden als Belege für den Lernstand (lib/analysis.ts collectEvidence). */
export function spielBelege(studentId: number): { skillId: string; score: number; at: string }[] {
  return (
    db().prepare("SELECT skill_id, richtig, anzahl, beendet_at FROM spielrunden WHERE student_id = ? AND beendet_at IS NOT NULL AND anzahl > 0").all(studentId) as {
      skill_id: string;
      richtig: number;
      anzahl: number;
      beendet_at: string;
    }[]
  ).map((r) => ({ skillId: r.skill_id, score: r.richtig / r.anzahl, at: r.beendet_at }));
}

export type SpielUebersicht = {
  runden: { art: SpielArt; richtig: number; anzahl: number; tag: string }[];
  /** Was zuletzt öfter falsch war, mit der richtigen Lösung („die Haustür“) */
  fehler: { loesung: string; mal: number }[];
};

/** Für den Lehrer im Profil: die letzten Runden der letzten 30 Tage und die häufigsten Fehler. */
export function spielUebersicht(studentId: number, heute: string): SpielUebersicht {
  const rows = db()
    .prepare("SELECT * FROM spielrunden WHERE student_id = ? AND beendet_at IS NOT NULL ORDER BY id DESC LIMIT 60")
    .all(studentId) as Zeile[];
  const seit = tagAddieren(heute, -30);
  const frisch = rows.filter((r) => tagVon(r.beendet_at!) >= seit && istSpielArt(r.art));
  const zaehler = new Map<string, number>();
  for (const r of frisch) {
    const karten = new Map(json<SpielKarte[]>(r.karten, []).map((k) => [k.key, k]));
    for (const a of json<GespeicherteAntwort[]>(r.antworten, [])) {
      const k = karten.get(a.key);
      if (!a.richtig && k) zaehler.set(k.loesung, (zaehler.get(k.loesung) ?? 0) + 1);
    }
  }
  return {
    runden: frisch.map((r) => ({ art: r.art as SpielArt, richtig: r.richtig, anzahl: r.anzahl, tag: tagVon(r.beendet_at!) })),
    fehler: [...zaehler.entries()]
      .map(([loesung, mal]) => ({ loesung, mal }))
      .sort((a, b) => b.mal - a.mal)
      .slice(0, 6),
  };
}

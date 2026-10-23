/**
 * Lösungsdaten je Aufgabe (Plan 2.3): was der Lehrer zu einer Aufgabe über Lösung und Hilfen hinaus sieht —
 * eine kurze Erklärung, die Lösungsschritte und andere Wege, wo es sie wirklich gibt. Ohne KI, für jede Aufgabe,
 * auch für alte: aus den Angaben der Aufgabe, der Erklärung der Fähigkeit (lib/erklaerungen.ts) und den typischen
 * Fehlern. Von Hand Geschriebenes (teacherNote, solutionSteps, altWays) geht vor.
 *
 * Schüler bekommen das nur bei der Freigabe „Alles“ (lib/freigabe.ts, lib/solver-tasks.ts).
 */
import { EXPLAIN } from "./erklaerungen";
import { typischeFehler } from "./themen";
import { buchstabe, kreisZahl, type TaskDraft } from "./tasks";

export type Loesungsdaten = {
  /** Worum es bei der Aufgabe geht, in zwei, drei Sätzen; leer, wenn die Fähigkeit keine Erklärung hat. */
  erklaerung: string;
  /** Falsche Antworten dieser Aufgabe und was dahintersteckt, sonst die typischen Fehler der Fähigkeit. */
  achten: string[];
  /** Die Lösungsschritte; leer, wenn es keine sinnvollen gibt (dann sagt ohneSchritte warum). */
  schritte: string[];
  ohneSchritte: string | null;
  /** Andere Wege zur selben Lösung, nur wo es sie gibt (Generatoren, Lehrer); sonst leer. */
  wege: string[];
};

type Teil = Pick<TaskDraft, "type" | "skillId" | "data" | "answer" | "solution" | "errorMap" | "solutionSteps" | "teacherNote" | "altWays">;

/**
 * Aufgabentypen ohne Lösungsschritte, und warum. Hier wird nichts erfunden: lieber kein Schritt als ein
 * Füllsatz wie „Lies die Aufgabe genau“.
 */
export const OHNE_SCHRITTE: Partial<Record<TaskDraft["type"], string>> = {
  free: "Freie Antwort: Es gibt keinen festen Weg. Worauf es ankommt, steht in der Erwartung und der Musterantwort.",
  memorize: "Auswendig schreiben: Der Text selbst ist die Lösung.",
};
/** Eine Aufgabe in einem Schritt: die Lösung ist schon der ganze Weg (Vokabel, Artikel, eine Form). */
export const EIN_SCHRITT = "Ein Schritt: Die Lösung ist schon der ganze Weg.";
export const KEIN_WEG = "Zu dieser Aufgabe ist kein Lösungsweg hinterlegt.";

const zeilen = (s: string | undefined) =>
  (s ?? "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

/** Die Schritte, die sich aus der Antwort selbst ergeben: Reihenfolge, Korrekturen, Zuordnung, Teilfragen, Belege. */
function schritteAusAntwort(t: Teil): string[] | null {
  const a = t.answer;
  if (t.type === "order" && a.steps?.length) return a.steps;
  if (t.type === "fix" && a.fixes?.length) return a.fixes.map((f) => `„${f.wrong || "–"}“ → „${f.right || "–"}“${f.label ? `: ${f.label}` : ""}`);
  if (t.type === "zuordnung" && a.pairs?.length) {
    const z = t.data.zuordnung;
    if (z?.art === "richtig-falsch") return a.pairs.map((p, i) => `${i + 1}: ${p === 0 ? "True" : "False"}${a.belege?.[i] ? `, Beleg: „${a.belege[i]}“` : ""}`);
    return a.pairs.map((p, i) => {
      const text = z?.choices?.[i]?.[p] ?? z?.options[p];
      return `${i + 1} → ${buchstabe(p)}${text ? `: ${text}` : ""}`;
    });
  }
  if (t.type === "sachaufgabe" && a.parts?.length) {
    const views = t.data.parts ?? [];
    return a.parts.map((p, i) => {
      const name = views[i]?.label || `${String.fromCharCode(97 + i)})`;
      const ergebnis = p.accepted?.filter(Boolean).join(" oder ") || p.sample || p.criteria?.join("; ") || "–";
      return `${name} ${ergebnis}${p.solution ? ` (${p.solution})` : ""}`;
    });
  }
  if (a.evidence?.length) return a.evidence.map((e) => `Im Text, Abschnitt ${e.paragraph}: „${e.quote}“`);
  return null;
}

/** Die Lösungsschritte einer Aufgabe, oder keine mit dem Grund. */
export function loesungsSchritte(t: Teil): { schritte: string[]; ohneSchritte: string | null } {
  const eigene = (t.solutionSteps ?? []).map((s) => s.trim()).filter(Boolean);
  if (eigene.length) return { schritte: eigene, ohneSchritte: null };
  const ohne = OHNE_SCHRITTE[t.type];
  if (ohne) return { schritte: [], ohneSchritte: ohne };
  const ausAntwort = schritteAusAntwort(t);
  if (ausAntwort?.length) return { schritte: ausAntwort, ohneSchritte: null };
  // Rechnung, Kurzantwort, Multiple Choice, Lückentext: die Zeilen des Lösungswegs
  const weg = zeilen(t.solution);
  if (weg.length >= 2) return { schritte: weg, ohneSchritte: null };
  // mehrere Lücken ohne eigenen Weg: Lücke für Lücke
  const luecken = t.answer.blanks ?? [];
  if (luecken.length >= 2) return { schritte: luecken.map((b, i) => `Lücke ${t.data.gapOptions ? kreisZahl(i + 1) : i + 1}: ${b[0] ?? "–"}`), ohneSchritte: null };
  return { schritte: [], ohneSchritte: weg.length ? EIN_SCHRITT : KEIN_WEG };
}

/** Eine falsche Antwort, wie der Lehrer sie liest: bei Auswahl der Buchstabe mit dem Text, sonst die Antwort. */
function falscheAntwort(t: Teil, answer: string): string {
  const opts = t.data.options;
  if (opts && /^\d+$/.test(answer) && opts[Number(answer)] !== undefined) return `${String.fromCharCode(97 + Number(answer))}) ${opts[Number(answer)]}`;
  return answer;
}

/** Die Erklärung für den Lehrer: von Hand geschrieben, sonst die der Fähigkeit; dazu worauf er achten kann. */
export function lehrerErklaerung(t: Teil): { erklaerung: string; achten: string[] } {
  const skill = t.skillId ?? "";
  const erklaerung = t.teacherNote?.trim() || EXPLAIN[skill] || EXPLAIN[skill.split(".").slice(0, 3).join(".")] || "";
  const gesehen = new Set<string>();
  const achten = t.errorMap
    .filter((e) => e.label.trim())
    .map((e) => (e.answer.trim() ? `${falscheAntwort(t, e.answer.trim())}: ${e.label.trim()}` : e.label.trim()))
    .filter((x) => !gesehen.has(x) && Boolean(gesehen.add(x)))
    .slice(0, 4);
  return { erklaerung, achten: achten.length ? achten : skill ? typischeFehler(skill).slice(0, 3) : [] };
}

/** Alles zusammen, für die Lehreransicht, das A4-Blatt in der Lehrerfassung und die Freigabe „Alles“. */
export function loesungsdaten(t: Teil): Loesungsdaten {
  return {
    ...lehrerErklaerung(t),
    ...loesungsSchritte(t),
    wege: (t.altWays ?? []).map((w) => w.trim()).filter(Boolean),
  };
}

/**
 * Sind die Schritte nur die Zeilen des Lösungswegs, der schon dasteht? Dann zeigt die Lehreransicht sie nicht
 * ein zweites Mal.
 */
export const schritteWieLoesung = (t: Pick<TaskDraft, "solution">, schritte: string[]) => schritte.join("\n") === zeilen(t.solution).join("\n");

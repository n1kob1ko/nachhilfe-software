/**
 * „Ausführlicher erklären“ im Unterricht (lib/ausfuehrlich.ts), der Teil, der mit der KI spricht. Sie bekommt nur, was zur
 * Fähigkeit gehört: Fach, Thema, Name der Fähigkeit, Schulstufe, die kurze Erklärung und die typischen Fehler der App. Keine
 * Daten eines Schülers, kein Name; deshalb gilt die Antwort für jeden Schüler dieser Schulstufe.
 *
 * Was zurückkommt, prüft die App, wo sie es kann: in Mathematik jede Rechenzeile (lib/math-check.ts `analyzeWay`, wie bei den
 * Aufgaben der KI). Ein Teil mit einer falschen Rechnung wird weggelassen (der Lehrertext, das Beispiel oder die Frage), der Rest
 * bleibt. Texte werden gekürzt.
 */
import { z } from "zod";
import { analyzeWay } from "../math-check";
import { runAI, type AIMeta } from "./router";

const AusfuehrlichSchema = z.object({
  sagt: z.string().describe("Was die Lehrkraft sagt: 5–8 kurze, klare Sätze in der Reihenfolge, in der sie erklärt; mit einem kleinen Beispiel im Text"),
  beispiel: z
    .object({
      aufgabe: z.string().describe("eine typische Aufgabe dieser Schulstufe, die die Lehrkraft vorrechnet oder vorzeigt"),
      rechnung: z.array(z.string()).describe("nur Mathematik: der Rechenweg als reine Rechenzeilen ohne Wörter, z. B. „3/4 + 1/6 = 9/12 + 2/12 = 11/12“; sonst leer"),
      loesung: z.string().describe("die Lösung mit kurzer Begründung"),
    })
    .describe("ein durchgerechnetes Beispiel"),
  frage: z.string().describe("eine kurze Frage an die Schülerin oder den Schüler, die zeigt, ob es verstanden ist"),
  antwort: z.string().describe("die erwartete Antwort auf die Frage"),
  frage_rechnung: z.string().nullable().describe("nur Mathematik: Frage und Antwort als eine Rechenzeile, z. B. „2/3 · 3/4 = 1/2“; sonst null"),
  fehler: z.array(z.string()).describe("genau 2 typische Fehler dieser Schulstufe, je mit einem kurzen Hinweis, was hilft"),
});
export type AusfuehrlichKi = z.infer<typeof AusfuehrlichSchema>;

const SYSTEM = [
  "Du schreibst für eine Nachhilfelehrkraft in Österreich einen Lehrertext zu genau einer Fähigkeit, den sie im Unterricht frei vorträgt.",
  "Er ist ausführlicher als die kurze Erklärung der App, bleibt aber knapp: 5–8 Sätze, einfache Wörter, passend zur Schulstufe. Dazu ein durchgerechnetes Beispiel, eine Verständnisfrage mit erwarteter Antwort und genau zwei typische Fehler mit einem Hinweis, was hilft.",
  "Bleib bei der Fähigkeit und ihrem Stoff. Rechne jedes Beispiel und jede Antwort selbst nach; in Mathematik schreibst du den Rechenweg als reine Rechenzeilen, die App prüft jede Zeile.",
  "Schreib in österreichischem Deutsch, ohne Anrede und ohne Namen. Bei Englisch: Erklärung auf Deutsch, Beispiele und Frage auf Englisch.",
].join("\n");

/**
 * „Einfacher erklären“ (lib/knoepfe.ts): derselbe Aufbau, aber einfacher als die Erklärung der App, für jemanden, der sie nicht
 * verstanden hat. Nur, wenn nichts Einfacheres gespeichert ist.
 */
const SYSTEM_EINFACH = [
  "Du schreibst für eine Nachhilfelehrkraft in Österreich eine einfachere Erklärung zu genau einer Fähigkeit, weil die Schülerin oder der Schüler die erste Erklärung nicht verstanden hat. Die Lehrkraft trägt sie im Unterricht frei vor.",
  "Einfacher heißt: 3–5 sehr kurze Sätze, Alltagswörter statt Fachwörter (ein nötiges Fachwort einmal erklären), ein anderer Zugang als die Erklärung der App, etwa ein Bild aus dem Alltag oder ein ganz kleines Beispiel. Dazu ein leichtes, durchgerechnetes Beispiel, eine kurze Verständnisfrage mit erwarteter Antwort und genau zwei typische Fehler mit einem Hinweis, was hilft.",
  "Bleib bei der Fähigkeit und ihrem Stoff. Rechne jedes Beispiel und jede Antwort selbst nach; in Mathematik schreibst du den Rechenweg als reine Rechenzeilen, die App prüft jede Zeile.",
  "Schreib in österreichischem Deutsch, ohne Anrede und ohne Namen. Bei Englisch: Erklärung auf Deutsch, Beispiele und Frage auf Englisch.",
].join("\n");

export type AusfuehrlichEingabe = { fach: string; bereich: string; name: string; schulstufe: number; erklaerung: string | null; typischeFehler: string[] };

/** Ausführlicher (länger als die App) oder einfacher (für jemanden, der die erste Erklärung nicht verstanden hat). */
export type ErklaerArt = "ausfuehrlich" | "einfach";

/** Systemprompt und Anfrage. Exportiert für Tests: was die App verlässt, steht hier. */
export function ausfuehrlichAnfrage(e: AusfuehrlichEingabe, art: ErklaerArt = "ausfuehrlich"): { system: string; prompt: string } {
  const z = [`Fach: ${e.fach}`, `Thema: ${e.bereich}`, `Fähigkeit: ${e.name}`, `Schulstufe: ${e.schulstufe}`];
  if (e.erklaerung?.trim()) z.push(`${art === "einfach" ? "Erste Erklärung der App (nicht verstanden)" : "Kurze Erklärung der App"}: ${e.erklaerung.trim()}`);
  const fehler = e.typischeFehler.map((f) => f.trim()).filter(Boolean);
  if (fehler.length) z.push("Typische Fehler laut App:", ...fehler.slice(0, 6).map((f) => `- ${f}`));
  return { system: art === "einfach" ? SYSTEM_EINFACH : SYSTEM, prompt: z.join("\n") };
}

/** Was die App aus der Antwort übernimmt; ein weggelassener Teil ist null (leer). */
export type Ausfuehrlich = {
  sagt: string | null;
  beispiel: { aufgabe: string; rechnung: string[]; loesung: string } | null;
  frage: string | null;
  antwort: string | null;
  fehler: string[];
};

const kurz = (s: string | null | undefined, n: number) => {
  const t = (s ?? "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/** Rechenketten im Text („3/4 + 1/6 = 11/12“): nur Zahlen, Klammern und Rechenzeichen, mindestens ein =. */
const KETTE = /[\d(][\d\s.,+\-−–·:*/×()²³^]*(?:=\s*[\d(−-][\d\s.,+\-−–·:*/×()²³^]*)+/g;

/** Hat eine dieser Rechenzeilen einen Fehler? Was die App nicht lesen kann, zählt nicht als Fehler. */
export function rechnungFalsch(zeilen: string[]): boolean {
  const liste = zeilen.map((z) => z.trim()).filter((z) => z.includes("="));
  return liste.length > 0 && analyzeWay(liste, { mode: "rechnung" }).steps.some((s) => s.status === "fehler");
}

/** Die Rechenketten in einem Text, zum Prüfen (ohne den Punkt oder Beistrich, mit dem der Satz weitergeht). */
export const kettenIn = (text: string) =>
  [...text.matchAll(KETTE)].map((m) => m[0].trim().replace(/[\s.,:]+$/, "")).filter((k) => /\d\s*[+\-−–·:*/×^]\s*[\d(]|=.*=/.test(k));

/**
 * Die Antwort der KI, wie die App sie übernimmt. In Mathematik fällt jeder Teil mit einer falschen Rechenzeile weg (`weggelassen`
 * zählt sie). Ohne Lehrertext, Beispiel und Frage: nichts Brauchbares.
 */
export function pruefeAusfuehrlich(raw: AusfuehrlichKi, fach: string): { inhalt: Ausfuehrlich; weggelassen: number } | { fehler: string } {
  const mathe = fach === "Mathematik";
  let weggelassen = 0;
  const falsch = (...texte: string[]) => mathe && texte.some((t) => rechnungFalsch(kettenIn(t)));
  let sagt: string | null = kurz(raw.sagt, 1600) || null;
  if (sagt && (sagt.length < 60 || falsch(sagt))) {
    sagt = null;
    weggelassen++;
  }
  const b = raw.beispiel;
  const rechnung = (b?.rechnung ?? []).map((z) => kurz(z, 200)).filter(Boolean).slice(0, 8);
  let beispiel: Ausfuehrlich["beispiel"] = b && kurz(b.aufgabe, 400) && (kurz(b.loesung, 600) || rechnung.length) ? { aufgabe: kurz(b.aufgabe, 400), rechnung: mathe ? rechnung : [], loesung: kurz(b.loesung, 600) } : null;
  if (beispiel && mathe && (rechnungFalsch(rechnung) || falsch(beispiel.aufgabe, beispiel.loesung))) {
    beispiel = null;
    weggelassen++;
  }
  let frage: string | null = kurz(raw.frage, 400) || null;
  let antwort: string | null = kurz(raw.antwort, 300) || null;
  if (frage && (!antwort || (mathe && (rechnungFalsch([raw.frage_rechnung ?? ""]) || falsch(frage, antwort))))) {
    frage = null;
    antwort = null;
    weggelassen++;
  }
  if (!frage) antwort = null;
  const fehler = raw.fehler
    .map((f) => kurz(f, 300))
    .filter(Boolean)
    .slice(0, 2);
  if (!sagt && !beispiel && !frage) return { fehler: "Die KI hat keine brauchbare Erklärung geliefert." };
  return { inhalt: { sagt, beispiel, frage, antwort, fehler }, weggelassen };
}

export type KiAusfuehrlich = { ok: true; inhalt: Ausfuehrlich; weggelassen: number; callId: number | null } | { ok: false; error: string };

/**
 * Eine Anfrage an die KI über den Router (Budget, Protokoll, manueller Modus); ohne Schüler, daher ohne seine KI-Hinweise. `art`
 * „einfach“: „Einfacher erklären“ (eigene Funktion `einfacher` für Kosten und Schalter).
 */
export async function kiAusfuehrlich(e: AusfuehrlichEingabe, meta: Pick<AIMeta, "teacherId" | "trigger">, art: ErklaerArt = "ausfuehrlich"): Promise<KiAusfuehrlich> {
  const { system, prompt } = ausfuehrlichAnfrage(e, art);
  const fn = art === "einfach" ? "einfacher" : "ausfuehrlich";
  const out = await runAI(fn, AusfuehrlichSchema, system, prompt, { meta: { teacherId: meta.teacherId ?? null, trigger: meta.trigger ?? fn } });
  if (!out.ok) return { ok: false, error: out.message };
  const geprueft = pruefeAusfuehrlich(out.data, e.fach);
  if ("fehler" in geprueft) return { ok: false, error: geprueft.fehler };
  return { ok: true, ...geprueft, callId: out.callId };
}

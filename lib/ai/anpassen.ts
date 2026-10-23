/**
 * „Anpassen“ im Cockpit (lib/anpassen.ts), der Teil, der mit der KI spricht. Sie bekommt die Schritte des
 * Lernpakets und nachprüfbare Tatsachen über den Schüler (letzte falsche Antworten, Fehlerarten, Lernstand,
 * Diagnose, nächste Schularbeit) **ohne Namen**: der Name des Schülers, die Namen aller Lehrer und Schüler der App
 * und jeder Name, den die App in den Antworten und Aufgaben findet, werden vorher durch [Name] ersetzt (dieselben
 * Aufrufe wie Textkorrektur und Tagesbriefing). Die KI-Hinweise hängt der Router an.
 *
 * Was zurückkommt, prüft die App: nur Schritte und Tatsachen aus der mitgeschickten Liste (anderes wird verworfen
 * und gezählt), eine leichtere oder schwerere Frage nur mit erwarteter Antwort, Texte gekürzt. Die KI ändert nichts:
 * jeder Vorschlag ist „Ungeprüft“, bis der Lehrer ihn übernimmt, und gilt dann nur für diese Einheit.
 */
import { z } from "zod";
import { detectNames, namesAfterRelation } from "../name-detection";
import { maskText, namePattern } from "../text-correction-core";
import { runAI, type AIMeta } from "./router";

export const ANPASSUNG_ARTEN = { beispiel: "Zusatzbeispiel", leichter: "Leichtere Frage", schwerer: "Schwerere Frage", bei_fehler: "Bei Fehler" } as const;
export type AnpassungArt = keyof typeof ANPASSUNG_ARTEN;
const ARTEN = Object.keys(ANPASSUNG_ARTEN) as [AnpassungArt, ...AnpassungArt[]];

/** Eine Tatsache, wie die App sie kennt (F1, F2 …): der Lehrer sieht `text`, an die KI geht er ohne Namen. */
export type Tatsache = { id: string; text: string };

export type AnpassenSchritt = { nr: string; id: number; art: string; titel: string; minuten: number; lehrer_sagt: string; lehrer_fragt: string; erwartete_antwort: string; bei_fehler: string };

export type AnpassenDaten = {
  /** nur zum Verbergen, geht nie hinaus */
  name: string;
  stufe: string;
  paket: { title: string; fach: string; thema: string; ziel: string };
  schritte: AnpassenSchritt[];
  tatsachen: Tatsache[];
  /** Texte aus den Daten des Schülers (Antworten, Aufgaben, Stoff): darin sucht die App nach weiteren Namen */
  freieTexte: string[];
  /** schon vorgeschlagen (offen, übernommen oder verworfen): nicht noch einmal */
  schon: string[];
};

const AnpassenSchema = z.object({
  vorschlaege: z
    .array(
      z.object({
        schritt: z.string().describe("Nummer des Schritts aus der Liste, z. B. „S2“"),
        art: z.enum(ARTEN).describe("beispiel: ein zusätzliches Beispiel; leichter / schwerer: dieselbe Frage leichter oder schwerer; bei_fehler: was die Lehrkraft bei einem Fehler sagt oder zeigt"),
        titel: z.string().describe("kurz, z. B. „Beispiel mit Vorzeichen“"),
        text: z.string().describe("der Vorschlag selbst: Beispiel mit Lösungsweg, die Frage, oder der Hinweis bei Fehler"),
        antwort: z.string().nullable().describe("erwartete Antwort; bei leichter und schwerer Pflicht, sonst null"),
        tatsachen: z.array(z.string()).describe("IDs der Tatsachen (F1, F2 …), auf die sich der Vorschlag stützt; keine, wenn er allgemein ist"),
      }),
    )
    .describe("2–5 Vorschläge, die wichtigsten zuerst"),
});
export type AnpassenKi = z.infer<typeof AnpassenSchema>;

const SYSTEM = [
  "Du hilfst einer Nachhilfelehrkraft in Österreich, ein vorbereitetes Lernpaket in der laufenden Einheit an eine Schülerin oder einen Schüler anzupassen.",
  "Schlage 2–5 Anpassungen zu einzelnen Schritten vor: ein zusätzliches Beispiel, das an den letzten Fehlern ansetzt; eine leichtere oder schwerere Fassung einer Frage des Schritts mit erwarteter Antwort; oder einen Hinweis „Bei Fehler“.",
  "Stütze dich nur auf die gelieferten Schritte und Tatsachen. Nenne in „tatsachen“ nur IDs aus der Liste. Behaupte nichts über die Schülerin oder den Schüler, was nicht in den Tatsachen steht; keine Vermutungen über Ursachen als Tatsache.",
  "Rechne jedes Beispiel und jede erwartete Antwort selbst nach. Bleib beim Stoff und der Schulstufe des Pakets.",
  "Schreib kurz und klar in österreichischem Deutsch, ohne Anrede. Nenne keine Namen; „[Name]“ steht für einen ersetzten Namen und bleibt so.",
  "Du änderst nichts am Lernpaket, am Lernstand oder an der Dokumentation; die Lehrkraft entscheidet über jeden Vorschlag.",
].join("\n");

/** Wer verborgen wird: der Schüler, alle Lehrer und Schüler der App, jeder Name in den Daten des Schülers. */
export function namenFuerAnpassen(d: Pick<AnpassenDaten, "name" | "freieTexte">, bekannt: string[]): string[] {
  return [...new Set([d.name, ...bekannt, ...detectNames(d.freieTexte), ...namesAfterRelation(d.freieTexte)])];
}

/** Systemprompt und Anfrage, Namen ersetzt. Exportiert für Tests: was die App verlässt, steht hier. */
export function anpassenAnfrage(d: AnpassenDaten, namen: string[]): { system: string; prompt: string } {
  const pattern = namePattern(namen);
  const m = (s: string | null | undefined, n = 400) => {
    const t = maskText((s ?? "").trim().replace(/\s*\n\s*/g, "; ").replace(/\s+/g, " "), pattern).masked;
    return t.length > n ? `${t.slice(0, n - 1)}…` : t;
  };
  const z: string[] = [];
  z.push(`Lernpaket: ${m(d.paket.title, 120)} · ${d.paket.fach}${d.paket.thema ? ` · ${m(d.paket.thema, 120)}` : ""}`);
  if (d.paket.ziel.trim()) z.push(`Ziel: ${m(d.paket.ziel, 300)}`);
  z.push(`Schüler/in: ${d.stufe || "Schulstufe unklar"}`);
  z.push("", "Schritte (in der Reihenfolge dieser Einheit):");
  for (const s of d.schritte) {
    z.push(`${s.nr}: [${s.art}] ${m(s.titel, 120)} (${s.minuten} min)`);
    const feld = (label: string, wert: string, n = 300) => {
      if (wert.trim()) z.push(`   ${label}: ${m(wert, n)}`);
    };
    feld("Lehrer sagt", s.lehrer_sagt, 200);
    feld("Lehrer fragt", s.lehrer_fragt);
    feld("Erwartete Antwort", s.erwartete_antwort);
    feld("Bei Fehler", s.bei_fehler);
  }
  z.push("", "Tatsachen über die Schülerin / den Schüler (aus der App, nachprüfbar):");
  if (!d.tatsachen.length) z.push("- keine; dann allgemeine Vorschläge zum Paket, tatsachen bleibt leer");
  for (const t of d.tatsachen) z.push(`- ${t.id}: ${m(t.text, 300)}`);
  if (d.schon.length) {
    z.push("", "Schon vorgeschlagen (nicht wiederholen):");
    for (const t of d.schon.slice(0, 20)) z.push(`- ${m(t, 120)}`);
  }
  return { system: SYSTEM, prompt: z.join("\n") };
}

export type Vorschlag = { schritt_id: number; art: AnpassungArt; titel: string; text: string; antwort: string; bezug: string[] };

const kurz = (s: string | null | undefined, n: number) => {
  const t = (s ?? "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/**
 * Die Antwort der KI, wie die App sie übernimmt: nur Schritte und Tatsachen aus der Liste (`verworfen` zählt, was
 * fehlt oder nicht passt), eine leichtere oder schwerere Frage nur mit Antwort, höchstens sechs Vorschläge.
 * `bezug` sind die Texte der App zu den genannten Tatsachen, nie Worte der KI.
 */
export function pruefeAnpassen(raw: AnpassenKi, d: Pick<AnpassenDaten, "schritte" | "tatsachen">): { vorschlaege: Vorschlag[]; verworfen: number } | { fehler: string } {
  const schritte = new Map(d.schritte.map((s) => [s.nr.toUpperCase(), s.id]));
  const tatsachen = new Map(d.tatsachen.map((t) => [t.id.toUpperCase(), t.text]));
  let verworfen = 0;
  const vorschlaege: Vorschlag[] = [];
  for (const v of raw.vorschlaege) {
    const schrittId = schritte.get(v.schritt.trim().toUpperCase());
    const text = kurz(v.text, 1200);
    const antwort = kurz(v.antwort, 600);
    if (!schrittId || !text || ((v.art === "leichter" || v.art === "schwerer") && !antwort) || vorschlaege.length >= 6) {
      verworfen++;
      continue;
    }
    const ids = [...new Set(v.tatsachen.map((x) => x.trim().toUpperCase()))];
    verworfen += ids.filter((id) => !tatsachen.has(id)).length;
    const bezug = ids.filter((id) => tatsachen.has(id)).map((id) => tatsachen.get(id)!);
    vorschlaege.push({ schritt_id: schrittId, art: v.art, titel: kurz(v.titel, 100) || ANPASSUNG_ARTEN[v.art], text, antwort: v.art === "bei_fehler" ? "" : antwort, bezug });
  }
  if (!vorschlaege.length) return { fehler: "Die KI hat keinen brauchbaren Vorschlag geliefert." };
  return { vorschlaege, verworfen };
}

export type KiAnpassen = { ok: true; vorschlaege: Vorschlag[]; verworfen: number; callId: number | null } | { ok: false; error: string };

/** Eine Anfrage an die KI (über den Router: Budget, Grenze je Schüler, Protokoll, KI-Hinweise, manueller Modus). */
export async function kiAnpassen(d: AnpassenDaten, namen: string[], meta: AIMeta): Promise<KiAnpassen> {
  const { system, prompt } = anpassenAnfrage(d, namen);
  const out = await runAI("anpassen", AnpassenSchema, system, prompt, { meta });
  if (!out.ok) return { ok: false, error: out.message };
  const geprueft = pruefeAnpassen(out.data, d);
  if ("fehler" in geprueft) return { ok: false, error: geprueft.fehler };
  return { ok: true, ...geprueft, callId: out.callId };
}

/**
 * **Warum die KI nicht geholfen hat, kurz** (F0b, Phase-E-Bericht: „Beim KI-Ausfall zeigt der Grund den rohen Fehlertext (JSON)“).
 * Die Lehrkraft liest einen von wenigen kurzen Sätzen, nie den Text des Anbieters: „KI gerade nicht erreichbar.“, „Budget erreicht.“,
 * „Antwort unbrauchbar.“. Der rohe Text steht nur im Server-Log und in `ai_calls.error`, ohne Schlüssel (`ohneSchluessel`).
 * Kein Anbietername: es heißt immer „die KI“.
 */
import type { FailCause } from "./router";

export const KI_GRUND = {
  aus: "KI ist aus.",
  nicht_erreichbar: "KI gerade nicht erreichbar.",
  budget: "Budget erreicht.",
  unbrauchbar: "Antwort unbrauchbar.",
  datei: "Die eingestellte KI kann diese Datei nicht lesen.",
} as const;

const KURZ = new Set<string>(Object.values(KI_GRUND));

/** Der kurze Grund zu einer Ursache des Routers (lib/ai/router.ts `FailCause`). */
export function kiGrundVonUrsache(cause: FailCause): string {
  switch (cause) {
    case "aus":
      return KI_GRUND.aus;
    case "budget":
    case "schuelergrenze":
      return KI_GRUND.budget;
    case "pausiert":
    case "zeitlimit":
    case "nicht_erreichbar":
    case "anbieter":
      return KI_GRUND.nicht_erreichbar;
    case "einstellung":
      return KI_GRUND.datei;
    default:
      return KI_GRUND.unbrauchbar;
  }
}

/** Ein Fehler aus `unwrap` (lib/ai/router.ts): die Nachricht wie bisher, dazu die Ursache für den kurzen Grund. */
export class KiFehler extends Error {
  constructor(
    message: string,
    readonly ursache: FailCause,
  ) {
    super(message);
    this.name = "KiFehler";
  }
}

/**
 * Ein gespeicherter oder älterer Fehlertext als kurzer Grund. Sätze der App („Die KI hat keine passenden Aufgaben geliefert.“) bleiben;
 * was nach Anbieter, Netz oder Budget klingt, wird einer der kurzen Gründe; roher Text (JSON, sehr lang) wird nie gezeigt.
 */
export function kiGrundText(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  if (!t) return KI_GRUND.unbrauchbar;
  if (KURZ.has(t)) return t;
  if (/ausgeschaltet|kein Schlüssel hinterlegt/i.test(t)) return KI_GRUND.aus;
  if (/KI-Budget|Budget für diesen Monat|KI-Grenze für diesen Schüler/i.test(t)) return KI_GRUND.budget;
  if (/kann keine (PDFs|Bilder) lesen|nicht unterstützt/i.test(t)) return KI_GRUND.datei;
  if (/keine verwertbare Antwort|Antwort (ist leer|enthält kein JSON|abgeschnitten|nicht lesbar)/i.test(t)) return KI_GRUND.unbrauchbar;
  if (/nicht erreichbar|nicht rechtzeitig|antwortet mit|pausiert|Zeitüberschreitung|timeout|timed out|fetch failed|ECONN|ENOTFOUND|socket|network|abort|meldet einen Fehler/i.test(t)) return KI_GRUND.nicht_erreichbar;
  // a sentence of the app itself stays; anything raw (a body, a stack) does not reach the teacher
  if (/[{}<>[\]]/.test(t) || t.length > 160) return KI_GRUND.nicht_erreichbar;
  return t;
}

/** Der kurze Grund zu einem Fehler: aus `unwrap` nach der Ursache, sonst nach dem Text. */
export function kiGrund(e: unknown): string {
  if (e instanceof KiFehler) return kiGrundVonUrsache(e.ursache);
  if (e && typeof e === "object" && "cause" in e && typeof (e as { cause: unknown }).cause === "string" && "ok" in e) return kiGrundVonUrsache((e as { cause: FailCause }).cause);
  return kiGrundText(e instanceof Error ? e.message : typeof e === "string" ? e : "");
}

/** Text ohne Schlüssel: alles, was wie ein API-Schlüssel oder ein Bearer-Token aussieht, wird zu „[…]“. */
export function ohneSchluessel(s: string): string {
  return s
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer […]")
    .replace(/\b(sk|pk|rk)-[A-Za-z0-9_-]{6,}/g, "[…]")
    .replace(/\b(api[_-]?key|x-api-key|authorization)(["']?\s*[:=]\s*["']?)[^\s"',}]{6,}/gi, "$1$2[…]")
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "[…]");
}

/** Der rohe Fehler ins Server-Log, ohne Schlüssel; die Lehrkraft sieht nur `kiGrund`. */
export function protokolliere(wo: string, e: unknown): void {
  const roh = e instanceof Error ? e.message : String(e);
  console.warn(`[KI] ${wo}: ${ohneSchluessel(roh).slice(0, 500)}`);
}

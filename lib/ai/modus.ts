/**
 * Der KI-Modus als Einstellung: welcher Anbieter antwortet — „anthropic" (Claude direkt, Standard),
 * „openrouter" oder „manual" (manueller KI-Modus, ADR 0009 — der Prompt wird gezeigt, die Antwort von
 * Hand eingefügt). Ein früher gespeichertes „api" (vor der Anbieterwahl: der Anbieter mit Schlüssel)
 * gilt als „anthropic". Fehlt dem gewählten Anbieter der Schlüssel, ist die KI aus; es wird nie von
 * selbst auf einen anderen Anbieter umgeschaltet.
 *
 * Er liegt in `app_settings` unter dem Schlüssel `ki_modus` und wird von `routeFor` in
 * `lib/ai/config.ts` gelesen, sobald weder `AI_<AREA>_PROVIDER` noch `AI_PROVIDER` etwas vorgeben.
 * Damit gilt ein per Oberfläche umgestellter Modus überall gleich: im Router, in `aiEnabled`, in der
 * Anbietertabelle auf Mehr › KI-Kosten und in der Textvorschau.
 *
 * Der gelesene Wert wird zwei Sekunden lang behalten. Next.js lädt dieses Modul je Route einmal;
 * ohne den kurzen Zwischenspeicher wäre jeder `routeFor`-Aufruf (und die Kostenseite ruft ihn je
 * Bereich auf) eine eigene Abfrage. Zwei Sekunden Verzug beim Umschalten sind unschädlich.
 */
import { db } from "../db";

export const KI_MODUS_SCHLUESSEL = "ki_modus";

export const KI_MODI = ["anthropic", "openrouter", "manual"] as const;
export type KiModus = (typeof KI_MODI)[number];

export const KI_MODUS_LABEL: Record<KiModus, string> = {
  anthropic: "Anthropic (Claude direkt)",
  openrouter: "OpenRouter",
  manual: "Manuell (Prompt kopieren)",
};

/** Ein gespeicherter Wert als Modus; alles Unbekannte (auch das alte „api") ist der Standard „anthropic". */
export function alsKiModus(value: string | null | undefined): KiModus {
  return value === "openrouter" || value === "manual" ? value : "anthropic";
}

const TTL_MS = 2_000;
const shared = globalThis as unknown as { __kiModus?: { at: number; modus: KiModus } };

/** Der eingestellte Modus; ohne Eintrag oder bei kaputtem Wert gilt „anthropic". */
export function kiModus(): KiModus {
  const kept = shared.__kiModus;
  if (kept && Date.now() - kept.at < TTL_MS) return kept.modus;
  let modus: KiModus = "anthropic";
  try {
    const row = db().prepare("SELECT value FROM app_settings WHERE key = ?").get(KI_MODUS_SCHLUESSEL) as { value: string } | undefined;
    modus = alsKiModus(row?.value);
  } catch {
    modus = "anthropic";
  }
  shared.__kiModus = { at: Date.now(), modus };
  return modus;
}

/** Setzt den Modus dauerhaft (Mehr › KI-Kosten) und nimmt ihn sofort in den Zwischenspeicher. */
export function setKiModus(modus: KiModus): void {
  db()
    .prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(KI_MODUS_SCHLUESSEL, modus);
  shared.__kiModus = { at: Date.now(), modus };
}

/** Nur für Tests: den Zwischenspeicher vergessen, damit die nächste Abfrage wirklich liest. */
export function resetKiModusCache(): void {
  shared.__kiModus = undefined;
}

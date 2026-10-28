/** The provider adapters behind the router. Adding a provider: an adapter here and its id in config. */
import { liesPdfText } from "../../pdf-text";
import { hasKey, poolOf, PROVIDER_IDS, type BudgetPool, type ProviderId } from "../config";
import { anthropicTransport } from "./anthropic";
import { manualTransport } from "./manual";
import { FLAVORS, openAICompatibleTransport } from "./openai-compatible";
import type { Capabilities, Part, Prompt, Transport } from "./types";

export type { AIRequest, AIResult, AnswerFailure, ImageRequest, ImageResult, ImageTransport, Part, Prompt, Transport } from "./types";
export { ProviderHttpError } from "./types";
export { manualTransport } from "./manual";
export { openRouterImageTransport } from "./openai-compatible";

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  anthropic: "Anthropic",
  openrouter: FLAVORS.openrouter.label,
  deepseek: FLAVORS.deepseek.label,
  compatible: FLAVORS.compatible.label,
  manual: "Manuell (Prompt kopieren)",
};

const CAPS: Record<ProviderId, Capabilities> = {
  anthropic: { images: true, pdf: true },
  openrouter: FLAVORS.openrouter,
  deepseek: FLAVORS.deepseek,
  compatible: FLAVORS.compatible,
  // a chat window has no attachment here: the teacher copies text and pastes text back
  manual: { images: false, pdf: false },
};

/** One transport for all providers: picks the adapter by the request's provider. */
export const providerTransport: Transport = (req) => (req.provider === "manual" ? manualTransport(req) : req.provider === "anthropic" ? anthropicTransport(req) : openAICompatibleTransport(req));

/** Manual needs no key; every other provider is ready when its key (and address) is set. */
export function providerReady(id: ProviderId) {
  return id === "manual" || hasKey(id);
}

/**
 * Der Name eines Budgets auf Mehr › KI-Kosten: „Anthropic“, beim allgemeinen die Anbieter, die es gerade nutzen
 * („(Anbieter: OpenAI-kompatibel)“); nutzt es keiner, die eingerichteten, sonst OpenRouter.
 */
export function budgetName(pool: BudgetPool, genutzt: ProviderId[], bereit: (id: ProviderId) => boolean = providerReady): string {
  if (pool === "anthropic") return "Anthropic";
  const imTopf = (ids: readonly ProviderId[]) => [...new Set(ids)].filter((id) => id !== "manual" && poolOf(id) === pool);
  const namen = imTopf(genutzt).length ? imTopf(genutzt) : imTopf(PROVIDER_IDS.filter((id) => bereit(id)));
  return `(Anbieter: ${(namen.length ? namen : (["openrouter"] as ProviderId[])).map((id) => PROVIDER_LABEL[id]).join(", ")})`;
}

/** Why a provider cannot take this prompt (a photo or PDF it cannot read), or null. */
export function unsupported(id: ProviderId, content: Prompt): string | null {
  if (typeof content === "string") return null;
  const caps = CAPS[id];
  if (content.some((p) => p.type === "pdf") && !caps.pdf) return `${PROVIDER_LABEL[id]} kann keine PDFs lesen.`;
  if (content.some((p) => p.type === "image") && !caps.images) return `${PROVIDER_LABEL[id]} kann keine Bilder lesen.`;
  return null;
}

/** So viel gespeicherter Text eines PDFs geht höchstens mit (Zeichen), damit ein dickes Skript die Anfrage nicht sprengt. */
export const PDF_TEXT_MAX = 30_000;

/**
 * **Ein PDF hält die anderen Dateien nicht mehr auf** (F0b, Phase-E-Bericht): ein Anbieter ohne PDF (OpenAI-kompatibel, DeepSeek,
 * manuell) bekommt statt jedes PDFs den Text, der darin gespeichert ist (lib/pdf-text.ts, ohne KI). Hat ein PDF keinen (ein Scan),
 * wird nur diese Datei übersprungen, mit einem Hinweis für die Lehrkraft; die übrigen Dateien gehen wie bisher mit. Die Dateien
 * bleiben gezählt wie die Lehrkraft sie gewählt hat („Datei 2“), damit die Nummern der Antwort passen.
 * `nichtsLesbar`: es waren Dateien dabei, aber keine ist lesbar geblieben. Ohne PDF oder bei einem Anbieter, der PDFs liest, bleibt
 * der Prompt, wie er ist.
 */
export function pdfAlsText(id: ProviderId, content: Prompt): { content: Prompt; hinweise: string[]; nichtsLesbar: boolean } {
  if (typeof content === "string" || CAPS[id].pdf || !content.some((p) => p.type === "pdf")) return { content, hinweise: [], nichtsLesbar: false };
  const hinweise: string[] = [];
  let datei = 0;
  let lesbar = 0;
  const neu: Part[] = content.map((p): Part => {
    if (p.type === "text") return p;
    datei += 1;
    if (p.type === "image") {
      lesbar += 1;
      return p;
    }
    let text = "";
    try {
      text = liesPdfText(Buffer.from(p.base64, "base64")).zeilen.join("\n").trim();
    } catch {
      text = "";
    }
    if (!text) {
      hinweise.push(`Datei ${datei} (PDF) übersprungen: darin ist kein Text gespeichert, und die eingestellte KI liest keine PDFs.${CAPS[id].images ? " Als Foto hochladen, dann geht es." : ""}`);
      return { type: "text", text: `Datei ${datei}: übersprungen (ein PDF ohne gespeicherten Text).` };
    }
    lesbar += 1;
    const gekuerzt = text.length > PDF_TEXT_MAX;
    return { type: "text", text: `Datei ${datei} (PDF, nur der darin gespeicherte Text${gekuerzt ? ", gekürzt" : ""}):\n${gekuerzt ? text.slice(0, PDF_TEXT_MAX) : text}` };
  });
  return { content: neu, hinweise, nichtsLesbar: lesbar === 0 };
}

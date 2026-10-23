/** The provider adapters behind the router. Adding a provider: an adapter here and its id in config. */
import { hasKey, type ProviderId } from "../config";
import { anthropicTransport } from "./anthropic";
import { manualTransport } from "./manual";
import { FLAVORS, openAICompatibleTransport } from "./openai-compatible";
import type { Capabilities, Prompt, Transport } from "./types";

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

/** Why a provider cannot take this prompt (a photo or PDF it cannot read), or null. */
export function unsupported(id: ProviderId, content: Prompt): string | null {
  if (typeof content === "string") return null;
  const caps = CAPS[id];
  if (content.some((p) => p.type === "pdf") && !caps.pdf) return `${PROVIDER_LABEL[id]} kann keine PDFs lesen.`;
  if (content.some((p) => p.type === "image") && !caps.images) return `${PROVIDER_LABEL[id]} kann keine Bilder lesen.`;
  return null;
}

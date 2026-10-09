/**
 * The contract between the router and a provider. Nothing here belongs to one vendor: the router and
 * the app's KI functions only ever speak in these types; each adapter translates them for its API.
 */
import type { z } from "zod";
import type { AIFunction, ProviderId, Usage } from "../config";

/** Content of the user turn besides plain text: a photo or a PDF of uploaded material. */
export type Part = { type: "text"; text: string } | { type: "image"; mime: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; base64: string } | { type: "pdf"; base64: string };
export type Prompt = string | Part[];

export type AIRequest = {
  fn: AIFunction;
  provider: ProviderId;
  model: string;
  maxTokens: number;
  /** instructions; the same for every request of a function, so it is what gets cached */
  system: string;
  /** prompt caching of the system prompt where the provider supports it */
  cache: "aus" | "5m" | "1h";
  content: Prompt;
  /** "aus": answer directly; "adaptiv": the model may think first */
  thinking: "aus" | "adaptiv";
  effort: "low" | "medium" | "high";
  /** the answer must match this schema; adapters return null when it does not */
  schema: z.ZodType;
  /** the schema goes into the instructions even where the model takes json_schema (see FunctionSpec) */
  schemaInPrompt?: boolean;
  signal: AbortSignal;
  timeoutMs: number;
};

export type AIResult = {
  parsed: unknown;
  refusal: boolean;
  /** the model that answered, as the provider names it */
  model: string;
  usage: Usage;
  /** the provider's own price for this request, when it reports one (OpenRouter does) */
  costUsd?: number;
  /** used by the simulation instead of measured time */
  simulatedMs?: number;
  /** what was wrong with the answer (cut off, wrong shape, entries dropped), without its content */
  problem?: string;
};

export type Transport = (req: AIRequest) => Promise<AIResult>;

/** What a provider can read besides text. */
export type Capabilities = { images: boolean; pdf: boolean };

// The KI of the app. Every request goes through ./router (models, limits, budget, cost log).
export * from "./features";
// Banken: die Anweisungen aus Artikel Trainer/AI_prompts.md in Bankform (Phase 1, Schritt 6).
export * from "./banken";
export { aiEnabled, type AIMeta } from "./router";

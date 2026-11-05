import assert from "node:assert/strict";
import test from "node:test";
import { umleitungZurApp } from "./alte-adresse";

const env = { PUBLIC_URL: "https://dreamstudy.at", RAILWAY_PUBLIC_DOMAIN: "nachhilfe-software-production.up.railway.app" };
const alt = "nachhilfe-software-production.up.railway.app";

test("old Railway address goes to PUBLIC_URL with path and query", () => {
  assert.equal(umleitungZurApp({ host: alt, pfad: "/geraet", suche: "" }, env), "https://dreamstudy.at/geraet");
  assert.equal(umleitungZurApp({ host: `${alt}:443`, pfad: "/lernen/abc", suche: "?x=1" }, env), "https://dreamstudy.at/lernen/abc?x=1");
});

test("no redirect on the app's own or the presentation address, for /health, or without PUBLIC_URL", () => {
  assert.equal(umleitungZurApp({ host: "dreamstudy.at", pfad: "/geraet", suche: "" }, env), null);
  assert.equal(umleitungZurApp({ host: "folien.dreamstudy.at", pfad: "/deck/t/index.html", suche: "" }, env), null);
  assert.equal(umleitungZurApp({ host: alt, pfad: "/health", suche: "" }, env), null);
  assert.equal(umleitungZurApp({ host: alt, pfad: "/geraet", suche: "" }, {}), null);
  assert.equal(umleitungZurApp({ host: alt, pfad: "/geraet", suche: "" }, { PUBLIC_URL: `https://${alt}` }), null);
  assert.equal(umleitungZurApp({ host: "localhost:3000", pfad: "/", suche: "" }, env), null);
});

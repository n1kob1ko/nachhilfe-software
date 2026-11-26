import { test } from "node:test";
import assert from "node:assert/strict";
import { versatzUnten } from "./unten-fest";

test("normal: sichtbarer Bereich = Layout, kein Versatz", () => {
  assert.equal(versatzUnten({ offsetTop: 0, height: 932, scale: 1 }, 932, false), 0);
  assert.equal(versatzUnten({ offsetTop: 0, height: 931.6, scale: 1 }, 932, false), 0);
});

test("iOS 26: sichtbarer Bereich verschoben, Leiste muss nach", () => {
  // Leiste hängt 340 px über dem unteren Rand → 340 px nach unten
  assert.equal(versatzUnten({ offsetTop: 340, height: 932, scale: 1 }, 932, false), 340);
  // sichtbarer Bereich kürzer als das Layout → nach oben
  assert.equal(versatzUnten({ offsetTop: 0, height: 908, scale: 1 }, 932, false), -24);
});

test("beim Schreiben und beim Zoomen nichts schieben", () => {
  assert.equal(versatzUnten({ offsetTop: 0, height: 600, scale: 1 }, 932, true), 0);
  assert.equal(versatzUnten({ offsetTop: 200, height: 400, scale: 2 }, 932, false), 0);
});

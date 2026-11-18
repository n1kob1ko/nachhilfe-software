import { test } from "node:test";
import assert from "node:assert/strict";
import { stimmung } from "./blockwerk-stimmung";

const ruhig = { lage: "spiel", zielen: false, fieber: false, fuellung: 0.2 } as const;

test("Maskottchen: ruhig, wenn nichts los ist", () => {
  assert.equal(stimmung(ruhig), "ruhig");
});

test("Maskottchen: Spielende geht vor allem", () => {
  assert.equal(stimmung({ ...ruhig, lage: "aus", ansage: "frei", zielen: true }), "traurig");
});

test("Maskottchen: Blitz, Staunen, Jubel nach der Ansage", () => {
  assert.equal(stimmung({ ...ruhig, ansage: "blitz" }), "blitz");
  assert.equal(stimmung({ ...ruhig, zielen: true }), "blitz");
  assert.equal(stimmung({ ...ruhig, ansage: "frei" }), "staunt");
  assert.equal(stimmung({ ...ruhig, ansage: "fieber" }), "staunt");
  assert.equal(stimmung({ ...ruhig, ansage: "lob" }), "staunt");
  assert.equal(stimmung({ ...ruhig, ansage: "punkte", fuellung: 0.9 }), "jubel");
  assert.equal(stimmung({ ...ruhig, ansage: "kombo" }), "jubel");
});

test("Maskottchen: nervös, wenn das Brett voll wird oder nichts passt", () => {
  assert.equal(stimmung({ ...ruhig, fuellung: 0.6 }), "nervoes");
  assert.equal(stimmung({ ...ruhig, fuellung: 0.59 }), "ruhig");
  assert.equal(stimmung({ ...ruhig, lage: "eng" }), "nervoes");
  assert.equal(stimmung({ ...ruhig, ansage: "schutt" }), "nervoes");
  assert.equal(stimmung({ ...ruhig, fuellung: 0.7, fieber: true }), "nervoes");
});

test("Maskottchen: im Fieber freut es sich", () => {
  assert.equal(stimmung({ ...ruhig, fieber: true }), "jubel");
});

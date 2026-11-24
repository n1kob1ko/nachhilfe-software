/**
 * Baut die Österreich-Karte (lib/oesterreich-karte.ts) für das Lernspiel „Österreich erobern“ (lib/oesterreich.ts).
 * Nur nötig, wenn sich die Karte ändern soll; das Ergebnis liegt im Repo.
 *
 * Quelle: Bundesländer und Bezirke 2021 von Statistik Austria (data.statistik.gv.at, CC BY 4.0), vereinfacht von
 * Flooh Perlot (github.com/ginseng666/GeoJSON-TopoJSON-Austria, CC BY 4.0).
 *
 *   mkdir /tmp/geo-at && cd /tmp/geo-at
 *   B=https://raw.githubusercontent.com/ginseng666/GeoJSON-TopoJSON-Austria/master/2021/simplified-99.5
 *   curl -O $B/laender_995_geo.json -O $B/bezirke_995_geo.json
 *   mkdir mods && cd mods && npm init -y && npm i d3-geo@3 topojson-client@3 topojson-server@3
 *   GEO_DATEN=/tmp/geo-at GEO_MODULE=/tmp/geo-at/mods/node_modules node scripts/oesterreich-karte.mjs
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const M = process.env.GEO_MODULE;
const D = process.env.GEO_DATEN;
if (!M || !D) throw new Error("GEO_MODULE und GEO_DATEN fehlen");
const require = createRequire(path.join(M, "x.js"));
const d3 = require("d3-geo");
const tc = require("topojson-client");
const tsrv = require("topojson-server");

const laender = JSON.parse(fs.readFileSync(path.join(D, "laender_995_geo.json"), "utf8"));
const bezirke = JSON.parse(fs.readFileSync(path.join(D, "bezirke_995_geo.json"), "utf8"));
// Wien als ein Bezirk (900), nicht in 23 Gemeindebezirken
bezirke.features = bezirke.features.filter((f) => !/^9\d\d$/.test(f.properties.iso) || f.properties.iso === "900");

// Kennziffer → Kürzel im Spiel
const ID = { 1: "b", 2: "k", 3: "n", 4: "o", 5: "s", 6: "st", 7: "t", 8: "v", 9: "w" };

const W = 1000;
const proj = d3.geoConicConformal().parallels([46, 49]).rotate([-13.33, 0]).center([0, 47.5]);
proj.fitWidth(W - 16, laender);
const [[x0, y0], [x1, y1]] = d3.geoPath(proj).bounds(laender);
proj.translate([proj.translate()[0] - x0 + 8, proj.translate()[1] - y0 + 8]);
const H = Math.ceil(y1 - y0 + 16);
const pfad = d3.geoPath(proj).digits(1);
const punkt = (lon, lat) => proj([lon, lat]).map((v) => Math.round(v * 10) / 10);

// d3 will Ringe im Uhrzeigersinn; die Daten sind andersherum (wie GeoJSON nach RFC 7946)
const dreh = (f) => {
  const g = f.geometry;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  const neu = polys.map((p) => p.map((r) => r.slice().reverse()));
  return { ...f, geometry: { type: "MultiPolygon", coordinates: neu } };
};
const probe = d3.geoArea(laender.features[0]);
const umdrehen = probe > 2 * Math.PI;

const land = {};
for (const f0 of laender.features) {
  const f = umdrehen ? dreh(f0) : f0;
  const id = ID[f.properties.iso];
  if (!id) throw new Error(`unbekannt: ${f.properties.iso}`);
  land[id] = { d: pfad(f), mitte: pfad.centroid(f).map((v) => Math.round(v)) };
}

const bz = { ...bezirke, features: bezirke.features.map((f) => (umdrehen ? dreh(f) : f)) };
const topo = tsrv.topology({ b: bz });
// nur die Grenzen zwischen Bezirken desselben Bundeslandes (die Landesgrenzen zeichnet das Spiel dicker)
const innen = tc.mesh(topo, topo.objects.b, (a, b) => a !== b && a.properties.iso[0] === b.properties.iso[0]);
const bezirksgrenzen = pfad(innen);
const bezirkMitte = (name) => {
  const f = bz.features.find((x) => x.properties.name === name);
  if (!f) throw new Error(`Bezirk fehlt: ${name}`);
  return pfad.centroid(f).map((v) => Math.round(v));
};

const STAEDTE = {
  w: [16.373, 48.208],
  n: [15.626, 48.204],
  o: [14.286, 48.306],
  b: [16.525, 47.846],
  st: [15.439, 47.071],
  k: [14.305, 46.624],
  s: [13.055, 47.809],
  t: [11.393, 47.269],
  v: [9.747, 47.505],
};
const staedte = Object.fromEntries(Object.entries(STAEDTE).map(([id, [lon, lat]]) => [id, punkt(lon, lat)]));

// die Autokennzeichen aus dem Buch (M10): Klosterneuburg ist eine Stadt im Bezirk Tulln, der Rest sind Bezirke
const kennzeichen = { kg: punkt(16.325, 48.305), wo: bezirkMitte("Wolfsberg"), mu: bezirkMitte("Murau"), re: bezirkMitte("Reutte") };

const ziel = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../lib/oesterreich-karte.ts");
const text = `// Erzeugt von scripts/oesterreich-karte.mjs, nicht von Hand ändern.
// Grenzen: Statistik Austria 2021 (data.statistik.gv.at, CC BY 4.0), vereinfacht von Flooh Perlot (CC BY 4.0).

export const KARTE_BREITE = ${W};
export const KARTE_HOEHE = ${H};

/** Je Bundesland (Kürzel wie in lib/oesterreich.ts): SVG-Pfad und Mitte. */
export const LAND_PFADE: Record<string, { d: string; mitte: [number, number] }> = ${JSON.stringify(land)};

/** Die Grenzen der Bezirke innerhalb der Bundesländer (ein Pfad, dünn zu zeichnen). */
export const BEZIRKSGRENZEN = ${JSON.stringify(bezirksgrenzen)};

/** Die Landeshauptstädte (Kürzel des Bundeslandes) als Punkt auf der Karte. */
export const STADT_ORTE: Record<string, [number, number]> = ${JSON.stringify(staedte)};

/** Die Autokennzeichen aus dem Buch (M10) als Punkt auf der Karte. */
export const KENNZEICHEN_ORTE: Record<string, [number, number]> = ${JSON.stringify(kennzeichen)};
`;
fs.writeFileSync(ziel, text);
console.log(`geschrieben: ${ziel} (${Math.round(text.length / 1024)} KB, ${W}×${H})`);

/**
 * Baut die Europakarte (lib/europa-karte.ts) und die Flaggen (public/spiele/europa/flaggen/) für das Lernspiel
 * „Europa“ (lib/europa.ts). Nur nötig, wenn sich Karte oder Flaggen ändern sollen; das Ergebnis liegt im Repo.
 *
 * Quellen: Natural Earth 1:50 Mio. über das Paket world-atlas (gemeinfrei), Flaggen aus flag-icons (MIT).
 * Die Krim gehört zur Ukraine und Nordzypern zu Zypern (wie im Schulatlas; Natural Earth zeichnet es anders).
 *
 *   mkdir /tmp/geo && cd /tmp/geo && npm init -y && npm i world-atlas@2 flag-icons@7 d3-geo@3 topojson-client@3 \
 *     topojson-simplify@3 polygon-clipping@0.15 svgo@3 sharp
 *   GEO_MODULE=/tmp/geo/node_modules node scripts/europa-karte.mjs
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const M = process.env.GEO_MODULE;
if (!M) throw new Error("GEO_MODULE fehlt (Ordner node_modules mit world-atlas usw.)");
const require = createRequire(path.join(M, "x.js"));
const t = require("world-atlas/countries-50m.json");
const tc = require("topojson-client");
const ts = require("topojson-simplify");
const d3 = require("d3-geo");
const pc = require("polygon-clipping");
const { optimize } = require("svgo");
const sharp = require("sharp");

const wurzel = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const quelle = fs.readFileSync(path.join(wurzel, "lib/europa.ts"), "utf8");
// Kürzel und Hauptstadt-Ort aus lib/europa.ts
const orte = Object.fromEntries([...quelle.matchAll(/code: "([a-z]{2})".*?ort: \[(-?[\d.]+), (-?[\d.]+)\]/g)].map((m) => [m[1], [Number(m[2]), Number(m[3])]]));

const NE = { al: "Albania", ad: "Andorra", be: "Belgium", ba: "Bosnia and Herz.", bg: "Bulgaria", dk: "Denmark", de: "Germany", ee: "Estonia", fi: "Finland", fr: "France", gr: "Greece", ie: "Ireland", is: "Iceland", it: "Italy", xk: "Kosovo", hr: "Croatia", lv: "Latvia", li: "Liechtenstein", lt: "Lithuania", lu: "Luxembourg", mt: "Malta", md: "Moldova", mc: "Monaco", me: "Montenegro", nl: "Netherlands", mk: "Macedonia", no: "Norway", at: "Austria", pl: "Poland", pt: "Portugal", ro: "Romania", ru: "Russia", sm: "San Marino", se: "Sweden", ch: "Switzerland", rs: "Serbia", sk: "Slovakia", si: "Slovenia", es: "Spain", cz: "Czechia", tr: "Turkey", ua: "Ukraine", hu: "Hungary", va: "Vatican", gb: "United Kingdom", by: "Belarus", cy: "Cyprus" };
if (Object.keys(orte).length !== Object.keys(NE).length) throw new Error(`lib/europa.ts: ${Object.keys(orte).length} Orte statt ${Object.keys(NE).length}`);

let topo = ts.presimplify(t, ts.sphericalTriangleArea);
topo = ts.simplify(topo, 4e-7);
const fc = tc.feature(topo, topo.objects.countries);
// sehr kleine Länder nicht vereinfachen (sonst verschwinden sie)
const roh = tc.feature(t, t.objects.countries);
const KLEIN = ["Malta", "Andorra", "Monaco", "San Marino", "Vatican", "Liechtenstein", "Luxembourg"];
for (const f of fc.features) if (KLEIN.includes(f.properties.name)) f.geometry = roh.features.find((g) => g.properties.name === f.properties.name).geometry;
const byName = new Map(fc.features.map((f) => [f.properties.name, f]));

const W = 1000, H = 820;
const proj = d3.geoConicConformal().parallels([40, 62]).rotate([-14, 0]).center([0, 53]);
proj.fitExtent([[6, 6], [W - 6, H - 6]], { type: "MultiPoint", coordinates: [[-23, 63], [-10, 36], [14.4, 35.5], [33, 34.6], [44, 40], [48, 66], [27, 71], [-24, 66], [5, 71.5]] });
// gezeichnet wird weit über den Rahmen hinaus: auf hohen oder breiten Schirmen sieht man dann echtes Land statt einer Kante
proj.clipExtent([[-150, -400], [W + 150, H + 400]]);
const pfad = d3.geoPath(proj).digits(1);

const geom = (f) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates);
const ru = byName.get("Russia"), ua = byName.get("Ukraine");
const krim = geom(ru).filter((poly) => d3.geoContains({ type: "Polygon", coordinates: poly }, [34.1, 44.95]));
ru.geometry = { type: "MultiPolygon", coordinates: geom(ru).filter((poly) => !krim.includes(poly)) };
ua.geometry = { type: "MultiPolygon", coordinates: pc.union(geom(ua), ...krim) };
const cy = byName.get("Cyprus");
cy.geometry = { type: "MultiPolygon", coordinates: pc.union(geom(cy), geom(byName.get("N. Cyprus"))) };
// polygon-clipping liefert Ringe gegen den Uhrzeigersinn, d3 (auf der Kugel) will sie andersherum
for (const f of [ua, cy]) f.geometry.coordinates = f.geometry.coordinates.map((p) => p.map((r) => r.slice().reverse()));

const r1 = (n) => Math.round(n * 10) / 10;
const laender = {}, mitte = {}, stadt = {};
for (const [code, nm] of Object.entries(NE)) {
  const f = byName.get(nm);
  if (!f) throw new Error(nm);
  laender[code] = pfad(f);
  if (!laender[code]) throw new Error(`leer: ${code}`);
  const groesste = geom(f).map((p) => ({ type: "Polygon", coordinates: p })).sort((a, b) => d3.geoArea(b) - d3.geoArea(a))[0];
  mitte[code] = pfad.centroid(groesste).map(r1);
  stadt[code] = proj(orte[code]).map(r1);
}
// das Land drumherum ist nur Kulisse: gröber vereinfacht
const grob = tc.feature(ts.simplify(ts.presimplify(t, ts.sphericalTriangleArea), 3e-6), t.objects.countries);
const umland = grob.features.filter((f) => !Object.values(NE).includes(f.properties.name) && f.properties.name !== "N. Cyprus").map((f) => pfad(f)).filter(Boolean).join("");

const kopf = `/**
 * Die Europakarte für das Lernspiel „Europa“ (lib/europa.ts), erzeugt von scripts/europa-karte.mjs. Nicht von Hand ändern.
 * Natural Earth 1:50 Mio. (gemeinfrei), konforme Kegelprojektion, ${W} × ${H}. Die Krim gehört zur Ukraine.
 * - laender: SVG-Pfad je Land; mitte: Mitte der größten Fläche (für Kreise); stadt: die Hauptstadt; umland: alles andere Land.
 */
`;
const ziel = path.join(wurzel, "lib/europa-karte.ts");
fs.writeFileSync(
  ziel,
  `${kopf}export const KARTE: { breite: number; hoehe: number; laender: Record<string, string>; mitte: Record<string, [number, number]>; stadt: Record<string, [number, number]>; umland: string } = ${JSON.stringify({ breite: W, hoehe: H, laender, mitte, stadt, umland })};\n`,
);
console.log("Karte", fs.statSync(ziel).size, "Bytes");

// Flaggen: einfache als SVG, solche mit Wappen (groß als SVG) als WebP 480 × 360
const flaggenOrdner = path.join(wurzel, "public/spiele/europa/flaggen");
fs.mkdirSync(flaggenOrdner, { recursive: true });
const webp = [];
for (const code of Object.keys(NE)) {
  const src = fs.readFileSync(path.join(M, `flag-icons/flags/4x3/${code}.svg`), "utf8");
  const svg = optimize(src, { multipass: true, floatPrecision: 1 }).data;
  if (svg.length <= 9000) fs.writeFileSync(path.join(flaggenOrdner, `${code}.svg`), svg);
  else {
    fs.writeFileSync(path.join(flaggenOrdner, `${code}.webp`), await sharp(Buffer.from(src), { density: 300 }).resize(480, 360).webp({ quality: 82 }).toBuffer());
    webp.push(code);
  }
}
console.log("Flaggen als WebP (in lib/europa.ts FLAGGE_WEBP eintragen):", webp.join(", "));

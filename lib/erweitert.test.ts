import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/** Erweitert nach Rolle (Audit 2026-11-07): die Lehrkraft sieht oben nur ihre Arbeit, nichts fehlt, nichts doppelt. */
test("Lehrkraft: 8 Kacheln Arbeit, Verwaltungs-Dinge zugeklappt; Verwaltung: eigene Gruppe; jede Adresse genau einmal", async () => {
  const { erweitertGruppen } = await import("./erweitert");
  const z = { offen: 2, offenesFeedback: 1 };
  const lehrkraft = erweitertGruppen({ is_admin: 0 }, z);
  const verwaltung = erweitertGruppen({ is_admin: 1 }, z);
  const hrefs = (g: ReturnType<typeof erweitertGruppen>) => g.flatMap((x) => x.items.map((i) => i.href));
  const offen = (g: ReturnType<typeof erweitertGruppen>) => g.filter((x) => !x.zu).flatMap((x) => x.items.map((i) => i.href));

  assert.deepEqual(lehrkraft.map((g) => g.title), ["Arbeit", "Konto", "Alles Weitere"]);
  assert.equal(lehrkraft[0].items.length, 8);
  assert.equal(lehrkraft[0].items.find((i) => i.href === "/lehrer")?.label, "Meine Verfügbarkeit");
  for (const href of ["/mehr/raeume", "/mehr/lehrplan", "/mehr/ki-kosten", "/mehr/statistik", "/planung", "/abrechnung"]) {
    assert.ok(!offen(lehrkraft).includes(href), `${href} steht bei der Lehrkraft nicht oben`);
    assert.ok(hrefs(lehrkraft).includes(href), `${href} bleibt erreichbar`);
  }
  assert.equal(lehrkraft[0].items.find((i) => i.href === "/mehr/uebersicht#offen")?.hint, "2 offen: Prüfungen, Ergebnisse, Hausübungen, Texte");

  assert.deepEqual(verwaltung.map((g) => g.title), ["Arbeit", "Verwaltung", "Unterricht und Material", "Konto"]);
  assert.ok(verwaltung[1].items.map((i) => i.href).includes("/mehr/raeume"));
  assert.ok(offen(verwaltung).includes("/planung"));
  assert.equal(verwaltung[1].items.find((i) => i.href === "/mehr/feedback")?.hint, "1 offen. Was Lehrkräfte melden: lesen, abhaken, weitergeben");

  for (const g of [lehrkraft, verwaltung]) assert.equal(new Set(hrefs(g)).size, hrefs(g).length, "keine Adresse doppelt");
  // dieselben Seiten für beide, bis auf Export und Import (nur Verwaltung)
  const nurVerwaltung = hrefs(verwaltung).filter((h) => !hrefs(lehrkraft).includes(h)).sort();
  assert.deepEqual(nurVerwaltung, ["/export", "/mehr/import"]);
  assert.deepEqual(hrefs(lehrkraft).filter((h) => !hrefs(verwaltung).includes(h)), []);
  assert.equal(hrefs(verwaltung).length, 28);
});

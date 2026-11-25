/**
 * Eigene Tests (niko 2026-11-22: „ich möchte das auf der nachhilfe software für max haben“): ein fertiger Test, den die
 * Lehrkraft außerhalb der App gebaut hat (hier ein claude.ai-Artifact), als Seite der Schüler-App. Die Lehrkraft schaltet
 * ihn je Schüler frei; der Schüler macht ihn einmal ganz, gibt ab und sieht Punkte, Lösungen und eine Note zur
 * Orientierung. Offene Fragen bewertet er mit der Musterlösung selbst, die Lehrkraft kann die Punkte ändern.
 *
 * Diese Datei hat keine Datenbank: Fragen, Ansicht ohne Lösungen, Bewertung und Note. Speichern und Freigeben stehen in
 * lib/eigene-tests-speicher.ts, die Tests selbst in lib/eigene-tests/ (Liste: lib/eigene-tests-liste.ts, nur am Server, damit
 * keine Lösung im Browser landet). Der Server prüft, der Browser bekommt die Lösungen erst nach dem Abgeben. Mehr in
 * docs/eigene-tests.md.
 */

/**
 * Eine Frage. Punkte: je Zeile bzw. Lücke 1, Multiple Choice 1, Mehrfachwahl je richtige 1, offene Fragen `punkte`.
 * Bei Auswahl, Richtig/Falsch, Lückentext und Multiple Choice setzt `punkte` die Punkte der ganzen Frage anders (Chemie:
 * sechs Aussagen zu je 0,5 P.); sie teilen sich dann gleich auf die Zeilen bzw. Lücken auf.
 */
export type Frage =
  /** je Zeile eine Auswahl aus `optionen`; items: [Zeile, richtige Option] */
  | { id: string; art: "auswahl"; titel: string; optionen: string[]; items: [string, string][]; punkte?: number; bild?: boolean }
  /** eine richtige Antwort (Index in optionen) */
  | { id: string; art: "mc"; titel: string; optionen: string[]; richtig: number; punkte?: number; bild?: boolean }
  /** mehrere richtige; jede falsch angekreuzte zieht einen Punkt ab (nie unter 0) */
  | { id: string; art: "mehrfach"; titel: string; optionen: string[]; richtige: number[]; bild?: boolean }
  /** je Aussage richtig (true) oder falsch */
  | { id: string; art: "rf"; titel: string; items: [string, boolean][]; punkte?: number; bild?: boolean }
  /** Lückentext: {0}, {1} … im Text; je Lücke die erlaubten Antworten (die erste ist die Lösung) */
  | { id: string; art: "luecken"; titel: string; text: string; luecken: string[][]; punkte?: number; bild?: boolean }
  /** offene Antwort mit Musterlösung (**fett** für die Schlüsselwörter); bewertet erst der Schüler, dann die Lehrkraft */
  | { id: string; art: "offen"; titel: string; punkte: number; muster: string; bild?: boolean };

export type Teil = { id: string; titel: string; fragen: Frage[] };

export type EigenerTest = {
  key: string;
  titel: string;
  untertitel?: string;
  /** Fach wie im Profil („Geografie“) */
  fach: string;
  sprache: "de" | "en";
  /** empfohlene Zeit in Minuten */
  minuten: number;
  /**
   * Notenschlüssel in Punkten, wie auf dem Blatt: ab wie vielen Punkten Sehr gut, Gut, Befriedigend, Genügend. Ohne ihn
   * gelten 89 / 76 / 63 / 50 % (wie im Europe-Artifact).
   */
  notenschluessel?: [number, number, number, number];
  /** ein Bild zu den Fragen mit `bild: true` (Karte), aus public/ */
  bild?: { src: string; alt: string; breite: number; hoehe: number };
  teile: Teil[];
};

export function maxPunkte(f: Frage): number {
  switch (f.art) {
    case "auswahl":
    case "rf":
      return f.punkte ?? f.items.length;
    case "luecken":
      return f.punkte ?? f.luecken.length;
    case "mehrfach":
      return f.richtige.length;
    case "offen":
      return f.punkte;
    default:
      return f.punkte ?? 1;
  }
}

/** Punkte zum Anzeigen: ganze Zahlen wie sie sind, halbe mit Komma („1,5“). */
export const punkteZahl = (p: number) => (Number.isInteger(p) ? String(p) : String(Math.round(p * 100) / 100).replace(".", ","));
export const teilPunkte = (t: Teil) => t.fragen.reduce((s, f) => s + maxPunkte(f), 0);
export const gesamtPunkte = (t: EigenerTest) => t.teile.reduce((s, x) => s + teilPunkte(x), 0);
export const alleFragen = (t: EigenerTest) => t.teile.flatMap((x) => x.fragen);

// ---------- Ansicht für den Schüler: ohne Lösungen ----------

export type FrageAnsicht =
  | { id: string; art: "auswahl"; titel: string; punkte: number; bild: boolean; optionen: string[]; zeilen: string[] }
  | { id: string; art: "mc" | "mehrfach"; titel: string; punkte: number; bild: boolean; optionen: string[] }
  | { id: string; art: "rf"; titel: string; punkte: number; bild: boolean; zeilen: string[] }
  /** der Text in Stücken: Text, Lücke, Text, Lücke … (immer ein Text mehr als Lücken) */
  | { id: string; art: "luecken"; titel: string; punkte: number; bild: boolean; stuecke: string[] }
  | { id: string; art: "offen"; titel: string; punkte: number; bild: boolean };

export type TestAnsicht = Omit<EigenerTest, "teile"> & { gesamt: number; teile: { id: string; titel: string; punkte: number; fragen: FrageAnsicht[] }[] };

/** Der Text eines Lückentexts zerlegt: Stücke zwischen den Lücken {0}, {1} … in ihrer Reihenfolge. */
export function lueckenStuecke(text: string, anzahl: number): string[] {
  const stuecke: string[] = [];
  let rest = text;
  for (let i = 0; i < anzahl; i++) {
    const marke = `{${i}}`;
    const at = rest.indexOf(marke);
    if (at < 0) throw new Error(`Lücke ${marke} fehlt im Text.`);
    stuecke.push(rest.slice(0, at));
    rest = rest.slice(at + marke.length);
  }
  stuecke.push(rest);
  return stuecke;
}

function ansichtVon(f: Frage): FrageAnsicht {
  const basis = { id: f.id, titel: f.titel, punkte: maxPunkte(f), bild: Boolean(f.bild) };
  switch (f.art) {
    case "auswahl":
      return { ...basis, art: "auswahl", optionen: f.optionen, zeilen: f.items.map(([z]) => z) };
    case "mc":
    case "mehrfach":
      return { ...basis, art: f.art, optionen: f.optionen };
    case "rf":
      return { ...basis, art: "rf", zeilen: f.items.map(([z]) => z) };
    case "luecken":
      return { ...basis, art: "luecken", stuecke: lueckenStuecke(f.text, f.luecken.length) };
    case "offen":
      return { ...basis, art: "offen" };
  }
}

/** Was der Browser vor dem Abgeben bekommt: alles außer den Lösungen. */
export function testAnsicht(t: EigenerTest): TestAnsicht {
  return { ...t, gesamt: gesamtPunkte(t), teile: t.teile.map((x) => ({ id: x.id, titel: x.titel, punkte: teilPunkte(x), fragen: x.fragen.map(ansichtVon) })) };
}

// ---------- Antworten und Bewertung ----------

/**
 * Die Antwort des Schülers je Frage: auswahl Texte je Zeile („“ = keine), mc ein Index oder null, mehrfach die
 * angekreuzten Indizes, rf je Aussage true/false/null, luecken Texte je Lücke, offen der Text.
 */
export type Antwort = string[] | number | null | number[] | (boolean | null)[] | string;
export type Antworten = Record<string, Antwort>;

/** Wie im Artifact: Groß/klein, Akzente, Leerzeichen und Satzzeichen (außer . und , in Zahlen) zählen nicht. */
export function normLuecke(s: string): string {
  return String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.,]/g, "")
    .replace(/[.,]$/, "");
}

export type ZeilenErgebnis = { richtig: boolean; loesung: string; gegeben: string };
export type FrageErgebnis = {
  id: string;
  art: Frage["art"];
  max: number;
  /** null: offene Frage, noch nicht bewertet */
  punkte: number | null;
  /** auswahl, rf, luecken: je Zeile bzw. Lücke */
  zeilen?: ZeilenErgebnis[];
  /** mc: die gewählte und die richtige Option */
  gewaehlt?: number[];
  richtige?: number[];
  /** mehrfach: falsch angekreuzte ziehen ab */
  falschAngekreuzt?: number;
  /** offen: was der Schüler geschrieben hat und die Musterlösung */
  text?: string;
  muster?: string;
};

const alsText = (x: unknown) => (typeof x === "string" ? x : "");
const alsListe = <T,>(x: unknown, n: number, f: (v: unknown) => T): T[] => Array.from({ length: n }, (_, i) => f(Array.isArray(x) ? x[i] : undefined));
/** Die Knöpfe bei Richtig/Falsch in der Sprache des Tests. */
export const rfWorte = (sprache: "de" | "en") => (sprache === "de" ? (["Richtig", "Falsch"] as const) : (["True", "False"] as const));
const rfText = (b: boolean | null, sprache: "de" | "en") => (b === true ? rfWorte(sprache)[0] : b === false ? rfWorte(sprache)[1] : "");
/** Punkte für `richtig` von `n` Zeilen, wenn die Frage `max` Punkte hat (ohne Rundungsrest bei halben Punkten). */
const anteil = (richtig: number, n: number, max: number) => (n === max ? richtig : Math.round(((richtig * max) / n) * 100) / 100);

/** Bewertet eine Frage. Offene Fragen bekommen `bewertet` (Punkte von Schüler oder Lehrkraft) oder bleiben null. */
export function bewerteFrage(f: Frage, antwort: unknown, bewertet?: number | null, sprache: "de" | "en" = "en"): FrageErgebnis {
  const max = maxPunkte(f);
  switch (f.art) {
    case "auswahl": {
      const gegeben = alsListe(antwort, f.items.length, alsText);
      const zeilen = f.items.map(([, loesung], i) => ({ richtig: gegeben[i] === loesung, loesung, gegeben: gegeben[i] }));
      return { id: f.id, art: f.art, max, punkte: anteil(zeilen.filter((z) => z.richtig).length, zeilen.length, max), zeilen };
    }
    case "rf": {
      const gegeben = alsListe(antwort, f.items.length, (v) => (v === true || v === false ? v : null));
      const zeilen = f.items.map(([, wahr], i) => ({ richtig: gegeben[i] === wahr, loesung: rfText(wahr, sprache), gegeben: rfText(gegeben[i], sprache) }));
      return { id: f.id, art: f.art, max, punkte: anteil(zeilen.filter((z) => z.richtig).length, zeilen.length, max), zeilen };
    }
    case "luecken": {
      const gegeben = alsListe(antwort, f.luecken.length, alsText);
      const zeilen = f.luecken.map((erlaubt, i) => {
        const v = normLuecke(gegeben[i]);
        return { richtig: v !== "" && erlaubt.some((a) => normLuecke(a) === v), loesung: erlaubt[0], gegeben: gegeben[i].trim() };
      });
      return { id: f.id, art: f.art, max, punkte: anteil(zeilen.filter((z) => z.richtig).length, zeilen.length, max), zeilen };
    }
    case "mc": {
      const g = typeof antwort === "number" && Number.isInteger(antwort) && antwort >= 0 && antwort < f.optionen.length ? antwort : null;
      return { id: f.id, art: f.art, max, punkte: g === f.richtig ? max : 0, gewaehlt: g === null ? [] : [g], richtige: [f.richtig] };
    }
    case "mehrfach": {
      const g = [...new Set(Array.isArray(antwort) ? antwort.filter((x): x is number => Number.isInteger(x) && x >= 0 && x < f.optionen.length) : [])].sort((a, b) => a - b);
      const richtig = g.filter((x) => f.richtige.includes(x)).length;
      const falsch = g.length - richtig;
      return { id: f.id, art: f.art, max, punkte: Math.max(0, richtig - falsch), gewaehlt: g, richtige: [...f.richtige], falschAngekreuzt: falsch };
    }
    case "offen": {
      const p = typeof bewertet === "number" && Number.isFinite(bewertet) ? Math.min(max, Math.max(0, Math.round(bewertet))) : null;
      return { id: f.id, art: f.art, max, punkte: p, text: alsText(antwort).trim(), muster: f.muster };
    }
  }
}

export type TestErgebnis = {
  fragen: FrageErgebnis[];
  /** Punkte bisher (offene Fragen erst, wenn bewertet) */
  punkte: number;
  gesamt: number;
  /** offene Fragen ohne Bewertung */
  offen: number;
  prozent: number;
  note: string;
  teile: { id: string; titel: string; punkte: number; max: number }[];
};

const NOTEN = ["Sehr gut (1)", "Gut (2)", "Befriedigend (3)", "Genügend (4)", "Nicht genügend (5)"];

/** Note nach dem Notenschlüssel des Tests in Punkten (ab Sehr gut, Gut, Befriedigend, Genügend). */
export function noteNachPunkten(punkte: number, schluessel: [number, number, number, number]): string {
  const i = schluessel.findIndex((ab) => punkte >= ab);
  return NOTEN[i < 0 ? 4 : i];
}

/** Österreichische Note zur Orientierung, wie im Artifact: ab 89 % Sehr gut, 76 % Gut, 63 % Befriedigend, 50 % Genügend. */
export function noteFuer(prozent: number): string {
  if (prozent >= 89) return "Sehr gut (1)";
  if (prozent >= 76) return "Gut (2)";
  if (prozent >= 63) return "Befriedigend (3)";
  if (prozent >= 50) return "Genügend (4)";
  return "Nicht genügend (5)";
}

/** Bewertet den ganzen Test. `offene`: Punkte der offenen Fragen (Lehrkraft vor Schüler, das macht der Aufrufer). */
export function bewerteTest(t: EigenerTest, antworten: Antworten, offene: Record<string, number | null | undefined> = {}): TestErgebnis {
  const fragen: FrageErgebnis[] = [];
  const teile = t.teile.map((x) => {
    let punkte = 0;
    for (const f of x.fragen) {
      const e = bewerteFrage(f, antworten[f.id], offene[f.id], t.sprache);
      fragen.push(e);
      punkte += e.punkte ?? 0;
    }
    return { id: x.id, titel: x.titel, punkte, max: teilPunkte(x) };
  });
  const gesamt = gesamtPunkte(t);
  const punkte = Math.round(teile.reduce((s, x) => s + x.punkte, 0) * 100) / 100;
  const prozent = gesamt ? Math.round((punkte / gesamt) * 100) : 0;
  const note = t.notenschluessel ? noteNachPunkten(punkte, t.notenschluessel) : noteFuer(prozent);
  return { fragen, punkte, gesamt, offen: fragen.filter((f) => f.punkte === null).length, prozent, note, teile };
}

/** Wie viele Antwortfelder leer sind (für „Wirklich abgeben?“), gezählt wie im Artifact. */
export function leereFelder(t: EigenerTest | TestAnsicht, antworten: Antworten): number {
  let n = 0;
  for (const teil of t.teile)
    for (const f of teil.fragen as (Frage | FrageAnsicht)[]) {
      const a = antworten[f.id];
      if (f.art === "auswahl") {
        const zeilen = "zeilen" in f ? f.zeilen.length : f.items.length;
        for (let i = 0; i < zeilen; i++) if (!(Array.isArray(a) && typeof a[i] === "string" && a[i])) n++;
      } else if (f.art === "rf") {
        const zeilen = "zeilen" in f ? f.zeilen.length : f.items.length;
        for (let i = 0; i < zeilen; i++) if (!(Array.isArray(a) && typeof a[i] === "boolean")) n++;
      } else if (f.art === "luecken") {
        const zeilen = "stuecke" in f ? f.stuecke.length - 1 : f.luecken.length;
        for (let i = 0; i < zeilen; i++) if (!(Array.isArray(a) && typeof a[i] === "string" && (a[i] as string).trim())) n++;
      } else if (f.art === "mc") {
        if (typeof a !== "number") n++;
      } else if (f.art === "mehrfach") {
        if (!(Array.isArray(a) && a.length)) n++;
      } else if (f.art === "offen") {
        if (!(typeof a === "string" && a.trim())) n++;
      }
    }
  return n;
}

/**
 * Nimmt nur, was zu den Fragen passt (die Abgabe kommt aus dem Browser): bekannte Fragen, Texte gekürzt, Indizes im
 * Bereich. Was fehlt, ist leer.
 */
export function saubereAntworten(t: EigenerTest, roh: unknown): Antworten {
  const o = roh && typeof roh === "object" ? (roh as Record<string, unknown>) : {};
  const text = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
  const out: Antworten = {};
  for (const f of alleFragen(t)) {
    const a = o[f.id];
    switch (f.art) {
      case "auswahl":
        out[f.id] = alsListe(a, f.items.length, (v) => (typeof v === "string" && f.optionen.includes(v) ? v : ""));
        break;
      case "rf":
        out[f.id] = alsListe(a, f.items.length, (v) => (v === true || v === false ? v : null));
        break;
      case "luecken":
        out[f.id] = alsListe(a, f.luecken.length, (v) => text(v, 80));
        break;
      case "mc":
        out[f.id] = typeof a === "number" && Number.isInteger(a) && a >= 0 && a < f.optionen.length ? a : null;
        break;
      case "mehrfach":
        out[f.id] = [...new Set(Array.isArray(a) ? a.filter((x): x is number => Number.isInteger(x) && x >= 0 && x < f.optionen.length) : [])].sort((x, y) => x - y);
        break;
      case "offen":
        out[f.id] = text(a, 4000);
        break;
    }
  }
  return out;
}

/** Prüft einen Test beim Laden (Tests in lib/eigene-tests.test.ts): eindeutige Ids, Lösungen unter den Optionen, Lücken im Text. */
export function pruefeTest(t: EigenerTest): string[] {
  const fehler: string[] = [];
  const ids = new Set<string>();
  for (const f of alleFragen(t)) {
    if (ids.has(f.id)) fehler.push(`${f.id}: doppelt`);
    ids.add(f.id);
    if (f.art === "auswahl") for (const [z, l] of f.items) if (!f.optionen.includes(l)) fehler.push(`${f.id}: „${l}“ (${z}) ist keine Option`);
    if (f.art === "mc" && !(f.richtig >= 0 && f.richtig < f.optionen.length)) fehler.push(`${f.id}: richtige Antwort fehlt`);
    if (f.art === "mehrfach" && f.richtige.some((i) => !(i >= 0 && i < f.optionen.length))) fehler.push(`${f.id}: richtige Antwort fehlt`);
    if (f.art === "luecken") {
      try {
        lueckenStuecke(f.text, f.luecken.length);
      } catch (e) {
        fehler.push(`${f.id}: ${(e as Error).message}`);
      }
      if (f.text.includes(`{${f.luecken.length}}`)) fehler.push(`${f.id}: mehr Lücken im Text als Lösungen`);
      if (f.luecken.some((l) => !l.length)) fehler.push(`${f.id}: Lücke ohne Lösung`);
    }
    if (f.bild && !t.bild) fehler.push(`${f.id}: Bild fehlt im Test`);
    if (f.art !== "offen" && f.art !== "mehrfach" && f.punkte !== undefined && !(f.punkte > 0)) fehler.push(`${f.id}: Punkte müssen über 0 sein`);
  }
  if (t.notenschluessel) {
    const [a, b, c, d] = t.notenschluessel;
    if (!(a > b && b > c && c > d && d > 0 && a <= gesamtPunkte(t))) fehler.push("Notenschlüssel: Punkte müssen absteigen und zum Test passen");
  }
  return fehler;
}

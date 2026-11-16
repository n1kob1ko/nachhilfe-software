/**
 * Die Wörter von Wortschloss (lib/wortschloss.ts): je Thema ein Hinweis und das Wort dazu, ohne KI. Das Wort muss sich
 * tippen lassen (nur Buchstaben, 3 bis 10) und eindeutig sein: „trinken · Präteritum“ ist „trank“, nicht auch „tranken“.
 * Welche Themen ein Schüler bekommt, steht in lib/lernspiele.ts (`wortThemen`); hier steht nur Reines.
 */
import { MEHRZAHL, MZ_TIPP } from "./deutsch-mehr";
import { VERBEN } from "./deutsch-woerter";
import { UNREGELMAESSIG } from "./glasklar-themen";
import { IRREGULAR_SKILL } from "./lernspiele-englisch";
import type { SpielKarte, SpielThema } from "./lernspiele-typen";
import type { VokabelKandidat } from "./lernspiele-vokabeln";
import { kartenKey, type EigeneKarte } from "./spielkarten-text";
import { laengeFuer, schlossWort, WOERTER_JE_STUFE } from "./wortschloss";

type Rng = () => number;

export type WortFach = "Deutsch" | "Englisch" | "Dein Stoff";
export type WortThema = SpielThema & { id: string; fach: WortFach; kurz: string };

/** Ein Wort im Vorrat; `gruppe`: aus einer Gruppe (dasselbe Verb) höchstens eines je Stufe. */
export type WortKandidat = { karte: SpielKarte; gruppe?: string };

export const WORT_THEMEN: WortThema[] = [
  { id: "mehrzahl", name: "Mehrzahl", fach: "Deutsch", kurz: "das Glas → die Gläser", skill: "deutsch.vs.sprache.mehrzahl", ab: 2, bis: 6 },
  { id: "praeteritum", name: "Präteritum", fach: "Deutsch", kurz: "trinken → er trank", skill: "deutsch.grammatik.praeteritum", ab: 4 },
  { id: "partizip", name: "Perfekt-Formen", fach: "Deutsch", kurz: "trinken → hat getrunken", skill: "deutsch.grammatik.perfekt", ab: 4 },
  { id: "irregular", name: "Irregular Verbs", fach: "Englisch", kurz: "go → went → gone", skill: IRREGULAR_SKILL, ab: 6, auch: ["englisch.tenses.pastsimple.irregular"] },
];
export const wortThema = (id: string): WortThema | undefined => WORT_THEMEN.find((t) => t.id === id);
/** „Dein Stoff“: die Spielkarten der Lehrkraft mit einem Wort als Antwort. */
export const STOFF_WORT = "stoff";
/** Vokabeln: die eigene Liste oder die Themenliste des Schülers (lib/lernspiele.ts `vokabelPlan`), Deutsch → Englisch. */
export const VOKABEL_WORT = "vokabeln";

const key = (thema: string, wort: string) => `wort:${thema}:${wort.toLowerCase()}`;
/** Das Thema einer Wortschloss-Karte („wort:mehrzahl:gläser“ → „mehrzahl“). */
export const wortThemaVonKey = (k: string) => /^wort:([a-z0-9]+):/.exec(k)?.[1] ?? null;

/** Eine Karte: `wort` ist der Hinweis, `marke` sagt, was gesucht ist, `richtig` das Wort. */
function karte(thema: string, hinweis: string, wort: string, o: { skill: string; marke: string; loesung: string; regel: string; key?: string }): SpielKarte {
  return { key: o.key ?? key(thema, wort), skill: o.skill, wort: hinweis, marke: o.marke, vor: "", nach: "", faecher: [], richtig: wort, loesung: o.loesung, regel: o.regel };
}

function mehrzahl(): WortKandidat[] {
  const t = wortThema("mehrzahl")!;
  return MEHRZAHL.filter((m) => m.mz.length === 1 && m.mz[0] !== m.ez && schlossWort(m.mz[0])).map((m) => ({
    karte: karte("mehrzahl", `${m.art} ${m.ez}`, m.mz[0], { skill: t.skill, marke: "Mehrzahl", loesung: `${m.art} ${m.ez} → die ${m.mz[0]}`, regel: MZ_TIPP[m.g] }),
  }));
}

function praeteritum(): WortKandidat[] {
  const t = wortThema("praeteritum")!;
  return VERBEN.filter((v) => !v.teil && schlossWort(v.praet[0])).map((v) => ({
    karte: karte("praeteritum", v.inf, v.praet[0], {
      skill: t.skill,
      marke: "Präteritum · er, sie, es",
      loesung: `${v.inf} → er ${v.praet[0]}`,
      regel: `${v.inf}: er ${v.praet[0]}, sie ${v.praet[1]}${v.falschPraet ? ` (nicht „${v.falschPraet}“)` : ""}.`,
    }),
    gruppe: v.inf,
  }));
}

function partizip(): WortKandidat[] {
  const t = wortThema("partizip")!;
  return VERBEN.filter((v) => schlossWort(v.p2)).map((v) => {
    const hilf = v.hilf === "sein" ? "ist" : "hat";
    return {
      karte: karte("partizip", v.inf, v.p2, {
        skill: t.skill,
        marke: `Perfekt · er ${hilf} …`,
        loesung: `${v.inf} → er ${hilf} ${v.p2}`,
        regel: `${v.inf}: er ${hilf} ${v.p2}${v.falschP2 ? ` (nicht „${v.falschP2}“)` : ""}.`,
      }),
      gruppe: v.inf,
    };
  });
}

function irregular(): WortKandidat[] {
  const t = wortThema("irregular")!;
  return UNREGELMAESSIG.flatMap(([inf, past, pp]) =>
    (
      [
        [past, "Simple Past"],
        [pp, "Past Participle"],
      ] as const
    )
      .filter(([w]) => schlossWort(w))
      .map(([w, marke]) => ({
        karte: karte("irregular", inf, w, { skill: t.skill, marke, loesung: `${inf} → ${w} (${inf}, ${past}, ${pp})`, regel: `${inf}, ${past}, ${pp}: das ${marke} ist „${w}“.` }),
        gruppe: inf,
      })),
  );
}

const cache = new Map<string, WortKandidat[]>();
/** Alle Wörter eines festen Themas (Vokabeln und „Dein Stoff“ kommen aus der Datenbank). */
export function wortKandidaten(thema: string): WortKandidat[] {
  const c = cache.get(thema);
  if (c) return c;
  const out = thema === "mehrzahl" ? mehrzahl() : thema === "praeteritum" ? praeteritum() : thema === "partizip" ? partizip() : thema === "irregular" ? irregular() : [];
  cache.set(thema, out);
  return out;
}

/** Vokabeln: das deutsche Wort ist der Hinweis, das englische wird getippt („to “ fällt weg, nur ein Wort). */
export function vokabelWoerter(pool: VokabelKandidat[], skill: string): WortKandidat[] {
  const out: WortKandidat[] = [];
  const gesehen = new Set<string>();
  for (const { karte: k } of pool) {
    const en = schlossWort((k.wort ?? "").replace(/^to\s+/i, ""));
    if (!en || gesehen.has(en)) continue;
    gesehen.add(en);
    out.push({ karte: karte(VOKABEL_WORT, k.richtig, en, { skill, marke: "auf Englisch", loesung: `${k.richtig} = ${k.wort}`, regel: k.regel || `${k.richtig} = ${k.wort}`, key: `wort:${VOKABEL_WORT}:${k.key}` }) });
  }
  return out;
}

/** So lang darf eine Frage aus den Spielkarten sein, damit sie als Hinweis über dem Schloss Platz hat. */
export const STOFF_HINWEIS_MAX = 90;

/** Die Spielkarten eines Satzes mit einem Wort als Antwort („Hauptstadt von Frankreich?“ → „Paris“). */
export function stoffWoerter(karten: EigeneKarte[], skill: string): WortKandidat[] {
  const out: WortKandidat[] = [];
  const gesehen = new Set<string>();
  for (const k of karten) {
    if (k.art !== "wahl" || k.frage.trim().length > STOFF_HINWEIS_MAX) continue;
    const w = schlossWort(k.richtig);
    if (!w || gesehen.has(`${k.frage}|${w}`)) continue;
    gesehen.add(`${k.frage}|${w}`);
    out.push({ karte: karte(STOFF_WORT, k.frage.trim(), k.richtig.trim(), { skill, marke: "Dein Stoff", loesung: `${k.frage.trim()} → ${k.richtig.trim()}`, regel: k.merke || `${k.frage.trim()} → ${k.richtig.trim()}`, key: `wort:${STOFF_WORT}:${kartenKey(k)}` }) });
  }
  return out;
}

function mischen<T>(xs: T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Die Wörter einer Stufe: zuerst die, die zuletzt nicht gewusst waren (`wiederholen`), dann solche, die in den letzten
 * Runden nicht dran waren, dann die am längsten nicht gesehenen. Auf den ersten Stufen nur kurze Wörter (reicht das
 * nicht, auch längere). Aus einer `gruppe` höchstens eines.
 */
export function waehleWortKarten(pool: WortKandidat[], o: { stufe: number; anzahl?: number; wiederholen?: string[]; zuletzt?: string[]; rng?: Rng }): SpielKarte[] {
  const rng = o.rng ?? Math.random;
  const anzahl = o.anzahl ?? WOERTER_JE_STUFE;
  const max = laengeFuer(o.stufe);
  const kurz = pool.filter((k) => k.karte.richtig.length <= max);
  const vorrat = kurz.length >= anzahl ? kurz : pool;
  const falsch = new Set(o.wiederholen ?? []);
  const alter = new Map((o.zuletzt ?? []).map((k, i) => [k, i]));
  const geordnet = [
    ...mischen(vorrat.filter((k) => falsch.has(k.karte.key)), rng),
    ...mischen(vorrat.filter((k) => !falsch.has(k.karte.key) && !alter.has(k.karte.key)), rng),
    ...mischen(vorrat.filter((k) => !falsch.has(k.karte.key) && alter.has(k.karte.key)), rng).sort((a, b) => alter.get(b.karte.key)! - alter.get(a.karte.key)!),
  ];
  const out: SpielKarte[] = [];
  const gruppen = new Set<string>();
  const woerter = new Set<string>();
  for (const k of geordnet) {
    if (out.length >= anzahl) break;
    const w = k.karte.richtig.toLowerCase();
    if (woerter.has(w) || (k.gruppe && gruppen.has(k.gruppe))) continue;
    out.push(k.karte);
    woerter.add(w);
    if (k.gruppe) gruppen.add(k.gruppe);
  }
  return out;
}

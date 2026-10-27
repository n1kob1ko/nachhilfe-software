/**
 * Der **Plan für die ganze Einheit** (niko, 27.10.2026: „Lernheft entscheidet: welche Themen heute Priorität haben, welche
 * Grundlagen zuerst erklärt werden müssen, wie viel Unterrichtszeit für jedes Thema sinnvoll ist … Dabei soll Lernheft die
 * vorhandenen geprüften Materialien bevorzugen.“ „Der Lehrer soll nicht manuell einzelne Lernpakete zusammensuchen
 * müssen.“). Ohne KI und ohne Kosten, nur aus dem, was die App schon weiß; mit der KI aus kommt derselbe Plan.
 *
 * 1. **Themen**: zuerst die Vorgabe für heute (lib/vorgabe.ts, je Fähigkeit ein Thema; die mit einem weiteren Signal, etwa
 *    der Prüfung, vorne), dann alle Signale der automatischen Vorbereitung in ihrer Reihenfolge (lib/vorbereitung-auto.ts
 *    `ordneSignale`: Prüfung > Schulstoff > vom Schüler gemeldet > wiederholte Fehler > offene Ziele > Wiederholung). Was
 *    dieselbe Fähigkeit meint (oder ihre Ober- oder Teilfähigkeit), ist ein Thema. Höchstens 3 Themen, bis 60 Minuten 2,
 *    bis 40 eines; jedes hat mindestens 20 Minuten.
 * 2. **Grundlagen zuerst**: ist eine direkte Voraussetzung (lib/lehrplan.ts `prerequisitesOf`) laut Lernstand nicht sicher
 *    (unter „gut“, 70 %; ohne Daten zählt sie nicht als schwach), kommt vor das Thema ein kurzer Block „Grundlage: …“ aus
 *    seinen Minuten. Ist die Voraussetzung selbst ein Thema von heute, kommt dieses Thema davor.
 * 3. Je Thema **Erklären → Üben → Lernkontrolle** (3 Aufgaben, ein Versuch, ohne Hilfen; lib/cockpit.ts
 *    `sendeAusGenerator`), dazu ein kurzer Einstieg (mit der offenen Hausübung) und der Abschluss. Die Minuten der Themen
 *    nach ihrem Rang (4 : 3 : 2), zusammen genau die Dauer der Einheit (`verteileMinuten`).
 * 4. **Geprüfte Lernpakete zuerst**: passt ein geprüftes Paket zum Thema (wie bei der automatischen Wahl: `treffer` und
 *    `stufePasst`), sind seine Schritte der Block des Themas, in ihrer Reihenfolge, die Minuten auf die des Themas gebracht.
 *    Jedes Thema kann ein anderes Paket haben. Jeder Schritt kennt seine Quelle (`quelle`: Schritt eines Pakets oder
 *    Fähigkeit) und sein Thema, damit Senden, Lösungen, Folien, Anpassung und Abschluss je Schritt gehen.
 *
 * Nur lesen: festgehalten wird der Plan erst beim ersten Tippen in der Einheit (lib/cockpit.ts `mitSchritt`). Wählt die
 * Lehrkraft selbst ein Paket für die Einheit, gilt wie bisher genau dieses Paket.
 */
import { briefingDaten, einfachesBriefing, fokusGewichte, kandidaten, uebungFuer, verteileMinuten, type BriefingDaten, type Kandidat as BestandKandidat } from "./briefing";
import type { PlanStep } from "./cockpit";
import { prerequisitesOf } from "./lehrplan";
import { getLernpaket, listLernpakete, type Lernpaket, type LernpaketSchritt } from "./lernpakete";
import { STATUS_THRESHOLDS } from "./mastery";
import { bestandZur } from "./material-passt";
import * as repo from "./repo";
import {
  geprueftePakete,
  GUETE,
  ohnePaketMarkiert,
  ordneSignale,
  schuelerBasis,
  SIGNAL_LABEL,
  SIGNAL_RANG,
  signaleFuer,
  treffer,
  verwandtschaft,
  vorgabeSignal,
  wuenscheFuer,
  type Signal,
  type SignalArt,
} from "./vorbereitung-auto";

/** Was ein Schritt im Plan ist; `paket`: ein Schritt eines Lernpakets (seine Art steht im Paket). */
export type PlanArt = "einstieg" | "grundlage" | "erklaeren" | "ueben" | "kontrolle" | "abschluss" | "paket";
export type SchrittQuelle = { paketId: number; schrittId: number } | { skillId: string };

/** So viele Minuten hat ein Thema mindestens. */
export const THEMA_MIN = 20;
/** So viele Aufgaben hat die kurze Lernkontrolle. */
export const KONTROLLE_ANZAHL = 3;
/** Die Gewichte der Themen nach Rang: das erste bekommt die meiste Zeit. */
const RANG_GEWICHT = [4, 3, 2];
/** Unter diesem Lernstand ist eine Voraussetzung nicht sicher (lib/mastery.ts „gut“, wie lib/recommend.ts). */
export const SICHER_AB = STATUS_THRESHOLDS.gut;

export type Thema = {
  name: string;
  /** die Fähigkeit, die geübt wird; null: ein Punkt der Vorgabe ohne Fähigkeit (erst bestätigen) */
  skillId: string | null;
  /** was das Thema abdeckt: seine Fähigkeit und die des Pakets (zum Zusammenlegen) */
  skillIds: string[];
  art: SignalArt;
  warum: string;
  /** eine kommende Prüfung nennt das Thema (auch wenn es aus der Vorgabe kommt): Üben auch im Prüfungsformat */
  pruefung: boolean;
  paket: Lernpaket | null;
  /** eine nicht sichere Voraussetzung, die vorher kurz drankommt */
  grundlage: string | null;
  minuten: number;
  /**
   * ein Punkt der Vorgabe, dessen Fähigkeit noch zu bestätigen ist (seine Wörter, „Past Simple“): ein vorläufiger Block ohne
   * Übung, der nach „Bestätigen“ der Block der Fähigkeit wird und bei „Keine passt“ wegfällt
   */
  vorlaeufig?: string;
};

export type PlanEingabe = {
  /** die Dauer der Einheit */
  minuten: number;
  /** geordnet (`ordneSignale`), die Vorgabe für heute zuerst */
  signale: Signal[];
  /** die geprüften Pakete, die für den Schüler in Frage kommen (`geprueftePakete`) */
  pakete: Lernpaket[];
  verwandt: (a: string, b: string) => boolean;
  /** der Name einer Fähigkeit; null, wenn es sie nicht gibt */
  name: (skillId: string) => string | null;
  voraussetzungen: (skillId: string) => string[];
  /** Lernstand 0–1, null ohne Daten */
  lernstand: (skillId: string) => number | null;
};

// ---------- minutes ----------

/** Einstieg, Abschluss und was für die Themen bleibt. */
export function rahmen(minuten: number): { einstieg: number; abschluss: number; themen: number } {
  if (minuten < 30) {
    const [einstieg, themen, abschluss] = verteileMinuten([1, 3, 1], minuten);
    return { einstieg, abschluss, themen };
  }
  const einstieg = minuten >= 90 ? 10 : 5;
  return { einstieg, abschluss: 5, themen: minuten - einstieg - 5 };
}

/** Wie viele Themen in die Einheit passen: 3, bis 60 Minuten 2, bis 40 eines; jedes mit mindestens 20 Minuten. */
export function themenZahl(minuten: number): number {
  const frei = rahmen(minuten).themen;
  let n = minuten <= 40 ? 1 : minuten <= 60 ? 2 : 3;
  while (n > 1 && frei / n < THEMA_MIN) n--;
  return n;
}

/** Die Minuten der Themen nach Rang (4 : 3 : 2); bekäme eines so unter 20, hat jedes 20 und der Rest geht nach Rang. */
export function themenMinuten(n: number, gesamt: number): number[] {
  const rang = RANG_GEWICHT.slice(0, n);
  const roh = verteileMinuten(rang, gesamt);
  if (n <= 1 || roh.every((m) => m >= THEMA_MIN)) return roh;
  const rest = gesamt - THEMA_MIN * n;
  if (rest < 0) return verteileMinuten(rang.map(() => 1), gesamt);
  return verteileMinuten(rang, rest).map((m) => m + THEMA_MIN);
}

// ---------- the topics ----------

type Kandidat = { skillId: string | null; signal: Signal; vorlaeufig?: NonNullable<Signal["vorlaeufig"]>[number] };

/** Name eines vorläufigen Blocks: die Wörter des Punkts und was noch fehlt. */
export const vorlaeufigName = (inhalt: string) => `${inhalt} · noch bestätigen`;
const klein = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Die Kandidaten eines Signals: je Fähigkeit einer. Die Vorgabe hat dazu ihre Punkte, die noch zu bestätigen sind, an ihrer
 * Stelle unter den Punkten (nicht, wenn ihre vorgewählte Fähigkeit schon ein sicherer Punkt ist). Ein Signal ohne Fähigkeit nur
 * über ein Paket (oder die Vorgabe, deren Punkte ohne Vorschlag sind).
 */
function kandidatenVon(s: Signal, verwandt: PlanEingabe["verwandt"]): Kandidat[] {
  const offen = (s.vorlaeufig ?? []).filter((v) => !v.skillId || !s.skill_ids.some((x) => verwandt(x, v.skillId!)));
  if (!s.skill_ids.length && !offen.length) return s.stoff.length || s.paket_ids?.length ? [{ skillId: null, signal: s }] : [];
  const out: Kandidat[] = [];
  let j = 0;
  s.skill_ids.forEach((id, i) => {
    while (j < offen.length && offen[j].nach <= i) out.push({ skillId: null, signal: s, vorlaeufig: offen[j++] });
    out.push({ skillId: id, signal: s });
  });
  return [...out, ...offen.slice(j).map((v) => ({ skillId: null, signal: s, vorlaeufig: v }))];
}

/**
 * Die Themen der Einheit in ihrer Reihenfolge, mit Minuten, Paket und Grundlage. Nur aus den Signalen, ohne Datenbank.
 */
export function waehleThemen(e: PlanEingabe): Thema[] {
  const n = themenZahl(e.minuten);
  // one candidate per skill of a signal; a signal without a skill only through a package (or the Vorgabe still to confirm)
  const alle = e.signale.flatMap((s) => kandidatenVon(s, e.verwandt));
  // the Vorgabe first; among its skills those another signal also names (the Prüfung …) in front, otherwise in its order
  const stuetze = (id: string | null) => Math.max(0, ...e.signale.filter((s) => s.art !== "vorgabe" && id !== null && s.skill_ids.some((x) => e.verwandt(x, id))).map((s) => SIGNAL_RANG[s.art]));
  const vorgabe = alle
    .filter((k) => k.signal.art === "vorgabe")
    .map((k, i) => ({ k, i, g: stuetze(k.skillId ?? k.vorlaeufig?.skillId ?? null) }))
    .sort((a, b) => b.g - a.g || a.i - b.i)
    .map((x) => x.k);
  const kandidaten = [...vorgabe, ...alle.filter((k) => k.signal.art !== "vorgabe")];

  const themen: Thema[] = [];
  const benutzt = new Set<number>();
  const deckt = (id: string) => themen.some((t) => t.skillIds.some((x) => e.verwandt(x, id)));
  for (const k of kandidaten) {
    if (themen.length >= n) break;
    // a point of the Vorgabe still to confirm: a provisional block named by its words, no package, no exercise (nothing counts yet)
    if (k.vorlaeufig) {
      const v = k.vorlaeufig;
      if ((v.skillId && deckt(v.skillId)) || themen.some((t) => t.vorlaeufig && klein(t.vorlaeufig) === klein(v.inhalt))) continue;
      themen.push({ name: vorlaeufigName(v.inhalt), skillId: null, skillIds: [], art: "vorgabe", warum: `Deine Vorgabe für heute: ${v.inhalt}`, pruefung: false, paket: null, grundlage: null, minuten: 0, vorlaeufig: v.inhalt });
      continue;
    }
    if (k.skillId && (!e.name(k.skillId) || deckt(k.skillId))) continue;
    // the best checked package for it: the same rule as the automatic choice (exactly this package, skill, keyword)
    const signal: Signal = { ...k.signal, skill_ids: k.skillId ? [k.skillId] : [], stoff: k.skillId ? [] : k.signal.stoff };
    const passend = e.pakete
      .filter((p) => !benutzt.has(p.id))
      .flatMap((p) => {
        const t = treffer(p, signal, e.verwandt);
        return t ? [{ p, t }] : [];
      })
      .sort((a, b) => GUETE[b.t] - GUETE[a.t] || a.p.title.localeCompare(b.p.title, "de") || a.p.id - b.p.id)[0];
    const paket = passend?.p ?? null;
    // without a skill: only with a package, or the Vorgabe whose points still wait for „kurz bestätigen“
    if (!k.skillId && !paket && k.signal.art !== "vorgabe") continue;
    const skillId = k.skillId ?? paket?.skill_ids.find((id) => e.name(id)) ?? null;
    if (!k.skillId && skillId && deckt(skillId)) continue;
    if (paket) benutzt.add(paket.id);
    themen.push({
      name: (skillId && e.name(skillId)) || (paket ? paket.thema || paket.title : k.signal.thema || SIGNAL_LABEL.vorgabe),
      skillId,
      skillIds: [...new Set([...(skillId ? [skillId] : []), ...(paket?.skill_ids ?? [])])],
      art: k.signal.art,
      // the student's own words stay in his quote (lib/vorbereitung-auto.ts), never in the plan; the Vorgabe names only
      // this topic's point, not all of its points
      warum:
        k.signal.art === "wunsch"
          ? `${SIGNAL_LABEL.wunsch}: ${(skillId && e.name(skillId)) || k.signal.thema}`
          : k.signal.art === "vorgabe" && skillId && e.name(skillId)
            ? `Deine Vorgabe für heute: ${e.name(skillId)}`
            : k.signal.warum,
      pruefung: k.signal.art === "pruefung" || (skillId !== null && e.signale.some((s) => s.art === "pruefung" && s.skill_ids.some((x) => e.verwandt(x, skillId)))),
      paket,
      grundlage: null,
      minuten: 0,
    });
  }
  // the minutes by rank, among the topics found (fewer than fit: each gets more), together exactly the time for topics
  const minuten = themenMinuten(themen.length, rahmen(e.minuten).themen);
  themen.forEach((t, i) => (t.minuten = minuten[i]));

  // prerequisites first: a weak one that is a topic today moves in front, otherwise a short Grundlage block
  const schwach = (id: string) => {
    const m = e.lernstand(id);
    return m !== null && m < SICHER_AB;
  };
  const verschoben = new Set<Thema>();
  const grundlagen = new Set<string>();
  for (let i = 0; i < themen.length; i++) {
    const t = themen[i];
    if (!t.skillId) continue;
    const vor = e.voraussetzungen(t.skillId).filter((p) => p !== t.skillId && schwach(p));
    const j = themen.findIndex((x, k) => k > i && !verschoben.has(x) && x.skillId !== null && vor.some((p) => e.verwandt(p, x.skillId!)));
    if (j > i) {
      const [x] = themen.splice(j, 1);
      themen.splice(i, 0, x);
      verschoben.add(x);
      i--;
      continue;
    }
    const g = vor.find((p) => e.name(p) && !grundlagen.has(p) && !themen.some((x) => x.skillIds.some((y) => e.verwandt(y, p))));
    if (g) {
      t.grundlage = g;
      grundlagen.add(g);
    }
  }
  return themen;
}

// ---------- the steps ----------

type PaketSchritt = Pick<LernpaketSchritt, "id" | "titel" | "minuten" | "art" | "aufgaben">;

export type PlanHilfen = {
  /** die beste Übung aus dem Bestand zur Fähigkeit („U12“), oder null */
  uebung: (skillId: string) => string | null;
  /** die Schritte eines Pakets in seiner Reihenfolge */
  schritte: (paketId: number) => PaketSchritt[];
  /** der Einstieg: was zuletzt war, und eine offene Hausübung */
  einstieg: { beschreibung: string; hausuebung: string | null };
  name: (skillId: string) => string | null;
  lernstand: (skillId: string) => number | null;
};

type Roh = Omit<PlanStep, "id">;

/** Die Fähigkeit eines Paketschritts: die seiner Aufgaben, sonst die des Themas oder des Pakets. */
const skillDes = (s: PaketSchritt, t: Thema) => s.aufgaben.flatMap((a) => [a.skillId, ...(a.skillIds ?? [])]).find((x): x is string => Boolean(x)) ?? t.skillId ?? t.paket?.skill_ids[0] ?? null;

function grundlageSchritt(t: Thema, h: PlanHilfen): Roh {
  const id = t.grundlage!;
  const m = h.lernstand(id);
  const name = h.name(id) ?? id;
  return {
    titel: `Grundlage: ${name}`,
    minuten: 0,
    beschreibung: `Vor ${t.name} kurz die Grundlage: ${name} sitzt noch nicht${m === null ? "" : ` (${Math.round(m * 100)} %)`}. Erklären und ein paar Aufgaben.`,
    uebung: h.uebung(id),
    skillId: id,
    art: "grundlage",
    thema: t.name,
    quelle: { skillId: id },
  };
}

function kontrolleSchritt(t: Thema): Roh {
  return {
    titel: `Lernkontrolle: ${t.name}`,
    minuten: 0,
    beschreibung: `${KONTROLLE_ANZAHL} Aufgaben, ein Versuch, ohne Hilfen. Danach sagst du, wie es war: Richtig, Teilweise oder Falsch.`,
    uebung: null,
    skillId: t.skillId,
    art: "kontrolle",
    thema: t.name,
    quelle: t.skillId ? { skillId: t.skillId } : null,
  };
}

/** Die Schritte eines Themas, ihre Minuten zusammen genau die des Themas. */
function themaSchritte(t: Thema, h: PlanHilfen): Roh[] {
  const mit = (teile: { w: number; s: Roh }[]) => {
    const min = verteileMinuten(
      teile.map((x) => x.w),
      t.minuten,
    );
    return teile.map((x, i) => ({ ...x.s, minuten: min[i] }));
  };
  const grundlage = t.grundlage ? grundlageSchritt(t, h) : null;
  if (t.paket) {
    const schritte = h.schritte(t.paket.id);
    if (schritte.length) {
      const p = t.paket;
      const summe = schritte.reduce((a, s) => a + Math.max(1, s.minuten), 0);
      // a package without its own check gets the short Lernkontrolle of the topic
      const kontrolle = t.skillId && !schritte.some((s) => s.art === "kontrolle") ? kontrolleSchritt(t) : null;
      return mit([
        ...(grundlage ? [{ w: summe / 5, s: grundlage }] : []),
        ...schritte.map((s) => ({
          w: Math.max(1, s.minuten),
          s: { titel: s.titel, minuten: 0, beschreibung: "", uebung: null, skillId: skillDes(s, t), art: "paket" as const, thema: t.name, quelle: { paketId: p.id, schrittId: s.id } },
        })),
        ...(kontrolle ? [{ w: summe / 5, s: kontrolle }] : []),
      ]);
    }
  }
  // a point of the Vorgabe still to confirm: one provisional step without an exercise; it becomes the skill's block on „Bestätigen“
  if (t.vorlaeufig)
    return mit([
      {
        w: 1,
        s: { titel: t.name, minuten: 0, beschreibung: "Erklären und besprechen geht schon. Bis zum Bestätigen zählt nichts davon für Lernstand und Dokumentation.", uebung: null, skillId: null, art: "ueben", thema: t.name, quelle: null, vorlaeufig: t.vorlaeufig },
      },
    ]);
  // a point of the Vorgabe without a skill yet: one step, the exercise follows once it is confirmed
  if (!t.skillId) return mit([{ w: 1, s: { titel: `Üben: ${t.name}`, minuten: 0, beschreibung: t.warum, uebung: null, skillId: null, art: "ueben", thema: t.name, quelle: null } }]);
  const q = { skillId: t.skillId };
  // a quarter each for Grundlage, Erklären and Lernkontrolle, at most 15, 15 and 10 minutes; the rest is practice
  const teil = (max: number) => Math.min(t.minuten / 4, max);
  const g = grundlage ? teil(15) : 0;
  return mit([
    ...(grundlage ? [{ w: g, s: grundlage }] : []),
    { w: teil(15), s: { titel: `Erklären: ${t.name}`, minuten: 0, beschreibung: t.warum, uebung: null, skillId: t.skillId, art: "erklaeren", thema: t.name, quelle: q } },
    {
      w: t.minuten - g - teil(15) - teil(10),
      s: { titel: `Üben: ${t.name}`, minuten: 0, beschreibung: "Übung aus dem Bestand, sonst neue Aufgaben passend zum Lernstand.", uebung: h.uebung(t.skillId), skillId: t.skillId, art: "ueben", thema: t.name, quelle: q, ...(t.pruefung ? { pruefung: true } : {}) },
    },
    { w: teil(10), s: kontrolleSchritt(t) },
  ]);
}

/**
 * Die Schritte eines bestätigten vorläufigen Blocks (lib/cockpit.ts `ersetzeVorlaeufige`): Erklären, Üben (neue Aufgaben aus den
 * Generatoren) und Lernkontrolle der Fähigkeit, zusammen genau die Minuten des Blocks. Ohne Ids.
 */
export function schritteZurFaehigkeit(skillId: string, minuten: number): Omit<PlanStep, "id">[] {
  const name = repo.getSkill(skillId)?.name ?? skillId;
  const t: Thema = { name, skillId, skillIds: [skillId], art: "vorgabe", warum: `Deine Vorgabe für heute: ${name}`, pruefung: false, paket: null, grundlage: null, minuten };
  return themaSchritte(t, { uebung: () => null, schritte: () => [], einstieg: { beschreibung: "", hausuebung: null }, name: (id) => repo.getSkill(id)?.name ?? null, lernstand: () => null });
}

/** Der ganze Plan: Einstieg, die Themen, Abschluss; Ids negativ (-1, -2 …) wie jeder Plan ohne Lernpaket. */
export function bauePlan(themen: Thema[], minuten: number, h: PlanHilfen): PlanStep[] {
  if (!themen.length) return [];
  const r = rahmen(minuten);
  const hu = h.einstieg.hausuebung;
  const schritte: Roh[] = [
    {
      titel: hu ? "Einstieg und Hausübung" : "Einstieg und Wiederholung",
      minuten: r.einstieg,
      beschreibung: [h.einstieg.beschreibung, hu ? `Hausübung kontrollieren: ${hu}` : ""].filter(Boolean).join("\n"),
      uebung: null,
      skillId: null,
      art: "einstieg",
      thema: null,
      quelle: null,
    },
    ...themen.flatMap((t) => themaSchritte(t, h)),
    { titel: "Abschluss", minuten: r.abschluss, beschreibung: "Kurz zusammenfassen, Hausübung festlegen, dokumentieren.", uebung: null, skillId: null, art: "abschluss", thema: null, quelle: null },
  ];
  return schritte.map((s, i) => ({ ...s, id: -(i + 1) }));
}

/** Die Themen eines Plans in ihrer Reihenfolge, mit Minuten und dem Paket, aus dem ihre Schritte kommen. Leer bei einem alten Plan. */
export function themenDesPlans(plan: Pick<PlanStep, "id" | "minuten" | "thema" | "quelle">[]): { name: string; minuten: number; paketId: number | null; ids: number[] }[] {
  const out: { name: string; minuten: number; paketId: number | null; ids: number[] }[] = [];
  for (const s of plan) {
    if (!s.thema) continue;
    let t = out.find((x) => x.name === s.thema);
    if (!t) out.push((t = { name: s.thema, minuten: 0, paketId: null, ids: [] }));
    t.minuten += s.minuten;
    t.ids.push(s.id);
    if (s.quelle && "paketId" in s.quelle) t.paketId ??= s.quelle.paketId;
  }
  return out;
}

// ---------- re-timing during the unit ----------

/** Eine Lernkontrolle behält beim Kürzen mindestens so viele Minuten. */
export const KONTROLLE_MIN = 5;
/** Ein Thema, das beim Kürzen darunter fiele, kommt auf „Nächstes Mal“, statt gequetscht zu werden (die Hälfte von THEMA_MIN). */
export const THEMA_REST_MIN = THEMA_MIN / 2;

/**
 * Der neu getaktete Plan einer laufenden Einheit: Minuten und Beginn (Minute der Einheit) je Schritt-Id; `verschoben`: die
 * Schritte der Themen, die heute nicht mehr Platz haben und auf „Nächstes Mal“ kommen.
 */
export type Takt = { minuten: Record<string, number>; ab: Record<string, number>; verschoben: number[] };

/** Ein Schritt, wie das Neu-Takten ihn sieht: geplante Minuten, Thema (null bei Einstieg und Abschluss), Lernkontrolle oder nicht. */
export type TaktSchritt = { id: number; minuten: number; thema?: string | null; kontrolle: boolean };

/** `gesamt` Minuten auf die Schritte eines Themas: eine Lernkontrolle behält ihre 5 Minuten, der Rest nach den geplanten Minuten. */
function imThema(schritte: TaktSchritt[], gesamt: number): number[] {
  const reserve = schritte.map((s) => (s.kontrolle ? Math.min(s.minuten, KONTROLLE_MIN) : 0));
  const frei = gesamt - reserve.reduce((a, b) => a + b, 0);
  if (frei < 0)
    return verteileMinuten(
      schritte.map((s) => s.minuten),
      gesamt,
    );
  const idx = schritte.map((_, i) => i).filter((i) => schritte[i].minuten - reserve[i] > 0);
  const out = [...reserve];
  if (!idx.length) {
    if (out.length) out[out.length - 1] += frei;
    return out;
  }
  const teile = verteileMinuten(
    idx.map((i) => schritte[i].minuten - reserve[i]),
    frei,
  );
  idx.forEach((i, k) => (out[i] += teile[k]));
  return out;
}

/**
 * Den Rest der Einheit neu takten (niko, 27.10.2026: „Die Zeitaufteilung darf flexibel sein, wenn der Schüler länger für ein
 * Thema benötigt.“), immer wenn der Lehrer weitergeht. `schritte` in der Reihenfolge der Einheit mit den geplanten Minuten,
 * `jetzt` die Minute der Einheit, `rest` die Minuten, die noch bleiben (nie mehr als der Plan selbst hat).
 *
 * - Erledigte und übersprungene Schritte bleiben, wie sie waren.
 * - Das Thema auf dem Schirm, Einstieg und Abschluss behalten ihre Minuten (ein schon gekürztes Thema bleibt so kurz); die
 *   späteren Themen werden im Verhältnis kürzer, wenn die Zeit nicht reicht (nie länger als geplant). Eine Lernkontrolle
 *   behält dabei mindestens 5 Minuten.
 * - Fiele ein Thema unter etwa 10 Minuten, kommt das letzte auf „Nächstes Mal“ (`verschoben`), statt gequetscht zu werden;
 *   es bleibt dort, bis der Lehrer einen seiner Schritte selbst öffnet.
 * - Die offenen Schritte beginnen ab jetzt: der Schritt auf dem Schirm bei `jetzt`, die übrigen danach. Offene Schritte vor
 *   ihm (übersprungen beim Springen) kommen zuletzt und zählen für die Zeit nicht.
 */
export function neuTakten(schritte: TaktSchritt[], o: { fertig: number[]; aktuell: number | null; jetzt: number; rest: number; vorher?: Takt | null }): Takt {
  const vorher = o.vorher ?? null;
  const fertig = new Set(o.fertig);
  const minuten: Record<string, number> = {};
  const ab: Record<string, number> = {};
  let geplant = 0;
  for (const s of schritte) {
    if (fertig.has(s.id)) {
      minuten[s.id] = vorher?.minuten[s.id] ?? s.minuten;
      ab[s.id] = vorher?.ab[s.id] ?? geplant;
    }
    geplant += s.minuten;
  }
  const offen = schritte.filter((s) => !fertig.has(s.id));
  const frueher = new Set(vorher?.verschoben ?? []);
  const aktuell = offen.find((s) => s.id === o.aktuell) ?? offen.find((s) => !frueher.has(s.id)) ?? null;
  if (!aktuell) return { minuten: { ...minuten, ...Object.fromEntries(offen.map((s) => [s.id, vorher?.minuten[s.id] ?? s.minuten])) }, ab, verschoben: offen.filter((s) => frueher.has(s.id)).map((s) => s.id) };
  const thema = aktuell.thema ?? null;
  // a topic moved to next time stays there, unless its step is on screen now
  const verschoben = new Set(offen.filter((s) => frueher.has(s.id) && !(thema !== null && s.thema === thema)).map((s) => s.id));
  const i = offen.indexOf(aktuell);
  const danach = offen.slice(i).filter((s) => !verschoben.has(s.id));
  const davor = offen.slice(0, i).filter((s) => !verschoben.has(s.id));
  const fest = danach.filter((s) => s === aktuell || !s.thema || s.thema === thema);
  const gruppen: TaktSchritt[][] = [];
  for (const s of danach.filter((x) => !fest.includes(x))) {
    const g = gruppen.find((x) => x[0].thema === s.thema);
    if (g) g.push(s);
    else gruppen.push([s]);
  }
  const summe = (xs: TaktSchritt[]) => xs.reduce((a, s) => a + s.minuten, 0);
  // a topic already shortened keeps its shorter minutes when it comes on screen (never longer than planned)
  const basis = (s: TaktSchritt) => {
    const m = vorher?.minuten[s.id];
    return m && m > 0 ? Math.min(m, s.minuten) : s.minuten;
  };
  const budget = Math.floor(o.rest) - fest.reduce((a, s) => a + basis(s), 0);
  const neu = new Map<number, number>();
  while (gruppen.length && summe(gruppen.flat()) > budget) {
    const anteile = verteileMinuten(
      gruppen.map(summe),
      Math.max(0, budget),
    );
    if (anteile.every((a) => a >= THEMA_REST_MIN)) {
      gruppen.forEach((g, k) => imThema(g, anteile[k]).forEach((m, j) => neu.set(g[j].id, m)));
      break;
    }
    // the last topic goes to next time instead of being squeezed
    for (const s of gruppen.pop()!) verschoben.add(s.id);
  }
  let t = Math.max(0, Math.round(o.jetzt));
  for (const s of [...danach.filter((x) => !verschoben.has(x.id)), ...davor]) {
    // later topics come back to their planned minutes when the time allows again
    minuten[s.id] = neu.get(s.id) ?? (fest.includes(s) || davor.includes(s) ? basis(s) : s.minuten);
    ab[s.id] = t;
    t += minuten[s.id];
  }
  for (const id of verschoben) minuten[id] = 0;
  return { minuten, ab, verschoben: offen.filter((s) => verschoben.has(s.id)).map((s) => s.id) };
}

// ---------- from the database ----------

const kurz = (s: string, n: number) => {
  const t = s.trim().replace(/\s*\n\s*/g, "; ").replace(/\s+/g, " ");
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/** Der Einstieg: was die letzte Dokumentation für heute sagt, und die offene Hausübung (wie im Briefing). */
function einstiegAus(d: Pick<BriefingDaten, "doku" | "hausuebungen">): PlanHilfen["einstieg"] {
  const letzte = d.doku[0];
  const hu = d.hausuebungen[0]?.description.trim() || letzte?.homework_note.trim() || "";
  return {
    beschreibung: kurz(letzte?.next_steps || letzte?.review_topics || (letzte?.topic ? `Kurz wiederholen: ${letzte.topic}` : "Kurz wiederholen, was zuletzt geübt wurde."), 200),
    hausuebung: hu ? kurz(hu, 160) : null,
  };
}

/**
 * Der Plan für eine Einheit eines Schülers: für die laufende Einheit (`unitId`, mit ihrer Vorgabe für heute) oder als
 * Vorschau auf Heute. `datum` ist der Tag der Einheit, `fach` ihr Fach (leer: die Fächer im Profil), `platzId` ihr Platz
 * (für die Dauer: Platz → von Hand geplante Einheit → Vorgabe des Schülers → 100). Ohne ein einziges Thema der Plan aus den
 * Daten wie bisher (lib/briefing.ts `einfachesBriefing`). Liest nur, keine KI.
 */
export function stundenplanFuer(
  studentId: number,
  o: { now?: Date; datum?: string; fach: string; platzId: number | null; unitId?: number | null; pakete?: Lernpaket[]; daten?: BriefingDaten | null },
): PlanStep[] {
  const now = o.now ?? new Date();
  const student = repo.getStudent(studentId);
  const d = o.daten ?? briefingDaten(studentId, { now, platzId: o.platzId, kandidaten: false });
  if (!student || !d) return [];
  const datum = o.datum ?? d.datum;
  const unitId = o.unitId ?? null;
  const vorgabe = unitId ? vorgabeSignal(unitId, o.fach) : null;
  const stufe = { school_type: student.school_type, grade: student.grade || null, subjects: student.subjects, stufe_status: student.stufe_status };
  const signale = ordneSignale({ fach: o.fach, student: stufe, signale: signaleFuer(schuelerBasis(student, now), { datum, fach: o.fach, ausser: unitId, wuensche: wuenscheFuer(studentId, unitId), vorgabe }) });
  // „Entfernen“ for the day: no package from the suggestion (the teacher's own word for today still counts)
  const ohnePaket = !vorgabe && ohnePaketMarkiert(studentId, datum);
  const pakete = ohnePaket ? [] : geprueftePakete({ pakete: o.pakete ?? listLernpakete(), fach: o.fach, student: stufe });
  const stand = new Map(d.analysis.skills.map((s) => [s.skill.id, s.mastery]));
  const name = (id: string) => repo.getSkill(id)?.name ?? null;
  const lernstand = (id: string) => stand.get(id) ?? null;
  const themen = waehleThemen({ minuten: d.minuten, signale, pakete, verwandt: verwandtschaft(), name, voraussetzungen: prerequisitesOf, lernstand });
  // the exercises from the Bestand, with the skills of today's topics in front
  const skills = themen.flatMap((t) => [t.skillId, t.grundlage]).filter((x): x is string => Boolean(x));
  const k = kandidaten(d.student, fokusGewichte({ ...d, fokus: skills.length ? { art: "plan", skill_ids: skills, thema: "", beschreibung: "", paket_id: null } : d.fokus }));
  if (!themen.length)
    return einfachesBriefing({ ...d, kandidaten: k }).plan.map((p, i) => ({ id: -(i + 1), titel: p.titel, minuten: p.minuten, beschreibung: p.beschreibung, uebung: p.uebung, skillId: p.skillId ?? null }));
  const schon = new Set<string>();
  // an exercise from the Bestand only when it goes out with tasks of the step's skill and is not another student's sheet
  // (lib/material-passt.ts); otherwise the next one, or new tasks from the generators
  const nutzbar = (id: string) => (c: BestandKandidat) => !/^U\d+$/.test(c.id) || bestandZur(repo.getWorksheet(Number(c.id.slice(1))), id, studentId) !== null;
  return bauePlan(themen, d.minuten, {
    uebung: (id) => uebungFuer({ kandidaten: k }, [name(id) ?? id], schon, nutzbar(id)),
    schritte: (id) => getLernpaket(id)?.schritte ?? [],
    einstieg: einstiegAus(d),
    name,
    lernstand,
  });
}

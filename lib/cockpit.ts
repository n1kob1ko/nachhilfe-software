/**
 * Das **Cockpit** einer laufenden Einheit (niko, 2026-10-22: „die KI bereitet vor und dokumentiert, der Lehrer
 * unterrichtet“): welches Lernpaket heute dran ist, der Schritt auf dem Schirm, was erledigt und was
 * übersprungen ist und die Notizen des Lehrers je Schritt. Ohne eigens gewähltes Lernpaket läuft der Plan für die
 * ganze Einheit (lib/stundenplan.ts): mehrere Themen, Schritte geprüfter Pakete darin (`quelle`), beim ersten Tippen
 * oder Senden festgehalten. Alles hier ohne KI.
 *
 * Das Paket selbst ändert sich nie: Reihenfolge, Erledigt und Übersprungen gelten nur für diese Einheit
 * (Tabelle `einheit_cockpit`, eine Zeile je Einheit). So zeigt ein zweites Gerät oder ein Neuladen denselben
 * Stand. Beim Beenden kommen nur Tatsachen in die Dokumentation: welche Schritte erledigt, übersprungen oder
 * nicht erreicht wurden (`dokumentiereAblauf`). Der Lernstand bleibt unberührt.
 *
 * Notizen und Inhalt des Pakets bleiben beim Lehrer. Zum Schüler kommen nur die Aufgaben, die der Lehrer
 * mit „Übung senden“ schickt, ohne die Prüfhinweise des Pakets (`data.pruefen`).
 */
import type { PlanSchritt } from "./briefing";
import { checkTask } from "./builder";
import { difficultyFor, type Difficulty } from "./curriculum";
import { EXPLAIN } from "./erklaerungen";
import { db, json } from "./db";
import { autoFelderVon } from "./einschaetzung";
import { getLernpaket, getSchritt, type LernpaketMitSchritten, type LernpaketSchritt, type PaketQuelle } from "./lernpakete";
import { wienerDatum } from "./planung/zeit";
import { LERNKONTROLLE } from "./quick-round";
import { nextSteps } from "./recommend";
import * as repo from "./repo";
import { schulstufe } from "./school";
import { analyzeStudent, buildWorksheet, generatorAufgaben, type BuildRequest } from "./service";
import type { Art } from "./steuerung-regeln";
import { sorteOfSkill } from "./schreibauftrag";
import type { TaskDraft } from "./tasks";
import { EIGENE_VOKABELN } from "./vokabeln";
import { getUnit, platzFuerEinheit } from "./units";
import { zeitfenster } from "./planung/heute";
import { KONTROLLE_ANZAHL, neuTakten, stundenplanFuer, themenDesPlans, type PlanArt, type SchrittQuelle, type Takt } from "./stundenplan";
import { vorschlagErlauben, type Passung, type Signal } from "./vorbereitung-auto";

/** Höchstlänge einer Notiz je Schritt. */
export const NOTIZ_MAX = 2000;

export type Stand = {
  unit_id: number;
  paket_id: number | null;
  /** ohne Lernpaket: die Fähigkeit, um die es heute geht */
  skill_id: string | null;
  /** Schritt-Ids in der Reihenfolge dieser Einheit; leer = die des Pakets */
  reihenfolge: number[];
  /** der Schritt auf dem Schirm; null = der erste offene */
  aktuell: number | null;
  erledigt: number[];
  uebersprungen: number[];
  /** Notiz des Lehrers je Schritt-Id */
  notizen: Record<string, string>;
  /** gesendete Übungen je Schritt-Id */
  gesendet: Record<string, number[]>;
  /** „Wiederholen“: wie oft ein Schritt wiederholt wurde, je Schritt-Id */
  wiederholt: Record<string, number>;
  /** „Schüler versteht es nicht“: wie oft, je Schritt-Id */
  nichtVerstanden: Record<string, number>;
  /** ohne Lernpaket: der „Plan für heute“ aus dem Briefing, beim ersten Tippen festgehalten; null = noch nicht */
  plan: PlanStep[] | null;
  /** „Richtig / Teilweise / Falsch“ bei Fragen und Kontrollen: was der Lehrer gehört hat, je Schritt-Id */
  antworten: Record<string, Beobachtung>;
  /** Anpassung im Unterricht (lib/steuerung.ts): worauf schon reagiert wurde und das Zeichen des Lehrers */
  steuerung: Steuerung;
  /** im Plan: der Rest der Einheit nach der echten Zeit neu getaktet (lib/stundenplan.ts `neuTakten`); null = wie geplant */
  takt: Takt | null;
  /** noch nicht gespeichert, aus „Einheit vorbereiten“ übernommen */
  vorbereitet: boolean;
  /** noch nicht gespeichert: der Vorschlag der App (lib/vorbereitung-auto.ts), nicht die Wahl des Lehrers */
  automatisch: { warum: string; passung: Passung; luecke: Signal | null } | null;
  updated_at: string | null;
};

const leer = (unitId: number): Stand => ({
  unit_id: unitId,
  paket_id: null,
  skill_id: null,
  reihenfolge: [],
  aktuell: null,
  erledigt: [],
  uebersprungen: [],
  notizen: {},
  gesendet: {},
  wiederholt: {},
  nichtVerstanden: {},
  plan: null,
  antworten: {},
  steuerung: { bis: 0, signal: null },
  takt: null,
  vorbereitet: false,
  automatisch: null,
  updated_at: null,
});

/** Was der Lehrer bei einer Frage oder Kontrolle gehört hat. */
export type Beobachtung = "richtig" | "teilweise" | "falsch";
export const BEOBACHTUNGEN: readonly Beobachtung[] = ["richtig", "teilweise", "falsch"];
export const isBeobachtung = (x: unknown): x is Beobachtung => typeof x === "string" && (BEOBACHTUNGEN as readonly string[]).includes(x);

/**
 * Anpassung im Unterricht: `bis` ist die letzte Antwort (attempts.id), auf die schon reagiert wurde; der Vorschlag zählt
 * nur, was danach kam. `signal`: „Schüler versteht es nicht“ oder „Falsch“ bei einer Frage, für den Schritt auf dem Schirm,
 * bis der Lehrer reagiert oder weitergeht.
 */
export type Steuerung = { bis: number; signal: { schritt: number; art: "nicht_verstanden" | "falsch" } | null; reaktionen?: Reaktion[] };

/**
 * Eine Reaktion auf den Vorschlag, die Aufgaben an den Schüler geschickt hat (leichter, Voraussetzung, zum Fehler, schwerer),
 * für den Abschluss (lib/abschluss.ts): „Leichtere Aufgabe nötig bei …“, „Schwerere Aufgabe geschafft“ nur mit richtigen Antworten.
 */
export type Reaktion = { art: Art; skillId: string | null; assignmentId: number | null; at: string };
/** So viele Reaktionen merkt sich eine Einheit höchstens. */
const REAKTIONEN_MAX = 50;

/**
 * Ein Schritt aus dem „Plan für heute“ (lib/stundenplan.ts), für eine Einheit ohne eigens gewähltes Lernpaket. Die Ids
 * sind negativ (-1, -2 …), damit sie nie mit Schritten eines Pakets verwechselt werden. `uebung` ist eine Übung aus
 * dem Bestand („U12“ …), `skillId` die Fähigkeit für neue Aufgaben aus den Generatoren.
 *
 * Seit dem Plan für die ganze Einheit (niko, 27.10.2026) auch: `art` (Einstieg, Grundlage, Erklären, Üben, Lernkontrolle,
 * Abschluss oder ein Schritt eines Pakets), `thema` (das Thema, zu dem er gehört; null bei Einstieg und Abschluss),
 * `quelle` (der Schritt eines geprüften Pakets oder die Fähigkeit) und `pruefung` (Üben zum Thema der nahen Prüfung). Ein
 * früher festgehaltener Plan hat sie nicht und läuft wie bisher.
 */
export type PlanStep = {
  id: number;
  titel: string;
  minuten: number;
  beschreibung: string;
  uebung: string | null;
  skillId: string | null;
  art?: PlanArt;
  thema?: string | null;
  quelle?: SchrittQuelle | null;
  pruefung?: boolean;
};

/** Der Schritt eines Pakets, auf den ein Planschritt zeigt, oder null. */
export const paketQuelle = (s: Pick<PlanStep, "quelle"> | null | undefined): { paketId: number; schrittId: number } | null => (s?.quelle && "paketId" in s.quelle ? s.quelle : null);

/**
 * Hat ein Planschritt eine Übung zum Senden? Ein Schritt eines Pakets mit Aufgaben; Grundlage, Üben und Lernkontrolle mit
 * Fähigkeit oder Übung aus dem Bestand; Erklären, Einstieg und Abschluss nicht. Ein alter Plan wie bisher.
 */
export function planHatUebung(s: PlanStep, quellen: Map<number, PlanQuelle>): boolean {
  if (paketQuelle(s)) return (quellen.get(s.id)?.schritt.aufgaben.length ?? 0) > 0;
  if (s.art && !["grundlage", "ueben", "kontrolle"].includes(s.art)) return false;
  return Boolean(s.skillId || s.uebung);
}

/** Die Art eines Planschritts für „Richtig / Teilweise / Falsch“: Erklären und Grundlage fragen, die Lernkontrolle prüft. */
function frageArtVon(s: PlanStep): LernpaketSchritt["art"] | null {
  const q = paketQuelle(s);
  if (q) return getSchritt(q.schrittId)?.art ?? null;
  return s.art === "kontrolle" ? "kontrolle" : s.art === "erklaeren" || s.art === "grundlage" ? "frage" : null;
}

export const planSchritte = (plan: PlanSchritt[]): PlanStep[] =>
  plan.map((p, i) => ({ id: -(i + 1), titel: p.titel, minuten: p.minuten, beschreibung: p.beschreibung, uebung: p.uebung, skillId: p.skillId ?? null }));

// ---------- the rules, without the database ----------

/**
 * Die Reihenfolge der Schritte in dieser Einheit: die gespeicherte, soweit es die Schritte noch gibt, dann
 * die übrigen in der Reihenfolge des Pakets (etwa ein Schritt, der während der Einheit dazukam).
 */
export function ablauf(schritte: Pick<LernpaketSchritt, "id">[], reihenfolge: number[]): number[] {
  const da = new Set(schritte.map((s) => s.id));
  const vorne = [...new Set(reihenfolge)].filter((id) => da.has(id));
  const gesetzt = new Set(vorne);
  return [...vorne, ...schritte.map((s) => s.id).filter((id) => !gesetzt.has(id))];
}

/** Weder erledigt noch übersprungen. */
const nichtFertig = (s: Pick<Stand, "erledigt" | "uebersprungen">, id: number) => !s.erledigt.includes(id) && !s.uebersprungen.includes(id);
/** Offen und dran: nicht fertig und nicht auf „Nächstes Mal“ verschoben (`takt.verschoben`). */
const istOffen = (s: Pick<Stand, "erledigt" | "uebersprungen"> & { takt?: Takt | null }, id: number) => nichtFertig(s, id) && !s.takt?.verschoben.includes(id);

/** Der Schritt auf dem Schirm: der gewählte, sonst der erste offene; null, wenn alle durch sind. */
export function aktuellerSchritt(order: number[], s: Pick<Stand, "aktuell" | "erledigt" | "uebersprungen"> & { takt?: Takt | null }): number | null {
  if (s.aktuell !== null && order.includes(s.aktuell)) return s.aktuell;
  return order.find((id) => istOffen(s, id)) ?? null;
}

/**
 * „Zur ersten Übung“: hat der Schritt auf dem Schirm keine Übung und ist in der Einheit noch keine gesendet, der erste
 * offene Schritt mit Übung, in der Reihenfolge dieser Einheit; sonst null. Der Sprung zeigt ihn nur
 * (`zeigeSchritt`): nichts wird erledigt oder übersprungen, die Reihenfolge bleibt.
 */
export function ersteUebung(order: number[], s: Pick<Stand, "erledigt" | "uebersprungen"> & { takt?: Takt | null }, aktuell: number | null, hatUebung: (id: number) => boolean, schonGesendet: boolean): number | null {
  if (aktuell === null || schonGesendet || hatUebung(aktuell)) return null;
  return order.find((id) => id !== aktuell && istOffen(s, id) && hatUebung(id)) ?? null;
}

/** Der nächste offene Schritt nach `id`, sonst der erste offene davor; null, wenn keiner mehr offen ist. */
function naechsterOffener(order: number[], s: Pick<Stand, "erledigt" | "uebersprungen"> & { takt?: Takt | null }, id: number): number | null {
  const i = order.indexOf(id);
  const danach = [...order.slice(i + 1), ...order.slice(0, Math.max(0, i))];
  return danach.find((x) => istOffen(s, x)) ?? null;
}

export type Markierung = "erledigt" | "uebersprungen" | "offen";

/**
 * „Erledigt / Weiter“ und „Überspringen“: der Schritt wird markiert und der nächste offene kommt auf den
 * Schirm. „offen“ nimmt die Markierung zurück und zeigt den Schritt wieder.
 */
export function markiere<S extends Pick<Stand, "aktuell" | "erledigt" | "uebersprungen"> & { takt?: Takt | null }>(s: S, order: number[], id: number, was: Markierung): S {
  const erledigt = s.erledigt.filter((x) => x !== id);
  const uebersprungen = s.uebersprungen.filter((x) => x !== id);
  if (was === "erledigt") erledigt.push(id);
  if (was === "uebersprungen") uebersprungen.push(id);
  const neu = { ...s, erledigt, uebersprungen };
  return { ...neu, aktuell: was === "offen" ? id : naechsterOffener(order, neu, id) };
}

export type Merke = "wiederholt" | "nichtVerstanden";

/**
 * „Wiederholen“ und „Schüler versteht es nicht“: zählt für den Schritt mit, und der Schritt bleibt (oder kommt
 * wieder) auf dem Schirm und offen. Beim Beenden kommt das in die Dokumentation (`dokumentiereAblauf`).
 */
export function merke<S extends Pick<Stand, "aktuell" | "erledigt" | "uebersprungen" | "wiederholt" | "nichtVerstanden">>(s: S, id: number, was: Merke): S {
  const zahl = { ...s[was], [id]: (s[was][id] ?? 0) + 1 };
  return { ...s, [was]: zahl, aktuell: id, erledigt: s.erledigt.filter((x) => x !== id), uebersprungen: s.uebersprungen.filter((x) => x !== id) };
}

/** Einen Schritt für diese Einheit nach vorne (-1) oder hinten (+1) schieben. */
export function verschiebe(order: number[], id: number, richtung: -1 | 1): number[] {
  const i = order.indexOf(id);
  const j = i + richtung;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const neu = [...order];
  [neu[i], neu[j]] = [neu[j], neu[i]];
  return neu;
}

export type Zusammenfassung<T> = { erledigt: T[]; uebersprungen: T[]; nichtErreicht: T[] };

/** Was aus dem Paket in dieser Einheit geschah, in der Reihenfolge der Einheit. */
export function zusammenfassung<T extends { id: number }>(schritte: T[], order: number[], s: Pick<Stand, "erledigt" | "uebersprungen">): Zusammenfassung<T> {
  const byId = new Map(schritte.map((x) => [x.id, x]));
  const liste = order.map((id) => byId.get(id)).filter((x): x is T => Boolean(x));
  return {
    erledigt: liste.filter((x) => s.erledigt.includes(x.id)),
    uebersprungen: liste.filter((x) => s.uebersprungen.includes(x.id)),
    // auf „Nächstes Mal“ verschoben ist auch nicht erreicht
    nichtErreicht: liste.filter((x) => nichtFertig(s, x.id)),
  };
}

/** Ein Schritt mit der Zahl, wie oft er wiederholt wurde oder nicht verstanden war. */
export type MitMal<T> = T & { mal: number };

/** Was in dieser Einheit geschah, mit „Wiederholen“ und „Schüler versteht es nicht“, in der Reihenfolge der Einheit. */
export type Ergebnis<T> = Zusammenfassung<T> & { wiederholt: MitMal<T>[]; nichtVerstanden: MitMal<T>[] };

export function ergebnis<T extends { id: number }>(schritte: T[], order: number[], s: Pick<Stand, "erledigt" | "uebersprungen" | "wiederholt" | "nichtVerstanden">): Ergebnis<T> {
  const z = zusammenfassung(schritte, order, s);
  const byId = new Map(schritte.map((x) => [x.id, x]));
  const liste = order.map((id) => byId.get(id)).filter((x): x is T => Boolean(x));
  const mit = (zahl: Record<string, number>) => liste.filter((x) => (zahl[x.id] ?? 0) > 0).map((x) => ({ ...x, mal: zahl[x.id] }));
  return { ...z, wiederholt: mit(s.wiederholt ?? {}), nichtVerstanden: mit(s.nichtVerstanden ?? {}) };
}

/** Eine Hilfe bei „Schüler versteht es nicht“: woher sie kommt, Text und, wo es eine gibt, die erwartete Antwort. */
/** `anpassung`: die Id einer übernommenen Anpassung, damit der Lehrer sie wieder entfernen kann. */
export type Hilfe = { titel: string; text: string; antwort: string; anpassung?: number };

/**
 * „Schüler versteht es nicht“: was es schon gibt, in dieser Reihenfolge, nichts Neues und ohne KI. „Bei Fehler“ aus
 * dem Paket, dann vom Lehrer übernommene Anpassungen dieses Schritts (Bei Fehler, leichtere Frage, Zusatzbeispiel;
 * keine schwerere, keine ungeprüften), dann die Erklärung und die typischen Fehler der Fähigkeit. Leer: nichts da.
 */
export function hilfeBeiFehler(
  beiFehler: string,
  angepasst: { id?: number; art: string; titel: string; text: string; antwort: string; status: string }[],
  faehigkeit: { erklaerung?: string | null; typischeFehler?: string[] } = {},
): Hilfe[] {
  const out: Hilfe[] = [];
  if (beiFehler.trim()) out.push({ titel: "Bei Fehler", text: beiFehler.trim(), antwort: "" });
  const rang = { bei_fehler: 0, leichter: 1, beispiel: 2 } as Record<string, number>;
  const genommen = angepasst.filter((a) => a.status === "uebernommen" && a.art in rang && a.text.trim()).sort((a, b) => rang[a.art] - rang[b.art]);
  const LABEL: Record<string, string> = { bei_fehler: "Angepasst: Bei Fehler", leichter: "Angepasst: Leichtere Frage", beispiel: "Angepasst: Zusatzbeispiel" };
  for (const a of genommen) out.push({ titel: `${LABEL[a.art]}${a.titel.trim() ? ` – ${a.titel.trim()}` : ""}`, text: a.text.trim(), antwort: a.antwort.trim(), ...(a.id ? { anpassung: a.id } : {}) });
  if (faehigkeit.erklaerung?.trim()) out.push({ titel: "Einfach erklärt", text: faehigkeit.erklaerung.trim(), antwort: "" });
  const fehler = (faehigkeit.typischeFehler ?? []).filter((f) => f.trim());
  if (fehler.length) out.push({ titel: "Typische Fehler", text: fehler.map((f) => `– ${f}`).join("\n"), antwort: "" });
  return out;
}

export type DokuTexte = { gemacht: string; wiederholen: string | null; wiederholt: string | null; naechstesMal: string | null; schwierig: string | null };

/** Anfang der Zeilen, die das Cockpit in die Dokumentation schreibt (zum Ersetzen beim zweiten Mal). */
const ZEILE = { gemacht: ["Lernpaket „", "Plan für heute: "], wiederholen: "Übersprungen ", wiederholt: "Wiederholt ", naechstesMal: "Weiter mit ", schwierig: "Nicht verstanden " } as const;

/**
 * Die Sätze für die Dokumentation, nur aus dem, was der Lehrer getippt hat. Ohne erledigten, übersprungenen,
 * wiederholten oder nicht verstandenen Schritt null: dann wurde das Cockpit nicht benutzt, und „nicht erreicht“
 * wäre geraten. `art` „plan“: die Schritte kamen aus dem „Plan für heute“ des Briefings (ohne Lernpaket). `schritte`: so
 * viele Schritte zählen, wenn „nicht erreicht“ ein ganzes Thema als einen Namen hat (`ablaufDesPlans`).
 */
export function dokuTexte(
  titel: string,
  z: Zusammenfassung<{ titel: string }> & Partial<Pick<Ergebnis<{ titel: string }>, "wiederholt" | "nichtVerstanden">>,
  art: "paket" | "plan" = "paket",
  schritte?: number,
): DokuTexte | null {
  const wiederholt = z.wiederholt ?? [];
  const nichtVerstanden = z.nichtVerstanden ?? [];
  if (!z.erledigt.length && !z.uebersprungen.length && !wiederholt.length && !nichtVerstanden.length) return null;
  const gesamt = schritte ?? z.erledigt.length + z.uebersprungen.length + z.nichtErreicht.length;
  const namen = (xs: { titel: string }[]) => xs.map((x) => x.titel).join(", ");
  const mitMal = (xs: { titel: string; mal: number }[]) => xs.map((x) => (x.mal > 1 ? `${x.titel} (${x.mal}×)` : x.titel)).join(", ");
  const kopf = art === "plan" ? "Plan für heute" : `Lernpaket „${titel}“`;
  const darin = art === "plan" ? "im Plan für heute" : `in „${titel}“`;
  const teile = [`${kopf}: ${z.erledigt.length} von ${gesamt} Schritten erledigt${z.erledigt.length ? ` (${namen(z.erledigt)})` : ""}.`];
  if (z.uebersprungen.length) teile.push(`Übersprungen: ${namen(z.uebersprungen)}.`);
  if (z.nichtErreicht.length) teile.push(`Nicht erreicht: ${namen(z.nichtErreicht)}.`);
  return {
    gemacht: teile.join(" "),
    wiederholen: z.uebersprungen.length ? `${ZEILE.wiederholen}${darin}: ${namen(z.uebersprungen)}` : null,
    wiederholt: wiederholt.length ? `${ZEILE.wiederholt}${darin}: ${mitMal(wiederholt)}` : null,
    naechstesMal: z.nichtErreicht.length ? `${ZEILE.naechstesMal}${art === "plan" ? "dem Plan für heute" : `„${titel}“`}: ${namen(z.nichtErreicht)}` : null,
    schwierig: nichtVerstanden.length ? `${ZEILE.schwierig}${darin}: ${mitMal(nichtVerstanden)}` : null,
  };
}

/** Ersetzt die Zeile des Cockpits in einem Feld (oder hängt sie an); `neu` null entfernt sie. */
export function mitZeile(text: string, anfang: string, neu: string | null): string {
  const zeilen = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((z) => !z.startsWith(anfang));
  return [...zeilen, ...(neu ? [neu] : [])].filter((z) => z.trim()).join("\n");
}

// ---------- reading and writing ----------

type Row = {
  unit_id: number;
  paket_id: number | null;
  skill_id: string | null;
  reihenfolge: string;
  aktuell: number | null;
  erledigt: string;
  uebersprungen: string;
  notizen: string;
  gesendet: string;
  wiederholt: string;
  nicht_verstanden: string;
  plan: string | null;
  antworten: string | null;
  steuerung: string | null;
  takt: string | null;
  updated_at: string;
};

const zuStand = (r: Row): Stand => ({
  unit_id: r.unit_id,
  paket_id: r.paket_id,
  skill_id: r.skill_id,
  reihenfolge: json<number[]>(r.reihenfolge, []),
  aktuell: r.aktuell,
  erledigt: json<number[]>(r.erledigt, []),
  uebersprungen: json<number[]>(r.uebersprungen, []),
  notizen: json<Record<string, string>>(r.notizen, {}),
  gesendet: json<Record<string, number[]>>(r.gesendet, {}),
  wiederholt: json<Record<string, number>>(r.wiederholt, {}),
  nichtVerstanden: json<Record<string, number>>(r.nicht_verstanden, {}),
  plan: r.plan ? json<PlanStep[] | null>(r.plan, null) : null,
  // alte Zeilen (vor der Anpassung im Unterricht) haben beides nicht
  antworten: Object.fromEntries(Object.entries(json<Record<string, unknown>>(r.antworten ?? "{}", {})).filter((e): e is [string, Beobachtung] => isBeobachtung(e[1]))),
  steuerung: { bis: 0, signal: null, ...json<Partial<Steuerung>>(r.steuerung ?? "{}", {}) },
  takt: r.takt ? json<Takt | null>(r.takt, null) : null,
  vorbereitet: false,
  automatisch: null,
  updated_at: r.updated_at,
});

function gespeichert(unitId: number): Stand | null {
  const r = db().prepare("SELECT * FROM einheit_cockpit WHERE unit_id = ?").get(unitId) as Row | undefined;
  return r ? zuStand(r) : null;
}

/** Der Tag einer Einheit in Wien, für „Einheit vorbereiten“. */
const tagDerEinheit = (startedAt: string) => wienerDatum(new Date(startedAt));

/**
 * Der Stand des Cockpits einer Einheit. Ist noch nichts gespeichert, gilt das Lernpaket aus „Einheit
 * vorbereiten“ für diesen Schüler und Tag (noch ungespeichert, `vorbereitet`); hat der Lehrer keines gewählt, der Plan
 * für die ganze Einheit (lib/stundenplan.ts): er nimmt die passenden geprüften Pakete selbst auf, je Thema eines.
 */
export function leseStand(unitId: number): Stand {
  const s = gespeichert(unitId);
  if (s) return s;
  const unit = getUnit(unitId);
  const v = unit ? vorbereitung(unit.student_id, tagDerEinheit(unit.started_at)) : null;
  if (v && getLernpaket(v.paket_id)) return { ...leer(unitId), paket_id: v.paket_id, vorbereitet: true };
  return leer(unitId);
}

function speichere(s: Stand) {
  db()
    .prepare(
      `INSERT INTO einheit_cockpit (unit_id, paket_id, skill_id, reihenfolge, aktuell, erledigt, uebersprungen, notizen, gesendet, wiederholt, nicht_verstanden, plan, antworten, steuerung, takt, updated_at)
       VALUES (@unit_id, @paket_id, @skill_id, @reihenfolge, @aktuell, @erledigt, @uebersprungen, @notizen, @gesendet, @wiederholt, @nicht_verstanden, @plan, @antworten, @steuerung, @takt, datetime('now'))
       ON CONFLICT(unit_id) DO UPDATE SET paket_id = excluded.paket_id, skill_id = excluded.skill_id, reihenfolge = excluded.reihenfolge, aktuell = excluded.aktuell,
         erledigt = excluded.erledigt, uebersprungen = excluded.uebersprungen, notizen = excluded.notizen, gesendet = excluded.gesendet,
         wiederholt = excluded.wiederholt, nicht_verstanden = excluded.nicht_verstanden, plan = excluded.plan, antworten = excluded.antworten,
         steuerung = excluded.steuerung, takt = excluded.takt, updated_at = excluded.updated_at`,
    )
    .run({
      unit_id: s.unit_id,
      paket_id: s.paket_id,
      skill_id: s.skill_id,
      reihenfolge: JSON.stringify(s.reihenfolge),
      aktuell: s.aktuell,
      erledigt: JSON.stringify(s.erledigt),
      uebersprungen: JSON.stringify(s.uebersprungen),
      notizen: JSON.stringify(s.notizen),
      gesendet: JSON.stringify(s.gesendet),
      wiederholt: JSON.stringify(s.wiederholt),
      nicht_verstanden: JSON.stringify(s.nichtVerstanden),
      plan: s.plan ? JSON.stringify(s.plan) : null,
      antworten: JSON.stringify(s.antworten),
      steuerung: JSON.stringify(s.steuerung),
      takt: s.takt ? JSON.stringify(s.takt) : null,
    });
}

/** Lesen, ändern, speichern in einem Zug (zwei Geräte zugleich überschreiben einander nicht halb). */
function aendere(unitId: number, f: (s: Stand) => Stand): Stand {
  const conn = db();
  let neu = leer(unitId);
  conn.transaction(() => {
    neu = f(leseStand(unitId));
    speichere(neu);
  })();
  return neu;
}

/** Ein Planschritt aus einem Lernpaket: das Paket und sein Schritt (Texte, Folie, Aufgaben). */
export type PlanQuelle = { paket: LernpaketMitSchritten; schritt: LernpaketSchritt };

export type CockpitDaten = {
  stand: Stand;
  paket: LernpaketMitSchritten | null;
  /** die Schritte in der Reihenfolge dieser Einheit */
  schritte: LernpaketSchritt[];
  /** der Schritt auf dem Schirm; null = alle durch (oder kein Paket) */
  aktuell: LernpaketSchritt | null;
  /** Minute, ab der ein Schritt geplant ist, je Schritt-Id */
  ab: Map<number, number>;
  /** ohne Lernpaket: der „Plan für heute“ in der Reihenfolge dieser Einheit (der festgehaltene, sonst der von jetzt) */
  plan: PlanStep[];
  /** ohne Lernpaket: der Planschritt auf dem Schirm; null = alle durch (oder kein Plan) */
  planAktuell: PlanStep | null;
  /** ohne Lernpaket: die Planschritte, die aus einem Lernpaket kommen, je Schritt-Id */
  planQuellen: Map<number, PlanQuelle>;
  /** Minuten je Schritt-Id, im Plan nach der echten Zeit neu getaktet (`takt`), sonst wie geplant */
  minuten: Map<number, number>;
  /** im Plan: offene Schritte, die auf „Nächstes Mal“ verschoben sind (zu wenig Zeit heute) */
  verschoben: Set<number>;
};

/** Die Pakete und Schritte, auf die Planschritte zeigen (je Paket eine Abfrage). */
function quellenVon(plan: PlanStep[]): Map<number, PlanQuelle> {
  const out = new Map<number, PlanQuelle>();
  const pakete = new Map<number, LernpaketMitSchritten | null>();
  for (const s of plan) {
    const q = paketQuelle(s);
    if (!q) continue;
    if (!pakete.has(q.paketId)) pakete.set(q.paketId, getLernpaket(q.paketId));
    const p = pakete.get(q.paketId);
    const schritt = p?.schritte.find((x) => x.id === q.schrittId);
    if (p && schritt) out.set(s.id, { paket: p, schritt });
  }
  return out;
}

/** Das Lernpaket des Schritts auf dem Schirm: das der Einheit, sonst das, aus dem der Planschritt kommt. */
export function paketImSchritt(c: Partial<Pick<CockpitDaten, "paket" | "planAktuell" | "planQuellen">>): LernpaketMitSchritten | null {
  if (c.paket) return c.paket;
  return c.planAktuell ? (c.planQuellen?.get(c.planAktuell.id)?.paket ?? null) : null;
}

/** Minute, ab der jeder Schritt geplant ist. */
const minutenAb = (schritte: { id: number; minuten: number }[]) => {
  const ab = new Map<number, number>();
  schritte.reduce((min, s) => (ab.set(s.id, min), min + s.minuten), 0);
  return ab;
};

/**
 * Der „Plan für heute“ für eine laufende Einheit ohne eigens gewähltes Lernpaket: der Plan für die ganze Einheit
 * (lib/stundenplan.ts, ohne KI), mit der geplanten Dauer des Platzes, der Vorgabe für heute und den Signalen der
 * automatischen Vorbereitung (dieselben wie auf Heute). Liest nur.
 */
export function planDerEinheit(unitId: number): PlanStep[] {
  const unit = getUnit(unitId);
  if (!unit || unit.status !== "gestartet") return [];
  return stundenplanFuer(unit.student_id, { datum: tagDerEinheit(unit.started_at), fach: unit.subject ?? "", platzId: platzFuerEinheit(unit)?.id ?? null, unitId: unit.id });
}

/**
 * Alles, was die Seite für das Cockpit braucht. `mitPlan`: ohne Lernpaket auch den „Plan für heute“ (das Briefing
 * wird dafür gerechnet, also nur, wo er gezeigt wird).
 */
export function cockpit(unitId: number, o: { mitPlan?: boolean } = {}): CockpitDaten {
  const stand = leseStand(unitId);
  const paket = stand.paket_id ? getLernpaket(stand.paket_id) : null;
  if (!paket) {
    const roh = stand.plan ?? (o.mitPlan ? planDerEinheit(unitId) : []);
    const order = ablauf(roh, stand.reihenfolge);
    const byId = new Map(roh.map((s) => [s.id, s]));
    const plan = order.map((id) => byId.get(id)!);
    const id = aktuellerSchritt(order, stand);
    // re-timed while the unit runs (lib/stundenplan.ts neuTakten): its minutes and start, else as planned
    const takt = stand.plan ? stand.takt : null;
    const geplantAb = minutenAb(plan);
    const ab = new Map(plan.map((s) => [s.id, takt?.ab[s.id] ?? geplantAb.get(s.id)!] as const).filter((e) => !takt?.verschoben.includes(e[0])));
    const minuten = new Map(plan.map((s) => [s.id, takt?.minuten[s.id] ?? s.minuten]));
    const verschoben = new Set((takt?.verschoben ?? []).filter((x) => nichtFertig(stand, x)));
    return { stand, paket: null, schritte: [], aktuell: null, ab, plan, planAktuell: id === null ? null : byId.get(id)!, planQuellen: quellenVon(plan), minuten, verschoben };
  }
  const order = ablauf(paket.schritte, stand.reihenfolge);
  const byId = new Map(paket.schritte.map((s) => [s.id, s]));
  const schritte = order.map((id) => byId.get(id)!);
  const id = aktuellerSchritt(order, stand);
  return { stand, paket, schritte, aktuell: id === null ? null : byId.get(id)!, ab: minutenAb(schritte), plan: [], planAktuell: null, planQuellen: new Map(), minuten: new Map(schritte.map((s) => [s.id, s.minuten])), verschoben: new Set() };
}

/** Ein Lernpaket für die Einheit wählen (null: ohne Lernpaket). Ein anderes Paket fängt von vorne an. */
export function waehlePaket(unitId: number, paketId: number | null): { ok: true } | { fehler: string } {
  const p = paketId ? getLernpaket(paketId) : null;
  if (paketId && (!p || p.status === "archiviert")) return { fehler: "Dieses Lernpaket gibt es nicht mehr." };
  if (p && !p.schritte.length) return { fehler: "Dieses Lernpaket hat noch keine Schritte." };
  aendere(unitId, (s) =>
    s.paket_id === paketId && !s.vorbereitet ? s : { ...s, paket_id: paketId, reihenfolge: [], aktuell: null, erledigt: [], uebersprungen: [], wiederholt: {}, nichtVerstanden: {}, plan: null, takt: null },
  );
  eigeneWahl(unitId);
  return { ok: true };
}

/** Der Lehrer hat selbst ein Paket oder eine Fähigkeit gewählt: der Ablauf folgt nicht mehr der Vorgabe für heute. */
const eigeneWahl = (unitId: number) => db().prepare("UPDATE einheit_vorgabe SET angewendet = 0 WHERE unit_id = ?").run(unitId);

/**
 * Hat der Lehrer in dieser Einheit schon etwas getan: einen Schritt erledigt, übersprungen, wiederholt, als nicht
 * verstanden markiert oder eine Übung gesendet? Dann ändert eine neue „Vorgabe für heute“ den Ablauf nicht von selbst.
 */
export const hatBegonnen = (s: Pick<Stand, "erledigt" | "uebersprungen" | "wiederholt" | "nichtVerstanden" | "gesendet">) =>
  s.erledigt.length > 0 || s.uebersprungen.length > 0 || Object.keys(s.wiederholt).length > 0 || Object.keys(s.nichtVerstanden).length > 0 || Object.keys(s.gesendet).length > 0;

/**
 * Den Ablauf neu aufsetzen („Plan anpassen“ nach einer Vorgabe für heute): das Lernpaket (null: der Plan aus den
 * Daten, beim nächsten Tippen neu festgehalten), Fortschritt und Reihenfolge von vorne. Notizen und gesendete
 * Übungen bleiben.
 */
export function planNeu(unitId: number, paketId: number | null): { ok: true } | { fehler: string } {
  const p = paketId ? getLernpaket(paketId) : null;
  if (paketId && (!p || p.status === "archiviert" || !p.schritte.length)) return { fehler: "Dieses Lernpaket gibt es nicht mehr." };
  aendere(unitId, (s) => ({ ...s, paket_id: paketId, skill_id: null, reihenfolge: [], aktuell: null, erledigt: [], uebersprungen: [], wiederholt: {}, nichtVerstanden: {}, plan: null, takt: null }));
  return { ok: true };
}

/**
 * Ohne Lernpaket: die Fähigkeit, um die es heute geht. Kommt die Einheit von einem Paket, fängt der „Plan für heute“
 * von vorne an; war sie schon ohne Paket, bleibt sein Stand.
 */
export function waehleFaehigkeit(unitId: number, skillId: string | null): { ok: true } | { fehler: string } {
  if (skillId && !repo.getSkill(skillId)) return { fehler: "Diese Fähigkeit gibt es nicht." };
  aendere(unitId, (s) =>
    s.paket_id === null && !s.vorbereitet
      ? { ...s, skill_id: skillId }
      : { ...s, paket_id: null, skill_id: skillId, reihenfolge: [], aktuell: null, erledigt: [], uebersprungen: [], wiederholt: {}, nichtVerstanden: {}, plan: null, takt: null },
  );
  eigeneWahl(unitId);
  return { ok: true };
}

/**
 * Prüft, dass der Schritt zur Einheit gehört, und gibt die Reihenfolge mit: ein Schritt des Lernpakets, ohne Paket ein
 * Schritt des „Plans für heute“. Der Plan wird beim ersten Tippen festgehalten, damit er sich während der Einheit
 * nicht mehr ändert (neue Antworten ändern sonst die Empfehlung und damit den Plan).
 */
function mitSchritt(unitId: number, schrittId: number, f: (s: Stand, order: number[]) => Stand): boolean {
  const s = leseStand(unitId);
  const p = s.paket_id ? getLernpaket(s.paket_id) : null;
  if (p) {
    if (!p.schritte.some((x) => x.id === schrittId)) return false;
    aendere(unitId, (cur) => f(cur, ablauf(p.schritte, cur.reihenfolge)));
    return true;
  }
  const plan = s.plan ?? (schrittId < 0 ? planDerEinheit(unitId) : []);
  if (!plan.some((x) => x.id === schrittId)) return false;
  aendere(unitId, (cur) => {
    const fest = cur.plan ?? plan;
    return f({ ...cur, plan: fest }, ablauf(fest, cur.reihenfolge));
  });
  return true;
}

// ---------- the time adapts ----------

/**
 * Wo die Einheit in der Zeit steht: `jetzt` die Minute seit dem Start, `rest` die Minuten, die bleiben. Nie mehr als der Plan
 * selbst hat (eine Einheit, die 20 Minuten vor ihrem Platz beginnt, bekommt nicht 120 statt 100 Minuten), und nie über das Ende
 * des Platzes hinaus: rest = min(bis zum Ende des Platzes, geplante Minuten − jetzt).
 */
export function zeitDerEinheit(unit: { id: number; started_at: string }, geplant: number, now = new Date()): { jetzt: number; rest: number } {
  const jetzt = Math.max(0, Math.floor((now.getTime() - Date.parse(unit.started_at)) / 60_000));
  const platz = platzFuerEinheit(unit);
  const bisEnde = platz ? zeitfenster(platz, now).restMinuten : null;
  return { jetzt, rest: Math.max(0, Math.min(geplant - jetzt, bisEnde ?? Infinity)) };
}

/**
 * Beim Weitergehen im Plan (Weiter, Überspringen, ein Schritt angetippt, verschoben): den Rest nach der echten Zeit neu takten
 * (lib/stundenplan.ts `neuTakten`). Nur im Plan für die ganze Einheit; ein gewähltes Lernpaket behält seine Minuten.
 */
function mitTakt(unit: { id: number; started_at: string } | null, s: Stand, order: number[], now = new Date()): Stand {
  if (s.paket_id || !s.plan?.length || !unit) return s;
  const byId = new Map(s.plan.map((x) => [x.id, x]));
  const schritte = order.map((id) => byId.get(id)!).map((x) => ({ id: x.id, minuten: x.minuten, thema: x.thema ?? null, kontrolle: frageArtVon(x) === "kontrolle" }));
  const { jetzt, rest } = zeitDerEinheit(unit, s.plan.reduce((a, x) => a + x.minuten, 0), now);
  const takt = neuTakten(schritte, { fertig: [...s.erledigt, ...s.uebersprungen], aktuell: aktuellerSchritt(order, s), jetzt, rest, vorher: s.takt });
  return { ...s, takt };
}

/** Weiter, Überspringen, Wieder öffnen; ein Zeichen des Lehrers zum Schritt gilt danach nicht mehr. Der Rest wird neu getaktet. */
export const markiereSchritt = (unitId: number, schrittId: number, was: Markierung) =>
  mitSchritt(unitId, schrittId, (s, order) => mitTakt(getUnit(unitId), { ...markiere(s, order, schrittId, was), steuerung: { ...s.steuerung, signal: null } }, order));

/**
 * „Wiederholen“ oder „Schüler versteht es nicht“ für einen Schritt (Lernpaket oder Plan). „Versteht es nicht“ ist auch ein
 * Zeichen für die Anpassung im Unterricht: sie schlägt den leichteren Weg vor (lib/steuerung.ts).
 */
export const merkeSchritt = (unitId: number, schrittId: number, was: Merke) =>
  mitSchritt(unitId, schrittId, (s) => {
    const neu = merke(s, schrittId, was);
    return was === "nichtVerstanden" ? { ...neu, steuerung: { ...s.steuerung, signal: { schritt: schrittId, art: "nicht_verstanden" } } } : neu;
  });

/** Schritte, bei denen der Lehrer eine Antwort hört: Verständnisfrage und Kontrolle. */
export const FRAGE_ARTEN: readonly LernpaketSchritt["art"][] = ["frage", "kontrolle"];

/**
 * „Richtig / Teilweise / Falsch“ bei einer Frage oder Kontrolle des Lernpakets, im Plan auch bei Erklären, Grundlage und
 * Lernkontrolle: was der Lehrer gehört hat (null nimmt es zurück). „Falsch“ ist ein Zeichen für die Anpassung im
 * Unterricht; Richtig und Teilweise nehmen es zurück. Nur Beobachtungen, der Lernstand bleibt unberührt; der Abschluss
 * kann sie als Beleg lesen (`antwortenDerEinheit`).
 */
export function setzeAntwort(unitId: number, schrittId: number, wert: Beobachtung | null): boolean {
  const s = leseStand(unitId);
  const p = s.paket_id ? getLernpaket(s.paket_id) : null;
  const ps = p ? null : (s.plan ?? (schrittId < 0 ? planDerEinheit(unitId) : [])).find((x) => x.id === schrittId);
  const art = p ? (p.schritte.find((x) => x.id === schrittId)?.art ?? null) : ps ? frageArtVon(ps) : null;
  if (!art || !FRAGE_ARTEN.includes(art)) return false;
  return mitSchritt(unitId, schrittId, (cur) => {
    const antworten = { ...cur.antworten };
    if (wert) antworten[schrittId] = wert;
    else delete antworten[schrittId];
    const signal = wert === "falsch" ? { schritt: schrittId, art: "falsch" as const } : cur.steuerung.signal?.schritt === schrittId ? null : cur.steuerung.signal;
    return { ...cur, antworten, steuerung: { ...cur.steuerung, signal } };
  });
}

/**
 * Der Lehrer hat auf den Vorschlag reagiert (gesendet, weiter, an die Tafel, nicht nötig): was bis jetzt geantwortet
 * wurde, zählt für den nächsten Vorschlag nicht mehr, und das Zeichen zum Schritt ist erledigt. `gesendet`: die Aufgaben,
 * die dabei an den Schüler gingen; sie bleiben für den Abschluss gemerkt.
 */
export function reagiert(unitId: number, gesendet?: Omit<Reaktion, "at">): void {
  const max = (db().prepare("SELECT MAX(id) AS id FROM attempts WHERE unit_id = ?").get(unitId) as { id: number | null }).id ?? 0;
  aendere(unitId, (s) => {
    const bisher = s.steuerung.reaktionen ?? [];
    const reaktionen = gesendet ? [...bisher, { ...gesendet, at: new Date().toISOString() }].slice(-REAKTIONEN_MAX) : bisher;
    return { ...s, steuerung: { bis: Math.max(s.steuerung.bis, max), signal: null, ...(reaktionen.length ? { reaktionen } : {}) } };
  });
}

/** Für den Abschluss: die gemerkten Reaktionen mit gesendeten Aufgaben, älteste zuerst; nur Gespeichertes. */
export function reaktionenDerEinheit(unitId: number): Reaktion[] {
  return gespeichert(unitId)?.steuerung.reaktionen ?? [];
}

/** Die Fähigkeiten eines Schritts des Lernpakets: aus seinen Aufgaben, sonst die erste des Pakets (wie lib/steuerung.ts). */
export function skillsDesSchritts(schritt: Pick<LernpaketSchritt, "aufgaben" | "paket_id">): string[] {
  const ids = [...new Set(schritt.aufgaben.flatMap((a) => [a.skillId, ...(a.skillIds ?? [])]).filter((x): x is string => Boolean(x)))];
  return ids.length ? ids : (getLernpaket(schritt.paket_id)?.skill_ids.slice(0, 1) ?? []);
}

/** Für den Abschluss: die Fähigkeiten der Schritte, die der Lehrer als erledigt getippt hat (Lernpaket oder Plan). */
export function skillsErledigterSchritte(unitId: number): string[] {
  const s = gespeichert(unitId);
  if (!s?.erledigt.length) return [];
  const p = s.paket_id ? getLernpaket(s.paket_id) : null;
  const ids = p
    ? p.schritte.filter((x) => s.erledigt.includes(x.id)).flatMap(skillsDesSchritts)
    : (s.plan ?? []).filter((x) => s.erledigt.includes(x.id) && x.skillId).map((x) => x.skillId!);
  return [...new Set(ids)];
}

/**
 * Für den Abschluss: was der Lehrer bei Fragen und Kontrollen gehört hat, nur Gespeichertes, in der Reihenfolge der
 * Schritte, mit den Fähigkeiten des Schritts. Im Plan zählen auch Schritte aus Paketen, Erklären, Grundlage und die
 * Lernkontrolle eines Themas.
 */
export function antwortenDerEinheit(unitId: number): { schrittId: number; titel: string; art: LernpaketSchritt["art"]; antwort: Beobachtung; skillIds: string[] }[] {
  const s = gespeichert(unitId);
  if (!s) return [];
  const plan = s.plan ?? [];
  const order = ablauf(plan, s.reihenfolge);
  const imPlan = Object.entries(s.antworten).flatMap(([id, antwort]) => {
    const ps = Number(id) < 0 ? plan.find((x) => x.id === Number(id)) : undefined;
    const q = paketQuelle(ps);
    const schritt = q ? getSchritt(q.schrittId) : null;
    if (!ps || (q && !schritt)) return [];
    const art = schritt?.art ?? frageArtVon(ps) ?? "frage";
    return [{ schrittId: ps.id, titel: schritt?.titel ?? ps.titel, art, antwort, skillIds: schritt ? skillsDesSchritts(schritt) : ps.skillId ? [ps.skillId] : [], rang: order.indexOf(ps.id) }];
  });
  const imPaket = Object.entries(s.antworten)
    .map(([id, antwort]) => ({ schritt: Number(id) > 0 ? getSchritt(Number(id)) : null, antwort }))
    .filter((x): x is { schritt: LernpaketSchritt; antwort: Beobachtung } => x.schritt !== null)
    .sort((a, b) => a.schritt.paket_id - b.schritt.paket_id || a.schritt.position - b.schritt.position)
    .map(({ schritt, antwort }) => ({ schrittId: schritt.id, titel: schritt.titel, art: schritt.art, antwort, skillIds: skillsDesSchritts(schritt) }));
  return [...imPlan.sort((a, b) => a.rang - b.rang).map(({ schrittId, titel, art, antwort, skillIds }) => ({ schrittId, titel, art, antwort, skillIds })), ...imPaket];
}

export const zeigeSchritt = (unitId: number, schrittId: number) => mitSchritt(unitId, schrittId, (s, order) => mitTakt(getUnit(unitId), { ...s, aktuell: schrittId }, order));

export const verschiebeSchritt = (unitId: number, schrittId: number, richtung: -1 | 1) =>
  mitSchritt(unitId, schrittId, (s, order) => {
    const reihenfolge = verschiebe(order, schrittId, richtung);
    return mitTakt(getUnit(unitId), { ...s, reihenfolge }, reihenfolge);
  });

export function setzeNotiz(unitId: number, schrittId: number, text: string): boolean {
  const t = text.replace(/\r\n/g, "\n").trim().slice(0, NOTIZ_MAX);
  return mitSchritt(unitId, schrittId, (s) => {
    const notizen = { ...s.notizen };
    if (t) notizen[schrittId] = t;
    else delete notizen[schrittId];
    return { ...s, notizen };
  });
}

// ---------- sending the tasks of a step ----------

/**
 * Woher die Aufgaben eines Pakets stammen (`tasks.source_type`); das Paket speichert es nicht je Aufgabe.
 * Ein importiertes Paket hat keine geprüfte Quelle mit Lizenz: es zählt als „importiert“ (lib/library.ts).
 */
export const HERKUNFT: Record<PaketQuelle, string> = { hand: "eigen", ki: "ki", import: "importiert" };

/** Eine Aufgabe des Pakets, wie sie zum Schüler geht: ohne Prüfhinweise, mit Herkunft. */
export function aufgabeFuerSchueler(a: TaskDraft, quelle: PaketQuelle): TaskDraft {
  const { pruefen: _p, ...data } = a.data;
  void _p;
  const { sourceId: _i, ...rest } = a;
  void _i;
  return { ...rest, data, sourceType: HERKUNFT[quelle] };
}

/**
 * „Übung senden“: die Aufgaben eines Schritts als Übung an den Schüler **dieser** Einheit, auch wenn der
 * Lehrer zwei Einheiten zugleich hat. Gibt Übung und Zuweisung zurück; aufs Gerät bringt sie die Aktion.
 * Im Plan für heute (`schrittId` negativ): der Paketschritt, auf den der Planschritt zeigt; das erste Senden hält den Plan
 * fest wie jedes Tippen (`mitSchritt`).
 */
export function sendeSchritt(unitId: number, schrittId: number, teacherId: number | null): { worksheetId: number; assignmentId: number } | { fehler: string } {
  const unit = getUnit(unitId);
  if (!unit || unit.status !== "gestartet") return { fehler: "Diese Einheit läuft nicht mehr." };
  const s = leseStand(unitId);
  const plan = s.paket_id ? null : (s.plan ?? (schrittId < 0 ? planDerEinheit(unitId) : []));
  const q = plan ? paketQuelle(plan.find((x) => x.id === schrittId)) : null;
  const schritt = getSchritt(q ? q.schrittId : schrittId);
  const p = s.paket_id ? getLernpaket(s.paket_id) : q ? getLernpaket(q.paketId) : null;
  if (!p || !schritt || schritt.paket_id !== p.id) return { fehler: plan ? "Dieser Schritt gehört nicht zum Plan der Einheit." : "Dieser Schritt gehört nicht zum Lernpaket der Einheit." };
  if (!schritt.aufgaben.length) return { fehler: "Dieser Schritt hat keine Aufgaben." };
  const tasks = schritt.aufgaben.map((a) => aufgabeFuerSchueler(a, p.quelle));
  for (const [i, t] of tasks.entries()) {
    const problem = checkTask(t);
    if (problem) return { fehler: `Aufgabe ${i + 1}: ${problem}` };
  }
  const student = repo.getStudent(unit.student_id);
  if (!student) return { fehler: "Schüler nicht gefunden." };
  const typen = [...new Set(tasks.map((t) => t.type))];
  const conn = db();
  let worksheetId = 0;
  let assignmentId = 0;
  conn.transaction(() => {
    worksheetId = repo.createWorksheet(
      {
        title: `${student.name.split(" ")[0]} – ${p.title}: ${schritt.titel}`.slice(0, 160),
        subject: p.fach,
        grade: student.klasse ? schulstufe(student.school_type, student.klasse) : student.grade,
        school_type: student.school_type,
        klasse: student.klasse,
        topic: p.thema || p.title,
        difficulty: p.schwierigkeit,
        task_type: typen.length === 1 ? typen[0] : "mixed",
        kind: schritt.art === "kontrolle" ? "ueberpruefung" : "uebung",
        source: p.quelle === "ki" ? "ki" : "manuell",
        skill_ids: [...new Set(tasks.flatMap((t) => [t.skillId, ...(t.skillIds ?? [])]).filter((x): x is string => Boolean(x)))],
        student_id: student.id,
        teacher_id: teacherId,
        status: "freigegeben",
      },
      tasks,
    );
    assignmentId = repo.assignWorksheet(worksheetId, student.id, "", unit.id);
  })();
  aendere(unitId, (cur) => ({ ...cur, ...(plan && !cur.paket_id ? { plan: cur.plan ?? plan } : {}), gesendet: { ...cur.gesendet, [schrittId]: [...(cur.gesendet[schrittId] ?? []), worksheetId] } }));
  return { worksheetId, assignmentId };
}

// ---------- documentation when the unit ends ----------

/**
 * Schreibt beim Beenden, was mit dem Lernpaket geschah: „Was gemacht“ bekommt erledigte, übersprungene und
 * nicht erreichte Schritte, „Wiederholen“ die übersprungenen, „Nächstes Lernziel“ die nicht erreichten.
 * Nur in leere oder noch automatische Felder; was der Lehrer geschrieben hat, bleibt. Ein zweiter Lauf
 * ersetzt die eigenen Zeilen, statt sie zu verdoppeln.
 */
export function dokumentiereAblauf(lessonId: number, unitId: number): DokuTexte | null {
  const s = gespeichert(unitId);
  const lesson = repo.getLesson(lessonId);
  const a = s ? ablaufVon(s) : null;
  if (!s || !a || !lesson) return null;
  const t = dokuTexte(a.titel, a.ergebnis, a.art, a.schritte);
  if (!t) return null;
  const auto = autoFelderVon(lesson);
  const werte = json<Record<string, unknown>>(lesson.auto_felder, {});
  type Feld = "activities" | "review_topics" | "next_steps" | "difficulties";
  const neu: Partial<Record<Feld, string>> = {};
  const setze = (feld: Feld, zeilen: [anfang: string, zeile: string | null][]) => {
    const bisher = lesson[feld] ?? "";
    if (bisher.trim() && !auto.has(feld)) return;
    const wert = zeilen.reduce((text, [anfang, zeile]) => mitZeile(text, anfang, zeile), bisher);
    neu[feld] = wert;
    if (wert.trim()) werte[feld] = wert;
    else delete werte[feld];
  };
  // a line of the other kind (package / plan) goes: only one of them describes this unit
  const [paketZeile, planZeile] = ZEILE.gemacht;
  setze("activities", a.art === "plan" ? [[paketZeile, null], [planZeile, t.gemacht]] : [[planZeile, null], [paketZeile, t.gemacht]]);
  setze("review_topics", [
    [ZEILE.wiederholen, t.wiederholen],
    [ZEILE.wiederholt, t.wiederholt],
  ]);
  setze("next_steps", [[ZEILE.naechstesMal, t.naechstesMal]]);
  setze("difficulties", [[ZEILE.schwierig, t.schwierig]]);
  if (!Object.keys(neu).length) return t;
  repo.saveLesson({ ...lesson, ...neu }, lesson.id);
  db().prepare("UPDATE lessons SET auto_felder = ? WHERE id = ?").run(JSON.stringify(werte), lesson.id);
  return t;
}

/**
 * `themen`: im Plan für die ganze Einheit die Themen mit mindestens einem erledigten Schritt, in der Reihenfolge des Plans.
 * `schritte`: im Plan die Zahl der Schritte (ohne nicht erreichten Einstieg und Abschluss), weil „nicht erreicht“ ein ganzes
 * Thema als einen Namen haben kann.
 */
export type AblaufDerEinheit = { art: "paket" | "plan"; titel: string; ergebnis: Ergebnis<{ id: number; titel: string }>; themen?: string[]; schritte?: number };

/** Was mit dem Lernpaket oder dem „Plan für heute“ einer Einheit geschah, nach dem gespeicherten Stand. */
function ablaufVon(s: Stand): AblaufDerEinheit | null {
  const p = s.paket_id ? getLernpaket(s.paket_id) : null;
  if (p) return { art: "paket", titel: p.title, ergebnis: ergebnis(p.schritte, ablauf(p.schritte, s.reihenfolge), s) };
  return ablaufDesPlans(s);
}

/**
 * Der „Plan für die ganze Einheit“ nach dem gespeicherten Stand. Ein Schritt, in dem Übungen gesendet wurden oder für den
 * eine Antwort getippt ist, wurde gemacht, auch ohne „Weiter“ (etwa die Lernkontrolle vor „Einheit beenden“). Einstieg und
 * Abschluss rahmen die Einheit und sind nie „Weiter mit“; ein Thema, von dem nichts erreicht wurde, steht dort als ein Name.
 */
export function ablaufDesPlans(s: Pick<Stand, "plan" | "reihenfolge" | "erledigt" | "uebersprungen" | "wiederholt" | "nichtVerstanden" | "gesendet" | "antworten">): AblaufDerEinheit | null {
  if (!s.plan?.length) return null;
  const getan = s.plan.filter((x) => !s.uebersprungen.includes(x.id) && (s.gesendet[x.id]?.length || s.antworten[x.id])).map((x) => x.id);
  const st = { ...s, erledigt: [...new Set([...s.erledigt, ...getan])] };
  const e = ergebnis(s.plan, ablauf(s.plan, s.reihenfolge), st);
  const rahmen = new Set(s.plan.filter((x) => x.art === "einstieg" || x.art === "abschluss").map((x) => x.id));
  const offen = new Set(e.nichtErreicht.map((x) => x.id));
  const alle = themenDesPlans(s.plan);
  const ganz = alle.filter((t) => t.ids.every((id) => offen.has(id)));
  const nichtErreicht: { id: number; titel: string }[] = [];
  for (const x of e.nichtErreicht) {
    if (rahmen.has(x.id)) continue;
    const t = ganz.find((t) => t.ids.includes(x.id));
    if (!t) nichtErreicht.push(x);
    else if (t.ids[0] === x.id) nichtErreicht.push({ id: x.id, titel: t.name });
  }
  const themen = alle.filter((t) => t.ids.some((id) => st.erledigt.includes(id))).map((t) => t.name);
  const schritte = e.erledigt.length + e.uebersprungen.length + e.nichtErreicht.filter((x) => !rahmen.has(x.id)).length;
  return { art: "plan", titel: "Plan für heute", ergebnis: { ...e, nichtErreicht }, schritte, ...(themen.length ? { themen } : {}) };
}

/** Der Ablauf einer Einheit für den Abschluss: nur, was gespeichert ist (getippt wurde), nie ein bloßer Vorschlag. */
export function ablaufDerEinheit(unitId: number): AblaufDerEinheit | null {
  const s = gespeichert(unitId);
  return s ? ablaufVon(s) : null;
}

// ---------- „Einheit vorbereiten“ ----------

export type Vorbereitung = { student_id: number; datum: string; paket_id: number; teacher_id: number | null; created_at: string };

export function vorbereitung(studentId: number, datum: string): Vorbereitung | null {
  return (db().prepare("SELECT * FROM einheit_vorbereitung WHERE student_id = ? AND datum = ?").get(studentId, datum) as Vorbereitung | undefined) ?? null;
}

/** Das Lernpaket für die Einheit eines Schülers an einem Tag (null nimmt die Wahl zurück). */
export function bereiteVor(studentId: number, datum: string, paketId: number | null, teacherId: number | null): { ok: true } | { fehler: string } {
  if (paketId === null) {
    db().prepare("DELETE FROM einheit_vorbereitung WHERE student_id = ? AND datum = ?").run(studentId, datum);
    return { ok: true };
  }
  const p = getLernpaket(paketId);
  if (!p || p.status === "archiviert") return { fehler: "Dieses Lernpaket gibt es nicht mehr." };
  if (!p.schritte.length) return { fehler: "Dieses Lernpaket hat noch keine Schritte." };
  db()
    .prepare(
      `INSERT INTO einheit_vorbereitung (student_id, datum, paket_id, teacher_id) VALUES (?, ?, ?, ?)
       ON CONFLICT(student_id, datum) DO UPDATE SET paket_id = excluded.paket_id, teacher_id = excluded.teacher_id, created_at = datetime('now')`,
    )
    .run(studentId, datum, paketId, teacherId);
  // chosen by hand: a removed suggestion no longer counts for this day
  vorschlagErlauben(studentId, datum);
  return { ok: true };
}

// ---------- without a package: new tasks from the generators ----------

/** Wie viele und wie schwer neue Aufgaben zur Fähigkeit sein sollen: die Empfehlung, sonst der Lernstand. */
function generatorWahl(studentId: number, skillId: string) {
  const empfehlung = nextSteps(studentId, { today: wienerDatum(), limit: Infinity }).find((s) => s.skill.id === skillId);
  const mastery = analyzeStudent(studentId)?.skills.find((s) => s.skill.id === skillId)?.mastery ?? null;
  return { difficulty: empfehlung?.difficulty ?? difficultyFor(mastery), count: empfehlung?.count ?? 8, kind: empfehlung?.kind ?? ("uebung" as const) };
}

/** Die Übungen dieser Einheit, die die Fähigkeit üben, die neueste zuerst. */
function uebungenZur(unitId: number, skillId: string): number[] {
  return (
    db()
      .prepare("SELECT a.worksheet_id FROM assignments a JOIN worksheets w ON w.id = a.worksheet_id WHERE a.unit_id = ? AND EXISTS (SELECT 1 FROM json_each(w.skill_ids) j WHERE j.value = ?) ORDER BY a.id DESC")
      .all(unitId, skillId) as { worksheet_id: number }[]
  ).map((r) => r.worksheet_id);
}

/** Die letzte Übung dieser Einheit, die die Fähigkeit übt; null, wenn noch keine gesendet ist. */
const letzteUebungZur = (unitId: number, skillId: string): number | null => uebungenZur(unitId, skillId)[0] ?? null;

/** Ob in der Einheit schon eine Übung gesendet wurde (aus einem Schritt, einem Vorschlag oder von Hand). */
export const uebungGesendet = (unitId: number) => Boolean(db().prepare("SELECT 1 FROM assignments WHERE unit_id = ? LIMIT 1").get(unitId));

/** Der Seed der ersten neuen Übung einer Fähigkeit in einer Einheit: Vorschau und gesendete Übung beginnen mit derselben Aufgabe. */
export const generatorSeed = (unitId: number, skillId: string) => [...`${unitId}:${skillId}`].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

/** Bauen die Generatoren die Übung zur Fähigkeit? Schreibaufträge und die eigenen Wortlisten des Schülers nicht (lib/service.ts buildWorksheet). */
const ausDemGenerator = (skillId: string) => !sorteOfSkill(skillId) && skillId !== EIGENE_VOKABELN;

/**
 * Woraus die neue Übung eines Schritts gebaut wird, ohne KI: dieselbe Rechnung beim Vorbereiten, Zeigen und Senden. Die erste
 * Übung einer Fähigkeit beginnt mit der Aufgabe, die der Schritt als „Das fragst du“ zeigt; jede weitere hat ihren eigenen
 * Seed (Vorschau und gesendete Übung sind dieselben). Die Lernkontrolle: drei Aufgaben als Überprüfung.
 */
type Auftrag = { skill: repo.Skill; student: repo.Student; kontrolle: boolean; difficulty: Difficulty; count: number; kind: BuildRequest["kind"]; seed: number; title: string };

function auftragFuer(unitId: number, student: repo.Student, skill: repo.Skill, kontrolle: boolean): Auftrag {
  const w = generatorWahl(student.id, skill.id);
  const schon = uebungenZur(unitId, skill.id).length;
  return {
    skill,
    student,
    kontrolle,
    difficulty: w.difficulty,
    count: kontrolle ? KONTROLLE_ANZAHL : Math.max(1, Math.min(30, w.count)),
    kind: kontrolle ? "ueberpruefung" : w.kind,
    seed: kontrolle ? generatorSeed(unitId, `${skill.id}:${LERNKONTROLLE}`) : generatorSeed(unitId, schon ? `${skill.id}:${schon}` : skill.id),
    title: `${student.name.split(" ")[0]} – ${kontrolle ? `${LERNKONTROLLE}: ${skill.name}` : `${skill.area} › ${skill.name}`}`,
  };
}

/** Die Aufgaben eines Auftrags aus den Generatoren, wie buildWorksheet sie ohne KI baut. */
const generatorAufgabenVon = (a: Auftrag) =>
  generatorAufgaben({ subject: a.skill.subject, schoolType: a.student.school_type, klasse: a.student.klasse ?? 1, skillIds: [a.skill.id], difficulty: a.difficulty, count: a.count, taskType: "mixed", seed: a.seed }, [a.skill]);

/** Woraus eine bereite Übung gebaut ist; ändert sich etwas davon (Plan, Stufe, Anzahl), passt sie nicht mehr. */
const schluesselVon = (schrittId: number, a: Auftrag) => JSON.stringify([schrittId, a.skill.id, a.kontrolle, a.difficulty, a.count, a.kind, a.seed]);

/** Die bereite Übung eines Schritts (`haltBereit`), wenn sie zum Auftrag passt; sonst null. */
function bereitFuer(unitId: number, schrittId: number, schluessel: string): TaskDraft[] | null {
  const r = db().prepare("SELECT aufgaben FROM einheit_bereit WHERE unit_id = ? AND schritt_id = ? AND schluessel = ?").get(unitId, schrittId, schluessel) as { aufgaben: string } | undefined;
  const aufgaben = r ? json<TaskDraft[]>(r.aufgaben, []) : [];
  return aufgaben.length ? aufgaben : null;
}

/** Eine freigegebene Übung aus dem Bestand („U12“), die ein Planschritt sendet, wenn es sie noch gibt; sonst null. */
export function bestandsUebung(s: Pick<PlanStep, "uebung">): repo.Worksheet | null {
  const ws = s.uebung && /^U\d+$/.test(s.uebung) ? repo.getWorksheet(Number(s.uebung.slice(1))) : null;
  return ws && ws.status === "freigegeben" && !ws.archived_at && ws.kind !== "bibliothek" ? ws : null;
}

/** Kann die Übung des Planschritts vorher gebaut werden? Mit Fähigkeit aus den Generatoren, ohne Paket und ohne Übung aus dem Bestand. */
function vorherBaubar(s: PlanStep, quellen: Map<number, PlanQuelle>): boolean {
  if (!s.skillId || paketQuelle(s) || bestandsUebung(s) || (s.uebung && /^Z\d+$/.test(s.uebung))) return false;
  return planHatUebung(s, quellen) && ausDemGenerator(s.skillId) && Boolean(repo.getSkill(s.skillId));
}

/**
 * **Die nächste Übung bereit** (niko, 27.10.2026: „den gesamten Ablauf planen, die erste Erklärung und die ersten Übungen
 * bereitstellen, weitere Inhalte rechtzeitig vorbereiten“): beim Zeigen eines Schritts im Plan wird die Übung des nächsten
 * offenen Übungs- oder Kontrollschritts schon gebaut (Generator, ohne KI), dazu die des Schritts auf dem Schirm, solange aus
 * ihm noch nichts gesendet ist. So geht „Passende Übungen senden“ sofort. Nie weiter voraus als einen Schritt.
 *
 * Die Aufgaben liegen nur in `einheit_bereit`, nie als Übung: der Schüler sieht sie erst, wenn der Lehrer sendet. Passt eine
 * bereite Übung nicht mehr (neuer Plan, andere Stufe), wird sie neu gebaut; was nicht mehr dran ist, wird gelöscht. Ein Schritt
 * aus dem Bestand oder einem Paket hat seine Aufgaben schon. Gibt die Schritte mit bereiter Übung zurück.
 */
export function haltBereit(unitId: number): number[] {
  const unit = getUnit(unitId);
  const student = unit ? repo.getStudent(unit.student_id) : null;
  const c = unit && unit.status === "gestartet" ? cockpit(unitId, { mitPlan: true }) : null;
  const ziele: { id: number; a: Auftrag }[] = [];
  if (c && student && !c.paket && c.planAktuell) {
    const auftrag = (s: PlanStep) => auftragFuer(unitId, student, repo.getSkill(s.skillId!)!, s.art === "kontrolle");
    const jetzt = c.planAktuell;
    if (vorherBaubar(jetzt, c.planQuellen) && !c.stand.gesendet[jetzt.id]?.length) ziele.push({ id: jetzt.id, a: auftrag(jetzt) });
    const naechster = c.plan.slice(c.plan.indexOf(jetzt) + 1).find((s) => nichtFertig(c.stand, s.id) && !c.verschoben.has(s.id) && vorherBaubar(s, c.planQuellen));
    if (naechster) ziele.push({ id: naechster.id, a: auftrag(naechster) });
  }
  const conn = db();
  const da: number[] = [];
  conn.transaction(() => {
    const ids = ziele.map((z) => z.id);
    if (ids.length) conn.prepare(`DELETE FROM einheit_bereit WHERE unit_id = ? AND schritt_id NOT IN (${ids.map(() => "?").join(", ")})`).run(unitId, ...ids);
    else conn.prepare("DELETE FROM einheit_bereit WHERE unit_id = ?").run(unitId);
    for (const z of ziele) {
      const schluessel = schluesselVon(z.id, z.a);
      if (bereitFuer(unitId, z.id, schluessel)) {
        da.push(z.id);
        continue;
      }
      const aufgaben = generatorAufgabenVon(z.a);
      if (!aufgaben.length) {
        conn.prepare("DELETE FROM einheit_bereit WHERE unit_id = ? AND schritt_id = ?").run(unitId, z.id);
        continue;
      }
      conn
        .prepare(
          `INSERT INTO einheit_bereit (unit_id, schritt_id, schluessel, aufgaben) VALUES (?, ?, ?, ?)
           ON CONFLICT(unit_id, schritt_id) DO UPDATE SET schluessel = excluded.schluessel, aufgaben = excluded.aufgaben, created_at = datetime('now')`,
        )
        .run(unitId, z.id, schluessel, JSON.stringify(aufgaben));
      da.push(z.id);
    }
  })();
  return da;
}

/**
 * Ohne Lernpaket: eine neue Übung zur Fähigkeit aus den eingebauten Generatoren und Aufgabenbanken (nie die
 * KI), an den Schüler dieser Einheit. Wie viele und wie schwer, sagt die Empfehlung, sonst der Lernstand. Die erste
 * Übung einer Fähigkeit in der Einheit beginnt mit der Aufgabe, die der Schritt als „Das fragst du“ zeigt. Liegt die Übung des
 * Schritts schon bereit (`haltBereit`) und passt sie noch, geht genau sie hinaus, ohne neu zu bauen.
 *
 * Wie beim Senden eines Paketschritts hält das erste Senden den „Plan für heute“ fest (den von vor dem Senden: die neue
 * Übung und die ersten Antworten ändern sonst Empfehlung und Plan) und merkt die Übung beim Schritt (`gesendet`).
 * `schrittId`: der Planschritt, aus dem gesendet wurde; ohne ihn der Übungsschritt mit dieser Fähigkeit, wenn es einen gibt.
 * Aus der Lernkontrolle eines Themas: drei Aufgaben als Überprüfung, ein Versuch, ohne Hilfen (Modus 'test', Notiz
 * „Lernkontrolle“, damit der Abschluss sie nicht für den Minitest am Anfang hält).
 */
export async function sendeAusGenerator(
  unitId: number,
  skillId: string,
  teacherId: number | null,
  schrittId: number | null = null,
): Promise<{ worksheetId: number; assignmentId: number } | { fehler: string }> {
  const unit = getUnit(unitId);
  if (!unit || unit.status !== "gestartet") return { fehler: "Diese Einheit läuft nicht mehr." };
  const student = repo.getStudent(unit.student_id);
  const skill = repo.getSkill(skillId);
  if (!student || !skill) return { fehler: "Diese Fähigkeit gibt es nicht." };
  // without a package: the plan as it is now, before this exercise changes the data
  const vorher = leseStand(unitId);
  const plan = vorher.paket_id ? null : (vorher.plan ?? planDerEinheit(unitId));
  // without a step from the tools: the practice step of the skill first, not its explanation or check
  const schritt = plan?.find((x) => x.id === schrittId) ?? plan?.find((x) => x.skillId === skill.id && (!x.art || x.art === "ueben")) ?? plan?.find((x) => x.skillId === skill.id) ?? null;
  // the short Lernkontrolle of a topic: three tasks, one try, no hints (mode 'test', like the Minitest)
  const kontrolle = schritt !== null && schritt.id === schrittId && schritt.art === "kontrolle";
  const a = auftragFuer(unit.id, student, skill, kontrolle);
  // prepared before (haltBereit): exactly these tasks, without building again
  const bereit = schritt && schritt.id === schrittId && ausDemGenerator(skill.id) ? bereitFuer(unit.id, schritt.id, schluesselVon(schritt.id, a)) : null;
  let worksheetId = 0;
  try {
    worksheetId = bereit
      ? repo.createWorksheet(
          {
            title: a.title,
            subject: skill.subject,
            grade: schulstufe(student.school_type, student.klasse ?? 1),
            school_type: student.school_type,
            klasse: student.klasse ?? 1,
            topic: skill.area,
            difficulty: a.difficulty,
            task_type: "mixed",
            kind: a.kind ?? "uebung",
            source: "generator",
            skill_ids: [skill.id],
          },
          bereit,
        )
      : (
          await buildWorksheet({
            subject: skill.subject,
            schoolType: student.school_type,
            klasse: student.klasse ?? 1,
            skillIds: [skill.id],
            difficulty: a.difficulty,
            count: a.count,
            taskType: "mixed",
            kind: a.kind,
            title: a.title,
            useAI: false,
            teacherId,
            studentId: student.id,
            seed: a.seed,
          })
        ).id;
  } catch (e) {
    return { fehler: e instanceof Error ? e.message : "Die Übung konnte nicht erstellt werden." };
  }
  if (!repo.listTasks(worksheetId).length) {
    repo.deleteWorksheet(worksheetId);
    return { fehler: "Für diese Fähigkeit gibt es keine Aufgaben ohne KI. Bitte im Builder erstellen." };
  }
  if (schritt) db().prepare("DELETE FROM einheit_bereit WHERE unit_id = ? AND schritt_id = ?").run(unit.id, schritt.id);
  const assignmentId = kontrolle ? repo.assignWorksheet(worksheetId, student.id, LERNKONTROLLE, unit.id, "test") : repo.assignWorksheet(worksheetId, student.id, "", unit.id);
  if (plan?.length) {
    aendere(unitId, (cur) => {
      if (cur.paket_id) return cur;
      const neu = { ...cur, plan: cur.plan ?? plan };
      return schritt ? { ...neu, gesendet: { ...cur.gesendet, [schritt.id]: [...(cur.gesendet[schritt.id] ?? []), worksheetId] } } : neu;
    });
  }
  return { worksheetId, assignmentId };
}

// ---------- guided like a package step, without a package ----------

/**
 * Was der Lehrer in einem Schritt ohne Lernpaket sagt, zeigt und fragt; null, wo die Daten nichts hergeben. `zeigt`: ein
 * durchgerechnetes Beispiel aus einer echten Aufgabe des Schritts (Aufgabe und ihre Lösung).
 */
export type PlanFuehrung = { sagt: string | null; zeigt: { aufgabe: string; loesung: string } | null; fragt: string | null; antwort: string | null };

const kurz = (s: string, n: number) => {
  const t = s.trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

/** Die Frage einer Aufgabe zum Vorlesen: Text, Rechnung oder fehlerhafter Satz, Antworten zur Auswahl. Ohne Lesetext. */
export function frageText(t: Pick<TaskDraft, "prompt" | "data">): string {
  const teile = [t.prompt.trim()];
  if (t.data.start?.trim() && !t.prompt.includes(t.data.start.trim())) teile.push(t.data.start.trim());
  if (t.data.faulty?.trim()) teile.push(`„${t.data.faulty.trim()}“`);
  if (t.data.options?.length) teile.push(t.data.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join("   "));
  return kurz(teile.filter(Boolean).join("\n"), 400);
}

/** Die erwartete Antwort einer Aufgabe in wenigen Worten (die richtige Auswahl, die erste akzeptierte Antwort …). */
export function antwortText(t: Pick<TaskDraft, "answer" | "data" | "solution">): string {
  const a = t.answer;
  const out =
    typeof a.correct === "number" && t.data.options?.[a.correct]
      ? `${String.fromCharCode(65 + a.correct)}) ${t.data.options[a.correct]}`
      : a.accepted?.length
        ? a.accepted[0]
        : a.blanks?.length
          ? a.blanks.map((b) => b[0] ?? "").join(" · ")
          : a.steps?.length
            ? a.steps.join(" → ")
            : a.sample || t.solution || "";
  return kurz(String(out), 300);
}

/** Die Lösung einer Aufgabe zum Vorzeigen: der Lösungsweg Zeile für Zeile, sonst die Lösung, sonst die erwartete Antwort. */
export function loesungText(t: Pick<TaskDraft, "answer" | "data" | "solution" | "solutionSteps">): string {
  const weg = (t.solutionSteps ?? []).map((x) => x.trim()).filter(Boolean);
  if (weg.length) return kurz(weg.join("\n"), 500);
  return kurz(t.solution?.trim() || antwortText(t), 500);
}

/** Die Erklärung einer Fähigkeit (lib/erklaerungen.ts), ganz; eine Teilfähigkeit ohne eigene hat die ihrer Fähigkeit. */
export function erklaerungZu(skillId: string | null): string | null {
  const skill = skillId ? repo.getSkill(skillId) : null;
  return skill ? (EXPLAIN[skill.id] ?? (skill.parent_id ? EXPLAIN[skill.parent_id] : undefined) ?? null) : null;
}

/**
 * Die Aufgaben, um die es in einem Planschritt geht (für „Das fragst du“, „Das zeigst du“ und die Lösungen am Schritt): die
 * zuletzt aus dem Schritt gesendete Übung, die aus dem Bestand („U12“), die schon zugewiesene („Z5“), sonst die zuletzt gesendete
 * zur Fähigkeit, sonst die, die der Schritt senden würde (bereit oder aus dem Generator mit demselben Seed). Nur für den Lehrer.
 */
export function aufgabenImSchritt(unitId: number, s: Pick<PlanStep, "id" | "uebung" | "skillId" | "art">, gesendet: number[] = []): TaskDraft[] {
  const unit = getUnit(unitId);
  const student = unit ? repo.getStudent(unit.student_id) : null;
  if (!unit || !student) return [];
  const zuletzt = gesendet.at(-1);
  const schon = zuletzt ? repo.listTasks(zuletzt) : [];
  if (schon.length) return schon;
  const blatt = bestandsUebung(s);
  if (blatt) return repo.listTasks(blatt.id);
  const zugewiesen = s.uebung && /^Z\d+$/.test(s.uebung) ? repo.getAssignment(Number(s.uebung.slice(1))) : null;
  if (zugewiesen) return repo.listTasks(zugewiesen.worksheet_id);
  const skill = s.skillId ? repo.getSkill(s.skillId) : null;
  if (!skill || !ausDemGenerator(skill.id)) return [];
  const kontrolle = s.art === "kontrolle";
  // Erklären and Üben: the exercise already sent for the skill; the Lernkontrolle has its own tasks
  const letzte = kontrolle ? null : letzteUebungZur(unit.id, skill.id);
  if (letzte !== null) return repo.listTasks(letzte);
  const a = auftragFuer(unit.id, student, skill, kontrolle);
  return bereitFuer(unit.id, s.id, schluesselVon(s.id, a)) ?? generatorAufgabenVon(a);
}

/** Übt die Aufgabe die Fähigkeit (oder ihre Ober- oder eine Teilfähigkeit)? Eine Aufgabe ohne Fähigkeit zählt dazu. */
function uebtFaehigkeit(t: Pick<TaskDraft, "skillId" | "skillIds">, skillId: string): boolean {
  const ids = [t.skillId, ...(t.skillIds ?? [])].filter((x): x is string => Boolean(x));
  const oben = repo.getSkill(skillId)?.parent_id ?? null;
  return !ids.length || ids.some((id) => id === skillId || id === oben || repo.getSkill(id)?.parent_id === skillId);
}

/** Eine Aufgabe zum Vorlesen: kein Lesetext, keine lange freie Antwort. */
const fragbar = (t: TaskDraft | undefined): t is TaskDraft => Boolean(t && !t.data.passage && t.type !== "reading");

/** Woran zwei Aufgaben als dieselbe erkannt werden: ihre Frage, ohne Leerzeichen und Groß/klein. */
const gleicheFrage = (t: Pick<TaskDraft, "prompt" | "data">) => frageText(t).replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Das durchgerechnete Beispiel zu einer Fähigkeit („Das zeigst du“, Abnahme Phase A): eine Aufgabe genau dieser Fähigkeit aus den
 * Generatoren, mit eigenem Seed, die der Schüler nicht bekommt — keine der Aufgaben in `ausser` (was der Schritt und die anderen
 * Schritte des Themas senden). Ohne Generator oder ohne passende Aufgabe null: dann lieber kein Beispiel als eine Aufgabe, die der
 * Schüler danach schon gelöst sieht.
 */
export function beispielZur(unitId: number, skillId: string, ausser: Pick<TaskDraft, "prompt" | "data">[]): TaskDraft | null {
  const unit = getUnit(unitId);
  const student = unit ? repo.getStudent(unit.student_id) : null;
  const skill = repo.getSkill(skillId);
  if (!student || !skill || !ausDemGenerator(skill.id)) return null;
  const a = auftragFuer(unitId, student, skill, false);
  const schon = new Set(ausser.map(gleicheFrage));
  const kandidaten = generatorAufgabenVon({ ...a, count: 8, seed: generatorSeed(unitId, `${skill.id}:beispiel`) });
  return kandidaten.find((t) => fragbar(t) && uebtFaehigkeit(t, skill.id) && !schon.has(gleicheFrage(t)) && loesungText(t).trim()) ?? null;
}

/**
 * Ohne Lernpaket (niko, 25.10.2026: „sagen, zeigen, fragen, erwartete Antwort“ auch im Plan aus den Daten; 27.10.2026:
 * „Lehrerskripte sollen ausreichend ausführlich sein“): ohne KI, aus der Fähigkeit und den Aufgaben des Schritts. „Das sagst du“
 * ist ihre ganze Erklärung (lib/erklaerungen.ts), „Das fragst du“ und „Erwartete Antwort“ die erste Aufgabe der Fähigkeit in der
 * Übung, die der Schritt senden würde, „Das zeigst du“ ein Beispiel derselben Fähigkeit mit seiner Lösung, das der Schüler nicht
 * bekommt (`beispielZur`; `ausser`: die Aufgaben der anderen Schritte des Themas). Nur für den Lehrer; die Lösung steht nie auf
 * einer Schülerseite.
 */
export function planFuehrung(unitId: number, s: Pick<PlanStep, "id" | "uebung" | "skillId" | "art">, gesendet: number[] = [], ausser: TaskDraft[] = []): PlanFuehrung {
  const leer: PlanFuehrung = { sagt: null, zeigt: null, fragt: null, antwort: null };
  const unit = getUnit(unitId);
  if (!unit || !repo.getStudent(unit.student_id)) return leer;
  const blatt = bestandsUebung(s);
  const zugewiesen = s.uebung && /^Z\d+$/.test(s.uebung) ? repo.getAssignment(Number(s.uebung.slice(1))) : null;
  const skillId = s.skillId ?? blatt?.skill_ids[0] ?? (zugewiesen ? (repo.getWorksheet(zugewiesen.worksheet_id)?.skill_ids[0] ?? null) : null);
  const sagt = erklaerungZu(skillId);
  const aufgaben = aufgabenImSchritt(unitId, { ...s, skillId }, gesendet);
  // a reading text or a long free answer is not something to ask aloud; a task of another skill (an exercise from the
  // Bestand may mix skills) does not fit the step; only when none fits, the first task as before
  const passend = aufgaben.filter((t) => !skillId || uebtFaehigkeit(t, skillId));
  const erste = passend.find(fragbar) ?? (fragbar(aufgaben[0]) ? aufgaben[0] : undefined);
  const zweite = skillId ? (beispielZur(unitId, skillId, [...aufgaben, ...ausser]) ?? undefined) : undefined;
  const antwort = fragbar(erste) ? antwortText(erste) : "";
  const loesung = fragbar(zweite) ? loesungText(zweite) : "";
  // a sample solution that only repeats the explanation (a writing task) shows nothing new
  const norm = (x: string) => x.replace(/\s+/g, " ").trim().toLowerCase();
  const wiederholt = Boolean(sagt && loesung && norm(sagt).startsWith(norm(loesung).slice(0, 80)));
  return {
    sagt,
    zeigt: fragbar(zweite) && loesung && !wiederholt ? { aufgabe: frageText(zweite), loesung } : null,
    fragt: fragbar(erste) ? frageText(erste) : null,
    antwort: fragbar(erste) && antwort ? antwort : null,
  };
}

/** Endet ein Text mit einer Abkürzung („z. B.“, „bzw.“, ein einzelner Buchstabe mit Punkt), endet dort kein Satz. */
const ABKUERZUNG = /(?:\b(?:bzw|usw|ca|vgl|Nr|etc|bspw|evtl|ggf|inkl|max|min|Mio|Mrd)\.|(?:^|[\s(])\p{L}\.)$/u;

/**
 * Ein langer Lehrertext lesbar (niko, 27.10.2026): die ersten drei Sätze sichtbar, zwei, wenn sie schon lang sind (`lang`
 * Zeichen); der Rest für „Mehr“. Ist der Rest kurz, bleibt alles sichtbar. Ein Zeilenumbruch beendet einen Satz auch.
 */
export function ersteSaetze(text: string, o: { saetze?: number; lang?: number } = {}): { kurz: string; rest: string } {
  const t = text.trim();
  const grenzen: number[] = [];
  for (const m of t.matchAll(/([.!?…])(\s+)(?=[\p{Lu}„"(\d])|\n+/gu)) {
    if (m[1] && ABKUERZUNG.test(t.slice(0, m.index + 1))) continue;
    grenzen.push(m.index + m[0].length);
  }
  const n = o.saetze ?? 3;
  const zwei = grenzen[1];
  const schnitt = zwei !== undefined && zwei >= (o.lang ?? 180) ? zwei : grenzen[n - 1];
  if (schnitt === undefined) return { kurz: t, rest: "" };
  const rest = t.slice(schnitt).trim();
  return rest.length < 40 ? { kurz: t, rest: "" } : { kurz: t.slice(0, schnitt).trim(), rest };
}

/**
 * Kurzer Hintergrund zu einem Schritt, höchstens zwei Zeilen: was der Lehrer selbst dazu hat (`eigene`: Ziel des Pakets,
 * Lehrerhinweis einer Aufgabe), dann das Lernziel der Fähigkeit aus dem Lehrplan, sonst wo sie im Lehrplan steht.
 */
export function hintergrundZu(skillId: string | null, eigene: (string | null | undefined)[] = []): string[] {
  const skill = skillId ? repo.getSkill(skillId) : null;
  const zeilen = eigene
    .map((x) => (x ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((x) => kurz(x, 240));
  if (skill) {
    const ziel = (skill.learning_objective || skill.description || "").replace(/\s+/g, " ").trim();
    zeilen.push(ziel ? `Lernziel: ${kurz(ziel, 240)}` : `Lehrplan: ${skill.subject} · ${skill.area} › ${skill.name}, Schulstufe ${skill.grade_min}–${skill.grade_max}`);
  }
  return [...new Set(zeilen)].slice(0, 2);
}

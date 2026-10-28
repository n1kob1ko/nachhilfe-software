/**
 * Die Regeln der **eigenen Probeschularbeit** (lib/probe-extern.ts) ohne Datenbank, damit auch die Prüfansicht im Browser sie
 * benutzt: was eine Zeile ist (eine Teilaufgabe), wie Nummern verglichen werden, wie Angabe und Musterlösung über die Nummer
 * zusammenkommen, wie ein Text mit gespeichertem Text (PDF mit Textebene, eingefügter Text) ohne KI in Aufgaben zerfällt und
 * was vor „Übernehmen“ stimmen muss.
 *
 * Nie erfunden: eine Teilaufgabe ohne gefundene Lösung ist „Lösung fehlt“, eine unklare Nummer ist „unsicher“ und muss vor
 * „Übernehmen“ geprüft werden. Punkte stehen nur da, wenn sie auf dem Blatt stehen; sonst trägt sie die Lehrkraft ein.
 */
import { PUNKTE_MAX } from "./probeschularbeit-regeln";

/** So viele Teilaufgaben hat eine Probeschularbeit höchstens. */
export const MAX_TEILAUFGABEN = 40;
/** So viele Seiten oder Dateien je Feld (Angabe, Musterlösung). */
export const MAX_DATEIEN = 4;
export const GRENZEN = { nummer: 8, einleitung: 2_000, text: 2_000, loesung: 3_000, titel: 100, grund: 200 } as const;

/** Eine Teilaufgabe der Prüfansicht: Aufgabe | Teilaufgabe | Text | Punkte | Musterlösung | Fähigkeit. */
export type ProbeZeile = {
  /** die Nummer der Aufgabe, wie auf dem Blatt („1“, „2“) */
  aufgabe: string;
  /** die Teilaufgabe („a“, „b“); leer, wenn die Aufgabe keine hat */
  teil: string;
  /** der Text der Aufgabe vor ihren Teilaufgaben (gilt für alle ihre Zeilen); leer, wenn es keinen gibt */
  einleitung: string;
  /** der Text der Teilaufgabe, wortgetreu */
  text: string;
  /** Punkte, wenn sie auf dem Blatt stehen oder die Lehrkraft sie einträgt; sonst null */
  punkte: number | null;
  /** die erwartete Antwort aus der Musterlösung; leer = Lösung fehlt (dann bewertet nur die Lehrkraft) */
  loesung: string;
  skillId: string | null;
  /** die Fähigkeit ist nur vorgeschlagen (Lesung oder Wörter), nicht gewählt */
  skillVorschlag?: boolean;
  /** Nummer oder Zuordnung unklar: muss vor „Übernehmen“ geprüft werden */
  unsicher: boolean;
  /** warum die Zeile unsicher ist */
  grund: string;
};

export type ProbeVorschlag = { titel: string; zeilen: ProbeZeile[]; hinweise: string[] };

/** Was eine Lesung der Angabe ergibt (KI oder Text), vor der Zuordnung der Lösungen. */
export type AngabeGelesen = {
  titel: string | null;
  aufgaben: { nr: string; einleitung: string; teile: { teil: string; text: string; punkte: number | null; faehigkeit?: string | null; unsicher?: boolean }[]; unsicher: boolean; grund: string }[];
  unsicher: string[];
};
/** Was eine Lesung der Musterlösung ergibt (KI oder Text). */
export type LoesungGelesen = { loesungen: { nr: string; teil: string; loesung: string; unsicher: boolean }[]; unsicher: string[] };

const eineZeile = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
/** Mehrzeiliger Text: Zeilen bleiben, Leerraum am Rand und mehr als eine Leerzeile nicht. */
export const absatz = (s: unknown, max: number) =>
  String(s ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((z) => z.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);

// ---------- Nummern ----------

/**
 * Eine Nummer wie gedruckt → Aufgabe und Teilaufgabe: „Aufgabe 2“ → 2, „3b)“ → 3 b, „1.a“ → 1 a, „4.2“ → 4 2. Null, wenn sie
 * nicht eindeutig ist (leer, nur ein Buchstabe, mehr als eine Nummer).
 */
export function nummerVon(nr: string, teil = ""): { aufgabe: string; teil: string } | null {
  const n = eineZeile(nr, 40)
    .toLowerCase()
    .replace(/^(aufgabe|aufg\.?|beispiel|bsp\.?|nr\.?|nummer|frage)\s*/, "")
    .replace(/[\s:]+$/, "");
  const m = /^(\d{1,3})\s*[.)]?\s*(?:\(?([a-z]|\d{1,2})\)?\s*[.)]?)?$/.exec(n);
  if (!m) return null;
  const t = teilVon(teil);
  if (m[2] && t && m[2] !== t) return null;
  return { aufgabe: String(Number(m[1])), teil: m[2] ?? t };
}

/** „a)“, „(b)“, „B“ → „a“, „b“; „2.“ → „2“; sonst leer. */
export const teilVon = (t: string) => {
  const m = /^\(?([a-z]|\d{1,2})\)?\.?$/.exec(eineZeile(t, 8).toLowerCase());
  return m ? m[1] : "";
};

/** „1a“, „2“: wie die Zeile in der Liste und auf dem Gerät heißt. */
export const nummerText = (z: Pick<ProbeZeile, "aufgabe" | "teil">) => `${z.aufgabe}${z.teil}`;
const schluessel = (aufgabe: string, teil: string) => `${aufgabe}|${teil}`;

/** Reihenfolge des Blatts: nach der Nummer der Aufgabe, dann der Teilaufgabe (a vor b, 2 vor 10). */
export function nachNummer<T extends Pick<ProbeZeile, "aufgabe" | "teil">>(zeilen: T[]): T[] {
  const zahl = (s: string) => (/^\d+$/.test(s) ? Number(s) : Number.POSITIVE_INFINITY);
  return [...zeilen].sort((x, y) => zahl(x.aufgabe) - zahl(y.aufgabe) || x.aufgabe.localeCompare(y.aufgabe) || zahl(x.teil) - zahl(y.teil) || x.teil.localeCompare(y.teil));
}

/** Unsichere Zeilen zuerst, sonst in der Reihenfolge des Blatts; beim Bearbeiten springt nichts. */
export const unsichereZuerst = <T extends Pick<ProbeZeile, "unsicher">>(zeilen: T[]): T[] => [...zeilen.filter((z) => z.unsicher), ...zeilen.filter((z) => !z.unsicher)];

/** Punkte: halbe Punkte, von 0,5 bis PUNKTE_MAX; sonst null. */
export function punkteVon(x: unknown): number | null {
  const n = typeof x === "string" ? Number(x.trim().replace(",", ".")) : x;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const p = Math.round(n * 2) / 2;
  return p >= 0.5 && p <= PUNKTE_MAX ? p : null;
}

// ---------- Angabe und Musterlösung zusammen ----------

/**
 * Aus der gelesenen Angabe die Zeilen (eine je Teilaufgabe) und aus der gelesenen Musterlösung die erwartete Antwort je Nummer.
 * Nichts wird erfunden: ohne Lösung zu dieser Nummer bleibt das Feld leer („Lösung fehlt“); eine unklare oder doppelte Nummer,
 * eine Lösung nur zur ganzen Aufgabe (oder nur zu Teilen einer Aufgabe ohne Teile) und alles, was die Lesung selbst unsicher
 * nennt, wird „unsicher“. `skill` schlägt eine Fähigkeit vor (aus der Lesung, nur aus der Liste; sonst nach den Wörtern).
 */
export function zeilenAusLesung(
  angabe: AngabeGelesen,
  loesung: LoesungGelesen | null,
  o: { erlaubt: Set<string>; skill?: (text: string) => string | null } = { erlaubt: new Set() },
): ProbeVorschlag {
  const hinweise: string[] = [];
  const zeilen: ProbeZeile[] = [];
  for (const a of angabe.aufgaben) {
    const kopf = nummerVon(a.nr);
    const einleitung = absatz(a.einleitung, GRENZEN.einleitung);
    const teile = a.teile.length ? a.teile : einleitung ? [{ teil: "", text: "", punkte: null }] : [];
    for (const t of teile) {
      const n = kopf ? nummerVon(kopf.aufgabe, t.teil || kopf.teil) : null;
      let text = absatz(t.text, GRENZEN.text);
      let einl = einleitung;
      // a task without parts: its whole text is the row's text
      if (!text && einl && teile.length === 1) [text, einl] = [einl, ""];
      if (!text) continue;
      const gruende: string[] = [];
      if (!n) gruende.push(`Nummer unklar („${eineZeile(`${a.nr} ${t.teil}`, 20)}“)`);
      if (a.unsicher) gruende.push(eineZeile(a.grund, GRENZEN.grund) || "Die Lesung ist unsicher.");
      else if (t.unsicher) gruende.push("Nicht sicher lesbar.");
      const vorschlag = t.faehigkeit && o.erlaubt.has(t.faehigkeit) ? t.faehigkeit : (o.skill?.(`${einl} ${text}`) ?? null);
      zeilen.push({
        aufgabe: n?.aufgabe ?? "",
        teil: n?.teil ?? "",
        einleitung: einl,
        text,
        punkte: punkteVon(t.punkte),
        loesung: "",
        skillId: vorschlag && o.erlaubt.has(vorschlag) ? vorschlag : null,
        skillVorschlag: Boolean(vorschlag && o.erlaubt.has(vorschlag)),
        unsicher: gruende.length > 0,
        grund: gruende.join(" "),
      });
    }
  }
  // the same number twice: unsure, never merged
  const zaehler = new Map<string, number>();
  for (const z of zeilen) zaehler.set(schluessel(z.aufgabe, z.teil), (zaehler.get(schluessel(z.aufgabe, z.teil)) ?? 0) + 1);
  for (const z of zeilen)
    if (z.aufgabe && (zaehler.get(schluessel(z.aufgabe, z.teil)) ?? 0) > 1) {
      z.unsicher = true;
      z.grund = [z.grund, `Die Nummer ${nummerText(z)} steht mehrmals.`].filter(Boolean).join(" ");
    }
  if (zeilen.length > MAX_TEILAUFGABEN) hinweise.push(`Nur die ersten ${MAX_TEILAUFGABEN} Teilaufgaben übernommen.`);
  const liste = zeilen.slice(0, MAX_TEILAUFGABEN);

  if (loesung) loesungenZuordnen(liste, loesung, hinweise);
  for (const u of angabe.unsicher.slice(0, 3)) {
    const t = eineZeile(u, 140);
    if (t) hinweise.push(`Angabe unsicher: ${t}`);
  }
  if (!liste.length) hinweise.push("Keine Aufgaben gefunden. Bitte selbst eintragen.");
  const ohnePunkte = liste.filter((z) => z.punkte == null).length;
  if (ohnePunkte) hinweise.push(ohnePunkte === liste.length ? "Auf dem Blatt stehen keine Punkte. Bitte eintragen." : ohnePunkte === 1 ? "Bei einer Teilaufgabe stehen keine Punkte. Bitte eintragen." : `Bei ${ohnePunkte} Teilaufgaben stehen keine Punkte. Bitte eintragen.`);
  const gelb = liste.filter((z) => z.unsicher).length;
  if (gelb) hinweise.push(gelb === 1 ? "Eine Zeile ist unsicher und steht oben." : `${gelb} Zeilen sind unsicher und stehen oben.`);
  return { titel: eineZeile(angabe.titel, GRENZEN.titel), zeilen: unsichereZuerst(nachNummer(liste)), hinweise };
}

/**
 * Nur die Musterlösung, die Tabelle steht schon (Angabe aus dem PDF gelesen oder eingetragen): die Lösungen kommen über die
 * Nummer in die Zeilen, wie beim Lesen. Was zu keiner Nummer passt, bleibt wie es war; nichts wird erfunden.
 */
export function loesungenEinfuegen<T extends ProbeZeile>(zeilen: T[], loesung: LoesungGelesen): { zeilen: T[]; hinweise: string[] } {
  const liste = zeilen.map((z) => ({ ...z }));
  const hinweise: string[] = [];
  loesungenZuordnen(liste, loesung, hinweise);
  return { zeilen: unsichereZuerst(liste), hinweise };
}

/**
 * Ein Vorschlag nach den Wörtern nur, wenn er eindeutig vorne liegt: die beste Fähigkeit der Schularbeit (`erlaubt`) und keine
 * andere Fähigkeit mit gleich vielen oder mehr Punkten. „Berechne 3/4 + 1/8“ trifft „berechnen“ bei Prozentwert, Prozentsatz und
 * Grundwert gleich gut: dann keiner, die Lehrkraft wählt. Ein falscher Vorschlag zählte sonst für den Lernstand.
 */
export function eindeutigeFaehigkeit(treffer: { id: string; score: number; via: string }[], erlaubt: Set<string>): string | null {
  const faehig = treffer.filter((t) => t.via === "faehigkeit");
  const best = faehig.find((t) => erlaubt.has(t.id));
  if (!best) return null;
  return faehig.every((t) => t === best || t.score < best.score) ? best.id : null;
}

/** Die gelesene Musterlösung je Nummer in die Zeilen (ändert `liste`); was nicht passt, steht in `hinweise`. */
function loesungenZuordnen(liste: ProbeZeile[], loesung: LoesungGelesen, hinweise: string[]) {
  const loes = new Map<string, { text: string[]; unsicher: boolean }>();
  const unklar: string[] = [];
  for (const l of loesung.loesungen) {
    const n = nummerVon(l.nr, l.teil);
    const text = absatz(l.loesung, GRENZEN.loesung);
    if (!text) continue;
    if (!n) {
      unklar.push(eineZeile(`${l.nr}${l.teil}`, 12));
      continue;
    }
    const k = schluessel(n.aufgabe, n.teil);
    const da = loes.get(k);
    loes.set(k, { text: [...(da?.text ?? []), text], unsicher: Boolean(da) || l.unsicher || (da?.unsicher ?? false) });
  }
  const benutzt = new Set<string>();
  for (const z of liste) {
    const k = schluessel(z.aufgabe, z.teil);
    const genau = loes.get(k);
    if (genau) {
      benutzt.add(k);
      z.loesung = genau.text.join("\n").slice(0, GRENZEN.loesung);
      if (genau.unsicher) markiere(z, genau.text.length > 1 ? `Zur Nummer ${nummerText(z)} stehen mehrere Lösungen.` : "Die Lösung ist nicht sicher lesbar.");
      continue;
    }
    // the solution only for the whole task (the sheet has parts): taken over for each part, but unsure
    const ganze = z.teil ? loes.get(schluessel(z.aufgabe, "")) : undefined;
    if (ganze) {
      benutzt.add(schluessel(z.aufgabe, ""));
      z.loesung = ganze.text.join("\n").slice(0, GRENZEN.loesung);
      markiere(z, `Die Musterlösung nennt nur Aufgabe ${z.aufgabe}, nicht die Teilaufgabe ${z.teil}. Bitte aufteilen.`);
      continue;
    }
    // parts in the solution, none in the sheet: together, but unsure
    const teile = z.teil ? [] : [...loes].filter(([key]) => key.startsWith(`${z.aufgabe}|`) && key !== k);
    if (teile.length) {
      for (const [key] of teile) benutzt.add(key);
      z.loesung = teile.map(([key, v]) => `${key.split("|")[1]}) ${v.text.join("\n")}`).join("\n").slice(0, GRENZEN.loesung);
      markiere(z, `Die Musterlösung hat Teilaufgaben, die Angabe bei Aufgabe ${z.aufgabe} nicht.`);
    }
  }
  const fremd = [...loes.keys()].filter((k) => !benutzt.has(k)).map((k) => k.replace("|", ""));
  if (fremd.length) hinweise.push(`In der Musterlösung steht auch ${fremd.slice(0, 6).join(", ")}${fremd.length > 6 ? " …" : ""}, aber dazu gibt es keine Aufgabe. Bitte prüfen.`);
  if (unklar.length) hinweise.push(`Lösungen ohne klare Nummer: ${unklar.slice(0, 4).join(", ")}. Bitte selbst zuordnen.`);
  const fehlt = liste.filter((z) => !z.loesung).length;
  if (fehlt) hinweise.push(fehlt === 1 ? "Bei einer Teilaufgabe fehlt die Lösung. Diese bewertest nur du." : `Bei ${fehlt} Teilaufgaben fehlt die Lösung. Diese bewertest nur du.`);
  for (const u of loesung.unsicher.slice(0, 3)) {
    const t = eineZeile(u, 140);
    if (t) hinweise.push(`Musterlösung unsicher: ${t}`);
  }
}

function markiere(z: ProbeZeile, grund: string) {
  z.unsicher = true;
  z.grund = [z.grund, grund].filter(Boolean).join(" ");
}

// ---------- ohne KI: Text mit Nummern ----------

const AUFGABE_WORT = /^(?:aufgabe|aufg\.|beispiel|bsp\.?|nr\.)\s*(\d{1,2})\s*[.:)]?\s*(.*)$/i;
const AUFGABE_ZAHL = /^(\d{1,2})\s*[.)]\s+(.*)$/;
const AUFGABE_MIT_TEIL = /^(\d{1,2})\s*\.?\s*([a-h])\)\s*(.*)$/i;
const TEIL = /^\(?([a-h])\)\s*(.*)$/i;
const PUNKTE_KLAMMER = /[([]\s*(\d{1,2}(?:[,.]5)?)\s*(?:p|pkt|punkte?)\.?\s*[)\]]/i;
const PUNKTE_ENDE = /(?:^|\s)(\d{1,2}(?:[,.]5)?)\s*(?:p|pkt|punkte?)\.?\s*$/i;

/** Punkte am Ende oder in Klammern („(3 P)“, „[2 Punkte]“, „… 4 Pkt.“) heraus; der Rest ist Text. */
export function punkteAusZeile(zeile: string): { text: string; punkte: number | null } {
  const k = PUNKTE_KLAMMER.exec(zeile);
  if (k) return { text: (zeile.slice(0, k.index) + zeile.slice(k.index + k[0].length)).replace(/\s{2,}/g, " ").trim(), punkte: punkteVon(k[1]) };
  const e = PUNKTE_ENDE.exec(zeile);
  if (e) return { text: zeile.slice(0, e.index).trim(), punkte: punkteVon(e[1]) };
  return { text: zeile, punkte: null };
}

/** Zeilen zu einem Text: in einem Absatz mit Leerzeichen, ein Trennstrich am Zeilenende vor einem kleinen Buchstaben fällt weg. */
function fuege(alt: string, neu: string): string {
  if (!alt) return neu;
  if (!neu) return `${alt}\n`;
  if (alt.endsWith("\n")) return alt + neu;
  if (/\p{Ll}-$/u.test(alt) && /^\p{Ll}/u.test(neu)) return alt.slice(0, -1) + neu;
  return `${alt} ${neu}`;
}

/**
 * Ein Text mit Nummern (aus einem PDF mit Textebene oder eingefügt) → Aufgaben mit Teilaufgaben, ohne KI. Eine Aufgabe beginnt
 * mit „Aufgabe 2“, „2.“ oder „2)“, eine Teilaufgabe mit „a)“ oder „2a)“; Punkte („(3 P)“) werden herausgelesen. Eine Zahl am
 * Zeilenanfang gilt nur als neue Aufgabe, wenn sie die nächste ist; sonst gehört die Zeile zum Text davor. Was vor der ersten
 * Aufgabe steht (Kopf mit Name, Klasse, Datum), fällt weg; die erste Zeile ist der Titel. `bekannt`: die Nummern der Angabe
 * (für die Musterlösung): eine davon gilt auch nach einer Lücke als neue Aufgabe („1a) … 3) …“, wenn die Lösung zu 2 fehlt).
 */
export function liesTextMitNummern(zeilen: string[], bekannt?: Set<number>): AngabeGelesen {
  type Teil = { teil: string; text: string; punkte: number | null };
  type Aufgabe = { nr: string; einleitung: string; teile: Teil[]; unsicher: boolean; grund: string; punkte: number | null };
  const aufgaben: Aufgabe[] = [];
  let titel: string | null = null;
  let akt: Aufgabe | null = null;
  let teil: Teil | null = null;
  const zuText = (roh: string) => {
    const { text, punkte } = punkteAusZeile(roh);
    if (teil) {
      teil.text = fuege(teil.text, text);
      if (punkte != null) teil.punkte = punkte;
    } else if (akt) {
      akt.einleitung = fuege(akt.einleitung, text);
      // points next to a task: its own, if it never gets parts
      if (punkte != null) akt.punkte = punkte;
    }
  };
  const neueAufgabe = (nr: number, rest: string, sicher: boolean) => {
    akt = { nr: String(nr), einleitung: "", teile: [], unsicher: !sicher, grund: sicher ? "" : "Die Nummer folgt nicht auf die vorige.", punkte: null };
    aufgaben.push(akt);
    teil = null;
    zuText(rest);
  };
  const neuerTeil = (a: Aufgabe, t: string, rest: string) => {
    teil = { teil: t.toLowerCase(), text: "", punkte: null };
    a.teile.push(teil);
    zuText(rest);
  };
  for (const roh of zeilen) {
    const z = roh.replace(/\s+/g, " ").trim();
    const a = akt as Aufgabe | null;
    if (!z) {
      zuText("");
      continue;
    }
    const erwartet = a ? Number(a.nr) + 1 : null;
    const naechste = (n: number) => erwartet === null || n === erwartet || Boolean(bekannt?.has(n) && n > Number(a!.nr));
    const wort = AUFGABE_WORT.exec(z);
    const mitTeil = AUFGABE_MIT_TEIL.exec(z);
    const zahl = AUFGABE_ZAHL.exec(z);
    const teilM = TEIL.exec(z);
    if (wort) neueAufgabe(Number(wort[1]), wort[2], naechste(Number(wort[1])));
    else if (mitTeil && (naechste(Number(mitTeil[1])) || Number(mitTeil[1]) === Number(a?.nr))) {
      if (!a || Number(mitTeil[1]) !== Number(a.nr)) neueAufgabe(Number(mitTeil[1]), "", true);
      neuerTeil(akt!, mitTeil[2], mitTeil[3]);
    } else if (zahl && naechste(Number(zahl[1]))) neueAufgabe(Number(zahl[1]), zahl[2], true);
    else if (teilM && a && naechsterTeil(a.teile, teilM[1])) neuerTeil(a, teilM[1], teilM[2]);
    else if (a) zuText(z);
    else titel ??= z;
  }
  return {
    titel,
    aufgaben: aufgaben.map((x) => {
      const einleitung = x.einleitung.trim();
      const teile = x.teile.map((t) => ({ ...t, text: t.text.trim() }));
      // a task without parts: one row with its whole text and its points
      return teile.length
        ? { nr: x.nr, einleitung, teile, unsicher: x.unsicher, grund: x.grund }
        : { nr: x.nr, einleitung: "", teile: einleitung ? [{ teil: "", text: einleitung, punkte: x.punkte }] : [], unsicher: x.unsicher, grund: x.grund };
    }),
    unsicher: [],
  };
}

/** Ob `t` die nächste Teilaufgabe ist (a, dann b …); ein „a)“ mitten im Text einer Teilaufgabe b ist keine neue. */
function naechsterTeil(teile: { teil: string }[], t: string): boolean {
  const c = t.toLowerCase().charCodeAt(0);
  const zuletzt = teile.length ? teile[teile.length - 1].teil.charCodeAt(0) : 96;
  return c === zuletzt + 1;
}

/** Die Musterlösung als Text mit Nummern → je Nummer die Lösung (wie die Angabe gelesen, der Text ist die Lösung). */
export function liesLoesungMitNummern(zeilen: string[], bekannt?: Set<number>): LoesungGelesen {
  const g = liesTextMitNummern(zeilen, bekannt);
  const loesungen: LoesungGelesen["loesungen"] = [];
  for (const a of g.aufgaben) {
    const echteTeile = a.teile.filter((t) => t.teil);
    if (!echteTeile.length) {
      const text = [a.einleitung, ...a.teile.map((t) => t.text)].filter(Boolean).join("\n");
      loesungen.push({ nr: a.nr, teil: "", loesung: text, unsicher: a.unsicher });
    } else for (const t of echteTeile) loesungen.push({ nr: a.nr, teil: t.teil, loesung: t.text, unsicher: a.unsicher });
  }
  return { loesungen, unsicher: [] };
}

// ---------- Übernehmen ----------

/** Was vor „Übernehmen“ stimmen muss; leer, wenn alles passt. Ohne Lösung geht es (dann bewertet nur die Lehrkraft). */
export function fehlerVorUebernehmen(zeilen: ProbeZeile[], erlaubt?: Set<string>): string[] {
  const f: string[] = [];
  if (!zeilen.length) return ["Bitte mindestens eine Teilaufgabe eintragen."];
  if (zeilen.length > MAX_TEILAUFGABEN) f.push(`Höchstens ${MAX_TEILAUFGABEN} Teilaufgaben.`);
  const unsicher = zeilen.filter((z) => z.unsicher).length;
  if (unsicher) f.push(unsicher === 1 ? "Eine Zeile ist noch unsicher. Bitte prüfen und „Passt so“ tippen." : `${unsicher} Zeilen sind noch unsicher. Bitte prüfen und „Passt so“ tippen.`);
  if (zeilen.some((z) => !/^\d{1,3}$/.test(z.aufgabe.trim()))) f.push("Jede Zeile braucht die Nummer der Aufgabe (1, 2, 3 …).");
  if (zeilen.some((z) => z.teil.trim() && !teilVon(z.teil))) f.push("Eine Teilaufgabe ist ein Buchstabe (a, b, c …) oder leer.");
  if (zeilen.some((z) => !z.text.trim())) f.push("Bei einer Teilaufgabe fehlt der Text.");
  const ohnePunkte = zeilen.filter((z) => punkteVon(z.punkte) == null).length;
  if (ohnePunkte) f.push(ohnePunkte === 1 ? `Bei einer Teilaufgabe fehlen die Punkte (0,5 bis ${PUNKTE_MAX}).` : `Bei ${ohnePunkte} Teilaufgaben fehlen die Punkte (0,5 bis ${PUNKTE_MAX}).`);
  const gesehen = new Set<string>();
  for (const z of zeilen) {
    const k = schluessel(z.aufgabe.trim(), teilVon(z.teil));
    if (gesehen.has(k)) {
      f.push(`Die Nummer ${z.aufgabe.trim()}${teilVon(z.teil)} steht zweimal.`);
      break;
    }
    gesehen.add(k);
  }
  if (erlaubt && zeilen.some((z) => z.skillId && !erlaubt.has(z.skillId))) f.push("Eine Fähigkeit passt nicht zum Fach.");
  return f;
}

/** Der Name ohne ein „Probeschularbeit“ am Anfang, das der Titel der Übung schon nennt („Probeschularbeit: Brüche“ → „Brüche“). */
export const ohneProbeWort = (titel: string) => titel.replace(/^\s*probe-?schularbeit(?![a-zäöüß])\s*[:–-]?\s*/i, "").trim();

/**
 * Der Text der Aufgabe am Gerät: „Aufgabe 1: <Einleitung>“, darunter „a) <Text>“; ohne Teilaufgabe „Aufgabe 2: <Text>“. So
 * findet der Schüler die Nummer seines Blatts wieder.
 */
export function aufgabenText(z: Pick<ProbeZeile, "aufgabe" | "teil" | "einleitung" | "text">): string {
  const einl = z.einleitung.trim();
  const text = z.text.trim();
  if (!z.teil) return `Aufgabe ${z.aufgabe}: ${einl ? `${einl}\n\n` : ""}${text}`;
  return `Aufgabe ${z.aufgabe}${einl ? `: ${einl}` : ""}\n\n${z.teil}) ${text}`;
}

/** Die Quelle an jeder Aufgabe: „eigene Probeschularbeit (Datei probe.pdf)“. */
export const quelleText = (datei: string) => {
  const name = eineZeile(datei.split(/[\\/]/).pop(), 80);
  return name ? `eigene Probeschularbeit (Datei ${name})` : "eigene Probeschularbeit";
};

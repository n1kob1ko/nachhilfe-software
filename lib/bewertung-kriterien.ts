/**
 * Erwartungshorizont und Bewertung eines Schreibauftrags (Plan 4.2): die vier Kriterien der SRDP Deutsch (Inhalt,
 * Textstruktur, Stil und Ausdruck, normative Sprachrichtigkeit), je Kriterium eine Stufe wie die Notenstufen der
 * LBVO, und die Vorlage eines Erwartungshorizonts aus der Textsorte. Rein, ohne Datenbank: Formular, Server und Tests
 * nutzen dasselbe. Gespeichert wird in lib/schreibauftrag-bewertung.ts.
 */
import { planFor, SORTEN, type AuftragView } from "./schreibauftrag";
import { wordRange } from "./textinterpretation";

export const KRITERIEN = [
  { key: "inhalt", name: "Inhalt", frage: "Arbeitsaufträge erfüllt, Bezug zur Textbeilage stimmt, Aussagen begründet" },
  { key: "textstruktur", name: "Textstruktur", frage: "Aufbau der Textsorte, Absätze, Gedankenfolge, Umfang" },
  { key: "stil", name: "Stil und Ausdruck", frage: "Wortwahl, Satzbau, Ton und Merkmale der Textsorte" },
  { key: "sprachrichtigkeit", name: "Normative Sprachrichtigkeit", frage: "Rechtschreibung, Grammatik, Zeichensetzung" },
] as const;
export type KriteriumKey = (typeof KRITERIEN)[number]["key"];
export const KRITERIUM_KEYS = KRITERIEN.map((k) => k.key) as KriteriumKey[];
export const isKriterium = (x: unknown): x is KriteriumKey => typeof x === "string" && (KRITERIUM_KEYS as string[]).includes(x);
export const kriteriumName = (k: KriteriumKey) => KRITERIEN.find((x) => x.key === k)!.name;

/** Kurz, für die Dokumentation einer Einheit: „Note 3 (Inhalt 3, Aufbau 2, Ausdruck 3, Sprache 4)“. */
export const KRITERIUM_KURZ: Record<KriteriumKey, string> = { inhalt: "Inhalt", textstruktur: "Aufbau", stil: "Ausdruck", sprachrichtigkeit: "Sprache" };

export type KriteriumText = { key: KriteriumKey; name: string; frage: string };

/**
 * Die vier Kriterien in den Worten der Schulstufe (2026-10-23): dieselben Schlüssel für jede Textarbeit, die Wörter der
 * SRDP nur in der Oberstufe. So speichert text_bewertungen jede Bewertung gleich, und die Dokumentation liest sie gleich.
 */
export function kriterienFuer(band: "volksschule" | "unterstufe" | "oberstufe"): KriteriumText[] {
  if (band === "oberstufe") return KRITERIEN.map((k) => ({ ...k }));
  if (band === "volksschule")
    return [
      { key: "inhalt", name: "Inhalt", frage: "Passt der Text zur Aufgabe, ist alles Verlangte da, versteht man, was passiert" },
      { key: "textstruktur", name: "Aufbau", frage: "Anfang, Mitte und Schluss, eine sinnvolle Reihenfolge" },
      { key: "stil", name: "Ausdruck", frage: "Treffende Wörter, verschiedene Satzanfänge, keine ständigen Wiederholungen" },
      { key: "sprachrichtigkeit", name: "Sprachrichtigkeit", frage: "Rechtschreibung, Satzzeichen und Satzbau, gemessen an dieser Schulstufe" },
    ];
  return [
    { key: "inhalt", name: "Inhalt", frage: "Arbeitsaufträge erfüllt, Bezug zur Angabe stimmt, Aussagen begründet" },
    { key: "textstruktur", name: "Aufbau", frage: "Aufbau der Textsorte (Einleitung, Hauptteil, Schluss oder Teile des Briefs), Absätze, roter Faden" },
    { key: "stil", name: "Ausdruck", frage: "Wortwahl, Satzbau, Ton und Merkmale der Textsorte" },
    { key: "sprachrichtigkeit", name: "Sprachrichtigkeit", frage: "Rechtschreibung, Grammatik, Zeichensetzung, gemessen an dieser Schulstufe" },
  ];
}

/** Die Stufen je Kriterium, wie die Notenstufen der Leistungsbeurteilungsverordnung. */
export const STUFEN = [
  { wert: 1, name: "Sehr gut", text: "weit über das Wesentliche hinaus erfüllt" },
  { wert: 2, name: "Gut", text: "über das Wesentliche hinaus erfüllt" },
  { wert: 3, name: "Befriedigend", text: "das Wesentliche zur Gänze erfüllt" },
  { wert: 4, name: "Genügend", text: "das Wesentliche überwiegend erfüllt" },
  { wert: 5, name: "Nicht genügend", text: "das Wesentliche nicht überwiegend erfüllt" },
] as const;
export type Stufe = (typeof STUFEN)[number]["wert"];
export const stufeOf = (v: unknown): Stufe | null => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
  return Number.isInteger(n) && n >= 1 && n <= 5 ? (n as Stufe) : null;
};
export const stufeName = (s: Stufe) => STUFEN[s - 1].name;

/** Der Erwartungshorizont: je Kriterium die Punkte, was ein guter Text enthält. */
export type Erwartung = Record<KriteriumKey, string[]>;
export const leereErwartung = (): Erwartung => ({ inhalt: [], textstruktur: [], stil: [], sprachrichtigkeit: [] });
export const erwartungLeer = (e: Erwartung) => KRITERIUM_KEYS.every((k) => !e[k].length);

export const MAX_PUNKTE = 12;
export const MAX_PUNKT = 400;

/** Ein Feld je Kriterium, ein Punkt je Zeile; Aufzählungszeichen am Anfang fallen weg. */
export function punkteAus(v: unknown): string[] {
  return String(v ?? "")
    .split(/\r?\n/)
    .map((z) => z.replace(/^\s*(?:[•\-–*]|\d+[.)])\s*/, "").replace(/\s+/g, " ").trim().slice(0, MAX_PUNKT))
    .filter(Boolean)
    .slice(0, MAX_PUNKTE);
}

/** Der Erwartungshorizont aus dem Formular (Felder `e_inhalt` …) oder aus gespeichertem JSON. */
export function cleanErwartung(raw: Partial<Record<string, unknown>>): Erwartung {
  const e = leereErwartung();
  for (const k of KRITERIUM_KEYS) {
    const v = raw[k];
    e[k] = Array.isArray(v) ? punkteAus(v.map(String).join("\n")) : punkteAus(v);
  }
  return e;
}

export function parseErwartung(json: string | null | undefined): Erwartung | null {
  if (!json) return null;
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    return raw && typeof raw === "object" ? cleanErwartung(raw) : null;
  } catch {
    return null;
  }
}

/** Die Arbeitsaufträge aus dem Text des Auftrags: die Zeilen mit • (oder -) am Anfang. */
export function auftragsPunkte(prompt: string): string[] {
  return prompt
    .split(/\r?\n/)
    .filter((z) => /^\s*[•\-–]\s*\S/.test(z))
    .map((z) => z.replace(/^\s*[•\-–]\s*/, "").trim());
}

/**
 * Die Vorlage aus der Textsorte, ohne KI: die Arbeitsaufträge (Inhalt), der Schreibplan und der Umfang (Textstruktur),
 * die Merkmale der Textsorte (Stil und Ausdruck) und die sprachlichen Normen. Die Lehrkraft ändert sie und speichert.
 */
export function vorlageFor(v: Pick<AuftragView, "sorte" | "target" | "kind">, prompt: string): Erwartung {
  const s = SORTEN[v.sorte];
  const beilage = s.beilage === "Geschichte" ? "der Geschichte" : "der Textbeilage";
  const { min, max } = wordRange(v.target);
  const auftraege = auftragsPunkte(prompt);
  return {
    inhalt: [
      ...auftraege,
      `Aussagen über den Inhalt ${beilage} stimmen und sind begründet.`,
      ...(v.sorte === "zusammenfassung" ? [] : ["Deutung oder Meinung: jede am Text begründete Richtung zählt, nicht nur eine."]),
    ].slice(0, MAX_PUNKTE),
    textstruktur: [...planFor(v).map((p) => `${p.title}: ${p.hint}`), "Ein Absatz je Teil, die Gedanken folgen aufeinander.", `Umfang: ${min} bis ${max} Wörter.`],
    stil: [...(s.merkmale.length ? s.merkmale : ["Präsens", "sachlicher Stil", "Fachbegriffe zu Erzählform, Aufbau und Stilmitteln"]), "Treffende, abwechslungsreiche Wortwahl, Ton passt zur Textsorte und zum Publikum."],
    sprachrichtigkeit: [
      "Rechtschreibung und Zeichensetzung weitgehend fehlerfrei.",
      "Grammatik richtig: Zeitformen, Fälle, Satzbau.",
      ...(s.zitiert ? ["Zitate wörtlich, in Anführungszeichen und mit Zeilenangabe."] : []),
    ].slice(0, MAX_PUNKTE),
  };
}

// ---------- die Bewertung ----------

export type BewertungKriterium = { key: KriteriumKey; stufe: Stufe; begruendung: string };
/** Ein Arbeitsauftrag, wie die Lehrkraft ihn mit der Bewertung übernommen hat (vorher ein Urteil der KI). */
export type BewertungAuftrag = { nr: number; text: string; status: AuftragStatus };
export type Bewertung = { kriterien: BewertungKriterium[]; note: Stufe | null; auftraege?: BewertungAuftrag[] };

export const MAX_BEGRUENDUNG = 1500;

/**
 * Die Bewertung aus dem Formular (`s_inhalt`, `b_inhalt` …, `note`, je Arbeitsauftrag `a_1` …): jede Stufe ist Pflicht,
 * die Gesamtnote nicht. `auftraege`: die Aufträge, wie die App sie gelesen hat; ihr Urteil kommt aus dem Formular.
 * `namen`: die Wörter der Kriterien in der Meldung.
 */
export function cleanBewertung(f: (name: string) => unknown, o: { auftraege?: { nr: number; text: string }[]; namen?: KriteriumText[] } = {}): { bewertung: Bewertung } | { error: string } {
  const kriterien: BewertungKriterium[] = [];
  for (const k of KRITERIUM_KEYS) {
    const stufe = stufeOf(f(`s_${k}`));
    if (!stufe) return { error: `Bitte bei „${o.namen?.find((x) => x.key === k)?.name ?? kriteriumName(k)}“ eine Stufe wählen.` };
    const begruendung = String(f(`b_${k}`) ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_BEGRUENDUNG);
    kriterien.push({ key: k, stufe, begruendung });
  }
  const auftraege = (o.auftraege ?? []).flatMap((a): BewertungAuftrag[] => {
    const s = f(`a_${a.nr}`);
    return isAuftragStatus(s) ? [{ nr: a.nr, text: a.text, status: s }] : [];
  });
  return { bewertung: { kriterien, note: stufeOf(f("note")), ...(auftraege.length ? { auftraege } : {}) } };
}

export function parseBewertung(json: string | null | undefined): Bewertung | null {
  if (!json) return null;
  try {
    const raw = JSON.parse(json) as { kriterien?: unknown; note?: unknown; auftraege?: unknown };
    const list = Array.isArray(raw.kriterien) ? (raw.kriterien as Record<string, unknown>[]) : [];
    const kriterien = KRITERIUM_KEYS.flatMap((k): BewertungKriterium[] => {
      const r = list.find((x) => x?.key === k);
      const stufe = stufeOf(r?.stufe);
      return r && stufe ? [{ key: k, stufe, begruendung: String(r.begruendung ?? "") }] : [];
    });
    const auftraege = (Array.isArray(raw.auftraege) ? (raw.auftraege as Record<string, unknown>[]) : []).flatMap((a): BewertungAuftrag[] =>
      a && Number.isInteger(a.nr) && isAuftragStatus(a.status) ? [{ nr: Number(a.nr), text: String(a.text ?? ""), status: a.status }] : [],
    );
    return kriterien.length === KRITERIUM_KEYS.length ? { kriterien, note: stufeOf(raw.note), ...(auftraege.length ? { auftraege } : {}) } : null;
  } catch {
    return null;
  }
}

/**
 * Die Note, die für den Lernstand zählt: die Gesamtnote, sonst der Schnitt der vier Stufen (ungerundet, 1 bis 5).
 * null: keine Bewertung. Die Umrechnung in einen Wert 0 bis 1 macht lib/analysis.ts wie bei einer Schularbeit.
 */
export function lernstandNote(b: Pick<Bewertung, "kriterien" | "note">): number | null {
  if (b.note) return b.note;
  return schnitt(b.kriterien);
}

/** Der Schnitt der Stufen, auf eine Kommastelle; nur als Hilfe neben der Gesamtnote, die die Lehrkraft setzt. */
export function schnitt(kriterien: { stufe: Stufe | null }[]): number | null {
  const s = kriterien.map((k) => k.stufe).filter((x): x is Stufe => x !== null);
  return s.length ? Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10 : null;
}

// ---------- „Aufgabe erfüllt?“: die Arbeitsaufträge, die die App selbst aus der Aufgabenstellung liest ----------

/** So beurteilt die KI einen Arbeitsauftrag; „nicht_beurteilbar“, wenn ihr dafür etwas fehlt (etwa die Textvorlage). */
export const AUFTRAG_STATUS = [
  { key: "erfuellt", name: "erfüllt" },
  { key: "teilweise", name: "teilweise" },
  { key: "fehlt", name: "fehlt" },
  { key: "nicht_beurteilbar", name: "nicht beurteilbar" },
] as const;
export type AuftragStatus = (typeof AUFTRAG_STATUS)[number]["key"];
export const AUFTRAG_STATUS_KEYS = AUFTRAG_STATUS.map((s) => s.key) as AuftragStatus[];
export const isAuftragStatus = (x: unknown): x is AuftragStatus => typeof x === "string" && (AUFTRAG_STATUS_KEYS as string[]).includes(x);
export const auftragStatusName = (s: AuftragStatus) => AUFTRAG_STATUS.find((x) => x.key === s)!.name;

/** Höchstens so viele Arbeitsaufträge prüft die KI; mehr stehen selten in einer Aufgabenstellung. */
export const MAX_AUFTRAEGE = 12;

export type Arbeitsauftraege = {
  /** die Arbeitsaufträge in der Reihenfolge der Aufgabenstellung, ohne Nummer oder Aufzählungszeichen */
  punkte: string[];
  /** Zeilen, die zu keinem Auftrag gehören (Einleitung, „Bearbeite folgende Aufträge:“, Umfang): der Rahmen für die KI */
  rahmen: string[];
  /** false: die Aufgabenstellung ließ sich nicht teilen und ist ein einziger Auftrag */
  geteilt: boolean;
  /** so viele Aufträge über MAX_AUFTRAEGE fielen weg */
  weggelassen: number;
};

/** „1.“, „2)“, „a)“, „Aufgabe 1:“, „Teil 2 –“, „•“, „-“, „–“, „*“ am Anfang einer Zeile, danach ein Leerzeichen. */
const AUFTRAG_MARKE = /^\s*(?:(?:Aufgabe|Auftrag|Arbeitsauftrag|Teilaufgabe|Teil)\s*\d{1,2}[a-z]?\s*[:.)\-–]?|\d{1,2}[a-z]?\s*[.)]|[a-hA-H]\s*\)|[•\-–*▪●◦·])(?=\s|$)\s*/;
const satzEnde = (z: string) => /[.!?:;…"“”»«)]$/.test(z.trim());
const kleinAnfang = (z: string) => /^\s*\p{Ll}/u.test(z);
const punktText = (z: string) => z.replace(/\s+/g, " ").trim().slice(0, MAX_PUNKT);
const ungeteilt = (zeilen: string[]): Arbeitsauftraege => {
  const ganz = punktText(zeilen.join(" "));
  return { punkte: ganz ? [ganz] : [], rahmen: [], geteilt: false, weggelassen: 0 };
};

/**
 * Die Arbeitsaufträge einer Aufgabenstellung, ohne KI und immer gleich. Nummerierte Zeilen, Aufzählungen und „Aufgabe 1:“
 * sind je ein Auftrag; eine Folgezeile gehört dazu (klein geschrieben, eingerückt oder nach einer Zeile ohne Satzende),
 * andere Zeilen davor und danach sind der Rahmen. Ohne solche Zeichen ist jede eigene Zeile ein Auftrag (am Zeilenende
 * getrennte Sätze werden wieder verbunden), eine Zeile mit „:“ am Ende ist Rahmen. Lässt sich nichts teilen, ist die
 * ganze Aufgabenstellung ein Auftrag. Die KI beurteilt genau diese Aufträge und keine weiteren.
 */
export function arbeitsauftraege(prompt: string): Arbeitsauftraege {
  const zeilen = String(prompt ?? "").replace(/\r\n?/g, "\n").split("\n").map((z) => z.replace(/\s+$/, ""));
  const punkte: string[] = [];
  const rahmen: string[] = [];
  if (zeilen.some((z) => AUFTRAG_MARKE.test(z) && z.replace(AUFTRAG_MARKE, "").trim())) {
    // offen: der Auftrag, an den eine Folgezeile kommt; nach einer Leerzeile oder einer Rahmenzeile keiner
    let offen: number | null = null;
    for (const z of zeilen) {
      if (!z.trim()) {
        if (offen !== null && punkte[offen]) offen = null;
        continue;
      }
      const m = z.match(AUFTRAG_MARKE);
      if (m) {
        punkte.push(z.slice(m[0].length).trim());
        offen = punkte.length - 1;
      } else if (offen !== null && (!punkte[offen] || kleinAnfang(z) || /^\s{2,}/.test(z) || !satzEnde(punkte[offen]))) {
        punkte[offen] = `${punkte[offen]} ${z.trim()}`.trim();
      } else {
        rahmen.push(z.trim());
        offen = null;
      }
    }
  } else {
    const verbunden: string[] = [];
    let neu = true;
    for (const z of zeilen) {
      if (!z.trim()) {
        neu = true;
        continue;
      }
      const vorher = verbunden[verbunden.length - 1];
      if (!neu && vorher !== undefined && (kleinAnfang(z) || !satzEnde(vorher))) verbunden[verbunden.length - 1] = `${vorher} ${z.trim()}`;
      else verbunden.push(z.trim());
      neu = false;
    }
    for (const z of verbunden) (/:$/.test(z) ? rahmen : punkte).push(z);
    if (punkte.length < 2) return ungeteilt(verbunden);
  }
  const alle = punkte.map(punktText).filter(Boolean);
  if (!alle.length) return ungeteilt(zeilen);
  return { punkte: alle.slice(0, MAX_AUFTRAEGE), rahmen: rahmen.map(punktText).filter(Boolean), geteilt: alle.length > 1, weggelassen: Math.max(0, alle.length - MAX_AUFTRAEGE) };
}

/** Eine Zeile im Kasten „Was fehlt“; `stopp`: die Aufgabe wird gar nicht geprüft. */
export type FehltZeile = { ton: "stopp" | "hinweis"; text: string };

export type FehlendeAngaben = { pruefbar: boolean; zeilen: FehltZeile[]; auftraege: Arbeitsauftraege };

/**
 * Was „Aufgabe erfüllt?“ fehlt, bestimmt von der App, nie von der KI. Ohne Aufgabenstellung (oder bei einem Text, der nicht
 * abgegeben, zu kurz oder zu lang ist) gibt es keine Prüfung des Inhalts. Ohne Textvorlage, mit der Vorlage statt eines
 * eigenen Erwartungshorizonts oder mit einer ungeteilten Aufgabenstellung gibt es sie, aber der Kasten sagt, was deshalb
 * nicht oder nur grob beurteilt werden kann. So sieht eine Prüfung mit fehlenden Angaben nie vollständig aus.
 */
export function fehlendeAngaben(o: {
  prompt: string;
  art: "schreibauftrag" | "bildgeschichte" | "text";
  /** die Textbeilage, die Bildbeschreibungen oder die Angabe der Lehrkraft; '' = keine */
  vorlage: string;
  /** nur beim Schreibauftrag: ein eigener Erwartungshorizont ist gespeichert */
  erwartungGespeichert?: boolean;
  fertig: boolean;
  woerter: number;
  minWoerter: number;
  maxWoerter: number;
}): FehlendeAngaben {
  const auftraege = arbeitsauftraege(o.prompt);
  const zeilen: FehltZeile[] = [];
  if (!auftraege.punkte.length) {
    zeilen.push({ ton: "stopp", text: "Es gibt keine Aufgabenstellung. Ohne sie lässt sich nicht beurteilen, ob die Aufgabe erfüllt ist; geprüft wird nur die Sprache." });
    return { pruefbar: false, zeilen, auftraege };
  }
  if (!o.fertig) zeilen.push({ ton: "stopp", text: "Der Text ist noch nicht abgegeben. Ob die Aufgabe erfüllt ist, wird erst geprüft, wenn er als fertig markiert ist." });
  else if (o.woerter < o.minWoerter) zeilen.push({ ton: "stopp", text: `Der Text ist zu kurz: Für diese Prüfung braucht er mindestens ${o.minWoerter} Wörter.` });
  else if (o.woerter > o.maxWoerter) zeilen.push({ ton: "stopp", text: `Der Text ist für diese Prüfung zu lang (höchstens ${o.maxWoerter.toLocaleString("de-AT")} Wörter).` });
  if (!o.vorlage.trim())
    zeilen.push({
      ton: "hinweis",
      text:
        o.art === "schreibauftrag"
          ? "Die Textbeilage ist leer. Ob sich der Text richtig auf sie bezieht und ob Zitate stimmen, kann die KI nicht prüfen."
          : o.art === "bildgeschichte"
            ? "Die Bilder haben keine Beschreibungen. Ob die Geschichte zu den Bildern passt, kann die KI nicht prüfen."
            : "Keine Angabe oder Textvorlage hinterlegt. Ob sich der Text richtig auf eine Vorlage bezieht und ob Zitate daraus stimmen, kann die KI nicht prüfen.",
    });
  if (o.art === "schreibauftrag" && !o.erwartungGespeichert) zeilen.push({ ton: "hinweis", text: "Der Erwartungshorizont ist nur die Vorlage aus der Textsorte, nicht von dir angepasst. Die vorgeschlagenen Stufen messen an dieser Vorlage." });
  if (!auftraege.geteilt) zeilen.push({ ton: "hinweis", text: "Die Aufgabenstellung ließ sich nicht in einzelne Arbeitsaufträge teilen. Sie wird als ein Auftrag geprüft." });
  if (auftraege.weggelassen) zeilen.push({ ton: "hinweis", text: `Die Aufgabenstellung hat mehr als ${MAX_AUFTRAEGE} Arbeitsaufträge; geprüft werden die ersten ${MAX_AUFTRAEGE}.` });
  return { pruefbar: !zeilen.some((z) => z.ton === "stopp"), zeilen, auftraege };
}

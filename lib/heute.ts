/**
 * **Heute** (niko, 25.10.2026: „Eine Ansicht. Eine aktuelle Aufgabe. Eine wichtigste Aktion.“): die heutigen Schüler
 * der Lehrkraft in der Reihenfolge des Tages, jeder mit einer kurzen Karte aus der **automatischen Vorbereitung**
 * (lib/vorbereitung-auto.ts): Thema und Warum aus dem stärksten Signal (Prüfung > Schulstoff > vom Schüler gemeldet >
 * wiederholte Fehler > offene Ziele > Wiederholung), das geprüfte Lernpaket oder der Plan aus den Daten,
 * Schwierigkeiten und Prüfung. Die Karte rechnet ohne KI; gibt es zum jetzigen Datenstand schon ein KI-Briefing,
 * kommen die Schwierigkeiten aus ihm. Fehlt es, bereitet die App es im Hintergrund vor (lib/briefing-auto.ts), ohne
 * dass Heute wartet. Der geführte Unterricht nimmt dieselbe Wahl (`autoFuerEinheit`, Fach aus `fachHeute`).
 *
 * Der Tagesplan selbst ist derselbe wie vorher auf der Startseite (D17): veröffentlichte Plätze des Wochenplans
 * und von Hand geplante Einheiten ohne Platz.
 */
import { bereiteBriefingVor } from "./briefing-auto";
import { briefingDaten, datumKurz, einfachesBriefing, gespeichertesBriefing, KEINE_SCHWACHSTELLE, type BriefingInhalt, type Fokus } from "./briefing";
import { leseStand } from "./cockpit";
import { daysUntil, inTagen } from "./exams";
import { getLernpaket, listLernpakete, type Lernpaket } from "./lernpakete";
import { heutigeEinheiten } from "./planung/heute";
import { tagAddieren, wienerDatum, wienerMinuten } from "./planung/zeit";
import { RULE_LABEL, type NextStep } from "./recommend";
import * as repo from "./repo";
import { getUnit, type UnitStatus } from "./units";
import { fachVon, fokusAus, naechsteEinheiten, paketeZumWaehlen, schuelerBasis, wahlAm, wuenscheFuer, type Vorbereitet } from "./vorbereitung-auto";

const parseLocal = (s: string) => new Date(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s) && !/Z|[+-]\d{2}:?\d{2}$/.test(s) ? s.replace(" ", "T") : s);
const minutenVon = (s: string) => {
  const d = parseLocal(s);
  return d.getHours() * 60 + d.getMinutes();
};
const zweistellig = (n: number) => String(n).padStart(2, "0");
const uhrzeit = (min: number) => `${zweistellig(Math.floor(min / 60))}:${zweistellig(min % 60)}`;

/**
 * Der Ort eines Platzes im Tagesplan: Raumname und Gebäude. „Online“ als Gebäudename wäre neben dem Hinweis
 * „online“ nur doppelt und wird weggelassen; ohne Raum steht „Raum noch offen“.
 */
export const ortLabel = (raum: string | null, gebaeude: string | null, online: boolean): string => {
  if (!raum) return online ? "online" : "Raum noch offen";
  const zusatz = gebaeude && gebaeude.toLowerCase() !== (online ? "online" : "vor ort") ? ` · ${gebaeude}` : "";
  return `${raum}${zusatz}${online ? " · online" : ""}`;
};

export type HeutePunkt = {
  key: string;
  /** „14:00–15:40“ beim Platz, „14:00“ bei einer Zeile ohne Platz, „–“ ohne Uhrzeit */
  zeit: string;
  startMin: number;
  endeMin: number;
  studentId: number;
  studentName: string;
  ort: string;
  /** das Fach einer von Hand geplanten Einheit ('' beim Platz: der Wochenplan kennt kein Fach) */
  fach: string;
  platzId: number | null;
  einheitId: number | null;
  einheitStatus: UnitStatus | null;
  /** die Einheit gehört einer anderen Lehrkraft */
  einheitLehrer: string | null;
  nichtStattgefunden: boolean;
  ohnePlatz: boolean;
  erledigt: boolean;
};

/** Was heute ansteht, in der Reihenfolge des Tages (wie bisher auf der Startseite, D17). */
export function tagesplan(teacherId: number, now: Date = new Date()): HeutePunkt[] {
  const today = wienerDatum(now);
  const slots = heutigeEinheiten(teacherId, now);
  const schuelerMitPlatz = new Set(slots.map((p) => p.student_id));
  const todays = repo.lessonsBetween(`${today}T00:00`, `${tagAddieren(today, 1)}T00:00`).filter((l) => l.status !== "abgesagt" && (!l.teacher_id || l.teacher_id === teacherId));
  const einheit = (id: number | null) => (id === null ? null : getUnit(id));
  const fremd = (u: ReturnType<typeof getUnit>) => (u && u.teacher_id !== teacherId ? u.teacher_name : null);
  const punkte: HeutePunkt[] = [
    ...slots.map((p) => {
      const unit = einheit(p.unit_id);
      return {
        key: `platz-${p.id}`,
        zeit: p.zeit_label,
        startMin: p.start_min,
        endeMin: p.start_min + p.geplante_dauer,
        studentId: p.student_id,
        studentName: p.student_name,
        ort: ortLabel(p.room_name, p.room_building, p.room_mode === "online"),
        fach: "",
        platzId: p.id,
        einheitId: p.unit_id,
        einheitStatus: unit?.status ?? null,
        einheitLehrer: fremd(unit),
        nichtStattgefunden: p.nicht_stattgefunden,
        ohnePlatz: false,
        erledigt: unit?.status === "beendet",
      };
    }),
    ...todays
      .filter((l) => !schuelerMitPlatz.has(l.student_id))
      .map((l) => {
        const unit = einheit(l.unit_id);
        const start = minutenVon(l.starts_at);
        return {
          key: `lesson-${l.id}`,
          // Dauer 0 = ohne Uhrzeit dokumentiert (Import der Dokumentation, D27)
          zeit: l.duration_min ? uhrzeit(start) : "–",
          startMin: start,
          endeMin: start + (l.duration_min || 0),
          studentId: l.student_id,
          studentName: l.student_name,
          ort: "",
          fach: l.subject || "",
          platzId: null,
          einheitId: l.unit_id,
          einheitStatus: unit?.status ?? null,
          einheitLehrer: fremd(unit),
          nichtStattgefunden: false,
          ohnePlatz: l.status === "geplant",
          erledigt: l.status === "abgeschlossen",
        };
      }),
  ];
  return punkte.sort((a, b) => a.startMin - b.startMin);
}

/** Noch zu starten: ohne Einheit, nicht vorbei und nicht schon dokumentiert. */
export const offen = (p: HeutePunkt) => p.einheitId === null && !p.erledigt && !p.nichtStattgefunden;

/** Der nächste Schüler, der heute noch kommt (der erste offene, dessen Zeit nicht vorbei ist), sonst null. */
export function naechsterPunkt(punkte: HeutePunkt[], now: Date = new Date()): HeutePunkt | null {
  const jetzt = wienerMinuten(now);
  return punkte.find((p) => offen(p) && (p.endeMin > jetzt || p.zeit === "–")) ?? null;
}

// ---------- the card of one student ----------

export type HeuteKarte = {
  /** das Thema: das gewählte oder vorgeschlagene Lernpaket, sonst die oberste Empfehlung */
  thema: string | null;
  /** die ein, zwei größten Schwierigkeiten aus „Wo es hakt“ */
  schwierigkeiten: string[];
  /** die nächste Prüfung, kurz: „Englisch-Schularbeit in 6 Tagen“ */
  pruefung: string | null;
  /** die Prüfung ist nah (bis PRUEFUNG_TAGE): hervorgehoben; weiter weg steht sie ruhig da */
  pruefungNah?: boolean;
  /** die Länge der Einheit in Minuten: der Platz, sonst die geplante Dauer, mit der auch der Plan rechnet; null = unbekannt */
  dauerMin?: number | null;
  /** warum heute dieses Thema: das „Warum“ des Pakets, sonst der Grund der Empfehlung */
  empfehlung: string | null;
  /** was bereitliegt: „Lernpaket „…“ · mit Präsentation“ oder „Plan aus den Daten: 5 Schritte, 2 Übungen bereit“ */
  vorbereitet?: string | null;
  /** das Fach der Vorbereitung ('' = keines festgelegt): in ihm startet die Einheit */
  fach?: string;
  /** die Schwierigkeiten kommen aus dem KI-Briefing zum jetzigen Datenstand */
  mitKi?: boolean;
  /** die nahe Prüfung hat das Thema gewählt: sie steht im Warum (hervorgehoben), nicht noch einmal darunter */
  warumPruefung?: boolean;
  /** ohne jedes Signal (neuer Schüler): die geprüften Lernpakete zum Wählen, ein Tippen legt eines für heute fest */
  pakete?: { id: number; title: string }[];
};

/** Bis so viele Tage vorher ist eine Prüfung auf der Karte nah (hervorgehoben); weiter weg steht sie ruhig da. */
export const PRUEFUNG_TAGE = 30;

/** Der kurze Name einer Prüfung: ihr Titel, sonst „Englisch-Schularbeit“. */
export const pruefungName = (t: { title?: string; kind: string; subject: string }) => t.title?.trim() || (t.subject ? `${t.subject}-${t.kind}` : t.kind);

/**
 * Die Karte aus den Daten, ohne Datenbank. `paketTitel`: das Paket einer schon gestarteten Einheit (geht vor dem
 * Vorschlag). `woEsHakt` aus dem Briefing ohne KI, `schritte` aus `nextSteps`.
 */
export function heuteKarte(e: {
  wahl: Vorbereitet | null;
  paketTitel?: string | null;
  schritte: Pick<NextStep, "rule" | "skill" | "reason">[];
  woEsHakt: string[];
  pruefung: { titel: string; datum: string; days: number } | null;
  /** ohne Paket: der Plan aus den Daten (für „Vorbereitet“) */
  plan?: BriefingInhalt["plan"];
  /** die Schwierigkeiten aus einem KI-Briefing zum jetzigen Datenstand */
  kiWoEsHakt?: string[] | null;
  /** die Länge der Einheit in Minuten (Platz, sonst die geplante Dauer des Briefings) */
  dauerMin?: number | null;
}): HeuteKarte {
  const w = e.wahl;
  const erste = e.schritte[0];
  const thema =
    e.paketTitel ??
    (w?.art === "gewaehlt" || w?.art === "paket" ? w.paket.title : w?.art === "kein_paket" ? w.thema || null : null) ??
    erste?.skill.name ??
    null;
  const empfehlung =
    (!e.paketTitel && w?.art === "paket" ? w.warum : !e.paketTitel && w?.art === "kein_paket" ? w.signal.warum : null) ??
    (erste ? `${RULE_LABEL[erste.rule]}: ${erste.skill.name}${erste.reason ? ` – ${erste.reason}` : ""}` : null);
  // the next exam is always on the card, however far away
  const p = e.pruefung && e.pruefung.days >= 0 ? e.pruefung : null;
  const pruefung = p ? `${p.titel} am ${datumKurz(p.datum)} (${inTagen(p.days)})` : null;
  // the exam itself chose the topic: one line „Schularbeit … (in 5 Tagen) – Stoff“ instead of the same exam twice
  const signal = !e.paketTitel && (w?.art === "paket" || w?.art === "kein_paket") ? w.signal : null;
  const dieselbe = Boolean(pruefung && signal?.art === "pruefung" && signal.tage === p!.days);
  const ki = (e.kiWoEsHakt ?? []).map((x) => kuerze(x, 140)).filter(Boolean);
  return {
    thema,
    schwierigkeiten: ki.length ? ki.slice(0, 2) : e.woEsHakt.filter((x) => x.trim() && x !== KEINE_SCHWACHSTELLE).slice(0, 2),
    pruefung: dieselbe || !p ? null : `${p.titel} ${inTagen(p.days)}`,
    pruefungNah: Boolean(p && p.days <= PRUEFUNG_TAGE),
    dauerMin: e.dauerMin && e.dauerMin > 0 ? e.dauerMin : null,
    empfehlung: dieselbe ? `${pruefung}${signal!.stoff.length ? ` – ${signal!.stoff.slice(0, 2).join(", ")}` : ""}` : empfehlung,
    warumPruefung: dieselbe,
    vorbereitet: e.paketTitel ? null : vorbereitetText(w, e.plan ?? []),
    fach: fachVon(w),
    mitKi: ki.length > 0,
  };
}

const kuerze = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/**
 * Was für die Einheit bereitliegt, in einer Zeile: das geprüfte Lernpaket (mit Präsentation, wenn eine verknüpft ist)
 * oder der Plan aus den Daten mit den Übungen aus dem Bestand. Null, wenn nichts zu sagen ist.
 */
export function vorbereitetText(w: Vorbereitet | null, plan: BriefingInhalt["plan"]): string | null {
  if (w?.art === "gewaehlt" || w?.art === "paket") {
    const zusatz = [w.art === "paket" && w.unsicher ? "nur über ein Stichwort gefunden" : "", w.paket.praesentation_id ? "mit Präsentation" : ""].filter(Boolean);
    return `Lernpaket „${w.paket.title}“${zusatz.length ? ` · ${zusatz.join(" · ")}` : ""}`;
  }
  if (!plan.length) return null;
  const uebungen = plan.filter((p) => p.uebung).length;
  return `Plan aus den Daten: ${plan.length} Schritte${uebungen ? `, ${uebungen} ${uebungen === 1 ? "Übung" : "Übungen"} bereit` : ""}`;
}

/**
 * Die Karten aller Schüler von heute, je Schüler einmal gerechnet. Rechnet ohne KI. `kiVorbereiten` (nur Heute): für
 * jeden, der noch nicht begonnen hat und zu dessen Datenstand es kein KI-Briefing gibt, eines im Hintergrund
 * vorbereiten, wenn Schalter, KI, Budget und Grenze es erlauben (lib/briefing-auto.ts); hier wird nie gewartet.
 */
export function heuteKarten(teacherId: number, punkte: HeutePunkt[], now: Date = new Date(), o: { kiVorbereiten?: boolean } = {}): Map<number, HeuteKarte> {
  const out = new Map<number, HeuteKarte>();
  if (!punkte.length) return out;
  // the package for today: the teacher's choice, else the app's proposal (only for students not started yet)
  const wahl = new Map<number, Vorbereitet>();
  for (const n of naechsteEinheiten(teacherId, now, { tage: 1 })) if (n.heute && !wahl.has(n.studentId)) wahl.set(n.studentId, n.wahl);
  let pakete: Lernpaket[] | null = null;
  for (const p of punkte) {
    if (out.has(p.studentId)) continue;
    const w = wahl.get(p.studentId) ?? null;
    const begonnen = p.einheitId !== null && p.einheitStatus !== "abgebrochen";
    const fokus = begonnen ? null : fokusAus(w);
    const d = briefingDaten(p.studentId, { now, platzId: p.platzId, fokus });
    if (!d) continue;
    const b = einfachesBriefing(d);
    const stand = begonnen ? leseStand(p.einheitId!) : null;
    const ki = begonnen ? null : gespeichertesBriefing(p.studentId, { stand: d.stand });
    // the next exam, however far away (the briefing only looks 60 days ahead)
    const t = repo.upcomingTests(d.datum, p.studentId)[0];
    const karte = heuteKarte({
      wahl: w,
      paketTitel: stand?.paket_id ? (getLernpaket(stand.paket_id)?.title ?? null) : null,
      schritte: d.schritte,
      woEsHakt: b.woEsHakt,
      pruefung: t ? { titel: pruefungName(t), datum: t.date, days: daysUntil(t.date, d.datum) } : null,
      plan: b.plan,
      kiWoEsHakt: ki?.inhalt.woEsHakt ?? null,
      // the Platz of this row, else the planned duration the unit's plan uses (lib/briefing.ts `heute`)
      dauerMin: p.platzId !== null ? p.endeMin - p.startMin : d.minuten,
    });
    // a new student without any signal: the matching checked packages to pick from, instead of only the plan from the data
    if (!begonnen && offen(p) && w?.art === "ohne_signal") {
      pakete ??= listLernpakete();
      const st = d.student;
      const zurWahl = paketeZumWaehlen({ pakete, fach: p.fach, student: { school_type: st.school_type, grade: st.grade || null, subjects: st.subjects, stufe_status: st.stufe_status } });
      if (zurWahl.length) karte.pakete = zurWahl.map((x) => ({ id: x.id, title: x.title }));
    }
    out.set(p.studentId, begonnen ? { ...karte, fach: getUnit(p.einheitId!)?.subject ?? karte.fach } : karte);
    if (o.kiVorbereiten && !ki && offen(p)) bereiteBriefingVor({ studentId: p.studentId, teacherId, platzId: p.platzId, fokus, stand: d.stand });
  }
  return out;
}

// ---------- one student today: the same choice as on Heute ----------

/**
 * Die Wahl für heute, wie Heute sie zeigt: aus der Liste der kommenden Einheiten dieser Lehrkraft, sonst (der Schüler
 * hat heute keinen Platz bei ihr, oder seine Einheit läuft schon) nach denselben Regeln für heute.
 */
export function wahlHeute(studentId: number, teacherId: number | null, now: Date = new Date()): Vorbereitet | null {
  if (teacherId !== null) {
    const n = naechsteEinheiten(teacherId, now, { tage: 1, nur: studentId }).find((x) => x.heute);
    if (n) return n.wahl;
  }
  const student = repo.getStudent(studentId);
  if (!student) return null;
  return wahlAm(schuelerBasis(student, now), { datum: wienerDatum(now), fach: "", wuensche: wuenscheFuer(studentId, null) });
}

/** Der Schwerpunkt für das Briefing von heute (lib/briefing.ts). */
export const fokusHeute = (studentId: number, teacherId: number | null, now: Date = new Date()): Fokus | null => fokusAus(wahlHeute(studentId, teacherId, now));

/** Das Fach der Vorbereitung von heute: in ihm startet die Einheit, wenn keine geplante Einheit ein Fach vorgibt. */
export const fachHeute = (studentId: number, teacherId: number | null, now: Date = new Date()): string => fachVon(wahlHeute(studentId, teacherId, now));

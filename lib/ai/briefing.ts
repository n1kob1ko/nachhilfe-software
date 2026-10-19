/**
 * Die KI-Fassung des Tagesbriefings (lib/briefing.ts). Sie bekommt die Daten des Schülers **ohne Namen**:
 * der Name des Schülers, die Namen aller Lehrer und aller Schüler und jeder weitere Name, den die App in
 * den Texten findet (auch Eltern, Geschwister, Lehrer der Schule nach „Mutter“, „Bruder“,
 * „Klassenlehrerin“ …), werden vorher durch [Name] ersetzt. Profil-Notizen gehen nicht mit; Ziele,
 * Schulstufe, Fächer und die nächste Schularbeit schon, die KI-Hinweise hängt der Router an.
 *
 * Was zurückkommt, prüft die App: Übungen nur mit einer ID aus der mitgeschickten Liste (alles andere
 * wird verworfen und gezählt), die Minuten werden auf die geplante Dauer gebracht. Die KI ändert nichts;
 * das Ergebnis ist ein Vorschlag, gespeichert in `briefings`.
 */
import { z } from "zod";
import { pct } from "../analysis";
import { datumKurz, KANDIDAT_LABEL, schularbeitText, verteileMinuten, type BriefingDaten, type BriefingInhalt } from "../briefing";
import { db } from "../db";
import { detectNames, namesAfterRelation } from "../name-detection";
import { RULE_LABEL } from "../recommend";
import { klassenLabel } from "../school";
import { maskText, namePattern } from "../text-correction-core";
import { masteryStatus } from "../mastery";
import { runAI, type AIMeta } from "./router";

const BriefingSchema = z.object({
  letzter_stand: z.array(z.string()).describe("2–4 kurze Punkte: was zuletzt gemacht wurde und wie es lief"),
  wo_es_hakt: z.array(z.string()).describe("2–4 kurze Punkte: wo es hakt, konkret mit Fähigkeit und typischem Fehler"),
  plan: z
    .array(
      z.object({
        minuten: z.number().int().describe("Minuten für diesen Schritt"),
        titel: z.string().describe("kurzer Titel, z. B. „Wiederholung: Brüche erweitern“"),
        beschreibung: z.string().describe("ein Satz: was genau gemacht wird"),
        uebung_id: z.string().nullable().describe("ID einer Übung aus der Liste „Übungen im Bestand“, die zu diesem Schritt passt, sonst null"),
      }),
    )
    .describe("3–6 Schritte in sinnvoller Reihenfolge; die Minuten ergeben zusammen genau die geplante Dauer"),
  uebungen: z.array(z.object({ id: z.string().describe("ID aus der Liste „Übungen im Bestand“"), warum: z.string().describe("ein kurzer Satz, warum sie heute passt") })).describe("bis zu 5 passende Übungen, nur IDs aus der Liste"),
  hinweis: z.string().nullable().describe("höchstens ein kurzer Hinweis für die Lehrkraft, sonst null"),
});
export type BriefingKi = z.infer<typeof BriefingSchema>;

const SYSTEM = [
  "Du bereitest eine Nachhilfelehrkraft in Österreich auf die heutige Einheit mit einer Schülerin oder einem Schüler vor.",
  "Stütze dich nur auf die gelieferten Daten. Erfinde keine Ergebnisse, Noten, Termine oder Übungen.",
  "Schreib kurz und konkret in österreichischem Deutsch, in Stichpunkten ohne Anrede. Nenne keine Namen; „[Name]“ steht für einen ersetzten Namen und bleibt so.",
  "letzter_stand: was zuletzt gemacht wurde und wie es lief. wo_es_hakt: konkret, mit Fähigkeit und typischem Fehler.",
  "plan: 3–6 Schritte für heute (Einstieg, Üben, bei naher Schularbeit deren Vorbereitung, Abschluss). Die Minuten ergeben zusammen genau die geplante Dauer.",
  "uebung_id und uebungen: nur IDs aus der Liste „Übungen im Bestand“. Passt keine, dann null bzw. eine leere Liste.",
  "Du änderst nichts an Lernstand oder Dokumentation; das Briefing ist ein Vorschlag für die Lehrkraft.",
].join("\n");

const TREND: Record<string, string> = { up: "steigend", down: "fallend", flat: "gleich", none: "" };

/** Die Texte des Briefings, die ein Mensch geschrieben hat: darin können Namen stehen. */
function freieTexte(d: BriefingDaten): string[] {
  return [
    d.student.goals,
    ...d.doku.flatMap((l) => [l.topic, l.activities, l.positives, l.difficulties, l.mistakes, l.tutor_notes, l.next_steps, l.review_topics, l.homework_note]),
    ...d.verlauf.map((l) => l.topic),
    d.schularbeit ? [d.schularbeit.title ?? "", d.schularbeit.topic, ...(d.schularbeit.topics ?? [])].join(" · ") : "",
    ...d.analysis.errors.map((e) => e.label),
    ...d.kandidaten.map((k) => `${k.titel} · ${k.info}`),
  ].filter((t) => t?.trim());
}

/**
 * Wer verborgen wird: der Schüler, alle Lehrer und alle Schüler der App, dazu jeder Name, den die App in
 * den Texten findet (Vornamen der Liste, „Frau/Herr X“, Nachname nach Vorname, Name nach „Mutter“,
 * „Bruder“, „Klassenlehrerin“ …).
 */
export function namenFuerBriefing(d: BriefingDaten): string[] {
  const bekannt = (db().prepare("SELECT name FROM teachers UNION SELECT name FROM students").all() as { name: string }[]).map((r) => r.name);
  const texte = freieTexte(d);
  return [...new Set([d.student.name, ...bekannt, ...detectNames(texte), ...namesAfterRelation(texte)])];
}

/** Systemprompt und Anfrage, Namen ersetzt. Exportiert für Tests: was die App verlässt, steht hier. */
export function briefingAnfrage(d: BriefingDaten, namen: string[] = namenFuerBriefing(d)): { system: string; prompt: string } {
  const pattern = namePattern(namen);
  const m = (s: string | null | undefined, n = 400) => {
    const t = maskText((s ?? "").trim().replace(/\s*\n\s*/g, "; ").replace(/\s+/g, " "), pattern).masked;
    return t.length > n ? `${t.slice(0, n - 1)}…` : t;
  };
  const s = d.student;
  const zeilen: string[] = [];
  zeilen.push(`Heute: eine Einheit, geplante Dauer ${d.minuten} Minuten.`);
  zeilen.push(`Schüler/in: ${[klassenLabel(s.school_type, s.klasse), s.grade ? `Schulstufe ${s.grade}` : ""].filter(Boolean).join(", ") || "–"} · Fächer: ${s.subjects.join(", ") || "–"}`);
  if (s.goals.trim()) zeilen.push(`Ziele: ${m(s.goals)}`);
  zeilen.push(`Nächste Schularbeit: ${d.schularbeit ? m(schularbeitText(d)) : "keine eingetragen"}`);

  const mitDaten = d.analysis.skills.filter((x) => x.mastery !== null).sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0));
  zeilen.push("", "Lernstand je Fähigkeit (schwächste zuerst; Wert, Status, Trend):");
  if (!mitDaten.length) zeilen.push("- noch keine Daten");
  for (const x of mitDaten.slice(0, 25)) zeilen.push(`- ${x.skill.subject} › ${x.skill.area} › ${x.skill.name}: ${pct(x.mastery).replace(" ", " ")}, ${masteryStatus(x.mastery)}${TREND[x.trend] ? `, ${TREND[x.trend]}` : ""}`);
  if (d.analysis.errors.length) zeilen.push(`Häufige Fehler: ${d.analysis.errors.slice(0, 6).map((e) => `${m(e.label, 80)} (${e.count}×)`).join(", ")}`);

  zeilen.push("", "Empfehlungen der App (wichtigste zuerst):");
  if (!d.schritte.length) zeilen.push("- keine");
  for (const x of d.schritte) zeilen.push(`- [${RULE_LABEL[x.rule]}] ${x.skill.name}: ${m(x.reason, 200)}`);

  zeilen.push("", "Lernverlauf (neueste zuerst):");
  if (!d.verlauf.length) zeilen.push("- noch nichts");
  for (const l of d.verlauf) {
    const art = l.kind === "selbststaendig" ? "selbstständig geübt" : "Einheit";
    zeilen.push(`- ${datumKurz(l.starts_at)} · ${art} · ${[l.subject, m(l.topic, 120)].filter(Boolean).join(": ")}${l.understanding ? ` · Verständnis ${l.understanding}/5` : ""}`);
  }

  zeilen.push("", "Letzte Dokumentationen (neueste zuerst):");
  if (!d.doku.length) zeilen.push("- keine");
  d.doku.forEach((l, i) => {
    zeilen.push(`${i + 1}) ${datumKurz(l.starts_at)} · ${[l.subject, m(l.topic, 120)].filter(Boolean).join(": ")}`);
    const feld = (label: string, wert: string) => {
      if (wert.trim()) zeilen.push(`   ${label}: ${m(wert)}`);
    };
    feld("Gemacht", l.activities);
    feld("Gut", l.positives);
    feld("Schwierig", l.difficulties);
    feld("Fehler", l.mistakes);
    feld("Beobachtungen", l.tutor_notes);
    feld("Nächstes Mal", l.next_steps);
    feld("Wiederholen", l.review_topics);
    feld("Hausübung", l.homework_note);
    const werte = [l.understanding && `Verständnis ${l.understanding}/5`, l.concentration && `Konzentration ${l.concentration}/5`, l.motivation && `Motivation ${l.motivation}/5`].filter(Boolean);
    if (werte.length) zeilen.push(`   ${werte.join(", ")}`);
  });

  zeilen.push("", "Übungen im Bestand (nur diese IDs verwenden):");
  if (!d.kandidaten.length) zeilen.push("- keine passenden; uebung_id ist dann immer null");
  for (const k of d.kandidaten) zeilen.push(`- ${k.id}: ${KANDIDAT_LABEL[k.art]} „${m(k.titel, 120)}“ · passt zu ${k.skills.join(", ")} · ${m(k.info, 160)}`);

  return { system: SYSTEM, prompt: zeilen.join("\n") };
}

const kurz = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/**
 * Die Antwort der KI, wie die App sie übernimmt: Übungen nur aus dem Bestand (`verworfen` zählt die
 * anderen), Minuten passend zur geplanten Dauer, Texte gekürzt. Ohne einen einzigen Planschritt ist
 * die Antwort nicht brauchbar.
 */
export function pruefeKiBriefing(raw: BriefingKi, d: Pick<BriefingDaten, "kandidaten" | "minuten" | "schularbeit">): { inhalt: BriefingInhalt; verworfen: number } | { fehler: string } {
  const ids = new Set(d.kandidaten.map((k) => k.id));
  let verworfen = 0;
  const liste = (xs: string[], n: number) => xs.map((x) => kurz(x, 300)).filter(Boolean).slice(0, n);
  const schritte = raw.plan
    .map((p) => ({ minuten: p.minuten, titel: kurz(p.titel, 80), beschreibung: kurz(p.beschreibung, 300), uebung: p.uebung_id?.trim() || null }))
    .filter((p) => p.titel || p.beschreibung)
    .slice(0, 8)
    .map((p) => {
      if (p.uebung && !ids.has(p.uebung)) {
        verworfen++;
        return { ...p, uebung: null };
      }
      return p;
    });
  if (!schritte.length) return { fehler: "Die KI hat keinen brauchbaren Plan geliefert." };
  // the KI's minutes stay when they fit; else they are scaled to the planned duration
  const passt = schritte.every((p) => Number.isInteger(p.minuten) && p.minuten >= 1) && schritte.reduce((a, p) => a + p.minuten, 0) === d.minuten;
  const minuten = passt ? schritte.map((p) => p.minuten) : verteileMinuten(schritte.map((p) => p.minuten), d.minuten);
  const gesehen = new Set<string>();
  const uebungen: BriefingInhalt["uebungen"] = [];
  for (const u of raw.uebungen) {
    const id = u.id.trim();
    if (!ids.has(id)) {
      verworfen++;
      continue;
    }
    if (gesehen.has(id) || uebungen.length >= 5) continue;
    gesehen.add(id);
    uebungen.push({ id, warum: kurz(u.warum, 200) });
  }
  return {
    inhalt: {
      letzterStand: liste(raw.letzter_stand, 5),
      woEsHakt: liste(raw.wo_es_hakt, 5),
      // the date comes from the app, never from the KI
      schularbeit: schularbeitText(d),
      plan: schritte.map((p, i) => ({ ...p, minuten: minuten[i] })),
      uebungen,
      hinweis: raw.hinweis?.trim() ? kurz(raw.hinweis, 300) : null,
    },
    verworfen,
  };
}

export type KiBriefing = { ok: true; inhalt: BriefingInhalt; verworfen: number; callId: number | null } | { ok: false; error: string };

/** Eine Anfrage an die KI (über den Router: Budget, Protokoll, KI-Hinweise, manueller Modus). */
export async function kiBriefing(d: BriefingDaten, meta: AIMeta): Promise<KiBriefing> {
  const { system, prompt } = briefingAnfrage(d);
  const out = await runAI("briefing", BriefingSchema, system, prompt, { meta });
  if (!out.ok) return { ok: false, error: out.message };
  const geprueft = pruefeKiBriefing(out.data, d);
  if ("fehler" in geprueft) return { ok: false, error: geprueft.fehler };
  return { ok: true, ...geprueft, callId: out.callId };
}

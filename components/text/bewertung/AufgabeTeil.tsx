import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  aufgabeErneutAction,
  aufgabePruefenAction,
  bestaetigeBewertungAction,
  erwartungVorschlagenAction,
  nimmBewertungZurueckAction,
  speichereAngabeAction,
  speichereErwartungAction,
  verwirfBewertungVorschlagAction,
  verwirfErwartungVorschlagAction,
} from "@/app/textbewertung-actions";
import { Info } from "@/components/Info";
import { RetryButton } from "@/components/text/correction/RetryButton";
import { Pill, Reveal, formatDate, formatTime } from "@/components/ui";
import { je100, type AuftragErgebnis } from "@/lib/ai/schreibauftrag-bewertung";
import { auftragStatusName, KRITERIEN, type AuftragStatus, type KriteriumKey } from "@/lib/bewertung-kriterien";
import { getSkill } from "@/lib/repo";
import {
  angabeOf,
  aufgabeCents,
  aufgabeStand,
  aufgabeVorschau,
  bewertungInfo,
  erwartungInfo,
  kiStatus,
  kriterienDesTexts,
  lernstandSkillFuer,
  pruefungInfo,
  sprachBefund,
} from "@/lib/schreibauftrag-bewertung";
import { auftragFor } from "@/lib/schreibauftrag-store";
import { levelOfText } from "@/lib/text-correction";
import type { TextView } from "@/lib/texts";
import type { GefundenerBeleg } from "@/lib/zitatpruefung";
import { AngabeForm } from "./Angabe";
import { BewertungForm, ErwartungForm, KiKnopf, type BewertungWerte } from "./BewertungTeile";
import { WasFehlt } from "./WasFehlt";

const wann = (s: string) => `${formatDate(s, { day: "numeric", month: "short" })}, ${formatTime(s)}`;
const verworfen = (n: number) => (n ? `${n === 1 ? "Eine Stelle" : `${n} Stellen`} mit Zitat oder Zeilenangabe ${n === 1 ? "stand" : "standen"} nicht im Text und ${n === 1 ? "wurde" : "wurden"} weggelassen.` : "");
const TON: Record<AuftragStatus, "green" | "amber" | "red" | "neutral"> = { erfuellt: "green", teilweise: "amber", fehlt: "red", nicht_beurteilbar: "neutral" };

/** Für den Reiter: „Note 3“ (übernommen), „2/3“ (erfüllt von allen), „läuft“, „!“ (fehlgeschlagen) oder nichts; `titel` sagt es ganz. */
export function aufgabeKurz(textId: number): { kurz: string; titel: string; tone: "green" | "amber" | "red" | "neutral" | "accent"; laeuft: boolean } | null {
  const p = pruefungInfo(textId);
  if (p.status === "laeuft") return { kurz: "läuft", titel: "Die KI prüft die Aufgabe", tone: "accent", laeuft: true };
  const note = bewertungInfo(textId).bestaetigt?.note;
  if (note) return { kurz: `Note ${note}`, titel: `Bewertung übernommen, Note ${note}`, tone: "green", laeuft: false };
  if (p.status === "fehler") return { kurz: "!", titel: "Die Prüfung ist fehlgeschlagen", tone: "red", laeuft: false };
  const s = aufgabeStand(p);
  if (!s) return null;
  return { kurz: `${s.erfuellt}/${s.von}`, titel: `${s.erfuellt} von ${s.von} Arbeitsaufträgen erfüllt`, tone: s.erfuellt === s.von ? "green" : "amber", laeuft: false };
}

function Beleg({ b, name, vorlage }: { b: GefundenerBeleg; name: string; vorlage: string }) {
  return (
    <li className="text-ink-2">
      „{b.zitat}“ <span className="text-ink-3">· {b.quelle === "textbeilage" ? `${vorlage}${b.stelle ? `, ${b.stelle}` : ""}` : `im Text von ${name}`}</span>
    </li>
  );
}

/**
 * „Aufgabe und Note“ auf der Korrekturseite, nur für die Lehrkraft: was fehlt (von der App), je Arbeitsauftrag das
 * Urteil der KI mit geprüften Belegen, dann die Note (NoteTeil) bei jeder Textarbeit mit „Bewertung übernehmen“, beim
 * Schreibauftrag dazu der Erwartungshorizont, sonst die Angabe. Getrennt von der Sprache; der Text wird nie umgeschrieben.
 * Erst die übernommene Note zählt (Dokumentation, Lernstand). `start`: der gemeinsame Knopf „Korrigieren“, solange die
 * Sprache noch nicht mit KI geprüft ist.
 */
export function AufgabeTeil({ text, start }: { text: TextView; start?: React.ReactNode }) {
  const name = text.student_name.split(" ")[0];
  const v = aufgabeVorschau(text);
  const p = pruefungInfo(text.id);
  const a = auftragFor(text.id);
  const vorlageName = a ? "Textbeilage" : v.art === "bildgeschichte" ? "Bildbeschreibung" : "Angabe";
  const veraltet = p.auftraege !== null && p.version !== null && p.version !== text.version;
  const geaendert = p.auftraege !== null && JSON.stringify(p.fehlte) !== JSON.stringify(v.zeilen);
  const sekunden = p.status === "laeuft" && p.startedAt ? Math.max(0, Math.round((Date.now() - Date.parse(p.startedAt)) / 1000)) : 0;
  const uebernommen = Boolean(bewertungInfo(text.id).bestaetigt?.auftraege?.length);
  const mitSprache = sprachBefund(text) ?", der Fehlerzahl der Korrektur" : "";
  const zustimmung = `Der Text von ${name} geht mit der Aufgabenstellung${v.vorlage ? `, ${v.vorlage}` : ""}${mitSprache}${a ? " und dem Erwartungshorizont" : ""} an die KI, etwa ${aufgabeCents(v)} US-Cent. Namen werden vorher zu [Name].`;

  return (
    <section className="grid max-w-[860px] gap-5" data-testid="aufgabe-teil">
      <div className="grid gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[20px] font-semibold">Aufgabe und Note</h2>
          <Info label="Was wird hier geprüft?">
            Je Arbeitsauftrag, ob der Text ihn erfüllt, dazu eine Stufe je Kriterium und eine Gesamtnote. Die Aufträge liest die App selbst aus der Aufgabenstellung; die KI beurteilt genau diese und keine weiteren. Jedes Zitat und jede Zeile prüft die App im Text. Der Text wird nicht verändert. Erst wenn du die Bewertung übernimmst, steht sie in der Dokumentation und zählt für den Lernstand.
          </Info>
        </div>
        <p className="text-[14px] text-ink-2">Ob {name} die Aufgabe erfüllt hat und welche Note passt. Ein Vorschlag der KI, nur für dich, bis du ihn übernimmst.</p>
      </div>

      {p.status === "laeuft" && (
        <div className="flex items-center gap-3 rounded-2xl bg-violet-wash px-5 py-4 text-[15px]" role="status" data-testid="aufgabe-laeuft">
          <Loader2 size={18} className="shrink-0 animate-spin text-violet" aria-hidden />
          <span>
            <b>Die KI prüft die Aufgabe</b> <span className="num text-ink-2">({sekunden} s)</span>. Das Ergebnis erscheint hier von selbst.
          </span>
        </div>
      )}
      {p.status === "fehler" && (
        <div className="flex items-start gap-3 rounded-2xl bg-red-wash px-5 py-4 text-[15px]" role="alert" data-testid="aufgabe-fehler">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red" aria-hidden />
          <div className="min-w-0 flex-1">
            <p>
              <b>Die Prüfung von Aufgabe und Note ist fehlgeschlagen.</b> {p.fehler || "Die Prüfung wurde unterbrochen."} Die Korrektur der Sprache ist davon nicht betroffen.
            </p>
            {p.freigegeben && <RetryButton kind="aufgabe" cents={aufgabeCents(v)} action={aufgabeErneutAction.bind(null, text.id)} />}
          </div>
        </div>
      )}

      {p.auftraege ? (
        <WasFehlt zeilen={p.fehlte} titel="Was gefehlt hat">
          {geaendert && <p className="text-ink-2">Die Angaben haben sich seither geändert. „Neu prüfen“ nimmt sie mit.</p>}
        </WasFehlt>
      ) : (
        <WasFehlt zeilen={v.zeilen} titel="Was fehlt" />
      )}
      {!v.punkte.length && (
        <p className="text-[14px]">
          <Link href={a ? `/texte/${text.id}/schreibauftrag` : `/texte/${text.id}`} className="font-medium text-accent hover:underline" data-testid="aufgabe-eintragen">
            {a ? "Arbeitsauftrag eintragen" : "Aufgabenstellung beim Text eintragen"}
          </Link>
        </p>
      )}

      {p.auftraege && (
        <div className="panel grid gap-4 p-5" data-testid="aufgabe-ergebnis">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[17px] font-semibold">Arbeitsaufträge</h3>
            {uebernommen ? <Pill tone="neutral">Urteil der KI</Pill> : <Pill tone="amber">Vorschlag, ungeprüft</Pill>}
            {p.at && <span className="text-[13px] text-ink-3">geprüft {wann(p.at)}</span>}
          </div>
          {uebernommen && <p className="text-[14px] text-ink-2">Übernommen ist dein Urteil unten in der Bewertung.</p>}
          {(veraltet || p.verworfen > 0) && (
            <p className="text-[14px] text-amber">
              {veraltet ? `${name} hat den Text danach noch geändert. ` : ""}
              {verworfen(p.verworfen)}
            </p>
          )}
          <ol className="grid gap-4">
            {p.auftraege.map((x) => (
              <li key={x.nr} className="grid gap-1.5 border-t border-line pt-3 first:border-t-0 first:pt-0" data-testid="auftrag" data-status={x.status}>
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <span className="num font-semibold text-ink-3">{x.nr}.</span>
                  <p className="min-w-0 flex-1 font-medium">{x.text}</p>
                  <Pill tone={TON[x.status]}>{auftragStatusName(x.status)}</Pill>
                </div>
                {x.begruendung && <p className="text-[14.5px] leading-relaxed">{x.begruendung}</p>}
                {x.ohneAntwort && <p className="text-[14px] text-ink-2">Die KI hat zu diesem Auftrag nichts geliefert. Bitte selbst beurteilen.</p>}
                {!x.ohneAntwort && x.weggelassen > 0 && (
                  <p className="text-[13px] text-amber">
                    {x.begruendung ? "" : "Die Begründung der KI stand so nicht im Text und wurde weggelassen. "}
                    {verworfen(x.weggelassen)}
                  </p>
                )}
                {x.belege.length > 0 && (
                  <ul className="grid gap-1 text-[13.5px]">
                    {x.belege.map((b) => (
                      <Beleg key={b.zitat} b={b} name={name} vorlage={vorlageName} />
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
          {v.pruefbar && p.status !== "laeuft" && (
            <Reveal label="Neu prüfen">
              <KiKnopf action={aufgabePruefenAction.bind(null, text.id)} label="Aufgabe neu prüfen" wartend="Wird gestartet …" zustimmung={zustimmung} grund={v.grund} testid="aufgabe-neu" />
            </Reveal>
          )}
        </div>
      )}

      {!p.auftraege && v.pruefbar && p.status !== "laeuft" && (
        <div className="panel grid gap-3 p-5" data-testid="aufgabe-start">
          <p className="text-[14px] font-semibold">Das prüft die KI:</p>
          <ol className="grid list-decimal gap-1 pl-5 text-[14.5px]" data-testid="aufgabe-punkte">
            {v.punkte.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
          <p className="text-[13px] text-ink-2">Dieselbe Prüfung schlägt die Stufen und die Note unten vor.</p>
          <div className="border-t border-line pt-3">
            {start ?? <KiKnopf action={aufgabePruefenAction.bind(null, text.id)} label="Aufgabe prüfen" wartend="Wird gestartet …" zustimmung={zustimmung} grund={v.grund} testid="aufgabe-ki" />}
          </div>
        </div>
      )}

      {v.art === "text" && (
        <div className="panel grid gap-3 p-5" data-testid="aufgabe-angabe">
          <Reveal label={v.vorlage ? "Angabe / Textvorlage ändern" : "Angabe / Textvorlage hinzufügen"}>
            <AngabeForm action={speichereAngabeAction.bind(null, text.id)} angabe={angabeOf(text.id)} />
          </Reveal>
        </div>
      )}

      <NoteTeil text={text} name={name} auftraege={p.auftraege ?? []} />
      {a && <ErwartungTeil text={text} name={name} />}
    </section>
  );
}

/**
 * Die Note bei jeder Textarbeit: der Vorschlag der KI im Formular, deutlich als „Vorschlag der KI“ markiert, bis die
 * Lehrkraft ihn mit einem Klick übernimmt (vorher kann sie alles ändern). Was die Note bewirkt, steht dabei: Dokumentation
 * der Einheit und der Lernstand der Fähigkeit, oder warum sie für keinen Lernstand zählt.
 */
function NoteTeil({ text, name, auftraege }: { text: TextView; name: string; auftraege: AuftragErgebnis[] }) {
  const b = bewertungInfo(text.id);
  const v = b.vorschlag;
  const kriterien = kriterienDesTexts(text);
  const level = levelOfText(text);
  const werte = Object.fromEntries(
    KRITERIEN.map((k) => {
      const aus = v?.kriterien.find((x) => x.key === k.key);
      const best = b.bestaetigt?.kriterien.find((x) => x.key === k.key);
      return [k.key, aus ? { stufe: aus.stufe, begruendung: aus.begruendung, belege: aus.belege } : v ? { stufe: null, begruendung: "", belege: [] } : { stufe: best?.stufe ?? null, begruendung: best?.begruendung ?? "", belege: [] }];
    }),
  ) as BewertungWerte;
  const fehlt = v ? kriterien.filter((k) => !v.kriterien.some((x) => x.key === k.key)).map((k) => k.name) : [];
  // das Urteil je Auftrag: das übernommene, sonst das der KI
  const best = new Map((b.bestaetigt?.auftraege ?? []).map((x) => [x.nr, x.status]));
  const formAuftraege = auftraege.map((x) => ({ nr: x.nr, text: x.text, status: (v ? x.status : (best.get(x.nr) ?? x.status)) as AuftragStatus }));
  const sb = sprachBefund(text);
  const skill = b.bestaetigt && b.lernstandSkill ? (getSkill(b.lernstandSkill) ?? null) : lernstandSkillFuer(text);
  const hinweise: Partial<Record<KriteriumKey, string>> = {};
  if (sb) hinweise.sprachrichtigkeit = `Die Korrektur der Sprache fand ${sb.fehler} Fehler in ${sb.woerter} Wörtern (${je100(sb).toLocaleString("de-AT")} je 100 Wörter).`;
  if (v?.ohneInhalt) hinweise.inhalt = "Kein Vorschlag: Mindestens ein Arbeitsauftrag war nicht zu beurteilen (siehe „Was gefehlt hat“). Bitte selbst wählen.";
  const titel = level.band === "oberstufe" && auftragFor(text.id) ? "Bewertung nach SRDP" : "Bewertung";

  return (
    <section className="panel grid gap-4 p-5" data-testid="bewertung">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[17px] font-semibold">{titel}</h3>
        {v ? <Pill tone="amber">Vorschlag der KI</Pill> : null}
        {b.bestaetigt && (
          <Pill tone="green">
            Übernommen {b.bestaetigtAt ? wann(b.bestaetigtAt) : ""}
            {b.bestaetigt.note ? ` · Note ${b.bestaetigt.note}` : ""}
          </Pill>
        )}
      </div>
      <p className="text-[14px] text-ink-2">
        Je Kriterium eine Stufe und ein, zwei Sätze, warum, dazu die Gesamtnote. Als Bewertung gilt nur, was du übernimmst. Dann steht sie in der Dokumentation der Einheit
        {skill ? (
          <>
            {" "}
            und zählt für den Lernstand von <b className="font-semibold text-ink">{skill.name}</b>.
          </>
        ) : (
          <>. Für den Lernstand zählt sie nicht: Zu „{text.topic || "dieser Textsorte"}“ gibt es bei {level.label} keine passende Fähigkeit.</>
        )}
      </p>
      {b.bestaetigt && b.version !== null && b.version !== text.version && <p className="text-[14px] text-amber">Der Text wurde nach der Bewertung noch geändert.</p>}
      {v && (
        <div className="grid gap-2 rounded-2xl bg-amber-wash px-4 py-3 text-[14px] text-amber" data-testid="bewertung-vorschlag">
          <p>
            Vorschlag der KI{v.at ? ` vom ${wann(v.at)}` : ""}, steht unten im Formular. Prüf jede Stufe und Begründung, dann „Bewertung übernehmen“. {verworfen(v.verworfen)}
            {fehlt.length ? ` Ohne Vorschlag: ${fehlt.join(", ")}.` : ""}
            {v.note ? "" : " Ohne Gesamtnote."}
            {v.version !== null && v.version !== text.version ? " Der Text wurde seither geändert." : ""}
          </p>
          <form action={verwirfBewertungVorschlagAction.bind(null, text.id)}>
            <button className="btn btn-ghost btn-sm">Vorschlag verwerfen</button>
          </form>
        </div>
      )}
      {!v && !b.bestaetigt && <p className="text-[13.5px] text-ink-2">Den Vorschlag macht dieselbe Prüfung wie die Arbeitsaufträge oben. Du kannst die Bewertung auch selbst eintragen.</p>}
      <BewertungForm
        key={`${v?.at ?? ""}|${b.bestaetigtAt ?? ""}`}
        action={bestaetigeBewertungAction.bind(null, text.id)}
        werte={werte}
        note={v ? v.note : (b.bestaetigt?.note ?? null)}
        name={name}
        kriterien={kriterien}
        auftraege={formAuftraege}
        hinweise={hinweise}
        label={v || !b.bestaetigt ? "Bewertung übernehmen" : "Änderung übernehmen"}
      />
      {b.bestaetigt && (
        <form action={nimmBewertungZurueckAction.bind(null, text.id)} className="border-t border-line pt-3">
          <button className="btn btn-ghost btn-sm" data-testid="bewertung-zuruecknehmen">
            Bewertung zurücknehmen
          </button>
        </form>
      )}
    </section>
  );
}

/** Schreibauftrag: der Erwartungshorizont, wie bisher auf /bewertung. */
function ErwartungTeil({ text, name }: { text: TextView; name: string }) {
  const e = erwartungInfo(text.id)!;
  const erwartungWerte = e.vorschlag ?? e.gespeichert ?? e.vorlage;
  const erwartungKey = `${e.vorschlagAt ?? ""}|${e.gespeichertAt ?? ""}`;
  const kiErwartung = kiStatus("erwartung", text.student_id);

  return (
    <>
      <section className="panel grid gap-4 p-5" data-testid="erwartungshorizont">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[17px] font-semibold">Erwartungshorizont</h3>
          {e.vorschlag ? (
            <Pill tone="amber">Ungeprüft</Pill>
          ) : e.gespeichert ? (
            <Pill tone="green">Gespeichert {e.gespeichertAt ? wann(e.gespeichertAt) : ""}</Pill>
          ) : (
            <Pill>Vorlage, noch nicht gespeichert</Pill>
          )}
          {e.gespeichert && <Pill tone={e.freigegeben ? "accent" : "neutral"}>{e.freigegeben ? `${name} sieht ihn` : `${name} sieht ihn nicht`}</Pill>}
        </div>
        <p className="text-[14px] text-ink-2">
          Je Kriterium, was ein guter Text zu diesem Auftrag enthalten kann. Bei offenen Fragen sind mehrere Richtungen richtig: Schreib auf, was zählt, nicht einen Mustertext.
        </p>
        <Reveal label={e.gespeichert ? "Erwartungshorizont ansehen und ändern" : "Erwartungshorizont bearbeiten"}>
          <div className="grid gap-4">
            {e.vorschlag && (
              <div className="grid gap-2 rounded-2xl bg-amber-wash px-4 py-3 text-[14px] text-amber" data-testid="erwartung-vorschlag">
                <p>
                  Vorschlag der KI{e.vorschlagAt ? ` vom ${wann(e.vorschlagAt)}` : ""}, noch ungeprüft. Er gilt erst, wenn du ihn speicherst. {verworfen(e.verworfen)}
                </p>
                <form action={verwirfErwartungVorschlagAction.bind(null, text.id)}>
                  <button className="btn btn-ghost btn-sm">Vorschlag verwerfen</button>
                </form>
              </div>
            )}
            {e.beilageGeaendert && (
              <p className="flex items-start gap-2 text-[14px] text-amber" data-testid="beilage-geaendert">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden /> Die Textbeilage wurde nach dem Speichern geändert. Prüf die Zeilenangaben.
              </p>
            )}
            <ErwartungForm key={erwartungKey} action={speichereErwartungAction.bind(null, text.id)} werte={erwartungWerte} freigegeben={e.freigegeben} name={name} />
            <div className="grid gap-2 border-t border-line pt-4">
              <KiKnopf action={erwartungVorschlagenAction.bind(null, text.id)} label="Mit KI vorschlagen" wartend="Vorschlag wird erstellt …" grund={kiErwartung.grund} testid="erwartung-ki" />
              {!kiErwartung.grund && <p className="text-[13px] text-ink-3">Geht mit Auftrag und Textbeilage an die KI, ohne Namen. Zitate und Zeilen, die nicht im Text stehen, lässt die App weg.</p>}
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}

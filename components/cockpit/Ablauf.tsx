import Link from "next/link";
import { after } from "next/server";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpenCheck,
  BookOpenText,
  Camera,
  ChartNoAxesColumn,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  HelpCircle,
  Images,
  ListOrdered,
  PenLine,
  Plus,
  Presentation,
  RotateCcw,
  ShieldAlert,
  SkipForward,
  Square,
  Undo2,
  Wrench,
} from "lucide-react";
import {
  ausfuehrlichAction,
  entscheideAnpassungAction,
  markiereSchrittAction,
  merkeSchrittAction,
  notizAction,
  sendeBestandAction,
  sendeGeneratorAction,
  sendeSchrittAction,
  verschiebeSchrittAction,
  waehlePaketAction,
  zeigeSchrittAction,
} from "@/app/cockpit-actions";
import { endUnitAction } from "@/app/session-actions";
import { AufgabeBewertung } from "@/components/AufgabeBewertung";
import { AnpassenBereich, AnpassungInhalt, KiGrenzeHinweis, OhnePaketAnsicht, PaketAuswahl, PaketKopf } from "@/components/cockpit/Cockpit";
import { CockpitSenden, SchrittNotiz, VorschlagKnopf } from "@/components/cockpit/CockpitClient";
import { AntwortKnoepfe, VorschlagKarte } from "@/components/cockpit/Steuerung";
import { VorgabeKarte } from "@/components/cockpit/Vorgabe";
import { KeinPaket } from "@/components/cockpit/Vorbereitung";
import { CopyLink } from "@/components/CopyLink";
import { MinitestKarte } from "@/components/MinitestKarte";
import { PraesentationSchritt } from "@/components/cockpit/PraesentationSchritt";
import { SchuelerWorteKarte } from "@/components/SchuelerNotiz";
import { TaskBody } from "@/components/TaskPreview";
import { CancelUnit } from "@/components/UnitControl";
import { Pill, Reveal } from "@/components/ui";
import { anpassungen, type Anpassung } from "@/lib/anpassen";
import { bewertungInfos } from "@/lib/bewertungen";
import {
  aufgabenImSchritt,
  bestandsUebung,
  cockpit,
  ergebnis,
  ersteSaetze,
  ersteUebung,
  FRAGE_ARTEN,
  frageText,
  haltBereit,
  hilfeBeiFehler,
  hintergrundZu,
  loesungText,
  planFuehrung,
  planHatUebung,
  skillsDesSchritts,
  uebungGesendet,
  type CockpitDaten,
  type Hilfe,
  type PlanQuelle,
  type PlanStep,
} from "@/lib/cockpit";
import { ausfuehrlichTor, gespeicherteErklaerung, istDuenn, schulstufeVon, type Ausfuehrlich } from "@/lib/ausfuehrlich";
import type { TaskDraft } from "@/lib/tasks";
import { paketWahl, zurFaehigkeit } from "@/lib/cockpit-vorschlag";
import { kostenSchaetzung } from "@/lib/lernpaket-ki";
import { SCHRITT_ARTEN, ungeprueft, type LernpaketMitSchritten, type LernpaketSchritt } from "@/lib/lernpakete";
import { studentDevice } from "@/lib/live";
import { letzterStoff, minitestDerEinheit } from "@/lib/minitest";
import * as repo from "@/lib/repo";
import { schuelerWorte } from "@/lib/schueler-notiz";
import { sorteOfSkill } from "@/lib/schreibauftrag";
import { KONTROLLE_ANZAHL, themenDesPlans } from "@/lib/stundenplan";
import { EIGENE_VOKABELN } from "@/lib/vokabeln";
import { vorschlagDerEinheit, type Anzeige } from "@/lib/steuerung";
import { levelFor } from "@/lib/text-correction-rules";
import { platzFuerEinheit, type UnitView } from "@/lib/units";
import { autoFuerEinheit, kiVorgabe, type Signal } from "@/lib/vorbereitung-auto";
import { vorgabeDerEinheit } from "@/lib/vorgabe";
import { SchreibauftragStart, TextarbeitZeilen } from "@/components/cockpit/Textarbeit";
import { schreibArt, schreibStartFuer, schreibStartZurPruefung, textLaeufe, textZumSchritt, type TextLauf } from "@/lib/textarbeit-ablauf";
import { SCHULARBEIT_SCHRITT } from "@/lib/briefing";

const first = (n: string) => n.split(" ")[0];

/**
 * Der **geführte Unterricht** (niko, 25.10.2026: „Unterricht zeigt nur den aktuellen Schritt“): eine Karte mit dem
 * Schritt auf dem Schirm, darin was der Lehrer sagt, zeigt und fragt und was er als Antwort erwartet, „Passende Übungen senden“
 * und drei Knöpfe: **Weiter**, **Wiederholen** und **Schüler versteht es nicht**. Darüber die Schritte als Punkte zum
 * Antippen. Alles andere des früheren Cockpits und der Bereiche Übungen und Fortschritt liegt unter „Weitere Werkzeuge“
 * und bleibt dort vollständig.
 *
 * Mit Lernpaket kommen die Schritte aus dem Paket, ohne Paket aus dem Plan für die ganze Einheit (lib/stundenplan.ts, Ids
 * negativ): mehrere Themen, je Thema Erklären, Üben und Lernkontrolle oder die Schritte eines geprüften Pakets. Darüber
 * eine Zeile mit den Themen und Minuten, die die Liste der Schritte öffnet. „Wiederholen“ und „Schüler versteht es
 * nicht“ zählen je Schritt mit (`einheit_cockpit.wiederholt` und
 * `.nicht_verstanden`); beim Beenden steht das in der Dokumentation (Wiederholen bzw. Schwierigkeiten). Nur für den
 * Lehrer der Einheit; nichts davon kommt auf eine Schülerseite, außer den Aufgaben, die er sendet.
 */
export function Unterricht({
  unit,
  student,
  fehler,
  teacherId,
  werkzeugeOffen = false,
  ausfuehrlich = null,
  folien = null,
}: {
  unit: UnitView;
  student: repo.Student;
  fehler?: string;
  teacherId: number | null;
  werkzeugeOffen?: boolean;
  /** nach „Ausführlicher erklären“: der Schritt, dessen Erklärung offen steht */
  ausfuehrlich?: number | null;
  /** nach „Folien ansehen“ (lib/praesentation-unterricht.ts): der Schritt, dessen Präsentation als Text offen steht */
  folien?: number | null;
}) {
  const c = cockpit(unit.id, { mitPlan: true });
  // die nächste Übung bereit (lib/cockpit.ts haltBereit): nach dem Antworten, ohne KI, nie beim Schüler
  if (!c.paket && c.planAktuell) after(() => haltBereit(unit.id));
  const name = first(student.name);
  // im Plan: ein Schritt aus einem geprüften Lernpaket wird wie ein Schritt des Pakets gezeigt (lib/stundenplan.ts)
  const quelle = !c.paket && c.planAktuell ? (c.planQuellen.get(c.planAktuell.id) ?? null) : null;
  // „Anpassen“: Vorschläge und Übernommenes gelten für das Paket, das gerade gewählt ist (im Plan: das des Schritts)
  const paketDa = c.paket ?? quelle?.paket ?? null;
  const liste = paketDa ? anpassungen(unit.id).filter((a) => a.paket_id === paketDa.id) : [];
  // die Themen des Plans (ein früher festgehaltener Plan hat keine): eine Zeile über der Karte, mit den neu getakteten Minuten;
  // ein Thema, das heute keinen Platz mehr hat, steht als „Nächstes Mal“ darunter
  const alleThemen = c.paket ? [] : themenDesPlans(c.plan.map((s) => ({ ...s, minuten: c.minuten.get(s.id) ?? s.minuten })));
  const themen = alleThemen.filter((t) => !t.ids.every((id) => c.verschoben.has(id)));
  const naechstesMal = alleThemen.filter((t) => !themen.includes(t)).map((t) => t.name);
  // was der Schüler vor dieser Einheit geschrieben hat: seine Worte, nur zum Lesen (lib/schueler-notiz.ts)
  const worte = schuelerWorte(student.id, unit.id);
  const ids = c.paket ? c.schritte.map((s) => s.id) : c.plan.map((s) => s.id);
  const aktuell = c.paket ? (c.aktuell?.id ?? null) : (c.planAktuell?.id ?? null);
  // Anpassung im Unterricht (lib/steuerung.ts): aus den Antworten gleich unter der Gerätezeile, nach einem Zeichen des
  // Lehrers („versteht es nicht“, „Falsch“) in der Karte des Schritts
  const vorschlag = vorschlagDerEinheit(unit.id, c);
  const oben = vorschlag?.ausloeser === "antworten" ? vorschlag : null;
  const imSchritt = vorschlag?.ausloeser === "lehrer" ? vorschlag : null;
  // Textarbeiten dieser Einheit (lib/textarbeit-ablauf.ts): eine Zeile je Text mit dem nächsten Schritt
  const laeufe = textLaeufe(unit.id);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5" data-testid="cockpit">
      {fehler && (
        <p role="alert" className="rounded-2xl bg-red-wash px-4 py-3 text-[15px] text-red">
          {fehler}
        </p>
      )}
      {oben && <VorschlagKarte a={oben} unitId={unit.id} schrittId={aktuell} />}
      <TextarbeitZeilen unit={unit} laeufe={laeufe} />
      <KiGrenzeHinweis studentId={student.id} name={name} />
      {worte && <SchuelerWorteKarte worte={worte} name={name} />}
      <VorgabeKarte unit={unit} c={c} />
      {themen.length ? <ThemenZeile c={c} themen={themen} unitId={unit.id} aktuell={aktuell} /> : <Woher c={c} unitId={unit.id} />}
      {naechstesMal.length > 0 && aktuell !== null && (
        <p className="-mt-3 text-[14px] text-ink-2" data-testid="naechstes-mal">
          <span className="font-semibold text-ink">Nächstes Mal:</span> {naechstesMal.join(", ")}. Heute reicht die Zeit nicht mehr; im Abschluss steht es unter „Weiter mit“.
        </p>
      )}
      {ids.length > 1 && <Punkte c={c} ids={ids} aktuell={aktuell} unitId={unit.id} />}
      {c.paket && c.aktuell ? (
        <SchrittKarte c={c} s={c.aktuell} paket={c.paket} unit={unit} name={name} liste={liste} vorschlag={imSchritt} laeufe={laeufe} folienOffen={folien === c.aktuell.id} />
      ) : c.planAktuell && quelle ? (
        <SchrittKarte c={c} s={{ ...quelle.schritt, id: c.planAktuell.id, minuten: c.minuten.get(c.planAktuell.id) ?? c.planAktuell.minuten }} echteId={quelle.schritt.id} thema={c.planAktuell.thema} paket={quelle.paket} unit={unit} name={name} liste={liste} vorschlag={imSchritt} laeufe={laeufe} folienOffen={folien === c.planAktuell.id} />
      ) : !c.paket && c.planAktuell ? (
        <PlanKarte c={c} s={c.planAktuell} unit={unit} student={student} vorschlag={imSchritt} laeufe={laeufe} ausfuehrlichOffen={ausfuehrlich === c.planAktuell.id} folienOffen={folien === c.planAktuell.id} />
      ) : ids.length > 0 ? (
        <AllesDurch c={c} unitId={unit.id} naechstesMal={naechstesMal} />
      ) : (
        <p className="panel px-5 py-4 text-[15px] text-ink-2">
          Für heute gibt es keinen Plan aus den Daten. Unter{" "}
          <Link href={`/einheiten/${unit.id}?bereich=cockpit#werkzeuge`} className="font-semibold text-accent underline-offset-2 hover:underline">
            Weitere Werkzeuge
          </Link>{" "}
          ein Lernpaket oder eine Fähigkeit wählen.
        </p>
      )}
      {werkzeugeOffen || ids.length === 0 ? (
        <Werkzeuge c={c} unit={unit} student={student} liste={liste} teacherId={teacherId} ids={ids} aktuell={aktuell} />
      ) : (
        <Link href={`/einheiten/${unit.id}?bereich=cockpit#werkzeuge`} className="panel flex min-h-[52px] flex-wrap items-center gap-x-2 px-4 py-2 sm:px-5" data-testid="werkzeuge-link">
          <Wrench size={18} className="text-ink-2" aria-hidden />
          <span className="text-[16px] font-semibold">Weitere Werkzeuge</span>
          <span className="text-[13.5px] text-ink-3">Übungen, Whiteboard, Foto vom Stoff, Paket, Überspringen, Notiz …</span>
        </Link>
      )}
    </div>
  );
}

/** Eine Zeile: woher die Schritte kommen (Lernpaket oder Plan für heute), und ob das Paket noch ungeprüft ist. */
function Woher({ c, unitId }: { c: CockpitDaten; unitId: number }) {
  const werkzeuge = `/einheiten/${unitId}?bereich=cockpit#werkzeuge`;
  if (!c.paket && !c.plan.length) return null;
  const nachVorgabe = vorgabeDerEinheit(unitId)?.angewendet ?? false;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-ink-2">
      {c.paket ? (
        <>
          <span>
            Lernpaket <span className="font-semibold text-ink">„{c.paket.title}“</span>
          </span>
          {c.stand.automatisch && <Pill tone="accent">Vorschlag der App</Pill>}
          {!c.stand.automatisch && nachVorgabe && <Pill tone="accent">Nach deiner Vorgabe</Pill>}
          {ungeprueft(c.paket) && (
            <span className="inline-flex items-center gap-1 font-medium text-amber">
              <ShieldAlert size={14} aria-hidden /> Ungeprüft: vor dem Verwenden durchlesen
            </span>
          )}
        </>
      ) : nachVorgabe ? (
        <span>
          <span className="font-semibold text-ink">Plan für heute</span> nach deiner Vorgabe, ohne Lernpaket
        </span>
      ) : (
        <span>
          <span className="font-semibold text-ink">Plan für heute</span> aus dem Briefing, ohne Lernpaket
        </span>
      )}
      <Link href={werkzeuge} className="inline-flex min-h-[44px] items-center font-medium text-accent hover:underline">
        {c.paket ? "Anderes Paket" : "Lernpaket wählen"}
      </Link>
    </div>
  );
}

/**
 * Im Plan für die ganze Einheit: eine kurze Zeile mit den Themen und ihren Minuten („Past Simple 35 · E-Mail 30 · …“), das
 * Thema auf dem Schirm hervorgehoben. Antippen öffnet die Schritte zum Hinspringen; dazu woher der Plan kommt und
 * „Lernpaket wählen“. Kein neues Menü.
 */
function ThemenZeile({ c, themen, unitId, aktuell }: { c: CockpitDaten; themen: ReturnType<typeof themenDesPlans>; unitId: number; aktuell: number | null }) {
  const nachVorgabe = vorgabeDerEinheit(unitId)?.angewendet ?? false;
  const jetzt = c.plan.find((s) => s.id === aktuell)?.thema ?? null;
  const paketTitel = (id: number | null) => (id === null ? null : ([...c.planQuellen.values()].find((q) => q.paket.id === id)?.paket.title ?? null));
  return (
    <details className="group text-[14px]">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
        <ListOrdered size={16} className="shrink-0 text-ink-3" aria-hidden />
        <span className="min-w-0 flex-1 leading-snug" data-testid="plan-themen">
          <span className="sr-only">Themen heute: </span>
          {themen.map((t, i) => (
            <span key={t.name}>
              {i > 0 && <span aria-hidden> · </span>}
              <span className={t.name === jetzt ? "font-semibold text-ink" : ""}>
                {t.name} <span className="num">{t.minuten}</span>
              </span>
            </span>
          ))}
        </span>
        <ChevronDown size={16} className="shrink-0 text-accent transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="grid gap-3 pt-1 pb-1" data-testid="plan-schritte">
        <ol className="grid gap-0.5">
          {c.plan.map((s, i) => {
            const vorher = c.plan[i - 1];
            const neu = s.thema && s.thema !== vorher?.thema;
            const st = offenVon(c, s.id);
            const p = neu ? paketTitel(themen.find((t) => t.name === s.thema)?.paketId ?? null) : null;
            return (
              <li key={s.id}>
                {neu && (
                  <p className="mt-2 text-[13px] font-semibold text-ink-2">
                    {s.thema}
                    {p && <span className="font-normal text-ink-3"> · Lernpaket „{p}“</span>}
                  </p>
                )}
                <form action={zeigeSchrittAction.bind(null, unitId, s.id)}>
                  <button
                    aria-current={s.id === aktuell ? "step" : undefined}
                    className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-[15px] hover:bg-panel ${s.id === aktuell ? "bg-accent-wash font-semibold" : ""}`}
                  >
                    <span className="num w-6 shrink-0 text-[13px] text-ink-3">{st === "erledigt" ? <Check size={15} className="text-green" aria-label="erledigt" /> : i + 1}</span>
                    <span className={`min-w-0 flex-1 ${st === "uebersprungen" ? "text-ink-3 line-through" : c.verschoben.has(s.id) ? "text-ink-3" : ""}`}>{s.titel}</span>
                    <span className="num shrink-0 text-[13px] text-ink-3">{c.verschoben.has(s.id) ? "Nächstes Mal" : `${c.minuten.get(s.id) ?? s.minuten} Min.`}</span>
                  </button>
                </form>
              </li>
            );
          })}
        </ol>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-ink-2">
          {nachVorgabe ? <Pill tone="accent">Nach deiner Vorgabe</Pill> : <span>Plan aus den Daten, ohne KI</span>}
          <Link href={`/einheiten/${unitId}?bereich=cockpit#werkzeuge`} className="inline-flex min-h-[44px] items-center font-medium text-accent hover:underline">
            Lernpaket wählen
          </Link>
        </p>
      </div>
    </details>
  );
}

const offenVon = (c: CockpitDaten, id: number) => (c.stand.erledigt.includes(id) ? "erledigt" : c.stand.uebersprungen.includes(id) ? "uebersprungen" : "offen");
const STATUS = { erledigt: "erledigt", uebersprungen: "übersprungen", offen: "offen" } as const;

/** Die Schritte als Punkte: antippen zeigt den Schritt. Grün erledigt, grau übersprungen, blau auf dem Schirm. */
function Punkte({ c, ids, aktuell, unitId }: { c: CockpitDaten; ids: number[]; aktuell: number | null; unitId: number }) {
  const titel = new Map<number, string>([...c.schritte.map((s) => [s.id, s.titel] as const), ...c.plan.map((s) => [s.id, s.titel] as const)]);
  return (
    <nav aria-label="Schritte" data-testid="schritt-punkte">
      <ol className="flex flex-wrap gap-1.5">
        {ids.map((id, i) => {
          const st = offenVon(c, id);
          const an = id === aktuell;
          // open, but its topic moved to next time: grey like a skipped one
          const spaeter = st === "offen" && c.verschoben.has(id);
          const status = spaeter ? "nächstes Mal" : STATUS[st];
          return (
            <li key={id}>
              <form action={zeigeSchrittAction.bind(null, unitId, id)}>
                <button
                  aria-current={an ? "step" : undefined}
                  title={`${titel.get(id)} · ${status}`}
                  className={`num inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2 text-[14px] font-semibold transition-colors ${
                    an ? "bg-accent text-on-fill" : st === "erledigt" ? "bg-green-wash text-green" : st === "uebersprungen" || spaeter ? "bg-panel text-ink-3" : "bg-surface text-ink shadow-[var(--shadow-card)] hover:bg-panel"
                  }`}
                >
                  {st === "erledigt" && !an ? <Check size={15} aria-hidden /> : i + 1}
                  <span className="sr-only">
                    {" "}
                    {titel.get(id)}, {status}
                  </span>
                </button>
              </form>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Ein Block der Karte: Überschrift klein, Text groß. */
function Block({ titel, ton = "", children }: { titel: string; ton?: "" | "green" | "amber"; children: React.ReactNode }) {
  const box = ton === "green" ? "rounded-xl bg-green-wash px-3 py-2" : ton === "amber" ? "rounded-xl bg-amber-wash px-3 py-2" : "";
  const kopf = ton === "green" ? "text-green" : ton === "amber" ? "text-amber" : "text-ink-2";
  return (
    <div className={box}>
      <p className={`text-[13px] font-semibold ${kopf}`}>{titel}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

/** Ein langer Lehrertext: die ersten Sätze groß, der Rest unter „Mehr“ (lib/cockpit.ts `ersteSaetze`); `offen`: gleich ganz. */
function LangText({ text, offen = false }: { text: string; offen?: boolean }) {
  const { kurz, rest } = ersteSaetze(text);
  return (
    <>
      <p className="text-[18px] leading-relaxed whitespace-pre-line">{kurz}</p>
      {rest && (
        <details className="reveal" open={offen} data-testid="sagt-mehr">
          <summary>
            <ChevronDown size={15} aria-hidden className="reveal-chevron" />
            Mehr
          </summary>
          <p className="pt-1 text-[18px] leading-relaxed whitespace-pre-line">{rest}</p>
        </details>
      )}
    </>
  );
}

/**
 * An jedem Schritt, zugeklappt: die Lösungen der Aufgaben (gesendet oder die, die der Schritt senden würde), die typischen
 * Fehler der Fähigkeit und ein, zwei Zeilen Hintergrund. Nur für den Lehrer.
 */
function LoesungReveal({ aufgaben, fehler, hintergrund }: { aufgaben: TaskDraft[]; fehler: string[]; hintergrund: string[] }) {
  if (!aufgaben.length && !fehler.length && !hintergrund.length) return null;
  return (
    <div className="mt-4" data-testid="loesung-am-schritt">
      <Reveal label="Lösung · typische Fehler · Hintergrund">
        <div className="grid gap-3">
          {aufgaben.length > 0 && (
            <div>
              <p className="text-[13px] font-semibold text-ink-2">Lösungen</p>
              <ol className="mt-1 grid gap-1.5">
                {aufgaben.map((a, j) => (
                  <li key={j} className="grid grid-cols-[1.5rem_minmax(0,1fr)] text-[15px] leading-snug">
                    <span className="num text-ink-3">{j + 1}.</span>
                    <span>
                      <span className="line-clamp-2 text-ink-2">{frageText(a)}</span>
                      <span className="block font-medium whitespace-pre-line text-green">{loesungText(a)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {fehler.length > 0 && (
            <div>
              <p className="text-[13px] font-semibold text-amber">Typische Fehler</p>
              <ul className="mt-1 grid list-disc gap-1 pl-5 text-[15px]">
                {fehler.slice(0, 4).map((x, j) => (
                  <li key={j}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          {hintergrund.length > 0 && (
            <div>
              <p className="text-[13px] font-semibold text-ink-2">Hintergrund</p>
              {hintergrund.map((x, j) => (
                <p key={j} className="mt-0.5 text-[14.5px] text-ink-2">
                  {x}
                </p>
              ))}
            </div>
          )}
        </div>
      </Reveal>
    </div>
  );
}

/**
 * Der Rest der gespeicherten ausführlicheren Erklärung (lib/ausfuehrlich.ts): ihr Text steht schon unter „Das sagst du“ (ein
 * Lehrertext, nicht zwei), hier Beispiel, Frage und typische Fehler; nach dem Tippen offen, sonst zugeklappt.
 */
function AusfuehrlichBlock({ a, offen, mathe }: { a: Ausfuehrlich; offen: boolean; mathe: boolean }) {
  if (!a.beispiel && !a.frage && !a.fehler.length) return null;
  return (
    <details className="reveal" open={offen} data-testid="ausfuehrlich">
      <summary>
        <ChevronDown size={15} aria-hidden className="reveal-chevron" />
        Beispiel, Frage und typische Fehler (ausführlich)
      </summary>
      <div className="mt-2 grid gap-3 rounded-xl border border-line px-3 py-3">
        {a.beispiel && (
          <Block titel="Beispiel">
            <p className="text-[16px] leading-relaxed whitespace-pre-line">{a.beispiel.aufgabe}</p>
            {a.beispiel.rechnung.length > 0 && <p className="num mt-1 text-[16px] whitespace-pre-line">{a.beispiel.rechnung.join("\n")}</p>}
            {a.beispiel.loesung && <p className="mt-1 text-[15px] whitespace-pre-line text-ink-2">{a.beispiel.loesung}</p>}
          </Block>
        )}
        {a.frage && (
          <Block titel="Frage">
            <p className="text-[16px] leading-relaxed whitespace-pre-line">{a.frage}</p>
            {a.antwort && (
              <p className="mt-1 text-[15px] whitespace-pre-line">
                <span className="font-semibold text-green">Erwartete Antwort: </span>
                {a.antwort}
              </p>
            )}
          </Block>
        )}
        {a.fehler.length > 0 && (
          <Block titel="Typische Fehler">
            <ul className="grid list-disc gap-1 pl-5 text-[15px]">
              {a.fehler.map((x, j) => (
                <li key={j}>{x}</li>
              ))}
            </ul>
          </Block>
        )}
        <p className="text-[12.5px] text-ink-3">Von der KI geschrieben{mathe ? ", Rechnungen von der App geprüft" : ""}.</p>
      </div>
    </details>
  );
}

/** Kopf der Karte: „Past Simple · Schritt 2 von 6 · Minute 5–15“ (das Thema nur im Plan), Titel, Stand und wie oft wiederholt. */
function KartenKopf({ c, id, titel, minuten, art, ids, thema }: { c: CockpitDaten; id: number; titel: string; minuten: number; art?: React.ReactNode; ids: number[]; thema?: string | null }) {
  const ab = c.ab.get(id) ?? 0;
  // a step whose topic no longer fits today (lib/stundenplan.ts neuTakten) has no minutes
  const spaeter = c.verschoben.has(id);
  const st = offenVon(c, id);
  const w = c.stand.wiederholt[id] ?? 0;
  const n = c.stand.nichtVerstanden[id] ?? 0;
  return (
    <>
      <p className="num text-[13px] text-ink-3">
        {thema && (
          <>
            <span className="font-semibold text-ink-2" data-testid="schritt-thema">
              {thema}
            </span>{" "}
            ·{" "}
          </>
        )}
        Schritt {ids.indexOf(id) + 1} von {ids.length} · {spaeter ? "Nächstes Mal" : `Minute ${ab}–${ab + minuten}`}
      </p>
      <h2 className="mt-1 flex flex-wrap items-center gap-2 text-[21px] leading-tight font-semibold">
        {titel}
        {art}
      </h2>
      {(st !== "offen" || w > 0 || n > 0) && (
        <p className="mt-1.5 flex flex-wrap gap-x-3 text-[14px]">
          {st !== "offen" && (
            <span className={`inline-flex items-center gap-1 font-semibold ${st === "erledigt" ? "text-green" : "text-ink-3"}`}>
              {st === "erledigt" ? <CheckCircle2 size={15} aria-hidden /> : <SkipForward size={15} aria-hidden />} {st === "erledigt" ? "Erledigt" : "Übersprungen"}
            </span>
          )}
          {w > 0 && <span className="text-ink-2">{w === 1 ? "einmal" : `${w}-mal`} wiederholt</span>}
          {n > 0 && <span className="text-amber">{n === 1 ? "einmal" : `${n}-mal`} nicht verstanden</span>}
        </p>
      )}
    </>
  );
}

/** Weiter, Wiederholen, Schüler versteht es nicht: für einen Schritt des Pakets wie des Plans. */
function Knoepfe({ unitId, id, weiterHaupt }: { unitId: number; id: number; weiterHaupt: boolean }) {
  return (
    <div className="btn-reihe mt-5 grid gap-2 sm:flex sm:flex-wrap sm:items-center" data-testid="schritt-knoepfe">
      <form action={markiereSchrittAction.bind(null, unitId, id, "erledigt")}>
        <button className={`btn btn-lg w-full sm:w-auto ${weiterHaupt ? "btn-primary" : "btn-secondary"}`}>
          <Check size={18} aria-hidden /> Weiter
        </button>
      </form>
      <form action={merkeSchrittAction.bind(null, unitId, id, "wiederholt")}>
        <button className="btn btn-secondary btn-lg w-full sm:w-auto">
          <RotateCcw size={18} aria-hidden /> Wiederholen
        </button>
      </form>
      <form action={merkeSchrittAction.bind(null, unitId, id, "nichtVerstanden")}>
        <button className="btn btn-secondary btn-lg w-full sm:w-auto">
          <HelpCircle size={18} aria-hidden /> Schüler versteht es nicht
        </button>
      </form>
    </div>
  );
}

/** Nach „Schüler versteht es nicht“: was es dazu schon gibt (lib/cockpit.ts `hilfeBeiFehler`). */
function HilfeBlock({ hilfe, unitId, werkzeuge }: { hilfe: Hilfe[]; unitId: number; werkzeuge: string }) {
  return (
    <section className="mt-4 grid gap-2 rounded-xl bg-amber-wash px-3 py-3" aria-label="Hilfe" data-testid="hilfe-bei-fehler">
      <p className="text-[14px] font-semibold text-amber">Einfacher erklären</p>
      {hilfe.length ? (
        hilfe.map((h, i) => (
          <div key={i} className="rounded-lg bg-surface/70 px-3 py-2">
            <p className="text-[13px] font-semibold text-ink-2">{h.titel}</p>
            <p className="mt-0.5 text-[16px] leading-relaxed whitespace-pre-line">{h.text}</p>
            {h.antwort && (
              <p className="mt-1 text-[14px] whitespace-pre-line">
                <span className="font-semibold text-green">Erwartete Antwort: </span>
                {h.antwort}
              </p>
            )}
            {h.anpassung && (
              <form action={entscheideAnpassungAction.bind(null, unitId, h.anpassung, "verworfen")} className="mt-1">
                <button className="btn btn-ghost btn-sm !px-2">Entfernen</button>
              </form>
            )}
          </div>
        ))
      ) : (
        <p className="text-[14.5px]">
          Dazu steht nichts im Paket. Unter{" "}
          <Link href={werkzeuge} className="font-semibold underline underline-offset-2">
            Weitere Werkzeuge
          </Link>{" "}
          kannst du anpassen oder einen Schritt zurück gehen.
        </p>
      )}
    </section>
  );
}

/** Übungsschritte, in denen ein ganzer Text geschrieben werden kann. */
const SCHREIB_ARTEN: readonly LernpaketSchritt["art"][] = ["gefuehrte_uebung", "uebung", "zusatz", "kontrolle"];
const SCHREIB_TITEL = /schreib|writing|aufsatz|brief|e-?mail|story|geschichte|erzähl|bericht|bewerbung|interpretation/i;

/**
 * Die Schreibaufgabe eines Schritts im Lernpaket: die Fähigkeit seiner Aufgaben; ohne Aufgaben bei einem Übungsschritt,
 * dessen Titel nach Schreiben klingt, die eine Schreib-Fähigkeit des Pakets.
 */
function schreibSkillDesSchritts(s: LernpaketSchritt, paket: LernpaketMitSchritten): string | null {
  const auf = s.aufgaben.find((a) => a.skillId)?.skillId ?? null;
  if (auf) return schreibArt(auf) ? auf : null;
  if (!SCHREIB_ARTEN.includes(s.art) || !SCHREIB_TITEL.test(s.titel)) return null;
  const ids = paket.skill_ids.filter((id) => schreibArt(id));
  return ids.length === 1 ? ids[0] : null;
}

/**
 * Der Schritt des Lernpakets auf dem Schirm. Im Plan für die ganze Einheit auch ein Schritt eines eingebetteten Pakets:
 * `s` trägt dann die Id und Minuten des Planschritts (Senden, Antworten, Weiter zählen dort), `echteId` ist die des
 * Paketschritts (für Anpassungen), `thema` steht im Kopf.
 */
function SchrittKarte({
  c,
  s,
  paket,
  unit,
  name,
  liste,
  vorschlag,
  laeufe,
  echteId = s.id,
  thema = null,
  folienOffen = false,
}: {
  c: CockpitDaten;
  s: LernpaketSchritt;
  paket: LernpaketMitSchritten;
  unit: UnitView;
  name: string;
  liste: Anpassung[];
  vorschlag: Anzeige | null;
  laeufe: TextLauf[];
  echteId?: number;
  thema?: string | null;
  folienOffen?: boolean;
}) {
  const unitId = unit.id;
  const ids = c.paket ? c.schritte.map((x) => x.id) : c.plan.map((x) => x.id);
  const gesendet = c.stand.gesendet[s.id]?.length ?? 0;
  const angepasst = liste.filter((a) => a.status === "uebernommen" && a.schritt_id === echteId);
  // was der Lehrer übernommen hat und kein „leichter“ ist, steht immer da; das Leichtere erst nach „versteht es nicht“
  const immer = angepasst.filter((a) => a.art === "schwerer");
  const nicht = (c.stand.nichtVerstanden[s.id] ?? 0) > 0;
  const skill = s.aufgaben.find((a) => a.skillId)?.skillId ?? null;
  const hilfe = nicht ? hilfeBeiFehler(s.bei_fehler, angepasst, zurFaehigkeit(skill)) : [];
  // for „Lösung · typische Fehler · Hintergrund“: the skill of the tasks, else the package's first
  const loesungSkill = skill ?? skillsDesSchritts(s)[0] ?? null;
  // „Folie 7“ means something only with the package's presentation; without one the line stays away (no dead link)
  const folie = s.folie && paket.praesentation_id ? s.folie : null;
  const leer = !s.lehrer_sagt.trim() && !s.lehrer_fragt.trim() && !s.erwartete_antwort.trim() && !folie;
  // bei Fragen und Kontrollen: „Richtig / Teilweise / Falsch“, was der Lehrer gehört hat
  const frage = FRAGE_ARTEN.includes(s.art) && Boolean(s.lehrer_fragt.trim() || s.erwartete_antwort.trim());
  const antwort = frage ? <AntwortKnoepfe unitId={unitId} schrittId={s.id} wert={c.stand.antworten[s.id] ?? null} /> : null;
  // a writing step: „Schreibauftrag starten“ is the main action until a text of that kind runs in this unit
  const schreiben = schreibStartFuer(unit, schreibSkillDesSchritts(s, paket));
  const laeuft = schreiben ? textZumSchritt(laeufe, schreiben) : null;
  // a step without tasks before anything was sent: a quiet jump to the first step with an exercise
  const mitAufgaben = new Set(c.paket ? c.schritte.filter((x) => x.aufgaben.length > 0).map((x) => x.id) : c.plan.filter((x) => planHatUebung(x, c.planQuellen)).map((x) => x.id));
  const sprungId = ersteUebung(ids, c.stand, s.id, (id) => mitAufgaben.has(id), uebungGesendet(unitId));
  const sprung = sprungId === null ? null : ([...c.schritte, ...c.plan].find((x) => x.id === sprungId) ?? null);
  return (
    <section className="panel px-4 py-4 sm:px-6 sm:py-5" aria-label="Aktueller Schritt" data-testid="cockpit-schritt">
      <KartenKopf c={c} id={s.id} titel={s.titel} minuten={s.minuten} ids={ids} thema={thema} art={<Pill tone={s.art === "kontrolle" ? "green" : s.art === "zusatz" ? "amber" : "accent"}>{SCHRITT_ARTEN[s.art]}</Pill>} />
      <div className="mt-4 grid gap-4">
        {s.lehrer_sagt.trim() && (
          <Block titel="Das sagst du">
            <LangText text={s.lehrer_sagt} />
          </Block>
        )}
        {/* „Das zeigst du“: die Folie des Pakets, eine passende Präsentation oder „Präsentation erstellen“ (lib/praesentation-unterricht.ts) */}
        <PraesentationSchritt c={c} unitId={unitId} schrittId={s.id} folienOffen={folienOffen} />
        {s.lehrer_fragt.trim() && (
          <Block titel="Das fragst du">
            <p className="text-[18px] leading-relaxed whitespace-pre-line">{s.lehrer_fragt}</p>
            {!s.erwartete_antwort.trim() && antwort}
          </Block>
        )}
        {s.erwartete_antwort.trim() && (
          <Block titel="Erwartete Antwort" ton="green">
            <p className="text-[16px] whitespace-pre-line">{s.erwartete_antwort}</p>
            {antwort}
          </Block>
        )}
        {leer && <p className="text-[14px] text-ink-3">Zu diesem Schritt steht im Paket nichts zum Sagen oder Fragen.</p>}
        {s.notiz.trim() && <p className="text-[14px] whitespace-pre-line text-ink-2">Notiz im Paket: {s.notiz}</p>}
      </div>

      {vorschlag && <VorschlagKarte a={vorschlag} unitId={unitId} schrittId={s.id} imSchritt />}
      {nicht && <HilfeBlock hilfe={hilfe} unitId={unitId} werkzeuge={`/einheiten/${unitId}?bereich=cockpit#werkzeuge`} />}

      {immer.length > 0 && (
        <div className="mt-4 grid gap-2" data-testid="angepasst">
          <p className="text-[13px] font-semibold text-ink-2">Für {name} angepasst, nur in dieser Einheit</p>
          {immer.map((a) => (
            <div key={a.id} className="rounded-xl border border-line px-3 py-2">
              <AnpassungInhalt a={a} />
              <form action={entscheideAnpassungAction.bind(null, unitId, a.id, "verworfen")} className="mt-1">
                <button className="btn btn-ghost btn-sm !px-2">Entfernen</button>
              </form>
            </div>
          ))}
        </div>
      )}

      {s.pruefen.length > 0 && (
        <ul className="mt-3 grid gap-1 rounded-xl bg-amber-wash px-3 py-2 text-[13.5px] text-amber">
          {s.pruefen.map((h, j) => (
            <li key={j} className="flex items-start gap-1.5">
              <ShieldAlert size={14} className="mt-0.5 shrink-0" aria-hidden /> Bitte prüfen: {h}
            </li>
          ))}
        </ul>
      )}

      {schreiben && <SchreibauftragStart start={schreiben} laeuft={laeuft} />}

      {sprung && <ZurErstenUebung unitId={unitId} id={sprung.id} titel={sprung.titel} nr={ids.indexOf(sprung.id) + 1} />}

      {s.aufgaben.length > 0 && (
        <div className="mt-5 flex flex-wrap items-start gap-x-4 gap-y-2 border-t border-line pt-4">
          <CockpitSenden action={sendeSchrittAction.bind(null, unitId, s.id)} unitId={unitId} label={`Passende Übungen senden (${s.aufgaben.length} ${s.aufgaben.length === 1 ? "Aufgabe" : "Aufgaben"})`} primary={gesendet === 0 && !schreiben} />
          {gesendet > 0 && <span className="pt-2.5 text-[13px] text-ink-3">schon {gesendet === 1 ? "einmal" : `${gesendet}-mal`} an {name} gesendet</span>}
        </div>
      )}

      <LoesungReveal aufgaben={s.aufgaben} fehler={loesungSkill ? zurFaehigkeit(loesungSkill).typischeFehler : []} hintergrund={hintergrundZu(loesungSkill, [paket.ziel, s.aufgaben.find((a) => a.teacherNote?.trim())?.teacherNote])} />

      <Knoepfe unitId={unitId} id={s.id} weiterHaupt={schreiben ? Boolean(laeuft) : s.aufgaben.length === 0 || gesendet > 0} />
    </section>
  );
}

/** „Aufgaben mit Lösung ansehen“ mit Bewerten je Aufgabe (lib/bewertungen.ts): die Aufgaben des Schritts, nie Antworten. */
function AufgabenMitLoesung({ s, fach, teacherId }: { s: LernpaketSchritt; fach: string; teacherId: number | null }) {
  const bewertungen = bewertungInfos(s.aufgaben, teacherId);
  const skillName = (id: string) => repo.getSkill(id)?.name ?? id;
  return (
    <Reveal label="Aufgaben mit Lösung ansehen">
      <ol className="grid gap-3">
        {s.aufgaben.map((a, j) => (
          <li key={j} className="rounded-xl border border-line px-3 py-3">
            <p className="num mb-1.5 text-[12px] font-semibold text-ink-3">Aufgabe {j + 1}</p>
            {a.data.pruefen?.map((h, k) => (
              <p key={k} className="mb-1 text-[12.5px] text-amber">
                Bitte prüfen: {h}
              </p>
            ))}
            <TaskBody task={a} showSolution skillName={a.skillId ? skillName(a.skillId) : undefined} subject={fach} />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <AufgabeBewertung key={bewertungen[j].schluessel} ziel={{ art: "schritt", id: s.id, index: j }} info={bewertungen[j]} className="-ml-3" />
            </div>
          </li>
        ))}
      </ol>
    </Reveal>
  );
}

/**
 * Was zum Schritt auf dem Schirm seltener gebraucht wird, unter „Weitere Werkzeuge“: Überspringen, wieder öffnen,
 * früher oder später, Aufgaben mit Lösung, die eigene Notiz.
 */
function SchrittWerkzeuge({ c, id, titel, unitId, ids, children }: { c: CockpitDaten; id: number; titel: string; unitId: number; ids: number[]; children?: React.ReactNode }) {
  const st = offenVon(c, id);
  const i = ids.indexOf(id);
  return (
    <section aria-label="Zu diesem Schritt" className="grid gap-3" data-testid="schritt-mehr">
      <h3 className="text-[16px] font-semibold">
        Schritt {i + 1}: {titel}
      </h3>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {st === "offen" ? (
            <form action={markiereSchrittAction.bind(null, unitId, id, "uebersprungen")}>
              <button className="btn btn-secondary" data-testid="ueberspringen">
                <SkipForward size={16} aria-hidden /> Überspringen
              </button>
            </form>
          ) : (
            <form action={markiereSchrittAction.bind(null, unitId, id, "offen")}>
              <button className="btn btn-secondary">
                <Undo2 size={16} aria-hidden /> Wieder öffnen
              </button>
            </form>
          )}
          <span className="flex items-center gap-1 sm:ml-auto">
            <span className="mr-1 text-[13px] text-ink-3">Für heute verschieben</span>
            <form action={verschiebeSchrittAction.bind(null, unitId, id, -1)}>
              <button className="btn btn-ghost btn-sm min-h-[44px] min-w-[44px] !px-2" disabled={i <= 0} aria-label="Einen Schritt früher" title="Früher">
                <ArrowUp size={16} aria-hidden />
              </button>
            </form>
            <form action={verschiebeSchrittAction.bind(null, unitId, id, 1)}>
              <button className="btn btn-ghost btn-sm min-h-[44px] min-w-[44px] !px-2" disabled={i === ids.length - 1} aria-label="Einen Schritt später" title="Später">
                <ArrowDown size={16} aria-hidden />
              </button>
            </form>
          </span>
        </div>
        {children}
        <SchrittNotiz key={id} speichern={notizAction.bind(null, unitId, id)} initial={c.stand.notizen[id] ?? ""} />
      </div>
    </section>
  );
}

/**
 * Ohne Lernpaket: ein Schritt des „Plans für heute“. „Passende Übungen senden“ mit einer freigegebenen Übung aus dem Bestand, sonst
 * mit neuen Aufgaben aus den Generatoren zur Fähigkeit des Schritts (ohne KI).
 */
function PlanKarte({
  c,
  s,
  unit,
  student,
  vorschlag,
  laeufe,
  ausfuehrlichOffen,
  folienOffen,
}: {
  c: CockpitDaten;
  s: PlanStep;
  unit: UnitView;
  student: repo.Student;
  vorschlag: Anzeige | null;
  laeufe: TextLauf[];
  ausfuehrlichOffen: boolean;
  folienOffen: boolean;
}) {
  const ids = c.plan.map((x) => x.id);
  const name = first(student.name);
  const nicht = (c.stand.nichtVerstanden[s.id] ?? 0) > 0;
  const hilfe = nicht ? hilfeBeiFehler("", [], zurFaehigkeit(s.skillId)) : [];
  // eine Übung aus dem Bestand („U12“), wenn es sie freigegeben noch gibt und sie zur Fähigkeit passt (nur ihre Aufgaben,
  // nie das Blatt eines anderen Schülers; lib/material-passt.ts); „Z5“ ist schon zugewiesen
  const bestand = bestandsUebung(s, student.id);
  const blatt = bestand?.blatt ?? null;
  const zugewiesen = s.uebung && /^Z\d+$/.test(s.uebung) ? Number(s.uebung.slice(1)) : null;
  // Erklären sends nothing (the exercise is the next step); Einstieg and Abschluss neither; the generators build no
  // Lernkontrolle of a Schreibauftrag (the practice step starts the writing task)
  const kontrolle = s.art === "kontrolle";
  const skill = s.skillId && planHatUebung(s, c.planQuellen) && !(kontrolle && sorteOfSkill(s.skillId)) ? repo.getSkill(s.skillId) : null;
  const gesendet = c.stand.gesendet[s.id]?.length ?? 0;
  // a writing skill (lib/textarbeit-ablauf.ts): „Schreibauftrag starten“, prefilled, is the main action of the practice
  // step and of its Lernkontrolle (which sends nothing; once the text runs, its line above is the way on); in the exam
  // step it is the exam's writing task, next to „Passende Übungen senden“
  const schreibKontrolle = kontrolle && Boolean(s.skillId && sorteOfSkill(s.skillId));
  const eigen = !s.art || s.art === "ueben" || schreibKontrolle ? schreibStartFuer(unit, s.skillId) : null;
  const zurPruefung = !eigen && (s.titel === SCHULARBEIT_SCHRITT || (s.pruefung && s.art === "ueben")) ? schreibStartZurPruefung(unit) : null;
  const schreiben = eigen ?? zurPruefung;
  const laeuft = schreiben ? textZumSchritt(laeufe, schreiben) : null;
  // a step of the Vorgabe whose point still waits for „kurz bestätigen“: say where, so the exercise can follow
  const bestaetigen = !skill && !blatt && !zugewiesen && (Boolean(s.vorlaeufig) || /^Üben: /.test(s.titel)) && (vorgabeDerEinheit(unit.id)?.punkte.some((p) => p.zuordnung === "unklar" && p.vorschlaege.length > 0) ?? false);
  // say, show, ask, expected answer from the skill and the step's tasks, like a package step (lib/cockpit.ts planFuehrung);
  // not in the Lernkontrolle: its tasks are not asked aloud first
  const schon = c.stand.gesendet[s.id] ?? [];
  // the worked example is none of the tasks the topic's practice, Grundlage and Lernkontrolle send
  const andere = kontrolle || !s.skillId ? [] : c.plan.filter((x) => x.id !== s.id && x.skillId === s.skillId && (x.art === "ueben" || x.art === "grundlage" || x.art === "kontrolle" || !x.art));
  const ausser = andere.flatMap((x) => aufgabenImSchritt(unit.id, x, c.stand.gesendet[x.id] ?? []));
  const f = kontrolle ? { sagt: null, zeigt: null, fragt: null, antwort: null } : planFuehrung(unit.id, s, schon, ausser);
  // „Lösung · typische Fehler · Hintergrund“: the tasks sent from this step or the ones it would send
  const skillId = s.skillId ?? blatt?.skill_ids[0] ?? null;
  const aufgaben = aufgabenImSchritt(unit.id, { ...s, skillId }, schon);
  // „Ausführlicher erklären“ (lib/ausfuehrlich.ts): to a skill whose text is thin; saved once per skill and Schulstufe
  const ausSkill = !kontrolle && s.art !== "einstieg" && s.art !== "abschluss" && s.skillId ? repo.getSkill(s.skillId) : null;
  const stufe = schulstufeVon(student);
  const ausGespeichert = ausSkill ? gespeicherteErklaerung(ausSkill.id, stufe) : null;
  const ausTor = ausSkill && !ausGespeichert && istDuenn(f.sagt) ? ausfuehrlichTor() : null;
  // with the KI off the button stays away; otherwise it says why it is not possible now
  const ausKnopf = ausTor && (ausTor.erlaubt || ausTor.grund !== "Die KI ist aus.") ? ausTor : null;
  // Erklären, Grundlage, Lernkontrolle: „Richtig / Teilweise / Falsch“, what the teacher heard
  const frage = s.art === "erklaeren" || s.art === "grundlage" || kontrolle;
  const antwort = frage ? <AntwortKnoepfe unitId={unit.id} schrittId={s.id} wert={c.stand.antworten[s.id] ?? null} /> : null;
  const mitUebung = new Set(c.plan.filter((x) => planHatUebung(x, c.planQuellen)).map((x) => x.id));
  const sprungId = ersteUebung(ids, c.stand, s.id, (id) => mitUebung.has(id), uebungGesendet(unit.id));
  const sprung = sprungId === null ? null : (c.plan.find((x) => x.id === sprungId) ?? null);
  // the Lernkontrolle: three new tasks, one try, no hints (lib/cockpit.ts sendeAusGenerator); the student's own word
  // lists make another count
  const kontrolleLabel = skill?.id === EIGENE_VOKABELN ? "Lernkontrolle senden" : `Lernkontrolle senden (${KONTROLLE_ANZAHL} Aufgaben)`;
  return (
    <section className="panel px-4 py-4 sm:px-6 sm:py-5" aria-label="Aktueller Schritt" data-testid="cockpit-schritt">
      <KartenKopf c={c} id={s.id} titel={s.titel} minuten={c.minuten.get(s.id) ?? s.minuten} ids={ids} thema={s.thema} />
      {(s.beschreibung.trim() || f.sagt || f.zeigt || f.fragt || ausGespeichert || ausKnopf) && (
        <div className="mt-4 grid gap-4">
          {s.beschreibung.trim() && (
            <Block titel="Das machst du">
              <p className={`${f.sagt || f.fragt ? "text-[16px]" : "text-[18px]"} leading-relaxed whitespace-pre-line`}>{s.beschreibung}</p>
            </Block>
          )}
          {(ausGespeichert?.sagt || f.sagt) && (
            <Block titel="Das sagst du">
              <LangText text={ausGespeichert?.sagt || f.sagt!} offen={ausfuehrlichOffen} />
              {ausGespeichert?.sagt && <p className="mt-1 text-[12.5px] text-ink-3">Ausführlich erklärt, von der KI geschrieben. Gespeichert für diese Fähigkeit und die {stufe}. Schulstufe.</p>}
            </Block>
          )}
          {ausGespeichert && ausSkill ? (
            <AusfuehrlichBlock a={ausGespeichert} offen={ausfuehrlichOffen} mathe={ausSkill.subject === "Mathematik"} />
          ) : (
            ausKnopf && (
              <div className="grid gap-1" data-testid="ausfuehrlich-knopf">
                <VorschlagKnopf
                  action={ausfuehrlichAction.bind(null, unit.id, s.id)}
                  label={ausKnopf.erlaubt ? `Ausführlicher erklären · ${ausKnopf.kosten}` : "Ausführlicher erklären"}
                  icon={<BookOpenText size={16} aria-hidden />}
                  gesperrt={!ausKnopf.erlaubt}
                  laeuft="Wird geschrieben …"
                />
                <p className="text-[13px] text-ink-3">{ausKnopf.erlaubt ? "Einmal für diese Fähigkeit und Schulstufe; danach für jeden Schüler ohne Kosten." : ausKnopf.grund}</p>
              </div>
            )
          )}
          {f.zeigt && (
            <Block titel="Das zeigst du">
              <p className="text-[13px] text-ink-3">Ein Beispiel zum Vorrechnen, nicht aus der Übung</p>
              <p className="mt-0.5 text-[17px] leading-relaxed whitespace-pre-line">{f.zeigt.aufgabe}</p>
              <p className="mt-1 text-[16px] leading-relaxed whitespace-pre-line">
                <span className="font-semibold text-green">Lösung: </span>
                {f.zeigt.loesung}
              </p>
            </Block>
          )}
          {/* Erklären und Grundlage: eine passende Präsentation oder „Präsentation erstellen“ (lib/praesentation-unterricht.ts) */}
          <PraesentationSchritt c={c} unitId={unit.id} schrittId={s.id} folienOffen={folienOffen} titel={f.zeigt ? "Mit Präsentation zeigen" : "Das zeigst du"} />
          {f.fragt && (
            <Block titel="Das fragst du">
              <p className="text-[18px] leading-relaxed whitespace-pre-line">{f.fragt}</p>
              {!f.antwort && antwort}
            </Block>
          )}
          {f.fragt && f.antwort && (
            <Block titel="Erwartete Antwort" ton="green">
              <p className="text-[16px] whitespace-pre-line">{f.antwort}</p>
              {antwort}
            </Block>
          )}
        </div>
      )}
      {antwort && !f.fragt && (
        <div className="mt-4">
          <p className="text-[13px] font-semibold text-ink-2">{kontrolle ? "Wie war die Lernkontrolle?" : "Wie war es?"}</p>
          {antwort}
        </div>
      )}
      {bestaetigen && (
        <p className="mt-3 text-[14.5px] text-ink-2" data-testid="vorgabe-erst-bestaetigen">
          Welche Fähigkeit gemeint ist, bestätigst du oben unter „Vorgabe für heute“. Danach gibt es dazu eine Übung.
        </p>
      )}
      {vorschlag && <VorschlagKarte a={vorschlag} unitId={unit.id} schrittId={s.id} imSchritt />}
      {nicht && <HilfeBlock hilfe={hilfe} unitId={unit.id} werkzeuge={`/einheiten/${unit.id}?bereich=cockpit#werkzeuge`} />}
      {eigen && <SchreibauftragStart start={eigen} laeuft={laeuft} />}
      {(blatt || zugewiesen || skill) && (
        <div className="mt-5 grid gap-2 border-t border-line pt-4" data-testid="plan-senden">
          {blatt ? (
            <>
              <p className="text-[14px] text-ink-2" data-testid="plan-bestand">
                Übung <span className="font-semibold text-ink">„{blatt.title}“</span> aus dem Bestand
                {bestand?.gekuerzt && s.skillId ? `, nur die ${bestand.aufgaben.length} Aufgaben zu ${repo.getSkill(s.skillId)?.name ?? "diesem Thema"}` : ""}
              </p>
              <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                <CockpitSenden action={sendeBestandAction.bind(null, unit.id, s.id)} unitId={unit.id} label="Passende Übungen senden" primary={gesendet === 0 && !eigen} />
                {gesendet > 0 && <span className="pt-2.5 text-[13px] text-ink-3">schon {gesendet === 1 ? "einmal" : `${gesendet}-mal`} an {name} gesendet</span>}
              </div>
            </>
          ) : zugewiesen ? (
            <Link href={`/schueler/${student.id}/ergebnis/${zugewiesen}`} className="btn btn-secondary w-fit">
              Offene Übung ansehen
            </Link>
          ) : (
            skill && (
              <>
                <p className="text-[14px] text-ink-2">
                  {kontrolle ? `Neue Aufgaben zu ${skill.name}: ein Versuch, ohne Hilfen.` : `Neue Aufgaben zu ${skill.name}, passend zum Lernstand von ${name}.`}
                </p>
                <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                  <CockpitSenden action={sendeGeneratorAction.bind(null, unit.id, skill.id, s.id)} unitId={unit.id} label={kontrolle ? kontrolleLabel : "Passende Übungen senden"} primary={gesendet === 0 && !eigen} />
                  {gesendet > 0 && <span className="pt-2.5 text-[13px] text-ink-3">schon {gesendet === 1 ? "einmal" : `${gesendet}-mal`} an {name} gesendet</span>}
                </div>
              </>
            )
          )}
        </div>
      )}
      {zurPruefung && <SchreibauftragStart start={zurPruefung} laeuft={laeuft} haupt={false} />}
      {sprung && <ZurErstenUebung unitId={unit.id} id={sprung.id} titel={sprung.titel} nr={ids.indexOf(sprung.id) + 1} />}
      <LoesungReveal aufgaben={aufgaben} fehler={skillId ? zurFaehigkeit(skillId).typischeFehler : []} hintergrund={hintergrundZu(skillId, [aufgaben.find((a) => a.teacherNote?.trim())?.teacherNote])} />
      <Knoepfe unitId={unit.id} id={s.id} weiterHaupt={eigen ? Boolean(laeuft) : !(blatt || skill) || gesendet > 0} />
    </section>
  );
}

/**
 * „Zur ersten Übung“: ein ruhiger Sprung zum ersten offenen Schritt mit Übung (lib/cockpit.ts `ersteUebung`). Zeigt ihn
 * nur; die Schritte davor bleiben offen und kommen danach wieder.
 */
function ZurErstenUebung({ unitId, id, titel, nr }: { unitId: number; id: number; titel: string; nr: number }) {
  return (
    <form action={zeigeSchrittAction.bind(null, unitId, id)} className="mt-4">
      <button className="inline-flex min-h-[44px] flex-wrap items-center gap-x-1.5 text-left text-[14.5px] font-semibold text-accent hover:underline" data-testid="zur-ersten-uebung">
        Zur ersten Übung <span className="font-normal text-ink-2">· Schritt {nr}: {titel}</span> <ArrowRight size={15} aria-hidden />
      </button>
    </form>
  );
}

/** Alle Schritte erledigt oder übersprungen: jetzt die Einheit beenden. */
function AllesDurch({ c, unitId, naechstesMal }: { c: CockpitDaten; unitId: number; naechstesMal: string[] }) {
  const liste: { id: number; titel: string }[] = c.paket ? c.schritte : c.plan;
  const e = ergebnis(liste, liste.map((s) => s.id), c.stand);
  return (
    <section className="panel px-5 py-5" aria-label="Alles durch" data-testid="alles-durch">
      <p className="inline-flex items-center gap-2 text-[19px] font-semibold text-green">
        <CheckCircle2 size={21} aria-hidden /> Alles durch
      </p>
      <p className="mt-2 text-[15px]">
        {e.erledigt.length} erledigt
        {e.uebersprungen.length > 0 && `, ${e.uebersprungen.length} übersprungen (${e.uebersprungen.map((s) => s.titel).join(", ")})`}
        {e.nichtVerstanden.length > 0 && `. Nicht verstanden: ${e.nichtVerstanden.map((s) => s.titel).join(", ")}`}.
      </p>
      {naechstesMal.length > 0 && (
        <p className="mt-1 text-[15px]" data-testid="naechstes-mal">
          <span className="font-semibold">Nächstes Mal:</span> {naechstesMal.join(", ")}. Heute hat die Zeit nicht mehr gereicht.
        </p>
      )}
      <p className="mt-1 text-[14px] text-ink-2">Das kommt beim Beenden in die Dokumentation. Einen Punkt oben antippen, um einen Schritt wieder zu öffnen.</p>
      <form action={endUnitAction.bind(null, unitId)} className="mt-4">
        <button className="btn btn-primary btn-lg w-full sm:w-auto">
          <Square size={18} aria-hidden /> Einheit beenden
        </button>
      </form>
    </section>
  );
}

/** Eine Kachel unter „Weitere Werkzeuge“. */
function Kachel({ href, icon, label, testid }: { href: string; icon: React.ReactNode; label: string; testid?: string }) {
  return (
    <Link href={href} className="flex min-h-[52px] items-center gap-2 rounded-xl border border-line bg-surface px-3 text-[15px] font-medium hover:bg-panel" data-testid={testid}>
      {icon}
      {label}
    </Link>
  );
}

/**
 * „Weitere Werkzeuge“ (`?bereich=cockpit`): alles, was früher im Cockpit und in den Bereichen Übungen und Fortschritt
 * neben dem Schritt stand. Nichts davon ist weg (niko, 25.10.2026: „Kein Feature wird entfernt“). Erst auf Tippen
 * gerechnet und gezeigt, damit der Unterricht schlank bleibt.
 */
function Werkzeuge({ c, unit, student, liste, teacherId, ids, aktuell }: { c: CockpitDaten; unit: UnitView; student: repo.Student; liste: Anpassung[]; teacherId: number | null; ids: number[]; aktuell: number | null }) {
  const name = first(student.name);
  const basis = `/einheiten/${unit.id}`;
  const wahl = paketWahl(student.id, { fach: unit.subject, ausser: unit.id });
  const vorschlag = c.paket ? wahl.vorschlaege.find((v) => v.paket.id === c.paket!.id) : undefined;
  // „Stunden automatisch vorbereiten“ (lib/vorbereitung-auto.ts): fehlt ein geprüftes Paket, „Mit KI entwerfen“ ausgefüllt, nur auf Klick
  const auto = c.paket ? null : autoFuerEinheit(unit);
  const fehlt: Signal | null = c.stand.automatisch?.luecke ?? (auto?.art === "kein_paket" ? auto.signal : null);
  const ki = fehlt ? kiVorgabe(fehlt, student, { fach: unit.subject, dauer: platzFuerEinheit(unit)?.geplante_dauer ?? 50, gibtSkill: (id) => Boolean(repo.getSkill(id)) }) : null;
  const kosten = ki ? kostenSchaetzung().text : "";
  // Minitest zum Start (lib/minitest.ts), wie im Bereich Übungen: solange noch nichts beantwortet ist
  const geraet = studentDevice(unit);
  const minitest = minitestDerEinheit(unit.id);
  const stoff = !minitest && repo.listAttemptsForUnit(unit.id).length === 0 && repo.pendingReviews({ unitId: unit.id }).length === 0 ? letzterStoff(student.id, unit.id) : null;
  const gedruckt = minitest && !minitest.assignment ? { worksheet: minitest.worksheet, tasks: repo.listTasks(minitest.worksheet.id).length } : null;
  const oberstufe = levelFor(student.school_type, student.klasse).band === "oberstufe";
  const icon = (I: typeof Camera) => <I size={18} className="shrink-0 text-accent" aria-hidden />;
  const schritt = c.paket ? c.aktuell : null;
  const planSchritt = c.paket ? null : c.planAktuell;
  const quelle: PlanQuelle | null = planSchritt ? (c.planQuellen.get(planSchritt.id) ?? null) : null;
  return (
    <section id="werkzeuge" className="panel scroll-mt-4 px-4 sm:px-5" aria-label="Weitere Werkzeuge" data-testid="werkzeuge">
      <div className="flex min-h-[52px] items-center gap-2">
        <Wrench size={18} className="text-ink-2" aria-hidden />
        <h2 className="text-[16px] font-semibold">Weitere Werkzeuge</h2>
        {ids.length > 0 && (
          <Link href={basis} className="ml-auto inline-flex min-h-[44px] items-center text-[14px] font-medium text-ink-2 hover:text-ink">
            Schließen
          </Link>
        )}
      </div>
      <div className="grid gap-6 pt-2 pb-5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Kachel href={`${basis}?bereich=uebungen`} icon={icon(BookOpenCheck)} label="Übungen und Ergebnisse" testid="werkzeug-uebungen" />
          <Kachel href={`/tafel/${unit.id}`} icon={icon(Presentation)} label="Whiteboard" />
          <Kachel href={`${basis}?bereich=fortschritt`} icon={icon(ChartNoAxesColumn)} label="Fortschritt" />
          <Kachel href={`/uebungen/neu?schueler=${student.id}`} icon={icon(Plus)} label="Neue Übung erstellen" />
          <Kachel href={`${basis}/foto`} icon={icon(Camera)} label="Foto vom Stoff" testid="foto-vom-stoff" />
          <Kachel href={`${basis}/text`} icon={icon(PenLine)} label="Textarbeit starten" />
          <Kachel href={`${basis}/bildgeschichte`} icon={icon(Images)} label="Bildgeschichte erstellen" testid="bildgeschichte-erstellen" />
          {/* Oberstufe: a Schreibauftrag of the SRDP on a whole Textbeilage with line numbers */}
          {oberstufe && <Kachel href={`${basis}/schreibauftrag`} icon={icon(BookOpenText)} label="Schreibauftrag" testid="schreibauftrag-erstellen" />}
        </div>

        {schritt && aktuell === schritt.id && (
          <SchrittWerkzeuge c={c} id={schritt.id} titel={schritt.titel} unitId={unit.id} ids={ids}>
            {schritt.aufgaben.length > 0 && <AufgabenMitLoesung s={schritt} fach={c.paket!.fach} teacherId={teacherId} />}
          </SchrittWerkzeuge>
        )}
        {planSchritt && (
          <SchrittWerkzeuge c={c} id={planSchritt.id} titel={planSchritt.titel} unitId={unit.id} ids={ids}>
            {/* a step of an embedded package: its tasks with solutions, like in the package */}
            {quelle && quelle.schritt.aufgaben.length > 0 && <AufgabenMitLoesung s={quelle.schritt} fach={quelle.paket.fach} teacherId={teacherId} />}
          </SchrittWerkzeuge>
        )}

        {(stoff || gedruckt) && <MinitestKarte unitId={unit.id} name={name} geraet={geraet} stoff={stoff} gedruckt={gedruckt} />}

        {c.paket ? (
          <>
            <PaketKopf c={c} paket={c.paket} warum={vorschlag?.warum ?? null} entfernen={c.stand.automatisch ? waehlePaketAction.bind(null, unit.id) : null}>
              {c.stand.automatisch?.luecke && ki && <KeinPaket klein thema={c.stand.automatisch.luecke.thema} ki={ki} kosten={kosten} />}
              <Reveal label={c.stand.automatisch ? "Anderes Paket" : "Anderes Lernpaket oder ohne"}>
                <div className="pt-2">
                  <PaketAuswahl wahl={wahl} action={waehlePaketAction.bind(null, unit.id)} gewaehlt={c.paket.id} ohne />
                </div>
              </Reveal>
            </PaketKopf>
            <AnpassenBereich c={c} unitId={unit.id} studentId={student.id} name={name} liste={liste} />
          </>
        ) : (
          <section aria-label="Lernpaket wählen" className="grid gap-3">
            <h3 className="text-[16px] font-semibold">Lernpaket wählen</h3>
            {auto?.art === "kein_paket" && (
              <div className="panel grid gap-1.5 px-5 py-4">
                <KeinPaket thema={auto.thema} ki={ki} kosten={kosten} entwuerfe={auto.entwuerfe} />
                <p className="text-[13px] text-ink-3">Warum dieses Thema: {auto.signal.warum}. Die KI läuft erst, wenn du im Formular „Entwurf erstellen“ tippst.</p>
              </div>
            )}
            <PaketAuswahl wahl={wahl} action={waehlePaketAction.bind(null, unit.id)} gewaehlt={null} />
            <Reveal label="Ohne Lernpaket: Fähigkeit, Übungen und Briefing">
              <div className="pt-3">
                <OhnePaketAnsicht unit={unit} student={student} skillId={c.stand.skill_id} />
              </div>
            </Reveal>
          </section>
        )}

        <Reveal label={`Ohne Tablet: Link für das Gerät von ${name}`}>
          <p className="mb-2 text-[14px] text-ink-2">Nur nötig, wenn {name} nicht am Schüler-Tablet arbeitet. Auf dem Link sieht {name} die gesendeten Übungen. Ein Tablet verbindest du oben in der Gerätezeile.</p>
          <div className="flex max-w-[620px] flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <CopyLink path={`/lernen/${student.access_token}`} />
            </div>
            <a href={`/lernen/${student.access_token}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
              <ExternalLink size={14} aria-hidden /> Ansicht öffnen
            </a>
          </div>
        </Reveal>

        <div className="border-t border-line pt-3">
          <CancelUnit unitId={unit.id} />
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  BookOpenCheck,
  BookOpenText,
  Camera,
  ChartNoAxesColumn,
  Check,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  Images,
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
  entscheideAnpassungAction,
  markiereSchrittAction,
  merkeSchrittAction,
  notizAction,
  sendeGeneratorAction,
  sendeSchrittAction,
  verschiebeSchrittAction,
  waehlePaketAction,
  zeigeSchrittAction,
} from "@/app/cockpit-actions";
import { endUnitAction } from "@/app/session-actions";
import { AufgabeBewertung } from "@/components/AufgabeBewertung";
import { AnpassenBereich, AnpassungInhalt, KiGrenzeHinweis, OhnePaketAnsicht, PaketAuswahl, PaketKopf } from "@/components/cockpit/Cockpit";
import { CockpitSenden, SchrittNotiz } from "@/components/cockpit/CockpitClient";
import { KeinPaket } from "@/components/cockpit/Vorbereitung";
import { CopyLink } from "@/components/CopyLink";
import { TabletSend } from "@/components/device/TabletSend";
import { MinitestKarte } from "@/components/MinitestKarte";
import { SchuelerWorteKarte } from "@/components/SchuelerNotiz";
import { TaskBody } from "@/components/TaskPreview";
import { CancelUnit } from "@/components/UnitControl";
import { Pill, Reveal } from "@/components/ui";
import { anpassungen, type Anpassung } from "@/lib/anpassen";
import { bewertungInfos } from "@/lib/bewertungen";
import { cockpit, ergebnis, hilfeBeiFehler, type CockpitDaten, type Hilfe, type PlanStep } from "@/lib/cockpit";
import { paketWahl, zurFaehigkeit } from "@/lib/cockpit-vorschlag";
import { kostenSchaetzung } from "@/lib/lernpaket-ki";
import { SCHRITT_ARTEN, ungeprueft, type LernpaketMitSchritten, type LernpaketSchritt } from "@/lib/lernpakete";
import { studentDevice } from "@/lib/live";
import { letzterStoff, minitestDerEinheit } from "@/lib/minitest";
import * as repo from "@/lib/repo";
import { schuelerWorte } from "@/lib/schueler-notiz";
import { levelFor } from "@/lib/text-correction-rules";
import { platzFuerEinheit, type UnitView } from "@/lib/units";
import { autoFuerEinheit, kiVorgabe, type Signal } from "@/lib/vorbereitung-auto";

const first = (n: string) => n.split(" ")[0];

/**
 * Der **geführte Unterricht** (niko, 25.10.2026: „Unterricht zeigt nur den aktuellen Schritt“): eine Karte mit dem
 * Schritt auf dem Schirm, darin was der Lehrer sagt, zeigt und fragt und was er als Antwort erwartet, „Übung senden“
 * und drei Knöpfe: **Weiter**, **Wiederholen** und **Schüler versteht es nicht**. Darüber die Schritte als Punkte zum
 * Antippen. Alles andere des früheren Cockpits und der Bereiche Übungen und Fortschritt liegt unter „Weitere Werkzeuge“
 * und bleibt dort vollständig.
 *
 * Mit Lernpaket kommen die Schritte aus dem Paket, ohne Paket aus dem „Plan für heute“ des Briefings (lib/cockpit.ts,
 * Ids negativ). „Wiederholen“ und „Schüler versteht es nicht“ zählen je Schritt mit (`einheit_cockpit.wiederholt` und
 * `.nicht_verstanden`); beim Beenden steht das in der Dokumentation (Wiederholen bzw. Schwierigkeiten). Nur für den
 * Lehrer der Einheit; nichts davon kommt auf eine Schülerseite, außer den Aufgaben, die er sendet.
 */
export function Unterricht({ unit, student, fehler, teacherId, werkzeugeOffen = false }: { unit: UnitView; student: repo.Student; fehler?: string; teacherId: number | null; werkzeugeOffen?: boolean }) {
  const c = cockpit(unit.id, { mitPlan: true });
  const name = first(student.name);
  // „Anpassen“: Vorschläge und Übernommenes gelten für das Paket, das gerade gewählt ist
  const liste = c.paket ? anpassungen(unit.id).filter((a) => a.paket_id === c.paket!.id) : [];
  // was der Schüler vor dieser Einheit geschrieben hat: seine Worte, nur zum Lesen (lib/schueler-notiz.ts)
  const worte = schuelerWorte(student.id, unit.id);
  const ids = c.paket ? c.schritte.map((s) => s.id) : c.plan.map((s) => s.id);
  const aktuell = c.paket ? (c.aktuell?.id ?? null) : (c.planAktuell?.id ?? null);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5" data-testid="cockpit">
      {fehler && (
        <p role="alert" className="rounded-2xl bg-red-wash px-4 py-3 text-[15px] text-red">
          {fehler}
        </p>
      )}
      <KiGrenzeHinweis studentId={student.id} name={name} />
      {worte && <SchuelerWorteKarte worte={worte} name={name} />}
      <Woher c={c} unitId={unit.id} />
      {ids.length > 1 && <Punkte c={c} ids={ids} aktuell={aktuell} unitId={unit.id} />}
      {c.paket && c.aktuell ? (
        <SchrittKarte c={c} s={c.aktuell} paket={c.paket} unitId={unit.id} name={name} liste={liste} />
      ) : !c.paket && c.planAktuell ? (
        <PlanKarte c={c} s={c.planAktuell} unit={unit} student={student} />
      ) : ids.length > 0 ? (
        <AllesDurch c={c} unitId={unit.id} />
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
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-ink-2">
      {c.paket ? (
        <>
          <span>
            Lernpaket <span className="font-semibold text-ink">„{c.paket.title}“</span>
          </span>
          {c.stand.automatisch && <Pill tone="accent">Vorschlag der App</Pill>}
          {ungeprueft(c.paket) && (
            <span className="inline-flex items-center gap-1 font-medium text-amber">
              <ShieldAlert size={14} aria-hidden /> Ungeprüft: vor dem Verwenden durchlesen
            </span>
          )}
        </>
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
          return (
            <li key={id}>
              <form action={zeigeSchrittAction.bind(null, unitId, id)}>
                <button
                  aria-current={an ? "step" : undefined}
                  title={`${titel.get(id)} · ${STATUS[st]}`}
                  className={`num inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2 text-[14px] font-semibold transition-colors ${
                    an ? "bg-accent text-on-fill" : st === "erledigt" ? "bg-green-wash text-green" : st === "uebersprungen" ? "bg-panel text-ink-3" : "bg-surface text-ink shadow-[var(--shadow-card)] hover:bg-panel"
                  }`}
                >
                  {st === "erledigt" && !an ? <Check size={15} aria-hidden /> : i + 1}
                  <span className="sr-only">
                    {" "}
                    {titel.get(id)}, {STATUS[st]}
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

/** Kopf der Karte: „Schritt 2 von 6 · Minute 5–15“, Titel, Stand und wie oft wiederholt. */
function KartenKopf({ c, id, titel, minuten, art, ids }: { c: CockpitDaten; id: number; titel: string; minuten: number; art?: React.ReactNode; ids: number[] }) {
  const ab = c.ab.get(id) ?? 0;
  const st = offenVon(c, id);
  const w = c.stand.wiederholt[id] ?? 0;
  const n = c.stand.nichtVerstanden[id] ?? 0;
  return (
    <>
      <p className="num text-[13px] text-ink-3">
        Schritt {ids.indexOf(id) + 1} von {ids.length} · Minute {ab}–{ab + minuten}
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

/** Der Schritt des Lernpakets auf dem Schirm. */
function SchrittKarte({ c, s, paket, unitId, name, liste }: { c: CockpitDaten; s: LernpaketSchritt; paket: LernpaketMitSchritten; unitId: number; name: string; liste: Anpassung[] }) {
  const ids = c.schritte.map((x) => x.id);
  const gesendet = c.stand.gesendet[s.id]?.length ?? 0;
  const angepasst = liste.filter((a) => a.status === "uebernommen" && a.schritt_id === s.id);
  // was der Lehrer übernommen hat und kein „leichter“ ist, steht immer da; das Leichtere erst nach „versteht es nicht“
  const immer = angepasst.filter((a) => a.art === "schwerer");
  const nicht = (c.stand.nichtVerstanden[s.id] ?? 0) > 0;
  const skill = s.aufgaben.find((a) => a.skillId)?.skillId ?? null;
  const hilfe = nicht ? hilfeBeiFehler(s.bei_fehler, angepasst, zurFaehigkeit(skill)) : [];
  const leer = !s.lehrer_sagt.trim() && !s.lehrer_fragt.trim() && !s.erwartete_antwort.trim() && !s.folie;
  return (
    <section className="panel px-4 py-4 sm:px-6 sm:py-5" aria-label="Aktueller Schritt" data-testid="cockpit-schritt">
      <KartenKopf c={c} id={s.id} titel={s.titel} minuten={s.minuten} ids={ids} art={<Pill tone={s.art === "kontrolle" ? "green" : s.art === "zusatz" ? "amber" : "accent"}>{SCHRITT_ARTEN[s.art]}</Pill>} />
      <div className="mt-4 grid gap-4">
        {s.lehrer_sagt.trim() && (
          <Block titel="Das sagst du">
            <p className="text-[18px] leading-relaxed whitespace-pre-line">{s.lehrer_sagt}</p>
          </Block>
        )}
        {s.folie && (
          <Block titel="Das zeigst du">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[16px]">
              <span className="inline-flex items-center gap-1.5">
                <Presentation size={16} className="text-accent" aria-hidden /> Folie {s.folie}
              </span>
              {paket.praesentation_id && (
                <Link href={`/mehr/praesentationen/${paket.praesentation_id}?folie=${s.folie}`} className="inline-flex min-h-[44px] items-center gap-1 font-semibold text-accent hover:underline" data-testid="vortrag-oeffnen">
                  Vortrag öffnen <ExternalLink size={14} aria-hidden />
                </Link>
              )}
            </p>
          </Block>
        )}
        {s.lehrer_fragt.trim() && (
          <Block titel="Das fragst du">
            <p className="text-[18px] leading-relaxed whitespace-pre-line">{s.lehrer_fragt}</p>
          </Block>
        )}
        {s.erwartete_antwort.trim() && (
          <Block titel="Erwartete Antwort" ton="green">
            <p className="text-[16px] whitespace-pre-line">{s.erwartete_antwort}</p>
          </Block>
        )}
        {leer && <p className="text-[14px] text-ink-3">Zu diesem Schritt steht im Paket nichts zum Sagen oder Fragen.</p>}
        {s.notiz.trim() && <p className="text-[14px] whitespace-pre-line text-ink-2">Notiz im Paket: {s.notiz}</p>}
      </div>

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

      {s.aufgaben.length > 0 && (
        <div className="mt-5 flex flex-wrap items-start gap-x-4 gap-y-2 border-t border-line pt-4">
          <CockpitSenden action={sendeSchrittAction.bind(null, unitId, s.id)} unitId={unitId} label={`Übung senden (${s.aufgaben.length} ${s.aufgaben.length === 1 ? "Aufgabe" : "Aufgaben"})`} primary={gesendet === 0} />
          {gesendet > 0 && <span className="pt-2.5 text-[13px] text-ink-3">schon {gesendet === 1 ? "einmal" : `${gesendet}-mal`} an {name} gesendet</span>}
        </div>
      )}

      <Knoepfe unitId={unitId} id={s.id} weiterHaupt={s.aufgaben.length === 0 || gesendet > 0} />
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
 * Ohne Lernpaket: ein Schritt des „Plans für heute“. Übung senden mit einer freigegebenen Übung aus dem Bestand, sonst
 * mit neuen Aufgaben aus den Generatoren zur Fähigkeit des Schritts (ohne KI).
 */
function PlanKarte({ c, s, unit, student }: { c: CockpitDaten; s: PlanStep; unit: UnitView; student: repo.Student }) {
  const ids = c.plan.map((x) => x.id);
  const name = first(student.name);
  const nicht = (c.stand.nichtVerstanden[s.id] ?? 0) > 0;
  const hilfe = nicht ? hilfeBeiFehler("", [], zurFaehigkeit(s.skillId)) : [];
  // eine Übung aus dem Bestand („U12“), wenn es sie freigegeben noch gibt; „Z5“ ist schon zugewiesen
  const ws = s.uebung && /^U\d+$/.test(s.uebung) ? repo.getWorksheet(Number(s.uebung.slice(1))) : null;
  const blatt = ws && ws.status === "freigegeben" && !ws.archived_at && ws.kind !== "bibliothek" ? ws : null;
  const zugewiesen = s.uebung && /^Z\d+$/.test(s.uebung) ? Number(s.uebung.slice(1)) : null;
  const skill = s.skillId ? repo.getSkill(s.skillId) : null;
  const gesendet = c.stand.gesendet[s.id]?.length ?? 0;
  return (
    <section className="panel px-4 py-4 sm:px-6 sm:py-5" aria-label="Aktueller Schritt" data-testid="cockpit-schritt">
      <KartenKopf c={c} id={s.id} titel={s.titel} minuten={s.minuten} ids={ids} />
      {s.beschreibung.trim() && (
        <div className="mt-4">
          <Block titel="Das machst du">
            <p className="text-[18px] leading-relaxed whitespace-pre-line">{s.beschreibung}</p>
          </Block>
        </div>
      )}
      {nicht && <HilfeBlock hilfe={hilfe} unitId={unit.id} werkzeuge={`/einheiten/${unit.id}?bereich=cockpit#werkzeuge`} />}
      {(blatt || zugewiesen || skill) && (
        <div className="mt-5 grid gap-2 border-t border-line pt-4" data-testid="plan-senden">
          {blatt ? (
            <>
              <p className="text-[14px] text-ink-2">
                Übung <span className="font-semibold text-ink">„{blatt.title}“</span> aus dem Bestand
              </p>
              <TabletSend targets={[{ unitId: unit.id, student: name }]} worksheetId={blatt.id} />
            </>
          ) : zugewiesen ? (
            <Link href={`/schueler/${student.id}/ergebnis/${zugewiesen}`} className="btn btn-secondary w-fit">
              Offene Übung ansehen
            </Link>
          ) : (
            skill && (
              <>
                <p className="text-[14px] text-ink-2">Neue Aufgaben zu {skill.name}, passend zum Lernstand von {name}.</p>
                <CockpitSenden action={sendeGeneratorAction.bind(null, unit.id, skill.id)} unitId={unit.id} label="Übung senden" primary={gesendet === 0} />
              </>
            )
          )}
        </div>
      )}
      <Knoepfe unitId={unit.id} id={s.id} weiterHaupt={!(blatt || skill)} />
    </section>
  );
}

/** Alle Schritte erledigt oder übersprungen: jetzt die Einheit beenden. */
function AllesDurch({ c, unitId }: { c: CockpitDaten; unitId: number }) {
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
        {planSchritt && <SchrittWerkzeuge c={c} id={planSchritt.id} titel={planSchritt.titel} unitId={unit.id} ids={ids} />}

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

import Link from "next/link";
import { Check, ChevronDown, ExternalLink, Eye, Presentation, ShieldAlert, X } from "lucide-react";
import { uebernimmPraesImUnterrichtAction, verwirfPraesImUnterrichtAction, zeigePraesImSchrittAction } from "@/app/praesentation-actions";
import { VorschlagKnopf } from "@/components/cockpit/CockpitClient";
import { Fett, FolieVorschau } from "@/components/praesentation/KiVorschlag";
import { PraesentationSchrittKnopf } from "@/components/praesentation/PraesentationSchrittKnopf";
import { UnterlagenListe } from "@/components/cockpit/UnterlagenSchritt";
import { Pill } from "@/components/ui";
import type { CockpitDaten } from "@/lib/cockpit";
import { kiKosten } from "@/lib/lernpaket-ki";
import type { PraesEntwurf } from "@/lib/praesentation-ki";
import { appAdresse } from "@/lib/praesentation-anfrage";
import {
  angebotFuer,
  erstellenTor,
  folienText,
  fragenMitAntwort,
  kostenFuerSchritt,
  offenerSchrittEntwurf,
  schrittDerEinheit,
  wiedergabe,
  type TextFolie,
  type Treffer,
  type ZeigeSchritt,
} from "@/lib/praesentation-unterricht";
import { praesUngeprueft } from "@/lib/praesentationen";
import { unterlagenImSchritt, type Unterlage } from "@/lib/unterlagen-unterricht";

const kurz = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/**
 * „Das zeigst du“ mit Präsentation (lib/praesentation-unterricht.ts), im Schritt des Lernpakets wie des Plans: die passende vorhandene
 * Präsentation zuerst; abspielen nur mit eingerichteter Präsentations-Adresse, sonst die Folien als Text. Passt nichts, bei Erklären
 * und Grundlage „Präsentation erstellen“ (zugeklappt, mit allem, was die App aus dem Schritt schon weiß, und den geschätzten Kosten),
 * danach der Entwurf mit „Übernehmen“ und „Verwerfen“. Darunter, im selben Block, mitgebrachte Unterlagen, die das Thema erklären
 * (lib/unterlagen-unterricht.ts). Nur für den Lehrer der Einheit.
 */
export async function PraesentationSchritt({
  c,
  unitId,
  schrittId,
  folienOffen,
  titel = "Das zeigst du",
  unterlagen = unterlagenImSchritt(unitId, schrittId, c),
}: {
  c: CockpitDaten;
  unitId: number;
  schrittId: number;
  folienOffen: boolean;
  titel?: string;
  /** schon geholt (der Planschritt braucht sie für seinen Block) */
  unterlagen?: Unterlage[];
}) {
  const z = schrittDerEinheit(unitId, schrittId, c);
  if (!z) return null;
  const entwurf = offenerSchrittEntwurf(unitId, schrittId);
  const angebot = entwurf ? null : angebotFuer(z);
  const praes = Boolean(entwurf || angebot || z.erklaert);
  if (!praes && !unterlagen.length) return null;
  const a = await appAdresse();
  // only documents: under „Das zeigst du“, or below a worked example („Mit Präsentation zeigen“ then says too much)
  const kopf = praes || titel === "Das zeigst du" ? titel : "Mitgebrachte Unterlagen";
  return (
    <section id="praesentation-schritt" className="scroll-mt-24" aria-label={praes ? "Präsentation" : "Unterlagen"} data-testid="praesentation-schritt">
      <p className="text-[13px] font-semibold text-ink-2">{kopf}</p>
      {praes && (
        <div className="mt-1">
          {entwurf ? (
            <Entwurf e={entwurf} />
          ) : angebot ? (
            <Angebot t={angebot} z={z} offen={folienOffen} w={wiedergabe(angebot.p, a.host, a.proto)} />
          ) : (
            <Erstellen z={z} />
          )}
        </div>
      )}
      {unterlagen.length > 0 && (
        <div className={praes ? "mt-3" : "mt-1"}>
          {praes && <p className="mb-1 text-[13px] font-semibold text-ink-2">Mitgebrachte Unterlagen</p>}
          <UnterlagenListe unitId={unitId} schrittId={schrittId} unterlagen={unterlagen} />
        </div>
      )}
    </section>
  );
}

const GRUND: Record<Treffer["grund"], string> = {
  einheit: "In dieser Einheit schon gezeigt",
  erstellt: "Für diesen Schritt erstellt",
  paket: "Aus dem Lernpaket",
  faehigkeit: "Passt zur Fähigkeit",
  thema: "Gleiches Thema und gleiche Schulstufe",
};

/** Die passende Präsentation: Titel, Folie, ob geprüft, und genau ein Weg, sie zu zeigen. */
function Angebot({ t, z, offen, w }: { t: Treffer; z: ZeigeSchritt; offen: boolean; w: ReturnType<typeof wiedergabe> }) {
  const { p, folie } = t;
  const zeigen = zeigePraesImSchrittAction.bind(null, z.unitId, z.schrittId, p.id, folie);
  return (
    <div className="grid gap-2" data-testid="praesentation-angebot">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[16px]">
        <Presentation size={16} className="shrink-0 text-accent" aria-hidden />
        <span>
          Präsentation: <span className="font-semibold">{p.title}</span>
        </span>
        {folie && <span className="num text-ink-2">· Folie {folie}</span>}
        {praesUngeprueft(p) && (
          <Pill tone="amber" title="Von der KI erstellt und noch von niemandem geprüft">
            <ShieldAlert size={12} aria-hidden /> Ungeprüft
          </Pill>
        )}
      </p>
      <p className="text-[13px] text-ink-3">
        {GRUND[t.grund]}
        {t.grund === "faehigkeit" && z.skillName ? ` ${z.skillName}` : ""}
        {p.schulstufe ? ` · ${p.schulstufe}. Schulstufe` : ""}
      </p>
      {w.abspielen ? (
        <VorschlagKnopf action={zeigen} label="Vortrag öffnen" icon={<ExternalLink size={16} aria-hidden />} laeuft="Wird geöffnet …" testid="vortrag-oeffnen" />
      ) : (
        <>
          {!offen && <VorschlagKnopf action={zeigen} label="Folien ansehen" icon={<Eye size={16} aria-hidden />} laeuft="Wird geöffnet …" testid="folien-ansehen" />}
          <p className="text-[13px] text-ink-3" data-testid="keine-wiedergabe">
            {w.einrichtung ? "Abspielen geht erst mit der eigenen Adresse für Präsentationen; sie ist auf diesem Server noch nicht eingerichtet. Bis dahin siehst du die Folien hier als Text." : `${w.grund} Die Folien siehst du hier als Text.`}
          </p>
          {offen && <FolienAlsText folien={folienText(p)} folie={folie} unitId={z.unitId} />}
        </>
      )}
    </div>
  );
}

/** Die Folien als Text: Titel, Punkte, Fragen und Vortragstext. Nichts davon wird ausgeführt (React escapt jeden Text). */
function FolienAlsText({ folien, folie, unitId }: { folien: TextFolie[]; folie: number | null; unitId: number }) {
  return (
    <div className="grid gap-2" data-testid="folien-text">
      {folien.length === 0 ? (
        <p className="text-[14px] text-ink-3">Aus dieser Präsentation lässt sich kein Text lesen.</p>
      ) : (
        <ol className="grid max-h-[70vh] gap-2 overflow-y-auto rounded-xl border border-line p-2">
          {folien.map((f) => (
            <li key={f.nr} className={`rounded-lg px-3 py-2 ${f.nr === folie ? "bg-accent-wash" : "bg-panel"}`} aria-current={f.nr === folie ? "true" : undefined}>
              <p className="text-[15px] leading-snug font-semibold">
                <span className="num mr-1.5 text-[12.5px] font-semibold text-ink-3">Folie {f.nr}</span>
                {f.titel}
              </p>
              {f.punkte.length > 0 && (
                <ul className="mt-1 grid list-disc gap-0.5 pl-5 text-[14.5px]">
                  {f.punkte.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              )}
              {f.fragen.map((x, i) => (
                <p key={i} className="mt-1 text-[14.5px] font-medium text-accent">
                  Frage: {x}
                </p>
              ))}
              {f.notiz && (
                <p className="mt-1.5 text-[14px] whitespace-pre-line text-ink-2">
                  <span className="font-semibold text-ink">Vortragstext: </span>
                  {f.notiz}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
      <Link href={`/einheiten/${unitId}#praesentation-schritt`} className="inline-flex min-h-[44px] w-fit items-center text-[14px] font-medium text-accent hover:underline">
        Folien zuklappen
      </Link>
    </div>
  );
}

/**
 * Nichts passt: „Präsentation erstellen“, zugeklappt, mit den Angaben aus dem Schritt (nichts davon muss neu eingegeben werden).
 * Geht es gerade nicht (KI aus, Budget, Grenze je Schüler), steht nur der kurze Grund da, nichts zum Aufklappen.
 */
function Erstellen({ z }: { z: ZeigeSchritt }) {
  const tor = erstellenTor(z);
  if (!tor.erlaubt)
    return (
      <div className="grid gap-1" data-testid="praesentation-erstellen-aus">
        <p className="text-[14.5px] text-ink-2">Keine passende Präsentation{z.skillName ? ` zu ${z.skillName}` : ""}.</p>
        <p className="text-[13px] text-ink-3">Präsentation erstellen geht gerade nicht: {tor.grund}</p>
      </div>
    );
  const angaben: [string, string][] = [
    ["Fach", z.fach],
    ["Schulstufe", z.schulstufe ? `${z.schulstufe}.` : ""],
    ["Thema", z.thema],
    ["Fähigkeit", z.skillName && z.skillName !== z.thema ? z.skillName : ""],
    ["Lernziel", kurz(z.ziel, 220)],
    ["Schritt", `${z.titel} · ${z.minuten} Min.`],
    ["Das sagst du", kurz(z.sagt, 160)],
    ["Das fragst du", kurz(z.fragt, 160)],
  ];
  return (
    <div className="grid gap-1">
      <p className="text-[14.5px] text-ink-2">Keine passende Präsentation{z.skillName ? ` zu ${z.skillName}` : ""}.</p>
      <details className="reveal" data-testid="praesentation-erstellen">
        <summary>
          <ChevronDown size={15} aria-hidden className="reveal-chevron" />
          Präsentation erstellen
        </summary>
        <div className="mt-2 grid gap-3 rounded-xl border border-line px-3 py-3">
          <dl className="grid gap-x-3 gap-y-1 text-[14px] sm:grid-cols-[auto_minmax(0,1fr)]">
            {angaben
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="mb-1 min-w-0 sm:mb-0">{v}</dd>
                </div>
              ))}
          </dl>
          <p className="text-[13px] text-ink-3">
            Die KI macht daraus Folien mit Beispielen für dieses Alter, Vortragstext, Verständnisfragen und erwarteten Antworten. Du siehst zuerst den Entwurf; verwendet wird er erst, wenn du ihn
            übernimmst.
          </p>
          <PraesentationSchrittKnopf unitId={z.unitId} schrittId={z.schrittId} kosten={kostenFuerSchritt(z)} kiAus={null} />
        </div>
      </details>
    </div>
  );
}

/** Der Entwurf der KI zum Schritt: jede Folie neben ihrem Vortragstext, die Verständnisfragen mit Antwort, Übernehmen oder Verwerfen. */
function Entwurf({ e }: { e: PraesEntwurf }) {
  const kosten = kiKosten(e.call_id);
  const fragen = fragenMitAntwort(e.deck);
  return (
    <div className="grid gap-3" data-testid="praesentation-entwurf">
      <p className="flex items-start gap-2 rounded-xl bg-amber-wash px-3 py-2 text-[14px] text-amber">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
        <span>Entwurf der KI, noch nicht gespeichert und noch nicht verwendet. Die Folien sieht auch der Schüler, den Vortragstext nur du.</span>
      </p>
      <p className="text-[16px] font-semibold">
        <Fett text={e.deck.titel} /> <span className="num text-[13.5px] font-normal text-ink-3">· {e.deck.folien.length} Folien</span>
        {kosten && <span className="num text-[13.5px] font-normal text-ink-3"> · KI-Anfrage {kosten.cent} Cent</span>}
      </p>
      <ol className="grid gap-4">
        {e.deck.folien.map((f, i) => (
          <li key={i} className="grid gap-2 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <FolieVorschau f={f} nr={i + 1} />
            <div className="min-w-0 text-[14px]">
              <p className="num text-[13px] font-semibold text-ink-3">Folie {i + 1} · Vortragstext</p>
              <p className="whitespace-pre-line">{f.notiz || <span className="text-ink-3">keiner</span>}</p>
              {f.pruefen.length > 0 && (
                <ul className="mt-2 grid gap-1 rounded-lg bg-amber-wash px-3 py-2 text-[13px] text-amber">
                  {f.pruefen.map((h, j) => (
                    <li key={j} className="flex items-start gap-1.5">
                      <ShieldAlert size={14} className="mt-0.5 shrink-0" aria-hidden /> Bitte prüfen: {h}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
      {fragen.length > 0 && (
        <div className="rounded-xl border border-line px-3 py-2" data-testid="entwurf-fragen">
          <p className="text-[13px] font-semibold text-ink-2">Verständnisfragen</p>
          <ul className="mt-1 grid gap-1.5 text-[14.5px]">
            {fragen.map((q, i) => (
              <li key={i}>
                <span className="num text-[12.5px] text-ink-3">Folie {q.folie} · </span>
                {q.frage}
                {q.antwort && (
                  <span className="block text-[14px]">
                    <span className="font-semibold text-green">Erwartete Antwort: </span>
                    {q.antwort}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[13px] text-ink-3">„Übernehmen“ speichert sie unter Erweitert › Präsentationen (als „Ungeprüft“) und zeigt sie bei diesem Schritt. Bei der nächsten Einheit zur selben Fähigkeit wird sie angeboten.</p>
      <div className="flex flex-wrap gap-2">
        <form action={uebernimmPraesImUnterrichtAction.bind(null, e.id)}>
          <button className="btn btn-primary" data-testid="entwurf-uebernehmen">
            <Check size={16} aria-hidden /> Übernehmen
          </button>
        </form>
        <form action={verwirfPraesImUnterrichtAction.bind(null, e.id)}>
          <button className="btn btn-secondary">
            <X size={16} aria-hidden /> Verwerfen
          </button>
        </form>
      </div>
    </div>
  );
}

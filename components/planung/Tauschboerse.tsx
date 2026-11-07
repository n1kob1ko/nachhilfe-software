import { ArrowDown, ArrowLeftRight, Repeat } from "lucide-react";
import { Pill } from "@/components/ui";
import { FRIST_STUNDEN, type Anbietbar, type EigenesAngebot, type OffenesAngebot, type PassendesAngebot } from "@/lib/planung/tauschboerse";

/**
 * Tauschbörse in der Schüler-App (lib/planung/tauschboerse.ts). niko, 2026-11-07: so einfach, dass Schüler und Eltern
 * es ohne Erklärung bedienen: pro Termin ein Knopf „Tauschen“, passende Angebote als große Karte mit einem Knopf.
 * Ohne JavaScript: Formulare und ein aufklappbarer Abschnitt. Nur Zeiten, nie Namen.
 */

type Aktion = (formData: FormData) => void | Promise<void>;

/** Oben in der App: „Jemand möchte mit dir tauschen“, je Angebot alter und neuer Termin und ein großer Knopf. */
export function TauschAngebote({ passend, nehmen }: { passend: PassendesAngebot[]; nehmen: (p: PassendesAngebot) => Aktion }) {
  if (passend.length === 0) return null;
  return (
    <section id="tauschangebote" className="panel mt-8 scroll-mt-4 border-accent-bright/60 bg-accent-wash px-5 py-5 md:px-6" aria-label="Tauschangebote" data-testid="tauschangebote">
      <h2 className="flex items-center gap-2 text-[18px] font-semibold">
        <ArrowLeftRight size={19} className="text-accent" aria-hidden /> {passend.length === 1 ? "Jemand möchte mit dir tauschen" : `${passend.length} Tauschangebote für dich`}
      </h2>
      <ul className="mt-3 grid gap-3">
        {passend.map((p) => (
          <li key={`${p.angebotId}-${p.platzId}`} className="rounded-2xl bg-surface px-4 py-4" data-testid="tauschangebot">
            <p className="text-[14px] text-ink-2">Dein Termin jetzt</p>
            <p className="num text-[17px] font-semibold text-ink-2 line-through decoration-1">{p.meins}</p>
            <ArrowDown size={18} className="my-1 text-accent" aria-hidden />
            <p className="text-[14px] text-ink-2">Dein neuer Termin</p>
            <p className="num text-[20px] font-semibold">{p.neu}</p>
            <form action={nehmen(p)} className="mt-3">
              <button className="btn btn-primary btn-lg w-full sm:w-auto">Ja, tauschen</button>
            </form>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[13px] text-ink-2">Passt es nicht? Dann einfach nichts tun.</p>
    </section>
  );
}

/**
 * Unter einem Termin: „Tauschen“ klappt die Zeiten auf, die stattdessen passen würden (alle angehakt), und ein Knopf
 * stellt den Termin in die Tauschbörse. Ist er schon drin: „Wird angeboten“ und „Zurücknehmen“.
 */
export function TerminTauschen({ anbietbar, eigenes, anbieten, zuruecknehmen, inline = false }: { anbietbar?: Anbietbar; eigenes?: EigenesAngebot; anbieten: Aktion; zuruecknehmen: Aktion; /** ohne eigenes Aufklappen, als Teil von „Termin ändern“ (Audit 2026-11-07) */ inline?: boolean }) {
  if (eigenes) {
    return (
      <div className="mt-1 grid gap-1" data-testid="termin-angeboten">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="amber">Zum Tauschen angeboten</Pill>
          <form action={zuruecknehmen}>
            <button className="btn btn-ghost btn-sm">Zurücknehmen</button>
          </form>
        </div>
        {/* Audit 2026-11-07: der Schüler soll sehen, ob überhaupt jemand tauschen könnte, statt still zu warten */}
        <p className="text-[13px] text-ink-2" data-testid="angebot-stand">
          {eigenes.moeglich === 0 ? "Zurzeit gibt es keinen Termin, mit dem getauscht werden kann. Das Angebot bleibt, falls sich etwas ändert." : "Bisher hat niemand getauscht. Sobald es passiert, siehst du es hier."}
        </p>
      </div>
    );
  }
  if (!anbietbar) return null;
  const formular = (
      <form action={anbieten} className="mt-2 grid gap-3 rounded-2xl bg-panel/60 p-4" data-testid="termin-tauschen">
        <fieldset className="grid gap-1">
          <legend className="mb-1 text-[15px] font-semibold">Welche Zeit würde dir stattdessen passen?</legend>
          {anbietbar.kandidaten.map((k) => (
            <label key={k.wert} className="flex min-h-[44px] cursor-pointer items-center gap-3 text-[16px]">
              <input type="checkbox" name="passende" value={k.wert} defaultChecked className="h-5 w-5 accent-[var(--accent)]" />
              <span className="num">{k.label}</span>
            </label>
          ))}
        </fieldset>
        <button className="btn btn-primary justify-self-start">Zum Tauschen anbieten</button>
        <p className="text-[13px] text-ink-2">
          Nur Zeiten, mit denen der Tausch wirklich geht. Möchte jemand mit einer dieser Zeiten tauschen, wird sofort getauscht und du siehst es hier. Bis {FRIST_STUNDEN} Stunden vor dem Termin.
        </p>
      </form>
  );
  if (inline)
    return (
      <div>
        <p className="inline-flex items-center gap-1.5 text-[15px] font-semibold">
          <Repeat size={16} className="text-accent" aria-hidden /> Tauschen
        </p>
        {formular}
      </div>
    );
  return (
    <details className="group mt-1">
      <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-[15px] font-semibold text-accent">
        <Repeat size={17} aria-hidden /> Tauschen
      </summary>
      {formular}
    </details>
  );
}

/** Planung, nur Verwaltung: wer gerade einen Termin in der Tauschbörse hat und ob überhaupt jemand tauschen könnte. */
export function OffeneAngebote({ angebote }: { angebote: OffenesAngebot[] }) {
  if (angebote.length === 0) return null;
  return (
    <div className="panel mt-3 px-4 py-3" data-testid="offene-angebote">
      <p className="flex items-center gap-2 text-[14px] font-semibold">
        <ArrowLeftRight size={16} className="text-accent" aria-hidden /> In der Tauschbörse: {angebote.length === 1 ? "1 Angebot" : `${angebote.length} Angebote`}
      </p>
      <ul className="mt-2 grid gap-2 text-[14px]">
        {angebote.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold">{a.studentName}</span>
            <span className="text-ink-2">bei {a.lehrerName}</span>
            <span className="num">{a.label}</span>
            <span className="text-ink-2">→ {a.passende === null ? "jede andere Zeit" : a.passende.join(", ")}</span>
            {a.moeglich === 0 ? <Pill tone="red">derzeit kein Tauschpartner</Pill> : <Pill tone="amber">wartet</Pill>}
          </li>
        ))}
      </ul>
    </div>
  );
}

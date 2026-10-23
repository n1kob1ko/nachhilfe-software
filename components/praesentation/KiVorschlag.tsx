import { Check, ShieldAlert, X } from "lucide-react";
import { uebernimmPraesVorschlagAction, verwirfPraesVorschlagAction } from "@/app/praesentation-actions";
import { folieJeSchritt, type Block, type Folie } from "@/lib/ai/praesentation";
import type { KiKosten } from "@/lib/lernpaket-ki";
import type { PraesEntwurf } from "@/lib/praesentation-ki";

/** **fett** as <strong>; everything else stays text (React escapes it). */
function Fett({ text }: { text: string }) {
  const teile = text.split(/\*\*([^*\n]+?)\*\*/);
  return (
    <>
      {teile.map((t, i) => (i % 2 ? <strong key={i}>{t}</strong> : t))}
    </>
  );
}

/** Marks a part that appears only on the next click. */
const Klick = () => <span className="mr-1.5 inline-block rounded bg-[#e3eefc] px-1 align-[1px] text-[10px] font-semibold uppercase tracking-wide text-[#1d4f9c]">Klick</span>;

function BlockVorschau({ b }: { b: Block }) {
  switch (b.art) {
    case "liste":
      return (
        <ul className="list-disc space-y-0.5 pl-5">
          {b.punkte.map((p, i) => (
            <li key={i}>
              {b.schritt && <Klick />}
              <Fett text={p} />
            </li>
          ))}
        </ul>
      );
    case "tabelle":
      return (
        <div className="overflow-x-auto">
          {b.schritt && <Klick />}
          <table className="mt-0.5 border-collapse text-[13px]">
            <tbody>
              {b.zeilen.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => {
                    const Zelle = i === 0 ? "th" : "td";
                    return (
                      <Zelle key={j} className={`border border-[#b9c8da] px-2 py-0.5 text-left align-top ${i === 0 ? "bg-[#eaf2fd] font-semibold" : ""}`}>
                        <Fett text={c} />
                      </Zelle>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default: {
      const art = b.art === "beispiel" ? "rounded border-l-4 border-[#1d63c4] bg-[#eaf2fd] px-2.5 py-1" : b.art === "merksatz" ? "rounded border-l-4 border-[#c98a00] bg-[#fff4d6] px-2.5 py-1 font-semibold" : b.art === "frage" ? "font-semibold text-[#1d4f9c]" : "";
      return (
        <p className={art}>
          {b.schritt && <Klick />}
          <Fett text={b.text} />
        </p>
      );
    }
  }
}

/** One slide as the student will see it (white, like the deck), small. */
function FolieVorschau({ f, nr }: { f: Folie; nr: number }) {
  return (
    <div className="grid content-start gap-2 rounded-xl border border-line bg-white px-4 py-3 text-[14px] leading-snug text-[#1b2430] shadow-sm" aria-label={`Folie ${nr}`}>
      <p className="font-display text-[18px] font-semibold leading-tight text-[#10233f]">
        <Fett text={f.titel} />
      </p>
      {f.bloecke.map((b, i) => (
        <BlockVorschau key={i} b={b} />
      ))}
    </div>
  );
}

/**
 * The KI's proposal for a package's presentation (lib/praesentation-ki.ts): every slide as the student sees it next to
 * the Vortragstext, what to check, which slide each step will show, and „Übernehmen“ or „Verwerfen“. Nothing is saved
 * as a presentation before „Übernehmen“.
 */
export function KiVorschlag({ e, schritte, kosten, ersetzt }: { e: PraesEntwurf; schritte: { id: number; titel: string; folie: number | null }[]; kosten: KiKosten | null; ersetzt: boolean }) {
  const neu = folieJeSchritt(e.deck);
  const nr = new Map(schritte.map((s, i) => [s.id, i + 1]));
  const pruefen = e.deck.folien.flatMap((f, i) => f.pruefen.map((p) => `Folie ${i + 1}: ${p}`));
  return (
    <section id="praesentation-vorschlag" className="mb-8 max-w-[1000px] scroll-mt-24" aria-label="Vorschlag für die Präsentation">
      <div className="rounded-[18px] bg-amber-wash px-5 py-4">
        <p className="flex items-start gap-2 text-[14px] text-amber">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Vorschlag der KI für die Präsentation, noch nicht gespeichert. Sieh jede Folie und den Vortragstext durch; die Folien sieht auch der Schüler, den Vortragstext nur du. Unten übernehmen oder
            verwerfen.
          </span>
        </p>
        {pruefen.length > 0 && (
          <div className="mt-3">
            <p className="text-[13px] font-semibold">Noch zu prüfen:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[14px]">
              {pruefen.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <h2 className="mt-5 font-display text-[19px] font-semibold">
        <Fett text={e.deck.titel} /> <span className="num text-[14px] font-normal text-ink-3">· {e.deck.folien.length} Folien</span>
      </h2>
      <p className="mt-1 text-[13px] text-ink-3">
        <Klick />
        erscheint erst beim Weiterklicken.
        {kosten && (
          <>
            {" "}
            KI-Anfrage: <span className="num">{kosten.cent} Cent</span> (<span className="num">{kosten.tokensEin.toLocaleString("de-AT")}</span> Tokens ein,{" "}
            <span className="num">{kosten.tokensAus.toLocaleString("de-AT")}</span> aus).
          </>
        )}
      </p>

      <ol className="mt-4 grid gap-5">
        {e.deck.folien.map((f, i) => (
          <li key={i} className="grid gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <FolieVorschau f={f} nr={i + 1} />
            <div className="min-w-0 text-[14px]">
              <p className="text-[13px] text-ink-3">
                <span className="num font-semibold">Folie {i + 1}</span>
                {f.schritt_ids.length > 0 && ` · zu Schritt ${f.schritt_ids.map((id) => nr.get(id)).filter(Boolean).join(", ")}`}
              </p>
              <p className="mt-1.5 text-[13px] font-semibold">Vortragstext</p>
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

      <div className="panel mt-6 px-5 py-4">
        <p className="text-[14px] font-semibold">Nach dem Übernehmen zeigen die Schritte</p>
        <ul className="mt-2 grid gap-1 text-[14px]">
          {schritte.map((s, i) => {
            const folie = neu.get(s.id) ?? null;
            return (
              <li key={s.id} className="flex flex-wrap gap-x-2">
                <span className="num text-ink-3">{i + 1}.</span>
                <span className="min-w-0 flex-1">{s.titel}</span>
                <span className="num text-ink-2">
                  {s.folie !== folie && <span className="text-ink-3">{s.folie ? `Folie ${s.folie}` : "keine Folie"} → </span>}
                  {folie ? `Folie ${folie}` : "keine Folie"}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[13px] text-ink-3">
          „Übernehmen“ speichert die Präsentation unter Mehr › Präsentationen (als „Ungeprüft“), verknüpft sie mit diesem Paket{ersetzt ? " statt der jetzigen" : ""} und setzt diese Foliennummern. Sie gilt dann für
          jeden Schüler, der das Paket bekommt.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <form action={uebernimmPraesVorschlagAction.bind(null, e.id)}>
            <button className="btn btn-primary">
              <Check size={16} aria-hidden /> Übernehmen
            </button>
          </form>
          <form action={verwirfPraesVorschlagAction.bind(null, e.id)}>
            <button className="btn btn-secondary">
              <X size={16} aria-hidden /> Verwerfen
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

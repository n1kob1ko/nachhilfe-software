import { BrandMark } from "@/components/Brand";
import { NotenverlaufKarte } from "@/components/Notenverlauf";
import type { Monatsbericht } from "@/lib/monatsbericht";
import { NOTEN_WORT } from "@/lib/notenverlauf";

/**
 * Der Monatsbericht für Eltern (lib/monatsbericht.ts) als eine Seite, die sich auch drucken lässt (A4, hell). Für die
 * Lehrer-Seite /schueler/[id]/bericht und für den Link der Schüler-App /lernen/[token]/bericht dieselbe Ansicht.
 */
const tag = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("de-AT", { weekday: "short", day: "numeric", month: "numeric" });
const stunden = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`);
const prozent = (x: number) => `${Math.round(x * 100)} %`;

function Abschnitt({ titel, children, testid }: { titel: string; children: React.ReactNode; testid?: string }) {
  return (
    <section className="break-inside-avoid" data-testid={testid}>
      <h2 className="mb-3 text-[18px] font-semibold">{titel}</h2>
      {children}
    </section>
  );
}

export function MonatsberichtAnsicht({ b, name }: { b: Monatsbericht; name: string }) {
  const vorname = name.split(" ")[0];
  const z = b.zuHause;
  const leer = !b.einheiten.length && !b.tests.length && z.tage === 0;
  return (
    <article className="monatsbericht panel space-y-9 px-5 py-6 sm:px-8 sm:py-8 print:border-0 print:p-0 print:shadow-none" data-testid="monatsbericht">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="text-[14px] font-semibold tracking-wide text-ink-3 uppercase">Monatsbericht</p>
          <h1 className="mt-1 text-[26px] leading-tight font-semibold tracking-[-0.02em]">{name}</h1>
          <p className="mt-1 text-[17px] text-ink-2">{b.monatName}</p>
        </div>
        <BrandMark height={44} />
      </header>

      <div className="grid grid-cols-3 gap-3" data-testid="monatsbericht-zahlen">
        <div className="rounded-2xl bg-panel px-4 py-3">
          <p className="num text-[21px] font-semibold sm:text-[26px]">{b.einheiten.length}</p>
          <p className="text-[14px] text-ink-2">{b.einheiten.length === 1 ? "Einheit" : "Einheiten"}</p>
        </div>
        <div className="rounded-2xl bg-panel px-4 py-3">
          <p className="num text-[21px] font-semibold sm:text-[26px]">{b.minuten ? (b.minuten < 60 ? `${b.minuten} min` : `${(Math.round((b.minuten / 60) * 10) / 10).toLocaleString("de-AT")} h`) : "–"}</p>
          <p className="text-[14px] text-ink-2">Nachhilfe</p>
        </div>
        <div className="rounded-2xl bg-panel px-4 py-3">
          <p className="num text-[21px] font-semibold sm:text-[26px]">{z.tage}</p>
          <p className="text-[14px] text-ink-2">{z.tage === 1 ? "Tag" : "Tage"} zu Hause geübt</p>
        </div>
      </div>

      {leer && <p className="text-[16px] text-ink-2">In diesem Monat gab es keine Einheit und keine Note.</p>}

      {b.einheiten.length > 0 && (
        <Abschnitt titel="Einheiten" testid="monatsbericht-einheiten">
          <ul className="divide-y divide-line">
            {b.einheiten.map((e, i) => (
              <li key={i} className="grid grid-cols-[5.5rem_1fr_auto] items-baseline gap-x-3 py-2 text-[15px]">
                <span className="num text-ink-2">{tag(e.datum)}</span>
                <span className="min-w-0">
                  <b className="font-semibold">{e.fach}</b>
                  {e.thema && <span className="text-ink-2"> · {e.thema}</span>}
                </span>
                <span className="num text-ink-3">{stunden(e.minuten)}</span>
              </li>
            ))}
          </ul>
        </Abschnitt>
      )}

      {b.themen.length > 0 && (
        <Abschnitt titel="Woran wir gearbeitet haben" testid="monatsbericht-themen">
          <ul className="space-y-2.5">
            {b.themen.map((t) => (
              <li key={t.name} className="text-[15px]">
                <div className="flex items-baseline justify-between gap-3">
                  <span>
                    {t.name} <span className="text-ink-3">· {t.fach}</span>
                  </span>
                  <span className="num shrink-0 font-semibold">
                    {t.vorher !== null && Math.round(t.vorher * 100) !== Math.round(t.nachher * 100) ? `${prozent(t.vorher)} → ${prozent(t.nachher)}` : prozent(t.nachher)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-panel" aria-hidden>
                  <div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.max(3, Math.round(t.nachher * 100))}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[13px] text-ink-3">Prozent = wie sicher {vorname} das Thema in den Übungen kann, vor diesem Monat → jetzt.</p>
        </Abschnitt>
      )}

      {b.tests.length > 0 && (
        <Abschnitt titel="Schularbeiten und Tests" testid="monatsbericht-tests">
          <ul className="divide-y divide-line">
            {b.tests.map((t, i) => (
              <li key={i} className="grid grid-cols-[5.5rem_1fr_auto] items-baseline gap-x-3 py-2 text-[15px]">
                <span className="num text-ink-2">{tag(t.datum)}</span>
                <span className="min-w-0">
                  <b className="font-semibold">{t.fach}</b> · {t.titel}
                </span>
                <span className="text-right">{t.geplant ? <span className="text-ink-3">kommt noch</span> : t.note ? (
                    <>
                      <b className="num">{t.note}</b> <span className="text-ink-3">{NOTEN_WORT[t.note]}</span>
                    </>
                  ) : (
                    <span className="text-ink-3">Note fehlt</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Abschnitt>
      )}

      <Abschnitt titel="Zu Hause geübt" testid="monatsbericht-zuhause">
        {z.tage === 0 ? (
          <p className="text-[15px] text-ink-2">In diesem Monat hat {vorname} zu Hause nicht mit DreamStudy geübt.</p>
        ) : (
          <>
            <p className="text-[15px]">
              An <b>{z.tage === 1 ? "1 Tag" : `${z.tage} Tagen`}</b>
              {z.minuten >= 1 ? `, zusammen ${stunden(z.minuten)}` : ""}
              {z.anzahl ? `, ${z.anzahl} Aufgaben, ${Math.round((z.richtig / z.anzahl) * 100)} % richtig` : ""}.
            </p>
            {z.was.length > 0 && <p className="mt-1 text-[15px] text-ink-2">Am meisten: {z.was.map((w) => w.titel).join(", ")}.</p>}
          </>
        )}
      </Abschnitt>

      <Abschnitt titel="Notenverlauf" testid="monatsbericht-noten">
        <NotenverlaufKarte v={b.noten} druck />
      </Abschnitt>

      <footer className="border-t border-line pt-4 text-[13px] text-ink-3">MC Dream Education · erstellt mit DreamStudy aus den Daten der Einheiten</footer>
    </article>
  );
}

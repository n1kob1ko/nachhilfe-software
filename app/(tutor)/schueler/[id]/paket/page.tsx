import Link from "next/link";
import { notFound } from "next/navigation";
import { paketErstellenAction } from "@/app/uebungspaket-actions";
import { PaketFormular } from "@/components/PaketKnopf";
import { PageHeader } from "@/components/ui";
import { errorTypeLabel } from "@/lib/error-types";
import { getSkill, getStudent } from "@/lib/repo";
import { PAKET_ANZAHL, PAKET_STANDARD, paketVorschlag } from "@/lib/uebungspaket";

/**
 * Übungspaket aus Erkenntnissen (lib/uebungspaket.ts): die offenen Fehler eines Fachs ankreuzen, sagen, was nicht mehr kommt,
 * Anzahl wählen. Danach die Vorschau der Übung: prüfen, drucken oder aufs Tablet schicken.
 */
export default async function PaketNeu({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fach?: string }> }) {
  const { id } = await params;
  const { fach } = await searchParams;
  const student = getStudent(Number(id));
  if (!student) notFound();
  const v = paketVorschlag(student.id, fach);
  const zurueck = { href: `/schueler/${student.id}?tab=fortschritt`, label: student.name };
  return (
    <>
      <PageHeader title={`Übungspaket ${v.nr} erstellen`} subtitle={`${student.name}${v.fach ? ` · ${v.fach}` : ""}`} back={zurueck} />
      {v.faecher.length > 1 && (
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Fach">
          {v.faecher.map((f) => (
            <Link key={f} href={`/schueler/${student.id}/paket?fach=${encodeURIComponent(f)}`} className={`btn btn-sm ${f === v.fach ? "btn-primary" : "btn-ghost"}`} aria-current={f === v.fach ? "page" : undefined}>
              {f}
            </Link>
          ))}
        </nav>
      )}
      {!v.offen.length ? (
        <div className="panel px-4 py-4 text-[14px] text-ink-2">
          In {v.fach || "diesem Fach"} gibt es keine offenen Fehler. Erkenntnisse kommen aus einer eingelesenen Schularbeit (Gelöstes Blatt einlesen) oder aus „Einheit nachtragen“ › „Aus Text übernehmen“.
        </div>
      ) : (
        <div className="max-w-[760px]">
          <PaketFormular action={paketErstellenAction} text="Paket erstellen" laeuft="Paket wird erstellt …" testId="paket-erstellen">
            <input type="hidden" name="student_id" value={student.id} />
            <input type="hidden" name="fach" value={v.fach} />
            <fieldset className="field">
              <legend className="label">Woran soll das Paket arbeiten?</legend>
              <span className="text-[12px] text-ink-3">Jede Aufgabe trainiert einen dieser Fehler. Was nicht mehr kommt, einfach abhaken.</span>
              <div className="mt-2 grid gap-2" data-testid="paket-fehler">
                {v.offen.map((e) => (
                  <label key={e.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface px-3 py-2 has-checked:border-accent has-checked:bg-accent-wash">
                    <input type="checkbox" name="erkenntnis" value={e.id} defaultChecked className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" />
                    <span className="min-w-0">
                      <span className="block text-[14px]">{e.text}</span>
                      <span className="block text-[12px] text-ink-3">{[e.skill_id ? getSkill(e.skill_id)?.name : "ohne Fähigkeit", e.error_type ? errorTypeLabel(e.error_type) : null].filter(Boolean).join(" · ")}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="field">
              <span className="label">Was kommt nicht mehr? (freiwillig)</span>
              <input className="input" name="nicht_mehr" defaultValue={v.nichtMehr} maxLength={300} placeholder="z. B. Geschichte zu Ende schreiben" />
              <span className="text-[12px] text-ink-3">Dazu gibt es keine Aufgaben. Wird fürs nächste Paket gemerkt.</span>
            </label>
            {v.staerken.length > 0 && <p className="text-[13px] text-ink-2">Schon sicher, wird nicht geübt: {v.staerken.map((s) => s.text).join(" · ")}</p>}
            <fieldset className="field">
              <legend className="label">Wie viele Aufgaben?</legend>
              <div className="flex gap-2">
                {PAKET_ANZAHL.map((n) => (
                  <label key={n} className="flex min-h-[44px] min-w-[64px] cursor-pointer items-center justify-center rounded-lg border border-line-strong bg-surface px-3 text-[15px] has-checked:border-accent has-checked:bg-accent-wash has-checked:text-accent">
                    <input type="radio" name="anzahl" value={n} defaultChecked={n === PAKET_STANDARD} className="sr-only" />
                    {n}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="text-[13px] text-ink-3">Danach siehst du die Aufgaben in der Vorschau. Dort druckst du das Paket oder schickst es aufs Tablet: am Tablet bewertet die App selbst, auf Papier fotografierst du die Lösungen mit „Arbeit fotografieren“.</p>
          </PaketFormular>
        </div>
      )}
    </>
  );
}

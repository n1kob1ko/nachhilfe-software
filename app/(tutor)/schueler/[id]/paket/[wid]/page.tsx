import Link from "next/link";
import { notFound } from "next/navigation";
import { paketAuswertenAction, paketAuswertungSpeichernAction } from "@/app/uebungspaket-actions";
import { FehlerZeilen } from "@/components/FehlerZeilen";
import { PaketFormular } from "@/components/PaketKnopf";
import { PageHeader } from "@/components/ui";
import { skillsForPrompt } from "@/lib/lehrplan";
import { getStudent } from "@/lib/repo";
import { paketErgebnis, paketVonId, type PaketStand } from "@/lib/uebungspaket";

const STAND: Record<PaketStand, { text: string; cls: string }> = {
  behoben: { text: "behoben", cls: "bg-green-wash text-green" },
  besser: { text: "besser", cls: "bg-amber-wash text-amber" },
  offen: { text: "noch offen", cls: "bg-red-wash text-red" },
};
const BEWERTUNG: Record<string, string> = { richtig: "✓", teilweise: "½", falsch: "✗", offen: "?", fehlt: "–" };

/**
 * Übungspaket auswerten (lib/uebungspaket.ts): das Ergebnis je Aufgabe, dann je Fehlermuster behoben, besser oder offen und
 * neue Muster. Die Lehrkraft prüft und übernimmt; danach das nächste Paket.
 */
export default async function PaketAuswerten({ params, searchParams }: { params: Promise<{ id: string; wid: string }>; searchParams: Promise<{ fehler?: string }> }) {
  const { id, wid } = await params;
  const { fehler } = await searchParams;
  const student = getStudent(Number(id));
  if (!student) notFound();
  const p = paketVonId(Number(wid), student.id);
  if (!p) notFound();
  const { aufgaben, beantwortet, richtig } = paketErgebnis(p.id);
  const a = p.paket.auswertung;
  const skills = skillsForPrompt(student, p.paket.fach).map((s) => ({ id: s.id, name: s.name, area: s.area }));
  return (
    <>
      <PageHeader title={p.title} subtitle={`${p.paket.fach} · ${beantwortet ? `${richtig} von ${aufgaben.length} richtig` : "noch nicht gelöst"}`} back={{ href: `/schueler/${student.id}?tab=fortschritt`, label: student.name }} />
      {fehler && <p className="mb-4 rounded-xl bg-red-wash px-4 py-3 text-[14px] text-red">{fehler}</p>}
      <div className="grid max-w-[860px] gap-8">
        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="gruppe-titel">Aufgaben</h2>
            <Link href={`/uebungen/${p.id}`} className="text-[13px] underline">
              Übung öffnen (drucken, aufs Tablet)
            </Link>
          </div>
          <ol className="grid gap-1 text-[14px]" data-testid="paket-aufgaben">
            {aufgaben.map((x) => (
              <li key={x.taskId} className="flex gap-2">
                <span className="num w-6 shrink-0 text-ink-3">{x.nr}</span>
                <span className="w-5 shrink-0 font-semibold">{BEWERTUNG[x.bewertung]}</span>
                <span className="min-w-0 truncate">{x.aufgabe}</span>
              </li>
            ))}
          </ol>
          {!beantwortet && <p className="mt-2 text-[13px] text-ink-3">Sobald das Paket am Tablet gelöst oder auf Papier fotografiert ist, kannst du es hier auswerten.</p>}
        </section>

        {p.paket.ausgewertetAm ? (
          <section className="panel px-4 py-4">
            <p className="text-[14px]">Ausgewertet und übernommen.</p>
            <Link href={`/schueler/${student.id}/paket?fach=${encodeURIComponent(p.paket.fach)}`} className="btn btn-primary mt-3" data-testid="paket-naechstes">
              Nächstes Übungspaket erstellen
            </Link>
          </section>
        ) : !a ? (
          beantwortet > 0 && (
            <PaketFormular action={paketAuswertenAction} text="Auswerten" laeuft="Wird ausgewertet …" testId="paket-auswerten">
              <input type="hidden" name="student_id" value={student.id} />
              <input type="hidden" name="worksheet_id" value={p.id} />
              <p className="text-[14px] text-ink-2">Prüft je Fehler, ob er behoben ist, und sucht neue Fehlermuster in den Antworten.</p>
            </PaketFormular>
          )
        ) : (
          <form action={paketAuswertungSpeichernAction} className="grid gap-6" data-testid="paket-auswertung">
            <input type="hidden" name="student_id" value={student.id} />
            <input type="hidden" name="worksheet_id" value={p.id} />
            {a.hinweis && <p className="rounded-xl bg-amber-wash px-4 py-3 text-[14px] text-amber">{a.hinweis}</p>}
            <fieldset className="field">
              <legend className="label">Die Fehler aus dem Paket</legend>
              <span className="text-[12px] text-ink-3">Angehakt = erledigt. Was offen bleibt, kommt ins nächste Paket.</span>
              <div className="mt-2 grid gap-2">
                {a.muster.map((m) => (
                  <label key={m.erkenntnisId} className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface px-3 py-2">
                    <input type="checkbox" name="erledigt" value={m.erkenntnisId} defaultChecked={m.stand === "behoben"} className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px]">{m.text}</span>
                      <span className="block text-[12px] text-ink-3">{m.grund}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] ${STAND[m.stand].cls}`}>{STAND[m.stand].text}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="field">
              <legend className="label">Neue Fehler</legend>
              <span className="text-[12px] text-ink-3">Kommen zu den Erkenntnissen. Leere Zeilen werden nicht gespeichert.</span>
              <FehlerZeilen start={a.neue} skills={skills} />
            </fieldset>
            <label className="field">
              <span className="label">Was klappt jetzt gut?</span>
              <textarea className="input" name="ek_gut" defaultValue={a.staerken.join("\n")} placeholder="Ein Punkt pro Zeile" />
            </label>
            <div>
              <button className="btn btn-primary btn-lg" data-testid="paket-uebernehmen">
                Übernehmen
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}

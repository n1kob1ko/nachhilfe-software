import { Plus, Power } from "lucide-react";
import { addFachAction, setFachAktivAction } from "@/app/faecher-actions";
import { PageHeader, Pill, SectionTitle } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { fremdeFaecher, listFaecher, mitUebungen } from "@/lib/faecher";

export const metadata = { title: "Fächer" };

/**
 * Mehr › Fächer: die Liste, aus der jedes Fach-Feld wählt (lib/faecher.ts). Sehen darf sie jeder Lehrer,
 * ändern nur die Verwaltung: ein Fach anlegen oder deaktivieren, nie umbenennen — alte Einträge halten
 * das Fach als Text und bleiben so, wie sie sind.
 */
export default async function FaecherPage({ searchParams }: { searchParams: Promise<{ fehler?: string; ok?: string }> }) {
  const me = await requireTeacher();
  const sp = await searchParams;
  const darf = Boolean(me.is_admin);
  const alle = listFaecher({ mitInaktiven: true });
  const aktiv = alle.filter((f) => f.aktiv);
  const inaktiv = alle.filter((f) => !f.aktiv);
  const fremde = darf ? fremdeFaecher() : [];

  const zeile = (f: (typeof alle)[number]) => (
    <li key={f.id} className="flex min-h-[60px] flex-wrap items-center gap-x-3 gap-y-2 px-5 py-2.5">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span className={`font-semibold ${f.aktiv ? "" : "text-ink-3"}`}>{f.name}</span>
        {mitUebungen(f.name) && <Pill tone="accent">Übungen und Lernstand</Pill>}
      </div>
      {darf && !mitUebungen(f.name) && (
        <form action={setFachAktivAction.bind(null, f.id, !f.aktiv)}>
          <button className="btn btn-ghost btn-sm">
            <Power size={15} aria-hidden /> {f.aktiv ? "Deaktivieren" : "Aktivieren"}
          </button>
        </form>
      )}
    </li>
  );

  return (
    <>
      <PageHeader
        title="Fächer"
        back={{ href: "/mehr", label: "Mehr" }}
        info="Aus dieser Liste wählen alle Fach-Felder: Profil, Einheit, Hausübung, Schularbeit, aktueller Stoff, Material und Texte. Übungen, Lehrplan und Lernstand gibt es für Mathematik, Deutsch und Englisch; jedes andere Fach wird dokumentiert und geplant."
      />

      {(sp.fehler || sp.ok) && (
        <p className={`mb-6 max-w-[760px] rounded-2xl px-4 py-3 text-[14px] ${sp.fehler ? "bg-red-wash text-red" : "bg-green-wash text-green"}`} role="status">
          {sp.fehler ?? sp.ok}
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section>
          <SectionTitle>{aktiv.length} Fächer in der Auswahl</SectionTitle>
          <ul className="panel divide-y divide-line">{aktiv.map(zeile)}</ul>
          {inaktiv.length > 0 && (
            <>
              <h2 className="gruppe-titel mt-8 mb-3">Deaktiviert</h2>
              <ul className="panel divide-y divide-line">{inaktiv.map(zeile)}</ul>
              <p className="mt-3 text-[13px] text-ink-3">Deaktivierte Fächer stehen in keiner Auswahl mehr. Einheiten und Schularbeiten, die sie schon haben, bleiben, wie sie sind.</p>
            </>
          )}
          {!darf && <p className="mt-3 text-[13px] text-ink-3">Fächer anlegen kann die Verwaltung. Ein einmaliges Fach kannst du bei der Einheit auch einfach eintippen.</p>}
        </section>

        {darf && (
          <aside className="grid content-start gap-6">
            <form action={addFachAction} className="panel grid gap-3 px-4 py-4">
              <label className="field">
                <span className="label">Fach hinzufügen</span>
                <input className="input" name="name" required minLength={2} maxLength={60} placeholder="z. B. Darstellende Geometrie" autoComplete="off" />
              </label>
              <button className="btn btn-primary justify-self-start">
                <Plus size={16} aria-hidden /> Hinzufügen
              </button>
            </form>
            {fremde.length > 0 && (
              <section className="panel px-4 py-4">
                <h2 className="font-semibold">Eingetippt, aber nicht in der Liste</h2>
                <p className="mt-1 mb-3 text-[13px] text-ink-2">Steht schon bei Einheiten, Hausübungen oder im Profil. Aufnehmen, damit es überall zur Auswahl steht.</p>
                <ul className="grid gap-2">
                  {fremde.slice(0, 12).map((f) => (
                    <li key={f.name} className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 text-[14px]">
                        {f.name} <span className="text-ink-3">· {f.anzahl}×</span>
                      </span>
                      <form action={addFachAction}>
                        <input type="hidden" name="name" value={f.name} />
                        <button className="btn btn-secondary btn-sm">
                          <Plus size={15} aria-hidden /> Aufnehmen
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        )}
      </div>
    </>
  );
}

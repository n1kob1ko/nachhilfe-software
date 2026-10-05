import Link from "next/link";
import { LogOut, Square } from "lucide-react";
import { logoutAction } from "@/app/session-actions";
import { PageHeader, formatTime } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { runningUnits } from "@/lib/units";

export const metadata = { title: "Abmelden" };

/** Asked before logging out while a unit is still running. */
export default async function LogoutPage() {
  const teacher = await requireTeacher();
  const running = runningUnits(teacher.id);
  const first = (name: string) => name.split(" ")[0];
  return (
    <>
      <PageHeader title="Abmelden" />
      <div className="panel max-w-[620px] p-5 md:p-6">
        {running.length === 0 ? (
          <p className="text-[15px]">Es läuft keine Einheit. Du kannst dich abmelden.</p>
        ) : (
          <>
            <ul className="grid gap-1 text-[16px] font-semibold" role="alert">
              {running.map((u) => (
                <li key={u.id}>
                  Mit {first(u.student_name)} läuft seit <span className="num">{formatTime(u.started_at)}</span> eine Einheit.
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[14px] text-ink-2">
              Läuft sie weiter, bleibt sie gespeichert und du siehst sie beim nächsten Anmelden wieder. Ohne Aktivität wird sie nach 3 Stunden automatisch beendet (Endzeit dann geschätzt).
            </p>
          </>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          {running.length > 0 && (
            <form action={logoutAction}>
              <input type="hidden" name="mode" value="beenden" />
              <button className="btn btn-primary">
                <Square size={13} aria-hidden /> {running.length === 1 ? "Einheit beenden" : "Einheiten beenden"} und abmelden
              </button>
            </form>
          )}
          <form action={logoutAction}>
            <input type="hidden" name="mode" value="weiter" />
            <button className={running.length ? "btn btn-secondary" : "btn btn-primary"}>
              <LogOut size={14} aria-hidden /> {running.length ? `${running.length === 1 ? "Einheit" : "Einheiten"} weiterlaufen lassen und abmelden` : "Abmelden"}
            </button>
          </form>
          <Link href="/" className="btn btn-ghost">
            Abbrechen
          </Link>
        </div>
      </div>
    </>
  );
}

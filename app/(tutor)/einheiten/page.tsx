import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { UnitStatusPill } from "@/components/UnitControl";
import { Empty, PageHeader, Pill } from "@/components/ui";
import { billingDay, resolveMonth } from "@/lib/billing";
import { listStudents, listTeachers, getLessonForUnit } from "@/lib/repo";
import { listUnits, unitDurationMs, type UnitStatus } from "@/lib/units";

export const metadata = { title: "Einheiten" };

const time = (iso: string) => new Date(iso).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });

/** Basis-Dokumentation: every unit with teacher, student, start, end and status. */
export default async function Units({ searchParams }: { searchParams: Promise<{ monat?: string; lehrer?: string; schueler?: string; status?: string }> }) {
  const sp = await searchParams;
  const b = resolveMonth(sp);
  const [y, m] = b.monat.split("-").map(Number);
  const from = new Date(y, m - 1, 1).toISOString();
  const to = new Date(y, m, 1).toISOString();
  const status = (["gestartet", "beendet", "abgebrochen"] as const).find((s) => s === sp.status) ?? null;
  const units = listUnits({ from, to, teacherId: b.teacherId, studentId: b.studentId, status: status as UnitStatus | null });
  const teachers = listTeachers();
  const students = listStudents();
  const query = (monat: string) => {
    const q = new URLSearchParams({ monat });
    if (b.teacherId) q.set("lehrer", String(b.teacherId));
    if (b.studentId) q.set("schueler", String(b.studentId));
    if (status) q.set("status", status);
    return q.toString();
  };
  const totalMin = Math.round(units.filter((u) => u.status === "beendet").reduce((s, u) => s + unitDurationMs(u), 0) / 60_000);

  return (
    <>
      <PageHeader title="Einheiten" subtitle={`Wer hat wann mit wem gearbeitet · ${b.label}`} />
      <form className="no-print mb-6 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1">
          <Link href={`/einheiten?${query(b.prev)}`} className="btn btn-ghost btn-sm" aria-label="Voriger Monat">
            <ChevronLeft size={16} aria-hidden />
          </Link>
          <label className="field">
            <span className="label">Monat</span>
            <input className="input num" type="month" name="monat" defaultValue={b.monat} />
          </label>
          <Link href={`/einheiten?${query(b.next)}`} className="btn btn-ghost btn-sm" aria-label="Nächster Monat">
            <ChevronRight size={16} aria-hidden />
          </Link>
        </div>
        <label className="field">
          <span className="label">Lehrer</span>
          <select className="input" name="lehrer" defaultValue={b.teacherId ?? ""}>
            <option value="">Alle</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Schüler</span>
          <select className="input" name="schueler" defaultValue={b.studentId ?? ""}>
            <option value="">Alle</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Status</span>
          <select className="input" name="status" defaultValue={status ?? ""}>
            <option value="">Alle</option>
            <option value="gestartet">läuft</option>
            <option value="beendet">beendet</option>
            <option value="abgebrochen">abgebrochen</option>
          </select>
        </label>
        <button className="btn btn-primary">Anzeigen</button>
      </form>

      {units.length === 0 ? (
        <Empty title={`Keine Einheiten im ${b.label}`}>Einheiten entstehen, sobald ein Lehrer im Schülerprofil auf „Einheit starten“ klickt.</Empty>
      ) : (
        <>
          <p className="mb-3 text-[14px] text-ink-2">
            <span className="num font-semibold text-ink">{units.length}</span> {units.length === 1 ? "Einheit" : "Einheiten"} ·{" "}
            <span className="num">{Math.floor(totalMin / 60)} h {String(totalMin % 60).padStart(2, "0")} min</span> beendet
          </p>
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-line text-[12px] text-ink-3">
                  <th className="px-5 py-3 font-semibold">Tag</th>
                  <th className="px-3 py-3 font-semibold">Zeit</th>
                  <th className="px-3 py-3 text-right font-semibold">Dauer</th>
                  <th className="px-3 py-3 font-semibold">Lehrer</th>
                  <th className="px-3 py-3 font-semibold">Schüler</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Dokumentation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {units.map((u) => {
                  const lesson = getLessonForUnit(u.id);
                  return (
                    <tr key={u.id}>
                      <td className="num px-5 py-3 whitespace-nowrap">{billingDay(u.started_at)}</td>
                      <td className="num px-3 py-3 whitespace-nowrap">
                        {time(u.started_at)}–{u.ended_at ? `${u.end_estimated ? "ca. " : ""}${time(u.ended_at)}` : "…"}
                      </td>
                      <td className="num px-3 py-3 text-right whitespace-nowrap">{Math.round(unitDurationMs(u) / 60_000)} min</td>
                      <td className="px-3 py-3">{u.teacher_name}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <Link href={`/schueler/${u.student_id}?tab=lernverlauf`} className="hover:text-accent">
                          {u.student_name}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <UnitStatusPill status={u.status} />
                        {u.ended_by === "automatisch" && u.status === "beendet" && (
                          <div className="mt-0.5 text-[12px] text-amber">automatisch beendet, Endzeit geschätzt</div>
                        )}
                        {u.ended_by !== "automatisch" && u.end_reason && <div className="mt-0.5 text-[12px] text-ink-3">{u.end_reason}</div>}
                      </td>
                      <td className="px-5 py-3">
                        {u.status === "abgebrochen" ? (
                          <span className="text-ink-3">–</span>
                        ) : (
                          <Link href={`/einheiten/${u.id}`} className="link text-[13px] font-medium">
                            {u.status === "gestartet" ? "Öffnen" : lesson?.reviewed_at ? "Ansehen" : "Abschließen"}
                          </Link>
                        )}
                        {lesson && !lesson.reviewed_at && u.status === "beendet" && (
                          <span className="ml-2">
                            <Pill tone="amber">offen</Pill>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

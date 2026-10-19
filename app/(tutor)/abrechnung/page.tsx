import Link from "next/link";
import { CheckCircle2, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { BillingDelete } from "@/components/BillingDelete";
import { PrintButton } from "@/components/PrintButton";
import { Empty, PageHeader } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { billingDay, resolveBilling, scopeToViewer, type BillingParams, type DeleteRefusal } from "@/lib/billing";
import { listStudents, listTeachers } from "@/lib/repo";

export const metadata = { title: "Abrechnung" };

const REFUSED: Record<DeleteRefusal, string> = {
  weg: "Diese Einheit steht nicht mehr in der Abrechnung.",
  fremd: "Nur der Lehrer der Einheit oder die Verwaltung kann sie löschen.",
  laeuft: "Die Einheit läuft noch. Beende sie zuerst.",
};

const clock = (iso: string) => new Date(iso).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });

export default async function Billing({ searchParams }: { searchParams: Promise<BillingParams & { geloescht?: string; fehler?: string }> }) {
  const viewer = await requireTeacher();
  const raw = await searchParams;
  const sp = scopeToViewer(raw, viewer);
  const refused = raw.fehler && Object.hasOwn(REFUSED, raw.fehler) ? REFUSED[raw.fehler as DeleteRefusal] : null;
  const b = resolveBilling(sp);
  const teachers = listTeachers();
  const students = listStudents();
  const teacher = teachers.find((t) => t.id === b.teacherId);
  const student = students.find((s) => s.id === b.studentId);
  const query = (monat: string) => {
    const q = new URLSearchParams({ monat });
    if (b.teacherId) q.set("lehrer", String(b.teacherId));
    if (b.studentId) q.set("schueler", String(b.studentId));
    return q.toString();
  };
  const perTeacher = teachers.map((t) => ({ name: t.name, n: b.rows.filter((r) => r.teacher_name === t.name).length })).filter((x) => x.n > 0);
  const unassigned = b.rows.filter((r) => !r.teacher_name).length;

  return (
    <>
      <PageHeader
        title="Abrechnung"
        subtitle={
          <>
            Einheiten im {b.label}
            {teacher && ` · ${teacher.name}`}
            {student && ` · ${student.name}`}
          </>
        }
        actions={
          <>
            <a href={`/abrechnung/export?${query(b.monat)}`} className="btn btn-secondary">
              <Download size={15} aria-hidden /> CSV für Excel
            </a>
            <PrintButton />
          </>
        }
      />

      <form className="no-print mb-6 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1">
          <Link href={`/abrechnung?${query(b.prev)}`} className="btn btn-ghost btn-sm" aria-label="Voriger Monat">
            <ChevronLeft size={16} aria-hidden />
          </Link>
          <label className="field">
            <span className="label">Monat</span>
            <input className="input num" type="month" name="monat" defaultValue={b.monat} />
          </label>
          <Link href={`/abrechnung?${query(b.next)}`} className="btn btn-ghost btn-sm" aria-label="Nächster Monat">
            <ChevronRight size={16} aria-hidden />
          </Link>
        </div>
        {viewer.is_admin ? (
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
        ) : null}
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
        <button className="btn btn-primary">Anzeigen</button>
      </form>

      {raw.geloescht && (
        <div role="status" className="no-print mb-6 flex items-center gap-2 rounded-2xl bg-green-wash px-4 py-3 text-[15px] font-medium text-green">
          <CheckCircle2 size={18} aria-hidden /> Die Einheit ist gelöscht.
        </div>
      )}
      {refused && (
        <div role="alert" className="no-print mb-6 rounded-2xl bg-amber-wash px-4 py-3 text-[15px]">
          {refused}
        </div>
      )}

      {b.rows.length === 0 ? (
        <Empty
          title={`Keine Einheiten im ${b.label}`}
          action={
            <Link href={`/abrechnung?${query(b.prev)}`} className="btn btn-secondary">
              <ChevronLeft size={15} aria-hidden /> Voriger Monat
            </Link>
          }
        >
          Hier erscheinen alle Einheiten, die als „stattgefunden“ dokumentiert sind. Selbstständige Übungen der Schüler werden nicht abgerechnet.
        </Empty>
      ) : (
        <>
          <p className="mb-3 text-[14px] text-ink-2">
            <span className="num font-semibold text-ink">{b.rows.length}</span> {b.rows.length === 1 ? "Einheit" : "Einheiten"}
            {perTeacher.length > 1 && <> · {perTeacher.map((t) => `${t.name} ${t.n}`).join(" · ")}</>}
            {unassigned > 0 && <span className="text-red"> · {unassigned} ohne Lehrer</span>}
          </p>
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-line text-[12px] text-ink-3">
                  <th className="px-5 py-3 font-semibold whitespace-nowrap">Tag</th>
                  <th className="px-3 py-3 font-semibold">Lehrer</th>
                  <th className="px-3 py-3 font-semibold">Schüler</th>
                  <th className="px-3 py-3 font-semibold">Thema</th>
                  <th className="px-5 py-3 font-semibold">Beobachtungen</th>
                  <th className="no-print relative w-12 py-3 pr-3">
                    <span className="sr-only">Löschen</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line align-top">
                {b.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="num px-5 py-3 whitespace-nowrap">
                      {billingDay(r.starts_at)}
                      <div className="text-[12px] text-ink-3">
                        {r.unit_start && r.unit_end ? `${clock(r.unit_start)}–${r.unit_end_estimated ? "ca. " : ""}${clock(r.unit_end)}` : r.duration_min > 0
                            ? `${r.starts_at.slice(11, 16)} · ${r.duration_min} min`
                            : "ohne Uhrzeit"}
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{r.teacher_name ?? <span className="text-red">offen</span>}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <Link href={r.unit_id ? `/einheiten/${r.unit_id}` : `/schueler/${r.student_id}/stunden/${r.id}`} className="hover:text-accent">
                        {r.student_name}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-ink-2">{r.subject}</span>
                      {r.topic && <div>{r.topic}</div>}
                    </td>
                    <td className="max-w-[44ch] px-5 py-3 whitespace-pre-line text-ink-2">{r.tutor_notes || "–"}</td>
                    <td className="no-print py-2 pr-3 text-right">
                      <BillingDelete id={r.id} wer={`von ${r.student_name} am ${billingDay(r.starts_at)}`} zurueck={query(b.monat)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

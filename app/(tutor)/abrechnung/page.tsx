import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { PrintButton } from "@/components/PrintButton";
import { Empty, PageHeader } from "@/components/ui";
import { billingDay, resolveBilling, type BillingParams } from "@/lib/billing";
import { listStudents, listTeachers } from "@/lib/repo";

export const metadata = { title: "Abrechnung" };

export default async function Billing({ searchParams }: { searchParams: Promise<BillingParams> }) {
  const sp = await searchParams;
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
            Nachhilfestunden im {b.label}
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
        <button className="btn btn-primary">Anzeigen</button>
      </form>

      {b.rows.length === 0 ? (
        <Empty
          title={`Keine Stunden im ${b.label}`}
          action={
            <Link href={`/abrechnung?${query(b.prev)}`} className="btn btn-secondary">
              <ChevronLeft size={15} aria-hidden /> Voriger Monat
            </Link>
          }
        >
          Hier erscheinen alle Nachhilfestunden, die als „stattgefunden“ dokumentiert sind. Selbstständige Übungen der Schüler werden nicht abgerechnet.
        </Empty>
      ) : (
        <>
          <p className="mb-3 text-[14px] text-ink-2">
            <span className="num font-semibold text-ink">{b.rows.length}</span> {b.rows.length === 1 ? "Stunde" : "Stunden"}
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
                </tr>
              </thead>
              <tbody className="divide-y divide-line align-top">
                {b.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="num px-5 py-3 whitespace-nowrap">{billingDay(r.starts_at)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{r.teacher_name ?? <span className="text-red">offen</span>}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <Link href={`/schueler/${r.student_id}/stunden/${r.id}`} className="hover:text-accent">
                        {r.student_name}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-ink-2">{r.subject}</span>
                      {r.topic && <div>{r.topic}</div>}
                    </td>
                    <td className="max-w-[44ch] px-5 py-3 whitespace-pre-line text-ink-2">{r.tutor_notes || "–"}</td>
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

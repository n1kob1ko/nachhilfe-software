import Link from "next/link";
import { CheckCircle2, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { BillingDelete } from "@/components/BillingDelete";
import { PrintButton } from "@/components/PrintButton";
import { Empty, PageHeader } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { billingDay, resolveBilling, scopeToViewer, type BillingParams, type DeleteRefusal } from "@/lib/billing";
import { listStudents, listTeachers, type BillingRow } from "@/lib/repo";

export const metadata = { title: "Abrechnung" };

const REFUSED: Record<DeleteRefusal, string> = {
  weg: "Diese Einheit steht nicht mehr in der Abrechnung.",
  fremd: "Nur der Lehrer der Einheit oder die Verwaltung kann sie löschen.",
  laeuft: "Die Einheit läuft noch. Beende sie zuerst.",
};

const clock = (iso: string) => new Date(iso).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });

/** „12 h 30 min“ aus Minuten; unter einer Stunde nur Minuten. */
const stundenLabel = (min: number) => (min === 0 ? "–" : min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`);

/** Uhrzeit einer Zeile: aus der Einheit, sonst Beginn und Dauer; `null`, wenn keine bekannt ist. */
function zeit(r: BillingRow) {
  if (r.unit_start && r.unit_end) return `${clock(r.unit_start)}–${r.unit_end_estimated ? "ca. " : ""}${clock(r.unit_end)}`;
  if (r.duration_min > 0) return `${r.starts_at.slice(11, 16)} · ${r.duration_min} min`;
  return null;
}

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
  // am Handy: nach Tag gruppiert, neueste zuerst wie die Tabelle
  const tage: { tag: string; rows: typeof b.rows }[] = [];
  for (const r of b.rows) {
    const tag = billingDay(r.starts_at);
    if (tage.at(-1)?.tag === tag) tage.at(-1)!.rows.push(r);
    else tage.push({ tag, rows: [r] });
  }
  const zeigeLehrer = !b.teacherId;

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

      <form className="no-print mb-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end" data-testid="abr-filter">
        <div className="field col-span-2 sm:w-[290px]">
          <label htmlFor="abr-monat" className="label">
            Monat
          </label>
          <div className="flex items-center gap-1">
            <Link href={`/abrechnung?${query(b.prev)}`} className="btn btn-ghost btn-sm shrink-0" aria-label="Voriger Monat">
              <ChevronLeft size={16} aria-hidden />
            </Link>
            <input id="abr-monat" className="input num min-w-0 flex-1" type="month" name="monat" defaultValue={b.monat} />
            <Link href={`/abrechnung?${query(b.next)}`} className="btn btn-ghost btn-sm shrink-0" aria-label="Nächster Monat">
              <ChevronRight size={16} aria-hidden />
            </Link>
          </div>
        </div>
        {viewer.is_admin ? (
          <label className="field min-w-0 sm:w-[180px]">
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
        <label className={`field min-w-0 sm:w-[220px] ${viewer.is_admin ? "" : "col-span-2"}`}>
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
        <button className="btn btn-primary col-span-2">Anzeigen</button>
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
          <ul className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Summen">
            <li className="kennzahl">
              <span className="kennzahl-wort">Einheiten</span>
              <span className="kennzahl-wert">{b.rows.length}</span>
              <span className="kennzahl-zusatz">{b.label}</span>
            </li>
            <li className="kennzahl">
              <span className="kennzahl-wort">Schüler</span>
              <span className="kennzahl-wert">{new Set(b.rows.map((r) => r.student_name)).size}</span>
              <span className="kennzahl-zusatz">{tage.length} {tage.length === 1 ? "Tag" : "Tage"}</span>
            </li>
            <li className="kennzahl">
              <span className="kennzahl-wort">Zeit</span>
              <span className="kennzahl-wert">{stundenLabel(b.rows.reduce((sum, r) => sum + (r.duration_min > 0 ? r.duration_min : 0), 0))}</span>
              <span className="kennzahl-zusatz">{b.rows.some((r) => !(r.duration_min > 0)) ? "ohne Zeilen ohne Dauer" : "dokumentierte Dauer"}</span>
            </li>
            <li className="kennzahl">
              <span className="kennzahl-wort">Lehrer</span>
              <span className="kennzahl-wert">{perTeacher.length || "–"}</span>
              <span className={`kennzahl-zusatz ${unassigned > 0 ? "text-red" : ""}`}>
                {unassigned > 0 ? `${unassigned} ohne Lehrer` : perTeacher.map((t) => `${t.name.split(" ")[0]} ${t.n}`).join(" · ") || "–"}
              </span>
            </li>
          </ul>
          <div className="grid gap-5 lg:hidden print:hidden" data-testid="abr-liste">
            {tage.map(({ tag, rows }) => (
              <section key={tag} aria-label={tag}>
                <h2 className="mb-2 flex items-baseline justify-between gap-3 px-1 text-[13px] font-semibold text-ink-2">
                  <span className="num">{tag}</span>
                  <span className="font-medium text-ink-3">
                    {rows.length} {rows.length === 1 ? "Einheit" : "Einheiten"}
                  </span>
                </h2>
                <ul className="panel divide-y divide-line">
                  {rows.map((r) => {
                    const z = zeit(r);
                    return (
                      <li key={r.id} className="flex items-start gap-2 py-3 pr-2 pl-4" data-testid="abr-eintrag">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <Link
                              href={r.unit_id ? `/einheiten/${r.unit_id}` : `/schueler/${r.student_id}/stunden/${r.id}`}
                              className="min-w-0 truncate text-[16px] font-semibold hover:text-accent"
                            >
                              {r.student_name}
                            </Link>
                            {r.teacher_name ? (
                              zeigeLehrer && <span className="shrink-0 text-[13px] text-ink-3">{r.teacher_name}</span>
                            ) : (
                              <span className="shrink-0 text-[13px] font-medium text-red">Lehrer offen</span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-baseline justify-between gap-3 text-[14px]">
                            <span className="min-w-0 text-ink-2">
                              {r.subject}
                              {r.topic && <span className="text-ink"> · {r.topic}</span>}
                            </span>
                            {z && <span className="num shrink-0 text-[13px] text-ink-3">{z}</span>}
                          </div>
                          {r.tutor_notes && <p className="mt-1 line-clamp-2 text-[13px] whitespace-pre-line text-ink-3">{r.tutor_notes}</p>}
                        </div>
                        <BillingDelete id={r.id} wer={`von ${r.student_name} am ${tag}`} zurueck={query(b.monat)} />
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
          <div className="panel hidden overflow-x-auto lg:block print:block">
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
                      <div className="text-[12px] text-ink-3">{zeit(r) ?? "ohne Uhrzeit"}</div>
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

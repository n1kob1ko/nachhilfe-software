import { notFound } from "next/navigation";
import { deleteStudentAction } from "@/app/actions";
import { PlanungFormular } from "@/components/planung/PlanungFormular";
import { VerfuegbarkeitTabelle } from "@/components/planung/VerfuegbarkeitTabelle";
import { WochenAbweichung } from "@/components/planung/WochenAbweichung";
import { StudentForm } from "@/components/StudentForm";
import { PageHeader, Pill, SectionTitle } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { darfSchuelerPlanungBearbeiten } from "@/lib/planung/berechtigungen";
import { getAbweichung, getSchuelerPlanung } from "@/lib/planung/repo";
import { istDatum, wienerWochenstart, wochenstartVon } from "@/lib/planung/zeit";
import { listAllTeachers, getStudent } from "@/lib/repo";

/**
 * Schüler bearbeiten — mit dem Abschnitt **Planung** (Phase 3): Einheiten pro Woche, geplante Dauer,
 * Modus, erlaubte Lehrer und Verfügbarkeit, dazu die Abweichung für eine einzelne Woche.
 *
 * Rechte (D23): die Verwaltung und der Lehrer des Schülers (`students.teacher_id`). Für alle anderen
 * ist der Abschnitt nur lesbar; die Server Action prüft dasselbe noch einmal.
 */
export default async function EditStudent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ woche?: string; fehler?: string; ok?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await requireTeacher();
  const student = getStudent(Number(id));
  if (!student) notFound();

  const darfPlanung = darfSchuelerPlanungBearbeiten(me, student.id);
  const planung = getSchuelerPlanung(student.id);
  const woche = sp.woche && istDatum(sp.woche) ? wochenstartVon(sp.woche) : wienerWochenstart();
  const abweichung = getAbweichung("student", student.id, woche);
  const basis = JSON.stringify(planung?.availability ?? {});
  const zurueck = `/schueler/${student.id}/bearbeiten?woche=${woche}`;
  const lehrer = listAllTeachers();

  return (
    <>
      <PageHeader title={`${student.name} bearbeiten`} back={{ href: `/schueler/${student.id}`, label: student.name }} />

      {(sp.fehler || sp.ok) && (
        <p className={`mb-6 max-w-[900px] rounded-2xl px-4 py-3 text-[14px] ${sp.fehler ? "bg-red-wash text-red" : "bg-green-wash text-green"}`} role="status">
          {sp.fehler ?? sp.ok}
        </p>
      )}

      <StudentForm student={student} />

      <section className="mt-12 max-w-[900px] border-t border-line pt-8">
        <SectionTitle action={<Pill tone={planung?.einheiten_pro_woche ? "accent" : "neutral"}>{planung?.einheiten_pro_woche ?? 0} Einheiten pro Woche</Pill>}>Planung</SectionTitle>
        <p className="mb-4 text-[14px] text-ink-2">
          Was für den Wochenplan gebraucht wird: wie viele Einheiten in der Woche, wie lange sie geplant werden, ob vor Ort oder online, welche Lehrer in Frage kommen und wann der Schüler Zeit hat.
        </p>
        {!darfPlanung ? (
          <div className="grid gap-4">
            <p className="rounded-2xl bg-amber-wash px-4 py-3 text-[14px] text-amber">Die Planung ändert die Verwaltung oder der Lehrer dieses Schülers. Hier ist sie nur zu lesen.</p>
            {planung && (
              <ul className="grid gap-1 text-[14px] text-ink-2">
                <li>Geplante Dauer: <span className="num">{planung.geplante_dauer} min</span></li>
                <li>Modus: {planung.modus_wunsch === "egal" ? "egal" : planung.modus_wunsch === "online" ? "online" : "vor Ort"}</li>
                <li>Erlaubte Lehrer: {planung.erlaubte_lehrer.length ? planung.erlaubte_lehrer.map((lid) => lehrer.find((t) => t.id === lid)?.name ?? lid).join(", ") : "alle"}</li>
              </ul>
            )}
            <VerfuegbarkeitTabelle verfuegbarkeit={planung?.availability ?? {}} />
          </div>
        ) : planung ? (
          <PlanungFormular key={`${student.id}-${basis}`} studentId={student.id} planung={planung} lehrer={lehrer} zurueck={zurueck} />
        ) : null}
      </section>

      <section className="mt-12 max-w-[900px] border-t border-line pt-8">
        <SectionTitle>Diese Woche abweichend</SectionTitle>
        <p className="mb-4 text-[14px] text-ink-2">Für eine einzelne Woche gilt eine andere Verfügbarkeit — z. B. in den Ferien oder vor einer Schularbeit.</p>
        <WochenAbweichung
          key={`${student.id}-${woche}`}
          ownerType="student"
          ownerId={student.id}
          weekStart={woche}
          basis={basis}
          abweichung={abweichung ? JSON.stringify(abweichung) : null}
          darfBearbeiten={darfPlanung}
          basisHref={`/schueler/${student.id}/bearbeiten`}
        />
      </section>

      <form action={deleteStudentAction.bind(null, student.id)} className="mt-12 max-w-[760px] border-t border-line pt-6">
        <p className="mb-3 text-[14px] text-ink-2">Löscht den Schüler mit allen Einheiten, Hausübungen, Tests und Übungsergebnissen.</p>
        <button className="btn btn-danger border border-[#e8c3bf]">Schüler endgültig löschen</button>
      </form>
    </>
  );
}

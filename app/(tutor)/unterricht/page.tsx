import Link from "next/link";
import { redirect } from "next/navigation";
import { Play } from "lucide-react";
import { startUnitAction } from "@/app/session-actions";
import { Avatar } from "@/components/Art";
import { SchuelerWahl } from "@/components/heute/SchuelerWahl";
import { requireTeacher } from "@/lib/auth";
import { heuteKarten, naechsterPunkt, tagesplan } from "@/lib/heute";
import { expectedSubject } from "@/lib/learning";
import { bisBeginnLabel } from "@/lib/planung/heute";
import { wienerMinuten } from "@/lib/planung/zeit";
import * as repo from "@/lib/repo";
import { klassenLabel } from "@/lib/school";
import { unterrichtZiel } from "@/lib/situation";
import { listUnits, runningUnits } from "@/lib/units";

export const metadata = { title: "Unterricht" };

/**
 * **Unterricht**: führt zur laufenden Einheit (bei zwei Schülern gleichzeitig zur zuerst gestarteten; die Einheit
 * zeigt oben beide Namen zum Wechseln). Läuft keine, steht hier ruhig der nächste Schüler von heute mit „Einheit
 * starten“; Lernpaket und Fach wählt die App wie immer selbst.
 */
export default async function UnterrichtPage() {
  const teacher = await requireTeacher();
  const running = runningUnits(teacher.id);
  const ziel = unterrichtZiel(running);
  if (ziel !== null) redirect(`/einheiten/${ziel}`);

  const now = new Date();
  const punkte = tagesplan(teacher.id, now);
  const naechster = naechsterPunkt(punkte, now);
  const karte = naechster ? heuteKarten(teacher.id, [naechster], now).get(naechster.studentId) : undefined;
  const student = naechster ? repo.getStudent(naechster.studentId) : null;
  const jetzt = wienerMinuten(now);
  const alle = repo.listStudents();
  const byId = new Map(alle.map((s) => [s.id, s]));
  // „Anderen Schüler starten“: die zuletzt unterrichteten zuerst
  const andere = [...new Set([...listUnits({ teacherId: teacher.id }).map((u) => u.student_id), ...alle.map((s) => s.id)])]
    .filter((id) => byId.has(id) && id !== naechster?.studentId)
    .map((id) => byId.get(id)!);

  return (
    <>
      <header className="mb-6">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] md:text-[32px]">Gerade läuft keine Einheit</h1>
        <p className="mt-1 text-[15px] text-ink-2">Sobald du eine Einheit startest, steht hier Schritt für Schritt, was du sagst, zeigst und fragst.</p>
      </header>
      {naechster && student ? (
        <section className="panel grid max-w-[640px] gap-4 px-5 py-5" aria-label="Als Nächstes">
          <p className="text-[13px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
            Als Nächstes{naechster.startMin > jetzt && naechster.zeit !== "–" ? ` · ${bisBeginnLabel(naechster.startMin - jetzt)}` : ""}
          </p>
          <div className="flex items-center gap-3">
            <Avatar name={student.name} size={44} />
            <div className="min-w-0">
              <p className="text-[20px] leading-tight font-semibold">{student.name}</p>
              <p className="num text-[14px] text-ink-2">
                {[naechster.zeit, klassenLabel(student.school_type, student.klasse, { short: true }), naechster.fach || expectedSubject(student.id, now.getTime(), karte?.fach)].filter((x) => x && x !== "–").join(" · ")}
              </p>
            </div>
          </div>
          {karte?.thema && (
            <p className="text-[15px]">
              <span className="font-semibold">Thema: </span>
              {karte.thema}
            </p>
          )}
          <form action={startUnitAction.bind(null, student.id)}>
            <button className="btn btn-primary btn-lg w-full sm:w-auto">
              <Play size={18} aria-hidden /> Einheit starten
            </button>
          </form>
          <Link href="/" className="w-fit text-[14px] font-medium text-accent hover:underline">
            Alle Schüler von heute
          </Link>
        </section>
      ) : (
        <p className="panel max-w-[640px] px-5 py-5 text-[15px] text-ink-2">Heute kommt niemand mehr laut Plan. Mit wem arbeitest du jetzt?</p>
      )}
      {andere.length > 0 && (
        <div className="mt-6 max-w-[640px]">
          <SchuelerWahl students={andere} offen={!naechster} />
        </div>
      )}
    </>
  );
}

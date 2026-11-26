import { notFound, redirect } from "next/navigation";
import { MathText } from "@/components/MathText";
import { PageHeader } from "@/components/ui";
import { ZuBewertenListe } from "@/components/ZuBewerten";
import { requireTeacher } from "@/lib/auth";
import { getHeft, type HeftUrteil } from "@/lib/heft";
import * as repo from "@/lib/repo";
import { canManageUnit, getUnit } from "@/lib/units";
import { zuBewerten } from "@/lib/zu-bewerten";

export const metadata = { title: "Heft" };

const URTEIL: Record<HeftUrteil, { text: string; klasse: string }> = {
  richtig: { text: "richtig", klasse: "text-green" },
  teilweise: { text: "teilweise", klasse: "text-[#a35a00]" },
  falsch: { text: "falsch", klasse: "text-red" },
  offen: { text: "wartet auf dich", klasse: "text-[#a35a00]" },
};

/**
 * Das Heft am Tablet einer Einheit (lib/heft.ts), für den Lehrer: je Aufgabe, was die KI gelesen hat und wie es ausgegangen ist,
 * die Antworten, die auf ihn warten (bewerten mit einem Tippen), und die abgegebenen Seiten.
 */
export default async function HeftPage({ params }: { params: Promise<{ id: string; aid: string }> }) {
  const { id, aid } = await params;
  const teacher = await requireTeacher();
  const unit = getUnit(Number(id));
  if (!unit) notFound();
  if (!canManageUnit(teacher, unit)) redirect(`/einheiten/${unit.id}?fremd=1`);
  const h = getHeft(Number(aid));
  if (!h || h.unitId !== unit.id) notFound();
  const versuche = repo.listAttemptsForAssignment(h.assignmentId).filter((v) => v.final);
  const gelesen = (taskId: number) => [...versuche].reverse().find((v) => v.task_id === taskId)?.answer ?? "";
  const offen = zuBewerten({ unitId: unit.id }).filter((z) => z.art === "antwort" && z.assignmentId === h.assignmentId);
  const name = unit.student_name.split(" ")[0];
  return (
    <div className="max-w-[960px]">
      <PageHeader back={{ href: `/einheiten/${unit.id}`, label: "Unterricht" }} title={`Heft: ${h.titel}`} subtitle={h.status === "geprueft" ? `Von ${name}, geprüft` : h.status === "pruefen" ? "Wird gerade geprüft" : h.status === "fehler" ? "Noch nicht geprüft" : `${name} schreibt noch`} />
      {h.status === "geprueft" && (
        <ol className="panel mb-6 grid divide-y divide-line px-5" data-testid="heft-zeilen">
          {h.aufgaben.map((a) => (
            <li key={a.taskId} className="grid gap-1 py-3 sm:grid-cols-[1fr_auto] sm:gap-4">
              <div>
                <p className="text-[15.5px] whitespace-pre-line">
                  <span className="mr-1.5 font-semibold">{a.nr}.</span>
                  <MathText text={a.text} />
                </p>
                <p className="text-[14.5px] text-ink-2">
                  Gelesen: <span className="font-medium text-ink">{gelesen(a.taskId) || "nichts"}</span>
                </p>
              </div>
              {a.urteil && <span className={`text-[15px] font-semibold ${URTEIL[a.urteil].klasse}`}>{URTEIL[a.urteil].text}</span>}
            </li>
          ))}
        </ol>
      )}
      {offen.length > 0 && (
        <section className="mb-6 grid gap-3" data-testid="heft-zu-bewerten">
          <h2 className="text-[18px] font-semibold">{offen.length === 1 ? "1 Aufgabe wartet auf dich" : `${offen.length} Aufgaben warten auf dich`}</h2>
          <p className="-mt-2 text-[14.5px] text-ink-2">Hier war die KI unsicher. Schau auf die Seite unten und tippe die Bewertung an.</p>
          <ZuBewertenListe zeilen={offen} />
        </section>
      )}
      <div className="grid gap-4">
        {h.materialIds.map((m, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- the teacher-only file route, no optimiser
          <img key={m} src={`/material/${m}/datei`} alt={`Seite ${i + 1}`} className="w-full rounded-[16px] border border-line bg-white" data-testid="heft-seite" />
        ))}
      </div>
    </div>
  );
}

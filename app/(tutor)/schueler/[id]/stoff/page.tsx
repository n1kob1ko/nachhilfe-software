import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Loader2 } from "lucide-react";
import { StoffpaketForm } from "@/components/StoffpaketForm";
import { PageHeader, Pill } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { einheitFuerKeinName, keinNameBestaetigt } from "@/lib/kein-name";
import * as repo from "@/lib/repo";
import { faecherZurWahl, kostenSchaetzung, listStoffpakete, stoffpaketMoeglich, vorschlagFach, type StoffpaketStatus } from "@/lib/stoffpaket";
import { runningUnitForStudent } from "@/lib/units";
import { materialZurWahl } from "@/lib/vorgabe";

export const metadata = { title: "Stoff vorbereiten" };

const STATUS: Record<StoffpaketStatus, { text: string; tone: "neutral" | "accent" | "red" | "amber" | "green" }> = {
  laeuft: { text: "wird erstellt", tone: "accent" },
  fertig: { text: "zum Ansehen", tone: "amber" },
  fehler: { text: "nicht fertig", tone: "red" },
  uebernommen: { text: "übernommen", tone: "green" },
  verworfen: { text: "verworfen", tone: "neutral" },
};

/**
 * „Stoff vorbereiten“ (lib/stoffpaket.ts): Fotos vom Buch oder von Arbeitsblättern, ein Text, ein Klick: Lernzettel,
 * Übungsblatt, Test mit Lösungen, Vorbereitungstest und Präsentation. Darunter, was schon vorbereitet ist.
 */
export default async function StoffVorbereitenPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ verworfen?: string }> }) {
  const teacher = await requireTeacher();
  const student = repo.getStudent(Number((await params).id));
  if (!student) notFound();
  const sp = await searchParams;
  const laufend = runningUnitForStudent(student.id);
  const unit = laufend ? einheitFuerKeinName(laufend.id, student.id, teacher) : null;
  const geht = stoffpaketMoeglich({ studentId: student.id, dateien: 0 });
  const frueher = listStoffpakete(student.id);
  const first = student.name.split(" ")[0];
  return (
    <>
      <PageHeader
        title={`Stoff vorbereiten: ${student.name}`}
        back={{ href: `/schueler/${student.id}`, label: student.name }}
        subtitle={`Fotos vom Buch oder von Arbeitsblättern hochladen. Die App erstellt alles in einem Schritt und weiß dabei schon, was ${first} kann, welche Fehler zuletzt vorkamen und wann die nächste Schularbeit ist.`}
      />
      <div className="grid max-w-[900px] grid-cols-1 gap-6">
        {sp.verworfen && <p className="rounded-2xl bg-panel px-4 py-3 text-[15px] text-ink-2">Verworfen. Beim Schüler ist nichts davon angekommen.</p>}
        <section className="panel px-5 py-5">
          <StoffpaketForm
            studentId={student.id}
            unitId={unit?.id ?? null}
            faecher={faecherZurWahl(student)}
            fach={vorschlagFach(student)}
            material={materialZurWahl(student.id).map(({ id, titel, art, datum }) => ({ id, titel, art, datum }))}
            keinNameBestaetigt={keinNameBestaetigt(unit)}
            kosten={kostenSchaetzung()}
            gesperrt={geht.ok ? null : geht.grund}
          />
        </section>
        {frueher.length > 0 && (
          <section className="grid grid-cols-1 gap-2" aria-label="Schon vorbereitet">
            <h2 className="text-[16px] font-semibold">Schon vorbereitet</h2>
            <ul className="panel divide-y divide-line">
              {frueher.map((p) => (
                <li key={p.id}>
                  <Link href={`/schueler/${student.id}/stoff/${p.id}`} className="treffer flex min-h-[52px] items-center gap-3 px-4 py-2.5 hover:bg-panel">
                    {p.status === "laeuft" && <Loader2 size={16} className="shrink-0 animate-spin text-accent" aria-hidden />}
                    <span className="min-w-0 flex-1 truncate text-[15px]">
                      <span className="font-medium">{p.thema || p.anweisung.slice(0, 60) || "Stoff"}</span>
                      <span className="text-ink-3">
                        {" "}
                        · {p.fach} · {Number(p.created_at.slice(8, 10))}.{Number(p.created_at.slice(5, 7))}.
                      </span>
                    </span>
                    <Pill tone={STATUS[p.status].tone}>{STATUS[p.status].text}</Pill>
                    <ChevronRight size={16} className="shrink-0 text-ink-3" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

import { Check } from "lucide-react";
import { notFound } from "next/navigation";
import { FehlerprotokollForm } from "@/components/FehlerprotokollForm";
import { PageHeader, formatDate } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { fehlerprotokoll, fehlerStand } from "@/lib/fehlerprotokoll";
import { RAUS_NACH } from "@/lib/fehlerprotokoll-text";
import { getStudent } from "@/lib/repo";

export const metadata = { title: "Fehlerprotokoll" };

/** Das Fehlerprotokoll eines Schülers (lib/fehlerprotokoll.ts): schreiben und sehen, welche Fehler schon geschafft sind. */
export default async function FehlerprotokollSeite({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ gespeichert?: string }> }) {
  await requireTeacher();
  const { id } = await params;
  const sp = await searchParams;
  const student = getStudent(Number(id));
  if (!student) notFound();
  const first = student.name.split(" ")[0];
  const p = fehlerprotokoll(student.id);
  const stand = fehlerStand(student.id);
  const offen = stand.filter((e) => !e.geschafft);
  const zurueck = `/schueler/${student.id}?tab=uebungen`;
  return (
    <>
      <PageHeader
        title={`Fehlerprotokoll von ${first}`}
        info={`Die Fehler aus den eigenen Texten von ${first}, falsch → richtig. In der Schüler-App ist das Protokoll das Spiel „Meine Fehler“ (auch im Blockwerk und Torlauf), solange Fehler offen sind. Ein Fehler fliegt raus, wenn er ${RAUS_NACH}× hintereinander richtig war. Die App prüft ohne KI, die Runden zählen nicht im Lernstand.`}
        back={{ href: zurueck, label: student.name }}
      />
      {sp.gespeichert && (
        <p className="mb-6 max-w-[900px] rounded-2xl bg-green-wash px-4 py-3 text-[14px] text-green" role="status">
          {offen.length
            ? `Gespeichert. ${first} spielt ${offen.length === 1 ? "den offenen Fehler" : `die ${offen.length} offenen Fehler`} in der Schüler-App unter Spiele › Meine Fehler.`
            : "Gespeichert."}
        </p>
      )}
      {stand.length > 0 && (
        <section className="panel mb-8 max-w-[900px] px-4 py-4" data-testid="fehlerprotokoll-stand">
          <h2 className="text-[15px] font-semibold">
            {offen.length} offen · {stand.length - offen.length} geschafft
            {p && <span className="font-normal text-ink-3"> · geändert am {formatDate(p.updated_at)}</span>}
          </h2>
          <ul className="mt-3 divide-y divide-line">
            {stand.map((e) => (
              <li key={e.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-[14px]" data-geschafft={e.geschafft ? "" : undefined}>
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  <span className={e.geschafft ? "text-ink-3" : "font-medium"}>{e.richtig}</span>
                  <span className="text-ink-3"> · nicht: {e.falsch}</span>
                </span>
                <span className={`shrink-0 text-[13px] ${e.geschafft ? "font-semibold text-green" : "text-ink-2"}`}>
                  {e.geschafft ? (
                    <>
                      <Check size={14} className="mr-1 inline" aria-hidden />
                      geschafft
                    </>
                  ) : e.versuche === 0 ? (
                    "noch nicht gespielt"
                  ) : (
                    `${e.folge}× hintereinander richtig · ${e.treffer} von ${e.versuche}`
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <FehlerprotokollForm studentId={student.id} text={p?.text ?? ""} zurueck={zurueck} />
    </>
  );
}

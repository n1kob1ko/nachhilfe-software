import { Check } from "lucide-react";
import { notFound } from "next/navigation";
import { LernwoerterForm } from "@/components/LernwoerterForm";
import { PageHeader, formatDate } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { GRUNDWORTSCHATZ, lernwoerterListe, lernwoerterVon, lernwortStand, SITZT_NACH } from "@/lib/lernwoerter";
import { leseLernwoerter } from "@/lib/lernwoerter-text";
import { getStudent } from "@/lib/repo";

export const metadata = { title: "Lernwörter" };

/** Die Lernwörter eines Schülers (lib/lernwoerter.ts): die Liste der Klasse eintragen und sehen, welche Wörter sitzen. */
export default async function LernwoerterSeite({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ gespeichert?: string }> }) {
  await requireTeacher();
  const { id } = await params;
  const sp = await searchParams;
  const student = getStudent(Number(id));
  if (!student) notFound();
  const first = student.name.split(" ")[0];
  const liste = lernwoerterListe(student.id);
  const { eintraege, eigene } = lernwoerterVon(student.id);
  const stand = lernwortStand(student.id, eintraege);
  const gespielt = stand.filter((e) => e.versuche > 0);
  const sitzt = stand.filter((e) => e.sitzt).length;
  const zurueck = `/schueler/${student.id}?tab=uebungen`;
  return (
    <>
      <PageHeader
        title={`Lernwörter von ${first}`}
        info={`Die Lernwörter der Klasse von ${first}. In der Schüler-App ist die Liste das Spiel „Lernwörter“: jedes neue Wort steht zuerst da und wird vorgelesen, dann schreibt ${first} es. War es beim letzten Mal richtig, wird es nur noch vorgelesen (wie beim Diktat). Nach ${SITZT_NACH}× hintereinander richtig sitzt es und kommt seltener. Die App prüft jeden Buchstaben, ohne KI.`}
        back={{ href: zurueck, label: student.name }}
      />
      {sp.gespeichert && (
        <p className="mb-6 max-w-[900px] rounded-2xl bg-green-wash px-4 py-3 text-[14px] text-green" role="status">
          {eigene ? `Gespeichert. ${first} übt die ${eintraege.length} Wörter in der Schüler-App unter Spiele › Lernwörter.` : `Gespeichert. Ohne eigene Liste übt ${first} die ${leseLernwoerter(GRUNDWORTSCHATZ).eintraege.length} Wörter der App.`}
        </p>
      )}
      {!eigene && (
        <p className="mb-6 max-w-[900px] rounded-2xl bg-accent-wash px-4 py-3 text-[14px] text-ink-2">
          Noch keine eigene Liste: {first} übt gerade {eintraege.length} häufige Wörter der 3. und 4. Klasse (Fahrrad, vielleicht, Straße …).
        </p>
      )}
      {gespielt.length > 0 && (
        <section className="panel mb-8 max-w-[900px] px-4 py-4" data-testid="lernwoerter-stand">
          <h2 className="text-[15px] font-semibold">
            {sitzt} von {stand.length} sitzen · {gespielt.length} geübt
            {liste && <span className="font-normal text-ink-3"> · geändert am {formatDate(liste.updated_at)}</span>}
          </h2>
          <ul className="mt-3 divide-y divide-line">
            {gespielt.map((e) => (
              <li key={e.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-[14px]">
                <span className={e.sitzt ? "text-ink-3" : "font-medium"}>{e.wort}</span>
                <span className={`shrink-0 text-[13px] ${e.sitzt ? "font-semibold text-green" : e.zuletzt === false ? "text-red" : "text-ink-2"}`}>
                  {e.sitzt ? (
                    <>
                      <Check size={14} className="mr-1 inline" aria-hidden />
                      sitzt
                    </>
                  ) : e.zuletzt === false ? (
                    `zuletzt falsch · ${e.treffer} von ${e.versuche}`
                  ) : (
                    `${e.folge}× hintereinander richtig · ${e.treffer} von ${e.versuche}`
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <LernwoerterForm studentId={student.id} text={liste?.text ?? ""} zurueck={zurueck} />
    </>
  );
}

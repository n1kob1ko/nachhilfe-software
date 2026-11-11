import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import { SeitenKopf } from "@/components/lernen/SeitenKopf";
import { VokabelBalken } from "@/components/lernen/VokabelBalken";
import * as repo from "@/lib/repo";
import { alleListenStand } from "@/lib/vokabel-training";

/** Vokabeln in der Schüler-App: die eigenen Listen mit ihrem Stand; eine antippen und üben (lib/vokabel-training.ts). */
export default async function VokabelnSeite({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const student = repo.getStudentByToken(token);
  if (!student) notFound();
  const listen = alleListenStand(student.id);
  return (
    <>
      <SeitenKopf
        titel="Vokabeln"
        text="Deine Listen. Was du schon kannst, kommt seltener, was schwer ist, öfter."
      />
      {listen.length === 0 ? (
        <p className="panel mt-6 px-5 py-5 text-[16px] text-ink-2">
          Noch keine Vokabelliste. Deine Lehrerin oder dein Lehrer legt sie für
          dich an.
        </p>
      ) : (
        <ul className="mt-6 grid gap-3" data-testid="vokabel-listen">
          {listen.map((l) => (
            <li key={l.id}>
              <Link
                href={`/lernen/${token}/vokabeln/${l.id}`}
                className="panel flex items-center gap-4 px-5 py-4 transition-colors hover:border-accent"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-semibold [overflow-wrap:anywhere]">
                    {l.title}
                  </span>
                  <span className="mt-0.5 block text-[14px] text-ink-2">
                    {l.sitzt} von {l.woerter} sitzen
                    {l.dran > 0 ? ` · ${l.dran} heute dran` : ""}
                  </span>
                  <VokabelBalken stand={l} />
                </span>
                <span className="btn btn-primary">
                  Üben <ChevronRight size={16} aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

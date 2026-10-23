import Link from "next/link";
import { ChevronLeft, Presentation } from "lucide-react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Vortrag } from "@/components/praesentation/Vortrag";
import * as repo from "@/lib/repo";
import { deckEinrichtungsProblem, deckUrl, praesentationsOrigin } from "@/lib/praesentation-host";
import { dateienDa, getPraesentation } from "@/lib/praesentationen";
import { praesentationFreigegeben } from "@/lib/schuelerportal";

/**
 * Eine Präsentation aus „Deine Unterlagen“: nur die Folien, wie in der Schüleransicht des Lehrers (Vortrag ohne
 * `notizen`), der Vortragstext bleibt auf dem Server. Nur Präsentationen aus den Einheiten dieses Schülers
 * (lib/schuelerportal.ts); jede andere id ist 404. Geht das Abspielen auf diesem Server nicht, steht derselbe
 * kurze Satz wie am Schülergerät.
 */
export default async function SchuelerPraesentation({ params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const student = repo.getStudentByToken(token);
  const praesId = Number(id);
  if (!student || !Number.isInteger(praesId) || !praesentationFreigegeben(student.id, praesId)) notFound();
  const p = getPraesentation(praesId);
  if (!p) notFound();
  const h = await headers();
  const problem = deckEinrichtungsProblem(h.get("x-forwarded-host") ?? h.get("host"), h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http"));
  const src = !problem && dateienDa(p) ? deckUrl(p.token, p.start_pfad) : null;
  return (
    <>
      <Link href={`/lernen/${token}`} className="inline-flex min-h-[44px] items-center gap-1 text-[15px] font-medium text-accent">
        <ChevronLeft size={18} aria-hidden /> Zurück
      </Link>
      <h1 className="mt-2 flex items-center gap-2 text-[24px] font-semibold tracking-[-0.01em]">
        <Presentation size={22} className="shrink-0 text-accent" aria-hidden /> {p.title}
      </h1>
      <p className="mt-1 mb-5 text-[15px] text-ink-2">{[p.fach, p.thema].filter(Boolean).join(" · ")}</p>
      {src ? (
        <Vortrag praesId={p.id} title={p.title} src={src} deckOrigin={praesentationsOrigin()} />
      ) : (
        <div className="panel flex flex-col items-center px-6 py-12 text-center" role="status">
          <Presentation size={34} strokeWidth={1.75} className="text-accent" aria-hidden />
          <p className="mt-4 text-[18px] font-semibold">Die Präsentation kann hier gerade nicht angezeigt werden.</p>
        </div>
      )}
    </>
  );
}

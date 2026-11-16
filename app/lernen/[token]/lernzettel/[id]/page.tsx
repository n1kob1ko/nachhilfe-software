import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { LernzettelInhalt } from "@/components/Lernzettel";
import type { Lernzettel } from "@/lib/ai/stoffpaket";
import { db, json } from "@/lib/db";
import * as repo from "@/lib/repo";

/**
 * Ein Lernzettel aus „Deine Unterlagen“ (lib/stoffpaket.ts): nur ein übernommener Zettel dieses Schülers, jede andere id
 * ist 404. Nur der Zettel selbst, nichts von den Lehrerseiten.
 */
export default async function SchuelerLernzettel({ params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const student = repo.getStudentByToken(token);
  const nr = Number(id);
  if (!student || !Number.isInteger(nr)) notFound();
  const r = db().prepare("SELECT lernzettel, fach FROM stoffpakete WHERE id = ? AND student_id = ? AND status = 'uebernommen' AND lernzettel IS NOT NULL").get(nr, student.id) as { lernzettel: string; fach: string } | undefined;
  const z = r ? json<Lernzettel | null>(r.lernzettel, null) : null;
  if (!r || !z) notFound();
  return (
    <>
      <Link href={`/lernen/${token}/pruefungen`} className="inline-flex min-h-[44px] items-center gap-1 text-[15px] font-medium text-accent">
        <ChevronLeft size={18} aria-hidden /> Zurück
      </Link>
      <p className="mt-2 text-[14px] text-ink-2">{r.fach} · Lernzettel</p>
      <article className="panel mt-3 px-5 py-5 text-[16px]">
        <LernzettelInhalt z={z} />
      </article>
    </>
  );
}

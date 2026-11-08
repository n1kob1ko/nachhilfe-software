import Link from "next/link";
import { notFound } from "next/navigation";
import { EinheitAusText } from "@/components/EinheitAusText";
import { LessonForm } from "@/components/LessonForm";
import { PageHeader } from "@/components/ui";
import { einheitTextLesbar, getEntwurf, offenePruefungen } from "@/lib/einheit-aus-text";
import { getStudent } from "@/lib/repo";
import { istDatum, minutenLabel } from "@/lib/planung/zeit";

export default async function NewLesson({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fehler?: string; datum?: string; start?: string; dauer?: string; aus?: string }> }) {
  const { id } = await params;
  const { fehler, datum, start, dauer, aus } = await searchParams;
  const student = getStudent(Number(id));
  if (!student) notFound();
  // „Nachtragen“ zu einem Platz ohne Einheit (lib/heute.ts nachtragenHref): Datum, Uhrzeit und Dauer stehen schon da
  const startMin = Number(start);
  const vorgabe = datum && istDatum(datum) && Number.isInteger(startMin) && startMin >= 0 ? { starts_at: `${datum}T${minutenLabel(startMin)}`, duration_min: Math.max(0, Math.round(Number(dauer))) || 0 } : undefined;
  // Einheit aus Text übernehmen (lib/einheit-aus-text.ts): ein gelesener, noch nicht gespeicherter Entwurf füllt das Formular
  const entwurf = aus ? getEntwurf(Number(aus), student.id) : null;
  const offen = entwurf && !entwurf.lessonId ? entwurf : null;
  const ohneAus = (() => {
    const q = new URLSearchParams();
    if (datum) q.set("datum", datum);
    if (start) q.set("start", start);
    if (dauer) q.set("dauer", dauer);
    return `/schueler/${student.id}/stunden/neu${q.size ? `?${q}` : ""}`;
  })();
  return (
    <>
      <PageHeader title="Einheit nachtragen oder planen" subtitle={student.name} back={{ href: `/schueler/${student.id}?tab=lernverlauf`, label: student.name }} />
      {offen ? (
        <div className="mb-6 rounded-lg bg-accent-wash px-4 py-3 text-[14px] text-accent" data-testid="aus-text-hinweis">
          {offen.entwurf.ohneKi ? "Dein Text steht unten unter „Was wurde gemacht?“." : "Aus deinem Text ausgefüllt. Bitte prüfen, dann speichern."}
          {offen.hinweis && <span className="block text-[13px]">{offen.hinweis}</span>}
          <Link href={ohneAus} className="mt-1 block text-[13px] underline">
            Anderen Text einfügen
          </Link>
        </div>
      ) : (
        <>
          {entwurf?.lessonId && <p className="mb-4 text-[13px] text-ink-3">Dieser Text ist schon als Einheit gespeichert.</p>}
          <EinheitAusText studentId={student.id} vorgabe={{ datum, start, dauer }} ki={einheitTextLesbar(student.id)} />
        </>
      )}
      <LessonForm
        key={offen?.id ?? "leer"}
        fehler={fehler}
        student={student}
        vorgabe={vorgabe}
        entwurf={offen ? { id: offen.id, ...offen.entwurf, pruefungen: offenePruefungen(student.id, offen.entwurf.fach) } : undefined}
      />
    </>
  );
}

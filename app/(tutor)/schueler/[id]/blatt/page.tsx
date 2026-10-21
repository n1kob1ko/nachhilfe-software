import { notFound } from "next/navigation";
import { BlattEinlesen } from "@/components/BlattEinlesen";
import { PageHeader } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { blattLesbar, faehigkeitenFuer } from "@/lib/blatt-einlesen";
import { dayOf } from "@/lib/exams";
import { notenschluessel } from "@/lib/probeschularbeit";
import * as repo from "@/lib/repo";

export const metadata = { title: "Gelöstes Blatt einlesen" };

/**
 * Gelöstes Blatt einlesen (lib/blatt-einlesen.ts): Fotos eines auf Papier gelösten Tests, die KI liest jede
 * Aufgabe, der Lehrer prüft die Vorschau und übernimmt sie ins Profil.
 */
export default async function BlattPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pruefung?: string }> }) {
  await requireTeacher();
  const student = repo.getStudent(Number((await params).id));
  if (!student) notFound();
  const sp = await searchParams;
  const subjects = student.subjects.length ? student.subjects : ["Mathematik"];
  const today = dayOf(new Date());
  // geplante Prüfungen (für eine Probeschularbeit) und die ohne Ergebnis (für das echte Ergebnis)
  const tests = repo
    .listTests(student.id)
    .filter((t) => t.status === "geplant" || (t.status === "geschrieben" && t.grade == null && t.points == null))
    .map((t) => ({ id: t.id, subject: t.subject, date: t.date, label: t.title || `${t.kind} ${t.subject}`, geplant: t.status === "geplant" }));
  const vor = tests.find((t) => t.id === Number(sp.pruefung)) ?? null;
  const faehigkeiten = Object.fromEntries(subjects.map((f) => [f, faehigkeitenFuer(student, f)]));
  const lesbar = blattLesbar();

  return (
    <>
      <PageHeader
        title="Gelöstes Blatt einlesen"
        back={{ href: `/schueler/${student.id}?tab=schule`, label: student.name }}
        info="Für Tests und Probeschularbeiten, die auf Papier gelöst wurden. Die KI liest jede Aufgabe ab und rechnet sie nach. Du prüfst alles, erst dann kommt es ins Profil: in den Lernstand und, bei einer echten Schularbeit, mit Note zu den Prüfungen."
      />
      <BlattEinlesen
        studentId={student.id}
        subjects={subjects}
        today={today}
        tests={tests}
        vorauswahl={vor ? { testId: vor.id, fach: vor.subject } : null}
        faehigkeiten={faehigkeiten}
        grenzen={notenschluessel()}
        kiGrund={lesbar.ok ? null : lesbar.grund}
      />
    </>
  );
}

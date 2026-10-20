import { notFound } from "next/navigation";
import { updateAuftragAction } from "@/app/schreibauftrag-actions";
import { PageHeader } from "@/components/ui";
import { SchreibauftragForm } from "@/components/text/interpretation/SchreibauftragForm";
import { requireTeacher } from "@/lib/auth";
import { SORTEN } from "@/lib/schreibauftrag";
import { auftragSettingsOf } from "@/lib/schreibauftrag-store";
import { textFotoLesbar } from "@/lib/textinterpretation-foto";
import { getText } from "@/lib/texts";

export const metadata = { title: "Text und Auftrag" };

/** Textbeilage, Arbeitsauftrag, Schreibsituation and word target of a Schreibauftrag; the written text is not touched. */
export default async function EditAuftragPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTeacher();
  const text = getText(Number(id));
  const s = text ? auftragSettingsOf(text.id) : null;
  if (!text || !s) notFound();
  const name = text.student_name.split(" ")[0];
  return (
    <div className="max-w-[860px]">
      <PageHeader title="Text und Auftrag" info={`${SORTEN[s.sorte].name} von ${text.student_name}`} back={{ href: `/texte/${text.id}`, label: "Zum Text" }} />
      <SchreibauftragForm
        sorte={s.sorte}
        action={updateAuftragAction.bind(null, text.id)}
        defaults={{ title: s.title, author: s.author, year: s.year, medium: s.medium, kind: s.kind, story: s.story, countBlank: s.countBlank, target: s.target, situation: s.situation, prompt: s.prompt, sourceNote: s.sourceNote }}
        name={name}
        kiLiest={textFotoLesbar().ok}
        studentId={text.student_id}
        submitLabel="Speichern"
        note={`Was ${name} schon geschrieben hat, bleibt erhalten. Ändern sich Zeilen, stimmen Zeilenangaben im Text vielleicht nicht mehr.`}
      />
    </div>
  );
}

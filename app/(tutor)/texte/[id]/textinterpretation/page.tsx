import { notFound } from "next/navigation";
import { updateInterpretationAction } from "@/app/textinterpretation-actions";
import { PageHeader } from "@/components/ui";
import { InterpretationForm } from "@/components/text/interpretation/InterpretationForm";
import { requireTeacher } from "@/lib/auth";
import { settingsOf } from "@/lib/textinterpretation-store";
import { textFotoLesbar } from "@/lib/textinterpretation-foto";
import { getText } from "@/lib/texts";

export const metadata = { title: "Text und Auftrag" };

/** Story, Arbeitsauftrag and word target of a Textinterpretation; the written text is not touched. */
export default async function EditInterpretationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTeacher();
  const text = getText(Number(id));
  const s = text ? settingsOf(text.id) : null;
  if (!text || !s) notFound();
  const name = text.student_name.split(" ")[0];
  return (
    <div className="max-w-[860px]">
      <PageHeader title="Text und Auftrag" info={`Textinterpretation von ${text.student_name}`} back={{ href: `/texte/${text.id}`, label: "Zum Text" }} />
      <InterpretationForm
        action={updateInterpretationAction.bind(null, text.id)}
        defaults={{ title: s.title, author: s.author, year: s.year, kind: s.kind, story: s.story, countBlank: s.countBlank, target: s.target, prompt: s.prompt, sourceNote: s.sourceNote }}
        name={name}
        kiLiest={textFotoLesbar().ok}
        studentId={text.student_id}
        submitLabel="Speichern"
        note={`Was ${name} schon geschrieben hat, bleibt erhalten. Ändern sich Zeilen, stimmen Zeilenangaben im Text vielleicht nicht mehr.`}
      />
    </div>
  );
}

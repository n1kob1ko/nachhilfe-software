import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { PictureStoryForm } from "@/components/text/story/PictureStoryForm";
import { requireTeacher } from "@/lib/auth";
import { SUBJECTS } from "@/lib/curriculum";
import { getPictureStory, LINE_CHOICES, SOURCE_KINDS, storyImages } from "@/lib/picture-story";
import { getText } from "@/lib/texts";

export const metadata = { title: "Bildgeschichte bearbeiten" };

/** Pictures and settings of an existing Bildgeschichte; the written text is not touched. */
export default async function EditPictureStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTeacher();
  const text = getText(Number(id));
  if (!text) notFound();
  const story = getPictureStory(text.id);
  if (!story) redirect(`/texte/${text.id}`);
  const images = storyImages(text.id);
  return (
    <div className="max-w-[980px]">
      <PageHeader title={`Bilder und Aufgabe: ${text.title}`} subtitle={`${text.student_name} · Der geschriebene Text bleibt unverändert.`} back={{ href: `/texte/${text.id}`, label: "Zur Bildgeschichte" }} />
      <PictureStoryForm
        action={`/material/bildgeschichte/${text.id}`}
        defaults={{
          title: text.title,
          subject: text.subject,
          prompt: text.prompt,
          schoolType: story.school_type,
          klasse: story.klasse,
          targetWords: story.target_words,
          starters: story.starters,
          hints: story.hints,
          lines: story.lines,
          sourceKind: story.source_kind,
          sourceNote: story.source_note,
        }}
        images={images.map((i) => ({ id: i.id, url: `/material/bildgeschichte/bild/${i.id}`, caption: i.caption, name: i.file_name, size: i.size }))}
        subjects={[...SUBJECTS]}
        lineChoices={LINE_CHOICES}
        sourceKinds={SOURCE_KINDS}
        name={text.student_name.split(" ")[0]}
        submitLabel="Änderungen speichern"
        cancelHref={`/texte/${text.id}`}
      />
    </div>
  );
}

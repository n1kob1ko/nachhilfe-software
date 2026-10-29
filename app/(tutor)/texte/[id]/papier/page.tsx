import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { HandschriftEinlesen } from "@/components/text/HandschriftEinlesen";
import { requireTeacher } from "@/lib/auth";
import { handschriftLesbar, kostenSchaetzung } from "@/lib/handschrift";
import { einheitFuerKeinName, keinNameBestaetigt } from "@/lib/kein-name";
import { plainText } from "@/lib/text-doc";
import { getText, textDoc } from "@/lib/texts";

export const metadata = { title: "Vom Foto übernehmen" };

/**
 * Handgeschriebenen Text einlesen (lib/handschrift.ts): a text the student wrote on paper. Photos on one side, the
 * text on the other; the KI writes it down word for word, or the teacher types it. Saved only on „Als Text übernehmen“.
 * `einheit`: opened from the running unit (Textarbeit line); „kein Name“ then counts once for that unit (lib/kein-name.ts).
 */
export default async function VonPapierPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ einheit?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const teacher = await requireTeacher();
  const text = getText(Number(id));
  if (!text) notFound();
  const unit = einheitFuerKeinName(Number(sp.einheit) || null, text.student_id, teacher);
  const lesbar = handschriftLesbar(text.student_id);
  const name = text.student_name.split(" ")[0];
  return (
    <div className="max-w-[1240px]">
      <PageHeader
        title="Vom Foto übernehmen"
        subtitle={[text.topic && text.topic !== text.title ? `${text.topic}: ${text.title}` : text.title, text.student_name].join(" · ")}
        back={{ href: `/texte/${text.id}`, label: "Zur Textarbeit" }}
        info={`Für Texte, die ${name} auf Papier geschrieben hat. Die KI schreibt den Text wortgetreu ab, mit allen Fehlern, und verbessert nichts. Du vergleichst ihn mit dem Foto und übernimmst ihn. Danach korrigierst du ihn wie jeden Text.`}
      />
      <HandschriftEinlesen
        textId={text.id}
        name={name}
        kiGrund={lesbar.ok ? null : lesbar.grund}
        kosten={kostenSchaetzung()}
        vorhanden={{ text: plainText(textDoc(text)), words: text.words }}
        fertig={text.status === "fertig"}
        einheit={unit ? { unitId: unit.id, keinName: keinNameBestaetigt(unit) } : null}
      />
    </div>
  );
}

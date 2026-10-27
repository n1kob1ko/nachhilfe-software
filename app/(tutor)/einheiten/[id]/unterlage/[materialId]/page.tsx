import { notFound, redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { canManageUnit, getUnit } from "@/lib/units";
import { gezeigteUnterlage } from "@/lib/unterlagen-unterricht";

export const metadata = { title: "Unterlage" };

/**
 * Eine Unterlage aus dem Schritt, ruhig und nur zum Lesen (lib/unterlagen-unterricht.ts `gezeigteUnterlage`): das Foto groß oder das
 * PDF eingebettet, der Titel wie im Schritt und „← Unterricht“. Kein Formular, kein Löschen; die Datei kommt über die Route nur für
 * Lehrer (/material/[id]/datei).
 */
export default async function UnterlagePage({ params }: { params: Promise<{ id: string; materialId: string }> }) {
  const { id, materialId } = await params;
  const teacher = await requireTeacher();
  const unit = getUnit(Number(id));
  if (!unit) notFound();
  if (!canManageUnit(teacher, unit)) redirect(`/einheiten/${unit.id}?fremd=1`);
  const u = gezeigteUnterlage(unit.id, Number(materialId));
  if (!u) notFound();
  const datei = `/material/${u.materialId}/datei`;
  return (
    <div className="max-w-[960px]">
      <PageHeader back={{ href: `/einheiten/${unit.id}#praesentation-schritt`, label: "Unterricht" }} title={u.titel} subtitle={u.art} />
      <div className="overflow-hidden rounded-[20px] border border-line bg-paper" data-testid="unterlage-ansicht">
        {u.art === "PDF" ? (
          <iframe src={datei} title={u.titel} className="h-[75vh] min-h-[420px] w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- the teacher-only file route, no optimiser
          <img src={datei} alt={u.titel} className="max-h-[80vh] w-full object-contain" />
        )}
      </div>
      {u.art === "PDF" && (
        <a href={datei} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm mt-2">
          <ExternalLink size={15} aria-hidden /> In neuem Tab öffnen
        </a>
      )}
    </div>
  );
}

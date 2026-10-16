import { LesetabelleGenerator } from "@/components/druckblatt/LesetabelleGenerator";
import { PageHeader } from "@/components/ui";
import { aiEnabled } from "@/lib/ai";
import { requireTeacher } from "@/lib/auth";
import { ladeDruckblatt } from "@/lib/materials";
import * as repo from "@/lib/repo";

export const metadata = { title: "Lesetabelle" };

type Params = { blatt?: string; gespeichert?: string; fehler?: string };

/**
 * Die Lesetabelle: Einstellungen links, Vorschau rechts, Drucken oben.
 *
 * Die Seite selbst ist eine Server-Komponente (nur so trägt sie einen Titel und liest das gespeicherte
 * Blatt); die Arbeit steckt in `LesetabelleGenerator` — dieselbe Aufteilung wie bei den
 * Übungs-Buildern dieses Repos.
 *
 * `?blatt=<id>` öffnet ein gespeichertes **Druckblatt** (D21): Die Definition wird hier, auf dem
 * Server, mit `ladeDruckblatt` geprüft bzw. mit den Vorgaben ergänzt und erst dann an den Generator
 * übergeben. Ein kaputter oder alter Stand führt zu einem Hinweis, nie zu einer leeren Seite.
 */
export default async function LesetabellePage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireTeacher();
  const sp = await searchParams;
  const id = Number(sp.blatt) || 0;
  const geladen = id ? ladeDruckblatt(id, "lesetabelle") : null;
  const studenten = repo.listStudents().map((s) => ({ id: s.id, name: s.name }));
  const fuer = geladen?.ok && geladen.material.student_id ? (studenten.find((s) => s.id === geladen.material.student_id)?.name ?? null) : null;

  return (
    <>
      <PageHeader
        title="Lesetabelle"
        subtitle="Silben oder Wörter in einem gleichmäßigen Raster, laut zu lesen"
        back={{ href: "/blaetter", label: "Blätter erstellen" }}
        info={
          <>
            Eine Silbenmatrix kombiniert Anlaute mit Vokalen; die Leserichtung bestimmt, was geübt wird.
            Eine eigene Wortliste wird Zeile für Zeile übernommen. Die Silbenfarben zeigen die
            Silbengrenzen — zwei Farben im Wechsel, nach dem Silbenbogen-Prinzip.
          </>
        }
      />
      <LesetabelleGenerator
        blatt={geladen?.ok ? { id: geladen.material.id, definition: geladen.definition, hinweis: geladen.hinweis } : undefined}
        studenten={studenten}
        kiVerfuegbar={aiEnabled("druckblatt")}
        gespeichert={sp.gespeichert === "zuweisen" ? "zuweisen" : sp.gespeichert === "vorlage" ? "vorlage" : null}
        gespeichertFuer={fuer}
        fehler={geladen && !geladen.ok ? geladen.fehler : (sp.fehler ?? null)}
      />
    </>
  );
}

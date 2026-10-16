import { NachmalblattGenerator } from "@/components/druckblatt/NachmalblattGenerator";
import { PageHeader } from "@/components/ui";
import { aiEnabled } from "@/lib/ai";
import { requireTeacher } from "@/lib/auth";
import { ladeDruckblatt } from "@/lib/materials";
import * as repo from "@/lib/repo";

export const metadata = { title: "Nachmalblatt" };

type Params = { blatt?: string; gespeichert?: string; fehler?: string };

/**
 * Das Nachmalblatt: Buchstaben, Silben oder Wörter zum Nachspuren.
 *
 * Die abnehmende Hilfe ist der Kern: Vorne steht die Vorlage kräftig, dann wird sie
 * blasser, hinten ist die Zeile leer. So löst sich das Kind beim Schreiben von der
 * Vorlage, statt bis zum Rand nachzufahren.
 *
 * `?blatt=<id>` öffnet ein gespeichertes Druckblatt (D21); geprüft und bei einem
 * alten Stand ergänzt wird es auf dem Server (`ladeDruckblatt`).
 */
export default async function NachmalblattPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireTeacher();
  const sp = await searchParams;
  const id = Number(sp.blatt) || 0;
  const geladen = id ? ladeDruckblatt(id, "nachmalblatt") : null;
  const studenten = repo.listStudents().map((s) => ({ id: s.id, name: s.name }));
  const fuer = geladen?.ok && geladen.material.student_id ? (studenten.find((s) => s.id === geladen.material.student_id)?.name ?? null) : null;

  return (
    <>
      <PageHeader
        title="Nachmalblatt"
        subtitle="Buchstaben, Silben oder Wörter nachspuren — mit abnehmender Hilfe"
        back={{ href: "/blaetter", label: "Blätter erstellen" }}
        info={
          <>
            Zwei Einstellungen bestimmen das Blatt: die <b>Lineatur</b> (DIN 16552-1) und die{" "}
            <b>Schulschrift</b>. Aus dem Mittelband der Lineatur wird die Schriftgröße gerechnet, damit
            ein Kleinbuchstabe genau zwischen Mittel- und Grundlinie sitzt. Fehlt eine Schriftdatei,
            sagt die App das und druckt die Druckschrift — still ersetzen wäre hier besonders heikel,
            weil das Kind genau diese Formen nachmalen soll.
          </>
        }
      />
      <NachmalblattGenerator
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

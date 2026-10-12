import { SatzbaukastenGenerator } from "@/components/druckblatt/SatzbaukastenGenerator";
import { PageHeader } from "@/components/ui";
import { aiEnabled } from "@/lib/ai";
import { requireTeacher } from "@/lib/auth";
import { ladeDruckblatt } from "@/lib/materials";
import * as repo from "@/lib/repo";

export const metadata = { title: "Satzbaukasten" };

type Params = { blatt?: string; gespeichert?: string; fehler?: string };

/**
 * Der Satzbaukasten: Spalten mit Wörtern, darunter Zeilen zum Aufschreiben.
 *
 * Ausdrücklich nicht die Satzbau-Aufgaben der **Schnellrunde**: Das eine ist ein
 * Blatt zum Ausdrucken, das andere eine Übung am Bildschirm (CONTEXT.md).
 *
 * `?blatt=<id>` öffnet ein gespeichertes Druckblatt (D21); geprüft und bei einem
 * alten Stand ergänzt wird es auf dem Server (`ladeDruckblatt`).
 */
export default async function SatzbaukastenPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireTeacher();
  const sp = await searchParams;
  const id = Number(sp.blatt) || 0;
  const geladen = id ? ladeDruckblatt(id, "satzbaukasten") : null;
  const studenten = repo.listStudents().map((s) => ({ id: s.id, name: s.name }));
  const fuer = geladen?.ok && geladen.material.student_id ? (studenten.find((s) => s.id === geladen.material.student_id)?.name ?? null) : null;

  return (
    <>
      <PageHeader
        title="Satzbaukasten"
        subtitle="Spalten mit Wörtern oder Satzteilen, aus denen Sätze gebaut werden"
        back={{ href: "/blaetter", label: "Blätter erstellen" }}
        info={
          <>
            Der Reiz dieser Übung ist das Kreuzprodukt: drei Verben und sechs Objekte ergeben achtzehn
            Sätze. Die Spalten dürfen deshalb unterschiedlich lang sein. Bei den Nomen tippt man das
            Geschlecht mit („der Hund“) — welcher Artikel daraus wird, rechnet die App aus Fall und
            Artikelart, und sie meldet, was sie nicht sicher weiß.
          </>
        }
      />
      <SatzbaukastenGenerator
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

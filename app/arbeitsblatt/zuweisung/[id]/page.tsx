import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlattDokument } from "@/components/arbeitsblatt/Mappe";
import { MappeSettings } from "@/components/arbeitsblatt/MappeSettings";
import { PageStyle } from "@/components/arbeitsblatt/Sheet";
import { requireTeacher } from "@/lib/auth";
import { blattFuerZuweisung, blattTitel } from "@/lib/blatt-druck";
import { BLATT_STANDARD, leseMappeOptionen } from "@/lib/mappe-druck";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const b = blattFuerZuweisung(Number((await params).id));
  if (!b) return { title: { absolute: "Ausgefülltes Blatt" } };
  // der Titel wird beim Speichern als PDF zum Dateinamen
  return { title: { absolute: `${leseMappeOptionen(await searchParams, blattTitel(b), BLATT_STANDARD).title} – ${b.student.name}` } };
}

/** Ein gesendetes Blatt, wie der Schüler es ausgefüllt hat: Antworten, Häkchen und Kreuze, Lösungen, Punkte und Note. */
export default async function AusgefuelltesBlattPage({ params, searchParams }: Params) {
  await requireTeacher();
  const b = blattFuerZuweisung(Number((await params).id));
  if (!b) notFound();
  const defaultTitle = blattTitel(b);
  const o = leseMappeOptionen(await searchParams, defaultTitle, BLATT_STANDARD);
  const u = b.uebung;
  return (
    <div className="ab-screen">
      <PageStyle o={o} />
      <MappeSettings
        options={o}
        defaultTitle={defaultTitle}
        path={`/arbeitsblatt/zuweisung/${b.assignment.id}`}
        back={{ href: `/schueler/${b.student.id}/ergebnis/${b.assignment.id}`, label: "Zum Ergebnis" }}
        inhalt={{ uebungen: 1, aufgaben: u.bearbeitet, offen: u.aufgaben.length - u.bearbeitet, texte: 0, tafel: 0 }}
        standard={BLATT_STANDARD}
        ueberschrift="Ausgefülltes Blatt drucken"
      />
      <main className="ab-preview">
        {u.bearbeitet > 0 || o.open ? (
          <BlattDokument b={b} o={o} />
        ) : (
          <p className="ab-empty no-print">Auf diesem Blatt hat {b.student.name.split(" ")[0]} noch nichts beantwortet.</p>
        )}
        <p className="ab-hint no-print">Seitenumbrüche zeigt die Druckvorschau. Keine Aufgabe wird zwischen zwei Seiten geteilt.</p>
      </main>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MappeDokument } from "@/components/arbeitsblatt/Mappe";
import { MappeSettings } from "@/components/arbeitsblatt/MappeSettings";
import { PageStyle } from "@/components/arbeitsblatt/Sheet";
import { requireTeacher } from "@/lib/auth";
import { mappeFuerEinheit, mappeHatInhalt, mappeTitel } from "@/lib/mappe";
import { leseMappeOptionen } from "@/lib/mappe-druck";
import { getUnit } from "@/lib/units";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const unit = getUnit(Number((await params).id));
  if (!unit) return { title: { absolute: "Mappe" } };
  // der Titel wird beim Speichern als PDF zum Dateinamen; mit Namen, weil jeder Schüler seine Mappe hat
  return { title: { absolute: `${leseMappeOptionen(await searchParams, mappeTitel(unit)).title} – ${unit.student_name}` } };
}

/** Alles aus einer Einheit für die Schulmappe: die Übungen mit den Antworten, die Texte und das Whiteboard. */
export default async function MappePage({ params, searchParams }: Params) {
  await requireTeacher();
  const m = mappeFuerEinheit(Number((await params).id));
  if (!m) notFound();
  const defaultTitle = mappeTitel(m.unit);
  const o = leseMappeOptionen(await searchParams, defaultTitle);
  const offen = m.uebungen.reduce((s, u) => s + u.aufgaben.length - u.bearbeitet, 0) + m.unbearbeitet.reduce((s, u) => s + u.aufgaben.length, 0);
  return (
    <div className="ab-screen">
      <PageStyle o={o} />
      <MappeSettings
        options={o}
        defaultTitle={defaultTitle}
        path={`/arbeitsblatt/einheit/${m.unit.id}`}
        back={{ href: `/einheiten/${m.unit.id}`, label: "Zur Einheit" }}
        inhalt={{ uebungen: m.uebungen.length, aufgaben: m.uebungen.reduce((s, u) => s + u.bearbeitet, 0), offen, texte: m.texte.length, tafel: m.tafel.length }}
      />
      <main className="ab-preview">
        {mappeHatInhalt(m) || (o.open && m.unbearbeitet.length > 0) ? (
          <MappeDokument m={m} o={o} />
        ) : (
          <p className="ab-empty no-print">In dieser Einheit ist nichts am Gerät entstanden: keine Übung, kein Text und nichts am Whiteboard.</p>
        )}
        <p className="ab-hint no-print">Seitenumbrüche zeigt die Druckvorschau. Keine Aufgabe wird zwischen zwei Seiten geteilt.</p>
      </main>
    </div>
  );
}

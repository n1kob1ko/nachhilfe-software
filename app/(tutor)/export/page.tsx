import { DatabaseBackup, Download, FileSpreadsheet } from "lucide-react";
import { Info } from "@/components/Info";
import { PageHeader, SectionTitle } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { backupCounts, exportBackup } from "@/lib/backup";
import { DATASETS } from "@/lib/exports";
import { flushBoard } from "@/lib/whiteboard";

export const metadata = { title: "Datenexport" };

const TABLE_LABEL: Record<string, string> = {
  teachers: "Lehrer",
  students: "Schüler",
  skills: "Fähigkeiten",
  worksheets: "Übungen",
  tasks: "Aufgaben",
  assignments: "Zugewiesene Übungen",
  units: "Einheiten",
  lessons: "Einheiten und Dokumentationen",
  attempts: "Antworten",
  homework: "Hausübungen",
  tests: "Schularbeiten und Tests",
  skill_snapshots: "Fortschritt pro Einheit",
};

export default async function ExportPage() {
  await requireAdmin();
  flushBoard(); // whiteboard strokes are written to the database a moment after drawing
  const counts = backupCounts(exportBackup());
  return (
    <>
      <PageHeader title="Datenexport" subtitle="Sicherung und Tabellen" info="Sicherung und Tabellen zum Weiterverarbeiten. Nur für die Verwaltung sichtbar." />

      <section className="mb-10">
        <SectionTitle>Vollständige Sicherung (JSON)</SectionTitle>
        <div className="panel grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-start md:p-6">
          <div className="max-w-[70ch] text-[14px] text-ink-2">
            <p>
              Enthält jede Tabelle mit allen Spalten und Einträgen, so wie sie in der Datenbank stehen. Die Datei ist so aufgebaut, dass sie in eine leere Lernheft-Datenbank wieder eingespielt werden kann.
            </p>
            <p className="mt-2">
              Nicht enthalten sind Passwörter und Anmeldesitzungen. Nach einer Wiederherstellung meldet sich jeder Lehrer mit dem Startpasswort an und wählt ein neues.
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-[13px] sm:grid-cols-3">
              {Object.entries(counts).map(([t, c]) => (
                <div key={t} className="flex justify-between gap-3 border-b border-line py-1">
                  <dt>{TABLE_LABEL[t] ?? t}</dt>
                  <dd className="num font-semibold text-ink">{c}</dd>
                </div>
              ))}
            </dl>
          </div>
          <a href="/export/backup.json" className="btn btn-primary" download>
            <DatabaseBackup size={15} aria-hidden /> Sicherung herunterladen
          </a>
        </div>
      </section>

      <section>
        <SectionTitle>
          <span>
            Tabellen (CSV für Excel)
            <Info label="Info zum Format">Mit Semikolon getrennt und mit Umlauten, damit Excel sie direkt richtig öffnet.</Info>
          </span>
        </SectionTitle>
        <ul className="panel divide-y divide-line">
          {DATASETS.map((d) => (
            <li key={d.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-5">
              <FileSpreadsheet size={18} className="shrink-0 text-ink-3" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{d.label}</div>
                <div className="text-[13px] text-ink-2">{d.description}</div>
              </div>
              <a href={`/export/${d.key}.csv`} className="btn btn-secondary btn-sm" download>
                <Download size={14} aria-hidden /> CSV
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

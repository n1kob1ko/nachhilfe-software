import { DatabaseBackup, Download, FileSpreadsheet } from "lucide-react";
import { cancelRestoreAction } from "@/app/sicherung-actions";
import { Info } from "@/components/Info";
import { BackupNowForm, StageRestoreForm } from "@/components/Sicherungen";
import { PageHeader, Reveal, SectionTitle } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { backupCounts, exportBackup } from "@/lib/backup";
import { DATASETS } from "@/lib/exports";
import { backupKeep, listBackups, pendingRestore } from "@/lib/sicherungen";
import { appBackupPaths } from "@/lib/sicherungen-app";
import { flushBoard } from "@/lib/whiteboard";

const when = (iso: string) =>
  new Date(iso).toLocaleString("de-AT", { timeZone: "Europe/Vienna", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const size = (bytes: number) => (bytes < 1_000_000 ? `${Math.max(1, Math.round(bytes / 1000))} KB` : `${(bytes / 1_000_000).toFixed(1).replace(".", ",")} MB`);
const backupLabel = (name: string) => {
  const m = name.match(/^sicherung-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z/);
  return m ? when(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`) : name;
};

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
  const paths = appBackupPaths();
  const backups = listBackups(paths.backupDir);
  const pending = pendingRestore(paths.dbFile);
  return (
    <>
      <PageHeader title="Datenexport" subtitle="Sicherung und Tabellen" info="Sicherung und Tabellen zum Weiterverarbeiten. Nur für die Verwaltung sichtbar." />

      <section className="mb-10" aria-label="Automatische Sicherungen">
        <SectionTitle>
          <span>
            Automatische Sicherungen
            <Info label="Info zu Sicherungen">
              Einmal am Tag werden Datenbank und Material auf dem Server gesichert, die letzten {backupKeep()} bleiben. Sie liegen auf demselben Speicher wie die Daten und helfen bei Fehlern, nicht bei einem Ausfall des Speichers. Dafür die Volume-Backups von Railway einschalten und ab und zu die JSON-Sicherung herunterladen.
            </Info>
          </span>
        </SectionTitle>
        {pending && (
          <div role="alert" className="mb-4 rounded-2xl bg-amber-wash px-4 py-3">
            <p className="text-[15px] font-semibold">Wiederherstellung vorgemerkt: Sicherung vom {backupLabel(pending)}</p>
            <p className="mt-1 text-[14px] text-ink-2">
              Sie wird beim nächsten Neustart eingespielt. In Railway den Dienst neu starten (Restart). Der jetzige Stand wird vorher beiseitegelegt.
            </p>
            <form action={cancelRestoreAction} className="mt-2">
              <button className="btn btn-secondary btn-sm">Vormerkung aufheben</button>
            </form>
          </div>
        )}
        <div className="panel p-5 md:p-6">
          <BackupNowForm />
          {backups.length ? (
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {backups.map((b) => (
                <li key={b.name} className="py-3">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="font-semibold">{when(b.createdAt)}</span>
                    <span className="text-[13px] text-ink-2">
                      {b.counts.students ?? 0} Schüler · {b.counts.units ?? 0} {b.counts.units === 1 ? "Einheit" : "Einheiten"} · {b.files} {b.files === 1 ? "Datei" : "Dateien"} · {size(b.dbBytes + b.uploadBytes)}
                    </span>
                  </div>
                  <Reveal label="Wiederherstellen" className="mt-1">
                    <p className="mb-2 max-w-[70ch] text-[14px] text-ink-2">
                      Ersetzt beim nächsten Neustart alle Daten und das Material durch diesen Stand. Alles, was danach eingetragen wurde, liegt dann nur noch im beiseitegelegten Stand.
                    </p>
                    <StageRestoreForm name={b.name} />
                  </Reveal>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[14px] text-ink-2">Noch keine Sicherung. Die erste entsteht kurz nach dem Start des Servers.</p>
          )}
        </div>
      </section>

      <section className="mb-10">
        <SectionTitle>Vollständige Sicherung (JSON)</SectionTitle>
        <div className="panel grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-start md:p-6">
          <div className="max-w-[70ch] text-[14px] text-ink-2">
            <p>
              Enthält jede Tabelle mit allen Spalten und Einträgen, so wie sie in der Datenbank stehen. Die Datei ist so aufgebaut, dass sie in eine leere Lernheft-Datenbank wieder eingespielt werden kann.
            </p>
            <p className="mt-2">
              Nicht enthalten sind Passwörter und Anmeldesitzungen. Nach einer Wiederherstellung aus dieser Datei bekommt jeder Lehrer ein neues Startpasswort (siehe docs/betrieb.md).
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

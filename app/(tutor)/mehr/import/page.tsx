import Link from "next/link";
import { Download, ShieldCheck } from "lucide-react";
import { ImportForm } from "@/components/ImportForm";
import { PageHeader, SectionTitle } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { IMPORT_ARTEN } from "@/lib/csv-import";

export const metadata = { title: "Import" };

/**
 * Mehr › Import (Phase 7, D14): Schüler und Lehrer aus einer CSV-Datei übernehmen — im Format des
 * Datenexports, nur für die Verwaltung (D23). Zwei Schritte: erst die Vorschau mit den Fehlern
 * jeder Zeile und den Dubletten, dann die Bestätigung; vorher wird nichts geschrieben.
 */
export default async function ImportPage() {
  const schueler = IMPORT_ARTEN.find((a) => a.art === "schueler")!;
  const lehrer = IMPORT_ARTEN.find((a) => a.art === "lehrer")!;
  return (
    <>
      <PageHeader
        title="Import"
        back={{ href: "/mehr", label: "Mehr" }}
        info="Schüler und Lehrer aus einer CSV-Datei übernehmen. Zuerst wird geprüft und angezeigt, was passieren würde; geschrieben wird erst nach dem Bestätigen — und nur, wenn keine Zeile einen Fehler hat."
      />

      <p className="mb-8 max-w-[80ch] text-[14px] text-ink-2">
        Die Datei hat denselben Aufbau wie der Datenexport (Semikolon, erste Zeile = Spaltennamen, UTF-8 mit oder ohne BOM, auch aus Excel).
        Die Spalten werden über ihre <span className="font-semibold text-ink">Namen</span> gelesen, ihre Reihenfolge ist gleichgültig; unbekannte Spalten
        werden übergangen. Eine Zelle, die mit <span className="num">=</span>, <span className="num">+</span>, <span className="num">-</span> oder{" "}
        <span className="num">@</span> beginnt, bleibt Text und wird nie als Formel ausgeführt. Unter{" "}
        <Link href="/export" className="underline underline-offset-2">
          Datenexport
        </Link>{" "}
        lässt sich der aktuelle Stand als Vorlage herunterladen.
      </p>

      <section className="mb-10">
        <SectionTitle
          action={
            <a href="/export/schueler.csv" className="btn btn-ghost btn-sm" download>
              <Download size={14} aria-hidden /> Vorlage (aktueller Stand)
            </a>
          }
        >
          {schueler.label}
        </SectionTitle>
        <p className="mb-3 max-w-[80ch] text-[13.5px] text-ink-2">
          Gelesen werden: <span className="font-semibold text-ink">Name</span>, <span className="font-semibold text-ink">Schultyp</span>,{" "}
          <span className="font-semibold text-ink">Klasse</span> (die drei sind Pflicht), Schule, Fächer (mit Komma getrennt), Aktuelle Themen, Stärken,
          Schwächen, Ziele, Notizen, KI-Hinweise, <span className="font-semibold text-ink">Lehrer</span> (der <em>Benutzername</em>, z. B. „niko“),
          Einheiten pro Woche (0–40), Geplante Dauer (1–300) und Modus („vor Ort“, „online“ oder „egal“). Fehlt eine der Planungsspalten, gelten die
          Vorgaben der App (0, 100 min, egal). Die Schulstufe wird aus Schultyp und Klasse gerechnet, ein bereits vorhandener Schüler (gleicher Name{" "}
          <em>und</em> gleiche Klasse) wird übersprungen. Jeder neue Schüler bekommt einen frischen geheimen Link.
        </p>
        <ImportForm
          art="schueler"
          label="Schüler"
          hinweis={schueler.hinweis}
          beispiel="Name;Schultyp;Klasse;Schule;Fächer;Lehrer"
        />
      </section>

      <section>
        <SectionTitle
          action={
            <a href="/export/lehrer.csv" className="btn btn-ghost btn-sm" download>
              <Download size={14} aria-hidden /> Vorlage (aktueller Stand)
            </a>
          }
        >
          {lehrer.label}
        </SectionTitle>
        <p className="mb-3 max-w-[80ch] text-[13.5px] text-ink-2">
          Gelesen werden: <span className="font-semibold text-ink">Name</span> und <span className="font-semibold text-ink">Benutzername</span> (Pflicht)
          sowie Verwaltung (ja/nein) und Aktiv (ja/nein). Gibt es den Namen oder den Benutzernamen schon, wird die Zeile übersprungen — ein bestehendes
          Konto wird nie überschrieben.
        </p>
        <p className="mb-3 flex max-w-[80ch] items-start gap-2 rounded-2xl bg-amber-wash px-4 py-3 text-[13.5px]">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-amber" aria-hidden />
          <span>
            Ein neuer Lehrer bekommt das <span className="font-semibold">Startpasswort der Installation</span> (das Passwort aus{" "}
            <span className="num">INITIAL_TEACHER_PASSWORD</span>, sonst das öffentliche „lernheft“). Es steht nirgends im Klartext in der Datenbank und
            muss beim ersten Anmelden geändert werden — sag es der Person weiter.
          </span>
        </p>
        <ImportForm art="lehrer" label="Lehrer" hinweis={lehrer.hinweis} beispiel="Name;Benutzername;Verwaltung" />
      </section>
    </>
  );
}

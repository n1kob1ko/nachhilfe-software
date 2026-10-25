import Link from "next/link";
import {
  BarChart3,
  BookMarked,
  BookOpen,
  BookOpenCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  ClipboardList,
  Clock3,
  Coins,
  DoorOpen,
  Download,
  FileText,
  FileUp,
  FolderUp,
  GitBranch,
  KeyRound,
  Landmark,
  Library,
  ListChecks,
  ListTodo,
  LogOut,
  MessageSquarePlus,
  MonitorPlay,
  Package,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TabletSmartphone,
  Users,
} from "lucide-react";
import { logoutAction } from "@/app/session-actions";
import { Avatar } from "@/components/Art";
import { PageHeader } from "@/components/ui";
import { aiEnabled } from "@/lib/ai";
import { requireTeacher } from "@/lib/auth";
import { feedbackZahlen } from "@/lib/feedback";
import { wienerDatum } from "@/lib/planung/zeit";
import { VORAUS_TAGE } from "@/lib/vorbereitung-auto";
import { zuErledigen } from "@/lib/zu-erledigen";

export const metadata = { title: "Erweitert" };

/**
 * **Erweitert**: alles außer Heute, Unterricht und Abschluss (niko, 25.10.2026: „Alles andere kommt nach Erweitert und
 * wird nie gelöscht“). Oben „Arbeit“ mit dem, was früher eigene Einträge der Navigation oder Teil der Startseite war:
 * Schüler, Übungen, Abrechnung, Planung, Meine Woche, Zu erledigen und die Vorbereitung der nächsten Tage (die drei
 * letzten auf Erweitert › Übersicht, `/mehr/uebersicht`). Darunter wie bisher die Gruppen von „Mehr“.
 */
export default async function MorePage() {
  const teacher = await requireTeacher();
  const offenesFeedback = feedbackZahlen(teacher.is_admin ? undefined : teacher.id).offen;
  const offen = zuErledigen(teacher.id, wienerDatum()).offen.length;
  const groups: { title: string; items: { href: string; label: string; hint: string; icon: typeof Clock3 }[] }[] = [
    {
      title: "Arbeit",
      items: [
        { href: "/schueler", label: "Schüler", hint: "Profile, Lernstand, Lernverlauf, Prüfungen und Stoff", icon: Users },
        { href: "/uebungen", label: "Übungen", hint: "Übungen erstellen, prüfen, freigeben und zuweisen", icon: BookOpenCheck },
        { href: "/abrechnung", label: "Abrechnung", hint: "Stattgefundene Einheiten pro Monat, auch als CSV", icon: ReceiptText },
        { href: "/planung", label: "Planung", hint: "Wochenplan: generieren, verschieben, sperren, veröffentlichen und drucken", icon: CalendarDays },
        { href: "/mehr/uebersicht?tab=woche", label: "Meine Woche", hint: "Deine veröffentlichte Woche und Terminanfragen", icon: CalendarRange },
        { href: "/mehr/uebersicht#offen", label: "Zu erledigen", hint: offen ? `${offen} offen: Prüfungen, Ergebnisse, Hausübungen, Texte` : "Nichts offen. Prüfungen, Ergebnisse, Hausübungen, Texte", icon: ListTodo },
        { href: "/mehr/uebersicht#vorbereitung", label: `Vorbereitung: nächste ${VORAUS_TAGE} Tage`, hint: "Lernpaket je kommender Einheit: deine Wahl oder der Vorschlag der App", icon: ClipboardList },
      ],
    },
    {
      title: "Unterricht",
      items: [
        { href: "/blaetter", label: "Blätter erstellen", hint: "Lesetabelle, Satzbaukasten und Nachmalblatt einstellen und drucken", icon: FileText },
        { href: "/einheiten", label: "Alle Einheiten", hint: "Wer hat wann mit wem gearbeitet, pro Monat", icon: Clock3 },
        { href: "/lehrer", label: "Lehrer & Verfügbarkeit", hint: "Eigene Verfügbarkeit, Wochenziel und Raumwünsche; als Verwaltung auch Accounts", icon: CalendarClock },
        { href: "/mehr/raeume", label: "Räume", hint: "Gebäude, Raumname, vor Ort oder online", icon: DoorOpen },
        {
          href: "/mehr/faecher",
          label: "Fächer",
          hint: teacher.is_admin ? "Alle Schulfächer für Profil, Einheit und Schularbeit; eigene ergänzen" : "Alle Schulfächer, aus denen Profil, Einheit und Schularbeit wählen",
          icon: BookOpen,
        },
        { href: "/diagnose", label: "Diagnose", hint: "Stand eines Schülers mit 5 bis 10 Aufgaben prüfen", icon: ListChecks },
        { href: "/uebungen/bibliothek", label: "Aufgabenbibliothek", hint: "Gespeicherte Aufgaben suchen und wiederverwenden", icon: Library },
        { href: "/mehr/lernpakete", label: "Lernpakete", hint: "Vorbereitete Einheiten je Thema: Ablauf, Fragen, Aufgaben; anlegen, importieren, exportieren", icon: Package },
        { href: "/mehr/praesentationen", label: "Präsentationen", hint: "Folien mit Animationen und Vortragstext; hochladen, vortragen, am Schülergerät zeigen", icon: MonitorPlay },
        { href: "/mehr/material", label: "Material", hint: "Fotos und PDFs hochladen, einordnen, Aufgaben übernehmen", icon: FolderUp },
        { href: "/mehr/referenzen", label: "Referenzsammlung", hint: "Aufgaben mit Quelle als Vorbild für die KI; nur für Lehrer", icon: BookMarked },
        { href: "/mehr/geraete", label: "Schülergeräte", hint: "Schüler-Tablet verbinden oder trennen", icon: TabletSmartphone },
        { href: "/faehigkeiten", label: "Themen und Fähigkeiten", hint: "Woran der Lernstand gemessen wird; eigene Fähigkeiten anlegen", icon: GitBranch },
        { href: "/mehr/lehrplan", label: "Curriculum / Lehrplan", hint: "Österreich, VS/MS/AHS/HTL/HAK, Quellen, Importe, Lizenzen", icon: Landmark },
      ],
    },
    {
      title: "Auswerten und pflegen",
      items: [
        { href: "/mehr/statistik", label: "Statistik", hint: "Schwierige Fähigkeiten, Fehlerarten, Aufgabenqualität", icon: BarChart3 },
        { href: "/mehr/datenqualitaet", label: "Datenqualität", hint: "Fähigkeiten zuordnen, Dubletten, Voraussetzungen korrigieren", icon: ShieldCheck },
        { href: "/mehr/ki-kosten", label: "KI-Kosten", hint: "Aufrufe, Tokens und Kosten pro Tag, Monat, Lehrer und Funktion", icon: Coins },
      ],
    },
    {
      title: "Konto",
      items: [
        { href: "/passwort", label: "Passwort ändern", hint: "Für dein Login", icon: KeyRound },
        {
          href: "/mehr/feedback",
          label: "Feedback",
          hint: teacher.is_admin
            ? `${offenesFeedback ? `${offenesFeedback} offen. ` : ""}Was Lehrkräfte melden: lesen, abhaken, weitergeben`
            : "Was du gemeldet hast und was schon erledigt ist",
          icon: MessageSquarePlus,
        },
      ],
    },
  ];
  if (teacher.is_admin) {
    groups.push({
      title: "Verwaltung",
      items: [
        { href: "/export", label: "Datenexport", hint: "Sicherung und Tabellen herunterladen", icon: Download },
        { href: "/mehr/import", label: "Import", hint: "Schüler und Lehrer aus einer CSV-Datei übernehmen, mit Vorschau vor dem Schreiben", icon: FileUp },
      ],
    });
  }
  return (
    <>
      <PageHeader
        title="Erweitert"
        actions={
          <form action={logoutAction}>
            <button className="btn btn-secondary">
              <LogOut size={16} aria-hidden /> Abmelden
            </button>
          </form>
        }
      />
      <div className="panel mb-8 flex flex-wrap items-center gap-4 px-5 py-4">
        <Avatar name={teacher.name} size={52} />
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-semibold">{teacher.name}</div>
          <div className="text-[14px] text-ink-2">{teacher.is_admin ? "Verwaltung" : "Lehrkraft"}</div>
        </div>
        <p className="flex items-center gap-2 text-[13px] text-ink-2">
          <Sparkles size={15} className="shrink-0 text-accent" aria-hidden />
          {aiEnabled() ? "KI ist eingerichtet." : "Ohne KI-Schlüssel: eingebaute Generatoren."}
        </p>
      </div>
      <div className="grid gap-8">
        {groups.map((g) => (
          <section key={g.title}>
            <h2 className="gruppe-titel mb-3">{g.title}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {g.items.map(({ href, label, hint, icon: Icon }) => (
                <li key={href}>
                  <Link href={href} className="panel drueck flex h-full min-h-[76px] items-center gap-3.5 px-4 py-3 transition-colors hover:border-line-strong">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-wash text-accent" aria-hidden>
                      <Icon size={19} strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{label}</span>
                      <span className="block text-[13px] leading-snug text-ink-2">{hint}</span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-ink-3" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

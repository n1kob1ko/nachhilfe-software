import Link from "next/link";
import { ChevronRight, Clock3, Download, GitBranch, KeyRound, LogOut, Sparkles, TabletSmartphone, UserCog } from "lucide-react";
import { logoutAction } from "@/app/session-actions";
import { Avatar } from "@/components/Art";
import { PageHeader } from "@/components/ui";
import { aiEnabled } from "@/lib/ai";
import { requireTeacher } from "@/lib/auth";

export const metadata = { title: "Mehr" };

/** Everything a teacher needs only now and then, so the main navigation can stay at five entries. */
export default async function MorePage() {
  const teacher = await requireTeacher();
  const groups: { title: string; items: { href: string; label: string; hint: string; icon: typeof Clock3 }[] }[] = [
    {
      title: "Unterricht",
      items: [
        { href: "/einheiten", label: "Alle Einheiten", hint: "Wer hat wann mit wem gearbeitet, pro Monat", icon: Clock3 },
        { href: "/mehr/geraete", label: "Schülergeräte", hint: "Schüler-Tablet verbinden oder trennen", icon: TabletSmartphone },
        { href: "/faehigkeiten", label: "Themen und Fähigkeiten", hint: "Woran der Lernstand gemessen wird; eigene Fähigkeiten anlegen", icon: GitBranch },
      ],
    },
    {
      title: "Konto",
      items: [{ href: "/passwort", label: "Passwort ändern", hint: "Für dein Login", icon: KeyRound }],
    },
  ];
  if (teacher.is_admin) {
    groups.push({
      title: "Verwaltung",
      items: [
        { href: "/lehrer", label: "Lehrer verwalten", hint: "Lehrer anlegen, Passwort zurücksetzen", icon: UserCog },
        { href: "/export", label: "Datenexport", hint: "Sicherung und Tabellen herunterladen", icon: Download },
      ],
    });
  }
  return (
    <>
      <PageHeader title="Mehr" />
      <div className="mb-8 flex items-center gap-3">
        <Avatar name={teacher.name} size={48} />
        <div>
          <div className="text-[17px] font-semibold">{teacher.name}</div>
          <div className="text-[14px] text-ink-2">{teacher.is_admin ? "Verwaltung" : "Lehrer"}</div>
        </div>
      </div>
      <div className="grid max-w-[640px] gap-8">
        {groups.map((g) => (
          <section key={g.title}>
            <h2 className="mb-2 text-[15px] font-semibold text-ink-2">{g.title}</h2>
            <ul className="panel divide-y divide-line">
              {g.items.map(({ href, label, hint, icon: Icon }) => (
                <li key={href}>
                  <Link href={href} className="flex min-h-[64px] items-center gap-4 px-4 py-3 hover:bg-panel/60">
                    <Icon size={20} className="shrink-0 text-ink-2" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{label}</span>
                      <span className="block text-[13px] text-ink-2">{hint}</span>
                    </span>
                    <ChevronRight size={18} className="text-ink-3" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="flex items-start gap-2 text-[13px] text-ink-2">
          <Sparkles size={15} className="mt-0.5 shrink-0" aria-hidden />
          {aiEnabled() ? "Übungen und Auswertungen werden mit Claude erstellt." : "Übungen werden mit den eingebauten Aufgabengeneratoren erstellt (kein KI-Schlüssel hinterlegt)."}
        </p>
        <form action={logoutAction}>
          <button className="btn btn-secondary btn-lg">
            <LogOut size={17} aria-hidden /> Abmelden
          </button>
        </form>
      </div>
    </>
  );
}

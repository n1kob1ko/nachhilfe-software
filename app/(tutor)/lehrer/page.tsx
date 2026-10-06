import { setTeacherActiveAction } from "@/app/session-actions";
import { Info } from "@/components/Info";
import { NewTeacherForm, ResetPasswordForm } from "@/components/AuthForms";
import { PageHeader, Pill, SectionTitle } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { listAllTeachers } from "@/lib/repo";

export const metadata = { title: "Lehrer" };

export default async function Teachers() {
  const me = await requireAdmin();
  const teachers = listAllTeachers();
  return (
    <>
      <PageHeader title="Lehrer" info="Jeder Lehrer meldet sich mit einem eigenen Account an. Einheiten und Dokumentation werden auf den angemeldeten Lehrer gebucht." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <SectionTitle>Accounts</SectionTitle>
          <ul className="panel divide-y divide-line">
            {teachers.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    {t.name} {t.is_admin ? <Pill tone="accent">Verwaltung</Pill> : null} {!t.active && <Pill>deaktiviert</Pill>}
                  </div>
                  <div className="text-[13px] text-ink-2">
                    Benutzername <span className="font-mono">{t.username}</span>
                    {t.must_change_password ? " · Startpasswort noch nicht geändert" : ""}
                  </div>
                </div>
                {t.id !== me.id && (
                  <>
                    <ResetPasswordForm teacherId={t.id} />
                    <form action={setTeacherActiveAction.bind(null, t.id, !t.active)}>
                      <button className="btn btn-ghost btn-sm">{t.active ? "Deaktivieren" : "Aktivieren"}</button>
                    </form>
                  </>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-center gap-1 text-[13px] text-ink-3">
            Startpasswörter
            <Info label="Info zu Passwörtern">Neue und zurückgesetzte Accounts bekommen ein eigenes Startpasswort. Es wird nur einmal angezeigt und muss beim ersten Login geändert werden. Deaktivierte Lehrer bleiben in der Dokumentation erhalten.</Info>
          </p>
        </section>
        <aside>
          <div className="panel px-4 py-4">
            <h2 className="mb-3 font-semibold">Lehrer hinzufügen</h2>
            <NewTeacherForm />
          </div>
        </aside>
      </div>
    </>
  );
}

import Link from "next/link";
import { CalendarClock, Target, UserCog } from "lucide-react";
import { setTeacherActiveAction } from "@/app/session-actions";
import { Info } from "@/components/Info";
import { NewTeacherForm, ResetPasswordForm } from "@/components/AuthForms";
import { RaumPraeferenzen } from "@/components/planung/RaumPraeferenzen";
import { VerfuegbarkeitFormular } from "@/components/planung/VerfuegbarkeitFormular";
import { WochenAbweichung } from "@/components/planung/WochenAbweichung";
import { PageHeader, Pill, SectionTitle } from "@/components/ui";
import { saveTeacherAvailabilityAction, saveTeacherWeeklyTargetAction } from "@/app/planung-actions";
import { requireTeacher } from "@/lib/auth";
import { darfLehrerPlanungBearbeiten } from "@/lib/planung/berechtigungen";
import { getAbweichung, getLehrerPlanung, listRaeume } from "@/lib/planung/repo";
import { istDatum, wienerWochenstart, wochenLabel, wochenstartVon } from "@/lib/planung/zeit";
import { listAllTeachers } from "@/lib/repo";

export const metadata = { title: "Lehrer" };

/**
 * Lehrer: der eigene Account, die eigene Verfügbarkeit samt Wochenziel und Raumwünschen.
 *
 * Rechte (D23): ein Lehrer bearbeitet **seine eigene** Planung, die Verwaltung jede. Deshalb wählt
 * nur die Verwaltung oben eine andere Lehrkraft aus; für alle anderen zeigt die Seite die eigene.
 * Die Rechteprüfung selbst liegt in `lib/planung/berechtigungen.ts` und wird von jeder Server
 * Action erneut angewandt — was hier nicht angezeigt wird, ist damit auch nicht schreibbar.
 */
export default async function Teachers({ searchParams }: { searchParams: Promise<{ lehrer?: string; woche?: string; fehler?: string; ok?: string }> }) {
  const me = await requireTeacher();
  const sp = await searchParams;
  const alle = me.is_admin ? listAllTeachers() : [me];
  const gewaehlt = Number(sp.lehrer) || 0;
  const ziel = (me.is_admin ? alle.find((t) => t.id === gewaehlt) : undefined) ?? me;
  const darf = darfLehrerPlanungBearbeiten(me, ziel.id);
  const planung = getLehrerPlanung(ziel.id);
  const raeume = listRaeume();
  const woche = sp.woche && istDatum(sp.woche) ? wochenstartVon(sp.woche) : wienerWochenstart();
  const abweichung = getAbweichung("teacher", ziel.id, woche);
  const basis = JSON.stringify(planung?.availability ?? {});
  const extra: Record<string, string> = me.is_admin ? { lehrer: String(ziel.id) } : {};
  const zurueck = `${"/lehrer"}?${new URLSearchParams({ ...extra, woche }).toString()}`;
  const fremdGewuenscht = !me.is_admin && gewaehlt > 0 && gewaehlt !== me.id;

  return (
    <>
      <PageHeader
        title="Lehrer"
        info="Verfügbarkeit, Wochenziel und Raumwünsche gelten für die Planung (Wochenplan). Jeder Lehrer pflegt seine eigene Verfügbarkeit; die Verwaltung kann alle bearbeiten. Einheiten und Dokumentation werden auf den angemeldeten Lehrer gebucht."
      />

      {(sp.fehler || sp.ok) && (
        <p className={`mb-6 max-w-[900px] rounded-2xl px-4 py-3 text-[14px] ${sp.fehler ? "bg-red-wash text-red" : "bg-green-wash text-green"}`} role="status">
          {sp.fehler ?? sp.ok}
        </p>
      )}

      {fremdGewuenscht && <p className="mb-6 max-w-[900px] rounded-2xl bg-amber-wash px-4 py-3 text-[14px] text-amber">Andere Lehrer sieht und ändert nur die Verwaltung. Hier steht deine eigene Planung.</p>}

      {me.is_admin && (
        <form method="get" action="/lehrer" className="mb-8 flex flex-wrap items-end gap-3">
          <label className="field max-w-[280px]">
            <span className="label">Lehrkraft</span>
            <select className="input" name="lehrer" defaultValue={String(ziel.id)}>
              {alle.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.is_admin ? " (Verwaltung)" : ""}
                  {t.active ? "" : " – deaktiviert"}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-secondary">Anzeigen</button>
        </form>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0">
          <SectionTitle action={<Pill tone="accent">{wochenLabel(woche)}</Pill>}>
            <CalendarClock size={17} className="mr-1.5 inline align-[-3px] text-ink-3" aria-hidden />
            Verfügbarkeit{ziel.id === me.id ? "" : ` von ${ziel.name}`}
          </SectionTitle>
          {darf ? (
            <VerfuegbarkeitFormular key={`${ziel.id}-${basis}`} action={saveTeacherAvailabilityAction.bind(null, ziel.id)} value={basis} zurueck={zurueck} />
          ) : (
            <p className="text-[14px] text-ink-2">Nur die Verwaltung sieht die Verfügbarkeit anderer Lehrkräfte.</p>
          )}

          <div className="mt-10">
            <SectionTitle>Diese Woche abweichend</SectionTitle>
            <WochenAbweichung
              key={`${ziel.id}-${woche}`}
              ownerType="teacher"
              ownerId={ziel.id}
              weekStart={woche}
              basis={basis}
              abweichung={abweichung ? JSON.stringify(abweichung) : null}
              darfBearbeiten={darf}
              basisHref="/lehrer"
              extra={extra}
            />
          </div>

          {me.is_admin && (
            <div className="mt-10">
              <SectionTitle>Accounts</SectionTitle>
              <ul className="panel divide-y divide-line">
                {listAllTeachers().map((t) => (
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
            </div>
          )}
        </section>

        <aside className="grid content-start gap-6">
          {darf && (
            <div className="panel px-4 py-4">
              <h2 className="mb-1 flex items-center gap-2 font-semibold">
                <Target size={17} className="text-ink-3" aria-hidden /> Wochenziel
              </h2>
              <p className="mb-3 text-[13px] text-ink-2">Wie viele Minuten in der Woche geplant werden sollen. Leer oder 0 heißt: kein Ziel.</p>
              <form action={saveTeacherWeeklyTargetAction.bind(null, ziel.id)} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="zurueck" value={zurueck} />
                <label className="field max-w-[160px]">
                  <span className="label">Minuten pro Woche</span>
                  <input className="input" type="number" name="weekly_target_min" min={0} max={1440} step={30} defaultValue={planung?.weekly_target_min ?? ""} placeholder="z. B. 1200" />
                </label>
                <button className="btn btn-primary btn-sm">Speichern</button>
              </form>
            </div>
          )}

          <div className="panel px-4 py-4">
            <h2 className="mb-1 flex items-center gap-2 font-semibold">
              <UserCog size={17} className="text-ink-3" aria-hidden /> Raumwünsche
            </h2>
            <p className="mb-3 text-[13px] text-ink-2">
              Welche Räume am liebsten — der erste zählt am meisten. Räume pflegt die Verwaltung unter{" "}
              <Link href="/mehr/raeume" className="underline underline-offset-2">
                Mehr › Räume
              </Link>
              .
            </p>
            {darf ? (
              <RaumPraeferenzen key={`${ziel.id}-${(planung?.preferred_room_ids ?? []).join("-")}`} teacherId={ziel.id} raeume={raeume} value={planung?.preferred_room_ids ?? []} zurueck={zurueck} />
            ) : (
              <p className="text-[14px] text-ink-2">Nur die Verwaltung sieht die Raumwünsche anderer Lehrkräfte.</p>
            )}
          </div>

          {me.is_admin && (
            <div className="panel px-4 py-4">
              <h2 className="mb-3 font-semibold">Lehrer hinzufügen</h2>
              <NewTeacherForm />
            </div>
          )}

          {!me.is_admin && <p className="text-[13px] text-ink-3">Lehrer anlegen und Passwörter zurücksetzen kann die Verwaltung.</p>}
        </aside>
      </div>
    </>
  );
}

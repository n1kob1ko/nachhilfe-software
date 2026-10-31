import Link from "next/link";
import { CalendarClock, Target, Trash2, UserCog } from "lucide-react";
import { deleteTeacherAction, setTeacherActiveAction, setTeacherRoleAction } from "@/app/session-actions";
import { Info } from "@/components/Info";
import { NewTeacherForm, ResetPasswordForm } from "@/components/AuthForms";
import { RaumPraeferenzen } from "@/components/planung/RaumPraeferenzen";
import { VerfuegbarkeitFormular } from "@/components/planung/VerfuegbarkeitFormular";
import { WochenAbweichung } from "@/components/planung/WochenAbweichung";
import { PageHeader, Pill, SectionTitle } from "@/components/ui";
import { saveTeacherAvailabilityAction, saveTeacherWeeklyTargetAction } from "@/app/planung-actions";
import { requireTeacher } from "@/lib/auth";
import { aktiveVerwaltung, getKonto, loeschFehler, loeschVorschau, type LoeschVorschau } from "@/lib/lehrer-konten";
import { darfLehrerPlanungBearbeiten } from "@/lib/planung/berechtigungen";
import { getAbweichung, getLehrerPlanung, listRaeume } from "@/lib/planung/repo";
import { istDatum, wienerWochenstart, wochenLabel, wochenstartVon } from "@/lib/planung/zeit";
import { listAllTeachers, type Teacher } from "@/lib/repo";

export const metadata = { title: "Lehrer" };

/**
 * Lehrer: der eigene Account, die eigene Verfügbarkeit samt Wochenziel und Raumwünschen.
 *
 * Rechte (D23): ein Lehrer bearbeitet **seine eigene** Planung, die Verwaltung jede. Deshalb wählt
 * nur die Verwaltung oben eine andere Lehrkraft aus; für alle anderen zeigt die Seite die eigene.
 * Die Rechteprüfung selbst liegt in `lib/planung/berechtigungen.ts` und wird von jeder Server
 * Action erneut angewandt — was hier nicht angezeigt wird, ist damit auch nicht schreibbar.
 */
export default async function Teachers({ searchParams }: { searchParams: Promise<{ lehrer?: string; woche?: string; fehler?: string; ok?: string; loeschen?: string; konto?: string; kontofehler?: string }> }) {
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
  // Accounts (nur Verwaltung): Rolle, Deaktivieren, Löschen mit Bestätigungsschritt (?loeschen=id)
  const verwaltungAktiv = me.is_admin ? aktiveVerwaltung() : 0;
  const loeschId = me.is_admin ? Number(sp.loeschen) || 0 : 0;
  const vorschau = loeschId && loeschId !== me.id ? loeschVorschau(loeschId) : null;

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
            <div id="accounts" className="mt-10 scroll-mt-6">
              <SectionTitle>Accounts</SectionTitle>
              {(sp.konto || sp.kontofehler) && !vorschau && (
                <p className={`mb-3 rounded-2xl px-4 py-3 text-[14px] ${sp.kontofehler ? "bg-red-wash text-red" : "bg-green-wash text-green"}`} role="status">
                  {sp.kontofehler ?? sp.konto}
                </p>
              )}
              <ul className="panel divide-y divide-line">
                {alle.map((t) => {
                  const letzteVerwaltung = !!t.is_admin && !!t.active && verwaltungAktiv <= 1;
                  const bestaetigen = vorschau && vorschau.konto.id === t.id ? vorschau : null;
                  return (
                    <li key={t.id} id={`konto-${t.id}`} className="flex scroll-mt-6 flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                      <div className="min-w-0 grow basis-52">
                        <div className="font-semibold">
                          {t.name} {t.is_admin && t.id === me.id ? <Pill tone="accent">Verwaltung</Pill> : null} {!t.active && <Pill>deaktiviert</Pill>}
                        </div>
                        <div className="text-[13px] text-ink-2">
                          Benutzername <span className="font-mono">{t.username}</span>
                          {t.must_change_password ? " · Startpasswort noch nicht geändert" : ""}
                        </div>
                      </div>
                      {t.id !== me.id && (
                        <>
                          <form className="inline-flex rounded-full bg-panel p-0.5" aria-label={`Rolle von ${t.name}`}>
                            {(["lehrer", "verwaltung"] as const).map((rolle) => {
                              const an = (rolle === "verwaltung") === !!t.is_admin;
                              return (
                                <button
                                  key={rolle}
                                  type={an ? "button" : "submit"}
                                  formAction={an ? undefined : setTeacherRoleAction.bind(null, t.id, rolle)}
                                  aria-pressed={an}
                                  disabled={!an && rolle === "lehrer" && letzteVerwaltung}
                                  className={`min-h-[34px] rounded-full px-3 text-[13px] font-semibold disabled:opacity-50 ${an ? "bg-accent text-on-fill" : "text-ink-2 hover:text-ink"}`}
                                >
                                  {rolle === "lehrer" ? "Lehrer" : "Verwaltung"}
                                </button>
                              );
                            })}
                          </form>
                          <ResetPasswordForm teacherId={t.id} />
                          <form action={setTeacherActiveAction.bind(null, t.id, !t.active)}>
                            <button className="btn btn-ghost btn-sm">{t.active ? "Deaktivieren" : "Aktivieren"}</button>
                          </form>
                          {!letzteVerwaltung && !bestaetigen && (
                            <Link href={`/lehrer?loeschen=${t.id}#konto-${t.id}`} className="btn btn-ghost btn-sm text-red">
                              <Trash2 size={15} aria-hidden /> Löschen
                            </Link>
                          )}
                        </>
                      )}
                      {bestaetigen && <LoeschenBestaetigen vorschau={bestaetigen} me={me} alle={alle} fehler={sp.kontofehler} verwaltungAktiv={verwaltungAktiv} />}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 flex items-center gap-1 text-[13px] text-ink-3">
                Startpasswörter und Rollen
                <Info label="Info zu Passwörtern und Rollen">
                  Neue und zurückgesetzte Accounts bekommen ein eigenes Startpasswort. Es wird nur einmal angezeigt und muss beim ersten Login geändert werden. Die Verwaltung sieht und ändert alles; ein Lehrer seine eigene Planung. Die eigene Rolle ändert eine andere Verwaltung, eine Verwaltung muss es immer geben. Deaktivieren ist vorübergehend, Löschen endgültig. Deaktivierte und gelöschte Lehrer bleiben in Dokumentation und Abrechnung erhalten.
                </Info>
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
                Erweitert › Räume
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

/**
 * Der Bestätigungsschritt zu „Löschen“: sagt, was passiert (Anmeldung, Listen, Verlauf, Plätze, Benutzername), fragt,
 * wer die Schüler übernimmt (vorgewählt: wer löscht), und nennt den Grund, wenn gerade nicht gelöscht werden kann.
 */
function LoeschenBestaetigen({ vorschau, me, alle, fehler, verwaltungAktiv }: { vorschau: LoeschVorschau; me: Teacher; alle: Teacher[]; fehler?: string; verwaltungAktiv: number }) {
  const { konto, schueler, plaetze, laufend, verlauf } = vorschau;
  const grund = loeschFehler(getKonto(me.id), konto, { aktiveVerwaltung: verwaltungAktiv, laufend, schueler: 0, nachfolger: null });
  const nachfolger = alle.filter((t) => t.id !== konto.id && t.active);
  const username = alle.find((t) => t.id === konto.id)?.username;
  return (
    <div className="basis-full rounded-2xl border border-red/30 bg-red-wash/40 px-4 py-4">
      <h3 className="mb-2 font-semibold">{konto.name} löschen?</h3>
      {fehler && fehler !== grund && (
        <p className="mb-3 text-[14px] text-red" role="status">
          {fehler}
        </p>
      )}
      {grund ? (
        <>
          <p className="mb-3 text-[14px] text-red">{grund}</p>
          <Link href="/lehrer#accounts" className="btn btn-secondary btn-sm">
            Zurück
          </Link>
        </>
      ) : (
        <>
          <ul className="mb-3 grid list-disc gap-1 pl-5 text-[14px] text-ink-2">
            <li>{konto.name} kann sich nicht mehr anmelden und verschwindet aus allen Listen, aus Heute und aus der Planung.</li>
            {verlauf ? (
              <li>Einheiten, Dokumentation und Abrechnung behalten den Namen {konto.name}.</li>
            ) : (
              <li>{konto.name} hat noch nichts unterrichtet. Das Konto wird ganz entfernt.</li>
            )}
            {plaetze > 0 && <li>{plaetze === 1 ? "Ein künftiger Platz fällt" : `${plaetze} künftige Plätze fallen`} aus dem Wochenplan; vergangene bleiben.</li>}
            {username && <li>Der Benutzername „{username}“ ist danach wieder frei.</li>}
          </ul>
          <form action={deleteTeacherAction.bind(null, konto.id)} className="flex flex-wrap items-end gap-3">
            {schueler.length > 0 && (
              <label className="field w-full max-w-[320px]">
                <span className="label">{schueler.length === 1 ? `${schueler[0].name} übernimmt` : `Die ${schueler.length} Schüler übernimmt`}</span>
                <select className="input" name="nachfolger" defaultValue={String(me.id)} required>
                  {nachfolger.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button className="btn btn-danger btn-sm border border-red/30">
              <Trash2 size={15} aria-hidden /> Endgültig löschen
            </button>
            <Link href="/lehrer#accounts" className="btn btn-ghost btn-sm">
              Abbrechen
            </Link>
          </form>
          <p className="mt-3 text-[13px] text-ink-3">Nur für eine Weile weg? Dann lieber „Deaktivieren“.</p>
        </>
      )}
    </div>
  );
}

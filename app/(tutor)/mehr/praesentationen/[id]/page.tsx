import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Archive, CheckCircle2, Eye, FileUp, Package, Pencil, RotateCcw, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { archivePraesentationAction, importNotizenAction, markPraesGeprueftAction, restorePraesentationAction, updatePraesentationAction } from "@/app/praesentation-actions";
import { Vortrag, type Hinweis } from "@/components/praesentation/Vortrag";
import { SkillPicker } from "@/components/SkillPicker";
import { PageHeader, Pill, SectionTitle, formatDate } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { DIFFICULTIES } from "@/lib/curriculum";
import { kiKosten } from "@/lib/lernpaket-ki";
import { parseView, studentDevice } from "@/lib/live";
import { dateienDa, getPraesentation, lernpaketeMit, praesUngeprueft, schritteZuFolien } from "@/lib/praesentationen";
import { deckEinrichtungsProblem, deckUrl, praesentationsOrigin } from "@/lib/praesentation-host";
import * as repo from "@/lib/repo";
import { fachVorschlaege, klassenLabel, SCHOOL_TYPES } from "@/lib/school";
import { canManageUnit, runningUnits } from "@/lib/units";
import { shortNames } from "@/lib/vornamen";

export const metadata = { title: "Präsentation" };

type Params = { ansicht?: string; bearbeiten?: string; fehler?: string; neu?: string; gespeichert?: string; archiviert?: string; wiederhergestellt?: string; notizen?: string; folie?: string; geprueft?: string; einheit?: string };
const PR = "/mehr/praesentationen";
const mb = (b: number) => `${(b / 1024 / 1024).toLocaleString("de-AT", { maximumFractionDigits: 1 })} MB`;

/**
 * One presentation: the teacher's player (slides with the Vortragstext of the slide on show, what linked
 * Lernpakete say there, the student device), or with „Schüleransicht“ only what the student sees; the
 * notes are then not sent to the page at all.
 */
export default async function PraesentationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Params> }) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const sp = await searchParams;
  const p = getPraesentation(Number(id));
  if (!p) notFound();
  const archiviert = p.status === "archiviert";
  const schueler = sp.ansicht === "schueler";
  const bearbeiten = Boolean(sp.bearbeiten) && !archiviert;
  const h = await headers();
  const problem = deckEinrichtungsProblem(h.get("x-forwarded-host") ?? h.get("host"), h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http"));
  const da = dateienDa(p);
  const src = !problem && da ? deckUrl(p.token, p.start_pfad) : null;
  const fehler = sp.fehler?.split("\n").filter(Boolean) ?? [];
  const skills = repo.listSkills();
  const skillName = (sid: string) => repo.getSkill(sid)?.name ?? sid;
  const stufe = p.klasse ? klassenLabel(p.schulart, p.klasse) : p.schulart;
  const pakete = lernpaketeMit(p.id);
  const schritte = schritteZuFolien(p.id);
  const hinweise: Record<number, Hinweis[]> = {};
  for (const s of schritte) (hinweise[s.folie] ??= []).push({ paketId: s.paketId, paket: s.paket, schritt: s.schritt, lehrer_sagt: s.lehrer_sagt, lehrer_fragt: s.lehrer_fragt });
  // running units of this teacher with a student device (tablet or own laptop)
  const laufend = runningUnits(teacher.id).filter((u) => canManageUnit(teacher, u) && studentDevice(u));
  const namen = shortNames(laufend.map((u) => u.student_name));
  const geraete = laufend.map((u, i) => ({ unitId: u.id, student: namen[i] }));
  const aufGeraet = laufend.find((u) => {
    const v = parseView(u.device_view);
    return v.kind === "praesentation" && v.id === p.id;
  });
  // the student device's slide, or the slide a Lernpaket step links to
  const startFolie = aufGeraet ? (parseView(aufGeraet.device_view) as { folie: number }).folie : Math.min(500, Math.max(1, Math.round(Number(sp.folie)) || 1));
  const notizListe = Object.entries(p.notizen)
    .map(([k, v]) => [Number(k), v] as const)
    .sort((a, b) => a[0] - b[0]);

  const meldung = sp.neu
    ? "Hochgeladen. Die Präsentation läuft so, wie sie gebaut ist, mit allen Animationen."
    : sp.gespeichert
      ? "Gespeichert."
      : sp.archiviert
        ? "Archiviert. Die Präsentation ist unter „Archiviert“ weiter da."
        : sp.wiederhergestellt
          ? "Wiederhergestellt."
          : sp.notizen
            ? `Vortragstext zu ${sp.notizen} ${sp.notizen === "1" ? "Folie" : "Folien"} übernommen.`
            : sp.geprueft
              ? "Als geprüft markiert."
              : null;
  // von der KI aus einem Lernpaket erstellt (lib/praesentation-ki.ts): „Ungeprüft“, bis ein Lehrer sie ansieht
  const ki = p.quelle === "ki";
  const offen = praesUngeprueft(p);
  const kosten = ki ? kiKosten(p.ki_call_id) : null;
  const prueferName = p.geprueft_von ? repo.getTeacher(p.geprueft_von)?.name : null;

  return (
    <>
      <PageHeader
        back={Number(sp.einheit) > 0 ? { href: `/einheiten/${Number(sp.einheit)}#praesentation-schritt`, label: "Unterricht" } : { href: archiviert ? `${PR}?status=archiviert` : PR, label: "Präsentationen" }}
        title={p.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-1.5">
            {p.fach}
            {stufe && ` · ${stufe}`}
            {p.thema && ` · ${p.thema}`}
            <Pill>{p.schwierigkeit}</Pill>
            {archiviert && <Pill>Archiviert</Pill>}
            {ki && !schueler && <Pill>mit KI erstellt</Pill>}
            {offen && !schueler && (
              <Pill tone="amber" title="Von der KI erstellt und noch von niemandem geprüft">
                <ShieldAlert size={12} aria-hidden /> Ungeprüft
              </Pill>
            )}
          </span>
        }
        actions={
          <>
            <Link href={schueler ? `${PR}/${p.id}` : `${PR}/${p.id}?ansicht=schueler`} className={`btn ${schueler ? "btn-primary" : "btn-secondary"}`}>
              {schueler ? <Users size={16} aria-hidden /> : <Eye size={16} aria-hidden />} {schueler ? "Zurück zum Vortrag" : "Schüleransicht"}
            </Link>
            {!archiviert && !schueler && (
              <Link href={bearbeiten ? `${PR}/${p.id}` : `${PR}/${p.id}?bearbeiten=1#angaben`} className={`btn ${bearbeiten ? "btn-primary" : "btn-secondary"}`}>
                {bearbeiten ? <CheckCircle2 size={16} aria-hidden /> : <Pencil size={16} aria-hidden />} {bearbeiten ? "Fertig" : "Bearbeiten"}
              </Link>
            )}
          </>
        }
      />
      {meldung && (
        <p className="mb-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-green" role="status">
          <CheckCircle2 size={16} aria-hidden /> {meldung}
        </p>
      )}
      {fehler.length > 0 && (
        <div className="mb-4 rounded-lg bg-red-wash px-4 py-3 text-[14px] text-red" role="alert">
          <ul className="list-disc space-y-0.5 pl-5">
            {fehler.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {offen && !schueler && !archiviert && (
        <section id="pruefen" className="mb-6 max-w-[760px] scroll-mt-24 rounded-[18px] bg-amber-wash px-5 py-4" aria-label="Prüfen">
          <p className="flex items-start gap-2 text-[14px] text-amber">
            <ShieldAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
            <span>Von der KI aus einem Lernpaket erstellt und noch nicht geprüft. Geh jede Folie und den Vortragstext durch, bevor du damit unterrichtest.</span>
          </p>
          <form action={markPraesGeprueftAction.bind(null, p.id)} className="mt-3">
            <button className="btn btn-primary">
              <ShieldCheck size={16} aria-hidden /> Geprüft
            </button>
          </form>
        </section>
      )}
      {schueler && <p className="mb-3 text-[14px] text-ink-2">So sieht der Schüler die Präsentation: nur die Folien, ohne Vortragstext.</p>}
      {p.extern.length > 0 && !schueler && (
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-amber-wash px-4 py-3 text-[14px] text-amber">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Die Präsentation lädt Dateien von außen ({p.extern.join(", ")}). Das ist gesperrt, damit sie nichts nach außen schicken kann; Schriften oder Bibliotheken von dort fehlen dann. Besser
            alle Dateien in die ZIP-Datei packen.
          </span>
        </p>
      )}

      {problem ? (
        <div className="panel mb-8 px-5 py-6" role="status">
          <p className="font-semibold">Abspielen geht auf diesem Server noch nicht.</p>
          <p className="mt-1 text-[14px] text-ink-2">{teacher.is_admin ? problem : "Bitte die Verwaltung fragen: die Adresse für Präsentationen ist nicht eingerichtet."}</p>
        </div>
      ) : !da || !src ? (
        <div className="panel mb-8 px-5 py-6" role="status">
          <p className="font-semibold">Die Dateien dieser Präsentation fehlen auf diesem Server.</p>
          <p className="mt-1 text-[14px] text-ink-2">Bitte die Präsentation noch einmal hochladen.</p>
        </div>
      ) : schueler ? (
        <Vortrag key="schueler" praesId={p.id} title={p.title} src={src} deckOrigin={praesentationsOrigin()} />
      ) : (
        <Vortrag
          key="lehrer"
          praesId={p.id}
          title={p.title}
          src={src}
          deckOrigin={praesentationsOrigin()}
          notizen={p.notizen}
          hinweise={hinweise}
          geraete={archiviert ? [] : geraete}
          aufGeraet={aufGeraet?.id ?? null}
          start={startFolie}
        />
      )}

      {!schueler && (
        <>
          <section id="notizen" className="mt-10 max-w-[760px] scroll-mt-24" aria-label="Vortragstext">
            <SectionTitle>Vortragstext je Folie</SectionTitle>
            {notizListe.length === 0 ? (
              <p className="text-[14px] text-ink-3">Noch kein Vortragstext. Im Vortrag oben „Schreiben“ tippen, oder eine Datei „lernheft-notizen.json“ hochladen.</p>
            ) : (
              <ol className="panel divide-y divide-line">
                {notizListe.map(([n, t]) => (
                  <li key={n} className="grid gap-1 px-4 py-3 text-[14px] sm:grid-cols-[80px_1fr]">
                    <span className="num font-semibold text-ink-3">Folie {n}</span>
                    <span className="whitespace-pre-line">{t}</span>
                  </li>
                ))}
              </ol>
            )}
            {!archiviert && (
              <form action={importNotizenAction.bind(null, p.id)} className="mt-3 flex flex-wrap items-end gap-2">
                <label className="field min-w-[220px] flex-1">
                  <span className="label">Vortragstext aus Datei (lernheft-notizen.json)</span>
                  <input className="input" type="file" name="datei" accept=".json,application/json" required />
                </label>
                <button className="btn btn-secondary">
                  <FileUp size={16} aria-hidden /> Übernehmen
                </button>
              </form>
            )}
          </section>

          <section className="mt-10 max-w-[760px]" aria-label="Lernpakete">
            <SectionTitle>Lernpakete</SectionTitle>
            {pakete.length === 0 ? (
              <p className="text-[14px] text-ink-3">Noch kein Lernpaket nutzt diese Präsentation. Im Lernpaket unter „Bearbeiten“ die Präsentation wählen; was der Lehrer bei einer Folie sagt, steht dann hier im Vortrag.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {pakete.map((x) => (
                  <li key={x.id}>
                    <Link href={`/mehr/lernpakete/${x.id}`} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-accent-wash px-3 text-[14px] font-semibold text-accent hover:underline">
                      <Package size={15} aria-hidden /> {x.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-10 max-w-[760px] text-[14px] text-ink-2" aria-label="Datei">
            <SectionTitle>Datei</SectionTitle>
            <p>
              {p.datei_name || "Hochgeladene Datei"} · <span className="num">{p.dateien.length}</span> {p.dateien.length === 1 ? "Datei" : "Dateien"} · <span className="num">{mb(p.groesse)}</span> · startet mit „{p.start_pfad}“
            </p>
            {ki && (
              <p className="mt-2" data-testid="praesentation-ki-kosten">
                Mit KI aus einem Lernpaket erstellt
                {kosten && (
                  <>
                    {" "}
                    · Kosten <span className="num">{kosten.cent} Cent</span> (<span className="num">{kosten.tokensEin.toLocaleString("de-AT")}</span> Tokens ein,{" "}
                    <span className="num">{kosten.tokensAus.toLocaleString("de-AT")}</span> aus)
                  </>
                )}
              </p>
            )}
            {p.geprueft_am && (
              <p className="mt-2 flex items-center gap-1.5 text-[13px]">
                <ShieldCheck size={14} className="text-green" aria-hidden /> Geprüft am {formatDate(p.geprueft_am)}
                {prueferName && ` von ${prueferName}`}
              </p>
            )}
            {p.beschreibung && <p className="mt-2 text-ink">{p.beschreibung}</p>}
            {p.skill_ids.length > 0 && (
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px]">
                Fähigkeiten:
                {p.skill_ids.map((sid) => (
                  <Link key={sid} href={`/faehigkeiten/${encodeURIComponent(sid)}`} className="rounded-full bg-accent-wash px-2.5 py-0.5 font-semibold text-accent hover:underline">
                    {skillName(sid)}
                  </Link>
                ))}
              </p>
            )}
          </section>

          {bearbeiten && (
            <section id="angaben" className="mt-10 max-w-[760px] scroll-mt-24" aria-label="Angaben">
              <SectionTitle>Angaben</SectionTitle>
              <form action={updatePraesentationAction.bind(null, p.id)} className="grid gap-3 sm:grid-cols-2">
                <label className="field sm:col-span-2">
                  <span className="label">Titel</span>
                  <input className="input" name="title" defaultValue={p.title} required maxLength={120} />
                </label>
                <label className="field">
                  <span className="label">Fach</span>
                  <input className="input" name="fach" defaultValue={p.fach} required list="pr-faecher" maxLength={60} autoComplete="off" />
                  <datalist id="pr-faecher">
                    {fachVorschlaege().map((x) => (
                      <option key={x} value={x} />
                    ))}
                  </datalist>
                </label>
                <label className="field">
                  <span className="label">Thema</span>
                  <input className="input" name="thema" defaultValue={p.thema} maxLength={120} />
                </label>
                <label className="field">
                  <span className="label">Schulart</span>
                  <select className="input" name="schulart" defaultValue={p.schulart}>
                    <option value="">jede</option>
                    {SCHOOL_TYPES.map((t) => (
                      <option key={t.name}>{t.name}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="label">Klasse</span>
                  <select className="input" name="klasse" defaultValue={p.klasse ?? ""}>
                    <option value="">jede</option>
                    {Array.from({ length: 8 }, (_, i) => i + 1).map((k) => (
                      <option key={k} value={k}>
                        {k}.
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="label">Schwierigkeit</span>
                  <select className="input" name="schwierigkeit" defaultValue={p.schwierigkeit}>
                    {DIFFICULTIES.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
                <label className="field sm:col-span-2">
                  <span className="label">Beschreibung</span>
                  <textarea className="input" name="beschreibung" rows={2} defaultValue={p.beschreibung} maxLength={1000} />
                </label>
                <div className="field sm:col-span-2">
                  <span className="label">Fähigkeiten ({p.fach})</span>
                  <SkillPicker skills={skills.filter((k) => k.subject === p.fach)} selected={p.skill_ids} />
                </div>
                <div className="sm:col-span-2">
                  <button className="btn btn-secondary">Angaben speichern</button>
                </div>
              </form>
            </section>
          )}

          <div className="mt-10 flex flex-wrap gap-3 border-t border-line pt-5">
            {archiviert ? (
              <form action={restorePraesentationAction.bind(null, p.id)}>
                <button className="btn btn-secondary">
                  <RotateCcw size={16} aria-hidden /> Wiederherstellen
                </button>
              </form>
            ) : (
              <form action={archivePraesentationAction.bind(null, p.id)}>
                <button className="btn btn-secondary">
                  <Archive size={16} aria-hidden /> Archivieren
                </button>
              </form>
            )}
            <p className="basis-full text-[13px] text-ink-3">Archivieren nimmt die Präsentation aus der Liste. Gelöscht wird nichts; unter „Archiviert“ lässt sie sich wiederherstellen.</p>
          </div>
        </>
      )}
    </>
  );
}

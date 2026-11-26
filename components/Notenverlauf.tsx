import { fachGruppe, NOTEN_FAECHER, NOTEN_WORT, noteText, type Notenverlauf } from "@/lib/notenverlauf";

/**
 * Notenverlauf (lib/notenverlauf.ts): je Note ein Punkt über der Zeit, 1 oben, 5 unten, die Fächer in fester Farbe
 * (Farbe hängt am Fach), eine gestrichelte Linie beim Beginn der Nachhilfe. Darunter je Fach „vorher → seither“ und
 * die Noten als Tabelle (die Farben allein tragen nichts: Legende, Beschriftung und Tabelle sagen dasselbe).
 */
const FARBE: Record<string, string> = { Mathematik: "var(--nv-1)", Deutsch: "var(--nv-2)", Englisch: "var(--nv-3)", Andere: "var(--nv-4)" };
const REIHE = [...NOTEN_FAECHER, "Andere"];

const datum = (d: string) => `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}.${d.slice(2, 4)}`;

export function NotenverlaufKarte({ v, druck }: { v: Notenverlauf; druck?: boolean }) {
  if (!v.punkte.length) return <p className="text-[15px] text-ink-2" data-testid="notenverlauf-leer">Noch keine Noten eingetragen. Sobald eine Schularbeit oder ein Test eine Note hat, steht sie hier.</p>;
  const gruppen = REIHE.filter((g) => v.punkte.some((p) => fachGruppe(p.fach) === g));
  return (
    <div className="notenverlauf" data-testid="notenverlauf">
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2" aria-label="Legende">
        {gruppen.map((g) => (
          <li key={g} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: FARBE[g] }} aria-hidden />
            {g}
          </li>
        ))}
        {v.beginn && (
          <li className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 border-t-2 border-dashed border-ink-3" aria-hidden />
            Beginn Nachhilfe
          </li>
        )}
      </ul>
      <Diagramm v={v} gruppen={gruppen} W={340} H={200} className="sm:hidden" />
      <Diagramm v={v} gruppen={gruppen} W={640} H={220} className="hidden sm:block" />

      {v.beginn && v.faecher.some((f) => f.nVorher > 0 && f.nSeither > 0) && (
        <ul className="mt-3 space-y-1 text-[15px]" data-testid="notenverlauf-schnitt">
          {v.faecher
            .filter((f) => f.nVorher > 0 && f.nSeither > 0)
            .map((f) => (
              <li key={f.fach}>
                <b className="font-semibold">{f.fach}:</b> Schnitt vor der Nachhilfe {noteText(f.vorher!)}, seither {noteText(f.seither!)}
                {f.vorher! - f.seither! >= 0.5 ? " – besser geworden" : ""}
              </li>
            ))}
        </ul>
      )}

      <details className="mt-3" open={druck}>
        <summary className="cursor-pointer text-[14px] font-semibold text-ink-2 print:hidden">Alle Noten als Liste</summary>
        <table className="mt-2 w-full text-left text-[14px]">
          <thead className="text-ink-3">
            <tr>
              <th className="py-1 pr-3 font-medium">Datum</th>
              <th className="py-1 pr-3 font-medium">Fach</th>
              <th className="py-1 pr-3 font-medium">Was</th>
              <th className="py-1 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {[...v.punkte].reverse().map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="num py-1 pr-3">{datum(p.datum)}</td>
                <td className="py-1 pr-3">{p.fach}</td>
                <td className="py-1 pr-3">{p.titel}</td>
                <td className="py-1">
                  <b className="num">{p.note}</b> <span className="hidden text-ink-3 sm:inline">{NOTEN_WORT[p.note]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

/** Das Diagramm in einer festen Breite: am Handy schmal (Schrift bleibt lesbar), sonst breit. */
function Diagramm({ v, gruppen, W, H, className }: { v: Notenverlauf; gruppen: string[]; W: number; H: number; className: string }) {
  const L = 30;
  const R = 12;
  const T = 14;
  const B = 28;
  const zeiten = v.punkte.map((p) => Date.parse(p.datum));
  if (v.beginn) zeiten.push(Date.parse(v.beginn));
  let min = Math.min(...zeiten);
  let max = Math.max(...zeiten);
  if (max - min < 30 * 86_400_000) {
    min -= 15 * 86_400_000;
    max += 15 * 86_400_000;
  }
  const x = (d: string) => L + ((Date.parse(d) - min) / (max - min)) * (W - L - R);
  const y = (n: number) => T + ((n - 1) / 4) * (H - T - B);
  return (
      <svg viewBox={`0 0 ${W} ${H}`} className={`h-auto w-full ${className}`} role="img" aria-label="Noten über die Zeit, 1 oben, 5 unten">
        {[1, 2, 3, 4, 5].map((n) => (
          <g key={n}>
            <line x1={L} x2={W - R} y1={y(n)} y2={y(n)} stroke="var(--line)" strokeWidth={1} />
            <text x={L - 10} y={y(n) + 4} textAnchor="end" fontSize={12} fill="var(--ink-3)">
              {n}
            </text>
          </g>
        ))}
        {v.beginn && <line x1={x(v.beginn)} x2={x(v.beginn)} y1={T - 6} y2={H - B + 4} stroke="var(--ink-3)" strokeWidth={1.5} strokeDasharray="4 4" />}
        {gruppen.map((g) => {
          const ps = v.punkte.filter((p) => fachGruppe(p.fach) === g);
          return (
            <g key={g}>
              {ps.length > 1 && <polyline points={ps.map((p) => `${x(p.datum)},${y(p.note)}`).join(" ")} fill="none" stroke={FARBE[g]} strokeWidth={2} strokeLinejoin="round" opacity={0.55} />}
              {ps.map((p) => (
                <circle key={p.id} cx={x(p.datum)} cy={y(p.note)} r={5} fill={FARBE[g]} stroke="var(--surface)" strokeWidth={2}>
                  <title>{`${datum(p.datum)} · ${p.fach} · ${p.titel}: ${p.note} (${NOTEN_WORT[p.note]})`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {v.punkte.length > 0 && (
          <>
            <text x={L} y={H - 8} fontSize={12} fill="var(--ink-3)">
              {datum(v.punkte[0].datum)}
            </text>
            <text x={W - R} y={H - 8} fontSize={12} fill="var(--ink-3)" textAnchor="end">
              {datum(v.punkte[v.punkte.length - 1].datum)}
            </text>
          </>
        )}
      </svg>
  );
}

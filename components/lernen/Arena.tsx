"use client";

import "./lernspiel.css";
import "./arena.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Copy, Hourglass, Pencil, Share2, Swords, Trophy, X } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { duellAnnehmenAction, duellErstellenAction, spielprofilSpeichernAction } from "@/app/wettspiel-actions";
import type { DuellSicht } from "@/lib/duelle";
import type { LigaTabelle } from "@/lib/liga";
import { SPIEL_TITEL, type SpielArt } from "@/lib/lernspiele-typen";
import { BILDER, BILD_SCHLUESSEL, NAME_HINTEN, NAME_VORNE } from "@/lib/spielprofil-listen";

/**
 * Liga und Duelle in der Schüler-App (lib/spielprofil.ts, lib/liga.ts, lib/duelle.ts), auf der Bühne der Lernspiele.
 * Ohne Profil steht zuerst „Mitspielen?“ mit Spitzname aus zwei Listen und einem Tierbild; danach die Wochenliga und die
 * Duelle per Code.
 */

type Profil = { vorne: string; hinten: string; bild: string; liga: boolean; duelle: boolean; name: string };

export function Arena({
  token,
  erlaubnis,
  profil,
  vorschlag,
  bearbeiten,
  liga,
  duelle,
  spiele,
}: {
  token: string;
  erlaubnis: { darf: boolean; grund: string };
  profil: Profil | null;
  vorschlag: { vorne: string; hinten: string; bild: string };
  bearbeiten: boolean;
  liga: LigaTabelle | null;
  duelle: DuellSicht[];
  spiele: SpielArt[];
}) {
  const zurueck = `/lernen/${token}`;
  useEffect(() => {
    const alt = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = alt;
    };
  }, []);

  return (
    <div className="ls" role="dialog" aria-modal="true" aria-label="Liga und Duelle">
      <div className="ls-kopf">
        <Link href={zurueck} className="ls-zu" aria-label="Schließen">
          <X size={24} aria-hidden />
        </Link>
        <span className="flex-1" />
        {profil && !bearbeiten && (
          <Link href={`/lernen/${token}/arena?bearbeiten=1`} className="ar-chip" aria-label="Spitzname und Einstellungen ändern">
            <span aria-hidden>{BILDER[profil.bild]}</span>
            {profil.name}
            <Pencil size={14} aria-hidden />
          </Link>
        )}
      </div>
      {/* neuer Schlüssel je Ansicht: nach dem Speichern beginnt die Liga oben */}
      <div className="ls-mitte ls-staffel" key={!erlaubnis.darf ? "aus" : !profil || bearbeiten ? "profil" : "liga"}>
        {!erlaubnis.darf ? (
          <>
            <h1 className="ls-titel" style={{ "--n": 0 } as CSSProperties}>
              Liga und Duelle
            </h1>
            <p className="ls-text mt-3" style={{ "--n": 1 } as CSSProperties}>
              {erlaubnis.grund}
            </p>
            <p className="ls-text mt-3" style={{ "--n": 2 } as CSSProperties}>
              Allein spielen geht natürlich immer.
            </p>
            <div className="mt-auto pt-8">
              <Link href={`/lernen/${token}/spiel`} className="ls-knopf ls-los">
                Lernspiel spielen
              </Link>
            </div>
          </>
        ) : !profil || bearbeiten ? (
          <ProfilForm token={token} start={profil ?? { ...vorschlag, liga: true, duelle: true, name: "" }} neu={!profil} />
        ) : (
          <>
            {liga && <Liga liga={liga} />}
            {profil.duelle ? (
              <Duelle token={token} duelle={duelle} spiele={spiele} />
            ) : (
              <p className="ls-text mt-8">Duelle hast du ausgeschaltet. Über deinen Namen oben kannst du sie wieder einschalten.</p>
            )}
            {!liga && !profil.duelle && (
              <p className="ls-text mt-4">Liga und Duelle sind aus. Über deinen Namen oben schaltest du sie ein.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Mitspielen ----------

function ProfilForm({ token, start, neu }: { token: string; start: Profil; neu: boolean }) {
  const router = useRouter();
  const [vorne, setVorne] = useState(start.vorne);
  const [hinten, setHinten] = useState(start.hinten);
  const [bild, setBild] = useState(start.bild);
  const [liga, setLiga] = useState(start.liga);
  const [duelle, setDuelle] = useState(start.duelle);
  const [fehler, setFehler] = useState<string | null>(null);
  const [sendet, setSendet] = useState(false);

  async function speichern() {
    setSendet(true);
    setFehler(null);
    const r = await spielprofilSpeichernAction(token, { vorne, hinten, bild, liga, duelle });
    setSendet(false);
    if (!r.ok) {
      setFehler(r.fehler);
      return;
    }
    router.replace(`/lernen/${token}/arena`);
    router.refresh();
  }

  return (
    <>
      <h1 className="ls-titel" style={{ "--n": 0 } as CSSProperties}>
        {neu ? "Mitspielen?" : "Dein Spielname"}
      </h1>
      <p className="ls-text mt-2" style={{ "--n": 1 } as CSSProperties}>
        Spiel gegen andere aus dem Institut. Niemand sieht deinen echten Namen, deine Schule oder Klasse.
      </p>

      <div className="mt-6 flex items-center gap-4" style={{ "--n": 2 } as CSSProperties}>
        <span className="ar-bild" data-gross="" aria-hidden>
          {BILDER[bild]}
        </span>
        <p className="display text-[28px] leading-tight font-extrabold" aria-live="polite">
          {vorne}
          {hinten}
        </p>
      </div>

      <p className="ar-abschnitt" style={{ "--n": 3 } as CSSProperties}>
        Erster Teil
      </p>
      <div className="ar-wahl mt-2" role="group" aria-label="Erster Teil" style={{ "--n": 3 } as CSSProperties}>
        {NAME_VORNE.map((v) => (
          <button key={v} type="button" className="ohne-druck" aria-pressed={v === vorne} onClick={() => setVorne(v)}>
            {v}
          </button>
        ))}
      </div>
      <p className="ar-abschnitt" style={{ "--n": 4 } as CSSProperties}>
        Zweiter Teil
      </p>
      <div className="ar-wahl mt-2" role="group" aria-label="Zweiter Teil" style={{ "--n": 4 } as CSSProperties}>
        {NAME_HINTEN.map((h) => (
          <button key={h} type="button" className="ohne-druck" aria-pressed={h === hinten} onClick={() => setHinten(h)}>
            {h}
          </button>
        ))}
      </div>
      <p className="ar-abschnitt" style={{ "--n": 5 } as CSSProperties}>
        Dein Bild
      </p>
      <div className="ar-wahl mt-2" data-bilder="" role="group" aria-label="Bild" style={{ "--n": 5 } as CSSProperties}>
        {BILD_SCHLUESSEL.map((b) => (
          <button key={b} type="button" className="ohne-druck" aria-pressed={b === bild} aria-label={`Bild ${b}`} onClick={() => setBild(b)}>
            {BILDER[b]}
          </button>
        ))}
      </div>

      <div className="ls-glas mt-6 grid gap-1 px-4 py-2" style={{ "--n": 6 } as CSSProperties}>
        <label className="ar-schalter">
          <span className="flex-1">
            <span className="block text-[16px] font-semibold">In der Wochenliga zeigen</span>
            <span className="ls-klein">Punkte für Einsatz und Besserwerden, nicht für Noten</span>
          </span>
          <input type="checkbox" checked={liga} onChange={(e) => setLiga(e.target.checked)} />
        </label>
        <label className="ar-schalter">
          <span className="flex-1">
            <span className="block text-[16px] font-semibold">Duelle spielen</span>
            <span className="ls-klein">nur mit einem Code, den du selbst weitergibst</span>
          </span>
          <input type="checkbox" checked={duelle} onChange={(e) => setDuelle(e.target.checked)} />
        </label>
      </div>

      {fehler && (
        <p className="ls-fehler mt-4" role="alert">
          {fehler}
        </p>
      )}
      <div className="mt-auto pt-8" style={{ "--n": 7 } as CSSProperties}>
        <button type="button" className="ls-knopf ls-los" onClick={() => void speichern()} disabled={sendet}>
          {neu ? "Los geht’s" : "Speichern"}
        </button>
      </div>
    </>
  );
}

// ---------- Wochenliga ----------

function Liga({ liga }: { liga: LigaTabelle }) {
  const grenze = liga.aufstieg && liga.zeilen.length > liga.aufstieg ? liga.aufstieg : 0;
  return (
    <section aria-labelledby="liga-titel">
      <div className="flex items-start gap-3" style={{ "--n": 0 } as CSSProperties}>
        <div className="flex-1">
          <h1 id="liga-titel" className="ls-titel">
            {liga.stufenName}-Liga
          </h1>
          <p className="ls-text mt-1 text-[15px]">
            {liga.aufstieg ? `Die ersten ${liga.aufstieg} steigen auf. Absteigen gibt es nicht.` : "Die höchste Liga. Halte dich vorne!"}
          </p>
        </div>
        <span className="ar-chip mt-2 shrink-0">
          <Hourglass size={14} aria-hidden />
          {liga.tageRest === 1 ? "noch heute" : `noch ${liga.tageRest} Tage`}
        </span>
      </div>
      <ol className="mt-4 grid gap-2" style={{ "--n": 1 } as CSSProperties}>
        {liga.zeilen.map((z, i) => (
          <li key={i} className="contents">
            {grenze > 0 && i === grenze && <span className="ar-trenn">▲ Aufstieg in die nächste Liga</span>}
            <div className="ar-reihe" data-ich={z.ich ? "" : undefined}>
              <span className="ar-platz">{z.platz}</span>
              <span className="ar-bild" aria-hidden>
                {z.bild}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-bold">
                  {z.name}
                  {z.ich ? " (du)" : ""}
                </span>
                <span className="block text-[12px] opacity-75">{z.runden === 1 ? "1 Runde" : `${z.runden} Runden`}</span>
              </span>
              <span className="ar-punkte">{z.punkte}</span>
            </div>
          </li>
        ))}
      </ol>
      {liga.zeilen.length === 1 && <p className="ls-klein mt-3">Noch spielt hier nur du. Sobald andere mitmachen, stehen sie hier.</p>}
      <p className="ls-blatt mt-4 px-4 py-3 text-[14px] leading-snug" style={{ "--n": 2 } as CSSProperties}>
        <b>So gibt es Punkte:</b> 20 je fertige Runde, bis 30 extra, wenn du besser bist als dein Schnitt. Höchstens 10 Runden am Tag zählen.
      </p>
    </section>
  );
}

// ---------- Duelle ----------

function Duelle({ token, duelle, spiele }: { token: string; duelle: DuellSicht[]; spiele: SpielArt[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [art, setArt] = useState<SpielArt>(spiele[0]);
  const [neu, setNeu] = useState<{ code: string } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [sendet, setSendet] = useState(false);
  const [kopiert, setKopiert] = useState(false);

  async function annehmen() {
    setSendet(true);
    setFehler(null);
    const r = await duellAnnehmenAction(token, code);
    setSendet(false);
    if (!r.ok) return setFehler(r.fehler);
    router.push(`/lernen/${token}/duell/${r.id}`);
  }

  async function erstellen() {
    setSendet(true);
    setFehler(null);
    const r = await duellErstellenAction(token, art);
    setSendet(false);
    if (!r.ok) return setFehler(r.fehler);
    setNeu({ code: r.code });
    router.refresh();
  }

  async function teilen(c: string) {
    const text = `Duell in DreamStudy (${SPIEL_TITEL[art]}): gib den Code ${c} unter „Liga und Duelle“ ein.`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(c);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 1800);
    } catch {
      /* abgebrochen */
    }
  }

  return (
    <section aria-labelledby="duelle-titel" className="mt-8">
      <h2 id="duelle-titel" className="display flex items-center gap-2 text-[26px] font-extrabold" style={{ "--n": 3 } as CSSProperties}>
        <Swords size={24} aria-hidden /> Duelle
      </h2>
      <p className="ls-text mt-1 text-[15px]" style={{ "--n": 3 } as CSSProperties}>
        Beide spielen dieselben 12 Karten, jeder wann er Zeit hat. Wer mehr beim ersten Mal richtig hat, gewinnt.
      </p>

      <div className="ls-glas mt-4 p-4" style={{ "--n": 4 } as CSSProperties}>
        <label htmlFor="duell-code" className="text-[15px] font-semibold">
          Code bekommen?
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="duell-code"
            className="ar-eingabe"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="K7FX"
            autoComplete="off"
            autoCapitalize="characters"
            inputMode="text"
            onKeyDown={(e) => {
              if (e.key === "Enter" && code.length >= 4) void annehmen();
            }}
          />
          <button type="button" className="ls-knopf shrink-0 px-5" onClick={() => void annehmen()} disabled={sendet || code.trim().length < 4}>
            Annehmen
          </button>
        </div>
      </div>

      <div className="ls-glas mt-3 p-4" style={{ "--n": 5 } as CSSProperties}>
        {neu ? (
          <div className="text-center">
            <p className="ls-klein">Dein Code für {SPIEL_TITEL[art]}</p>
            <p className="ar-code mt-1">{neu.code}</p>
            <p className="ls-klein mt-1">Gib ihn weiter. Er gilt 48 Stunden.</p>
            <button type="button" className="ls-knopf ls-los mt-4" onClick={() => void teilen(neu.code)}>
              {kopiert ? <Check size={20} aria-hidden /> : typeof navigator !== "undefined" && "share" in navigator ? <Share2 size={20} aria-hidden /> : <Copy size={20} aria-hidden />}
              <span className="ml-2">{kopiert ? "Kopiert" : "Code teilen"}</span>
            </button>
            <button type="button" className="mt-3 text-[14px] font-semibold underline" onClick={() => setNeu(null)}>
              Noch ein Duell
            </button>
          </div>
        ) : (
          <>
            <p className="text-[15px] font-semibold">Jemanden herausfordern</p>
            {spiele.length > 1 && (
              <div className="ar-wahl mt-3" role="group" aria-label="Spiel">
                {spiele.map((s) => (
                  <button key={s} type="button" className="ohne-druck" aria-pressed={s === art} onClick={() => setArt(s)}>
                    {SPIEL_TITEL[s]}
                  </button>
                ))}
              </div>
            )}
            <button type="button" className="ls-knopf ls-los mt-4" onClick={() => void erstellen()} disabled={sendet}>
              Neues Duell · Code holen
            </button>
          </>
        )}
      </div>

      {fehler && (
        <p className="ls-fehler mt-3" role="alert">
          {fehler}
        </p>
      )}

      {duelle.length > 0 && (
        <>
          <p className="ar-abschnitt">Deine Duelle</p>
          <ul className="mt-2 grid gap-2">
            {duelle.map((d) => (
              <li key={d.id}>
                <DuellZeile token={token} d={d} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function DuellZeile({ token, d }: { token: string; d: DuellSicht }) {
  const g = d.gegner;
  const text =
    d.status === "offen"
      ? `Code ${d.code}: wartet auf jemanden`
      : d.binDran
        ? `Du bist dran${g?.fertig ? `: ${g.name} hat schon ${g.richtig} richtig` : ""}`
        : d.status === "laeuft"
          ? `Wartet auf ${g?.name ?? "den anderen"}`
          : d.ausgang === "gewonnen"
            ? `Gewonnen ${d.ich.richtig} : ${g?.richtig ?? 0}`
            : d.ausgang === "verloren"
              ? `Knapp verloren ${d.ich.richtig} : ${g?.richtig ?? 0}`
              : `Unentschieden ${d.ich.richtig} : ${g?.richtig ?? 0}`;
  return (
    <Link href={`/lernen/${token}/duell/${d.id}`} className="ar-duell" data-dran={d.binDran ? "" : undefined}>
      <span className="ar-bild" aria-hidden>
        {g?.bild ?? "❔"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold">{g?.name ?? "Noch offen"}</span>
        <span className="block text-[13px] opacity-80">
          {SPIEL_TITEL[d.art]} · {text}
        </span>
      </span>
      {d.ausgang === "gewonnen" ? <Trophy size={20} className="text-[var(--ls-gold)]" aria-hidden /> : <ChevronRight size={20} aria-hidden />}
    </Link>
  );
}

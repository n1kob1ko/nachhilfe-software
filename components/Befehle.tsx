"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { befehlTreffer } from "@/lib/befehl-suche";
import { CalendarDays, ClipboardCheck, CornerDownLeft, FileText, GraduationCap, LayoutGrid, Plus, Search, User, UserPlus, Users, type LucideIcon } from "lucide-react";

/**
 * Befehlsmenü (niko, 13.11.2026: „Command Menu“, „Shortcut Hints“): am Laptop öffnet Strg+K (am Mac ⌘K) ein Feld, in
 * dem man einen Namen oder eine Seite tippt und mit Enter dort ist. Bibliothek: cmdk (Suche, Pfeiltasten, Auswahl).
 *
 * - Leer zeigt es nur das Nötigste: die fünf Bereiche und zwei Aktionen. Schüler und alle Seiten von „Erweitert“
 *   erscheinen erst beim Tippen, damit niemand eine Liste von sechzig Zeilen lesen muss.
 * - Es öffnet und schließt ohne Bewegung: wer es mit der Tastatur ruft, tut das oft am Tag und soll nie warten.
 * - `BefehleKnopf` steht in der Leiste links („Suchen … Strg K“): so findet man das Kürzel, und am Tablet tippt man es.
 * - Im Whiteboard gehört Strg+K dem Whiteboard (Link einfügen).
 */

export type BefehlSeite = { href: string; label: string; hint?: string };
export type BefehlSchueler = { id: number; name: string; klasse: string };

let offen = false;
const hoerer = new Set<() => void>();
function setze(v: boolean) {
  if (offen === v) return;
  offen = v;
  for (const h of hoerer) h();
}
function abonniere(h: () => void) {
  hoerer.add(h);
  return () => {
    hoerer.delete(h);
  };
}
const useOffen = () =>
  useSyncExternalStore(
    abonniere,
    () => offen,
    () => false,
  );

const keinAbo = () => () => {};
/** Am Mac heißt die Taste ⌘, sonst Strg. Erst im Browser bekannt, am Server „Strg“. */
const useMac = () =>
  useSyncExternalStore(
    keinAbo,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );

const BEREICHE: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Heute", icon: CalendarDays },
  { href: "/unterricht", label: "Unterricht", icon: GraduationCap },
  { href: "/abschluss", label: "Abschluss", icon: ClipboardCheck },
  { href: "/schueler", label: "Schüler", icon: Users },
  { href: "/mehr", label: "Erweitert", icon: LayoutGrid },
];
const AKTIONEN: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/uebungen/neu", label: "Übung erstellen", icon: Plus },
  { href: "/schueler/neu", label: "Neuer Schüler", icon: UserPlus },
];

/** Einmal im Rahmen der Lehrkraft (app/(tutor)/layout.tsx). */
export function Befehle({ seiten, schueler }: { seiten: BefehlSeite[]; schueler: BefehlSchueler[] }) {
  const router = useRouter();
  const istOffen = useOffen();
  const dialog = useRef<HTMLDialogElement>(null);
  const [suche, setSuche] = useState("");

  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "k") return;
      if (e.target instanceof Element && e.target.closest(".excalidraw")) return;
      e.preventDefault();
      setze(!offen);
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (istOffen && !d.open) {
      d.showModal();
      // showModal nimmt das erste Fokussierbare, und das ist der Rahmen von cmdk, nicht das Feld
      d.querySelector<HTMLInputElement>("[cmdk-input]")?.focus();
    }
    if (!istOffen && d.open) d.close();
  }, [istOffen]);

  const los = (href: string) => {
    setze(false);
    router.push(href);
  };

  // zwei Schüler mit gleichem Namen und gleicher Klasse brauchen verschiedene Werte, sonst wählt cmdk beide zugleich
  const gesehen = new Map<string, number>();
  const schuelerZeilen = schueler.map((s) => {
    const basis = s.klasse ? `${s.name} ${s.klasse}` : s.name;
    const n = (gesehen.get(basis) ?? 0) + 1;
    gesehen.set(basis, n);
    return { ...s, wert: n > 1 ? `${basis} (${n})` : basis };
  });
  const bekannt = new Set([...BEREICHE, ...AKTIONEN].map((b) => b.href));
  const weitere = seiten.filter((s) => !bekannt.has(s.href));
  const tippt = suche.trim().length > 0;

  return (
    <dialog
      ref={dialog}
      className="befehle"
      aria-label="Suchen und springen"
      onClose={() => {
        setze(false);
        setSuche("");
      }}
      onClick={(e) => e.target === e.currentTarget && setze(false)}
    >
      {istOffen && (
        <Command label="Suchen und springen" filter={befehlTreffer} loop>
          <div className="befehle-kopf">
            <Search size={18} aria-hidden />
            <Command.Input value={suche} onValueChange={setSuche} placeholder="Schüler oder Seite suchen" />
          </div>
          <Command.List>
            <Command.Empty>Nichts gefunden.</Command.Empty>
            {tippt && schuelerZeilen.length > 0 && (
              <Command.Group heading="Schüler">
                {schuelerZeilen.map((s) => (
                  <Command.Item key={s.id} value={s.wert} onSelect={() => los(`/schueler/${s.id}`)}>
                    <User size={17} aria-hidden />
                    <span className="befehle-name">{s.name}</span>
                    {s.klasse && <span className="befehle-neben">{s.klasse}</span>}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            <Command.Group heading="Gehe zu">
              {BEREICHE.map(({ href, label, icon: Icon }) => (
                <Command.Item key={href} value={label} onSelect={() => los(href)}>
                  <Icon size={17} aria-hidden />
                  <span className="befehle-name">{label}</span>
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Aktionen">
              {AKTIONEN.map(({ href, label, icon: Icon }) => (
                <Command.Item key={href} value={label} onSelect={() => los(href)}>
                  <Icon size={17} aria-hidden />
                  <span className="befehle-name">{label}</span>
                </Command.Item>
              ))}
            </Command.Group>
            {tippt && weitere.length > 0 && (
              <Command.Group heading="Erweitert">
                {weitere.map((s) => (
                  <Command.Item key={s.href} value={s.label} keywords={s.hint ? [s.hint] : undefined} onSelect={() => los(s.href)}>
                    <FileText size={17} aria-hidden />
                    <span className="befehle-name">{s.label}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
          <p className="befehle-fuss" aria-hidden>
            {tippt ? (
              <>
                <kbd>↑</kbd>
                <kbd>↓</kbd> wählen
                <kbd>
                  <CornerDownLeft size={11} />
                </kbd>
                öffnen
                <kbd>Esc</kbd> schließen
              </>
            ) : (
              "Tippe einen Namen oder eine Seite."
            )}
          </p>
        </Command>
      )}
    </dialog>
  );
}

/** Der Hinweis in der Leiste links: zeigt das Kürzel und öffnet das Menü auch per Tipp. */
export function BefehleKnopf() {
  const mac = useMac();
  return (
    <button
      type="button"
      onClick={() => setze(true)}
      aria-keyshortcuts="Control+K Meta+K"
      className="treffer flex min-h-[40px] w-full items-center gap-2.5 rounded-full border border-line bg-surface/60 pr-2.5 pl-3.5 text-[14px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2"
    >
      <Search size={16} aria-hidden />
      <span className="flex-1 text-left">Suchen</span>
      <kbd className="befehle-kuerzel">{mac ? "⌘ K" : "Strg K"}</kbd>
    </button>
  );
}

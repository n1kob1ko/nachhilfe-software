/** Überschrift einer Seite der Schüler-App (Termine, Prüfungen, Fortschritt); Start hat stattdessen die Bühne. */
export function SeitenKopf({ titel, text }: { titel: string; text?: string }) {
  return (
    <div className="mb-2">
      <h1 className="text-[28px] font-semibold tracking-[-0.02em] md:text-[32px]">{titel}</h1>
      {text && <p className="mt-1 text-[16px] text-ink-2">{text}</p>}
    </div>
  );
}

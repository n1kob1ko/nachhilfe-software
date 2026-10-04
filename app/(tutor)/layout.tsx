import { Brand, Nav } from "@/components/Nav";
import { aiEnabled } from "@/lib/ai";
import { backfillAutoDocs } from "@/lib/autodoc";
import { Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default function TutorLayout({ children }: { children: React.ReactNode }) {
  const ai = aiEnabled();
  backfillAutoDocs();
  return (
    <div className="md:grid md:min-h-screen md:grid-cols-[220px_1fr]">
      <aside className="no-print border-b border-line bg-panel px-3 py-3 md:sticky md:top-0 md:flex md:h-screen md:flex-col md:border-r md:border-b-0 md:py-5">
        <div className="flex flex-col gap-2 md:block">
          <Brand />
          <div className="-mx-3 overflow-x-auto px-3 md:mx-0 md:mt-6 md:px-0">
            <Nav />
          </div>
        </div>
        <p className="mt-auto hidden items-start gap-2 px-3 text-[12px] leading-snug text-ink-3 md:flex">
          <Sparkles size={14} className={`mt-0.5 shrink-0 ${ai ? "text-accent" : ""}`} aria-hidden />
          {ai ? "KI aktiv: Übungen und Analysen mit Claude." : "Ohne KI-Schlüssel: eingebaute Aufgabengeneratoren."}
        </p>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-10 md:py-9">
        <div className="mx-auto max-w-[1160px]">{children}</div>
      </main>
    </div>
  );
}

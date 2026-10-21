import { ThemeToggle } from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";
export const metadata = { title: "Lernheft – Mitmachen", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** The student's own laptop during one unit: no navigation of the teacher app, nothing but the unit's work. */
export default function LaptopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <ThemeToggle className="fixed top-3 right-3 z-30" />
      {children}
    </div>
  );
}

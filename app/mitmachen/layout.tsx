export const dynamic = "force-dynamic";
export const metadata = { title: "Lernheft – Mitmachen", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** The student's own laptop during one unit: no navigation of the teacher app, nothing but the unit's work. */
export default function LaptopLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[radial-gradient(120%_80%_at_0%_0%,var(--backdrop-2),var(--paper)_55%)]">{children}</div>;
}

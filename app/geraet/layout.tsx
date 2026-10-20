export const dynamic = "force-dynamic";
export const metadata = { title: "Schüler-Tablet", robots: { index: false }, appleWebApp: { capable: true, title: "Lernheft" } };
export const viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: "cover" };

/** The student tablet: no navigation, nothing but what the running unit needs. */
export default function DeviceLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-paper">{children}</div>;
}

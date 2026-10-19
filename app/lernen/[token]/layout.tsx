import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getStudentByToken } from "@/lib/repo";
import { Avatar } from "@/components/Art";
import { BrandMark } from "@/components/Brand";

export const dynamic = "force-dynamic";

// „Zum Home-Bildschirm“ macht aus dem Link eine App, die genau diesen Schüler öffnet
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  return {
    manifest: `/lernen/${encodeURIComponent(token)}/manifest`,
    appleWebApp: { capable: true, title: "Lernheft", statusBarStyle: "default" },
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = { themeColor: "#fbf6f1" };

export default async function LearnLayout({ children, params }: { children: React.ReactNode; params: Promise<{ token: string }> }) {
  const { token } = await params;
  const student = getStudentByToken(token);
  if (!student) notFound();
  return (
    <div className="min-h-screen bg-[radial-gradient(120%_80%_at_0%_0%,var(--backdrop-2),var(--paper)_55%)]">
      <header>
        <div className="mx-auto flex max-w-[860px] items-center justify-between px-4 py-3">
          <a href={`/lernen/${token}`} className="display flex items-center gap-2.5 text-[17px] font-semibold">
            <BrandMark height={36} />
            Lernheft
          </a>
          <span className="flex items-center gap-2 rounded-full bg-surface py-1 pr-3 pl-1 text-[14px] font-medium shadow-[var(--shadow-card)]">
            <Avatar name={student.name} size={28} />
            {student.name}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-[860px] px-4 py-6 has-[.lesen-breit]:max-w-[1320px] md:py-10">{children}</main>
    </div>
  );
}

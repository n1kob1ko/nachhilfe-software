import { NotebookPen } from "lucide-react";
import { notFound } from "next/navigation";
import { getStudentByToken } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function LearnLayout({ children, params }: { children: React.ReactNode; params: Promise<{ token: string }> }) {
  const { token } = await params;
  const student = getStudentByToken(token);
  if (!student) notFound();
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-[860px] items-center justify-between px-4 py-3">
          <a href={`/lernen/${token}`} className="flex items-center gap-2 text-[17px] font-semibold">
            <NotebookPen size={20} strokeWidth={1.75} className="text-accent" aria-hidden /> Lernheft
          </a>
          <span className="text-[14px] text-ink-2">{student.name}</span>
        </div>
      </header>
      <main className="mx-auto max-w-[860px] px-4 py-8 md:py-12">{children}</main>
    </div>
  );
}

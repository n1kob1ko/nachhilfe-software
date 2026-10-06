import { redirect } from "next/navigation";
import { NotebookPen } from "lucide-react";
import { LoginForm } from "@/components/AuthForms";
import { currentTeacher } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Anmelden" };

export default async function Login({ searchParams }: { searchParams: Promise<{ weiter?: string }> }) {
  if (await currentTeacher()) redirect("/");
  const { weiter } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex items-center gap-2 text-[20px] font-semibold tracking-[-0.01em]">
          <NotebookPen size={22} strokeWidth={1.75} className="text-accent" aria-hidden />
          Lernheft
        </div>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Anmelden</h1>
        <p className="mt-1 mb-6 text-ink-2">Mit deinem Lehrer-Account.</p>
        <div className="panel px-5 py-5">
          <LoginForm next={weiter} />
        </div>
        <p className="mt-4 text-[13px] text-ink-3">Schüler brauchen keinen Account.</p>
      </div>
    </main>
  );
}

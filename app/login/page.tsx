import { redirect } from "next/navigation";
import { LoginForm } from "@/components/AuthForms";
import { BrandLogo } from "@/components/Brand";
import { currentTeacher } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Anmelden" };

export default async function Login({ searchParams }: { searchParams: Promise<{ weiter?: string }> }) {
  if (await currentTeacher()) redirect("/");
  const { weiter } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4 py-10">
      <div className="w-full max-w-[400px]">
        <BrandLogo width={210} className="mx-auto mb-8 h-auto w-[150px] md:w-[210px]" />
        <div className="panel px-6 py-6 md:px-7 md:py-7">
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Anmelden</h1>
          <p className="mt-1 mb-5 text-[14px] text-ink-2">Mit deinem Lehrer-Account im Lernheft.</p>
          <LoginForm next={weiter} />
        </div>
        <p className="mt-4 text-center text-[13px] text-ink-3">Schüler brauchen keinen Account, sie öffnen ihren Link.</p>
      </div>
    </main>
  );
}

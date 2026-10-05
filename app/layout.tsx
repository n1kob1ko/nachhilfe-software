import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Poppins } from "next/font/google";
import "./globals.css";

// Poppins for headings and big numbers, Plus Jakarta Sans (tabular figures) for everything else
const poppins = Poppins({ subsets: ["latin", "latin-ext"], weight: ["500", "600", "700"], variable: "--font-poppins", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Lernheft", template: "%s · Lernheft" },
  description: "Nachhilfe-Software: Schülerprofile, Stundendokumentation, Übungen, Fortschritt und Empfehlungen.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${poppins.variable} ${jakarta.variable}`}>
      <body className="min-h-screen font-sans text-[15px] leading-normal">{children}</body>
    </html>
  );
}

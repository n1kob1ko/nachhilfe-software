import type { Metadata, Viewport } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Outfit for headings and big numbers, Plus Jakarta Sans (tabular figures) for everything else
const outfit = Outfit({ subsets: ["latin", "latin-ext"], weight: ["500", "600", "700"], variable: "--font-outfit", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Lernheft", template: "%s · Lernheft" },
  description: "Nachhilfe-Software: Schülerprofile, Dokumentation jeder Einheit, Übungen, Fortschritt und Empfehlungen.",
};

export const viewport: Viewport = { themeColor: "#f5f8fc" };

// Dunkelmodus: die gemerkte Wahl kommt vor dem ersten Bild ans <html>, sonst blitzt die Seite kurz hell auf.
// Der Knopf dazu ist components/ThemeToggle.tsx; ohne Wahl bleibt es hell.
const THEME_SKRIPT = 'try{if(localStorage.getItem("lernheft-theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${outfit.variable} ${jakarta.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SKRIPT }} />
      </head>
      <body className="min-h-screen font-sans text-[15px] leading-normal">{children}</body>
    </html>
  );
}

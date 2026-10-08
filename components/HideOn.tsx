"use client";

import { usePathname } from "next/navigation";

/** Hides server-rendered content on pages that already show it in their own way. */
export function HideOn({ paths, prefixes = [], children }: { paths: string[]; prefixes?: string[]; children: React.ReactNode }) {
  const path = usePathname();
  return paths.includes(path) || prefixes.some((p) => path.startsWith(p)) ? null : children;
}

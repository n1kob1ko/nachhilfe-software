"use client";

import { usePathname } from "next/navigation";

/** Hides server-rendered content on pages that already show it in their own way. */
export function HideOn({ paths, children }: { paths: string[]; children: React.ReactNode }) {
  const path = usePathname();
  return paths.includes(path) ? null : children;
}

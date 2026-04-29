"use client";

import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/dashboard":    { title: "Dashboard",      subtitle: "Overview of all scan activity" },
  "/scans":        { title: "Static Scans",   subtitle: "Source code and dependency analysis" },
  "/scans/new":    { title: "New Scan",        subtitle: "Configure and launch a static analysis scan" },
  "/dynamic":      { title: "Dynamic Tests",  subtitle: "Runtime vulnerability testing" },
  "/dynamic/new":  { title: "New Dynamic Test", subtitle: "Configure a DAST scan against a live target" },
  "/scorecard":    { title: "Scorecard",      subtitle: "Aggregate security score across all projects" },
  "/integrations": { title: "Integrations",   subtitle: "Connect your toolchain" },
  "/settings":     { title: "Settings",       subtitle: "Account and workspace preferences" },
};

export function TopBar() {
  const pathname = usePathname();
  const meta = PAGE_TITLES[pathname] ??
    (pathname.startsWith("/scans/") ? { title: "Scan Results", subtitle: "Detailed findings and risk score" } :
     pathname.startsWith("/dynamic/") ? { title: "Test Results", subtitle: "Dynamic test findings by endpoint" } :
     { title: "DeployGuard", subtitle: "" });

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-sidebar shrink-0">
      <div>
        <h1 className="text-sm font-semibold text-foreground">{meta.title}</h1>
        {meta.subtitle && <p className="text-xs text-muted-foreground">{meta.subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-2 text-xs text-muted-foreground bg-accent hover:bg-accent/80 border border-border rounded-md px-3 py-1.5 transition-colors">
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search…</span>
          <kbd className="hidden sm:inline text-[10px] font-mono bg-background border border-border rounded px-1">⌘K</kbd>
        </button>
        <button className="relative p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
        </button>
      </div>
    </header>
  );
}

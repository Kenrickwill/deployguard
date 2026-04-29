"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  LayoutDashboard,
  ScanLine,
  Zap,
  Activity,
  Plug,
  Settings,
  Plus,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard",    label: "Dashboard",      icon: LayoutDashboard },
  { href: "/scans",        label: "Static Scans",   icon: ScanLine },
  { href: "/dynamic",      label: "Dynamic Tests",  icon: Zap },
  { href: "/scorecard",    label: "Scorecard",      icon: Activity },
  { href: "/integrations", label: "Integrations",   icon: Plug },
  { href: "/settings",     label: "Settings",       icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-border flex flex-col bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border">
        <ShieldCheck className="h-4.5 w-4.5 text-primary shrink-0" style={{ width: "18px", height: "18px" }} />
        <span className="font-semibold text-sm tracking-tight">DeployGuard</span>
      </div>

      {/* Quick action */}
      <div className="px-3 pt-4 pb-2">
        <Link
          href="/scans/new"
          className="flex items-center justify-center gap-1.5 w-full text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-md px-3 py-2 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Scan
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center justify-between px-2.5 py-2 rounded-md text-sm transition-all",
                active
                  ? "bg-primary/12 text-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                {label}
              </div>
              {active && <ChevronRight className="h-3.5 w-3.5 text-primary opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
            K
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">Kenrick Williams</p>
            <p className="text-[10px] text-muted-foreground">Admin</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 font-mono">v0.1.0-alpha</p>
      </div>
    </aside>
  );
}

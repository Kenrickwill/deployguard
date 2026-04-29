"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  User, Key, Bell, Shield, Trash2, Copy, Eye, EyeOff,
  CheckCircle2, RefreshCw, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_KEYS = [
  { id: "key-1", name: "CI Pipeline",       prefix: "dg_live_K7Mn...", created: "Apr 12, 2026", lastUsed: "2 min ago",  scopes: ["scan:read", "scan:write"] },
  { id: "key-2", name: "VS Code Extension", prefix: "dg_live_X9Pk...", created: "Mar 28, 2026", lastUsed: "1 hour ago", scopes: ["scan:read"] },
  { id: "key-3", name: "Staging webhook",   prefix: "dg_live_Q2Jw...", created: "Feb 14, 2026", lastUsed: "Yesterday",  scopes: ["webhook:receive"] },
];

const NOTIF_OPTS = [
  { id: "block",    label: "Deploy blocked",      desc: "Critical findings prevent deployment",       defaultOn: true },
  { id: "review",   label: "Review required",      desc: "High findings need attention before merge",  defaultOn: true },
  { id: "complete", label: "Scan complete",        desc: "Every scan result, regardless of verdict",   defaultOn: false },
  { id: "weekly",   label: "Weekly digest",        desc: "Score trends and top findings summary email", defaultOn: true },
];

const THRESHOLD_OPTS = [
  { value: "critical", label: "Critical only",      desc: "Only block on critical findings" },
  { value: "high",     label: "Critical + High",    desc: "Block on critical or high findings" },
  { value: "medium",   label: "All findings ≥ Med", desc: "Strictest — block on medium+" },
];

type Section = "profile" | "api-keys" | "notifications" | "danger";

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<Section>("profile");
  const [showKey, setShowKey] = useState<string | null>(null);
  const [notifs, setNotifs] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTIF_OPTS.map(o => [o.id, o.defaultOn])),
  );
  const [blockThreshold, setBlockThreshold] = useState("high");
  const [minScore, setMinScore] = useState(70);
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const NAV: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: "profile",       label: "Profile",       icon: <User className="h-4 w-4" /> },
    { id: "api-keys",      label: "API Keys",       icon: <Key className="h-4 w-4" /> },
    { id: "notifications", label: "Notifications",  icon: <Bell className="h-4 w-4" /> },
    { id: "danger",        label: "Danger Zone",    icon: <Trash2 className="h-4 w-4" /> },
  ];

  return (
    <div className="flex gap-8 max-w-5xl">
      {/* Left nav */}
      <nav className="w-44 shrink-0 space-y-0.5">
        {NAV.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left",
              activeSection === id
                ? "bg-accent text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              id === "danger" && "text-red-400 hover:text-red-400",
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 space-y-5">

        {/* Profile */}
        {activeSection === "profile" && (
          <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
            <div className="rounded-xl border border-border bg-card p-6 space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Profile</h2>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
                  K
                </div>
                <button className="text-xs border border-border rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors">
                  Change avatar
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Full name</label>
                  <input
                    type="text"
                    defaultValue="Kenrick Williams"
                    className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <input
                    type="email"
                    defaultValue="kenrick@example.com"
                    className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Role</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground">Admin</span>
                  <span className="text-[11px] font-mono text-primary bg-primary/10 border border-primary/20 rounded px-2 py-0.5">ADMIN</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={save}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                    saved ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  {saved ? <><CheckCircle2 className="h-4 w-4" /> Saved</> : "Save changes"}
                </button>
              </div>
            </div>

            {/* Security */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Security</h2>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div>
                  <p className="text-sm">Password</p>
                  <p className="text-xs text-muted-foreground">Last changed 3 months ago</p>
                </div>
                <button className="text-xs border border-border rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors">
                  Change
                </button>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm">Two-factor authentication</p>
                  <p className="text-xs text-muted-foreground">Not configured</p>
                </div>
                <button className="text-xs bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:bg-primary/90 transition-colors">
                  Enable 2FA
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* API Keys */}
        {activeSection === "api-keys" && (
          <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold">API Keys</h2>
                </div>
                <button className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:bg-primary/90 transition-colors">
                  <Key className="h-3 w-3" /> Generate key
                </button>
              </div>

              <div className="divide-y divide-border">
                {API_KEYS.map(key => (
                  <div key={key.id} className="flex items-start gap-4 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium">{key.name}</p>
                        <div className="flex gap-1">
                          {key.scopes.map(s => (
                            <span key={s} className="text-[10px] font-mono text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                        <span>{showKey === key.id ? "dg_live_K7MnXpQ2W9..." : key.prefix}</span>
                        <button
                          onClick={() => setShowKey(showKey === key.id ? null : key.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showKey === key.id ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button className="text-muted-foreground hover:text-foreground transition-colors">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Created {key.created} · Last used {key.lastUsed}
                      </p>
                    </div>
                    <button className="text-red-400/60 hover:text-red-400 transition-colors p-1.5 rounded-md hover:bg-red-400/10">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                API keys grant programmatic access to DeployGuard. Treat them like passwords — store them in CI/CD secrets, never in source code.
                All keys are scoped: <code className="font-mono">scan:write</code> to trigger scans, <code className="font-mono">scan:read</code> to fetch results, <code className="font-mono">webhook:receive</code> for inbound events.
              </p>
            </div>
          </motion.div>
        )}

        {/* Notifications */}
        {activeSection === "notifications" && (
          <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
            <div className="rounded-xl border border-border bg-card p-6 space-y-5">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Notifications</h2>
              </div>

              <div className="space-y-3">
                {NOTIF_OPTS.map(({ id, label, desc }) => (
                  <div key={id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <button
                      onClick={() => setNotifs(n => ({ ...n, [id]: !n[id] }))}
                      className={cn(
                        "w-9 h-5 rounded-full border transition-all relative shrink-0",
                        notifs[id] ? "bg-primary border-primary" : "bg-muted border-border",
                      )}
                    >
                      <div className={cn(
                        "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                        notifs[id] ? "left-4" : "left-0.5",
                      )} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Scan policy */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-5">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Scan policy</h2>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Block threshold</label>
                <div className="space-y-2">
                  {THRESHOLD_OPTS.map(({ value, label, desc }) => (
                    <button
                      key={value}
                      onClick={() => setBlockThreshold(value)}
                      className={cn(
                        "w-full flex items-center gap-3 border rounded-lg p-3 text-left transition-all",
                        blockThreshold === value ? "border-primary/30 bg-primary/5" : "border-border hover:border-border/70",
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 rounded-full border flex items-center justify-center shrink-0",
                        blockThreshold === value ? "border-primary" : "border-border",
                      )}>
                        {blockThreshold === value && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{label}</p>
                        <p className="text-[11px] text-muted-foreground">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Minimum passing score</label>
                  <span className="text-xs font-mono text-foreground">{minScore}</span>
                </div>
                <input
                  type="range" min={0} max={100} value={minScore}
                  onChange={e => setMinScore(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0 (no minimum)</span>
                  <span>100 (perfect score required)</span>
                </div>
              </div>

              <button
                onClick={save}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                  saved ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                {saved ? <><CheckCircle2 className="h-4 w-4" /> Saved</> : "Save policy"}
              </button>
            </div>
          </motion.div>
        )}

        {/* Danger Zone */}
        {activeSection === "danger" && (
          <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 space-y-5">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="h-4 w-4" />
                <h2 className="text-sm font-semibold">Danger Zone</h2>
              </div>

              {[
                {
                  title: "Reset scan history",
                  desc: "Permanently delete all scan results, findings, and reports. This cannot be undone.",
                  action: "Reset history",
                  icon: RefreshCw,
                },
                {
                  title: "Delete all integrations",
                  desc: "Disconnect all external services and delete stored credentials.",
                  action: "Delete integrations",
                  icon: Trash2,
                },
                {
                  title: "Delete workspace",
                  desc: "Permanently delete this workspace, all projects, scans, and members. Irreversible.",
                  action: "Delete workspace",
                  icon: Trash2,
                },
              ].map(({ title, desc, action, icon: Icon }) => (
                <div key={title} className="flex items-start justify-between gap-4 py-4 border-b border-red-500/10 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                  <button className="flex items-center gap-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-md px-3 py-1.5 text-xs font-medium transition-colors shrink-0">
                    <Icon className="h-3.5 w-3.5" /> {action}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

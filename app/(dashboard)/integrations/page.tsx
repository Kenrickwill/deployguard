"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch, GitMerge, MessageSquare, Ticket, Bell, AlertCircle,
  CheckCircle2, X, ChevronRight, ExternalLink, Copy, Eye, EyeOff, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

type IntegrationId = "github" | "gitlab" | "slack" | "jira" | "pagerduty";

interface Integration {
  id: IntegrationId;
  name: string;
  description: string;
  icon: React.ReactNode;
  connected: boolean;
  badge?: string;
  features: string[];
}

const INTEGRATIONS: Integration[] = [
  {
    id: "github",
    name: "GitHub",
    description: "Post scan results as PR comments, set commit status checks, and block merges on critical findings.",
    icon: <GitBranch className="h-6 w-6" />,
    connected: true,
    badge: "Connected",
    features: ["PR comments", "Commit status", "Merge gating", "Webhook trigger"],
  },
  {
    id: "gitlab",
    name: "GitLab",
    description: "Integrate DeployGuard with GitLab CI/CD pipelines and merge request approval flows.",
    icon: <GitMerge className="h-6 w-6" />,
    connected: false,
    features: ["MR comments", "Pipeline status", "Merge approval", "Webhook trigger"],
  },
  {
    id: "slack",
    name: "Slack",
    description: "Get real-time scan notifications in your channels. Ping on-call when a deploy is blocked.",
    icon: <MessageSquare className="h-6 w-6" />,
    connected: true,
    badge: "Connected",
    features: ["Scan complete alerts", "Block/review pings", "Custom channels", "Rich formatting"],
  },
  {
    id: "jira",
    name: "Jira",
    description: "Automatically create tickets for critical and high-severity findings in your project board.",
    icon: <Ticket className="h-6 w-6" />,
    connected: false,
    features: ["Auto ticket creation", "Severity mapping", "Custom issue type", "Two-way sync"],
  },
  {
    id: "pagerduty",
    name: "PagerDuty",
    description: "Page on-call engineers immediately when a production deployment is blocked by critical findings.",
    icon: <AlertCircle className="h-6 w-6" />,
    connected: false,
    features: ["Block escalation", "Severity routing", "Custom alert body", "Auto-resolve"],
  },
];

function ConfigPanel({
  integration,
  onClose,
}: {
  integration: Integration;
  onClose: () => void;
}) {
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1000);
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 32 }}
      className="fixed inset-y-0 right-0 z-50 w-[420px] border-l border-border bg-card shadow-2xl flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
            {integration.icon}
          </div>
          <div>
            <p className="text-sm font-semibold">{integration.name}</p>
            <p className="text-xs text-muted-foreground">Configure integration</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Features */}
        <div className="rounded-lg border border-border bg-background/40 p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground mb-2">What you get</p>
          {integration.features.map(f => (
            <div key={f} className="flex items-center gap-2 text-xs text-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              {f}
            </div>
          ))}
        </div>

        {/* Fields */}
        {integration.id === "github" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Personal Access Token</label>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  defaultValue="ghp_••••••••••••••••••••••••••••••••••••"
                  className="w-full bg-background border border-border rounded-md px-3 pr-9 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
                <button
                  onClick={() => setShowToken(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">Needs repo + pull_requests + statuses scopes.</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Organisation / Repo (optional)</label>
              <input
                type="text"
                placeholder="my-org/my-repo"
                className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">Block merges on critical findings</label>
              <div className="w-9 h-5 rounded-full bg-primary border border-primary relative cursor-pointer">
                <div className="absolute top-0.5 left-4 w-4 h-4 rounded-full bg-white shadow" />
              </div>
            </div>
          </div>
        )}

        {integration.id === "slack" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Webhook URL</label>
              <input
                type="password"
                defaultValue="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX"
                className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Channel</label>
              <input
                type="text"
                defaultValue="#security-alerts"
                className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Notify on</p>
              {["Block verdict", "Review verdict", "Deploy verdict"].map(opt => (
                <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" defaultChecked={opt !== "Deploy verdict"} className="accent-primary" />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        )}

        {(integration.id === "gitlab" || integration.id === "jira" || integration.id === "pagerduty") && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                {integration.id === "pagerduty" ? "Routing Key" : integration.id === "jira" ? "API Token" : "Access Token"}
              </label>
              <input
                type="password"
                placeholder="Paste your token…"
                className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
              />
            </div>
            {integration.id === "jira" && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Host</label>
                  <input type="text" placeholder="yourorg.atlassian.net" className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Project key</label>
                  <input type="text" placeholder="SEC" className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors" />
                </div>
              </>
            )}
          </div>
        )}

        {/* Docs link */}
        <a
          href="#"
          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View {integration.name} integration docs
        </a>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border flex gap-3">
        <button onClick={onClose} className="flex-1 border border-border rounded-md py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </button>
        <button
          onClick={save}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all",
            saved ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {saved ? <><CheckCircle2 className="h-4 w-4" /> Saved!</> : "Save & Connect"}
        </button>
      </div>
    </motion.div>
  );
}

export default function IntegrationsPage() {
  const [active, setActive] = useState<Integration | null>(null);

  return (
    <div className="space-y-6">
      {/* Webhook URL */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold mb-1">Inbound webhook</p>
            <p className="text-xs text-muted-foreground mb-3">
              POST scan results from any CI pipeline to this URL.
            </p>
            <div className="flex items-center gap-2">
              <code className="font-mono text-xs bg-background border border-border rounded px-2 py-1 text-muted-foreground">
                https://deployguard.app/api/webhook/proj_01HZQ
              </code>
              <button className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-md px-2.5 py-1 shrink-0">
            <Zap className="h-3 w-3" /> Active
          </div>
        </div>
      </div>

      {/* Integration cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {INTEGRATIONS.map((integration, i) => (
          <motion.div
            key={integration.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className={cn(
              "rounded-xl border bg-card p-5 flex flex-col gap-4 transition-all hover:border-primary/20",
              integration.connected ? "border-primary/20" : "border-border",
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground">
                {integration.icon}
              </div>
              {integration.connected ? (
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-2.5 py-0.5">
                  <CheckCircle2 className="h-3 w-3" /> Connected
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted border border-border rounded-full px-2.5 py-0.5">
                  Not connected
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-1">{integration.name}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{integration.description}</p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {integration.features.slice(0, 2).map(f => (
                <span key={f} className="text-[10px] font-medium text-muted-foreground bg-muted border border-border rounded px-2 py-0.5">
                  {f}
                </span>
              ))}
              {integration.features.length > 2 && (
                <span className="text-[10px] font-medium text-muted-foreground bg-muted border border-border rounded px-2 py-0.5">
                  +{integration.features.length - 2} more
                </span>
              )}
            </div>

            <button
              onClick={() => setActive(integration)}
              className={cn(
                "mt-auto flex items-center justify-center gap-2 w-full rounded-md py-2 text-sm font-medium transition-colors",
                integration.connected
                  ? "border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              {integration.connected ? "Configure" : "Connect"}
              <ChevronRight className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </div>

      {/* Config panel overlay */}
      <AnimatePresence>
        {active && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
              onClick={() => setActive(null)}
            />
            <ConfigPanel integration={active} onClose={() => setActive(null)} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

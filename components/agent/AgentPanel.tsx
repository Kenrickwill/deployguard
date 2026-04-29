"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, X, ChevronDown, ChevronUp, Loader2,
  Lightbulb, ShieldAlert, Wrench, FileText, BarChart3, ListChecks,
  Copy, Check, Sparkles,
} from "lucide-react";
import type { Finding, ScanResult } from "@/types";
import type { AgentAction } from "@/lib/agent/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentMessage {
  id:        string;
  action:    AgentAction;
  content:   string;
  latencyMs: number;
  timestamp: string;
}

interface QuickAction {
  action:    AgentAction;
  label:     string;
  icon:      React.ReactNode;
  color:     string;
  requires?: "finding";
}

interface Props {
  scan:        ScanResult;
  targetName?: string;
  finding?:    Finding;     // If provided, finding-specific actions are pre-loaded
  className?:  string;
}

// ─── Quick Actions Config ─────────────────────────────────────────────────────

const QUICK_ACTIONS: QuickAction[] = [
  { action: "prioritize_risks",  label: "Prioritize Risks",      icon: <ShieldAlert size={14} />, color: "text-red-400"   },
  { action: "next_actions",      label: "Next Steps",             icon: <ListChecks  size={14} />, color: "text-blue-400"  },
  { action: "executive_summary", label: "Executive Summary",      icon: <BarChart3   size={14} />, color: "text-purple-400"},
  { action: "generate_docs",     label: "Generate Docs",          icon: <FileText    size={14} />, color: "text-green-400" },
  { action: "explain_finding",   label: "Explain Finding",        icon: <Lightbulb   size={14} />, color: "text-yellow-400", requires: "finding" },
  { action: "suggest_fix",       label: "Suggest Fix",            icon: <Wrench      size={14} />, color: "text-cyan-400",   requires: "finding" },
];

// ─── Markdown Renderer (lightweight) ─────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      elements.push(<h4 key={i} className="text-sm font-semibold text-white mt-4 mb-1">{line.slice(4)}</h4>);
    } else if (line.startsWith("## ")) {
      elements.push(<h3 key={i} className="text-sm font-bold text-white mt-5 mb-2">{line.slice(3)}</h3>);
    } else if (line.startsWith("# ")) {
      elements.push(<h2 key={i} className="text-base font-bold text-white mt-4 mb-2">{line.slice(2)}</h2>);
    } else if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={i} className="bg-black/60 border border-white/10 rounded-md p-3 my-2 overflow-x-auto text-xs font-mono text-emerald-300 leading-relaxed">
          {lang && <div className="text-white/30 text-[10px] mb-2">{lang}</div>}
          {codeLines.join("\n")}
        </pre>
      );
    } else if (line.startsWith("- [ ] ")) {
      elements.push(
        <div key={i} className="flex items-start gap-2 my-0.5 ml-2">
          <span className="mt-0.5 size-3.5 rounded border border-white/30 flex-shrink-0" />
          <span className="text-xs text-white/80">{inlineMarkdown(line.slice(6))}</span>
        </div>
      );
    } else if (line.startsWith("- ")) {
      elements.push(
        <div key={i} className="flex items-start gap-2 my-0.5 ml-2">
          <span className="mt-1.5 size-1 rounded-full bg-white/40 flex-shrink-0" />
          <span className="text-xs text-white/80">{inlineMarkdown(line.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\. /.test(line)) {
      const num = line.match(/^(\d+)\. /)?.[1];
      elements.push(
        <div key={i} className="flex items-start gap-2 my-0.5 ml-2">
          <span className="text-xs text-white/40 flex-shrink-0 w-4 text-right">{num}.</span>
          <span className="text-xs text-white/80">{inlineMarkdown(line.replace(/^\d+\. /, ""))}</span>
        </div>
      );
    } else if (line.startsWith("|") && line.endsWith("|")) {
      // Table — collect rows
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        if (!lines[i].includes("---")) {
          rows.push(lines[i].split("|").filter(Boolean).map(c => c.trim()));
        }
        i++;
      }
      elements.push(
        <div key={`table-${i}`} className="overflow-x-auto my-2">
          <table className="text-xs w-full border-collapse">
            {rows.map((row, ri) => (
              <tr key={ri} className={ri === 0 ? "border-b border-white/20" : "border-b border-white/10"}>
                {row.map((cell, ci) => ri === 0
                  ? <th key={ci} className="py-1 px-2 text-left text-white/50 font-medium">{inlineMarkdown(cell)}</th>
                  : <td key={ci} className="py-1 px-2 text-white/70">{inlineMarkdown(cell)}</td>
                )}
              </tr>
            ))}
          </table>
        </div>
      );
      continue;
    } else if (line.startsWith("---")) {
      elements.push(<hr key={i} className="border-white/10 my-3" />);
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={i} className="border-l-2 border-blue-500/50 pl-3 my-2 text-xs text-white/60 italic">
          {inlineMarkdown(line.slice(2))}
        </blockquote>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1.5" />);
    } else {
      elements.push(<p key={i} className="text-xs text-white/80 leading-relaxed">{inlineMarkdown(line)}</p>);
    }
    i++;
  }
  return <>{elements}</>;
}

function inlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="bg-black/40 text-emerald-300 rounded px-1 text-[11px] font-mono">{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i} className="text-white/70">{part.slice(1, -1)}</em>;
    return part;
  });
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: AgentMessage }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const actionLabels: Record<AgentAction, string> = {
    explain_finding:   "Explanation",
    prioritize_risks:  "Risk Prioritization",
    suggest_fix:       "Suggested Fix",
    generate_docs:     "Documentation",
    executive_summary: "Executive Summary",
    next_actions:      "Action Plan",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="size-5 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center flex-shrink-0">
          <Sparkles size={10} className="text-blue-400" />
        </div>
        <span className="text-[11px] text-white/40 font-medium">{actionLabels[msg.action]}</span>
        <span className="text-[10px] text-white/20 ml-auto">{msg.latencyMs}ms</span>
        <button
          onClick={copy}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-white/60"
          title="Copy to clipboard"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
      <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4">
        {renderMarkdown(msg.content)}
      </div>
    </motion.div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function AgentPanel({ scan, targetName, finding, className = "" }: Props) {
  const [isOpen, setIsOpen]       = useState(false);
  const [messages, setMessages]   = useState<AgentMessage[]>([]);
  const [loading, setLoading]     = useState(false);
  const [audience, setAudience]   = useState<"developer" | "security" | "executive">("developer");
  const [horizon, setHorizon]     = useState<"immediate" | "sprint" | "quarter">("sprint");
  const [activeAction, setActiveAction] = useState<AgentAction | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function runAction(action: AgentAction) {
    if (loading) return;
    setLoading(true);
    setActiveAction(action);

    let body: Record<string, unknown>;
    const scanContext = { scan, targetName, environment: "staging" };

    switch (action) {
      case "explain_finding":
        if (!finding) { setLoading(false); return; }
        body = { action, finding, audience };
        break;
      case "suggest_fix":
        if (!finding) { setLoading(false); return; }
        body = { action, finding };
        break;
      case "prioritize_risks":
        body = { action, scan: scanContext };
        break;
      case "generate_docs":
        body = { action, scan: scanContext, format: "markdown" };
        break;
      case "executive_summary":
        body = { action, scan: scanContext };
        break;
      case "next_actions":
        body = { action, scan: scanContext, horizon };
        break;
    }

    try {
      const res = await fetch("/api/agent", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const json = await res.json();
      if (json.data) {
        setMessages(prev => [...prev, { id: crypto.randomUUID(), ...json.data }]);
      }
    } catch {
      // silently ignore network errors in the panel
    } finally {
      setLoading(false);
      setActiveAction(null);
    }
  }

  const availableActions = QUICK_ACTIONS.filter(a => !a.requires || (a.requires === "finding" && !!finding));

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Toggle bar */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="flex items-center gap-2.5 px-4 py-3 bg-blue-600/10 border border-blue-500/30 rounded-xl hover:bg-blue-600/15 transition-colors w-full text-left"
      >
        <div className="size-6 rounded-lg bg-blue-600/20 flex items-center justify-center">
          <Bot size={13} className="text-blue-400" />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">DeployGuard Agent</div>
          <div className="text-[11px] text-white/40">AI-assisted security analysis · Read-only · Advisory</div>
        </div>
        <div className="ml-auto text-white/40">
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Panel body */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border border-t-0 border-white/10 rounded-b-xl bg-[#0a0a10]">
              {/* Options bar */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06] flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">Audience</span>
                  {(["developer", "security", "executive"] as const).map(a => (
                    <button
                      key={a}
                      onClick={() => setAudience(a)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors capitalize ${
                        audience === a
                          ? "border-blue-500/60 bg-blue-600/20 text-blue-300"
                          : "border-white/10 text-white/30 hover:text-white/60"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">Horizon</span>
                  {(["immediate", "sprint", "quarter"] as const).map(h => (
                    <button
                      key={h}
                      onClick={() => setHorizon(h)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors capitalize ${
                        horizon === h
                          ? "border-blue-500/60 bg-blue-600/20 text-blue-300"
                          : "border-white/10 text-white/30 hover:text-white/60"
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
                {messages.length > 0 && (
                  <button
                    onClick={() => setMessages([])}
                    className="text-[10px] text-white/20 hover:text-white/50 flex items-center gap-1 ml-1"
                  >
                    <X size={10} /> Clear
                  </button>
                )}
              </div>

              {/* Quick action buttons */}
              <div className="px-4 py-3 flex flex-wrap gap-2 border-b border-white/[0.06]">
                {availableActions.map(qa => (
                  <button
                    key={qa.action}
                    onClick={() => runAction(qa.action)}
                    disabled={loading}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all
                      ${activeAction === qa.action
                        ? "border-blue-500/50 bg-blue-600/20 text-blue-300"
                        : "border-white/10 bg-white/[0.03] text-white/60 hover:text-white/90 hover:border-white/20"
                      }
                      ${loading && activeAction !== qa.action ? "opacity-40 cursor-not-allowed" : ""}
                    `}
                  >
                    <span className={qa.color}>{qa.icon}</span>
                    {qa.label}
                    {activeAction === qa.action && loading && (
                      <Loader2 size={10} className="animate-spin ml-0.5" />
                    )}
                  </button>
                ))}
              </div>

              {/* Messages */}
              <div className="px-4 py-4 space-y-5 max-h-[520px] overflow-y-auto">
                {messages.length === 0 && !loading && (
                  <div className="text-center py-8">
                    <Bot size={24} className="mx-auto mb-2 text-white/20" />
                    <p className="text-xs text-white/30">
                      Select an action above to get AI-assisted analysis.
                    </p>
                    <p className="text-[10px] text-white/20 mt-1">
                      The agent only analyzes your scan data — it never executes code or makes external requests.
                    </p>
                  </div>
                )}

                {messages.map(msg => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}

                {loading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                    <div className="size-5 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center">
                      <Sparkles size={10} className="text-blue-400" />
                    </div>
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          className="size-1.5 rounded-full bg-blue-400/60"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

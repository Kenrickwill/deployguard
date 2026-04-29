"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  ScanLine,
  Zap,
  GitBranch,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Lock,
  Activity,
  Layers,
} from "lucide-react";

const TERMINAL_LINES = [
  { delay: 0,    color: "text-muted-foreground", text: "$ deployguard scan --branch main --env production" },
  { delay: 0.3,  color: "text-muted-foreground", text: "" },
  { delay: 0.5,  color: "text-blue-400",          text: "  Initializing DeployGuard v0.1.0..." },
  { delay: 0.8,  color: "text-emerald-400",       text: "  ✓ Repository analysed (247 files)" },
  { delay: 1.0,  color: "text-emerald-400",       text: "  ✓ Dependency audit complete" },
  { delay: 1.2,  color: "text-emerald-400",       text: "  ✓ Secrets scanner active" },
  { delay: 1.5,  color: "text-muted-foreground",  text: "" },
  { delay: 1.7,  color: "text-muted-foreground",  text: "  Running 38 rules across 247 files..." },
  { delay: 2.2,  color: "text-muted-foreground",  text: "" },
  { delay: 2.4,  color: "text-red-400",           text: "  [CRITICAL]  Hardcoded AWS secret key" },
  { delay: 2.45, color: "text-zinc-500",          text: "               src/config/aws.ts:14" },
  { delay: 2.7,  color: "text-orange-400",        text: "  [HIGH]      SQL injection via string concat" },
  { delay: 2.75, color: "text-zinc-500",          text: "               src/api/users/route.ts:47" },
  { delay: 3.0,  color: "text-orange-400",        text: "  [HIGH]      Unprotected admin endpoint" },
  { delay: 3.05, color: "text-zinc-500",          text: "               src/api/admin/users/route.ts:8" },
  { delay: 3.3,  color: "text-amber-400",         text: "  [MEDIUM]    CORS wildcard origin" },
  { delay: 3.5,  color: "text-blue-400",          text: "  [LOW]       Outdated dependency lodash@4.17.20" },
  { delay: 3.7,  color: "text-muted-foreground",  text: "" },
  { delay: 3.9,  color: "text-muted-foreground",  text: "  ─────────────────────────────────────" },
  { delay: 4.1,  color: "text-foreground",        text: "  Score:          61 / 100" },
  { delay: 4.2,  color: "text-amber-400",         text: "  Recommendation: ⚠  REVIEW REQUIRED" },
  { delay: 4.3,  color: "text-muted-foreground",  text: "  Scan duration:  17s" },
  { delay: 4.4,  color: "text-muted-foreground",  text: "" },
];

const FEATURES = [
  {
    icon: ScanLine,
    title: "Static Analysis",
    description: "38 built-in rules scan your source code for secrets, injection flaws, misconfigurations, and vulnerable dependencies before a single byte ships.",
    accent: "text-blue-400",
  },
  {
    icon: Zap,
    title: "Dynamic Testing",
    description: "Point DeployGuard at a staging URL and watch it probe for XSS, IDOR, auth bypass, and rate-limit gaps in real HTTP traffic — not just code.",
    accent: "text-amber-400",
  },
  {
    icon: Activity,
    title: "Risk Scoring",
    description: "Every scan produces a 0–100 score weighted by severity and category. Get an unambiguous deploy / review / block verdict, not a wall of alerts.",
    accent: "text-emerald-400",
  },
  {
    icon: Layers,
    title: "Team Integration",
    description: "Post results as GitHub PR comments, create Jira tickets for critical findings, page on-call via PagerDuty, and notify Slack — all in one pipeline step.",
    accent: "text-purple-400",
  },
];

const STEPS = [
  { num: "01", title: "Connect your repo", body: "Link GitHub, GitLab, or Bitbucket. DeployGuard receives webhooks on every push and PR." },
  { num: "02", title: "Scan before you merge", body: "Static analysis runs in seconds. Dynamic tests against staging run in parallel. Scores appear inline on the PR." },
  { num: "03", title: "Ship with confidence", body: "A score ≥80 with no critical findings means green. Anything less surfaces exactly what to fix before production." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-semibold tracking-tight">DeployGuard</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="#features" className="hover:text-foreground transition-colors">Features</Link>
            <Link href="#how-it-works" className="hover:text-foreground transition-colors">How it works</Link>
            <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Link
              href="/scans/new"
              className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3.5 py-1.5 rounded-md font-medium hover:bg-primary/90 transition-colors"
            >
              Start free <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 dot-grid overflow-hidden">
        {/* Radial glow */}
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center">
          <div className="w-[600px] h-[400px] bg-primary/8 rounded-full blur-3xl mt-10" />
        </div>

        <div className="relative max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 text-xs font-mono text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1 mb-6"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Pre-deployment security scanning
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6"
            >
              Find. Fix.<br />
              <span className="text-primary">Deploy with</span><br />
              confidence.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg"
            >
              DeployGuard catches security vulnerabilities, misconfigurations,
              and reliability risks before they reach production — giving every
              deploy a clear score and verdict in under 30 seconds.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-wrap gap-3 mb-10"
            >
              <Link
                href="/scans/new"
                className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-md font-medium text-sm hover:bg-primary/90 transition-colors"
              >
                Start scanning <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 border border-border text-foreground px-5 py-2.5 rounded-md font-medium text-sm hover:bg-accent transition-colors"
              >
                View demo dashboard
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="flex items-center gap-5 text-sm text-muted-foreground"
            >
              {[
                { icon: CheckCircle2, text: "No credit card required" },
                { icon: Lock, text: "SOC 2 ready" },
                { icon: GitBranch, text: "GitHub & GitLab" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{text}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Terminal mockup */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="rounded-xl border border-border bg-[#090d14] shadow-2xl overflow-hidden glow-blue">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="ml-2 text-xs text-muted-foreground font-mono">deployguard — bash</span>
              </div>
              {/* Terminal body */}
              <div className="p-5 font-mono text-xs leading-relaxed space-y-0.5 min-h-[360px]">
                {TERMINAL_LINES.map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: line.delay, duration: 0.1 }}
                    className={line.color}
                  >
                    {line.text || " "}
                  </motion.div>
                ))}
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ delay: 4.5, duration: 1, repeat: Infinity }}
                  className="inline-block w-2 h-4 bg-primary align-middle"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-card/40">
        <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "38", label: "Built-in security rules" },
            { value: "<30s", label: "Scan turnaround" },
            { value: "4", label: "Severity levels scored" },
            { value: "6", label: "Integration targets" },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-3xl font-bold text-foreground">{value}</p>
              <p className="text-sm text-muted-foreground mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Everything a team needs before shipping</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              One tool. Static analysis, dynamic testing, and risk scoring — integrated into the workflow your team already uses.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, title, description, accent }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group rounded-xl border border-border bg-card p-6 hover:border-primary/30 hover:bg-card/80 transition-all"
              >
                <div className={`w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center mb-4 group-hover:border-primary/30 transition-colors`}>
                  <Icon className={`h-5 w-5 ${accent}`} />
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-6 border-t border-border bg-card/20">
        <div className="max-w-7xl mx-auto">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Three steps to safer deploys</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              From first commit to production-ready in under a minute.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map(({ num, title, body }, i) => (
              <motion.div
                key={num}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative"
              >
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-5 left-[calc(100%_-_8px)] w-full h-px border-t border-dashed border-border z-0" />
                )}
                <div className="font-mono text-5xl font-bold text-border mb-4">{num}</div>
                <h3 className="font-semibold text-lg mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Verdict showcase */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-3">An unambiguous verdict, every time</h2>
          <p className="text-muted-foreground mb-12">No more "check the report". Every scan ends with one of three clear outcomes.</p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "DEPLOY", desc: "Score ≥80, no critical or high findings. Ship it.", icon: CheckCircle2, cls: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400", glow: "glow-green" },
              { label: "REVIEW", desc: "High findings or score 50–79. Fix before merging.", icon: AlertTriangle, cls: "border-amber-500/30 bg-amber-500/5 text-amber-400", glow: "glow-amber" },
              { label: "BLOCK", desc: "Critical findings or score <50. Do not deploy.", icon: XCircle, cls: "border-red-500/30 bg-red-500/5 text-red-400", glow: "glow-red" },
            ].map(({ label, desc, icon: Icon, cls, glow }) => (
              <div key={label} className={`rounded-xl border p-6 ${cls} ${glow}`}>
                <Icon className="h-8 w-8 mx-auto mb-3" />
                <p className="font-mono font-bold text-lg mb-2">{label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-border dot-grid">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold tracking-tight mb-4">Ready to deploy with confidence?</h2>
          <p className="text-muted-foreground mb-8">Scan your first project in under two minutes. No card required.</p>
          <Link
            href="/scans/new"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:bg-primary/90 transition-colors"
          >
            Start your first scan <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">DeployGuard</span>
            <span>— Find. Fix. Deploy with confidence.</span>
          </div>
          <div className="flex gap-6">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
            <Link href="/docs/architecture" className="hover:text-foreground transition-colors">Docs</Link>
            <span>v0.1.0-alpha</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

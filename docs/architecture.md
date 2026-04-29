# DeployGuard Architecture

## Overview

DeployGuard is a pre-deployment risk platform. It scans code and infrastructure for security,
reliability, and compliance issues, then produces a scored report with a deploy/review/block recommendation.

## System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                       Next.js App                        │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────────┐  │
│  │ Dashboard │  │ Projects │  │  Scan Results / Editor │  │
│  └──────────┘  └──────────┘  └───────────────────────┘  │
│                  App Router (RSC + Client)                │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP / Server Actions
┌───────────────────────▼─────────────────────────────────┐
│                      API Layer                           │
│  /api/scan   /api/reports   /api/integrations            │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                   Core Libraries                         │
│  lib/scanner       — static analysis engine              │
│  lib/scoring       — weighted score calculator           │
│  lib/dynamic-testing — DAST runner (future)              │
│  lib/reporting     — JSON / Markdown / HTML output       │
│  lib/documentation — remediation guide generator         │
│  lib/integrations  — GitHub, Slack, Jira, PagerDuty      │
└───────────────────────┬─────────────────────────────────┘
                        │ Prisma ORM
┌───────────────────────▼─────────────────────────────────┐
│               PostgreSQL Database                        │
│  Users · Projects · Scans · Findings · Reports           │
│  Integrations · ScanRules                                │
└─────────────────────────────────────────────────────────┘
```

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Next.js App Router | RSC for zero-JS data pages; Client Components for interactive UI |
| Database | PostgreSQL + Prisma | Relational model fits findings/scans well; Prisma for type-safe queries |
| Styling | Tailwind CSS + shadcn/ui | Fast iteration, consistent design system |
| Validation | Zod | End-to-end type safety from API input to UI |
| Animation | Framer Motion | Polished score animations and finding expand/collapse |
| Editor | Monaco Editor | In-browser code viewer for snippets with syntax highlighting |

## Module Responsibilities

### `lib/scanner`
Loads rules, runs them against file content, returns raw `Finding[]`.

### `lib/scoring`
Takes a `ScanSummary` and computes the weighted `DeployScore` (0–100) with a recommendation.

### `lib/dynamic-testing`
Future DAST engine. Will send probe requests to a live URL and detect runtime vulnerabilities.

### `lib/reporting`
Serializes `ScanResult` to JSON, Markdown, or HTML for download or PR comment posting.

### `lib/documentation`
Generates structured remediation guides per finding, keyed by rule ID.

### `lib/integrations`
Thin HTTP clients for external services. Each module is independent and tested separately.

## Data Flow (Scan Request)

1. Client POSTs to `/api/scan` with `{ projectId, branch, options }`
2. API validates input with Zod, looks up project in DB
3. Repo files are fetched (GitHub API / local FS in dev)
4. `runScan()` applies all enabled rules against each file
5. `calculateScore()` converts findings to a `DeployScore`
6. Results are persisted to PostgreSQL via Prisma
7. Integrations fire asynchronously (Slack notify, GitHub status, etc.)
8. Scan ID is returned; UI polls for status or uses WebSocket (future)

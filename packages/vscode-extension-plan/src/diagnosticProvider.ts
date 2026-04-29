/**
 * DiagnosticProvider
 *
 * Converts DeployGuard findings into VS Code Diagnostics and pushes them
 * to the diagnostic collection so the editor shows squiggly underlines,
 * the Problems panel entries, and the gutter error/warning icons.
 *
 * Design decisions:
 *  - One DiagnosticCollection for the whole extension ("deployguard")
 *  - Findings are indexed by fingerprint to enable stable removal/update
 *  - Severity mapping: critical/high → Error, medium → Warning, low/info → Information
 */

import * as vscode from "vscode";
import type { Finding, SeverityLevel, ExtensionConfig } from "./types";

const SEVERITY_MAP: Record<SeverityLevel, vscode.DiagnosticSeverity> = {
  critical: vscode.DiagnosticSeverity.Error,
  high:     vscode.DiagnosticSeverity.Error,
  medium:   vscode.DiagnosticSeverity.Warning,
  low:      vscode.DiagnosticSeverity.Information,
  info:     vscode.DiagnosticSeverity.Hint,
};

const SEVERITY_ORDER: Record<SeverityLevel, number> = {
  critical: 0, high: 1, medium: 2, low: 3, info: 4,
};

export class DiagnosticProvider implements vscode.Disposable {
  private readonly collection: vscode.DiagnosticCollection;
  private config: ExtensionConfig;

  /** fingerprint → Finding (used for quick-fix lookup and false-positive marking) */
  private findingIndex = new Map<string, Finding>();

  /** uri.toString() → Diagnostic[] (shadows what's in collection for easy querying) */
  private diagnosticMap = new Map<string, vscode.Diagnostic[]>();

  constructor(collection: vscode.DiagnosticCollection, config: ExtensionConfig) {
    this.collection = collection;
    this.config     = config;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Replace all diagnostics for a given file URI with the provided findings. */
  setFindings(uri: vscode.Uri, findings: Finding[]): void {
    const minOrder = SEVERITY_ORDER[this.config.minSeverityToShow];

    const diagnostics = findings
      .filter(f =>
        !f.falsePositive &&
        !this.config.ignoredRules.includes(f.ruleId) &&
        SEVERITY_ORDER[f.severity] <= minOrder,
      )
      .map(f => {
        this.findingIndex.set(f.fingerprint, f);
        return this.toDiagnostic(f);
      });

    this.collection.set(uri, diagnostics);
    this.diagnosticMap.set(uri.toString(), diagnostics);
  }

  /** Remove all diagnostics for a specific file. */
  clearFile(uri: vscode.Uri): void {
    this.collection.delete(uri);
    this.diagnosticMap.delete(uri.toString());
  }

  /** Remove a single finding by id (after false-positive marking). */
  removeFinding(findingId: string): void {
    for (const [fingerprint, finding] of this.findingIndex) {
      if (finding.id === findingId) {
        this.findingIndex.delete(fingerprint);
        break;
      }
    }
    // Refresh each affected URI
    this.collection.forEach((uri, diagnostics) => {
      const updated = diagnostics.filter(d => {
        const fp = (d as DiagnosticWithFingerprint)._fingerprint;
        return fp ? this.findingIndex.has(fp) : true;
      });
      this.collection.set(uri, updated);
    });
  }

  /** Look up the original Finding for a given diagnostic (used by quick-fix provider). */
  findingForDiagnostic(diagnostic: vscode.Diagnostic): Finding | undefined {
    const fp = (diagnostic as DiagnosticWithFingerprint)._fingerprint;
    return fp ? this.findingIndex.get(fp) : undefined;
  }

  /** Aggregate severity counts across all open files — used for the status bar. */
  severityCounts(): Record<SeverityLevel, number> & { total: number } {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 };
    for (const finding of this.findingIndex.values()) {
      counts[finding.severity]++;
      counts.total++;
    }
    return counts;
  }

  /** Build TreeItem list for the sidebar findings view. */
  asFindingTreeItems(): vscode.TreeItem[] {
    const byFile = new Map<string, Finding[]>();
    for (const finding of this.findingIndex.values()) {
      const key = finding.location.filePath;
      if (!byFile.has(key)) byFile.set(key, []);
      byFile.get(key)!.push(finding);
    }

    const items: vscode.TreeItem[] = [];
    for (const [filePath, findings] of byFile) {
      const fileItem = new vscode.TreeItem(
        vscode.workspace.asRelativePath(filePath),
        vscode.TreeItemCollapsibleState.Expanded,
      );
      fileItem.iconPath = new vscode.ThemeIcon("file-code");
      items.push(fileItem);

      findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
      for (const f of findings) {
        const item = new vscode.TreeItem(`[${f.severity.toUpperCase()}] ${f.title}`);
        item.description = `${f.ruleId} · line ${f.location.lineStart}`;
        item.iconPath    = severityIcon(f.severity);
        item.tooltip     = f.description;
        item.command     = {
          command:   "vscode.open",
          title:     "Go to finding",
          arguments: [
            vscode.Uri.file(filePath),
            { selection: new vscode.Range(f.location.lineStart - 1, 0, f.location.lineStart - 1, 0) },
          ],
        };
        items.push(item);
      }
    }
    return items;
  }

  updateConfig(config: ExtensionConfig): void {
    this.config = config;
  }

  dispose(): void {
    this.collection.dispose();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private toDiagnostic(finding: Finding): vscode.Diagnostic {
    const { lineStart, lineEnd, columnStart, columnEnd } = finding.location;

    // VS Code uses 0-based lines, DeployGuard uses 1-based
    const range = new vscode.Range(
      lineStart - 1, columnStart - 1,
      lineEnd   - 1, columnEnd   - 1,
    );

    const diagnostic = new vscode.Diagnostic(
      range,
      `[${finding.ruleId}] ${finding.title}`,
      SEVERITY_MAP[finding.severity],
    ) as DiagnosticWithFingerprint;

    diagnostic.source  = "DeployGuard";
    diagnostic.code    = {
      value:  finding.ruleId,
      target: vscode.Uri.parse(`https://deployguard.dev/rules/${finding.ruleId}`),
    };

    // Related info: remediation hint surfaced inline
    diagnostic.relatedInformation = [
      new vscode.DiagnosticRelatedInformation(
        new vscode.Location(
          vscode.Uri.file(finding.location.filePath),
          range,
        ),
        `Remediation: ${finding.remediation}`,
      ),
    ];

    // Stash the fingerprint so the quick-fix provider can look up the full Finding
    diagnostic._fingerprint = finding.fingerprint;

    return diagnostic;
  }
}

// ── Supporting types ──────────────────────────────────────────────────────────

interface DiagnosticWithFingerprint extends vscode.Diagnostic {
  _fingerprint?: string;
}

function severityIcon(severity: SeverityLevel): vscode.ThemeIcon {
  switch (severity) {
    case "critical": return new vscode.ThemeIcon("error",       new vscode.ThemeColor("errorForeground"));
    case "high":     return new vscode.ThemeIcon("warning",     new vscode.ThemeColor("editorWarning.foreground"));
    case "medium":   return new vscode.ThemeIcon("info",        new vscode.ThemeColor("editorInfo.foreground"));
    case "low":      return new vscode.ThemeIcon("circle-outline");
    case "info":     return new vscode.ThemeIcon("symbol-misc");
  }
}

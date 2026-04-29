/**
 * InlineDecorationProvider
 *
 * Adds visual emphasis to flagged lines beyond what the standard diagnostic
 * squiggly underlines provide:
 *
 *   - Background highlight on the flagged line (severity-tinted)
 *   - End-of-line annotation: "⚠ SEC-001 · Hardcoded API Secret"
 *   - Gutter icon: coloured dot indicating severity
 *
 * Design: one DecorationType per severity × decoration role, created once and
 * reused. Decorations are re-applied whenever setFindings() is called.
 */

import * as vscode from "vscode";
import type { Finding, SeverityLevel, ExtensionConfig } from "./types";

// ── Decoration type definitions ───────────────────────────────────────────────

const SEVERITY_COLORS: Record<SeverityLevel, { bg: string; border: string; fg: string }> = {
  critical: { bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.35)",   fg: "#ef4444" },
  high:     { bg: "rgba(249,115,22,0.07)",  border: "rgba(249,115,22,0.30)",  fg: "#f97316" },
  medium:   { bg: "rgba(234,179,8,0.06)",   border: "rgba(234,179,8,0.28)",   fg: "#eab308" },
  low:      { bg: "rgba(59,130,246,0.05)",  border: "rgba(59,130,246,0.25)",  fg: "#3b82f6" },
  info:     { bg: "rgba(107,114,128,0.04)", border: "rgba(107,114,128,0.20)", fg: "#6b7280" },
};

// Gutter icons are SVG data URIs — one per severity.
function gutterIconSvg(color: string): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14'>` +
    `<circle cx='7' cy='7' r='5' fill='${color}' opacity='0.85'/>` +
    `</svg>`
  )}`;
}

export class InlineDecorationProvider implements vscode.Disposable {
  private config: ExtensionConfig;

  /** severity → line background + gutter decoration type */
  private readonly lineTypes:   Map<SeverityLevel, vscode.TextEditorDecorationType>;
  /** severity → end-of-line annotation decoration type (created per use, stateless) */
  private readonly annotationTypes: Map<SeverityLevel, vscode.TextEditorDecorationType>;

  /** Track active decorations so we can clear them per file */
  private activeDecorations = new Map<string /* uri.toString() */, vscode.TextEditorDecorationType[]>();

  constructor(config: ExtensionConfig) {
    this.config         = config;
    this.lineTypes      = new Map();
    this.annotationTypes = new Map();
    this.createDecorationTypes();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  setFindings(uri: vscode.Uri, findings: Finding[]): void {
    if (!this.config.enableInlineDecorations) return;

    const editors = vscode.window.visibleTextEditors.filter(
      e => e.document.uri.toString() === uri.toString(),
    );
    if (editors.length === 0) return;

    this.clearUri(uri);

    const byEditor = editors[0];

    // Group findings by severity for batch-application
    const bySeverity = new Map<SeverityLevel, Finding[]>();
    for (const finding of findings) {
      if (!bySeverity.has(finding.severity)) bySeverity.set(finding.severity, []);
      bySeverity.get(finding.severity)!.push(finding);
    }

    const applied: vscode.TextEditorDecorationType[] = [];

    for (const [severity, sFindings] of bySeverity) {
      const lineType = this.lineTypes.get(severity);
      if (!lineType) continue;

      // Line background ranges
      const lineRanges = sFindings.map(f =>
        new vscode.Range(
          f.location.lineStart - 1, 0,
          f.location.lineStart - 1, Number.MAX_SAFE_INTEGER,
        )
      );
      byEditor.setDecorations(lineType, lineRanges);
      applied.push(lineType);

      // End-of-line annotations (each finding gets its own decoration instance
      // so the text can be finding-specific)
      for (const finding of sFindings) {
        const annotationType = this.makeAnnotationType(finding);
        byEditor.setDecorations(annotationType, [
          {
            range: new vscode.Range(
              finding.location.lineStart - 1, Number.MAX_SAFE_INTEGER,
              finding.location.lineStart - 1, Number.MAX_SAFE_INTEGER,
            ),
          },
        ]);
        applied.push(annotationType);
      }
    }

    this.activeDecorations.set(uri.toString(), applied);
  }

  clearUri(uri: vscode.Uri): void {
    const types = this.activeDecorations.get(uri.toString()) ?? [];
    for (const t of types) {
      const editors = vscode.window.visibleTextEditors.filter(
        e => e.document.uri.toString() === uri.toString(),
      );
      for (const editor of editors) editor.setDecorations(t, []);
    }
    this.activeDecorations.delete(uri.toString());
  }

  clearAll(): void {
    for (const [uriStr] of this.activeDecorations) {
      this.clearUri(vscode.Uri.parse(uriStr));
    }
  }

  updateConfig(config: ExtensionConfig): void {
    this.config = config;
  }

  dispose(): void {
    this.lineTypes.forEach(t => t.dispose());
    this.annotationTypes.forEach(t => t.dispose());
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private createDecorationTypes(): void {
    for (const [severity, colors] of Object.entries(SEVERITY_COLORS) as [SeverityLevel, typeof SEVERITY_COLORS[SeverityLevel]][]) {
      this.lineTypes.set(
        severity,
        vscode.window.createTextEditorDecorationType({
          isWholeLine: true,
          backgroundColor: colors.bg,
          borderWidth:     "0 0 0 2px",
          borderStyle:     "none none none solid",
          borderColor:     colors.border,
          gutterIconPath:  vscode.Uri.parse(gutterIconSvg(colors.fg)),
          gutterIconSize:  "contain",
          overviewRulerColor: colors.fg,
          overviewRulerLane:  vscode.OverviewRulerLane.Right,
        }),
      );
    }
  }

  private makeAnnotationType(finding: Finding): vscode.TextEditorDecorationType {
    const colors = SEVERITY_COLORS[finding.severity];
    const label  = `  ⚠ ${finding.ruleId} · ${finding.title}`;
    return vscode.window.createTextEditorDecorationType({
      after: {
        contentText: label,
        color:       `${colors.fg}99`,  // 60% opacity
        fontStyle:   "italic",
        fontSize:    "11px",
        margin:      "0 0 0 16px",
      },
    });
  }
}

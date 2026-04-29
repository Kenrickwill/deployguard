/**
 * CodeActionProvider — Quick Fix implementation
 *
 * When the user hovers over a DeployGuard diagnostic and clicks the lightbulb
 * (or presses Ctrl+.), this provider offers:
 *
 *   1. Apply Fix      — automated workspace edit from finding.fix.edits
 *   2. View Details   — opens the DeployGuard web UI for the rule
 *   3. Suppress Rule  — adds ruleId to ignoredRules config
 *   4. Mark as False Positive — sends false-positive flag to the API
 *
 * Only findings that include a `fix` object are offered the "Apply Fix" action.
 * All findings get the informational and suppression actions.
 */

import * as vscode from "vscode";
import type { DiagnosticProvider } from "./diagnosticProvider";
import type { Finding } from "./types";

export class CodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
    vscode.CodeActionKind.SourceFixAll,
  ];

  constructor(private readonly diagnosticProvider: DiagnosticProvider) {}

  provideCodeActions(
    document: vscode.TextDocument,
    range:    vscode.Range | vscode.Selection,
    context:  vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const deployguardDiagnostics = context.diagnostics.filter(
      d => d.source === "DeployGuard",
    );

    return deployguardDiagnostics.flatMap(diagnostic => {
      const finding = this.diagnosticProvider.findingForDiagnostic(diagnostic);
      if (!finding) return [];
      return this.actionsForFinding(document, diagnostic, finding);
    });
  }

  // ── Per-finding actions ───────────────────────────────────────────────────

  private actionsForFinding(
    document:   vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    finding:    Finding,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    // 1. Apply automated fix (only when finding provides edits)
    if (finding.fix && finding.fix.edits.length > 0) {
      const applyFix = new vscode.CodeAction(
        `$(wrench) DeployGuard: ${finding.fix.description}`,
        vscode.CodeActionKind.QuickFix,
      );
      applyFix.diagnostics   = [diagnostic];
      applyFix.isPreferred   = true;
      applyFix.edit          = buildWorkspaceEdit(finding);

      if (finding.fix.sideEffects && finding.fix.sideEffects.length > 0) {
        applyFix.tooltip = `Side effects:\n${finding.fix.sideEffects.map(s => `• ${s}`).join("\n")}`;
      }
      actions.push(applyFix);
    }

    // 2. Open rule documentation
    const viewDocs = new vscode.CodeAction(
      `$(book) DeployGuard: View rule ${finding.ruleId}`,
      vscode.CodeActionKind.Empty,
    );
    viewDocs.command = {
      command:   "vscode.open",
      title:     "Open DeployGuard rule docs",
      arguments: [vscode.Uri.parse(`https://deployguard.dev/rules/${finding.ruleId}`)],
    };
    actions.push(viewDocs);

    // 3. Suppress this rule globally (adds to ignoredRules in workspace config)
    const suppress = new vscode.CodeAction(
      `$(mute) DeployGuard: Suppress rule ${finding.ruleId} in this workspace`,
      vscode.CodeActionKind.QuickFix,
    );
    suppress.command = {
      command:   "deployguard.suppressRule",
      title:     "Suppress rule",
      arguments: [finding.ruleId],
    };
    suppress.diagnostics = [diagnostic];
    actions.push(suppress);

    // 4. Mark as false positive
    const falsePositive = new vscode.CodeAction(
      `$(feedback) DeployGuard: Mark as false positive`,
      vscode.CodeActionKind.QuickFix,
    );
    falsePositive.command = {
      command:   "deployguard.markFalsePositive",
      title:     "Mark as false positive",
      arguments: [finding],
    };
    falsePositive.diagnostics = [diagnostic];
    actions.push(falsePositive);

    return actions;
  }
}

// ── Workspace edit builder ────────────────────────────────────────────────────

function buildWorkspaceEdit(finding: Finding): vscode.WorkspaceEdit {
  const edit = new vscode.WorkspaceEdit();

  for (const e of finding.fix!.edits) {
    const uri  = vscode.Uri.file(e.filePath);
    // Line is 1-based in the finding schema, VS Code expects 0-based
    const line = e.line - 1;

    // Find the exact range of oldText on that line using a document snapshot.
    // Since we're building the edit before we have a document reference,
    // we use a whole-line replacement. The implementation can be refined to
    // do character-level replacement by scanning the document text.
    const range = new vscode.Range(line, 0, line, e.oldText.length + 100);
    edit.replace(uri, range, e.newText);
  }

  return edit;
}

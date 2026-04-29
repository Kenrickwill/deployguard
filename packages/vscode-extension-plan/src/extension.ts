/**
 * DeployGuard VS Code Extension — Activation Entry Point
 *
 * Lifecycle:
 *  1. Extension activates on any supported language file or workspace with package.json / go.mod
 *  2. Registers diagnostic collection, code action provider, and decoration provider
 *  3. Wires up on-save and on-open scan triggers based on user config
 *  4. Exposes commands for manual scan, clear, and false-positive marking
 */

import * as vscode from "vscode";
import { DiagnosticProvider }    from "./diagnosticProvider";
import { CodeActionProvider }    from "./codeActionProvider";
import { InlineDecorationProvider } from "./inlineDecorations";
import { SidebarProvider }       from "./sidebarProvider";
import { ScanRunner }            from "./scanRunner";
import type { ExtensionConfig }  from "./types";

// Module-level singletons — created once, disposed on deactivation.
let diagnosticProvider:   DiagnosticProvider   | undefined;
let decorationProvider:   InlineDecorationProvider | undefined;
let scanRunner:           ScanRunner           | undefined;
let statusBarItem:        vscode.StatusBarItem  | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const config = loadConfig();

  // ── Core services ──────────────────────────────────────────────────────────

  const diagnosticCollection = vscode.languages.createDiagnosticCollection("deployguard");
  context.subscriptions.push(diagnosticCollection);

  diagnosticProvider = new DiagnosticProvider(diagnosticCollection, config);
  decorationProvider = new InlineDecorationProvider(config);
  scanRunner         = new ScanRunner(config, diagnosticProvider, decorationProvider);

  // ── Status bar ─────────────────────────────────────────────────────────────

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = "deployguard.scanFile";
  statusBarItem.text    = "$(shield) DG";
  statusBarItem.tooltip = "DeployGuard — click to scan";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // ── Sidebar ────────────────────────────────────────────────────────────────

  const sidebarProvider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("deployguard.scoreView", sidebarProvider),
  );

  const findingsTreeProvider = new vscode.EventEmitter<void>();
  vscode.window.registerTreeDataProvider("deployguard.findingsView", {
    onDidChangeTreeData: findingsTreeProvider.event,
    getTreeItem: (el: vscode.TreeItem) => el,
    getChildren: () => diagnosticProvider?.asFindingTreeItems() ?? [],
  });

  // ── Code Actions (Quick Fixes) ─────────────────────────────────────────────

  if (config.enableQuickFixes) {
    const codeActionProvider = new CodeActionProvider(diagnosticProvider!);
    context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(
        [
          { language: "typescript" },
          { language: "javascript" },
          { language: "typescriptreact" },
          { language: "javascriptreact" },
          { language: "python" },
          { language: "go" },
        ],
        codeActionProvider,
        { providedCodeActionKinds: CodeActionProvider.providedCodeActionKinds },
      ),
    );
  }

  // ── Commands ───────────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand("deployguard.scanFile", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      await scanRunner!.scanDocument(editor.document);
      updateStatusBar(diagnosticProvider!);
      findingsTreeProvider.fire();
    }),

    vscode.commands.registerCommand("deployguard.scanWorkspace", async () => {
      const files = await vscode.workspace.findFiles(
        "**/*.{ts,tsx,js,jsx,py,go}",
        "**/node_modules/**",
      );
      await scanRunner!.scanFiles(files);
      updateStatusBar(diagnosticProvider!);
      findingsTreeProvider.fire();
    }),

    vscode.commands.registerCommand("deployguard.clearDiagnostics", () => {
      diagnosticCollection.clear();
      decorationProvider?.clearAll();
      updateStatusBar(diagnosticProvider!);
    }),

    vscode.commands.registerCommand("deployguard.markFalsePositive", async (finding) => {
      await scanRunner!.markFalsePositive(finding);
      diagnosticProvider?.removeFinding(finding.id);
      findingsTreeProvider.fire();
    }),
  );

  // ── Auto-scan triggers ─────────────────────────────────────────────────────

  if (config.scanOnSave) {
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(async (doc) => {
        if (isSupportedFile(doc)) {
          await scanRunner!.scanDocument(doc);
          updateStatusBar(diagnosticProvider!);
          findingsTreeProvider.fire();
        }
      }),
    );
  }

  if (config.scanOnOpen) {
    context.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument(async (doc) => {
        if (isSupportedFile(doc)) {
          await scanRunner!.scanDocument(doc);
        }
      }),
    );
  }

  // Re-load config when the user changes settings.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("deployguard")) {
        const newConfig = loadConfig();
        scanRunner?.updateConfig(newConfig);
        diagnosticProvider?.updateConfig(newConfig);
        decorationProvider?.updateConfig(newConfig);
      }
    }),
  );

  vscode.window.showInformationMessage("DeployGuard is active. Save a file to scan.");
}

export function deactivate(): void {
  statusBarItem?.dispose();
  diagnosticProvider?.dispose();
  decorationProvider?.dispose();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadConfig(): ExtensionConfig {
  const cfg = vscode.workspace.getConfiguration("deployguard");
  return {
    apiUrl:                  cfg.get("apiUrl",                  "http://localhost:3000"),
    apiToken:                cfg.get("apiToken",                ""),
    scanOnSave:              cfg.get("scanOnSave",              true),
    scanOnOpen:              cfg.get("scanOnOpen",              false),
    minSeverityToShow:       cfg.get("minSeverityToShow",       "low"),
    enableInlineDecorations: cfg.get("enableInlineDecorations", true),
    enableQuickFixes:        cfg.get("enableQuickFixes",        true),
    ignoredRules:            cfg.get("ignoredRules",            []),
  };
}

function isSupportedFile(doc: vscode.TextDocument): boolean {
  return ["typescript", "javascript", "typescriptreact", "javascriptreact", "python", "go"]
    .includes(doc.languageId);
}

function updateStatusBar(provider: DiagnosticProvider): void {
  if (!statusBarItem) return;
  const counts = provider.severityCounts();
  if (counts.critical > 0) {
    statusBarItem.text    = `$(error) DG: ${counts.critical} critical`;
    statusBarItem.color   = new vscode.ThemeColor("errorForeground");
    statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
  } else if (counts.high > 0) {
    statusBarItem.text    = `$(warning) DG: ${counts.high} high`;
    statusBarItem.color   = new vscode.ThemeColor("editorWarning.foreground");
    statusBarItem.backgroundColor = undefined;
  } else if (counts.total > 0) {
    statusBarItem.text    = `$(info) DG: ${counts.total}`;
    statusBarItem.color   = undefined;
    statusBarItem.backgroundColor = undefined;
  } else {
    statusBarItem.text    = `$(pass) DG: clean`;
    statusBarItem.color   = new vscode.ThemeColor("terminal.ansiGreen");
    statusBarItem.backgroundColor = undefined;
  }
}

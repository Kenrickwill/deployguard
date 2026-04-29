/**
 * SidebarProvider — Score Webview Panel
 *
 * Renders the Deploy Score dial and finding summary inside the DeployGuard
 * activity-bar panel using a VS Code WebviewView.
 *
 * The webview receives scan results via postMessage and re-renders in place
 * without a full reload — no framework required.
 */

import * as vscode from "vscode";
import type { ScanResult } from "./types";

export class SidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context:    vscode.WebviewViewResolveContext,
    _token:      vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getInitialHtml();

    // Handle messages sent from the webview (e.g., "open file" clicks)
    webviewView.webview.onDidReceiveMessage(msg => {
      switch (msg.type) {
        case "openFile":
          vscode.commands.executeCommand("vscode.open", vscode.Uri.file(msg.path));
          break;
        case "scanWorkspace":
          vscode.commands.executeCommand("deployguard.scanWorkspace");
          break;
      }
    });
  }

  /** Push a new scan result into the webview. */
  update(result: ScanResult): void {
    this.view?.webview.postMessage({ type: "scanResult", result });
  }

  /** Show a loading spinner while a scan is in progress. */
  setLoading(loading: boolean): void {
    this.view?.webview.postMessage({ type: "loading", loading });
  }

  // ── HTML ───────────────────────────────────────────────────────────────────

  private getInitialHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--vscode-font-family); font-size: 12px; color: var(--vscode-foreground); padding: 12px; }
    .empty { opacity: 0.5; text-align: center; padding: 24px 8px; }
    .score-ring { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .score-number { font-size: 36px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .score-label { font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.05em; }
    .rec { display: inline-block; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 3px; border: 1px solid; }
    .rec.deploy { color: #4ade80; border-color: #4ade8040; background: #4ade8010; }
    .rec.review { color: #facc15; border-color: #facc1540; background: #facc1510; }
    .rec.block  { color: #f87171; border-color: #f8717140; background: #f8717110; }
    .pill-row { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px; }
    .pill { font-size: 10px; padding: 2px 6px; border-radius: 3px; border: 1px solid; }
    .pill.critical { color:#ef4444; border-color:#ef444440; background:#ef444410; }
    .pill.high     { color:#f97316; border-color:#f9731640; background:#f9731610; }
    .pill.medium   { color:#eab308; border-color:#eab30840; background:#eab30810; }
    .pill.low      { color:#3b82f6; border-color:#3b82f640; background:#3b82f610; }
    .pill.info     { color:#6b7280; border-color:#6b728040; background:#6b728010; }
    button.action { width: 100%; padding: 6px; border: 1px solid var(--vscode-button-border, transparent); background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-radius: 3px; cursor: pointer; font-size: 11px; }
    button.action:hover { background: var(--vscode-button-hoverBackground); }
    .loader { opacity: 0.5; text-align: center; padding: 8px; }
  </style>
</head>
<body>
  <div id="root"><p class="empty">Save a file to see your deploy score.</p></div>

  <script>
    const vscode = acquireVsCodeApi();
    const root   = document.getElementById("root");

    window.addEventListener("message", e => {
      const { type, result, loading } = e.data;

      if (type === "loading") {
        if (loading) root.innerHTML = '<p class="loader">Scanning…</p>';
        return;
      }

      if (type === "scanResult" && result) {
        const { score, summary } = result;
        const rec = score.recommendation;

        root.innerHTML = \`
          <div class="score-ring">
            <div>
              <div class="score-number">\${score.overall}</div>
              <div class="score-label">Deploy Score</div>
            </div>
            <div>
              <span class="rec \${rec}">\${rec.toUpperCase()}</span>
            </div>
          </div>

          <div class="pill-row">
            \${summary.critical > 0 ? \`<span class="pill critical">\${summary.critical} critical</span>\` : ""}
            \${summary.high     > 0 ? \`<span class="pill high">\${summary.high} high</span>\` : ""}
            \${summary.medium   > 0 ? \`<span class="pill medium">\${summary.medium} medium</span>\` : ""}
            \${summary.low      > 0 ? \`<span class="pill low">\${summary.low} low</span>\` : ""}
            \${summary.info     > 0 ? \`<span class="pill info">\${summary.info} info</span>\` : ""}
          </div>

          <button class="action" onclick="vscode.postMessage({ type: 'scanWorkspace' })">
            Scan Workspace
          </button>
        \`;
      }
    });
  </script>
</body>
</html>`;
  }
}

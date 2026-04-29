/**
 * ScanRunner — API client and scan orchestrator
 *
 * Responsible for:
 *  - Sending file content to the DeployGuard API endpoint
 *  - Translating the API response into the extension's Finding type
 *  - Dispatching results to DiagnosticProvider and InlineDecorationProvider
 *  - Debouncing rapid save events (300 ms window)
 *  - Caching last scan result per file for quick-fix lookups
 */

import * as vscode from "vscode";
import type { DiagnosticProvider }      from "./diagnosticProvider";
import type { InlineDecorationProvider } from "./inlineDecorations";
import type { ExtensionConfig, Finding, ScanResult } from "./types";

export class ScanRunner {
  private config:     ExtensionConfig;
  private diagnostic: DiagnosticProvider;
  private decoration: InlineDecorationProvider;

  private pendingScans  = new Map<string, ReturnType<typeof setTimeout>>();
  private lastResults   = new Map<string, ScanResult>();

  private readonly DEBOUNCE_MS = 300;

  constructor(
    config:     ExtensionConfig,
    diagnostic: DiagnosticProvider,
    decoration: InlineDecorationProvider,
  ) {
    this.config     = config;
    this.diagnostic = diagnostic;
    this.decoration = decoration;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async scanDocument(document: vscode.TextDocument): Promise<void> {
    const key = document.uri.toString();

    // Cancel any pending debounced scan for this file
    const existing = this.pendingScans.get(key);
    if (existing) clearTimeout(existing);

    await new Promise<void>((resolve) => {
      const timer = setTimeout(async () => {
        this.pendingScans.delete(key);
        await this._doScan(document.uri, document.getText(), document.fileName);
        resolve();
      }, this.DEBOUNCE_MS);
      this.pendingScans.set(key, timer);
    });
  }

  async scanFiles(uris: vscode.Uri[]): Promise<void> {
    await vscode.window.withProgress(
      {
        location:  vscode.ProgressLocation.Notification,
        title:     "DeployGuard: scanning workspace…",
        cancellable: true,
      },
      async (progress, token) => {
        for (let i = 0; i < uris.length; i++) {
          if (token.isCancellationRequested) break;
          const uri = uris[i];
          progress.report({ increment: (i / uris.length) * 100, message: vscode.workspace.asRelativePath(uri) });
          const bytes = await vscode.workspace.fs.readFile(uri);
          await this._doScan(uri, Buffer.from(bytes).toString("utf8"), uri.fsPath);
        }
      },
    );
  }

  async markFalsePositive(finding: Finding): Promise<void> {
    try {
      await this._fetch(`/api/findings/${finding.id}/false-positive`, {
        method: "PATCH",
        body:   JSON.stringify({ falsePositive: true, fingerprint: finding.fingerprint }),
      });
    } catch {
      vscode.window.showWarningMessage("DeployGuard: could not save false-positive flag (offline?)");
    }
  }

  updateConfig(config: ExtensionConfig): void {
    this.config = config;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async _doScan(uri: vscode.Uri, content: string, filePath: string): Promise<void> {
    const findings = await this._callScanApi(content, filePath);
    this.diagnostic.setFindings(uri, findings);
    this.decoration.setFindings(uri, findings);
  }

  private async _callScanApi(content: string, filePath: string): Promise<Finding[]> {
    try {
      const response = await this._fetch("/api/scan/analyze", {
        method: "POST",
        body:   JSON.stringify({ snippet: content, filePath }),
      });

      if (!response.ok) {
        const text = await response.text();
        vscode.window.showErrorMessage(`DeployGuard scan failed: ${text}`);
        return [];
      }

      const json = (await response.json()) as { data?: { scan?: { findings?: unknown[] } } };
      const rawFindings = json?.data?.scan?.findings ?? [];

      // Normalize the API response shape into the extension's Finding type.
      // The /api/scan/analyze endpoint uses the core Finding shape which has
      // filePath/lineNumber at the top level rather than nested in location.
      return rawFindings.map(normalizeApiFinding).filter(Boolean) as Finding[];
    } catch (err) {
      if (err instanceof Error && err.message.includes("ECONNREFUSED")) {
        // Silently skip if the local dev server isn't running
        return [];
      }
      vscode.window.showErrorMessage(`DeployGuard: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  private _fetch(path: string, init: RequestInit): Promise<Response> {
    const url = `${this.config.apiUrl.replace(/\/$/, "")}${path}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.config.apiToken) headers["Authorization"] = `Bearer ${this.config.apiToken}`;
    return fetch(url, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> || {}) } });
  }
}

// ── Normalizer ────────────────────────────────────────────────────────────────

function normalizeApiFinding(raw: unknown): Finding | null {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as Record<string, unknown>;

  const lineNumber = (f.lineNumber as number | undefined) ?? 1;
  const snippet    = (f.snippet as string | undefined) ?? "";

  return {
    id:          String(f.id ?? ""),
    ruleId:      String(f.ruleId ?? ""),
    title:       String(f.title ?? ""),
    description: String(f.description ?? ""),
    severity:    (f.severity as Finding["severity"]) ?? "info",
    category:    (f.category as Finding["category"]) ?? "security",
    location: {
      filePath:    String(f.filePath ?? ""),
      lineStart:   lineNumber,
      lineEnd:     lineNumber,
      columnStart: 1,
      columnEnd:   Math.max(snippet.length, 1),
      snippet,
    },
    remediation:  String(f.remediation ?? ""),
    references:   (f.references as string[]) ?? [],
    falsePositive: Boolean(f.falsePositive),
    fingerprint:  `${f.ruleId}:${f.filePath}:${lineNumber}`,
  };
}

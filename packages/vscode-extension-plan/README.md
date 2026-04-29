# DeployGuard VS Code Extension — Plan

## Overview

A VS Code extension that surfaces DeployGuard scan results inline as you code, before you push.

## Planned Features

- Inline diagnostics (squiggly underlines) for findings flagged by DeployGuard rules
- Sidebar panel showing current scan score and finding breakdown
- On-save scanning against the local DeployGuard instance or API
- Quick-fix code actions for common remediations (e.g., move secret to .env)
- Status bar item showing the current deploy score

## Architecture

```
packages/vscode-extension/
├── src/
│   ├── extension.ts          # Activation entry point
│   ├── diagnostics.ts        # Maps findings → VS Code Diagnostics
│   ├── sidebarProvider.ts    # TreeDataProvider for the findings panel
│   ├── scanRunner.ts         # Calls DeployGuard API or local runner
│   └── codeActions.ts        # Quick-fix providers
├── package.json              # VS Code extension manifest
└── tsconfig.json
```

## API Contract

The extension will POST to `http://localhost:3000/api/scan` with the current file contents
and display results as VS Code Diagnostics using the `vscode.languages.createDiagnosticCollection` API.

## Build Tool

- `vsce` for packaging
- esbuild for bundling
- Mocha + @vscode/test-electron for tests

## Status

Planning phase — implementation begins after core API stabilizes.

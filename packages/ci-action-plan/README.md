# DeployGuard CI Action — Plan

## Overview

A GitHub Actions composite action that runs DeployGuard scans in CI and optionally blocks
merges when the score falls below a configurable threshold.

## Planned Usage

```yaml
# .github/workflows/deployguard.yml
name: DeployGuard Scan
on: [pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: your-org/deployguard-action@v1
        with:
          api-url: ${{ secrets.DEPLOYGUARD_API_URL }}
          api-token: ${{ secrets.DEPLOYGUARD_TOKEN }}
          min-score: 70
          block-on: critical,high
          post-pr-comment: true
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api-url` | yes | — | DeployGuard API base URL |
| `api-token` | yes | — | Auth token |
| `min-score` | no | `60` | Minimum score to pass |
| `block-on` | no | `critical` | Severities that cause workflow failure |
| `post-pr-comment` | no | `true` | Post findings as PR comment |
| `environment` | no | `staging` | Target environment for scan context |

## Outputs

| Output | Description |
|--------|-------------|
| `score` | Overall deploy score (0–100) |
| `recommendation` | `deploy`, `review`, or `block` |
| `report-url` | URL to the full HTML report |

## Architecture

```
packages/ci-action/
├── action.yml           # Action manifest
├── src/
│   ├── main.ts          # Entry — calls scan API, reads results
│   ├── comment.ts       # Formats and posts PR comment via GitHub API
│   └── gate.ts          # Evaluates score vs. thresholds, sets exit code
└── dist/
    └── index.js         # Compiled bundle (committed for use without build step)
```

## Status

Planning phase — implementation begins after core API stabilizes.

#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "Running Codex QA validation..."
"$PROJECT_ROOT/.claude/hooks/pre-commit-validator.sh"

CHANGED_FILES="$(
  {
    git diff --name-only --cached 2>/dev/null || true
    git diff --name-only 2>/dev/null || true
  } | sort -u
)"

if printf '%s\n' "$CHANGED_FILES" | grep -Eq '^(extensions/ritemark/src/flows/|extensions/ritemark/webview/src/components/flows/|\.ritemark/flows/)'; then
  echo "Flow-related changes detected; running targeted flow tests..."
  (
    cd "$PROJECT_ROOT/extensions/ritemark"
    npx tsx src/flows/flowTypes.test.ts
    npx tsx src/flows/FlowExecutor.test.ts
    npx tsx src/flows/nodes/ClaudeCodeNodeExecutor.test.ts
    npx tsx src/flows/FlowIntegration.test.ts
  )
fi

echo "Codex QA validation passed"

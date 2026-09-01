#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "Running Codex QA validation..."
node "$PROJECT_ROOT/scripts/validate-agent-runtime-manifest.mjs"
node --test "$PROJECT_ROOT/scripts/validate-agent-runtime-manifest.test.mjs"
"$PROJECT_ROOT/.claude/hooks/pre-commit-validator.sh"
"$PROJECT_ROOT/scripts/validate-chrome-fast.sh"

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

if printf '%s\n' "$CHANGED_FILES" | grep -Eq '^(extensions/ritemark/src/agent/|extensions/ritemark/src/codex/|extensions/ritemark/src/views/UnifiedViewProvider\.ts|extensions/ritemark/webview/src/components/ai-sidebar/)'; then
  echo "Agent lifecycle changes detected; running targeted lifecycle tests..."
  (
    cd "$PROJECT_ROOT/extensions/ritemark"
    npx tsx src/agent/AgentRunner.test.ts
    npx tsx src/codex/codexApproval.test.ts
    npx tsx webview/src/components/ai-sidebar/lifecycle.test.ts
    npx tsx webview/src/components/ai-sidebar/conversationReset.test.ts
    npx tsx webview/src/components/ai-sidebar/conversationModel.test.ts
    npx tsx webview/src/components/ai-sidebar/runtimeSwitching.test.ts
    npx tsx webview/src/components/ai-sidebar/bootstrapStorageIsolation.test.ts
    npx tsx webview/src/components/ai-sidebar/modelPresentation.test.ts
    npx tsx webview/src/components/ai-sidebar/chatHistoryStorageQuota.test.ts
  )
fi

if printf '%s\n' "$CHANGED_FILES" | grep -Eq '^(extensions/ritemark/src/editorSync/|extensions/ritemark/webview/src/(components/Editor\.tsx|documentSyncReducer|editorValueReconciliation))'; then
  echo "Editor synchronization changes detected; running targeted editor tests..."
  (
    cd "$PROJECT_ROOT/extensions/ritemark"
    npm run test:editor-sync
  )
fi

echo "Codex QA validation passed"

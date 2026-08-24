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
  )
fi

if printf '%s\n' "$CHANGED_FILES" | grep -Eq '^(\.github/workflows/build-windows\.yml|installer/windows/ritemark\.iss|scripts/(codesign-windows|create-windows-installer|validate-build-output|validate-windows-build-trust(\.test)?|verify-windows-signatures(\.test)?|windows-signature-policy(\.test)?|windows-build-contract(\.test)?|find-windows-signing-tools(\.test)?|sign-windows-file|test-windows-release-contract)\.(sh|ps1))$'; then
  echo "Windows trust-chain changes detected; running focused contract fixtures..."
  pwsh -NoLogo -NoProfile -File "$PROJECT_ROOT/scripts/verify-windows-signatures.test.ps1"
  pwsh -NoLogo -NoProfile -File "$PROJECT_ROOT/scripts/windows-signature-policy.test.ps1"
  pwsh -NoLogo -NoProfile -File "$PROJECT_ROOT/scripts/windows-build-contract.test.ps1"
  pwsh -NoLogo -NoProfile -File "$PROJECT_ROOT/scripts/find-windows-signing-tools.test.ps1"
  "$PROJECT_ROOT/scripts/validate-windows-build-trust.test.sh"
  "$PROJECT_ROOT/scripts/test-windows-release-contract.sh"
fi

echo "Codex QA validation passed"

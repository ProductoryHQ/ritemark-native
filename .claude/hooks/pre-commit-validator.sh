#!/bin/bash
# =============================================================================
# RiteMark Native - Pre-Commit Validation Hook
# =============================================================================
# This hook runs automatically before git commit via Claude Code hooks.
# It validates critical invariants to prevent broken commits.
# =============================================================================

set -e

# Get project directory from environment or derive from script location
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$PROJECT_DIR"

# Output validation results in a format Claude can understand
echo "Running pre-commit validation..."

ERRORS=0

# Cross-platform file size: BSD `stat -f%z` (macOS) vs GNU `stat -c%s` (linux)
file_size() {
  stat -f%z "$1" 2>/dev/null || stat -c%s "$1" 2>/dev/null || echo 0
}

# Check 1: Symlink integrity
# Skip when the VS Code submodule isn't present (e.g. Claude Code on the web,
# fresh clone before `git submodule update`) — there's nothing to symlink into.
if [[ -d "vscode" ]] && find vscode -mindepth 1 -maxdepth 1 -print -quit | grep -q .; then
  if [[ ! -L "vscode/extensions/ritemark" ]]; then
    echo "ERROR: vscode/extensions/ritemark symlink is broken"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check 2: Webview bundle size
WEBVIEW_SIZE=$(file_size "extensions/ritemark/media/webview.js")
if [[ $WEBVIEW_SIZE -lt 500000 ]]; then
  echo "ERROR: webview.js too small (${WEBVIEW_SIZE} bytes, need >500KB)"
  ERRORS=$((ERRORS + 1))
fi

# Check 3: Config files not empty
if [[ ! -s "extensions/ritemark/webview/postcss.config.js" ]]; then
  echo "ERROR: postcss.config.js is empty"
  ERRORS=$((ERRORS + 1))
fi

# Check 4: CSS processed (no raw @tailwind)
if grep -q "@tailwind base" "extensions/ritemark/media/webview.js" 2>/dev/null; then
  echo "ERROR: webview.js contains raw @tailwind (CSS not processed)"
  ERRORS=$((ERRORS + 1))
fi

# Check 5: Webview bundle freshness (production inputs vs bundle)
# Colocated tests are not Vite inputs. If production source, dependency locks,
# or dependency patches are staged, the generated bundle must also be staged.
STAGED_WEBVIEW_INPUTS=$(
  {
    git diff --cached --name-only -- "extensions/ritemark/webview/src" 2>/dev/null \
      | grep -Ev '(\.test|\.spec)\.[cm]?[jt]sx?$' || true
    git diff --cached --name-only -- \
      "extensions/ritemark/webview/package.json" \
      "extensions/ritemark/webview/package-lock.json" \
      "extensions/ritemark/webview/patches" 2>/dev/null || true
  } | sort -u
)
if [[ -n "$STAGED_WEBVIEW_INPUTS" ]]; then
  STAGED_BUNDLE=$(git diff --cached --name-only -- "extensions/ritemark/media/webview.js" 2>/dev/null || true)
  if [[ -z "$STAGED_BUNDLE" ]]; then
    echo "ERROR: Webview production inputs changed but webview.js not updated!"
    echo "  Changed: $(echo "$STAGED_WEBVIEW_INPUTS" | wc -l | tr -d ' ') production input(s)"
    echo "  Fix: cd extensions/ritemark/webview && npm run build"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check 6: Webview bundle contains key components
# Sentinel: 'ai-sidebar' is a stable routing key for the AI sidebar / Agent Library
# (introduced Sprint 53, anchored Sprint 54). If this string is missing, the bundle
# is either stale, stubbed, or has lost the AI panel — block the commit.
# The previous sentinel ('document-header') was retired in Sprint 54's toolbar redesign.
if [[ -f "extensions/ritemark/media/webview.js" ]]; then
  if ! grep -q "ai-sidebar" "extensions/ritemark/media/webview.js"; then
    echo "ERROR: webview.js missing ai-sidebar routing key (bundle stale or AI panel removed)"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check 7: Extension compiles
if ! cd extensions/ritemark && npm run compile --silent 2>/dev/null; then
  echo "ERROR: Extension TypeScript compilation failed"
  ERRORS=$((ERRORS + 1))
  cd "$PROJECT_DIR"
fi
cd "$PROJECT_DIR"

# Check 7b: Webview TypeScript typecheck
# vite build does NOT type-check (it only transpiles) — tsc --noEmit is the only type gate.
# Added 2026-06-02 after 6 type errors shipped invisibly in sprint-77 webview code.
# Runs whenever any webview file is staged (src, tsconfig, package.json).
STAGED_WEBVIEW_ANY=$(git diff --cached --name-only -- "extensions/ritemark/webview" 2>/dev/null || true)
if [[ -n "$STAGED_WEBVIEW_ANY" ]]; then
  WEBVIEW_TC_LOG=$(mktemp)
  if ! (cd extensions/ritemark/webview && npx tsc --noEmit > "$WEBVIEW_TC_LOG" 2>&1); then
    echo "ERROR: Webview TypeScript typecheck failed (vite build does not catch type errors)"
    grep "error TS" "$WEBVIEW_TC_LOG" | head -10
    echo "  Fix errors, verify with: cd extensions/ritemark/webview && npm run typecheck"
    ERRORS=$((ERRORS + 1))
  fi
  rm -f "$WEBVIEW_TC_LOG"
fi

# Check 8: VS Code patches applied cleanly
# All patches in patches/vscode/ must be applied (or already applied) — never partially.
# Reverse-applies and re-applies as a dry-run; "Already applied" means OK.
if [[ -x "./scripts/apply-patches.sh" ]]; then
  if ! ./scripts/apply-patches.sh --dry-run 2>&1 | grep -qE "Already applied|Would apply"; then
    PATCH_OUTPUT=$(./scripts/apply-patches.sh --dry-run 2>&1 || true)
    echo "ERROR: VS Code patches not cleanly applied"
    echo "$PATCH_OUTPUT" | tail -5
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check 9: Settings page is the full implementation (NOT a stub)
# v1.3.0 regression: Settings was replaced with a placeholder, breaking ALL AI features.
# Real implementation is 400+ lines. Anything smaller is a stub or accidental gut.
SETTINGS_FILE="extensions/ritemark/webview/src/components/settings/RitemarkSettings.tsx"
if [[ -f "$SETTINGS_FILE" ]]; then
  SETTINGS_LINES=$(wc -l < "$SETTINGS_FILE" | tr -d ' ')
  if [[ $SETTINGS_LINES -lt 400 ]]; then
    echo "ERROR: $SETTINGS_FILE shrunk to $SETTINGS_LINES lines (need ≥400 — full implementation)"
    echo "  Likely regressed to a stub. Restore from git history."
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "ERROR: $SETTINGS_FILE missing"
  ERRORS=$((ERRORS + 1))
fi

# Check 11: a bundled-runtime version bump must come with a re-verified matrix
#
# Sprint 100. Bumping an agent binary changes behaviour our code depends on in
# ways one successful chat does not exercise — the OpenCode permission gate and
# session/cancel are the two that bite. The matrix is only worth having if it is
# re-measured, so a version change in the manifest without a matching matrix
# update is blocked here.
#
# Evidence comes from ./scripts/verify-agent-runtimes.sh, not from prose.
MANIFEST="extensions/ritemark/binaries/agents/manifest.json"
MATRIX="docs/development/agent-runtime-compatibility.md"
if git diff --cached --name-only | grep -qx "$MANIFEST"; then
  # Only care about version changes, not sha/url churn or formatting.
  OLD_VERSIONS=$(git show HEAD:"$MANIFEST" 2>/dev/null \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const m=JSON.parse(d);console.log(m.runtimes.map(r=>r.agent+'@'+r.version).sort().join(','))}catch{console.log('')}})" 2>/dev/null)
  NEW_VERSIONS=$(git show :"$MANIFEST" 2>/dev/null \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const m=JSON.parse(d);console.log(m.runtimes.map(r=>r.agent+'@'+r.version).sort().join(','))}catch{console.log('')}})" 2>/dev/null)
  if [[ -n "$NEW_VERSIONS" && "$OLD_VERSIONS" != "$NEW_VERSIONS" ]]; then
    if git diff --cached --name-only | grep -qx "$MATRIX"; then
      echo "OK: runtime version change accompanied by a matrix update"
    else
      echo "ERROR: bundled runtime versions changed but $MATRIX was not updated"
      echo "  was: ${OLD_VERSIONS:-<none>}"
      echo "  now: $NEW_VERSIONS"
      echo "  Run ./scripts/verify-agent-runtimes.sh and record the results (including"
      echo "  anything it SKIPS — a skip is 'not proven', not a pass)."
      ERRORS=$((ERRORS + 1))
    fi
  fi
fi

# Check 12: build/worktree governance changes must prove both acceptance and
# rejection paths in real disposable Git repositories before commit.
STAGED_BUILD_GUARDS=$(git diff --cached --name-only | grep -E '^((scripts/(verify-release-source|create-release-worktree|test-release-source-integrity|test-worktree-hygiene)\.sh|scripts/(build-provenance|worktree-hygiene|vscode-derived-state)\.mjs|scripts/(build-prod|build-prod-windows|release-preflight|validate-build-output)\.sh)|\.github/workflows/build-)' || true)
if [[ -n "$STAGED_BUILD_GUARDS" ]]; then
  if ! ./scripts/test-release-source-integrity.sh; then
    echo "ERROR: Release source/provenance guard tests failed"
    ERRORS=$((ERRORS + 1))
  fi
  if ! ./scripts/test-worktree-hygiene.sh; then
    echo "ERROR: Worktree hygiene tests failed"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Summary
if [[ $ERRORS -gt 0 ]]; then
  echo ""
  echo "PRE-COMMIT VALIDATION FAILED: $ERRORS error(s)"
  echo "Fix issues before committing."
  exit 2  # Exit 2 = block the operation in Claude Code hooks
fi

echo "Pre-commit validation passed"
exit 0

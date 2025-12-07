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

# Check 1: Symlink integrity
if [[ ! -L "vscode/extensions/ritemark" ]]; then
  echo "ERROR: vscode/extensions/ritemark symlink is broken"
  ERRORS=$((ERRORS + 1))
fi

# Check 2: Webview bundle size
WEBVIEW_SIZE=$(stat -f%z "extensions/ritemark/media/webview.js" 2>/dev/null || echo 0)
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

# Check 5: Extension compiles
if ! cd extensions/ritemark && npm run compile --silent 2>/dev/null; then
  echo "ERROR: Extension TypeScript compilation failed"
  ERRORS=$((ERRORS + 1))
  cd "$PROJECT_DIR"
fi
cd "$PROJECT_DIR"

# Summary
if [[ $ERRORS -gt 0 ]]; then
  echo ""
  echo "PRE-COMMIT VALIDATION FAILED: $ERRORS error(s)"
  echo "Fix issues before committing."
  exit 2  # Exit 2 = block the operation in Claude Code hooks
fi

echo "Pre-commit validation passed"
exit 0

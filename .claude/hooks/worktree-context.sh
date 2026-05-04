#!/bin/bash
# =============================================================================
# RiteMark Native - Worktree Context Hook
# =============================================================================
# Injects branch + worktree info into the session so the agent knows
# which checkout it is operating on. Output goes to stdout, which Claude Code
# surfaces to the model as session context.
# =============================================================================

set -e

# Resolve project root with fallback (worktree-safe)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$PROJECT_DIR"

# Skip silently if not a git repo (e.g. fresh clone before init)
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD)
WORKTREE_PATH=$(git rev-parse --show-toplevel)
COMMON_DIR=$(git rev-parse --git-common-dir)
GIT_DIR=$(git rev-parse --git-dir)

# Detect worktree vs main checkout: in a worktree, GIT_DIR != COMMON_DIR
if [[ "$GIT_DIR" == "$COMMON_DIR" ]]; then
  WORKTREE_KIND="main checkout"
else
  WORKTREE_KIND="worktree"
fi

# Divergence from main (best-effort — don't fail if main is missing)
DIVERGENCE=""
if git rev-parse --verify main >/dev/null 2>&1; then
  AHEAD=$(git rev-list --count main..HEAD 2>/dev/null || echo "?")
  BEHIND=$(git rev-list --count HEAD..main 2>/dev/null || echo "?")
  DIVERGENCE=" | ahead ${AHEAD}, behind ${BEHIND} vs main"
fi

cat <<EOF
[Ritemark Worktree Context]
Project root: $PROJECT_DIR
Branch:       $BRANCH
Checkout:     $WORKTREE_KIND ($WORKTREE_PATH)${DIVERGENCE}
EOF

exit 0

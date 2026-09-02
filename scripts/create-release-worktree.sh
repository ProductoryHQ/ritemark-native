#!/usr/bin/env bash
# Create a disposable, detached release worktree from the exact origin/main SHA.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TARGET_PATH=""
INSTALL_DEPENDENCIES=1

usage() {
  cat <<'EOF'
Usage: ./scripts/create-release-worktree.sh [--path PATH]

Creates a new detached worktree from origin/main, initializes a physical VS Code
submodule at the recorded gitlink, marks the worktree as disposable release
infrastructure, materializes extension/webview dependencies from lockfiles,
and runs the pristine release-source gate.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --path)
      TARGET_PATH="${2:?--path requires a path}"
      shift 2
      ;;
    --skip-dependencies)
      # Used only by the disposable fixture test, whose tiny mock repository has
      # no production dependency graph. Release operators use the default.
      INSTALL_DEPENDENCIES=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

git -C "$PROJECT_ROOT" fetch origin main
SOURCE_COMMIT="$(git -C "$PROJECT_ROOT" rev-parse origin/main^{commit})"
SHORT_COMMIT="$(git -C "$PROJECT_ROOT" rev-parse --short=12 "$SOURCE_COMMIT")"

COMMON_GIT_DIR="$(git -C "$PROJECT_ROOT" rev-parse --git-common-dir)"
if [[ "$COMMON_GIT_DIR" != /* ]]; then
  COMMON_GIT_DIR="$(cd "$PROJECT_ROOT/$COMMON_GIT_DIR" && pwd -P)"
fi
PRIMARY_ROOT="$(dirname "$COMMON_GIT_DIR")"

if [[ -z "$TARGET_PATH" ]]; then
  TARGET_PATH="$PRIMARY_ROOT/.worktrees/release-$SHORT_COMMIT"
elif [[ "$TARGET_PATH" != /* ]]; then
  TARGET_PATH="$PROJECT_ROOT/$TARGET_PATH"
fi

if [[ -e "$TARGET_PATH" || -L "$TARGET_PATH" ]]; then
  echo "ERROR: release worktree target already exists: $TARGET_PATH" >&2
  echo "A release candidate must start in a new path; do not reuse an old RC tree." >&2
  exit 1
fi

mkdir -p "$(dirname "$TARGET_PATH")"
git -C "$PROJECT_ROOT" worktree add --detach "$TARGET_PATH" "$SOURCE_COMMIT"

echo "Initializing independent VS Code submodule..."
git -C "$TARGET_PATH" submodule update --init --checkout vscode

WORKTREE_GIT_DIR="$(git -C "$TARGET_PATH" rev-parse --git-dir)"
if [[ "$WORKTREE_GIT_DIR" != /* ]]; then
  WORKTREE_GIT_DIR="$TARGET_PATH/$WORKTREE_GIT_DIR"
fi

node - "$WORKTREE_GIT_DIR/ritemark-release-worktree.json" "$SOURCE_COMMIT" <<'NODE'
const fs = require('fs');
const [path, sourceCommit] = process.argv.slice(2);
fs.writeFileSync(path, JSON.stringify({
  schemaVersion: 1,
  sourceCommit,
  createdAt: new Date().toISOString(),
  purpose: 'disposable-release-build'
}, null, 2) + '\n');
NODE

if [[ "$INSTALL_DEPENDENCIES" -eq 1 ]]; then
  REQUIRED_NODE_VERSION="$(tr -d '[:space:]' < "$TARGET_PATH/vscode/.nvmrc")"
  NVM_SCRIPT="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  if [[ "$(node -v 2>/dev/null || true)" != "v$REQUIRED_NODE_VERSION" ]]; then
    if [[ ! -s "$NVM_SCRIPT" ]]; then
      echo "ERROR: Node v$REQUIRED_NODE_VERSION is required and nvm is unavailable." >&2
      exit 1
    fi
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    # shellcheck disable=SC1090
    source "$NVM_SCRIPT"
    nvm use "$REQUIRED_NODE_VERSION" >/dev/null
  fi

  echo "Installing extension dependencies from the committed lockfile..."
  (cd "$TARGET_PATH/extensions/ritemark" && npm ci --legacy-peer-deps)
  echo "Installing webview dependencies from the committed lockfile..."
  (cd "$TARGET_PATH/extensions/ritemark/webview" && npm ci)
fi

"$TARGET_PATH/scripts/verify-release-source.sh" --repo "$TARGET_PATH"

echo ""
echo "Release worktree created: $TARGET_PATH"
echo "Source commit: $SOURCE_COMMIT"
echo "Next: cd \"$TARGET_PATH\" && ./scripts/release-preflight.sh"

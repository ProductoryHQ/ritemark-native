#!/usr/bin/env bash
#
# Hard gate for a reproducible Ritemark shell-release source tree.
#
# The release machine is allowed to provide CPU, disk and signing credentials.
# It is not allowed to provide source code, a pre-patched VS Code checkout,
# shared dependencies, or an old build output.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
DEFAULT_ROOT="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$DEFAULT_ROOT"
EXPECTED_REF="origin/main"
TARGET="darwin-arm64"
PHASE="pristine"
EXTENSION_LAYOUT="link"

usage() {
  cat <<'EOF'
Usage: ./scripts/verify-release-source.sh [options]

Options:
  --repo PATH           Repository/worktree to verify (default: script checkout)
  --expected-ref REF    Exact release source ref (default: origin/main)
  --target TARGET       Build target (default: darwin-arm64)
  --phase PHASE         pristine or patched (default: pristine)
  --extension-layout L  link, copy, or absent in patched phase (default: link)
  -h, --help            Show this help

Production callers must use the defaults. --repo and --expected-ref exist so the
guard can be exercised deterministically in disposable test repositories.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      PROJECT_ROOT="${2:?--repo requires a path}"
      shift 2
      ;;
    --expected-ref)
      EXPECTED_REF="${2:?--expected-ref requires a ref}"
      shift 2
      ;;
    --target)
      TARGET="${2:?--target requires a target}"
      shift 2
      ;;
    --phase)
      PHASE="${2:?--phase requires pristine or patched}"
      shift 2
      ;;
    --extension-layout)
      EXTENSION_LAYOUT="${2:?--extension-layout requires link or copy}"
      shift 2
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

case "$PHASE" in
  pristine|patched) ;;
  *)
    echo "ERROR: --phase must be pristine or patched" >&2
    exit 2
    ;;
esac

case "$EXTENSION_LAYOUT" in
  link|copy|absent) ;;
  *)
    echo "ERROR: --extension-layout must be link, copy, or absent" >&2
    exit 2
    ;;
esac

case "$TARGET" in
  darwin-arm64|darwin-x64|win32-x64) ;;
  *)
    echo "ERROR: unsupported release target: $TARGET" >&2
    exit 2
    ;;
esac

if [[ ! -d "$PROJECT_ROOT" ]]; then
  echo "ERROR: repository does not exist: $PROJECT_ROOT" >&2
  exit 1
fi

PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd -P)"
ERRORS=0

pass() { printf '  PASS  %s\n' "$1"; }
fail() { printf '  FAIL  %s\n' "$1" >&2; ERRORS=$((ERRORS + 1)); }

echo "Release source integrity gate"
echo "  repository: $PROJECT_ROOT"
echo "  expected:   $EXPECTED_REF"
echo "  target:     $TARGET"
echo "  phase:      $PHASE"

if ! git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "path is not a Git worktree"
else
  TOP_LEVEL="$(git -C "$PROJECT_ROOT" rev-parse --show-toplevel)"
  TOP_LEVEL="$(cd "$TOP_LEVEL" && pwd -P)"
  if [[ "$TOP_LEVEL" == "$PROJECT_ROOT" ]]; then
    pass "repository root is the selected physical worktree"
  else
    fail "repository root resolves elsewhere: $TOP_LEVEL"
  fi
fi

if ! git -C "$PROJECT_ROOT" rev-parse --verify "$EXPECTED_REF^{commit}" >/dev/null 2>&1; then
  fail "expected ref is unavailable; fetch it first: $EXPECTED_REF"
  EXPECTED_COMMIT=""
else
  EXPECTED_COMMIT="$(git -C "$PROJECT_ROOT" rev-parse "$EXPECTED_REF^{commit}")"
  SOURCE_COMMIT="$(git -C "$PROJECT_ROOT" rev-parse HEAD)"
  if [[ "$SOURCE_COMMIT" == "$EXPECTED_COMMIT" ]]; then
    pass "HEAD exactly matches $EXPECTED_REF ($SOURCE_COMMIT)"
  else
    fail "HEAD $SOURCE_COMMIT does not match $EXPECTED_REF $EXPECTED_COMMIT"
  fi
fi

CURRENT_BRANCH="$(git -C "$PROJECT_ROOT" symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
if [[ -z "$CURRENT_BRANCH" ]]; then
  pass "release worktree uses a detached exact commit"
elif [[ "$CURRENT_BRANCH" == "main" ]]; then
  pass "release worktree is on main"
else
  fail "release builds may only use main or a detached $EXPECTED_REF commit (found: $CURRENT_BRANCH)"
fi

# Ignore the submodule here because it has a separate, stricter state check.
OUTER_STATUS="$(git -C "$PROJECT_ROOT" status --porcelain=v1 --untracked-files=all --ignore-submodules=all)"
if [[ -z "$OUTER_STATUS" ]]; then
  pass "tracked release sources are clean"
else
  fail "release sources contain tracked or untracked changes"
  printf '%s\n' "$OUTER_STATUS" | sed 's/^/        /' >&2
fi

if [[ -L "$PROJECT_ROOT/vscode" ]]; then
  fail "vscode is a symlink; release builds require an independent physical submodule"
elif [[ ! -d "$PROJECT_ROOT/vscode" ]]; then
  fail "vscode submodule directory is missing"
elif ! git -C "$PROJECT_ROOT/vscode" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "vscode submodule is not initialized; run git submodule update --init --checkout vscode"
else
  VSCODE_TOP_LEVEL="$(git -C "$PROJECT_ROOT/vscode" rev-parse --show-toplevel)"
  VSCODE_TOP_LEVEL="$(cd "$VSCODE_TOP_LEVEL" && pwd -P)"
  if [[ "$VSCODE_TOP_LEVEL" != "$PROJECT_ROOT/vscode" ]]; then
    fail "vscode is not its own checkout; Git resolved it to $VSCODE_TOP_LEVEL"
  else
    pass "vscode is an initialized physical Git checkout"

    GITLINK_COMMIT="$(git -C "$PROJECT_ROOT" ls-tree HEAD -- vscode | awk '{print $3}')"
    VSCODE_COMMIT="$(git -C "$PROJECT_ROOT/vscode" rev-parse HEAD)"
    if [[ -n "$GITLINK_COMMIT" && "$VSCODE_COMMIT" == "$GITLINK_COMMIT" ]]; then
      pass "vscode HEAD matches the superproject gitlink ($VSCODE_COMMIT)"
    else
      fail "vscode HEAD $VSCODE_COMMIT does not match gitlink ${GITLINK_COMMIT:-<missing>}"
    fi

    if [[ "$PHASE" == "pristine" ]]; then
      VSCODE_STATUS="$(git -C "$PROJECT_ROOT/vscode" status --porcelain=v1 --untracked-files=all)"
      if [[ -z "$VSCODE_STATUS" ]]; then
        pass "vscode starts from a pristine upstream checkout"
      else
        fail "vscode already contains local patches or files; use a new release worktree"
        printf '%s\n' "$VSCODE_STATUS" | sed 's/^/        /' >&2
      fi
    fi
  fi
fi

for dependency_dir in \
  "$PROJECT_ROOT/vscode/node_modules" \
  "$PROJECT_ROOT/extensions/ritemark/node_modules" \
  "$PROJECT_ROOT/extensions/ritemark/webview/node_modules"; do
  if [[ -L "$dependency_dir" ]]; then
    fail "dependency directory is shared through a symlink: ${dependency_dir#"$PROJECT_ROOT/"}"
  elif [[ -d "$dependency_dir" ]]; then
    pass "dependency directory is physical: ${dependency_dir#"$PROJECT_ROOT/"}"
  fi
done

OUTPUT_DIR="$PROJECT_ROOT/VSCode-$TARGET"
if [[ -e "$OUTPUT_DIR" || -L "$OUTPUT_DIR" ]]; then
  fail "old build output exists: ${OUTPUT_DIR#"$PROJECT_ROOT/"}; use a new release worktree"
else
  pass "build output starts empty"
fi

if [[ "$PHASE" == "patched" ]]; then
  EXTENSION_LINK="$PROJECT_ROOT/vscode/extensions/ritemark"
  if [[ "$EXTENSION_LAYOUT" == "copy" ]]; then
    if [[ -L "$EXTENSION_LINK" || ! -d "$EXTENSION_LINK" ]]; then
      fail "patched vscode is missing the physical extension copy required by CI"
    else
      pass "vscode contains the CI-owned physical extension copy"
    fi
  elif [[ "$EXTENSION_LAYOUT" == "absent" ]]; then
    if [[ -e "$EXTENSION_LINK" || -L "$EXTENSION_LINK" ]]; then
      fail "patched vscode still contains the extension during the staged shell build"
    else
      pass "target extension is explicitly staged outside the VS Code shell tree"
    fi
  elif [[ ! -L "$EXTENSION_LINK" ]]; then
    fail "patched vscode is missing the extension symlink"
  elif [[ "$(readlink "$EXTENSION_LINK")" != "../../extensions/ritemark" ]]; then
    fail "extension symlink has a non-canonical target: $(readlink "$EXTENSION_LINK")"
  else
    LINK_TARGET="$(cd "$(dirname "$EXTENSION_LINK")/$(readlink "$EXTENSION_LINK")" && pwd -P)"
    SOURCE_EXTENSION="$(cd "$PROJECT_ROOT/extensions/ritemark" && pwd -P)"
    if [[ "$LINK_TARGET" == "$SOURCE_EXTENSION" ]]; then
      pass "vscode extension link resolves inside the same release worktree"
    else
      fail "extension link escapes this release worktree: $LINK_TARGET"
    fi
  fi

  # apply-patches.sh writes this marker only after the complete canonical stack
  # succeeds. It binds the source commit, patch-set hash, and final VS Code diff,
  # so verification is deterministic even when later patches overlap earlier
  # hunks. Forward applicability is tested separately against pristine VS Code
  # by release-preflight.sh.
  if node "$PROJECT_ROOT/scripts/vscode-derived-state.mjs" \
      --verify --repo "$PROJECT_ROOT" >/dev/null; then
    pass "canonical patch set and patched vscode match the recorded derived-state fingerprint"
  else
    fail "canonical patch set or patched vscode differs from the state recorded by apply-patches.sh"
  fi
fi

if [[ $ERRORS -gt 0 ]]; then
  echo "RELEASE SOURCE BLOCKED: $ERRORS integrity check(s) failed" >&2
  exit 1
fi

echo "RELEASE SOURCE VERIFIED"

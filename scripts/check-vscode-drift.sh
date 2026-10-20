#!/bin/bash
#
# check-vscode-drift.sh - Measure how far the patch stack is from a newer VS Code
#
# Usage: ./scripts/check-vscode-drift.sh <vscode-tag> [--keep]
#
# Makes a shallow, blob-less clone of microsoft/vscode at <tag> in a temporary
# folder, fetches only the files the patches touch, and dry-applies every
# patches/vscode/*.patch in order in a temporary Git index. When a patch fails,
# the failing file is excluded and the patch is tried again, so every
# conflicting file is listed, not only the first. Nothing in this repository or
# its vscode/ submodule is touched.
#
# Then the hunks (Sprint 135, E1): each patch is applied in order with
# `git apply --reject` to the sparse checkout's working tree, so the hunks that
# apply stay applied and each later patch sees its base, as in a rebase. A
# file the patch modifies that is gone upstream, or a file it creates that
# already exists, counts with all its hunks as rejected.
#
# Output: one line per patch (OK, or FAIL with its failing files and rejected
# hunks), then a summary line: "<patches failing> of <patches> patches fail in
# <files> file patches; <hunks rejected> of <hunks> hunks are rejected".
# The numbers go into the v2.0.0 release plan's risk register at each merge
# (Sprint 132, E6).
#
set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <vscode-tag> [--keep]" >&2
    exit 2
fi

TAG="$1"
KEEP=false
[ "${2:-}" = "--keep" ] && KEEP=true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PATCHES_DIR="$ROOT_DIR/patches/vscode"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ritemark-drift.XXXXXX")"

cleanup() {
    if [ "$KEEP" = true ]; then
        echo "Kept: $WORK_DIR" >&2
    else
        rm -rf "$WORK_DIR"
    fi
}
trap cleanup EXIT

CLONE="$WORK_DIR/vscode"
INDEX="$WORK_DIR/index"

echo "Cloning microsoft/vscode at $TAG (shallow, blob-less)..." >&2
git clone --quiet --depth 1 --filter=blob:none --no-checkout --branch "$TAG" \
    https://github.com/microsoft/vscode.git "$CLONE"

# Fetch the blobs of every file the patches touch in one batch: a sparse
# checkout of exactly those paths. Files a patch creates are simply absent.
PATHS_FILE="$WORK_DIR/paths"
for patch in "$PATCHES_DIR"/*.patch; do
    grep '^diff --git ' "$patch" | awk '{sub("^a/", "", $3); print $3}'
done | sort -u > "$PATHS_FILE"
git -C "$CLONE" sparse-checkout set --no-cone --stdin < "$PATHS_FILE"
git -C "$CLONE" checkout --quiet "$TAG" 2>/dev/null || git -C "$CLONE" checkout --quiet FETCH_HEAD

GIT_INDEX_FILE="$INDEX" git -C "$CLONE" read-tree HEAD

# The files a patch modifies or creates, one per line: "<path> <new|mod> <hunks>".
patch_files() {
    awk '
        function flush() { if (path != "") print path, kind, hunks }
        /^diff --git / { flush(); path = $3; sub("^a/", "", path); kind = "mod"; hunks = 0; next }
        /^new file mode/ { kind = "new"; next }
        /^@@ / { hunks++ }
        END { flush() }
    ' "$1"
}

# Applies one patch's hunks to the sparse working tree. Prints "<hunks> <rejected>".
apply_hunks() {
    local patch="$1" path kind hunks rejected=0 total=0
    local hunk_excludes=()
    while read -r path kind hunks; do
        total=$((total + hunks))
        if { [ "$kind" = "mod" ] && [ ! -e "$CLONE/$path" ]; } || \
           { [ "$kind" = "new" ] && [ -e "$CLONE/$path" ]; }; then
            hunk_excludes+=("--exclude=$path")
            rejected=$((rejected + hunks))
        fi
    done < <(patch_files "$patch")
    local out
    out="$(git -C "$CLONE" apply --reject --whitespace=nowarn \
        "${hunk_excludes[@]+"${hunk_excludes[@]}"}" "$patch" 2>&1 || true)"
    rejected=$((rejected + $(printf '%s\n' "$out" | grep -c '^Rejected hunk' || true)))
    echo "$total $rejected"
}

total_patches=0
failing_patches=0
failing_files=0
total_hunks=0
rejected_hunks=0

for patch in "$PATCHES_DIR"/*.patch; do
    name="$(basename "$patch")"
    total_patches=$((total_patches + 1))
    excludes=()
    failed=()
    while true; do
        if err="$(GIT_INDEX_FILE="$INDEX" git -C "$CLONE" apply --cached "${excludes[@]+"${excludes[@]}"}" "$patch" 2>&1)"; then
            break
        fi
        # The first failing file in git apply's error output.
        file="$(printf '%s\n' "$err" | sed -nE \
            -e 's/^error: patch failed: ([^:]+):[0-9]+$/\1/p' \
            -e 's/^error: ([^:]+): (patch does not apply|does not exist in index|already exists in index)$/\1/p' \
            | head -1)"
        if [ -z "$file" ]; then
            echo "$name: could not read git apply's error:" >&2
            printf '%s\n' "$err" >&2
            exit 1
        fi
        case " ${failed[*]+"${failed[*]}"} " in
            *" $file "*)
                echo "$name: $file still fails after being excluded" >&2
                printf '%s\n' "$err" >&2
                exit 1
                ;;
        esac
        failed+=("$file")
        excludes+=("--exclude=$file")
    done
    read -r hunks rejected < <(apply_hunks "$patch")
    total_hunks=$((total_hunks + hunks))
    rejected_hunks=$((rejected_hunks + rejected))
    if [ "${#failed[@]}" -eq 0 ] && [ "$rejected" -eq 0 ]; then
        echo "OK    $name"
    else
        failing_patches=$((failing_patches + 1))
        failing_files=$((failing_files + ${#failed[@]}))
        echo "FAIL  $name (${#failed[@]} files; $rejected of $hunks hunks rejected)"
        for f in "${failed[@]+"${failed[@]}"}"; do
            echo "        $f"
        done
    fi
done

echo
echo "VS Code $TAG: $failing_patches of $total_patches patches fail in $failing_files file patches; $rejected_hunks of $total_hunks hunks are rejected"

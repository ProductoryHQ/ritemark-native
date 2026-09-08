#!/usr/bin/env bash
# =============================================================================
# Shared helper for the vscode/extensions/ritemark link invariant
# =============================================================================
# `.claude/hooks/pre-commit-validator.sh` requires `[ -L vscode/extensions/
# ritemark ]`. Two Windows-only hazards make the naive
# "readlink == ../../extensions/ritemark" test actively destructive:
#
#   1. A directory junction -- the only link type creatable without Developer
#      Mode or admin rights -- makes `readlink` return an ABSOLUTE path, so the
#      literal comparison never matches and a perfectly good link is deleted.
#   2. `ln -s` in Git Bash without native symlink support does NOT link: it
#      silently deep-copies (measured 2026-09-07: 534 MB, 32,325 files incl.
#      node_modules). `ls` looks correct, but the build decouples from source
#      edits and the pre-commit invariant fails.
#
# So: compare RESOLVED physical paths, create junctions on Windows, and assert
# the result is a link before returning. Git Bash reports a junction as
# `lrwxrwxrwx` and `[ -L ]` is true for it, so a junction satisfies the hook.
#
# Source this file; do not execute it.
# =============================================================================

ritemark_link_is_windows() {
  case "${OSTYPE:-}" in
    msys*|cygwin*|win32) return 0 ;;
  esac
  case "$(uname -s 2>/dev/null)" in
    MINGW*|MSYS*|CYGWIN*) return 0 ;;
  esac
  return 1
}

# Physical absolute path of an existing directory; empty when it does not
# resolve. Resolving through the link is the whole point: a junction's raw
# readlink output can never equal the relative target we would write.
ritemark_link_resolve() {
  local path="$1"
  [ -d "$path" ] || return 0
  (cd "$path" 2>/dev/null && pwd -P) || true
}

# Windows paths are case-insensitive, and readlink/pwd casing on a junction
# does not have to match how the repo root was typed.
ritemark_link_same_path() {
  local a="$1" b="$2"
  [ -n "$a" ] && [ -n "$b" ] || return 1
  [ "$a" = "$b" ] && return 0
  ritemark_link_is_windows || return 1

  # Case-insensitive retry on Windows only. `case` with a quoted pattern is a
  # literal compare using shell builtins (works on macOS's bash 3.2 too).
  local rc=1 saved
  saved="$(shopt -p nocasematch || true)"  # exits 1 when unset
  shopt -s nocasematch
  case "$a" in
    "$b") rc=0 ;;
  esac
  eval "${saved:-}"
  return "$rc"
}

# True when $1 is a link that resolves to the same directory as $2.
ritemark_link_points_at() {
  local link="$1" source_dir="$2"
  [ -L "$link" ] || return 1
  ritemark_link_same_path \
    "$(ritemark_link_resolve "$link")" \
    "$(ritemark_link_resolve "$source_dir")"
}

# Create the link. $1 = link path (must not exist), $2 = canonical source dir,
# $3 = relative target used on POSIX (default ../../extensions/ritemark).
ritemark_link_create() {
  local link="$1"
  local source_dir="$2"
  local rel_target="${3:-../../extensions/ritemark}"

  if ritemark_link_is_windows; then
    # `ln -s` here would deep-copy instead of linking. A junction needs no
    # admin rights and satisfies `[ -L ]` under Git Bash.
    if ! command -v cygpath >/dev/null 2>&1; then
      echo "ERROR: cygpath is required to create the extension junction on Windows" >&2
      return 1
    fi
    local win_link win_target
    win_link="$(cygpath -w "$link")"
    win_target="$(cygpath -w "$source_dir")"
    # Disable MSYS/MSYS2 argument mangling so `/c` and `/J` reach cmd intact.
    if ! MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' \
        cmd /c mklink /J "$win_link" "$win_target" >/dev/null 2>&1; then
      echo "ERROR: 'mklink /J' failed: $win_link -> $win_target" >&2
      return 1
    fi
  else
    ln -s "$rel_target" "$link"
  fi

  # Never return having produced a copy. Anything non-link here was created by
  # the call above, so removing it is safe -- and leaving it is worse: a deep
  # copy looks correct in `ls` while silently decoupling the build from source.
  if [ ! -L "$link" ]; then
    if [ -d "$link" ]; then
      echo "ERROR: linking produced a physical directory, not a link: $link" >&2
      echo "  Git Bash without native symlink support deep-copies on 'ln -s'." >&2
      echo "  Removing the copy just created; rerun from a shell where" >&2
      echo "  'cmd /c mklink /J' works (no admin rights required)." >&2
      rm -rf "$link"
    else
      echo "ERROR: failed to create extension link: $link" >&2
    fi
    return 1
  fi

  return 0
}

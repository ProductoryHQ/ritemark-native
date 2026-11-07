# test-profile-guard.sh — sourced, never run, by with-test-keys.sh and dev-launch-isolated.sh: the one rule for where
# a test run's profile may be (ritemark-dev governance/test-keys.md, *Rules*: "never Jarmo's real Ritemark profile").
#
#   test_profile_check <path>          where a test run's profile (--user-data-dir) may be
#   test_profile_env_check             VS Code's own profile variables are not set
#   test_shared_data_dir_check <path>  a --shared-data-dir is not ~/.ritemark-shared, nor inside it
#
# Returns 0 and prints the folder's physical path (the parent's physical path plus the name, while the folder isn't
# made yet) when <path> may be a test run's profile:
#   - an absolute path, in a folder that exists, with no . or .. segment and no whitespace (dev-launch-isolated.sh's
#     stop matches the profile flag up to a space, so "<profile> x" would be taken for this run's);
#   - strictly under /private/tmp or /tmp, or under $TMPDIR when $TMPDIR has at least 3 path segments (so a TMPDIR of
#     / or $HOME widens nothing);
#   - never Ritemark's real profile (~/Library/Application Support/Ritemark) or ~/.ritemark-shared, nor inside them
#     (compared without regard to case: the Mac's disk is case-insensitive).
# Otherwise returns 1 and prints why, as the end of a sentence about the path ("must be an absolute path").
# It makes and changes nothing. Works under bash 3.2, with or without set -e / set -u, and uses no arrays.

_tpg_resolve_dir() { # the folder's physical path, or the parent's plus the name when the folder isn't made yet
  if [ -d "$1" ]; then (cd -P "$1" 2>/dev/null && pwd -P)
  else
    local parent
    parent="$(dirname "$1")"
    [ -d "$parent" ] || return 1
    printf '%s/%s\n' "$(cd -P "$parent" 2>/dev/null && pwd -P)" "$(basename "$1")"
  fi
}

_tpg_under() { case "$1/" in "$2"/*) [ "$1" != "$2" ] ;; *) return 1 ;; esac; }

_tpg_lower() { printf '%s\n' "$1" | tr '[:upper:]' '[:lower:]'; }

_tpg_same_or_under() { # $1 is $2 or inside it, without regard to case
  local a b
  a="$(_tpg_lower "$1")"
  b="$(_tpg_lower "$2")"
  [ "$a" = "$b" ] || _tpg_under "$a" "$b"
}

_tpg_has_space() { case "$1" in *[[:space:]]*) return 0 ;; *) return 1 ;; esac; }

_tpg_segments() { local s="${1#/}"; s="${s%/}"; [ -z "$s" ] && { echo 0; return 0; }; local IFS=/; set -- $s; echo $#; }

test_profile_check() {
  local profile="${1:-}" real real_tmp root real_root r allowed=0
  case "$profile" in /*) ;; *) echo "must be an absolute path"; return 1 ;; esac
  if _tpg_has_space "$profile"; then echo "must not contain whitespace"; return 1; fi
  real="$(_tpg_resolve_dir "$profile")" || { echo "must be in a folder that exists"; return 1; }
  if _tpg_has_space "$real"; then echo "must not contain whitespace (it resolves to a path that does)"; return 1; fi
  case "/$real/" in */../*|*/./*) echo "must not contain . or .. segments"; return 1 ;; esac

  real_tmp=""
  if [ -n "${TMPDIR:-}" ]; then
    real_tmp="$( (cd -P "$TMPDIR" 2>/dev/null && pwd -P) )" || real_tmp=""
    if [ -n "$real_tmp" ] && [ "$(_tpg_segments "$real_tmp")" -lt 3 ]; then real_tmp=""; fi
  fi
  for root in /private/tmp /tmp "$real_tmp"; do
    [ -n "$root" ] || continue
    real_root="$( (cd -P "$root" 2>/dev/null && pwd -P) )" || continue
    [ -n "$real_root" ] || continue
    if _tpg_under "$real" "${real_root%/}"; then allowed=1; fi
  done
  if [ "$allowed" != 1 ]; then
    echo "must be under /private/tmp or /tmp (or a TMPDIR of 3+ segments), never a real profile"
    return 1
  fi

  for root in "${HOME:-/nonexistent}/Library/Application Support/Ritemark" "${HOME:-/nonexistent}/.ritemark-shared"; do
    r="$( (cd -P "$root" 2>/dev/null && pwd -P) )" || continue
    [ -n "$r" ] || continue
    if _tpg_same_or_under "$real" "$r"; then
      echo "points into Ritemark's real profile"
      return 1
    fi
  done
  printf '%s\n' "$real"
}

# VS Code reads VSCODE_PORTABLE and VSCODE_APPDATA before --user-data-dir: either, set at all (an empty value too),
# would move the profile or the shared data somewhere no check here has seen. Returns 1 and the variable's name.
test_profile_env_check() {
  if [ -n "${VSCODE_PORTABLE+set}" ]; then echo "VSCODE_PORTABLE"; return 1; fi
  if [ -n "${VSCODE_APPDATA+set}" ]; then echo "VSCODE_APPDATA"; return 1; fi
  return 0
}

# A --shared-data-dir value: never ~/.ritemark-shared (the installed app's Open Recent and shared state), nor a
# folder inside it, by its physical path (a link or a .. that lands there counts), made yet or not. A value that
# can't be resolved (empty, or in a folder that doesn't exist) is refused too. Returns 1 and why.
test_shared_data_dir_check() {
  local dir="${1:-}" real shared
  [ -n "$dir" ] || { echo "is empty"; return 1; }
  real="$(_tpg_resolve_dir "$dir")" || { echo "must be in a folder that exists"; return 1; }
  [ -n "$real" ] || { echo "must be in a folder that exists"; return 1; }
  shared="$(_tpg_resolve_dir "${HOME:-/nonexistent}/.ritemark-shared")" || shared="${HOME:-/nonexistent}/.ritemark-shared"
  if _tpg_same_or_under "$real" "$shared"; then echo "is ~/.ritemark-shared or inside it"; return 1; fi
  return 0
}

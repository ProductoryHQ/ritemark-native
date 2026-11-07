# test-profile-guard.sh — sourced, never run, by with-test-keys.sh and dev-launch-isolated.sh: the one rule for where
# a test run's profile may be (ritemark-dev governance/test-keys.md, *Rules*: "never Jarmo's real Ritemark profile").
#
#   test_profile_check <path>
#
# Returns 0 and prints the folder's physical path (the parent's physical path plus the name, while the folder isn't
# made yet) when <path> may be a test run's profile:
#   - an absolute path, in a folder that exists, with no . or .. segment;
#   - strictly under /private/tmp or /tmp, or under $TMPDIR when $TMPDIR has at least 3 path segments (so a TMPDIR of
#     / or $HOME widens nothing);
#   - never Ritemark's real profile (~/Library/Application Support/Ritemark) or ~/.ritemark-shared, nor inside them.
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

_tpg_segments() { local s="${1#/}"; s="${s%/}"; [ -z "$s" ] && { echo 0; return 0; }; local IFS=/; set -- $s; echo $#; }

test_profile_check() {
  local profile="${1:-}" real real_tmp root real_root r allowed=0
  case "$profile" in /*) ;; *) echo "must be an absolute path"; return 1 ;; esac
  real="$(_tpg_resolve_dir "$profile")" || { echo "must be in a folder that exists"; return 1; }
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
    if [ "$real" = "$r" ] || _tpg_under "$real" "$r"; then
      echo "points into Ritemark's real profile"
      return 1
    fi
  done
  printf '%s\n' "$real"
}

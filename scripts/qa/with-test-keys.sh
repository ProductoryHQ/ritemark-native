#!/usr/bin/env bash
set +o xtrace; unset BASH_XTRACEFD BASH_ENV
# with-test-keys.sh — run one test command with Ritemark's test keys in its environment.
#
#   RITEMARK_BUILD_CHANNEL=test RITEMARK_TEST_PROFILE=/private/tmp/rm-t1 \
#     scripts/qa/with-test-keys.sh --require cloudflare,cloudflare-account-id [--only gemini] \
#       -- <launch command> --user-data-dir=/private/tmp/rm-t1 [args...]
#
# The keys live in the macOS Keychain, service `ritemark-test-keys`, one account per key
# (ritemark-dev governance/test-keys.md). This script reads only the entries the run names into
# shell variables, exports each under its environment name and `exec`s the command, so the values
# exist only in that one process tree's environment. It never prints, logs or writes a value,
# never puts one in an argument (nothing the key touches shows in `ps`'s command lines), and
# prints only the names of what it loaded or couldn't find. The first line turns tracing off, so a
# caller's SHELLOPTS=xtrace can't trace the export.
#
# It refuses to run unless all of these hold (test-keys.md, *Rules*):
#   - RITEMARK_BUILD_CHANNEL=test
#   - RITEMARK_TEST_PROFILE names the run's own profile folder, under /private/tmp or /tmp, or
#     under $TMPDIR when $TMPDIR has at least 3 path segments; never Ritemark's real profile or
#     ~/.ritemark-shared.
#   - the command carries exactly one --user-data-dir, equal to RITEMARK_TEST_PROFILE, and is not
#     a shell or a wrapper (bash -c, env, sudo…) that could launch something else.
#
# --require <names>: those vault entries must be there, or the script stops and names each
# missing one with the command that adds it.
# --only <names>: also load these when present; a missing one is named and skipped.
# Nothing else is read from the vault.
#
# Sprint 149 (W0, E3). Its tests: scripts/qa/with-test-keys.test.mjs (a fake `security`, used only
# when RITEMARK_TEST_KEYS_FAKE=1 is set too).

set -u

SERVICE="ritemark-test-keys"
SECURITY_BIN="/usr/bin/security"
if [ "${RITEMARK_TEST_KEYS_FAKE:-}" = "1" ] && [ -n "${RITEMARK_SECURITY_BIN:-}" ]; then
  SECURITY_BIN="$RITEMARK_SECURITY_BIN"
fi

# vault name → environment variable (test-keys.md's registry, plus Sprint 149's two Cloudflare rows)
VAULT_NAMES=(cloudflare cloudflare-account-id elevenlabs gemini openai anthropic openrouter)
env_name_for() {
  case "$1" in
    cloudflare) echo CLOUDFLARE_API_TOKEN ;;
    cloudflare-account-id) echo CLOUDFLARE_ACCOUNT_ID ;;
    elevenlabs) echo ELEVENLABS_API_KEY ;;
    gemini) echo GOOGLE_GENERATIVE_AI_API_KEY ;;
    openai) echo OPENAI_API_KEY ;;
    anthropic) echo ANTHROPIC_API_KEY ;;
    openrouter) echo OPENROUTER_API_KEY ;;
    *) return 1 ;;
  esac
}

say() { printf 'with-test-keys: %s\n' "$*" >&2; }
refuse() { say "$*"; exit 64; }
add_hint() { printf 'security add-generic-password -U -s %s -a %s -w' "$SERVICE" "$1"; }
USAGE="usage: with-test-keys.sh --require name,name | --only name,name -- <command> --user-data-dir=<profile> [args...]"

# --- arguments ---------------------------------------------------------------------------
REQUIRED=""
OPTIONAL=""
while [ $# -gt 0 ]; do
  case "$1" in
    --require) [ $# -ge 2 ] || refuse "$USAGE"; REQUIRED="$2"; shift 2 ;;
    --require=*) REQUIRED="${1#--require=}"; shift ;;
    --only) [ $# -ge 2 ] || refuse "$USAGE"; OPTIONAL="$2"; shift 2 ;;
    --only=*) OPTIONAL="${1#--only=}"; shift ;;
    --) shift; break ;;
    *) refuse "$USAGE" ;;
  esac
done
[ $# -gt 0 ] || refuse "$USAGE"

IFS=',' read -r -a REQUIRED_LIST <<< "$REQUIRED"
IFS=',' read -r -a OPTIONAL_LIST <<< "$OPTIONAL"
WANTED=()
for name in "${REQUIRED_LIST[@]:-}" "${OPTIONAL_LIST[@]:-}"; do
  [ -z "$name" ] && continue
  env_name_for "$name" >/dev/null || refuse "unknown vault name: $name (known: ${VAULT_NAMES[*]})"
  WANTED+=("$name")
done
[ ${#WANTED[@]} -gt 0 ] || refuse "name the keys this run needs with --require or --only. $USAGE"

# --- the guard: test channel and a test profile ---------------------------------------------
[ "${RITEMARK_BUILD_CHANNEL:-}" = "test" ] \
  || refuse "refused: set RITEMARK_BUILD_CHANNEL=test (test keys are for test runs only)"

PROFILE="${RITEMARK_TEST_PROFILE:-}"
[ -n "$PROFILE" ] || refuse "refused: set RITEMARK_TEST_PROFILE to the run's own profile folder under /private/tmp"
case "$PROFILE" in /*) ;; *) refuse "refused: RITEMARK_TEST_PROFILE must be an absolute path" ;; esac

resolve_dir() { # the folder's physical path, or the parent's when the folder isn't made yet
  if [ -d "$1" ]; then (cd -P "$1" 2>/dev/null && pwd -P)
  else local parent; parent="$(dirname "$1")"; [ -d "$parent" ] || return 1
    printf '%s/%s\n' "$(cd -P "$parent" 2>/dev/null && pwd -P)" "$(basename "$1")"; fi
}
REAL_PROFILE="$(resolve_dir "$PROFILE")" || refuse "refused: RITEMARK_TEST_PROFILE's folder doesn't exist"
case "/$REAL_PROFILE/" in */../*|*/./*) refuse "refused: RITEMARK_TEST_PROFILE must not contain . or .. segments" ;; esac

under() { case "$1/" in "$2"/*) [ "$1" != "$2" ] ;; *) return 1 ;; esac; }
segments() { local s="${1#/}"; s="${s%/}"; [ -z "$s" ] && { echo 0; return; }; local IFS=/; set -- $s; echo $#; }

ROOTS=(/private/tmp /tmp)
if [ -n "${TMPDIR:-}" ]; then
  real_tmp="$( (cd -P "$TMPDIR" 2>/dev/null && pwd -P) )"
  if [ -n "$real_tmp" ] && [ "$(segments "$real_tmp")" -ge 3 ]; then ROOTS+=("$real_tmp"); fi
fi
ALLOWED=0
for root in "${ROOTS[@]}"; do
  real_root="$( (cd -P "$root" 2>/dev/null && pwd -P) )" || continue
  [ -n "$real_root" ] || continue
  if under "$REAL_PROFILE" "${real_root%/}"; then ALLOWED=1; fi
done
[ "$ALLOWED" = 1 ] || refuse "refused: RITEMARK_TEST_PROFILE must be under /private/tmp or /tmp (or a TMPDIR of 3+ segments), never a real profile"

for real in "${HOME:-/nonexistent}/Library/Application Support/Ritemark" "${HOME:-/nonexistent}/.ritemark-shared"; do
  r="$( (cd -P "$real" 2>/dev/null && pwd -P) )" || continue
  [ -n "$r" ] || continue
  if [ "$REAL_PROFILE" = "$r" ] || under "$REAL_PROFILE" "$r"; then
    refuse "refused: RITEMARK_TEST_PROFILE points into Ritemark's real profile"
  fi
done

# The command itself: not a shell or a wrapper, and exactly one --user-data-dir, this profile.
case "$(basename "$1")" in
  sh|bash|zsh|dash|ksh|fish|env|sudo|xargs|nohup|exec|eval|command|osascript|script)
    refuse "refused: run the launch command directly, not through $(basename "$1")" ;;
esac
DIR_COUNT=0
prev=""
for arg in "$@"; do
  dir=""
  case "$arg" in --user-data-dir=*) dir="${arg#--user-data-dir=}"; DIR_COUNT=$((DIR_COUNT + 1)) ;; esac
  if [ "$prev" = "--user-data-dir" ]; then dir="$arg"; DIR_COUNT=$((DIR_COUNT + 1)); fi
  if [ -n "$dir" ] && [ "${dir%/}" != "${PROFILE%/}" ]; then
    refuse "refused: the command's --user-data-dir isn't RITEMARK_TEST_PROFILE"
  fi
  prev="$arg"
done
[ "$DIR_COUNT" = 1 ] || refuse "refused: the command needs exactly one --user-data-dir=\$RITEMARK_TEST_PROFILE (found $DIR_COUNT)"

[ -x "$SECURITY_BIN" ] || refuse "the macOS 'security' tool isn't there; the Mac vault is the Keychain (Windows: with-test-keys.ps1, not written yet)"

# --- read the vault: only the named entries ---------------------------------------------------
is_required() { local n; for n in "${REQUIRED_LIST[@]:-}"; do [ "$n" = "$1" ] && return 0; done; return 1; }

LOADED=()
MISSING=()
MISSING_REQUIRED=()
for name in "${WANTED[@]}"; do
  var="$(env_name_for "$name")"
  # The value goes from security's stdout straight into a variable; stderr is dropped, since it
  # can echo the item's attributes. Nothing here prints it.
  value="$("$SECURITY_BIN" find-generic-password -s "$SERVICE" -a "$name" -w 2>/dev/null)"
  status=$?
  if [ $status -eq 0 ] && [ -n "$value" ]; then
    export "$var=$value"
    LOADED+=("$name→$var")
  else
    # 44 is "not found"; anything else (a denied prompt, a locked Keychain) is named the same way,
    # without the tool's own message.
    if is_required "$name"; then MISSING_REQUIRED+=("$name"); else MISSING+=("$name"); fi
  fi
  unset value
done

if [ ${#MISSING_REQUIRED[@]} -gt 0 ]; then
  for name in "${MISSING_REQUIRED[@]}"; do
    say "missing from the vault: '$name' (service $SERVICE). Jarmo adds it once with: $(add_hint "$name")"
  done
  exit 65
fi

[ ${#LOADED[@]} -gt 0 ] && say "loaded: ${LOADED[*]}"
[ ${#MISSING[@]} -gt 0 ] && say "not in the vault (skipped): ${MISSING[*]}"

exec "$@"

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
# Names (security review of #681): the five provider keys travel under Ritemark-only names,
# RITEMARK_TEST_KEY_<PROVIDER>, never the provider's standard name (OPENAI_API_KEY…), which every
# tool in the launched tree picks up by itself: Claude Code (a plan sign-in would switch to the API
# key), Codex, git hooks, MCP servers, a terminal's `env`. Ritemark's extension host reads them
# once at activation, in the test channel only, deletes them from its own environment, and hands a
# key to an agent only under the name that agent expects (extensions/ritemark/src/ai/providerKeys.ts).
# What still inherits the RITEMARK_TEST_KEY_* names: Ritemark's main process and what it starts
# besides the extension host, terminals among them. So an agent, or anyone driving the test window,
# must never echo them: no `env`, `printenv` or `echo $RITEMARK_TEST_KEY_…` in a terminal or an
# agent's shell tool; `env | grep -c RITEMARK_TEST_KEY` (a count) at most.
# Cloudflare's two keep their names (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID): only
# scripts/qa/cloudflare-contract.mjs reads them, run directly by this script; Ritemark never does.
# Don't load them into a Ritemark launch (wrangler, in a terminal, would pick the token up).
#
# Sprint 149 (W0, E3). Its tests: scripts/qa/with-test-keys.test.mjs (a fake `security`, used only
# when RITEMARK_TEST_KEYS_FAKE=1 is set too).

set -u

SERVICE="ritemark-test-keys"
SECURITY_BIN="/usr/bin/security"
if [ "${RITEMARK_TEST_KEYS_FAKE:-}" = "1" ] && [ -n "${RITEMARK_SECURITY_BIN:-}" ]; then
  SECURITY_BIN="$RITEMARK_SECURITY_BIN"
fi

# vault name → environment variable (test-keys.md's registry, plus Sprint 149's two Cloudflare rows).
# The provider keys' names are Ritemark-only (see *Names* above); keep them in step with TEST_KEY_ENV in
# extensions/ritemark/src/ai/providerKeys.ts.
VAULT_NAMES=(cloudflare cloudflare-account-id elevenlabs gemini openai anthropic openrouter)
env_name_for() {
  case "$1" in
    cloudflare) echo CLOUDFLARE_API_TOKEN ;;
    cloudflare-account-id) echo CLOUDFLARE_ACCOUNT_ID ;;
    elevenlabs) echo RITEMARK_TEST_KEY_ELEVENLABS ;;
    gemini) echo RITEMARK_TEST_KEY_GOOGLE ;;
    openai) echo RITEMARK_TEST_KEY_OPENAI ;;
    anthropic) echo RITEMARK_TEST_KEY_ANTHROPIC ;;
    openrouter) echo RITEMARK_TEST_KEY_OPENROUTER ;;
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

# Where a test profile may be: the rule dev-launch-isolated.sh's --user-data-dir shares (test-profile-guard.sh)
GUARD="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/test-profile-guard.sh"
[ -f "$GUARD" ] || refuse "refused: $GUARD is missing"
. "$GUARD"
REAL_PROFILE="$(test_profile_check "$PROFILE")" || refuse "refused: RITEMARK_TEST_PROFILE $REAL_PROFILE"

# The command itself: not a shell or a wrapper, and exactly one --user-data-dir, this profile.
case "$(basename "$1")" in
  sh|bash|zsh|dash|ksh|fish|env|sudo|xargs|nohup|exec|eval|command|osascript|script)
    refuse "refused: run the launch command directly, not through $(basename "$1")" ;;
esac
DIR_COUNT=0
prev=""
for arg in "$@"; do
  found=0
  dir=""
  case "$arg" in --user-data-dir=*) dir="${arg#--user-data-dir=}"; found=1 ;; esac
  if [ "$prev" = "--user-data-dir" ]; then dir="$arg"; found=1; fi
  if [ "$found" = 1 ]; then
    DIR_COUNT=$((DIR_COUNT + 1))
    # Every value is checked, an empty one included.
    [ -n "$dir" ] || refuse "refused: the command's --user-data-dir is empty"
    [ "${dir%/}" = "${PROFILE%/}" ] || refuse "refused: the command's --user-data-dir isn't RITEMARK_TEST_PROFILE"
  fi
  prev="$arg"
done
[ "$prev" != "--user-data-dir" ] || refuse "refused: the command's --user-data-dir has no value"
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

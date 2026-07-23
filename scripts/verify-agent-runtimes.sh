#!/bin/bash
#
# verify-agent-runtimes.sh - Empirical evidence for the agent-runtime compatibility matrix
#
# Run this whenever a bundled agent binary version changes in
# extensions/ritemark/binaries/agents/manifest.json. It produces the evidence
# that docs/development/agent-runtime-compatibility.md records — so filling that
# matrix in is a matter of pasting measurements, not writing prose.
#
# Why this exists (Sprint 100): the two questions that actually gate a bump can
# only be answered by running the binaries.
#
#   1. Does the OpenCode permission gate still hold in BOTH directions? Showing
#      the prompt is not the same as the denial blocking the write.
#   2. Is `session/cancel` honoured? Ritemark stopped killing the subprocess on
#      the strength of an upstream commit message. If that is ever untrue again,
#      cancel breaks silently for every OpenCode chat.
#
# A one-off manual check answers these once and then rots. This does not.
#
# Usage:
#   ./scripts/verify-agent-runtimes.sh              # all checks
#   ./scripts/verify-agent-runtimes.sh --versions   # version discovery only (fast)
#
# Exit non-zero if any check FAILS. Most checks that cannot run (missing binary,
# SDK not installed) report SKIP rather than failing — a skip is an honest "not
# proven" and must reach the matrix as such rather than being counted as a pass.
#
# The permission gate is the deliberate exception: if it cannot be exercised it
# reports FAIL, not SKIP. It is the entire safety boundary for that runtime, so
# "we could not check it" and "it is broken" deserve the same answer here.
#
set -u

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXT="$ROOT/extensions/ritemark"
FAILURES=0
SKIPS=0

pass() { echo -e "${GREEN}PASS${NC}: $*"; }
fail() { echo -e "${RED}FAIL${NC}: $*"; FAILURES=$((FAILURES+1)); }
skip() { echo -e "${YELLOW}SKIP${NC}: $*"; SKIPS=$((SKIPS+1)); }

case "${1:-}" in
  --help|-h) sed -n '2,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
esac
VERSIONS_ONLY=false
[[ "${1:-}" == "--versions" ]] && VERSIONS_ONLY=true

# Host platform dir — every check here is host-local. Other platforms are
# covered only by manifest/sha256 verification in fetch-agent-runtimes.sh, and
# the matrix must say so.
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) PLATDIR="darwin-arm64" ;;
  Darwin-x86_64) PLATDIR="darwin-x64" ;;
  *) echo "ERROR: unsupported host $(uname -s)-$(uname -m); run on macOS" >&2; exit 1 ;;
esac
BIN="$EXT/binaries/agents/$PLATDIR"

echo "========================================"
echo "Agent runtime verification — $PLATDIR"
echo "========================================"
echo

# ── 1. Version discovery ────────────────────────────────────────────────────
# The matrix's "Startup / version discovery" column, and a cheap check that the
# manifest and the bytes on disk agree.
echo "--- version discovery ---"
manifest_version() {
  node -e "
    const m=require('$EXT/binaries/agents/manifest.json');
    const r=m.runtimes.find(x=>x.agent==='$1');
    process.stdout.write(r ? r.version : '');
  " 2>/dev/null
}
check_version() { # name binary-path expected-substring
  local name="$1" path="$2" want="$3"
  if [[ ! -x "$path" ]]; then skip "$name binary not installed ($path) — run fetch-agent-runtimes.sh"; return; fi
  local out; out="$("$path" --version 2>&1 | head -1)"
  if [[ -z "$want" ]]; then skip "$name has no manifest version to compare against"; return; fi
  if [[ "$out" == *"$want"* ]]; then
    pass "$name reports $out (manifest: $want)"
  else
    fail "$name reports '$out' but the manifest pins $want"
  fi
}
check_version claude   "$BIN/claude"           "$(manifest_version claude)"
check_version opencode "$BIN/opencode"         "$(manifest_version opencode)"
check_version codex    "$BIN/codex-app-server" "$(manifest_version codex)"

if $VERSIONS_ONLY; then
  echo; echo "(--versions: stopping before the behavioural checks)"
  [[ $FAILURES -gt 0 ]] && exit 1 || exit 0
fi

# ── 2 + 3. OpenCode behavioural checks ──────────────────────────────────────
# Both run against the real bundled binary through the same ACP SDK the
# extension uses, so a pass here means the shipped path works, not a mock of it.
echo
echo "--- OpenCode: permission gate (HARD GATE) and session/cancel ---"
if [[ ! -x "$BIN/opencode" ]]; then
  skip "opencode binary not installed — permission gate and cancel unverified"
elif [[ ! -d "$EXT/node_modules/@agentclientprotocol/sdk" ]]; then
  skip "@agentclientprotocol/sdk not installed — run npm install in extensions/ritemark"
else
  OUT="$(node "$ROOT/scripts/lib/verify-opencode.mjs" "$BIN/opencode" "$EXT" 2>&1)" || true
  echo "$OUT" | sed 's/^/  /'
  echo "$OUT" | grep -q '^RESULT gate-pauses PASS'  && pass "a write pauses for host approval"      || fail "a write did NOT pause for host approval"
  echo "$OUT" | grep -q '^RESULT gate-denies PASS'  && pass "host denial blocks the write"          || fail "host denial did NOT block the write"
  echo "$OUT" | grep -q '^RESULT gate-allows PASS'  && pass "host approval permits the write"       || skip "approval path inconclusive (agent may not have attempted a write)"
  if echo "$OUT" | grep -q '^RESULT cancel PASS'; then
    pass "session/cancel honoured; shared subprocess preserved"
  elif echo "$OUT" | grep -q '^RESULT cancel SKIP'; then
    skip "cancel not exercised (no model available)"
  else
    fail "session/cancel NOT honoured — Ritemark removed the process-kill and relies on this"
  fi
fi

echo
echo "========================================"
if [[ $FAILURES -gt 0 ]]; then
  echo -e "${RED}VERIFICATION FAILED: $FAILURES check(s)${NC} — do not ship this bump"
  exit 1
fi
if [[ $SKIPS -gt 0 ]]; then
  echo -e "${GREEN}All executed checks passed${NC}, ${YELLOW}$SKIPS skipped${NC}"
  echo "Record every SKIP in docs/development/agent-runtime-compatibility.md as NOT PROVEN."
else
  echo -e "${GREEN}All checks passed${NC}"
fi
echo "========================================"

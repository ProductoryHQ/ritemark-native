#!/bin/bash
# Sprint 103 R9 — plan-truth regression matrix (semi-automated CDP harness).
#
# Sets up an isolated dev profile + fixture workspace with debug tracing on,
# launches the dev instance, and (after the driver performs the ★ scenarios
# from docs/development/releases/v1.8.6/sprint-103-agent-truth/scenarios.md)
# asserts the plan-truth contract from the runtime traces + workspace state.
#
# Drive the UI either by hand or with the CDP snippets in
# research/plan-truth-audit.md §3 (cdp-eval.js against the AI-sidebar webview).
#
# Usage:
#   scripts/qa/plan-truth-matrix.sh setup     # fixtures + profile + launch
#   scripts/qa/plan-truth-matrix.sh assert    # run trace/workspace assertions
#   scripts/qa/plan-truth-matrix.sh teardown  # kill instance
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
USERDATA="/tmp/ritemark-qa-plan-truth-userdata"
WORKSPACE="/tmp/ritemark-qa-plan-truth-workspace"
CLAUDE_TRACE="${TMPDIR:-/tmp}/ritemark-claude-trace.log"
CODEX_TRACE="${TMPDIR:-/tmp}/ritemark-codex-trace.log"

cmd="${1:-assert}"

case "$cmd" in
  setup)
    mkdir -p "$USERDATA/User" "$WORKSPACE"
    cat > "$USERDATA/User/settings.json" <<'JSON'
{ "ritemark.ai.debugTrace": true, "security.workspace.trust.enabled": false }
JSON
    printf '# Travel Notes\n\n## Destinations\n- Tallinn\n- Helsinki\n- Riga\n\n## TODO\n- Split itineraries into separate files\n' > "$WORKSPACE/README.md"
    printf '# Itinerary Draft\n\nDay 1: Arrive, old town walk.\nDay 2: Museums.\nDay 3: Day trip.\n' > "$WORKSPACE/itinerary.md"
    rm -f "$CLAUDE_TRACE" "$CODEX_TRACE"
    md5 -q "$WORKSPACE"/*.md > /tmp/ritemark-qa-plan-truth.md5
    cd "$ROOT/vscode"
    VSCODE_SKIP_PRELAUNCH=1 PATH="$HOME/.nvm/versions/node/v22.21.1/bin:$PATH" \
      ./scripts/code.sh --remote-debugging-port=9224 --user-data-dir="$USERDATA" "$WORKSPACE" &
    echo "Launched. Drive the ★ scenarios (Claude Plan / Keep planning / approve; Codex Plan; OpenCode gating), then run: $0 assert"
    ;;
  assert)
    fail=0
    check() { if eval "$2"; then echo "PASS  $1"; else echo "FAIL  $1"; fail=1; fi }
    # R2: plan card on the FIRST ExitPlanMode — no recovery dance, no harness complaint
    check "R2 ExitPlanMode reached canUseTool"          "grep -q 'ExitPlanMode requested' '$CLAUDE_TRACE'"
    check "R2 plan card emitted"                        "grep -q 'ExitPlanMode emitted approval request' '$CLAUDE_TRACE'"
    check "R2 no plan-mode harness error"               "! grep -qi 'not currently in plan mode' '$CLAUDE_TRACE'"
    check "R2 no bypassPermissions in session"          "! grep -q 'bypassPermissions' '$CLAUDE_TRACE'"
    # R5: Codex plan turn on a read-only sandbox
    check "R5 codex plan thread read-only"              "grep -q '\"sandbox\":\"read-only\"' '$CODEX_TRACE'"
    check "R5 codex continuation write sandbox"         "grep -q '\"sandbox\":\"workspace-write\"' '$CODEX_TRACE'"
    # Workspace integrity before approval is asserted by the driver comparing
    # /tmp/ritemark-qa-plan-truth.md5 at the plan-review checkpoint.
    exit $fail
    ;;
  teardown)
    pids=$(lsof -t -i :9224 || true); [ -n "$pids" ] && kill $pids || true
    echo "stopped"
    ;;
  *) echo "unknown command: $cmd"; exit 2 ;;
esac

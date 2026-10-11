#!/usr/bin/env bash
#
# test-notarize-dmg.sh - Exit-status tests for notarize-dmg.sh
#
# Runs notarize-dmg.sh against stub xcrun / codesign / hdiutil / spctl on PATH:
# no Apple submission, no credentials, no real DMG. Every Apple answer that is
# not a full success must exit non-zero; the full success must exit 0.
#
# Usage: ./scripts/test-notarize-dmg.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
TEST_ROOT="$(mktemp -d -t ritemark-notarize-dmg.XXXXXX)"
trap 'rm -rf "$TEST_ROOT"' EXIT

# A copy of the script in a throwaway project root, so a real .signing-config
# beside the repo's scripts/ is never sourced.
PROJECT="$TEST_ROOT/project"
STUBS="$TEST_ROOT/bin"
CALLS="$TEST_ROOT/calls.log"
OUT="$TEST_ROOT/out.log"
mkdir -p "$PROJECT/scripts" "$PROJECT/dist" "$STUBS" "$TEST_ROOT/tmp"
cp "$SCRIPT_DIR/notarize-dmg.sh" "$PROJECT/scripts/"
printf 'stub dmg\n' > "$PROJECT/dist/Ritemark-test.dmg"

SUBMISSION="2efe2717-52ef-43a5-96dc-0797e4ca1041"

cat > "$STUBS/xcrun" <<EOF
#!/usr/bin/env bash
echo "xcrun \$1 \$2" >> "$CALLS"
submitted() {
  echo "Conducting pre-submission checks for Ritemark-test.dmg and initiating connection to the Apple notary service..."
  echo "Submission ID received"
  echo "  id: $SUBMISSION"
  printf 'Upload progress: 100.00%% (9 B of 9 B)\r\n'
  echo "Successfully uploaded file"
  echo "  id: $SUBMISSION"
  echo "  path: $PROJECT/dist/Ritemark-test.dmg"
  echo "Waiting for processing to complete."
}
finished() {
  echo "Current status: In Progress...Current status: \$1....Processing complete"
  echo "  id: $SUBMISSION"
  echo "  status: \$1"
}
case "\$1 \$2" in
  "notarytool submit")
    case "\$STUB_SUBMIT" in
      accepted) submitted; finished Accepted ;;
      invalid)  submitted; finished Invalid ;;
      rejected) submitted; finished Rejected ;;
      refused-403)
        echo "Conducting pre-submission checks for Ritemark-test.dmg and initiating connection to the Apple notary service..."
        echo "Error: HTTP status code: 403. A required agreement is missing or has expired. This request requires an in-effect agreement that has not been signed or has expired. Ensure your team has signed the necessary legal agreements and that they are not expired." ;;
      refused-401)
        echo "Conducting pre-submission checks for Ritemark-test.dmg and initiating connection to the Apple notary service..."
        echo "Error: HTTP status code: 401. Invalid credentials. Username or password is incorrect." ;;
      timeout)
        submitted
        echo "Current status: In Progress.............................."
        echo "  id: $SUBMISSION"
        echo "  status: In Progress" ;;
      dropped)
        submitted
        echo "Current status: In Progress......"
        echo "Error: The network connection was lost." ;;
    esac
    exit "\${STUB_SUBMIT_EXIT:-0}" ;;
  "notarytool log")
    echo '{"status": "Invalid", "issues": [{"severity": "error", "message": "stub issue"}]}' ;;
  "stapler staple")
    if [ "\${STUB_STAPLE:-ok}" = ok ]; then
      echo "Processing: \$3"; echo "The staple and validate action worked!"
    else
      echo "Processing: \$3"; echo "CloudKit query for Ritemark-test.dmg failed due to \"Record not found\"."
      echo "The staple and validate action failed! Error 65."; exit 65
    fi ;;
  "stapler validate")
    if [ "\${STUB_VALIDATE:-ok}" = ok ]; then
      echo "Processing: \$3"; echo "The validate action worked!"
    else
      echo "Processing: \$3"; echo "Ritemark-test.dmg does not have a ticket stapled to it."; exit 65
    fi ;;
  *) echo "unexpected xcrun call: \$*" >&2; exit 99 ;;
esac
EOF

cat > "$STUBS/codesign" <<EOF
#!/usr/bin/env bash
echo "codesign \$*" >> "$CALLS"
EOF

cat > "$STUBS/hdiutil" <<EOF
#!/usr/bin/env bash
echo "hdiutil \$1" >> "$CALLS"
mp=""; prev=""
for a in "\$@"; do [ "\$prev" = "-mountpoint" ] && mp="\$a"; prev="\$a"; done
case "\$1" in
  attach)
    [ "\${STUB_ATTACH:-ok}" = ok ] || { echo "hdiutil: attach failed - no mountable file systems" >&2; exit 1; }
    [ "\${STUB_APP:-present}" = present ] && mkdir -p "\$mp/Ritemark.app"
    exit 0 ;;
  detach)
    rm -rf "\$2/Ritemark.app"; exit 0 ;;
esac
EOF

cat > "$STUBS/spctl" <<EOF
#!/usr/bin/env bash
echo "spctl" >> "$CALLS"
app="\${@: -1}"
if [ "\${STUB_SPCTL:-accepted}" = accepted ]; then
  echo "\$app: accepted"; echo "source=Notarized Developer ID"
else
  echo "\$app: rejected"; echo "source=Unnotarized Developer ID"; exit 3
fi
EOF

chmod +x "$STUBS"/*

FAILURES=0

# run_case <name> <expected exit> <expected text> [VAR=value ...]
run_case() {
  local name="$1" expected="$2" text="$3"
  shift 3
  : > "$CALLS"
  local status=0
  env "$@" \
    PATH="$STUBS:$PATH" TMPDIR="$TEST_ROOT/tmp" \
    APPLE_TEAM_ID=TESTTEAM01 APPLE_ID=stub@example.invalid APPLE_APP_PASSWORD=stub-pass \
    "$PROJECT/scripts/notarize-dmg.sh" dist/Ritemark-test.dmg > "$OUT" 2>&1 || status=$?

  local problems=()
  [[ "$status" -eq "$expected" ]] || problems+=("exit $status, expected $expected")
  grep -qF -- "$text" "$OUT" || problems+=("output lacks: $text")
  # Nothing may be left behind: the notarytool log and the mount point are temp state
  [[ -z "$(ls -A "$TEST_ROOT/tmp")" ]] || problems+=("temp files left: $(ls -A "$TEST_ROOT/tmp" | tr '\n' ' ')")

  if [[ ${#problems[@]} -eq 0 ]]; then
    echo "ok   $name (exit $status)"
    return 0
  fi
  echo "FAIL $name"
  printf '       %s\n' "${problems[@]}"
  sed 's/^/       | /' "$OUT"
  FAILURES=$((FAILURES + 1))
  return 1
}

called()     { grep -qx "$1" "$CALLS"; }
not_called() { ! grep -qx "$1" "$CALLS"; }
check() {    # check <case name> <description> <command...>
  local name="$1" what="$2"
  shift 2
  if ! "$@"; then
    echo "FAIL $name: $what"
    FAILURES=$((FAILURES + 1))
  fi
}

# --- Refusals: Apple creates no submission ----------------------------------
if run_case "403 agreement refusal" 1 "Apple refused the submission (HTTP 403)" \
    STUB_SUBMIT=refused-403 STUB_SUBMIT_EXIT=69; then
  check "403 agreement refusal" "must not staple" not_called "xcrun stapler staple"
fi
# The verdict must not depend on notarytool's exit status alone
run_case "403 refusal, notarytool exit 0" 1 "Apple refused the submission (HTTP 403)" \
  STUB_SUBMIT=refused-403 STUB_SUBMIT_EXIT=0 || true
run_case "401 credentials refusal" 1 "Apple did not accept the submission (notarytool exit 69, no submission id)" \
  STUB_SUBMIT=refused-401 STUB_SUBMIT_EXIT=69 || true

# --- Apple's verdict is not Accepted -----------------------------------------
if run_case "status Invalid" 1 "Notarization failed - Invalid" STUB_SUBMIT=invalid STUB_SUBMIT_EXIT=0; then
  check "status Invalid" "must fetch the notarytool log" called "xcrun notarytool log"
  check "status Invalid" "must not staple" not_called "xcrun stapler staple"
fi
run_case "status Rejected" 1 "Notarization failed - Rejected" STUB_SUBMIT=rejected STUB_SUBMIT_EXIT=0 || true
if run_case "wait timed out" 1 "Notarization did not finish (last status: In Progress, notarytool exit 1)" \
    STUB_SUBMIT=timeout STUB_SUBMIT_EXIT=1; then
  check "wait timed out" "must name the submission id" grep -qF "submission $SUBMISSION" "$OUT"
  check "wait timed out" "must not staple" not_called "xcrun stapler staple"
fi
run_case "connection dropped while waiting" 1 "Notarization did not finish (last status: none, notarytool exit 1)" \
  STUB_SUBMIT=dropped STUB_SUBMIT_EXIT=1 || true
run_case "Accepted but notarytool exit 1" 1 "Unexpected notarization result (status: Accepted, notarytool exit 1)" \
  STUB_SUBMIT=accepted STUB_SUBMIT_EXIT=1 || true

# --- Accepted, but a later step fails ----------------------------------------
run_case "staple fails" 1 "Stapling failed" STUB_SUBMIT=accepted STUB_STAPLE=fail || true
run_case "stapler validate fails" 1 "Stapler validation failed (exit 65)" STUB_SUBMIT=accepted STUB_VALIDATE=fail || true
run_case "DMG does not mount" 1 "Could not mount the DMG" STUB_SUBMIT=accepted STUB_ATTACH=fail || true
if run_case "app missing from DMG" 1 "Ritemark.app not found in the DMG" STUB_SUBMIT=accepted STUB_APP=missing; then
  check "app missing from DMG" "must detach the DMG" called "hdiutil detach"
fi
if run_case "Gatekeeper rejects" 1 "Gatekeeper rejected Ritemark.app (spctl exit 3)" \
    STUB_SUBMIT=accepted STUB_SPCTL=rejected; then
  check "Gatekeeper rejects" "must detach the DMG" called "hdiutil detach"
fi

# --- Full success ------------------------------------------------------------
if run_case "success" 0 "DMG Notarization Complete!" STUB_SUBMIT=accepted; then
  for line in "Notarization successful!" "Ticket stapled to DMG" "Stapler validation: PASSED" "Gatekeeper: ACCEPTED"; do
    check "success" "output lacks: $line" grep -qF "$line" "$OUT"
  done
  check "success" "must detach the DMG" called "hdiutil detach"
fi

echo ""
if [[ $FAILURES -gt 0 ]]; then
  echo "notarize-dmg.sh tests FAILED: $FAILURES problem(s)"
  exit 1
fi
echo "notarize-dmg.sh tests passed"

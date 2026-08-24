#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURE_ROOT="$(mktemp -d)"
trap 'rm -rf "$FIXTURE_ROOT"' EXIT

OUTPUT="$({
  RITEMARK_WINDOWS_TRUST_MODE=signed-canary \
  RITEMARK_WINDOWS_SIGNTOOL_PATH='C:\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe' \
  RITEMARK_WINDOWS_SIGNATURE_REPORT="$FIXTURE_ROOT/report.json" \
  RITEMARK_WINDOWS_RAW_EVIDENCE_DIR="$FIXTURE_ROOT/raw" \
  RITEMARK_WINDOWS_SIGNATURE_BASELINE="$FIXTURE_ROOT/baseline.json" \
  RITEMARK_WINDOWS_PWSH_PATH=/bin/echo \
    "$SCRIPT_DIR/validate-windows-build-trust.sh" "$FIXTURE_ROOT"
} 2>&1)"

for expected in \
  '-Mode Verify' \
  "-Root $FIXTURE_ROOT" \
  "-ReportPath $FIXTURE_ROOT/report.json" \
  '-SignToolPath C:\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe' \
  "-RawEvidenceDirectory $FIXTURE_ROOT/raw" \
  "-BaselineReportPath $FIXTURE_ROOT/baseline.json" \
  '-ExpectedPublisher Productory Services OÜ' \
  '-OwnedPathPattern Ritemark.exe' \
  '-RequireTimestamp'; do
  if [[ "$OUTPUT" != *"$expected"* ]]; then
    echo "FAIL: trust invocation omitted: $expected" >&2
    echo "$OUTPUT" >&2
    exit 1
  fi
done

if RITEMARK_WINDOWS_TRUST_MODE=release \
  RITEMARK_WINDOWS_SIGNTOOL_PATH=tool \
  RITEMARK_WINDOWS_SIGNATURE_REPORT=report \
  RITEMARK_WINDOWS_PWSH_PATH=/bin/echo \
  "$SCRIPT_DIR/validate-windows-build-trust.sh" "$FIXTURE_ROOT" >/dev/null 2>&1; then
  echo 'FAIL: signed validation passed without raw evidence directory' >&2
  exit 1
fi

echo 'Windows late build-trust invocation test passed'

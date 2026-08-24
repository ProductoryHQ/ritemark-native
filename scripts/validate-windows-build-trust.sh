#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_ROOT="${1:?Usage: validate-windows-build-trust.sh <Windows build root>}"
TRUST_MODE="${RITEMARK_WINDOWS_TRUST_MODE:-}"

case "$TRUST_MODE" in
  release|signed-canary)
    SIGNTOOL_PATH="${RITEMARK_WINDOWS_SIGNTOOL_PATH:-}"
    REPORT_PATH="${RITEMARK_WINDOWS_SIGNATURE_REPORT:-}"
    RAW_EVIDENCE_DIR="${RITEMARK_WINDOWS_RAW_EVIDENCE_DIR:-}"
    BASELINE_PATH="${RITEMARK_WINDOWS_SIGNATURE_BASELINE:-}"
    PWSH_BIN="${RITEMARK_WINDOWS_PWSH_PATH:-pwsh}"

    for required_name in SIGNTOOL_PATH REPORT_PATH RAW_EVIDENCE_DIR; do
      if [[ -z "${!required_name}" ]]; then
        echo "ERROR: $required_name is required for $TRUST_MODE Windows trust verification" >&2
        exit 1
      fi
    done
    if [[ ! -d "$BUILD_ROOT" ]]; then
      echo "ERROR: Windows build root not found: $BUILD_ROOT" >&2
      exit 1
    fi
    if ! command -v "$PWSH_BIN" >/dev/null 2>&1; then
      echo "ERROR: PowerShell command not found: $PWSH_BIN" >&2
      exit 1
    fi

    VERIFY_ARGS=(
      -NoLogo -NoProfile -File "$SCRIPT_DIR/verify-windows-signatures.ps1"
      -Mode Verify
      -Root "$BUILD_ROOT"
      -ReportPath "$REPORT_PATH"
      -SignToolPath "$SIGNTOOL_PATH"
      -RawEvidenceDirectory "$RAW_EVIDENCE_DIR"
      -ExpectedPublisher "Productory Services OÜ"
      -OwnedPathPattern "Ritemark.exe"
      -RequireTimestamp
    )
    if [[ -n "$BASELINE_PATH" ]]; then
      VERIFY_ARGS+=( -BaselineReportPath "$BASELINE_PATH" )
    fi
    "$PWSH_BIN" "${VERIFY_ARGS[@]}"
    ;;
  unsigned-canary)
    echo "Signing check: INTENTIONALLY UNSIGNED NON-RELEASE CANARY"
    ;;
  *)
    echo "ERROR: RITEMARK_WINDOWS_TRUST_MODE must be release, signed-canary, or unsigned-canary" >&2
    exit 1
    ;;
esac

#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOW="$PROJECT_ROOT/.github/workflows/build-windows.yml"
ISS="$PROJECT_ROOT/installer/windows/ritemark.iss"
VALIDATOR="$PROJECT_ROOT/scripts/validate-build-output.sh"
USER_GUIDE="$PROJECT_ROOT/docs/user/windows-smart-app-control.md"
BUILD_CONTRACT="$PROJECT_ROOT/scripts/windows-build-contract.ps1"

require_text() {
  local file="$1"
  local text="$2"
  if ! grep -Fq -- "$text" "$file"; then
    echo "FAIL: expected '$text' in ${file#$PROJECT_ROOT/}" >&2
    exit 1
  fi
}

reject_text() {
  local file="$1"
  local text="$2"
  if grep -Fq -- "$text" "$file"; then
    echo "FAIL: forbidden legacy contract '$text' remains in ${file#$PROJECT_ROOT/}" >&2
    exit 1
  fi
}

require_text "$WORKFLOW" "- signed-canary"
require_text "$WORKFLOW" "- unsigned-canary"
require_text "$WORKFLOW" "- release"
require_text "$BUILD_CONTRACT" "Release mode requires the exact tag"
require_text "$WORKFLOW" "azure/artifact-signing-action@c7ab2a863ab5f9a846ddb8265964877ef296ee82 # v2"
require_text "$WORKFLOW" "files-catalog: r/windows-pe-signing-catalog.txt"
require_text "$WORKFLOW" "/DCanonicalRelease"
require_text "$WORKFLOW" "/DSign"
require_text "$WORKFLOW" "/Sazuresign="
require_text "$WORKFLOW" "Verify signed installer, installed tree, and uninstaller"
require_text "$WORKFLOW" "environment: windows-signing"
require_text "$WORKFLOW" "windows-signing-evidence/toolchain.json"
require_text "$WORKFLOW" "payload-signtool-raw"
require_text "$WORKFLOW" "RITEMARK_WINDOWS_SIGNTOOL_PATH:"
require_text "$WORKFLOW" "RITEMARK_WINDOWS_SIGNATURE_REPORT: windows-signing-evidence/payload-post-build-verification.json"
require_text "$WORKFLOW" "RITEMARK_WINDOWS_RAW_EVIDENCE_DIR: windows-signing-evidence/payload-post-build-signtool-raw"
require_text "$WORKFLOW" "RITEMARK_WINDOWS_SIGNATURE_BASELINE: windows-signing-evidence/payload-baseline.json"
reject_text "$WORKFLOW" "AZURE_SIGNING_ENABLED"
reject_text "$WORKFLOW" "azure/trusted-signing-action@"
reject_text "$WORKFLOW" '[version]$_.VersionInfo.FileVersion'
require_text "$WORKFLOW" "WINDOWS_PUBLISHER: 'Productory Services OÜ'"
require_text "$WORKFLOW" "https://downloads.ritemark.app/windows/v"

verify_step_line="$(grep -nF 'name: Verify signed installer, installed tree, and uninstaller' "$WORKFLOW" | cut -d: -f1)"
zip_upload_line="$(grep -nF 'name: Upload ZIP artifact' "$WORKFLOW" | cut -d: -f1)"
installer_upload_line="$(grep -nF 'name: Upload installer artifact' "$WORKFLOW" | cut -d: -f1)"
if (( zip_upload_line <= verify_step_line || installer_upload_line <= verify_step_line )); then
  echo "FAIL: canonical-capable uploads must follow the full installer trust gate" >&2
  exit 1
fi

require_text "$ISS" "#ifdef CanonicalRelease"
require_text "$ISS" "SIGNED-CANARY-NON-RELEASE"
require_text "$ISS" "UNSIGNED-NON-RELEASE"
require_text "$ISS" "SignTool=azuresign"
require_text "$ISS" "SignedUninstaller=yes"

require_text "$VALIDATOR" "RITEMARK_WINDOWS_TRUST_MODE"
require_text "$VALIDATOR" 'validate-windows-build-trust.sh" "$APP_PATH"'
reject_text "$VALIDATOR" "RITEMARK_SKIP_SIGNING_CHECK"

require_text "$USER_GUIDE" "Productory Services OÜ"
require_text "$USER_GUIDE" "Microsoft Store"
reject_text "$USER_GUIDE" "turn Smart App Control off"
reject_text "$USER_GUIDE" "disable Smart App Control"
reject_text "$USER_GUIDE" "disable Defender"

echo "Windows release contract test passed"

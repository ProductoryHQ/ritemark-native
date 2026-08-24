#!/bin/bash
# Sign every unsigned Portable Executable in a Windows build with Azure
# Artifact Signing, while preserving valid trusted vendor signatures.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TARGET_DIR="${1:-VSCode-win32-x64}"
BUILD_DIR="$PROJECT_ROOT/$TARGET_DIR"
EXPECTED_PUBLISHER="${RITEMARK_WINDOWS_PUBLISHER:-Productory Services OÜ}"

echo
echo -e "${BLUE}Ritemark Windows PE signing${NC}"

if [ ! -d "$BUILD_DIR" ]; then
    echo -e "${RED}ERROR: Build directory not found: $BUILD_DIR${NC}"
    exit 1
fi

if ! command -v pwsh >/dev/null 2>&1; then
    echo -e "${RED}ERROR: Required command not found: pwsh${NC}"
    exit 1
fi

if [ -n "${SIGNTOOL_PATH:-}" ] && [ -f "$SIGNTOOL_PATH" ]; then
    SIGNTOOL="$SIGNTOOL_PATH"
else
    SIGNTOOL=$(find "/c/Program Files (x86)/Windows Kits/10/bin" -path "*/x64/signtool.exe" 2>/dev/null | sort -V | tail -1)
fi
if [ -z "${SIGNTOOL:-}" ]; then
    echo -e "${RED}ERROR: signtool.exe not found. Install a current Windows SDK or set SIGNTOOL_PATH.${NC}"
    exit 1
fi

MISSING=""
for variable_name in AZURE_SIGNING_ENDPOINT AZURE_SIGNING_ACCOUNT AZURE_SIGNING_PROFILE \
                     AZURE_SIGNING_CLIENT_ID AZURE_SIGNING_TENANT_ID AZURE_SIGNING_CLIENT_SECRET; do
    if [ -z "${!variable_name:-}" ]; then
        MISSING="$MISSING $variable_name"
    fi
done
if [ -n "$MISSING" ]; then
    echo -e "${RED}ERROR: Missing required environment variables:$MISSING${NC}"
    exit 1
fi

if [ -n "${AZURE_SIGNING_DLIB_PATH:-}" ] && [ -f "$AZURE_SIGNING_DLIB_PATH" ]; then
    DLIB="$AZURE_SIGNING_DLIB_PATH"
else
    DLIB=$(find "/c/Users" "/c/Program Files" -path "*/x64/Azure.CodeSigning.Dlib.dll" 2>/dev/null | head -1)
fi
if [ -z "${DLIB:-}" ]; then
    echo -e "${RED}ERROR: Azure.CodeSigning.Dlib.dll not found.${NC}"
    echo "Install Microsoft.ArtifactSigning.Client or set AZURE_SIGNING_DLIB_PATH."
    exit 1
fi

TASK_TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TASK_TEMP_DIR"' EXIT
CATALOG_PATH="$TASK_TEMP_DIR/pe-signing-catalog.txt"
BASELINE_PATH="$TASK_TEMP_DIR/pe-signing-baseline.json"
VERIFY_PATH="$TASK_TEMP_DIR/pe-signing-verification.json"
METADATA_PATH="$TASK_TEMP_DIR/artifact-signing-metadata.json"

pwsh -NoLogo -NoProfile -File "$SCRIPT_DIR/verify-windows-signatures.ps1" \
    -Mode PrepareSigning \
    -Root "$BUILD_DIR" \
    -CatalogPath "$CATALOG_PATH" \
    -ReportPath "$BASELINE_PATH" \
    -ExpectedPublisher "$EXPECTED_PUBLISHER" \
    -OwnedPathPattern "Ritemark.exe"

cat > "$METADATA_PATH" <<METAEOF
{
  "Endpoint": "$AZURE_SIGNING_ENDPOINT",
  "CodeSigningAccountName": "$AZURE_SIGNING_ACCOUNT",
  "CertificateProfileName": "$AZURE_SIGNING_PROFILE",
  "ExcludeCredentials": [
    "ManagedIdentityCredential",
    "WorkloadIdentityCredential",
    "SharedTokenCacheCredential",
    "VisualStudioCredential",
    "VisualStudioCodeCredential",
    "AzureCliCredential",
    "AzurePowerShellCredential",
    "AzureDeveloperCliCredential",
    "InteractiveBrowserCredential"
  ]
}
METAEOF

export AZURE_CLIENT_ID="$AZURE_SIGNING_CLIENT_ID"
export AZURE_TENANT_ID="$AZURE_SIGNING_TENANT_ID"
export AZURE_CLIENT_SECRET="$AZURE_SIGNING_CLIENT_SECRET"

TARGET_COUNT=0
CATALOG_DIRECTORY=$(dirname "$CATALOG_PATH")
while IFS= read -r catalog_entry; do
    [ -z "$catalog_entry" ] && continue
    target_path="$CATALOG_DIRECTORY/${catalog_entry#./}"
    target_path=$(pwsh -NoProfile -Command "[IO.Path]::GetFullPath('$target_path')")
    "$SIGNTOOL" sign /v /fd SHA256 \
        /tr "http://timestamp.acs.microsoft.com" /td SHA256 \
        /dlib "$DLIB" /dmdf "$METADATA_PATH" \
        "$target_path"
    TARGET_COUNT=$((TARGET_COUNT + 1))
done < "$CATALOG_PATH"

pwsh -NoLogo -NoProfile -File "$SCRIPT_DIR/verify-windows-signatures.ps1" \
    -Mode Verify \
    -Root "$BUILD_DIR" \
    -BaselineReportPath "$BASELINE_PATH" \
    -ReportPath "$VERIFY_PATH" \
    -SignToolPath "$SIGNTOOL" \
    -RawEvidenceDirectory "$TASK_TEMP_DIR/signtool-raw" \
    -ExpectedPublisher "$EXPECTED_PUBLISHER" \
    -OwnedPathPattern "Ritemark.exe" \
    -RequireTimestamp

echo -e "${GREEN}Signed and verified $TARGET_COUNT PE file(s); valid vendor signatures were preserved.${NC}"

#!/bin/bash
#
# codesign-windows.sh - Code sign Ritemark Windows binaries via Azure Trusted Signing
#
# Signs Ritemark.exe + bundled agent binaries with Authenticode (SHA-256)
# using Azure Artifact Signing (Trusted Signing) via signtool + dlib.
#
# Usage:
#   ./scripts/codesign-windows.sh                  # Sign default build dir
#   ./scripts/codesign-windows.sh VSCode-win32-x64 # Sign specific dir
#
# Required environment variables (from GitHub Secrets or local config):
#   AZURE_SIGNING_ENDPOINT       - e.g. https://neu.codesigning.azure.net
#   AZURE_SIGNING_ACCOUNT        - e.g. ritemark-signing
#   AZURE_SIGNING_PROFILE        - e.g. ritemark-public-trust
#   AZURE_SIGNING_CLIENT_ID      - Service principal app ID
#   AZURE_SIGNING_TENANT_ID      - Azure AD tenant ID
#   AZURE_SIGNING_CLIENT_SECRET  - Service principal secret
#
# Optional:
#   SIGNTOOL_PATH                - Path to signtool.exe (auto-detected if not set)
#

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

TARGET_DIR="${1:-VSCode-win32-x64}"
BUILD_DIR="$PROJECT_ROOT/$TARGET_DIR"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Ritemark Windows Code Signing${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# =============================================================================
# Step 1: Check prerequisites
# =============================================================================
echo "[1/4] Checking prerequisites..."

if [ ! -d "$BUILD_DIR" ]; then
    echo -e "${RED}ERROR: Build directory not found: $BUILD_DIR${NC}"
    exit 1
fi
echo "  ✓ Build directory found: $BUILD_DIR"

# Find signtool.exe
if [ -n "$SIGNTOOL_PATH" ] && [ -f "$SIGNTOOL_PATH" ]; then
    SIGNTOOL="$SIGNTOOL_PATH"
else
    SIGNTOOL=$(find "/c/Program Files (x86)/Windows Kits/10/bin" -path "*/x64/signtool.exe" 2>/dev/null | sort -V | tail -1)
    if [ -z "$SIGNTOOL" ]; then
        echo -e "${RED}ERROR: signtool.exe not found. Install Windows SDK or set SIGNTOOL_PATH.${NC}"
        exit 1
    fi
fi
echo "  ✓ signtool: $SIGNTOOL"

# Check required env vars
MISSING=""
for var in AZURE_SIGNING_ENDPOINT AZURE_SIGNING_ACCOUNT AZURE_SIGNING_PROFILE \
           AZURE_SIGNING_CLIENT_ID AZURE_SIGNING_TENANT_ID AZURE_SIGNING_CLIENT_SECRET; do
    if [ -z "${!var}" ]; then
        MISSING="$MISSING $var"
    fi
done
if [ -n "$MISSING" ]; then
    echo -e "${RED}ERROR: Missing required environment variables:${MISSING}${NC}"
    exit 1
fi
echo "  ✓ Azure credentials configured"

# =============================================================================
# Step 2: Collect signing targets
# =============================================================================
echo ""
echo "[2/4] Collecting signing targets..."

TARGETS=()
AGENTS_DIR="$BUILD_DIR/resources/app/extensions/ritemark/binaries/agents/win32-x64"

# Main executable
if [ -f "$BUILD_DIR/Ritemark.exe" ]; then
    TARGETS+=("$BUILD_DIR/Ritemark.exe")
    echo "  → Ritemark.exe"
fi

# Bundled agent binaries
if [ -d "$AGENTS_DIR" ]; then
    for exe in "$AGENTS_DIR"/*.exe; do
        if [ -f "$exe" ]; then
            TARGETS+=("$exe")
            echo "  → agents/$(basename "$exe")"
        fi
    done
fi

if [ ${#TARGETS[@]} -eq 0 ]; then
    echo -e "${RED}ERROR: No signing targets found${NC}"
    exit 1
fi
echo "  Total: ${#TARGETS[@]} files"

# =============================================================================
# Step 3: Sign all targets (batched)
# =============================================================================
echo ""
echo "[3/4] Signing ${#TARGETS[@]} files with Azure Trusted Signing..."

# Create metadata JSON for Azure Trusted Signing dlib
METADATA_JSON=$(mktemp --suffix=.json)
cat > "$METADATA_JSON" <<METAEOF
{
  "Endpoint": "$AZURE_SIGNING_ENDPOINT",
  "CodeSigningAccountName": "$AZURE_SIGNING_ACCOUNT",
  "CertificateProfileName": "$AZURE_SIGNING_PROFILE"
}
METAEOF

# Azure Trusted Signing dlib path (installed via dotnet tool or NuGet)
# In CI, this is typically installed by the azure/trusted-signing-action
# For local use, install via: dotnet tool install -g Microsoft.Trusted.Signing.Client
DLIB=$(find "/c/Users" -path "*/x64/Azure.CodeSigning.Dlib.dll" 2>/dev/null | head -1)
if [ -z "$DLIB" ]; then
    DLIB=$(find "/c/Program Files" -path "*/Azure.CodeSigning.Dlib.dll" 2>/dev/null | head -1)
fi

if [ -n "$DLIB" ]; then
    # Use dlib-based signing (preferred — handles Azure auth internally)
    echo "  Using dlib: $DLIB"
    "$SIGNTOOL" sign /v /fd SHA256 \
        /tr "http://timestamp.acs.microsoft.com" /td SHA256 \
        /dlib "$DLIB" /dmdf "$METADATA_JSON" \
        "${TARGETS[@]}"
    SIGN_EXIT=$?
else
    echo -e "${YELLOW}WARNING: Azure.CodeSigning.Dlib.dll not found.${NC}"
    echo "  Install: dotnet tool install -g Microsoft.Trusted.Signing.Client"
    echo "  Or use the azure/trusted-signing-action in CI."
    rm -f "$METADATA_JSON"
    exit 1
fi

rm -f "$METADATA_JSON"

if [ $SIGN_EXIT -ne 0 ]; then
    echo -e "${RED}ERROR: Signing failed (exit code $SIGN_EXIT)${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Signing completed${NC}"

# =============================================================================
# Step 4: Verify signatures
# =============================================================================
echo ""
echo "[4/4] Verifying signatures..."

VERIFIED=0
FAILED=0

for target in "${TARGETS[@]}"; do
    if "$SIGNTOOL" verify /pa "$target" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} $(basename "$target")"
        VERIFIED=$((VERIFIED + 1))
    else
        echo -e "  ${RED}✗${NC} $(basename "$target") — VERIFICATION FAILED"
        FAILED=$((FAILED + 1))
    fi
done

echo ""
echo "========================================="
echo "  Signed:   $VERIFIED"
echo "  Failed:   $FAILED"
echo "========================================="

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}ERROR: $FAILED file(s) failed verification${NC}"
    exit 1
fi

echo -e "${GREEN}All $VERIFIED files signed and verified successfully${NC}"

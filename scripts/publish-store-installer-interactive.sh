#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 4 ]]; then
  echo "Usage: $0 VERSION INSTALLER_PATH EXPECTED_SIZE EXPECTED_SHA256" >&2
  exit 2
fi

ritemark_version=$1
ritemark_installer_path=$2
ritemark_expected_size=$3
ritemark_expected_sha256=$4
ritemark_expected_key="windows/v${ritemark_version}/Ritemark-Setup.exe"

npm run store-hosting -- plan \
  --version "$ritemark_version" \
  --file "$ritemark_installer_path" \
  --size "$ritemark_expected_size" \
  --sha256 "$ritemark_expected_sha256"

echo
echo "External change ready for confirmation:"
echo "  bucket: ritemark-downloads-prod"
echo "  key: $ritemark_expected_key"
echo "  URL: https://getritemark.com/$ritemark_expected_key"
echo "  size: $ritemark_expected_size"
echo "  SHA-256: $ritemark_expected_sha256"
echo "  overwrite: forbidden (If-None-Match: * plus indefinite windows/ lock)"
echo

IFS= read -r -s -p "R2 Account ID: " R2_ACCOUNT_ID
echo
IFS= read -r -s -p "R2 Access Key ID: " R2_ACCESS_KEY_ID
echo
IFS= read -r -s -p "R2 Secret Access Key: " R2_SECRET_ACCESS_KEY
echo
IFS= read -r -p "Type the exact key to approve this upload: " ritemark_confirmed_key

if [[ "$ritemark_confirmed_key" != "$ritemark_expected_key" ]]; then
  echo "ERROR: confirmation did not match; nothing was uploaded." >&2
  exit 1
fi

export R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY
trap 'unset R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY' EXIT

npm run store-hosting -- publish \
  --version "$ritemark_version" \
  --file "$ritemark_installer_path" \
  --size "$ritemark_expected_size" \
  --sha256 "$ritemark_expected_sha256" \
  --confirm-key "$ritemark_confirmed_key"

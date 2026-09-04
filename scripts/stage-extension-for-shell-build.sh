#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <extension-source> <staging-destination>" >&2
  exit 64
fi

SOURCE_DIR="${1%/}"
STAGING_DIR="${2%/}"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "ERROR: Extension source directory not found: $SOURCE_DIR" >&2
  exit 1
fi

if [ -e "$STAGING_DIR" ]; then
  echo "ERROR: Extension staging destination already exists: $STAGING_DIR" >&2
  exit 1
fi

for required_path in package.json out/extension.js media/webview.js; do
  if [ ! -s "$SOURCE_DIR/$required_path" ]; then
    echo "ERROR: Refusing to stage incomplete extension; missing or empty: $SOURCE_DIR/$required_path" >&2
    exit 1
  fi
done

mkdir -p "$(dirname "$STAGING_DIR")"
mv "$SOURCE_DIR" "$STAGING_DIR"

for required_path in package.json out/extension.js media/webview.js; do
  if [ ! -s "$STAGING_DIR/$required_path" ]; then
    echo "ERROR: Extension staging validation failed: $STAGING_DIR/$required_path" >&2
    mv "$STAGING_DIR" "$SOURCE_DIR" 2>/dev/null || true
    exit 1
  fi
done

if [ -e "$SOURCE_DIR" ]; then
  echo "ERROR: Extension remained inside the VS Code extension tree: $SOURCE_DIR" >&2
  exit 1
fi

echo "Staged compiled extension outside the VS Code shell build tree: $STAGING_DIR"

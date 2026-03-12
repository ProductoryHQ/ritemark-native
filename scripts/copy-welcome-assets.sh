#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
WELCOME_SRC_DIR="$ROOT_DIR/branding/welcome"
WELCOME_DEST_DIR="${1:-}"

if [ -z "$WELCOME_DEST_DIR" ]; then
    echo "Usage: $0 <destination-dir>" >&2
    exit 1
fi

if [ ! -d "$WELCOME_SRC_DIR" ]; then
    echo "ERROR: Welcome branding source not found at $WELCOME_SRC_DIR" >&2
    exit 1
fi

required_assets=(
    "ritemark-welcome-hero-bg.png"
    "ritemark-welcome-logo-full.svg"
    "ritemark-welcome-icon-book.svg"
    "ritemark-welcome-icon-life-buoy.svg"
    "ritemark-welcome-icon-newspaper.svg"
    "ritemark-welcome-warning.svg"
)

for asset in "${required_assets[@]}"; do
    if [ ! -f "$WELCOME_SRC_DIR/$asset" ]; then
        echo "ERROR: Missing Welcome asset $asset in $WELCOME_SRC_DIR" >&2
        exit 1
    fi
done

mkdir -p "$WELCOME_DEST_DIR"
cp -R "$WELCOME_SRC_DIR"/. "$WELCOME_DEST_DIR"/

for asset in "${required_assets[@]}"; do
    if [ ! -f "$WELCOME_DEST_DIR/$asset" ]; then
        echo "ERROR: Failed to copy Welcome asset $asset to $WELCOME_DEST_DIR" >&2
        exit 1
    fi
done

echo "Welcome assets copied to $WELCOME_DEST_DIR"

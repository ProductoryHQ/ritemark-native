#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
VSCODE_DIR="${1:-$ROOT_DIR/vscode}"
BRANDING_DIR="$ROOT_DIR/branding"
WELCOME_SRC_DIR="$BRANDING_DIR/welcome"
UI_FONT_SRC_DIR="$ROOT_DIR/extensions/ritemark/webview/src/assets/fonts"

if [ ! -d "$VSCODE_DIR" ]; then
  echo "ERROR: VS Code directory not found at $VSCODE_DIR" >&2
  exit 1
fi

if [ ! -d "$BRANDING_DIR" ]; then
  echo "Branding directory not found at $BRANDING_DIR (skipping sync)"
  exit 0
fi

copy_if_exists() {
  local src="$1"
  local dst="$2"
  if [ -f "$src" ]; then
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
    return 0
  fi
  return 1
}

copy_welcome_assets_to_dir() {
  local dst_dir="$1"
  if [ ! -d "$WELCOME_SRC_DIR" ]; then
    return 0
  fi
  mkdir -p "$dst_dir"
  cp "$WELCOME_SRC_DIR"/ritemark-welcome-* "$dst_dir"/
}

copy_fonts_to_dir() {
  local dst_dir="$1"
  if [ -f "$UI_FONT_SRC_DIR/SofiaSans-latin.woff2" ] && [ -f "$UI_FONT_SRC_DIR/SofiaSans-latin-ext.woff2" ]; then
    mkdir -p "$dst_dir"
    cp "$UI_FONT_SRC_DIR/SofiaSans-latin.woff2" "$dst_dir"/
    cp "$UI_FONT_SRC_DIR/SofiaSans-latin-ext.woff2" "$dst_dir"/
  fi
}

copy_phosphor_to_dir() {
  local dst_dir="$1"
  local phosphor_font_src="$VSCODE_DIR/extensions/ritemark/node_modules/@phosphor-icons/web/src/light/Phosphor-Light.woff2"
  if [ ! -f "$phosphor_font_src" ]; then
    phosphor_font_src="$ROOT_DIR/extensions/ritemark/node_modules/@phosphor-icons/web/src/light/Phosphor-Light.woff2"
  fi
  if [ -f "$phosphor_font_src" ]; then
    mkdir -p "$dst_dir"
    cp "$phosphor_font_src" "$dst_dir/phosphor.woff2"
  fi
}

fix_workbench_style_file() {
  local style_file="$1"
  if [ ! -f "$style_file" ]; then
    return 0
  fi

  node -e '
    const fs = require("fs");
    const file = process.argv[1];
    let css = fs.readFileSync(file, "utf8");
    const original = css;
    css = css.replace(/--ritemark-ui-font-family:\s*"Sofia Sans",\s*;/g, "--ritemark-ui-font-family: \"Sofia Sans\";");
    css = css.replace(/var\(--ritemark-ui-font-family\)\s+(?!,)/g, "var(--ritemark-ui-font-family), ");
    if (css !== original) {
      fs.writeFileSync(file, css, "utf8");
    }
  ' "$style_file"
}

fix_product_icon_theme_file() {
  local theme_file="$1"
  if [ ! -f "$theme_file" ]; then
    return 0
  fi

  node -e '
    const fs = require("fs");
    const file = process.argv[1];
    let json = fs.readFileSync(file, "utf8");
    const original = json;
    json = json.replace(/"weight":\s*"200"/g, "\"weight\": \"normal\"");
    if (json !== original) {
      fs.writeFileSync(file, json, "utf8");
    }
  ' "$theme_file"
}

echo "Syncing branding assets into $VSCODE_DIR"

# Product identity (merge branding overlay onto current upstream product.json)
if [ -f "$BRANDING_DIR/product.json" ] && [ -f "$VSCODE_DIR/product.json" ]; then
  node -e '
    const fs = require("fs");
    const cp = require("child_process");
    const vscodePath = process.argv[1];
    const brandingPath = process.argv[2];
    const vscodeDir = process.argv[3];
    const vscodeProduct = JSON.parse(fs.readFileSync(vscodePath, "utf8"));
    const brandingProduct = JSON.parse(fs.readFileSync(brandingPath, "utf8"));
    const merged = { ...vscodeProduct, ...brandingProduct };
    let upstreamProduct = {};
    try {
      upstreamProduct = JSON.parse(cp.execSync(`git -C "${vscodeDir}" show 1.117.0:product.json`, { encoding: "utf8" }));
    } catch {
      upstreamProduct = {};
    }
    for (const key of ["defaultChatAgent", "trustedExtensionAuthAccess", "onboardingKeymaps", "onboardingThemes"]) {
      if (merged[key] === undefined && upstreamProduct[key] !== undefined) {
        merged[key] = upstreamProduct[key];
      }
    }
    fs.writeFileSync(vscodePath, JSON.stringify(merged, null, "\t") + "\n");
  ' "$VSCODE_DIR/product.json" "$BRANDING_DIR/product.json" "$VSCODE_DIR"
fi

# App icons used by build/runtime resources
copy_if_exists "$BRANDING_DIR/icons/icon.icns" "$VSCODE_DIR/resources/darwin/code.icns" || true
copy_if_exists "$BRANDING_DIR/icons/icon.ico" "$VSCODE_DIR/resources/win32/code.ico" || true
copy_if_exists "$BRANDING_DIR/icons/icon.svg" "$VSCODE_DIR/src/vs/workbench/browser/media/code-icon.svg" || true

# Welcome assets: source + runtime output folders
copy_welcome_assets_to_dir "$VSCODE_DIR/src/vs/workbench/contrib/welcomeGettingStarted/browser/media"
if [ -d "$VSCODE_DIR/out/vs/workbench/contrib/welcomeGettingStarted/browser/media" ]; then
  copy_welcome_assets_to_dir "$VSCODE_DIR/out/vs/workbench/contrib/welcomeGettingStarted/browser/media"
fi
if [ -d "$VSCODE_DIR/out-build/vs/workbench/contrib/welcomeGettingStarted/browser/media" ]; then
  copy_welcome_assets_to_dir "$VSCODE_DIR/out-build/vs/workbench/contrib/welcomeGettingStarted/browser/media"
fi

# Workbench UI fonts
copy_fonts_to_dir "$VSCODE_DIR/src/vs/workbench/browser/media/fonts"
fix_workbench_style_file "$VSCODE_DIR/src/vs/workbench/browser/media/style.css"
if [ -d "$VSCODE_DIR/out/vs/workbench/browser/media" ]; then
  copy_fonts_to_dir "$VSCODE_DIR/out/vs/workbench/browser/media/fonts"
  fix_workbench_style_file "$VSCODE_DIR/out/vs/workbench/browser/media/style.css"
fi
if [ -d "$VSCODE_DIR/out-build/vs/workbench/browser/media" ]; then
  copy_fonts_to_dir "$VSCODE_DIR/out-build/vs/workbench/browser/media/fonts"
  fix_workbench_style_file "$VSCODE_DIR/out-build/vs/workbench/browser/media/style.css"
fi

# Phosphor icon font for codicon/product icon theme use
copy_phosphor_to_dir "$VSCODE_DIR/src/vs/base/browser/ui/codicons/codicon"
if [ -d "$VSCODE_DIR/out/vs/base/browser/ui/codicons/codicon" ]; then
  copy_phosphor_to_dir "$VSCODE_DIR/out/vs/base/browser/ui/codicons/codicon"
fi
if [ -d "$VSCODE_DIR/out-build/vs/base/browser/ui/codicons/codicon" ]; then
  copy_phosphor_to_dir "$VSCODE_DIR/out-build/vs/base/browser/ui/codicons/codicon"
fi

# Product icon theme should use a valid CSS weight descriptor.
fix_product_icon_theme_file "$ROOT_DIR/extensions/ritemark/producticons/ritemark-product-icon-theme.json"
fix_product_icon_theme_file "$VSCODE_DIR/extensions/ritemark/producticons/ritemark-product-icon-theme.json"

# Dev macOS app bundle identity/icon (best effort for run-dev branding)
if [[ "$OSTYPE" == "darwin"* ]]; then
  APP_BUNDLE="$VSCODE_DIR/.build/electron/Code - OSS.app"
  APP_RESOURCES="$APP_BUNDLE/Contents/Resources"
  APP_MACOS="$APP_BUNDLE/Contents/MacOS"
  APP_PLIST="$APP_BUNDLE/Contents/Info.plist"

  if [ -d "$APP_BUNDLE" ]; then
    if [ -f "$BRANDING_DIR/icons/icon.icns" ]; then
      cp "$BRANDING_DIR/icons/icon.icns" "$APP_RESOURCES/Code - OSS.icns" || true
    fi

    # Provide branded launch aliases while preserving upstream binary.
    ln -snf "Code - OSS.app" "$VSCODE_DIR/.build/electron/Ritemark.app" || true
    if [ -f "$APP_MACOS/Code - OSS" ]; then
      ln -snf "Code - OSS" "$APP_MACOS/Ritemark" || true
    fi

    if [ -f "$APP_PLIST" ] && command -v /usr/libexec/PlistBuddy >/dev/null 2>&1; then
      /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName Ritemark" "$APP_PLIST" >/dev/null 2>&1 || true
      /usr/libexec/PlistBuddy -c "Set :CFBundleName Ritemark" "$APP_PLIST" >/dev/null 2>&1 || true
    fi
  fi
fi

echo "Branding sync complete"

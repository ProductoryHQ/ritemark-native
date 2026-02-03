# Multi-Platform Build Analysis

**Date:** 2026-02-03
**Request:** Intel Mac support + build process overview
**Author:** Claude Code
**Status:** ✅ IMPLEMENTED - Scripts and process integrated

---

## Executive Summary

Ritemark Native saab kompileerida kolme platvormi jaoks:
- **macOS Apple Silicon** (darwin-arm64) - praegune primary target
- **macOS Intel** (darwin-x64) - vajab minimaalseid muudatusi
- **Windows** (win32-x64) - juba olemas, töötab

Intel Mac tugi on **tehniliselt lihtne** - VS Code toetab seda juba. Vaja on ainult buildimisskripte kohandada.

---

## 1. Praegune Build Arhitektuur

### 1.1 Ülevaade

```
┌─────────────────────────────────────────────────────────────────┐
│                     RITEMARK NATIVE BUILD                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   VS Code    │    │   Ritemark   │    │   Branding   │       │
│  │    OSS       │ +  │  Extension   │ +  │   Assets     │       │
│  │  (1.94.0)    │    │   (1.2.0)    │    │              │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│          │                  │                   │                │
│          ▼                  ▼                   ▼                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    gulp vscode-{platform}-{arch}         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│          ┌───────────────────┼───────────────────┐              │
│          ▼                   ▼                   ▼              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ darwin-arm64 │    │ darwin-x64   │    │  win32-x64   │       │
│  │ (Apple Si)   │    │ (Intel Mac)  │    │  (Windows)   │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│          │                   │                   │               │
│          ▼                   ▼                   ▼               │
│      .app/DMG            .app/DMG           .exe/Installer       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Failide Struktuur

```
ritemark-native/
├── vscode/                          # VS Code OSS submodule
│   ├── build/gulpfile.vscode.js     # Build targets definitsioon
│   └── product.json                 # Runtime konfiguratsioon
├── extensions/ritemark/             # Ritemark extension SOURCE
│   ├── src/                         # TypeScript source
│   ├── out/                         # Compiled JS
│   ├── webview/                     # React app (TipTap)
│   └── media/webview.js             # Bundled webview (~3MB)
├── branding/                        # Ritemark branding
│   ├── product.json                 # Version, identifiers
│   └── icons/                       # App icons
├── scripts/                         # Build scripts
│   ├── build-prod.sh               # Primary macOS build
│   ├── build-windows.sh            # Windows cross-compile
│   ├── create-dmg.sh               # macOS installer
│   └── create-windows-installer.sh # Windows installer
└── VSCode-{platform}-{arch}/        # Build output
```

### 1.3 Build Pipeline (Praegune - darwin-arm64)

```bash
# 1. Valideerib keskkonda
./scripts/validate-build-env.sh

# 2. Kompileerib extensioni
cd extensions/ritemark && npm run compile

# 3. Buildib webview
cd extensions/ritemark/webview && npm run build

# 4. Buildib VS Code + extension
cd vscode && npm run gulp vscode-darwin-arm64-min

# 5. Kopeerib extensioni app bundle'isse
cp -R extensions/ritemark VSCode-darwin-arm64/Ritemark.app/.../extensions/

# 6. Valideerib outputi
./scripts/validate-build-output.sh

# 7. Loob DMG
./scripts/create-dmg.sh
```

---

## 2. Kolme Platvormi Toetus

### 2.1 Toetatud Platformid VS Code'is

VS Code `gulpfile.vscode.js` defineerib juba kõik vajalikud targetid:

```javascript
const BUILD_TARGETS = [
  { platform: 'win32', arch: 'x64' },
  { platform: 'win32', arch: 'arm64' },
  { platform: 'darwin', arch: 'x64', opts: { stats: true } },    // ← Intel Mac
  { platform: 'darwin', arch: 'arm64', opts: { stats: true } },  // ← Apple Silicon
  { platform: 'linux', arch: 'x64' },
  { platform: 'linux', arch: 'armhf' },
  { platform: 'linux', arch: 'arm64' }
];
```

**Gulp käsud platvormi kaupa:**

| Platform | Gulp Task | Output Directory |
|----------|-----------|------------------|
| macOS Apple Silicon | `vscode-darwin-arm64-min` | `VSCode-darwin-arm64/` |
| macOS Intel | `vscode-darwin-x64-min` | `VSCode-darwin-x64/` |
| Windows x64 | `vscode-win32-x64-min` | `VSCode-win32-x64/` |

### 2.2 Mis on Juba Olemas

| Platform | Build | Installer | CI/CD | Testitav |
|----------|-------|-----------|-------|----------|
| darwin-arm64 | ✅ | ✅ DMG | ❌ | ✅ |
| darwin-x64 | ⚠️ vajab skripti | ❌ | ❌ | ❌ |
| win32-x64 | ✅ | ✅ Inno Setup | ✅ GitHub Actions | ✅ |

### 2.3 Mis Vajab Muutmist Intel Mac Jaoks

**Minimaalne muudatus:** ainult build skriptid.

1. **Uus skript** `scripts/build-mac-intel.sh` (või parameeter olemasolevale)
2. **DMG loomine** Intel versioonile
3. **Valideerimise** uuendamine darwin-x64 jaoks

---

## 3. Implementatsiooni Plaan

### 3.1 Variant A: Eraldi Skriptid (Lihtne)

Loo uus `scripts/build-mac-intel.sh`:

```bash
#!/bin/bash
# Build Ritemark Native for Intel Mac (darwin-x64)

set -e

PLATFORM="darwin"
ARCH="x64"
OUTPUT_DIR="VSCode-${PLATFORM}-${ARCH}"
APP_NAME="Ritemark.app"

echo "=== Building Ritemark Native for Intel Mac ==="

# 1. Validate environment (Node version, symlinks)
./scripts/validate-build-env.sh

# 2. Compile extension
cd extensions/ritemark
npm run compile
cd ../..

# 3. Build webview
cd extensions/ritemark/webview
npm run build
cd ../../..

# 4. Build VS Code for Intel Mac
cd vscode
npm run gulp vscode-${PLATFORM}-${ARCH}-min
cd ..

# 5. Copy extension to app bundle
EXTENSIONS_DIR="${OUTPUT_DIR}/${APP_NAME}/Contents/Resources/app/extensions"
mkdir -p "${EXTENSIONS_DIR}"
cp -R extensions/ritemark "${EXTENSIONS_DIR}/"

# 6. Validate output
./scripts/validate-build-output.sh "${PLATFORM}-${ARCH}"

echo "=== Build complete: ${OUTPUT_DIR}/${APP_NAME} ==="
```

### 3.2 Variant B: Ühtne Skript Parameetriga (Soovitatav)

Muuda `scripts/build-prod.sh` toetama parameetrit:

```bash
#!/bin/bash
# Usage: ./scripts/build-prod.sh [platform-arch]
# Examples:
#   ./scripts/build-prod.sh                 # darwin-arm64 (default)
#   ./scripts/build-prod.sh darwin-x64      # Intel Mac
#   ./scripts/build-prod.sh win32-x64       # Windows

TARGET="${1:-darwin-arm64}"
PLATFORM="${TARGET%-*}"
ARCH="${TARGET#*-}"

echo "Building for: ${PLATFORM}-${ARCH}"

# ... rest of build logic with $PLATFORM and $ARCH variables
```

### 3.3 DMG Loomine Intel Mac Jaoks

`scripts/create-dmg.sh` vajab väikest muudatust:

```bash
# Praegu hardcoded:
ARCH="arm64"

# Peaks olema:
ARCH="${1:-arm64}"  # Accept parameter, default to arm64

# DMG nimi:
# Ritemark-1.2.0-darwin-arm64.dmg  (Apple Silicon)
# Ritemark-1.2.0-darwin-x64.dmg    (Intel)
```

---

## 4. Protsessi Ülevaade: Kuidas Build Töötab

### 4.1 VS Code Gulp Build Sisemine Loogika

```
gulp vscode-darwin-x64-min
         │
         ▼
┌─────────────────────────────────────┐
│ 1. COMPILE                          │
│    - TypeScript → JavaScript        │
│    - Source maps                    │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 2. EXTEND MEDIA                     │
│    - Bundle dependencies            │
│    - Process resources              │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 3. MINIFY                           │
│    - JavaScript minification        │
│    - CSS minification               │
│    - Remove source maps (prod)      │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 4. PACKAGE                          │
│    - Create app bundle structure    │
│    - Copy Electron runtime          │
│    - Platform-specific packaging    │
└─────────────────────────────────────┘
         │
         ▼
    VSCode-darwin-x64/Ritemark.app
```

### 4.2 Extension Bundling Flow

```
extensions/ritemark/
├── src/*.ts ─────────────────┐
│                             │  npm run compile
│                             ▼
├── out/*.js ◄────────────────┘
│
├── webview/src/*.tsx ────────┐
│                             │  npm run build (Vite)
│                             ▼
├── media/webview.js ◄────────┘  (~3MB bundled React app)
│
└── package.json, fileicons/, etc.

        │
        │  Post-build copy
        ▼

VSCode-darwin-x64/
└── Ritemark.app/
    └── Contents/Resources/app/
        └── extensions/ritemark/
            ├── out/
            ├── media/webview.js
            └── package.json
```

### 4.3 Platformi-Spetsiifilised Erinevused

| Aspekt | macOS (arm64/x64) | Windows (x64) |
|--------|-------------------|---------------|
| App format | `.app` bundle | Directory + exe |
| Extension path | `Contents/Resources/app/extensions/` | `resources/app/extensions/` |
| Installer | DMG | Inno Setup .exe |
| Code signing | Apple notarization | Optional Authenticode |
| Build host | macOS required | macOS (cross) or Windows |
| Electron | darwin-arm64 / darwin-x64 | win32-x64 |

---

## 5. Cross-Compilation Piirangud

### 5.1 Mis Töötab

| Build Target | Build Host | Töötab? |
|--------------|------------|---------|
| darwin-arm64 | macOS arm64 | ✅ Native |
| darwin-arm64 | macOS x64 | ✅ Works |
| darwin-x64 | macOS arm64 | ✅ Works |
| darwin-x64 | macOS x64 | ✅ Native |
| win32-x64 | macOS | ✅ Cross-compile |
| win32-x64 | Windows | ✅ Native |

### 5.2 Mida EI SAA Teha

- **macOS buildi Windows'ist** - Electron macOS bundle nõuab macOS hosti
- **Notarization Windows'ist** - Apple notarization nõuab macOS + Xcode

---

## 6. Soovitused

### 6.1 Kohene Tegevus (Intel Mac toetus) - ✅ TEHTUD

1. ~~**Loo** `scripts/build-mac-intel.sh`~~ → **TEHTUD:** `scripts/build-prod.sh darwin-x64`
2. ~~**Uuenda** `scripts/create-dmg.sh` toetama parameetrit~~ → **TEHTUD:** `scripts/create-dmg.sh x64`
3. **Testi** build Intel Mac'il (või Rosetta'ga) → _ootel_
4. ~~**Lisa** Intel DMG release protsessi~~ → **TEHTUD:** `release-manager.md` uuendatud

### 6.1.1 Uuendatud failid

| Fail | Muudatus |
|------|----------|
| `scripts/build-prod.sh` | Toetab `darwin-x64` parameetrit |
| `scripts/create-dmg.sh` | Toetab `x64` parameetrit |
| `.claude/agents/release-manager.md` | Multi-platform workflow lisatud |
| `.claude/skills/vscode-development/SKILL.md` | Multi-platform build juhised lisatud |

### 6.2 Pikaajaline Parendus

1. **Refaktoreeri** build skriptid kasutama ühist parameetrisüsteemi
2. **Lisa** CI/CD Intel Mac buildile (GitHub Actions macOS-latest on Intel)
3. **Loo** Universal Binary (fat binary mis sisaldab mõlemat arhitektuuri)

### 6.3 Universal Binary Variant (Tulevikus)

macOS toetab Universal Binary formaati mis sisaldab mõlemat arhitektuuri:

```bash
# Loo eraldi buildid
gulp vscode-darwin-arm64-min
gulp vscode-darwin-x64-min

# Kombineeri lipo-ga (Apple tool)
lipo -create \
  VSCode-darwin-arm64/Ritemark.app/.../Electron \
  VSCode-darwin-x64/Ritemark.app/.../Electron \
  -output Ritemark-Universal.app/.../Electron
```

**Eelised:**
- Üks DMG mõlemale arhitektuurile
- Kasutaja ei pea valima

**Puudused:**
- Suurem failisuurus (~2x)
- Keerukam build protsess

---

## 7. Kiire Alustamise Juhend

### Intel Mac Build (Uuendatud skriptidega)

```bash
# 1. Veendu et oled ritemark-native kaustas
cd /Users/jarmotuisk/Projects/ritemark-native

# 2. Build Intel Mac versioon (sisaldab extensioni koopimist ja valideerimist)
./scripts/build-prod.sh darwin-x64

# 3. Loo DMG
./scripts/create-dmg.sh x64
```

### Apple Silicon Build (vaikimisi)

```bash
# 1. Build
./scripts/build-prod.sh

# 2. Loo DMG
./scripts/create-dmg.sh
```

### Mõlema platvormi build (release workflow)

```bash
# Build mõlemad
./scripts/build-prod.sh              # Apple Silicon
./scripts/build-prod.sh darwin-x64   # Intel

# Loo mõlemad DMGd
./scripts/create-dmg.sh              # Apple Silicon DMG
./scripts/create-dmg.sh x64          # Intel DMG
```

---

## 8. Kokkuvõte

| Küsimus | Vastus |
|---------|--------|
| Kas Intel Mac build on võimalik? | ✅ Jah, VS Code toetab |
| Kui palju tööd? | ✅ **TEHTUD** - skriptid uuendatud |
| Kas vajab uut koodi? | Ei, ainult build skriptid |
| Kas saab cross-compile? | Jah, Apple Silicon Mac'ilt |
| Mis on output? | `Ritemark-X.Y.Z-darwin-x64.dmg` |

### Implementeeritud muudatused

1. ✅ `scripts/build-prod.sh` - toetab `darwin-x64` parameetrit
2. ✅ `scripts/create-dmg.sh` - toetab `x64` parameetrit
3. ✅ `.claude/agents/release-manager.md` - multi-platform release workflow
4. ✅ `.claude/skills/vscode-development/SKILL.md` - multi-platform build juhised

**Järgmised sammud:**
- Testida Intel Mac build reaalsel Intel Mac'il (või Rosetta emulatsioonil)
- Notariseerimise workflow valideerida mõlema arhitektuuri jaoks

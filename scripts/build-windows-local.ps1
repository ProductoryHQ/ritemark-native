<#
.SYNOPSIS
    Build Ritemark Native for Windows x64 on a local Windows machine.

.DESCRIPTION
    This script builds a production version of Ritemark for Windows.
    Run from the ritemark-native repository root.

    Prerequisites:
      - Node.js 22.x
      - Python 3.11+
      - Visual Studio Build Tools (C++ Desktop workload)
      - Git

    After build completes, feed VSCode-win32-x64/ to Inno Setup.

.EXAMPLE
    .\scripts\build-windows-local.ps1
    .\scripts\build-windows-local.ps1 -SkipVSCodeClone   # reuse existing vscode/ folder
    .\scripts\build-windows-local.ps1 -SkipDeps           # skip npm install (already done)
#>

param(
    [switch]$SkipVSCodeClone,
    [switch]$SkipDeps,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$RootDir   = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$VSCodeDir = Join-Path $RootDir "vscode"
$ExtDir    = Join-Path $RootDir "extensions\ritemark"
$BuildOut  = Join-Path $RootDir "VSCode-win32-x64"
$BrandDir  = Join-Path $RootDir "branding"
$WelcomeDest = Join-Path $BuildOut "resources\app\out\vs\workbench\contrib\welcomeGettingStarted\browser\media"

$VSCodeVersion = "1.109.5"
$ElectronTarget = "30.5.1"

function Write-Step($n, $msg) {
    Write-Host ""
    Write-Host "[$n] $msg" -ForegroundColor Cyan
    Write-Host ("=" * 50) -ForegroundColor DarkGray
}

# ------------------------------------------------------------------
# Step 1: Prerequisites
# ------------------------------------------------------------------
Write-Step 1 "Checking prerequisites"

$nodeVersion = & node -v 2>$null
if (-not $nodeVersion) {
    Write-Host "ERROR: Node.js not found. Install Node 22.x" -ForegroundColor Red
    exit 1
}
Write-Host "  Node.js: $nodeVersion"

$pythonVersion = & python --version 2>$null
if (-not $pythonVersion) {
    $pythonVersion = & python3 --version 2>$null
}
if (-not $pythonVersion) {
    Write-Host "ERROR: Python not found. Install Python 3.11+" -ForegroundColor Red
    exit 1
}
Write-Host "  Python: $pythonVersion"

$gitVersion = & git --version 2>$null
if (-not $gitVersion) {
    Write-Host "ERROR: Git not found" -ForegroundColor Red
    exit 1
}
Write-Host "  Git: $gitVersion"

# ------------------------------------------------------------------
# Step 2: Clone VS Code (or reuse)
# ------------------------------------------------------------------
Write-Step 2 "VS Code OSS source ($VSCodeVersion)"

if ($SkipVSCodeClone -and (Test-Path $VSCodeDir)) {
    Write-Host "  Reusing existing vscode/ folder" -ForegroundColor Yellow
} else {
    if (Test-Path $VSCodeDir) {
        Write-Host "  Removing old vscode/ folder..."
        Remove-Item -Recurse -Force $VSCodeDir
    }
    Write-Host "  Cloning VS Code $VSCodeVersion (shallow)..."
    & git clone --depth 1 --branch $VSCodeVersion "https://github.com/microsoft/vscode.git" $VSCodeDir
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to clone VS Code" -ForegroundColor Red
        exit 1
    }
}

# ------------------------------------------------------------------
# Step 3: Copy extension (replace symlink — Windows can't do Unix symlinks)
# ------------------------------------------------------------------
Write-Step 3 "Copying Ritemark extension"

$extDest = Join-Path $VSCodeDir "extensions\ritemark"
if (Test-Path $extDest) {
    Remove-Item -Recurse -Force $extDest
}

# Remove macOS-only binaries before copying
$darwinBin = Join-Path $ExtDir "binaries\darwin-arm64"
$hadDarwinBin = Test-Path $darwinBin
if ($hadDarwinBin) {
    Rename-Item $darwinBin "$darwinBin.bak"
}

Copy-Item -Recurse $ExtDir $extDest
Write-Host "  Extension copied to vscode\extensions\ritemark"

if ($hadDarwinBin) {
    Rename-Item "$darwinBin.bak" $darwinBin
}

# ------------------------------------------------------------------
# Step 4: Apply patches
# ------------------------------------------------------------------
Write-Step 4 "Applying patches"

Push-Location $RootDir
& bash ./scripts/apply-patches.sh
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Some patches failed" -ForegroundColor Yellow
}
Pop-Location

# ------------------------------------------------------------------
# Step 5: Copy branding
# ------------------------------------------------------------------
Write-Step 5 "Copying branding assets"

if (Test-Path "$BrandDir\product.json") {
    Copy-Item "$BrandDir\product.json" "$VSCodeDir\product.json"
    Write-Host "  product.json copied"
}

if (Test-Path "$BrandDir\icons\icon.ico") {
    Copy-Item "$BrandDir\icons\icon.ico" "$VSCodeDir\resources\win32\code.ico"
    Write-Host "  icon.ico copied"
}

if (Test-Path "$BrandDir\win32\tile_70x70.png") {
    Copy-Item "$BrandDir\win32\tile_70x70.png" "$VSCodeDir\resources\win32\code_70x70.png"
    Copy-Item "$BrandDir\win32\tile_150x150.png" "$VSCodeDir\resources\win32\code_150x150.png"
    Write-Host "  Tile icons copied"
}

if (Test-Path "$BrandDir\win32\VisualElementsManifest.xml") {
    Copy-Item "$BrandDir\win32\VisualElementsManifest.xml" "$VSCodeDir\resources\win32\VisualElementsManifest.xml"
    Write-Host "  VisualElementsManifest.xml copied"
}

if (Test-Path "$BrandDir\icons\icon.svg") {
    Copy-Item "$BrandDir\icons\icon.svg" "$VSCodeDir\src\vs\workbench\browser\media\code-icon.svg"
    Write-Host "  Titlebar icon copied"
}

# Copy welcome assets into source tree
$welcomeSrc = Join-Path $BrandDir "welcome"
if (Test-Path $welcomeSrc) {
    $welcomeBuildSrc = Join-Path $VSCodeDir "src\vs\workbench\contrib\welcomeGettingStarted\browser\media"
    New-Item -ItemType Directory -Force -Path $welcomeBuildSrc | Out-Null
    Copy-Item "$welcomeSrc\*" $welcomeBuildSrc -Force
    Write-Host "  Welcome assets copied to source tree"
}

# Copy fonts
$fontSrc = Join-Path $ExtDir "webview\src\assets\fonts"
$fontDest = Join-Path $VSCodeDir "src\vs\workbench\browser\media\fonts"
if (Test-Path "$fontSrc\SofiaSans-latin.woff2") {
    New-Item -ItemType Directory -Force -Path $fontDest | Out-Null
    Copy-Item "$fontSrc\SofiaSans-latin.woff2" $fontDest
    Copy-Item "$fontSrc\SofiaSans-latin-ext.woff2" $fontDest
    Write-Host "  Sofia Sans fonts copied"
}

$lucideSrc = Join-Path $extDest "node_modules\lucide-static\font\lucide.woff2"
if (-not (Test-Path $lucideSrc)) {
    $lucideSrc = Join-Path $ExtDir "node_modules\lucide-static\font\lucide.woff2"
}
if (Test-Path $lucideSrc) {
    $lucodeDest = Join-Path $VSCodeDir "src\vs\base\browser\ui\codicons\codicon"
    New-Item -ItemType Directory -Force -Path $lucodeDest | Out-Null
    Copy-Item $lucideSrc "$lucodeDest\lucide.woff2"
    Write-Host "  Lucide icon font copied"
}

# ------------------------------------------------------------------
# Step 6: Install dependencies
# ------------------------------------------------------------------
Write-Step 6 "Installing dependencies"

if ($SkipDeps) {
    Write-Host "  Skipping (--SkipDeps)" -ForegroundColor Yellow
} else {
    Push-Location $VSCodeDir

    # Set electron build environment
    $env:npm_config_disturl = "https://electronjs.org/headers"
    $env:npm_config_target = $ElectronTarget
    $env:npm_config_runtime = "electron"
    $env:npm_config_build_from_source = "true"
    $env:ELECTRON_SKIP_BINARY_DOWNLOAD = "1"
    $env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1"

    Write-Host "  Installing VS Code dependencies (this takes a while)..."
    Write-Host "    Electron target: $ElectronTarget"
    & npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: npm install failed" -ForegroundColor Red
        Pop-Location
        exit 1
    }

    Pop-Location

    # Extension dependencies
    Push-Location $extDest
    Write-Host "  Installing extension dependencies..."
    & npm install --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Extension npm install failed" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location

    # Remove non-Windows ripgrep binaries from claude-agent-sdk
    $sdkVendor = Join-Path $extDest "node_modules\@anthropic-ai\claude-agent-sdk\vendor\ripgrep"
    if (Test-Path $sdkVendor) {
        Write-Host "  Removing non-Windows ripgrep binaries..."
        foreach ($dir in @("arm64-darwin", "arm64-linux", "x64-darwin", "x64-linux")) {
            $p = Join-Path $sdkVendor $dir
            if (Test-Path $p) { Remove-Item -Recurse -Force $p }
        }
    }
}

# ------------------------------------------------------------------
# Step 7: Compile extension
# ------------------------------------------------------------------
Write-Step 7 "Compiling Ritemark extension"

Push-Location $extDest
& npm run compile
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Extension compile failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "  Extension compiled" -ForegroundColor Green
Pop-Location

# ------------------------------------------------------------------
# Step 8: Build VS Code
# ------------------------------------------------------------------
Write-Step 8 "Building VS Code for win32-x64 (this takes 20-30 min)"

if ($SkipBuild) {
    Write-Host "  Skipping (--SkipBuild)" -ForegroundColor Yellow
} else {
    Push-Location $VSCodeDir
    & npx gulp vscode-win32-x64-min
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: VS Code build failed" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
}

# ------------------------------------------------------------------
# Step 9: Copy extension to build output
# ------------------------------------------------------------------
Write-Step 9 "Copying extension to build output"

if (-not (Test-Path $BuildOut)) {
    Write-Host "ERROR: Build output not found at $BuildOut" -ForegroundColor Red
    exit 1
}

$extBuildDest = Join-Path $BuildOut "resources\app\extensions\ritemark"
if (Test-Path $extBuildDest) {
    Remove-Item -Recurse -Force $extBuildDest
}
Copy-Item -Recurse $extDest $extBuildDest

# Clean dev-only files from build
$devClean = @("webview\node_modules", "webview\src")
foreach ($d in $devClean) {
    $p = Join-Path $extBuildDest $d
    if (Test-Path $p) { Remove-Item -Recurse -Force $p }
}

# Copy welcome assets to build output
New-Item -ItemType Directory -Force -Path $WelcomeDest | Out-Null
if (Test-Path $welcomeSrc) {
    Copy-Item "$welcomeSrc\*" $WelcomeDest -Force
    Write-Host "  Welcome assets copied to build output"
}

Write-Host "  Extension copied to build output" -ForegroundColor Green

# ------------------------------------------------------------------
# Step 10: Inline welcome page logo SVG (Windows vscode-file:// fix)
# ------------------------------------------------------------------
Write-Step 10 "Fixing welcome page logo for Windows"

$logoSvg = Join-Path $BuildOut "resources\app\out\vs\workbench\contrib\welcomeGettingStarted\common\media\ritemark-logo.svg"
$workbenchJs = Join-Path $BuildOut "resources\app\out\vs\workbench\workbench.desktop.main.js"

if ((Test-Path $logoSvg) -and (Test-Path $workbenchJs)) {
    $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($logoSvg))
    $dataUri = "data:image/svg+xml;base64,$b64"

    $js = [IO.File]::ReadAllText($workbenchJs)
    $search = 'Us.asBrowserUri("vs/workbench/contrib/welcomeGettingStarted/common/media/ritemark-logo.svg")'
    if ($js.Contains($search)) {
        $js = $js.Replace($search, "`"$dataUri`"")
        [IO.File]::WriteAllText($workbenchJs, $js)
        Write-Host "  Logo SVG inlined as data URI" -ForegroundColor Green
    } else {
        Write-Host "  FileAccess.asBrowserUri call not found (may already be fixed)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  Logo SVG or workbench.js not found, skipping" -ForegroundColor Yellow
}

# ------------------------------------------------------------------
# Step 11: Validate
# ------------------------------------------------------------------
Write-Step 11 "Validating build"

$errors = 0

# Check executable
$exeName = if (Test-Path "$BuildOut\RiteMark.exe") { "RiteMark.exe" }
           elseif (Test-Path "$BuildOut\Code - OSS.exe") { "Code - OSS.exe" }
           else { $null }

if ($exeName) {
    Write-Host "  OK: $exeName found" -ForegroundColor Green
} else {
    Write-Host "  FAIL: No executable found" -ForegroundColor Red
    $errors++
}

# Check webview.js
$webviewJs = Join-Path $extBuildDest "media\webview.js"
if (Test-Path $webviewJs) {
    $size = (Get-Item $webviewJs).Length
    if ($size -gt 500000) {
        Write-Host "  OK: webview.js ($size bytes)" -ForegroundColor Green
    } else {
        Write-Host "  FAIL: webview.js too small ($size bytes)" -ForegroundColor Red
        $errors++
    }
} else {
    Write-Host "  FAIL: webview.js not found" -ForegroundColor Red
    $errors++
}

# Check extension.js
$extensionJs = Join-Path $extBuildDest "out\extension.js"
if (Test-Path $extensionJs) {
    $size = (Get-Item $extensionJs).Length
    if ($size -gt 1000) {
        Write-Host "  OK: extension.js ($size bytes)" -ForegroundColor Green
    } else {
        Write-Host "  FAIL: extension.js too small ($size bytes)" -ForegroundColor Red
        $errors++
    }
} else {
    Write-Host "  FAIL: extension.js not found" -ForegroundColor Red
    $errors++
}

# Check welcome assets
$welcomeLogo = Join-Path $WelcomeDest "ritemark-welcome-logo-full.svg"
$welcomeHero = Join-Path $WelcomeDest "ritemark-welcome-hero-bg.png"
if ((Test-Path $welcomeLogo) -and (Test-Path $welcomeHero)) {
    Write-Host "  OK: Welcome assets present" -ForegroundColor Green
} else {
    Write-Host "  FAIL: Welcome assets missing" -ForegroundColor Red
    $errors++
}

if ($errors -gt 0) {
    Write-Host ""
    Write-Host "Validation FAILED with $errors error(s)" -ForegroundColor Red
    exit 1
}

# ------------------------------------------------------------------
# Done
# ------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Build Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Output: $BuildOut"
Write-Host ""
Write-Host "Next: Open Inno Setup and point it at $BuildOut"
Write-Host ""

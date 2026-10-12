<#
.SYNOPSIS
  Sprint 129 W8 stage B: runs a branch build of the Ritemark extension inside the
  installed Windows Ritemark, without changing the installed app.

.DESCRIPTION
  Copies the installed app's bundled extension into %TEMP%\rm-s129\ext\ritemark,
  lays the overlay zip from scripts/qa/make-windows-test-overlay.sh over it, and
  starts the installed Ritemark.exe with that extension folder, a fresh profile
  (%TEMP%\rm-s129\ud) and a test folder with one Markdown file. Close that window
  to end the test; the next normal start of Ritemark is unaffected.

  Runs on the Windows PowerShell 5.1 that comes with Windows.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\windows-branch-test.ps1 -Overlay "$HOME\Downloads\ritemark-windows-test-overlay-abc1234.zip"
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Overlay,
  [string]$RitemarkExe
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

if (-not $RitemarkExe) {
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Ritemark\Ritemark.exe'),
    (Join-Path $env:ProgramFiles 'Ritemark\Ritemark.exe')
  )
  $RitemarkExe = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $RitemarkExe -or -not (Test-Path -LiteralPath $RitemarkExe)) {
  throw 'Ritemark.exe was not found. Pass -RitemarkExe "<path to Ritemark.exe>".'
}
$installed = Join-Path (Split-Path -Parent $RitemarkExe) 'resources\app\extensions\ritemark'
if (-not (Test-Path -LiteralPath (Join-Path $installed 'package.json'))) { throw "No bundled extension at $installed." }

$root = Join-Path $env:TEMP 'rm-s129'
$ext = Join-Path $root 'ext'
$userData = Join-Path $root 'ud'
$workspace = Join-Path $root 'dictation-test'
if (Test-Path -LiteralPath $ext) { Remove-Item -LiteralPath $ext -Recurse -Force }
New-Item -ItemType Directory -Path $ext, $userData, $workspace -Force | Out-Null

Write-Host "Copying the installed extension ($installed)..."
Copy-Item -LiteralPath $installed -Destination (Join-Path $ext 'ritemark') -Recurse
Write-Host 'Laying the branch build over it...'
Unblock-File -LiteralPath $Overlay
Expand-Archive -LiteralPath $Overlay -DestinationPath (Join-Path $ext 'ritemark') -Force

$pkg = Get-Content -LiteralPath (Join-Path $ext 'ritemark\package.json') -Raw | ConvertFrom-Json
$engine = Join-Path $ext 'ritemark\binaries\win32-x64\whisper-cli.exe'
if (-not (Test-Path -LiteralPath $engine)) { throw 'The overlay has no Windows speech engine.' }

$note = Join-Path $workspace 'Dictation test.md'
if (-not (Test-Path -LiteralPath $note)) {
  Set-Content -LiteralPath $note -Encoding UTF8 -Value @(
    '# Dictation test',
    '',
    'Click the microphone button at the top right and speak. Estonian and English both work.',
    ''
  )
}

$installedVersion = (Get-Content -LiteralPath (Join-Path $installed 'package.json') -Raw | ConvertFrom-Json).version
Write-Host ''
Write-Host "Starting Ritemark ($RitemarkExe) with the branch extension $($pkg.version) (installed: $installedVersion)."
Write-Host "Profile: $userData (fresh; your normal settings are not used)."
Write-Host 'Walk the scenarios marked B in the sprint''s scenarios.md, then close the window.'
& $RitemarkExe --extensions-dir $ext --user-data-dir $userData $workspace

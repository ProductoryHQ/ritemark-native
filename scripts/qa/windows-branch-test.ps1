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

# VS Code keeps the built-in copy, without a word, when the branch's version isn't higher (Sprint 145: a 1.99.x
# overlay under 2.1.0 tested 2.1.0). Checked before the copy, so a wrong overlay stops at once.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $Overlay).Path)
try {
  $entry = $zip.Entries | Where-Object { $_.FullName -eq 'package.json' } | Select-Object -First 1
  if (-not $entry) { throw 'The overlay has no package.json at its top.' }
  $reader = New-Object IO.StreamReader($entry.Open())
  try { $overlayVersion = ($reader.ReadToEnd() | ConvertFrom-Json).version } finally { $reader.Dispose() }
} finally { $zip.Dispose() }
$installedVersion = (Get-Content -LiteralPath (Join-Path $installed 'package.json') -Raw | ConvertFrom-Json).version
if ([version](($overlayVersion -split '-')[0]) -le [version](($installedVersion -split '-')[0])) {
  throw "The overlay's version $overlayVersion is not higher than the installed $installedVersion, so Ritemark would run the installed extension. Rebuild the overlay with make-windows-test-overlay.sh."
}

$root = Join-Path $env:TEMP 'rm-s129'
$ext = Join-Path $root 'ext'
$userData = Join-Path $root 'ud'
# Its own shared-data folder too: without it, the test shares ~\.ritemark-shared (Open Recent) with the person's Ritemark
$sharedData = Join-Path $root 'shared'
$workspace = Join-Path $root 'dictation-test'
if (Test-Path -LiteralPath $ext) { Remove-Item -LiteralPath $ext -Recurse -Force }
New-Item -ItemType Directory -Path $ext, $userData, $sharedData, $workspace -Force | Out-Null

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

Write-Host ''
Write-Host "Starting Ritemark ($RitemarkExe) with the branch extension $($pkg.version) (installed: $installedVersion)."
Write-Host "Profile: $userData (fresh; your normal settings are not used)."
Write-Host 'Walk the scenarios marked B in the sprint''s scenarios.md, then close the window.'
& $RitemarkExe --extensions-dir $ext --user-data-dir $userData --shared-data-dir $sharedData $workspace

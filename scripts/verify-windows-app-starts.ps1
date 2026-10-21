[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string]$AppRoot,

  [Parameter(Mandatory)]
  [string]$EvidenceDirectory,

  [int]$TimeoutSeconds = 240,

  [int]$SettleSeconds = 20
)

# Starts an installed Ritemark on a profile of its own and proves it can run:
# the extension host comes up and starts Ritemark's extension, with no
# extension host crash and no failed activation. An update can leave the app
# unable to start while every file check passes (Sprint 136: 2.0 installed
# over 1.14 kept 1.14's unpacked node_modules, and the extension host exited
# on its first start). Usable on CI and by hand on a PC; it never touches the
# person's own profile.

$ErrorActionPreference = 'Stop'

$appExe = Join-Path (Resolve-Path -LiteralPath $AppRoot).Path 'Ritemark.exe'
if (-not (Test-Path -LiteralPath $appExe -PathType Leaf)) {
  throw "Ritemark.exe was not found in $AppRoot."
}
$evidenceRoot = [System.IO.Path]::GetFullPath($EvidenceDirectory)
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null

$runRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("rm-start-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
$userData = Join-Path $runRoot 'ud'
$extensionsDir = Join-Path $runRoot 'ext'
$sharedData = Join-Path $runRoot 'shared'
New-Item -ItemType Directory -Path $userData,$extensionsDir,$sharedData -Force | Out-Null
$logsRoot = Join-Path $userData 'logs'

# VS Code logs this at info level when it starts an extension's activation.
$activationLine = 'ExtensionService#_doActivateExtension ritemark.ritemark'
$failureLines = @(
  'terminated unexpectedly',
  'Activating extension ritemark.ritemark failed',
  "Activating extension 'ritemark.ritemark' failed"
)

function Get-LogText {
  if (-not (Test-Path -LiteralPath $logsRoot)) { return '' }
  $parts = foreach ($log in Get-ChildItem -LiteralPath $logsRoot -Recurse -File -Filter '*.log' -ErrorAction SilentlyContinue) {
    # Ritemark still has its logs open for writing: share them back, or the read fails.
    try {
      $stream = [System.IO.File]::Open($log.FullName, 'Open', 'Read', 'ReadWrite, Delete')
      $reader = [System.IO.StreamReader]::new($stream)
      try { $reader.ReadToEnd() } finally { $reader.Dispose() }
    } catch { '' }
  }
  return ($parts -join "`n")
}

function Find-Failure([string]$text) {
  foreach ($line in $failureLines) {
    if ($text.Contains($line)) { return $line }
  }
  return $null
}

# A test launch: marked as one for usage data (#480), with its own profile,
# extensions and shared data (#475).
$previousChannel = $env:RITEMARK_BUILD_CHANNEL
$env:RITEMARK_BUILD_CHANNEL = 'test'
try {
  $process = Start-Process -FilePath $appExe -PassThru -ArgumentList @(
    "--user-data-dir=`"$userData`"",
    "--extensions-dir=`"$extensionsDir`"",
    "--shared-data-dir=`"$sharedData`""
  )
} finally {
  $env:RITEMARK_BUILD_CHANNEL = $previousChannel
}

$activated = $false
$failure = $null
$exitedEarly = $false
$deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
try {
  while ([DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Seconds 2
    $text = Get-LogText
    $failure = Find-Failure $text
    if ($failure) { break }
    if ($text.Contains($activationLine)) { $activated = $true; break }
    if ($process.HasExited) { $exitedEarly = $true; break }
  }
  if ($activated) {
    # The activation has started; give a failing activation or a late crash time to show.
    Start-Sleep -Seconds $SettleSeconds
    $failure = Find-Failure (Get-LogText)
    if ($process.HasExited) { $exitedEarly = $true }
  }
} finally {
  if (-not $process.HasExited) {
    & taskkill.exe /PID $process.Id /T /F 2>&1 | Out-Null
    $null = $process.WaitForExit(15000)
  }
  # An uninstall or the next install needs the app's files free.
  $appFolder = (Split-Path -Parent $appExe) + '\'
  $quitDeadline = [DateTime]::UtcNow.AddSeconds(15)
  while ((Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($appFolder, [System.StringComparison]::OrdinalIgnoreCase) }) -and
         [DateTime]::UtcNow -lt $quitDeadline) {
    Start-Sleep -Milliseconds 500
  }
  if (Test-Path -LiteralPath $logsRoot) {
    Copy-Item -LiteralPath $logsRoot -Destination (Join-Path $evidenceRoot 'logs') -Recurse -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -LiteralPath $runRoot -Recurse -Force -ErrorAction SilentlyContinue
}

$passed = $activated -and -not $failure -and -not $exitedEarly
$status = 'failed'
if ($passed) { $status = 'passed' }
[ordered]@{
  status = $status
  app = $appExe
  activationStarted = $activated
  failure = $failure
  exitedEarly = $exitedEarly
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $evidenceRoot 'app-start-result.json') -Encoding utf8NoBOM

if (-not $passed) {
  $reason = "Ritemark's extension did not start activating within $TimeoutSeconds seconds"
  if ($exitedEarly) { $reason = 'Ritemark exited' }
  if ($failure) { $reason = "the log says '$failure'" }
  throw "Ritemark did not start cleanly from $AppRoot ($reason). Logs are in $evidenceRoot."
}
Write-Host "Ritemark started from $AppRoot and activated its extension with no extension host failure."

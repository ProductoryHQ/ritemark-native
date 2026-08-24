<#
.SYNOPSIS
  Finds every Windows PE by file content and verifies the signatures users rely on.
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidateSet('Detect', 'PrepareSigning', 'Verify')][string]$Mode,
  [Parameter(Mandatory)][string]$Root,
  [string]$CatalogPath,
  [string]$ReportPath,
  [string]$SignToolPath,
  [string]$ExpectedPublisher = 'Productory Services OÜ',
  [string[]]$OwnedPathPattern = @('Ritemark.exe'),
  [scriptblock]$SignatureProvider,
  [scriptblock]$SignToolVerifier
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Test-PortableExecutable {
  param([Parameter(Mandatory)][string]$Path)
  $stream = $null
  try {
    $stream = [System.IO.File]::Open($Path, 'Open', 'Read', 'ReadWrite')
    if ($stream.Length -lt 68) { return $false }
    $reader = [System.IO.BinaryReader]::new($stream)
    if ($reader.ReadByte() -ne 0x4d -or $reader.ReadByte() -ne 0x5a) { return $false }
    $stream.Position = 0x3c
    $peOffset = $reader.ReadInt32()
    if ($peOffset -lt 0 -or ($peOffset + 4) -gt $stream.Length) { return $false }
    $stream.Position = $peOffset
    return $reader.ReadByte() -eq 0x50 -and $reader.ReadByte() -eq 0x45 -and
      $reader.ReadByte() -eq 0x00 -and $reader.ReadByte() -eq 0x00
  } finally {
    if ($null -ne $stream) { $stream.Dispose() }
  }
}

function Get-RelativeUnixPath {
  param([Parameter(Mandatory)][string]$Base, [Parameter(Mandatory)][string]$Path)
  [System.IO.Path]::GetRelativePath($Base, $Path).Replace('\', '/')
}

function Test-OwnedPath {
  param([Parameter(Mandatory)][string]$RelativePath, [string[]]$Patterns)
  foreach ($pattern in $Patterns) {
    if ($RelativePath -like $pattern -or [System.IO.Path]::GetFileName($RelativePath) -like $pattern) {
      return $true
    }
  }
  return $false
}

function Test-Publisher {
  param([AllowNull()]$Certificate, [Parameter(Mandatory)][string]$Publisher)
  if ($null -eq $Certificate) { return $false }
  return [string]$Certificate.Subject -match "(?i)(^|,\s*)CN=$([regex]::Escape($Publisher))($|,)"
}

$resolvedRoot = (Resolve-Path -LiteralPath $Root).Path
$peFiles = @(Get-ChildItem -LiteralPath $resolvedRoot -File -Recurse -Force |
  Where-Object { Test-PortableExecutable $_.FullName } |
  Sort-Object FullName)
if ($peFiles.Count -eq 0) { throw "No Portable Executables found under '$resolvedRoot'." }

if ($Mode -ne 'Detect' -and $null -eq $SignatureProvider) {
  if (-not (Get-Command Get-AuthenticodeSignature -ErrorAction SilentlyContinue)) {
    throw "$Mode requires Get-AuthenticodeSignature on Windows."
  }
  $SignatureProvider = { param($Path) Get-AuthenticodeSignature -LiteralPath $Path }
}

if ($Mode -eq 'Verify' -and $null -eq $SignToolVerifier) {
  if (-not $SignToolPath) { $SignToolPath = (Get-Command signtool.exe -ErrorAction SilentlyContinue).Source }
  if (-not $SignToolPath -or -not (Test-Path -LiteralPath $SignToolPath -PathType Leaf)) {
    throw 'Verify requires a valid -SignToolPath.'
  }
  $SignToolVerifier = {
    param($Path, $ToolPath)
    & $ToolPath verify /pa /all $Path | Out-Host
    return $LASTEXITCODE -eq 0
  }
}

$files = [System.Collections.Generic.List[object]]::new()
$failures = [System.Collections.Generic.List[string]]::new()
$signingTargets = [System.Collections.Generic.List[string]]::new()

foreach ($file in $peFiles) {
  $relativePath = Get-RelativeUnixPath $resolvedRoot $file.FullName
  $owned = Test-OwnedPath $relativePath $OwnedPathPattern

  if ($Mode -eq 'Detect') {
    $files.Add([pscustomobject]@{ path = $relativePath; owned = $owned })
    continue
  }

  $signature = & $SignatureProvider $file.FullName
  $status = [string]$signature.Status
  $publisherMatches = Test-Publisher $signature.SignerCertificate $ExpectedPublisher
  $timestamped = $null -ne $signature.TimeStamperCertificate

  if ($Mode -eq 'PrepareSigning') {
    if ($status -eq 'NotSigned' -or ($owned -and ($status -ne 'Valid' -or -not $publisherMatches -or -not $timestamped))) {
      $signingTargets.Add($file.FullName)
      $action = 'Sign'
    } elseif ($status -eq 'Valid') {
      $action = 'Preserve'
    } else {
      $failures.Add("$relativePath has invalid vendor signature status '$status'.")
      $action = 'Block'
    }
  } else {
    $action = 'Verify'
    if ($status -ne 'Valid') {
      $failures.Add("$relativePath signature is '$status', expected 'Valid'.")
    }
    if (-not (& $SignToolVerifier $file.FullName $SignToolPath)) {
      $failures.Add("$relativePath failed signtool verify /pa /all.")
    }
    if (($owned -or $publisherMatches) -and -not $publisherMatches) {
      $failures.Add("$relativePath publisher is not '$ExpectedPublisher'.")
    }
    if (($owned -or $publisherMatches) -and -not $timestamped) {
      $failures.Add("$relativePath is missing an Authenticode timestamp.")
    }
  }

  $files.Add([pscustomobject]@{
    path = $relativePath
    owned = $owned
    action = $action
    signatureStatus = $status
    productoryPublisher = $publisherMatches
    timestamped = $timestamped
  })
}

if ($Mode -eq 'PrepareSigning') {
  if (-not $CatalogPath) { throw 'PrepareSigning requires -CatalogPath.' }
  $catalogFullPath = [System.IO.Path]::GetFullPath($CatalogPath)
  New-Item -ItemType Directory -Path (Split-Path -Parent $catalogFullPath) -Force | Out-Null
  $catalogLines = @($signingTargets | ForEach-Object { './' + (Get-RelativeUnixPath (Split-Path -Parent $catalogFullPath) $_) })
  Set-Content -LiteralPath $catalogFullPath -Value $catalogLines -Encoding utf8NoBOM
  if ($catalogLines.Count -eq 0) { throw 'No Windows binaries need signing; expected at least the branded Ritemark.exe.' }
}

$report = [ordered]@{
  mode = $Mode
  portableExecutableCount = $peFiles.Count
  signingTargetCount = $signingTargets.Count
  files = @($files)
  failures = @($failures)
}
if ($ReportPath) {
  $reportFullPath = [System.IO.Path]::GetFullPath($ReportPath)
  New-Item -ItemType Directory -Path (Split-Path -Parent $reportFullPath) -Force | Out-Null
  $report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $reportFullPath -Encoding utf8NoBOM
}

Write-Host "Windows PE check: $($peFiles.Count) file(s), $($signingTargets.Count) to sign, $($failures.Count) failure(s)."
if ($failures.Count -gt 0) { throw ($failures -join [Environment]::NewLine) }

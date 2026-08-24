[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidateSet('signed-canary', 'unsigned-canary', 'release')][string]$BuildMode,
  [Parameter(Mandatory)][string]$Version,
  [Parameter(Mandatory)][ValidateSet('branch', 'tag')][string]$RefType,
  [Parameter(Mandatory)][string]$RefName,
  [string]$TenantId,
  [string]$ClientId,
  [string]$ClientSecret,
  [string]$RunId = 'local'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$expectedTag = "v$Version"
$shouldSign = $BuildMode -ne 'unsigned-canary'
$isRelease = $BuildMode -eq 'release'

if ($isRelease) {
  if ($RefType -ne 'tag' -or $RefName -ne $expectedTag) {
    throw "Release mode requires the exact tag '$expectedTag'; got $RefType '$RefName'."
  }
} elseif ($RefType -eq 'tag') {
  throw "Tag refs may run only in release mode; '$BuildMode' is non-release."
}

if ($shouldSign) {
  $credentials = [ordered]@{
    AZURE_SIGNING_TENANT_ID = $TenantId
    AZURE_SIGNING_CLIENT_ID = $ClientId
    AZURE_SIGNING_CLIENT_SECRET = $ClientSecret
  }
  $missing = @($credentials.GetEnumerator() | Where-Object { [string]::IsNullOrWhiteSpace([string]$_.Value) } | ForEach-Object Key)
  if ($missing.Count -gt 0) { throw "Signing mode is missing required secret(s): $($missing -join ', ')." }
}

if ($isRelease) {
  $buildArtifact = 'ritemark-windows-x64'
  $installerArtifact = 'ritemark-windows-installer'
  $installerBase = "Ritemark-$Version-win32-x64-setup"
} else {
  $buildArtifact = "ritemark-windows-x64-$BuildMode-$RunId"
  $installerArtifact = "ritemark-windows-installer-$BuildMode-$RunId"
  $modeLabel = if ($shouldSign) { 'SIGNED-CANARY-NON-RELEASE' } else { 'UNSIGNED-NON-RELEASE' }
  $installerBase = "Ritemark-$Version-win32-x64-setup-$modeLabel"
}

[ordered]@{
  version = $Version
  isRelease = $isRelease
  shouldSign = $shouldSign
  buildArtifact = $buildArtifact
  installerArtifact = $installerArtifact
  installerBase = $installerBase
} | ConvertTo-Json -Compress

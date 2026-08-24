[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$SdkBinRoot,
  [Parameter(Mandatory)][string]$ArtifactSigningClientRoot,
  [version]$MinimumSdkVersion = [version]'10.0.22621.0'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$candidates = [System.Collections.Generic.List[object]]::new()
foreach ($file in @(Get-ChildItem -LiteralPath $SdkBinRoot -Filter signtool.exe -File -Recurse)) {
  if ($file.Directory.Name -ne 'x64') { continue }
  $versionDirectory = $file.Directory.Parent.Name
  $parsedVersion = $null
  if (-not [version]::TryParse($versionDirectory, [ref]$parsedVersion)) { continue }
  $candidates.Add([pscustomobject]@{ path = $file.FullName; sdkVersion = $parsedVersion })
}

$selected = $candidates | Where-Object { $_.sdkVersion -ge $MinimumSdkVersion } |
  Sort-Object sdkVersion -Descending | Select-Object -First 1
if ($null -eq $selected) {
  throw "No x64 signtool.exe found in a semantic Windows SDK directory at or above $MinimumSdkVersion."
}

$dlib = Get-ChildItem -LiteralPath $ArtifactSigningClientRoot -Filter Azure.CodeSigning.Dlib.dll -File -Recurse |
  Where-Object { $_.FullName -match '[\\/]bin[\\/]x64[\\/]' } | Select-Object -First 1
if ($null -eq $dlib) { throw 'x64 Azure.CodeSigning.Dlib.dll was not found.' }

$packageDirectory = $dlib.Directory
while ($null -ne $packageDirectory -and $packageDirectory.Parent -and $packageDirectory.Parent.FullName -ne $ArtifactSigningClientRoot) {
  $packageDirectory = $packageDirectory.Parent
}

[ordered]@{
  signToolPath = $selected.path
  windowsSdkVersion = $selected.sdkVersion.ToString()
  dlibPath = $dlib.FullName
  artifactSigningClientPackage = if ($null -ne $packageDirectory) { $packageDirectory.Name } else { 'unknown' }
  dlibFileVersion = $dlib.VersionInfo.FileVersion
} | ConvertTo-Json -Compress

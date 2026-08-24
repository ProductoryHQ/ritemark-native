[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$SdkBinRoot,
  [Parameter(Mandatory)][string]$ArtifactSigningClientRoot,
  [version]$MinimumSdkVersion = [version]'10.0.22621.0'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$candidates = foreach ($file in @(Get-ChildItem -LiteralPath $SdkBinRoot -Filter signtool.exe -File -Recurse)) {
  if ($file.Directory.Name -ne 'x64') { continue }
  $sdkVersion = $null
  if ([version]::TryParse($file.Directory.Parent.Name, [ref]$sdkVersion)) {
    [pscustomobject]@{ path = $file.FullName; sdkVersion = $sdkVersion }
  }
}
$selected = $candidates | Where-Object { $_.sdkVersion -ge $MinimumSdkVersion } |
  Sort-Object sdkVersion -Descending | Select-Object -First 1
if ($null -eq $selected) {
  throw "No x64 signtool.exe found at or above Windows SDK $MinimumSdkVersion."
}

$dlib = Get-ChildItem -LiteralPath $ArtifactSigningClientRoot -Filter Azure.CodeSigning.Dlib.dll -File -Recurse |
  Where-Object { $_.FullName -match '[\\/]bin[\\/]x64[\\/]' } |
  Select-Object -First 1
if ($null -eq $dlib) { throw 'x64 Azure.CodeSigning.Dlib.dll was not found.' }

[ordered]@{
  signToolPath = $selected.path
  windowsSdkVersion = $selected.sdkVersion.ToString()
  dlibPath = $dlib.FullName
} | ConvertTo-Json -Compress

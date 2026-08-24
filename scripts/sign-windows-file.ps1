<#
.SYNOPSIS
  Inno Setup SignTool adapter for Azure Artifact Signing.
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$FilePath,
  [Parameter(Mandatory)][string]$SignToolPath,
  [Parameter(Mandatory)][string]$DlibPath,
  [Parameter(Mandatory)][string]$MetadataPath,
  [string]$ExpectedPublisher = 'Productory Services OÜ'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
  throw "Inno signing target does not exist: $FilePath"
}

& $SignToolPath sign /v /fd SHA256 /tr http://timestamp.acs.microsoft.com /td SHA256 `
  /dlib $DlibPath /dmdf $MetadataPath $FilePath
if ($LASTEXITCODE -ne 0) {
  throw "Artifact Signing failed for '$FilePath' with exit code $LASTEXITCODE."
}

& $SignToolPath verify /pa /all $FilePath
if ($LASTEXITCODE -ne 0) {
  throw "SignTool verification failed for '$FilePath' with exit code $LASTEXITCODE."
}

$signature = Get-AuthenticodeSignature -LiteralPath $FilePath
if ($signature.Status -ne 'Valid') {
  throw "Authenticode status for '$FilePath' is '$($signature.Status)', expected Valid."
}
if ($null -eq $signature.SignerCertificate -or
    $signature.SignerCertificate.Subject -notmatch "(?i)(^|,\s*)CN=$([regex]::Escape($ExpectedPublisher))($|,)") {
  throw "Publisher for '$FilePath' is not '$ExpectedPublisher'."
}
if ($null -eq $signature.TimeStamperCertificate) {
  throw "Timestamp certificate missing for '$FilePath'."
}

Write-Host "Signed and verified: $FilePath"

<#
.SYNOPSIS
  Inno Setup SignTool adapter for Azure Artifact Signing.

.DESCRIPTION
  Called once per Inno-generated executable. It signs with SignTool+dlib,
  runs SignTool trust verification, checks the observed Authenticode publisher
  and timestamp-certificate presence, and appends a JSON-lines adapter record.
  Digest/protocol fields in this record describe the signing command config;
  the final structured verifier independently observes PKCS#7/RFC3161 facts.
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$FilePath,
  [Parameter(Mandatory)][string]$SignToolPath,
  [Parameter(Mandatory)][string]$DlibPath,
  [Parameter(Mandatory)][string]$MetadataPath,
  [Parameter(Mandatory)][string]$EvidenceLogPath,
  [string]$ExpectedPublisher = 'Productory Services OÜ'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
  throw "Inno signing target does not exist: $FilePath"
}

$signArguments = @(
  'sign', '/v', '/fd', 'SHA256',
  '/tr', 'http://timestamp.acs.microsoft.com', '/td', 'SHA256',
  '/dlib', $DlibPath, '/dmdf', $MetadataPath,
  $FilePath
)
& $SignToolPath @signArguments
if ($LASTEXITCODE -ne 0) {
  throw "Artifact Signing failed for '$FilePath' with exit code $LASTEXITCODE."
}

$evidenceDirectory = Split-Path -Parent ([System.IO.Path]::GetFullPath($EvidenceLogPath))
$rawDirectory = Join-Path $evidenceDirectory 'inno-signtool-raw'
New-Item -ItemType Directory -Path $rawDirectory -Force | Out-Null
$nameHash = [Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($FilePath))).Substring(0, 12).ToLowerInvariant()
$rawEvidencePath = Join-Path $rawDirectory "$([System.IO.Path]::GetFileName($FilePath))-$nameHash.signtool.txt"
$rawVerification = @(& $SignToolPath verify /pa /all /v $FilePath 2>&1 | ForEach-Object { $_.ToString() })
$verifyExitCode = $LASTEXITCODE
Set-Content -LiteralPath $rawEvidencePath -Value $rawVerification -Encoding utf8NoBOM
if ($verifyExitCode -ne 0) {
  throw "SignTool verification failed for '$FilePath' with exit code $verifyExitCode; evidence: $rawEvidencePath."
}

$signature = Get-AuthenticodeSignature -LiteralPath $FilePath
$publisher = if ($null -ne $signature.SignerCertificate) {
  $signature.SignerCertificate.GetNameInfo(
    [System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName,
    $false
  )
} else { $null }

if ($signature.Status -ne 'Valid') {
  throw "Authenticode status for '$FilePath' is '$($signature.Status)', expected Valid."
}
if ($publisher -ne $ExpectedPublisher) {
  throw "Publisher for '$FilePath' is '$publisher', expected '$ExpectedPublisher'."
}
if ($null -eq $signature.TimeStamperCertificate) {
  throw "Timestamp certificate missing for '$FilePath'."
}

New-Item -ItemType Directory -Path $evidenceDirectory -Force | Out-Null
$record = [ordered]@{
  signedAt = [DateTimeOffset]::UtcNow.ToString('o')
  path = $FilePath
  sha256 = (Get-FileHash -LiteralPath $FilePath -Algorithm SHA256).Hash.ToLowerInvariant()
  publisher = $publisher
  signerSubject = $signature.SignerCertificate.Subject
  signerIssuer = $signature.SignerCertificate.Issuer
  signerThumbprint = $signature.SignerCertificate.Thumbprint
  signatureStatus = [string]$signature.Status
  signToolTrustVerificationObserved = $true
  configuredSignatureDigest = 'sha256'
  authenticodeTimestampCertificateObserved = $true
  configuredTimestampProtocol = 'RFC3161'
  configuredTimestampDigest = 'sha256'
  timestampSignerSubject = $signature.TimeStamperCertificate.Subject
  timestampSignerIssuer = $signature.TimeStamperCertificate.Issuer
  timestampSignerThumbprint = $signature.TimeStamperCertificate.Thumbprint
  rawSignToolVerificationEvidence = $rawEvidencePath
}
Add-Content -LiteralPath $EvidenceLogPath -Value ($record | ConvertTo-Json -Compress) -Encoding utf8NoBOM

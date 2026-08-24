<#
.SYNOPSIS
  Inventories PE files by content and enforces Ritemark's Authenticode policy.

.DESCRIPTION
  Detect is cross-platform. PrepareSigning and Verify use Windows Authenticode.
  Verify additionally runs `signtool verify /pa /all /v` for every PE, retains
  the raw output, decodes the PKCS#7 signature and RFC 3161 token, validates
  certificate chains at the timestamp generation time, and emits structured
  certificate/digest evidence. Any missing or unverifiable field fails closed.
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidateSet('Detect', 'PrepareSigning', 'Verify')][string]$Mode,
  [Parameter(Mandatory)][string]$Root,
  [string]$CatalogPath,
  [string]$ReportPath,
  [string]$BaselineReportPath,
  [string]$SignToolPath,
  [string]$RawEvidenceDirectory,
  [string]$ExpectedPublisher = 'Productory Services OÜ',
  [string[]]$OwnedPathPattern = @('Ritemark.exe'),
  [switch]$RequireExpectedPublisherForAll,
  [switch]$RequireTimestamp
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'windows-signature-policy.ps1')

function Test-PortableExecutable {
  param([Parameter(Mandatory)][string]$Path)
  $stream = $null
  try {
    $stream = [System.IO.File]::Open($Path, 'Open', 'Read', 'ReadWrite')
    if ($stream.Length -lt 64) { return $false }
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

function Test-PathMatchesAnyPattern {
  param([Parameter(Mandatory)][string]$RelativePath, [string[]]$Patterns)
  foreach ($pattern in $Patterns) {
    if ($RelativePath -like $pattern -or [System.IO.Path]::GetFileName($RelativePath) -like $pattern) { return $true }
  }
  return $false
}

function Test-ExpectedPublisher {
  param(
    [AllowNull()][System.Security.Cryptography.X509Certificates.X509Certificate2]$Certificate,
    [Parameter(Mandatory)][string]$Publisher
  )
  if ($null -eq $Certificate) { return $false }
  $simpleName = $Certificate.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false)
  return $simpleName -eq $Publisher -or $Certificate.Subject -match "(?i)(^|,\s*)CN=$([regex]::Escape($Publisher))($|,)"
}

function Convert-DigestOid {
  param([AllowNull()][string]$Oid)
  switch ($Oid) {
    '2.16.840.1.101.3.4.2.1' { 'sha256' }
    '2.16.840.1.101.3.4.2.2' { 'sha384' }
    '2.16.840.1.101.3.4.2.3' { 'sha512' }
    '1.3.14.3.2.26' { 'sha1' }
    default { $Oid }
  }
}

function Get-CertificateIdentity {
  param([AllowNull()][System.Security.Cryptography.X509Certificates.X509Certificate2]$Certificate)
  if ($null -eq $Certificate) { return $null }
  [ordered]@{
    subject = $Certificate.Subject
    simpleName = $Certificate.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false)
    issuer = $Certificate.Issuer
    thumbprint = $Certificate.Thumbprint
    serialNumber = $Certificate.SerialNumber
    notBefore = $Certificate.NotBefore.ToUniversalTime().ToString('o')
    notAfter = $Certificate.NotAfter.ToUniversalTime().ToString('o')
  }
}

function Get-CertificateChainEvidence {
  param(
    [AllowNull()][System.Security.Cryptography.X509Certificates.X509Certificate2]$Certificate,
    [AllowNull()][DateTimeOffset]$VerificationTime
  )
  if ($null -eq $Certificate) { return [ordered]@{ valid = $false; statuses = @('certificate missing'); elements = @() } }
  $chain = [System.Security.Cryptography.X509Certificates.X509Chain]::new()
  try {
    $chain.ChainPolicy.RevocationMode = [System.Security.Cryptography.X509Certificates.X509RevocationMode]::Online
    $chain.ChainPolicy.RevocationFlag = [System.Security.Cryptography.X509Certificates.X509RevocationFlag]::EntireChain
    $chain.ChainPolicy.VerificationFlags = [System.Security.Cryptography.X509Certificates.X509VerificationFlags]::NoFlag
    $chain.ChainPolicy.UrlRetrievalTimeout = [TimeSpan]::FromSeconds(30)
    if ($null -ne $VerificationTime) { $chain.ChainPolicy.VerificationTime = $VerificationTime.UtcDateTime }
    $valid = $chain.Build($Certificate)
    return [ordered]@{
      valid = $valid
      verificationTime = if ($null -ne $VerificationTime) { $VerificationTime.ToString('o') } else { $null }
      statuses = @($chain.ChainStatus | ForEach-Object { "$($_.Status): $($_.StatusInformation.Trim())" })
      elements = @($chain.ChainElements | ForEach-Object { Get-CertificateIdentity $_.Certificate })
    }
  } finally { $chain.Dispose() }
}

function Get-AuthenticodePkcsEvidence {
  param([Parameter(Mandatory)][string]$Path)

  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $reader = [System.IO.BinaryReader]::new($stream)
    $stream.Position = 0x3c
    $peOffset = $reader.ReadInt32()
    $optionalOffset = $peOffset + 24
    $stream.Position = $optionalOffset
    $magic = $reader.ReadUInt16()
    $dataDirectoryOffset = switch ($magic) { 0x10b { $optionalOffset + 96 } 0x20b { $optionalOffset + 112 } default { throw 'Unsupported PE optional-header magic.' } }
    $stream.Position = $dataDirectoryOffset + (8 * 4)
    $certificateOffset = $reader.ReadUInt32()
    $certificateSize = $reader.ReadUInt32()
    if ($certificateOffset -eq 0 -or $certificateSize -lt 8 -or ($certificateOffset + $certificateSize) -gt $stream.Length) {
      throw 'PE contains no readable Authenticode certificate table.'
    }
    $stream.Position = $certificateOffset
    $recordLength = $reader.ReadUInt32()
    $null = $reader.ReadUInt16()
    $certificateType = $reader.ReadUInt16()
    if ($certificateType -ne 2 -or $recordLength -lt 8 -or $recordLength -gt $certificateSize) {
      throw 'First WIN_CERTIFICATE record is not a valid PKCS#7 signature.'
    }
    $encoded = $reader.ReadBytes([int]$recordLength - 8)
  } finally { $stream.Dispose() }

  $cms = [System.Security.Cryptography.Pkcs.SignedCms]::new()
  $cms.Decode($encoded)
  if ($cms.SignerInfos.Count -lt 1) { throw 'Authenticode PKCS#7 has no signer.' }
  $signer = $cms.SignerInfos[0]
  $timestampAttribute = $signer.UnsignedAttributes | Where-Object { $_.Oid.Value -eq '1.3.6.1.4.1.311.3.3.1' } | Select-Object -First 1

  $timestamp = $null
  $verificationTime = $null
  if ($null -ne $timestampAttribute -and $timestampAttribute.Values.Count -gt 0) {
    $timestampCms = [System.Security.Cryptography.Pkcs.SignedCms]::new()
    $timestampCms.Decode($timestampAttribute.Values[0].RawData)
    if ($timestampCms.SignerInfos.Count -lt 1) { throw 'RFC 3161 token has no signer.' }
    $timestampSigner = $timestampCms.SignerInfos[0]

    $asnReader = [System.Formats.Asn1.AsnReader]::new(
      [System.ReadOnlyMemory[byte]]::new($timestampCms.ContentInfo.Content),
      [System.Formats.Asn1.AsnEncodingRules]::DER
    )
    $tstInfo = $asnReader.ReadSequence()
    $null = $tstInfo.ReadInteger()
    $null = $tstInfo.ReadObjectIdentifier()
    $messageImprint = $tstInfo.ReadSequence()
    $hashAlgorithm = $messageImprint.ReadSequence()
    $messageImprintDigest = Convert-DigestOid $hashAlgorithm.ReadObjectIdentifier()
    $null = $messageImprint.ReadOctetString()
    $null = $tstInfo.ReadInteger()
    $verificationTime = $tstInfo.ReadGeneralizedTime()

    $timestampChain = Get-CertificateChainEvidence -Certificate $timestampSigner.Certificate -VerificationTime $verificationTime
    $timestamp = [ordered]@{
      type = 'RFC3161'
      generatedAt = $verificationTime.ToString('o')
      digest = Convert-DigestOid $timestampSigner.DigestAlgorithm.Value
      messageImprintDigest = $messageImprintDigest
      signer = Get-CertificateIdentity $timestampSigner.Certificate
      chain = $timestampChain
    }
  }

  $signerChain = Get-CertificateChainEvidence -Certificate $signer.Certificate -VerificationTime $verificationTime
  [ordered]@{
    signatureDigest = Convert-DigestOid $signer.DigestAlgorithm.Value
    signer = Get-CertificateIdentity $signer.Certificate
    signerChain = $signerChain
    timestamp = $timestamp
  }
}

function Invoke-RawSignToolVerification {
  param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)][string]$RelativePath,
    [Parameter(Mandatory)][string]$ToolPath,
    [Parameter(Mandatory)][string]$EvidenceDirectory
  )
  New-Item -ItemType Directory -Path $EvidenceDirectory -Force | Out-Null
  $nameHash = [Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($RelativePath))).Substring(0, 12).ToLowerInvariant()
  $safeName = ($RelativePath -replace '[^A-Za-z0-9._-]', '_')
  $evidencePath = Join-Path $EvidenceDirectory "$safeName-$nameHash.signtool.txt"
  $lines = @(& $ToolPath verify /pa /all /v $Path 2>&1 | ForEach-Object { $_.ToString() })
  $exitCode = $LASTEXITCODE
  Set-Content -LiteralPath $evidencePath -Value $lines -Encoding utf8NoBOM
  [ordered]@{ valid = $exitCode -eq 0; exitCode = $exitCode; evidencePath = $evidencePath }
}

$resolvedRoot = (Resolve-Path -LiteralPath $Root).Path
$peFiles = @(Get-ChildItem -LiteralPath $resolvedRoot -File -Recurse -Force | Where-Object { Test-PortableExecutable $_.FullName })
if ($peFiles.Count -eq 0) { throw "No Portable Executables found under '$resolvedRoot'." }

if ($Mode -ne 'Detect' -and -not (Get-Command Get-AuthenticodeSignature -ErrorAction SilentlyContinue)) {
  throw "$Mode requires Get-AuthenticodeSignature on Windows."
}
if ($Mode -eq 'Verify') {
  if (-not $SignToolPath) { $SignToolPath = (Get-Command signtool.exe -ErrorAction SilentlyContinue).Source }
  if (-not $SignToolPath -or -not (Test-Path -LiteralPath $SignToolPath -PathType Leaf)) { throw 'Verify requires a valid -SignToolPath.' }
  if (-not $RawEvidenceDirectory) {
    if (-not $ReportPath) { throw 'Verify requires -RawEvidenceDirectory or -ReportPath.' }
    $RawEvidenceDirectory = Join-Path (Split-Path -Parent ([System.IO.Path]::GetFullPath($ReportPath))) 'signtool-raw'
  }
}

$baselineByPath = @{}
if ($Mode -eq 'Verify' -and $BaselineReportPath) {
  foreach ($entry in (Get-Content -LiteralPath $BaselineReportPath -Raw | ConvertFrom-Json).files) { $baselineByPath[[string]$entry.path] = $entry }
}

$findings = [System.Collections.Generic.List[object]]::new()
$failures = [System.Collections.Generic.List[string]]::new()
$signingPaths = [System.Collections.Generic.List[string]]::new()
$currentPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

foreach ($file in ($peFiles | Sort-Object FullName)) {
  $relativePath = Get-RelativeUnixPath $resolvedRoot $file.FullName
  $null = $currentPaths.Add($relativePath)
  $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  $owned = Test-PathMatchesAnyPattern $relativePath $OwnedPathPattern
  if ($Mode -eq 'Detect') {
    $findings.Add([pscustomobject]@{ path = $relativePath; sha256 = $hash; owned = $owned; action = 'Detected' })
    continue
  }

  $signature = Get-AuthenticodeSignature -LiteralPath $file.FullName
  $publisherMatches = Test-ExpectedPublisher $signature.SignerCertificate $ExpectedPublisher
  $pkcs = $null
  $pkcsError = $null
  if ($signature.Status -ne 'NotSigned') {
    try { $pkcs = Get-AuthenticodePkcsEvidence $file.FullName } catch { $pkcsError = $_.Exception.Message }
  }

  if ($Mode -eq 'PrepareSigning') {
    $action = if ($signature.Status -eq 'Valid') { 'Preserve' } elseif ($signature.Status -eq 'NotSigned' -or ($owned -and $signature.Status -eq 'HashMismatch')) { 'Sign' } else { 'Block' }
    if ($action -eq 'Sign') { $signingPaths.Add($file.FullName) }
    $policyFailures = @(Get-WindowsSignaturePolicyFailures -Mode PrepareSigning -RelativePath $relativePath -Owned $owned `
      -SignatureStatus ([string]$signature.Status) -ExpectedPublisher $publisherMatches -AuthenticodeChainValid ($signature.Status -eq 'Valid') `
      -SignatureDigest $null -Timestamped ($null -ne $signature.TimeStamperCertificate) -TimestampChainValid $false `
      -TimestampType $null -TimestampDigest $null)
  } else {
    $action = 'Verify'
    $raw = Invoke-RawSignToolVerification $file.FullName $relativePath $SignToolPath $RawEvidenceDirectory
    if ($null -ne $pkcsError) { $failures.Add("$relativePath signature evidence could not be decoded: $pkcsError") }
    $baselineEntry = if ($BaselineReportPath) { $baselineByPath[$relativePath] } else { $null }
    $policyFailures = @(Get-WindowsSignaturePolicyFailures -Mode Verify -RelativePath $relativePath -Owned $owned `
      -SignatureStatus ([string]$signature.Status) -ExpectedPublisher $publisherMatches `
      -AuthenticodeChainValid ($raw.valid -and $null -ne $pkcs -and $pkcs.signerChain.valid) `
      -SignatureDigest $(if ($null -ne $pkcs) { $pkcs.signatureDigest } else { $null }) `
      -Timestamped ($null -ne $pkcs -and $null -ne $pkcs.timestamp) `
      -TimestampChainValid ($null -ne $pkcs -and $null -ne $pkcs.timestamp -and $pkcs.timestamp.chain.valid) `
      -TimestampType $(if ($null -ne $pkcs -and $null -ne $pkcs.timestamp) { $pkcs.timestamp.type } else { $null }) `
      -TimestampDigest $(if ($null -ne $pkcs -and $null -ne $pkcs.timestamp) { $pkcs.timestamp.messageImprintDigest } else { $null }) `
      -RequireExpectedPublisherForAll $RequireExpectedPublisherForAll.IsPresent -RequireTimestamp $RequireTimestamp.IsPresent `
      -BaselineAction $(if ($null -ne $baselineEntry) { $baselineEntry.action } else { $null }) `
      -BaselineHash $(if ($null -ne $baselineEntry) { $baselineEntry.sha256 } else { $null }) -CurrentHash $hash `
      -HasBaseline (-not $BaselineReportPath -or $null -ne $baselineEntry))
  }
  foreach ($failure in $policyFailures) { $failures.Add($failure) }

  $findings.Add([pscustomobject]@{
    path = $relativePath; sha256 = $hash; owned = $owned; action = $action
    signatureStatus = [string]$signature.Status; expectedPublisher = $publisherMatches
    signer = if ($null -ne $pkcs) { $pkcs.signer } else { Get-CertificateIdentity $signature.SignerCertificate }
    signerChain = if ($null -ne $pkcs) { $pkcs.signerChain } else { $null }
    signatureDigest = if ($null -ne $pkcs) { $pkcs.signatureDigest } else { $null }
    timestamp = if ($null -ne $pkcs) { $pkcs.timestamp } else { $null }
    rawSignToolEvidence = if ($Mode -eq 'Verify') { $raw.evidencePath } else { $null }
    evidenceError = $pkcsError
  })
}

if ($Mode -eq 'Verify' -and $BaselineReportPath) {
  foreach ($baselinePath in $baselineByPath.Keys) {
    if (-not $currentPaths.Contains($baselinePath)) { $failures.Add("$baselinePath disappeared after the signing inventory was frozen.") }
  }
}

if ($Mode -eq 'PrepareSigning') {
  if (-not $CatalogPath) { throw 'PrepareSigning requires -CatalogPath.' }
  $catalogFullPath = [System.IO.Path]::GetFullPath($CatalogPath)
  $catalogDirectory = Split-Path -Parent $catalogFullPath
  New-Item -ItemType Directory -Path $catalogDirectory -Force | Out-Null
  $catalogLines = @($signingPaths | ForEach-Object { './' + (Get-RelativeUnixPath $catalogDirectory $_) })
  Set-Content -LiteralPath $catalogFullPath -Value $catalogLines -Encoding utf8NoBOM
  if ($catalogLines.Count -eq 0) { throw 'PE inventory produced an empty signing catalog; expected at least Ritemark.exe.' }
}

$report = [ordered]@{
  schemaVersion = 2; generatedAt = [DateTimeOffset]::UtcNow.ToString('o'); mode = $Mode
  root = $resolvedRoot; expectedPublisher = $ExpectedPublisher; portableExecutableCount = $peFiles.Count
  signingTargetCount = $signingPaths.Count; failureCount = $failures.Count; files = @($findings); failures = @($failures)
}
if ($ReportPath) {
  $reportFullPath = [System.IO.Path]::GetFullPath($ReportPath)
  New-Item -ItemType Directory -Path (Split-Path -Parent $reportFullPath) -Force | Out-Null
  $report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $reportFullPath -Encoding utf8NoBOM
}

Write-Host "PE trust ${Mode}: $($peFiles.Count) PE file(s), $($signingPaths.Count) signing target(s), $($failures.Count) failure(s)."
foreach ($failure in $failures) { Write-Host "ERROR: $failure" -ForegroundColor Red }
if ($failures.Count -gt 0) { exit 1 }

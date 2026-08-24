$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$scriptPath = Join-Path $PSScriptRoot 'verify-windows-signatures.ps1'
$fixtureRoot = Join-Path ([System.IO.Path]::GetTempPath()) "ritemark-pe-fixture-$([guid]::NewGuid())"
$detectReport = Join-Path $fixtureRoot 'detect.json'
$prepareReport = Join-Path $fixtureRoot 'prepare.json'
$catalogPath = Join-Path $fixtureRoot 'signing-catalog.txt'
$verifyReport = Join-Path $fixtureRoot 'verify.json'

function Write-PeFixture {
  param([Parameter(Mandatory)][string]$Path)
  $bytes = [byte[]]::new(128)
  $bytes[0] = 0x4d
  $bytes[1] = 0x5a
  [BitConverter]::GetBytes([int]64).CopyTo($bytes, 0x3c)
  $bytes[64] = 0x50
  $bytes[65] = 0x45
  [System.IO.File]::WriteAllBytes($Path, $bytes)
}

try {
  New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
  foreach ($name in 'unsigned.exe','wrong.dll','missing-timestamp.node','extensionless') {
    Write-PeFixture -Path (Join-Path $fixtureRoot $name)
  }
  Set-Content -LiteralPath (Join-Path $fixtureRoot 'not-a-pe.exe') -Value 'plain text'

  & $scriptPath -Mode Detect -Root $fixtureRoot -ReportPath $detectReport
  $detected = Get-Content -LiteralPath $detectReport -Raw | ConvertFrom-Json
  if ($detected.portableExecutableCount -ne 4) {
    throw "Expected four content-detected PEs, got $($detected.portableExecutableCount)."
  }
  $expected = @('extensionless','missing-timestamp.node','unsigned.exe','wrong.dll')
  if ((@($detected.files.path | Sort-Object) -join '|') -ne ($expected -join '|')) {
    throw "PE discovery missed .exe, .dll, .node, or extensionless content."
  }

  $signatureProvider = {
    param($Path)
    $name = [System.IO.Path]::GetFileName($Path)
    switch ($name) {
      'unsigned.exe' {
        [pscustomobject]@{ Status = 'NotSigned'; SignerCertificate = $null; TimeStamperCertificate = $null }
      }
      'wrong.dll' {
        [pscustomobject]@{ Status = 'Valid'; SignerCertificate = [pscustomobject]@{ Subject = 'CN=Wrong Publisher' }; TimeStamperCertificate = [pscustomobject]@{} }
      }
      'missing-timestamp.node' {
        [pscustomobject]@{ Status = 'Valid'; SignerCertificate = [pscustomobject]@{ Subject = 'CN=Productory Services OÜ' }; TimeStamperCertificate = $null }
      }
      default {
        [pscustomobject]@{ Status = 'Valid'; SignerCertificate = [pscustomobject]@{ Subject = 'CN=Productory Services OÜ' }; TimeStamperCertificate = [pscustomobject]@{} }
      }
    }
  }

  & $scriptPath -Mode PrepareSigning -Root $fixtureRoot -CatalogPath $catalogPath `
    -ReportPath $prepareReport -OwnedPathPattern 'unsigned.exe' -SignatureProvider $signatureProvider
  $catalog = @(Get-Content -LiteralPath $catalogPath)
  if ($catalog.Count -ne 1 -or $catalog[0] -notmatch 'unsigned\.exe$') {
    throw "Expected only unsigned.exe in signing catalog, got: $($catalog -join ', ')"
  }
  $prepared = Get-Content -LiteralPath $prepareReport -Raw | ConvertFrom-Json
  $vendor = $prepared.files | Where-Object path -eq 'wrong.dll'
  if ($null -eq $vendor -or $vendor.action -ne 'Preserve') {
    throw 'A valid vendor-signed PE must be preserved rather than re-signed.'
  }

  $failure = $null
  try {
    & $scriptPath -Mode Verify -Root $fixtureRoot -ReportPath $verifyReport -OwnedPathPattern '*' `
      -SignatureProvider $signatureProvider -SignToolVerifier { $true }
  } catch {
    $failure = $_.Exception.Message
  }

  foreach ($expectedFailure in "unsigned.exe signature is 'NotSigned'", "wrong.dll publisher is not 'Productory Services OÜ'", 'missing-timestamp.node is missing an Authenticode timestamp') {
    if (-not $failure.Contains($expectedFailure)) {
      throw "Missing expected verification failure '$expectedFailure'. Actual: $failure"
    }
  }

  Write-Host 'verify-windows-signatures direct requirement tests passed'
} finally {
  if (Test-Path -LiteralPath $fixtureRoot) {
    Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
  }
}

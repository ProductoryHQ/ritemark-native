$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$scriptPath = Join-Path $PSScriptRoot 'verify-windows-signatures.ps1'
. (Join-Path $PSScriptRoot 'windows-signature-policy.ps1')
$fixtureRoot = Join-Path ([System.IO.Path]::GetTempPath()) "ritemark-pe-fixture-$([guid]::NewGuid())"
$reportPath = Join-Path $fixtureRoot 'report.json'

function Write-PeFixture {
  param([Parameter(Mandatory)][string]$Path)

  $bytes = [byte[]]::new(128)
  $bytes[0] = 0x4d
  $bytes[1] = 0x5a
  [BitConverter]::GetBytes([int]64).CopyTo($bytes, 0x3c)
  $bytes[64] = 0x50
  $bytes[65] = 0x45
  $bytes[66] = 0x00
  $bytes[67] = 0x00
  [System.IO.File]::WriteAllBytes($Path, $bytes)
}

try {
  New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
  Write-PeFixture -Path (Join-Path $fixtureRoot 'app.exe')
  Write-PeFixture -Path (Join-Path $fixtureRoot 'native-addon.node')
  Write-PeFixture -Path (Join-Path $fixtureRoot 'extensionless')
  [System.IO.File]::WriteAllText((Join-Path $fixtureRoot 'not-a-pe.exe'), 'plain text')
  [System.IO.File]::WriteAllBytes((Join-Path $fixtureRoot 'mz-only.dll'), [byte[]](0x4d, 0x5a, 0x00, 0x00))

  & $scriptPath -Mode Detect -Root $fixtureRoot -ReportPath $reportPath

  $report = Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
  if ($report.portableExecutableCount -ne 3) {
    throw "Expected 3 PE files, got $($report.portableExecutableCount)."
  }

  $paths = @($report.files.path | Sort-Object)
  $expected = @('app.exe', 'extensionless', 'native-addon.node')
  if (($paths -join '|') -ne ($expected -join '|')) {
    throw "Unexpected PE inventory: $($paths -join ', ')"
  }

  $nativeFinding = $report.files | Where-Object path -eq 'native-addon.node'
  if ($null -eq $nativeFinding) { throw 'Content inventory missed the unsigned native module fixture.' }
  $nativeFailures = @(Get-WindowsSignaturePolicyFailures -Mode Verify -RelativePath $nativeFinding.path -Owned $false `
    -SignatureStatus NotSigned -ExpectedPublisher $false -AuthenticodeChainValid $false -SignatureDigest $null `
    -Timestamped $false -TimestampChainValid $false -TimestampType $null -TimestampDigest $null `
    -RequireTimestamp $true -BaselineAction Sign -BaselineHash $nativeFinding.sha256 -CurrentHash $nativeFinding.sha256)
  if (-not ($nativeFailures -join "`n").Contains("signature is 'NotSigned'")) {
    throw "Unsigned .node fixture did not fail verification policy: $($nativeFailures -join '; ')"
  }

  Write-Host 'verify-windows-signatures fixture test passed'
} finally {
  if (Test-Path -LiteralPath $fixtureRoot) {
    Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
  }
}

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot 'windows-signature-policy.ps1')

function Assert-FailsWith {
  param([Parameter(Mandatory)][hashtable]$Arguments, [Parameter(Mandatory)][string]$ExpectedText)
  $failures = @(Get-WindowsSignaturePolicyFailures @Arguments)
  if ($failures.Count -eq 0 -or -not ($failures -join "`n").Contains($ExpectedText)) {
    throw "Expected policy failure containing '$ExpectedText'; got: $($failures -join '; ')"
  }
}

$valid = @{
  Mode = 'Verify'; RelativePath = 'Ritemark.exe'; Owned = $true; SignatureStatus = 'Valid'
  ExpectedPublisher = $true; AuthenticodeChainValid = $true; SignatureDigest = 'sha256'
  Timestamped = $true; TimestampChainValid = $true; TimestampType = 'RFC3161'; TimestampDigest = 'sha256'
  RequireTimestamp = $true; BaselineAction = 'Sign'; BaselineHash = 'before'; CurrentHash = 'after'; HasBaseline = $true
}
if (@(Get-WindowsSignaturePolicyFailures @valid).Count -ne 0) { throw 'Valid signed-owned policy fixture failed.' }

$wrongPublisher = $valid.Clone(); $wrongPublisher.ExpectedPublisher = $false
Assert-FailsWith -Arguments $wrongPublisher -ExpectedText 'publisher does not equal'

$missingTimestamp = $valid.Clone(); $missingTimestamp.Timestamped = $false
Assert-FailsWith -Arguments $missingTimestamp -ExpectedText 'has no RFC 3161 timestamp'

$unsignedNode = $valid.Clone(); $unsignedNode.RelativePath = 'native/addon.node'; $unsignedNode.Owned = $false
$unsignedNode.SignatureStatus = 'NotSigned'; $unsignedNode.ExpectedPublisher = $false
$unsignedNode.AuthenticodeChainValid = $false; $unsignedNode.SignatureDigest = $null
$unsignedNode.Timestamped = $false; $unsignedNode.TimestampChainValid = $false
$unsignedNode.BaselineAction = 'Sign'
Assert-FailsWith -Arguments $unsignedNode -ExpectedText "signature is 'NotSigned'"

$postSignMutation = $valid.Clone(); $postSignMutation.SignatureStatus = 'HashMismatch'
$postSignMutation.AuthenticodeChainValid = $false
Assert-FailsWith -Arguments $postSignMutation -ExpectedText "signature is 'HashMismatch'"

$preservedMutation = $valid.Clone(); $preservedMutation.RelativePath = 'vendor.dll'; $preservedMutation.Owned = $false
$preservedMutation.BaselineAction = 'Preserve'; $preservedMutation.BaselineHash = 'one'; $preservedMutation.CurrentHash = 'two'
Assert-FailsWith -Arguments $preservedMutation -ExpectedText 'changed after its valid vendor signature was preserved'

Write-Host 'Windows signature policy negative tests passed'

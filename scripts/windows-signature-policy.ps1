Set-StrictMode -Version Latest

function Get-WindowsSignaturePolicyFailures {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][ValidateSet('PrepareSigning', 'Verify')][string]$Mode,
    [Parameter(Mandatory)][string]$RelativePath,
    [Parameter(Mandatory)][bool]$Owned,
    [Parameter(Mandatory)][string]$SignatureStatus,
    [Parameter(Mandatory)][bool]$ExpectedPublisher,
    [Parameter(Mandatory)][bool]$AuthenticodeChainValid,
    [AllowNull()][string]$SignatureDigest,
    [Parameter(Mandatory)][bool]$Timestamped,
    [Parameter(Mandatory)][bool]$TimestampChainValid,
    [AllowNull()][string]$TimestampType,
    [AllowNull()][string]$TimestampDigest,
    [bool]$RequireExpectedPublisherForAll = $false,
    [bool]$RequireTimestamp = $false,
    [AllowNull()][string]$BaselineAction,
    [AllowNull()][string]$BaselineHash,
    [AllowNull()][string]$CurrentHash,
    [bool]$HasBaseline = $true
  )

  $failures = [System.Collections.Generic.List[string]]::new()

  if ($Mode -eq 'PrepareSigning') {
    if ($SignatureStatus -eq 'Valid') { return @() }
    if ($SignatureStatus -eq 'NotSigned' -or ($Owned -and $SignatureStatus -eq 'HashMismatch')) { return @() }
    return @("$RelativePath has invalid pre-existing signature status '$SignatureStatus'.")
  }

  if ($SignatureStatus -ne 'Valid') {
    $failures.Add("$RelativePath signature is '$SignatureStatus', expected Valid.")
  }
  if (-not $AuthenticodeChainValid) {
    $failures.Add("$RelativePath did not pass Authenticode certificate-chain validation.")
  }
  if ([string]::IsNullOrWhiteSpace($SignatureDigest) -or $SignatureDigest.ToLowerInvariant() -ne 'sha256') {
    $failures.Add("$RelativePath signature digest '$SignatureDigest' is not SHA-256.")
  }
  if (-not $HasBaseline) {
    $failures.Add("$RelativePath appeared after the signing inventory was frozen.")
  }
  if ($BaselineAction -eq 'Preserve' -and $BaselineHash -ne $CurrentHash) {
    $failures.Add("$RelativePath changed after its valid vendor signature was preserved.")
  }

  $mustUseExpectedPublisher = $RequireExpectedPublisherForAll -or $Owned -or $BaselineAction -eq 'Sign'
  if ($mustUseExpectedPublisher -and -not $ExpectedPublisher) {
    $failures.Add("$RelativePath publisher does not equal the expected Productory publisher.")
  }

  $mustHaveTimestamp = $RequireTimestamp -and $mustUseExpectedPublisher
  if ($mustHaveTimestamp) {
    if (-not $Timestamped) {
      $failures.Add("$RelativePath has no RFC 3161 timestamp.")
    } else {
      if ($TimestampType -ne 'RFC3161') {
        $failures.Add("$RelativePath timestamp type '$TimestampType' is not RFC3161.")
      }
      if ([string]::IsNullOrWhiteSpace($TimestampDigest) -or $TimestampDigest.ToLowerInvariant() -ne 'sha256') {
        $failures.Add("$RelativePath RFC 3161 timestamp digest '$TimestampDigest' is not SHA-256.")
      }
      if (-not $TimestampChainValid) {
        $failures.Add("$RelativePath RFC 3161 timestamp certificate chain is invalid.")
      }
    }
  }

  return @($failures)
}

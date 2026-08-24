$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$scriptPath = Join-Path $PSScriptRoot 'windows-build-contract.ps1'

function Assert-ThrowsContaining {
  param([Parameter(Mandatory)][scriptblock]$Action, [Parameter(Mandatory)][string]$ExpectedText)
  $threw = $false
  $actualMessage = $null
  try {
    & $Action
  } catch {
    $threw = $true
    $actualMessage = $_.Exception.Message
  }
  if (-not $threw) {
    throw "Expected failure containing '$ExpectedText', but the command passed."
  }
  if (-not $actualMessage.Contains($ExpectedText)) {
    throw "Expected failure containing '$ExpectedText'; got '$actualMessage'."
  }
}

Assert-ThrowsContaining -ExpectedText 'missing required secret' -Action {
  & $scriptPath -BuildMode signed-canary -Version 1.10.0 -RefType branch -RefName test -RunId 1
}

Assert-ThrowsContaining -ExpectedText 'exact tag' -Action {
  & $scriptPath -BuildMode release -Version 1.10.0 -RefType tag -RefName v1.9.0 `
    -TenantId tenant -ClientId client -ClientSecret secret
}

Assert-ThrowsContaining -ExpectedText 'Tag refs may run only' -Action {
  & $scriptPath -BuildMode unsigned-canary -Version 1.10.0 -RefType tag -RefName v1.10.0
}

$noThrowAssertionFailed = $false
try {
  Assert-ThrowsContaining -ExpectedText 'must throw' -Action { $null = 1 + 1 }
} catch {
  $noThrowAssertionFailed = $_.Exception.Message.Contains('but the command passed')
}
if (-not $noThrowAssertionFailed) { throw 'Assert-ThrowsContaining accepted an action that did not throw.' }

$canary = & $scriptPath -BuildMode signed-canary -Version 1.10.0 -RefType branch -RefName test -RunId 42 `
  -TenantId tenant -ClientId client -ClientSecret secret | ConvertFrom-Json
if ($canary.isRelease -or -not $canary.shouldSign -or $canary.installerBase -notmatch 'SIGNED-CANARY-NON-RELEASE') {
  throw 'Signed canary contract output is unsafe.'
}

Write-Host 'Windows build contract negative tests passed'

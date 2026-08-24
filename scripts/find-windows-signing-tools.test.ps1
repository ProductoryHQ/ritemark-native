$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$scriptPath = Join-Path $PSScriptRoot 'find-windows-signing-tools.ps1'
$root = Join-Path ([System.IO.Path]::GetTempPath()) "ritemark-signing-tools-$([guid]::NewGuid())"

try {
  $sdk = Join-Path $root 'sdk'
  $client = Join-Path $root 'client/Microsoft.ArtifactSigning.Client.1.2.3/bin/x64'
  foreach ($version in '10.0.22621.0', '10.0.26100.0', '10.0.99999-preview') {
    $directory = Join-Path $sdk "$version/x64"
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $directory 'signtool.exe') -Value "fixture-$version"
  }
  New-Item -ItemType Directory -Path $client -Force | Out-Null
  Set-Content -LiteralPath (Join-Path $client 'Azure.CodeSigning.Dlib.dll') -Value 'fixture'

  $result = & $scriptPath -SdkBinRoot $sdk -ArtifactSigningClientRoot (Join-Path $root 'client') | ConvertFrom-Json
  if ($result.windowsSdkVersion -ne '10.0.26100.0') {
    throw "Expected semantic SDK directory 10.0.26100.0, got $($result.windowsSdkVersion)."
  }
  if ($result.signToolPath -notmatch '10\.0\.26100\.0') { throw 'Selected SignTool path does not match SDK version.' }
  if ($result.artifactSigningClientPackage -ne 'Microsoft.ArtifactSigning.Client.1.2.3') {
    throw "Unexpected package evidence: $($result.artifactSigningClientPackage)"
  }

  Write-Host 'Windows signing-tool selection test passed'
} finally {
  if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
}

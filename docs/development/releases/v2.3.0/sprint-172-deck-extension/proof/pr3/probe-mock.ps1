param([string]$Probe, [string]$Root)
# Sprint 172 PR 3 proof (results: probe-mock-results.txt). Run with pwsh on a
# copy of scripts/windows-standard-user-registry-probe.ps1 whose
# WindowsIdentity line is replaced by a string (macOS has none):
#   pwsh -File probe-mock.ps1 -Probe <copy> -Root <empty scratch folder>
# Runs the registry probe on macOS against a mock HKCU: a FileSystem drive where
# keys are folders, a key's default value is the file "(default)" in it, and a
# named value is a file of that name. Get-Item, Get-ChildItem and
# Get-ItemProperty are shadowed for the probe.
$ErrorActionPreference = 'Stop'

function global:Get-Item {
  param([string]$LiteralPath, $ErrorAction)
  $o = [pscustomobject]@{ P = $LiteralPath }
  $o | Add-Member ScriptMethod GetValue {
    param($n)
    $f = Join-Path $this.P '(default)'
    if (Test-Path $f) { Microsoft.PowerShell.Management\Get-Content -Raw $f } else { $null }
  }
  $o | Add-Member ScriptMethod GetValueNames {
    @(Microsoft.PowerShell.Management\Get-ChildItem -LiteralPath $this.P -File | ForEach-Object { $_.Name })
  }
  $o
}
function global:Get-ChildItem { param([string]$LiteralPath, $ErrorAction)
  if ($global:MockRegistered) { [pscustomobject]@{ PSChildName = '{B8F5E4A2}_is1'; PSPath = 'x' } } }
function global:Get-ItemProperty { param([string]$LiteralPath, $ErrorAction)
  [pscustomobject]@{ DisplayName = "Ritemark $env:RITEMARK_CI_VERSION"; Publisher = 'P'; DisplayVersion = $env:RITEMARK_CI_VERSION } }

function Set-Key($path, $value, $name = '(default)') {
  New-Item -ItemType Directory -Force "HKCU:\Software\Classes\$path" | Out-Null
  Set-Content -NoNewline -LiteralPath "HKCU:\Software\Classes\$path\$name" -Value $value
}

# case = mode, version, what the install wrote
$cases = @(
  @('good', 'verify-installed', '2.3.0', 'all'),
  @('no-icon-file', 'verify-installed', '2.3.0', 'no-icon'),
  @('wrong-command', 'verify-installed', '2.3.0', 'wrong-command'),
  @('no-open-with', 'verify-installed', '2.3.0', 'no-open-with'),
  @('missing-2.3', 'verify-installed', '2.3.0', 'none'),
  @('old-2.2-none', 'verify-installed', '2.2.0', 'none'),
  @('old-2.2-written', 'verify-installed', '2.2.0', 'all'),
  @('old-2.2-broken', 'verify-installed', '2.2.0', 'wrong-command'),
  @('gone', 'verify-uninstalled', '2.3.0', 'none'),
  @('leftover', 'verify-uninstalled', '2.2.0', 'all')
)
foreach ($c in $cases) {
  $case, $mode, $version, $wrote = $c
  $dir = Join-Path $Root $case
  $hk = Join-Path $dir 'hkcu'
  $app = Join-Path $dir 'app'
  New-Item -ItemType Directory -Force $hk, (Join-Path $app 'resources') | Out-Null
  New-Item -ItemType Directory -Force (Join-Path $hk 'Software/Microsoft/Windows/CurrentVersion/Uninstall') | Out-Null
  if (Get-PSDrive HKCU -ErrorAction SilentlyContinue) { Remove-PSDrive HKCU -Force }
  New-PSDrive -Name HKCU -PSProvider FileSystem -Root $hk -Scope Global | Out-Null
  $global:MockRegistered = $mode -eq 'verify-installed'
  if ($wrote -ne 'none') {
    if ($wrote -ne 'no-icon') { Set-Content (Join-Path $app 'resources/deck.ico') 'x' }
    Set-Key '.rtms' 'Ritemark.rtms'
    if ($wrote -ne 'no-open-with') { Set-Key '.rtms\OpenWithProgids' '' 'Ritemark.rtms' }
    Set-Key 'Ritemark.rtms' 'Ritemark Deck'
    Set-Key 'Ritemark.rtms\DefaultIcon' "$app\resources\deck.ico"
    $exe = if ($wrote -eq 'wrong-command') { 'Code.exe' } else { 'Ritemark.exe' }
    Set-Key 'Ritemark.rtms\shell\open\command' ('"' + "$app\$exe" + '" "%1"')
  }
  $env:RITEMARK_CI_INSTALL_ROOT = $app
  $env:RITEMARK_CI_REGISTRY_MODE = $mode
  $env:RITEMARK_CI_REGISTRY_RESULT = Join-Path $dir 'result.json'
  $env:RITEMARK_CI_VERSION = $version
  $env:RITEMARK_CI_PUBLISHER = 'P'
  try {
    $out = & $Probe 6>&1 | Where-Object { "$_" -like 'The deck file type*' }
    "CASE ${case}: passed. $out"
  } catch {
    "CASE ${case}: threw: $($_.Exception.Message)"
  }
}

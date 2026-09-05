param()

$ErrorActionPreference = 'Stop'

$mode = $env:RITEMARK_CI_REGISTRY_MODE
$resultPath = $env:RITEMARK_CI_REGISTRY_RESULT
$expectedPublisher = $env:RITEMARK_CI_PUBLISHER
$expectedVersion = $env:RITEMARK_CI_VERSION
$uninstallRoot = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
$canaryKey = Join-Path $uninstallRoot 'RitemarkCiCanary'

if ([string]::IsNullOrWhiteSpace($resultPath)) {
  throw 'RITEMARK_CI_REGISTRY_RESULT is required.'
}

function Get-RitemarkRegistrations {
  if (-not (Test-Path -LiteralPath $uninstallRoot)) { return @() }

  return @(Get-ChildItem -LiteralPath $uninstallRoot -ErrorAction Stop | ForEach-Object {
    $registration = Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction Stop
    if ($registration.DisplayName -eq 'Ritemark') {
      [pscustomobject]@{
        KeyName = $_.PSChildName
        Path = $_.PSPath
        DisplayName = [string]$registration.DisplayName
        Publisher = [string]$registration.Publisher
        DisplayVersion = [string]$registration.DisplayVersion
      }
    }
  })
}

switch ($mode) {
  'seed-canary' {
    New-Item -Path $canaryKey -Force | Out-Null
    New-ItemProperty -Path $canaryKey -Name DisplayName -Value 'Ritemark' -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $canaryKey -Name Publisher -Value $expectedPublisher -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $canaryKey -Name DisplayVersion -Value $expectedVersion -PropertyType String -Force | Out-Null
  }
  'remove-canary' {
    if (Test-Path -LiteralPath $canaryKey) {
      Remove-Item -LiteralPath $canaryKey -Recurse -Force
    }
  }
  'verify-installed' {
    $registrations = @(Get-RitemarkRegistrations)
    if ($registrations.Count -ne 1) {
      throw "Expected exactly one Ritemark registration for the current user, found $($registrations.Count)."
    }
    if ($registrations[0].Publisher -ne $expectedPublisher -or
        $registrations[0].DisplayVersion -ne $expectedVersion) {
      throw 'Installed ProductName, Publisher, or Version is incorrect.'
    }
  }
  'verify-uninstalled' {
    $registrations = @(Get-RitemarkRegistrations)
    if ($registrations.Count -ne 0) {
      throw "Uninstall left $($registrations.Count) Ritemark registration(s) for the current user."
    }
  }
  default {
    throw "Unsupported RITEMARK_CI_REGISTRY_MODE: $mode"
  }
}

$registrations = @(Get-RitemarkRegistrations)
$result = [ordered]@{
  Mode = $mode
  Identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  Count = $registrations.Count
  KeyNames = @($registrations | ForEach-Object { $_.KeyName })
}

$result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $resultPath -Encoding utf8NoBOM
$result | ConvertTo-Json -Depth 4

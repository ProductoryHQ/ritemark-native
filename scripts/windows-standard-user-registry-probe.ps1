param()

$ErrorActionPreference = 'Stop'

$mode = $env:RITEMARK_CI_REGISTRY_MODE
$resultPath = $env:RITEMARK_CI_REGISTRY_RESULT
$expectedPublisher = $env:RITEMARK_CI_PUBLISHER
$expectedVersion = $env:RITEMARK_CI_VERSION
$expectedDisplayName = "Ritemark $expectedVersion"
$uninstallRoot = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
$canaryKey = Join-Path $uninstallRoot 'RitemarkCiCanary'
# Set by the install round trip only: the folder the installer was given. With
# it, the probe also checks the deck file type (.rtms, Sprint 172), which every
# install registers. The canary's synthetic registration leaves it unset.
$installRoot = $env:RITEMARK_CI_INSTALL_ROOT
$deckExtensionKey = 'HKCU:\Software\Classes\.rtms'
$deckProgIdKey = 'HKCU:\Software\Classes\Ritemark.rtms'
$verifyAssociations = $env:RITEMARK_CI_VERIFY_ASSOCIATIONS -eq '1'
$associationDefaults = [ordered]@{
  '.rtms' = 'Ritemark.rtms'
  '.md' = 'Ritemark.md'
  '.markdown' = 'Ritemark.md'
}
$otherProgId = 'Other.md'
# Every installer from 2.3.0 on must register it. An earlier one (a preserved
# installer replayed by the canary, or a build before the release's version
# bump) is checked only if it wrote the keys; the harness may move ahead of a
# product source without failing it (D1). After any uninstall, nothing is left.
$deckFileTypeSince = [version]'2.3.0'
$deckFileTypeRequired = $false
if ($expectedVersion -match '^(\d+)\.(\d+)\.(\d+)') {
  $deckFileTypeRequired = [version]"$($Matches[1]).$($Matches[2]).$($Matches[3])" -ge $deckFileTypeSince
}

if ([string]::IsNullOrWhiteSpace($resultPath)) {
  throw 'RITEMARK_CI_REGISTRY_RESULT is required.'
}

function Get-RitemarkRegistrations {
  if (-not (Test-Path -LiteralPath $uninstallRoot)) { return @() }

  return @(Get-ChildItem -LiteralPath $uninstallRoot -ErrorAction Stop | ForEach-Object {
    $registration = Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction Stop
    if ($registration.DisplayName -eq 'Ritemark' -or $registration.DisplayName -like 'Ritemark *') {
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

function Get-DefaultRegistryValue([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return $null }
  return (Get-Item -LiteralPath $path -ErrorAction Stop).GetValue('')
}

function Get-DeckFileType {
  $icon = Get-DefaultRegistryValue "$deckProgIdKey\DefaultIcon"
  $openWith = "$deckExtensionKey\OpenWithProgids"
  return [ordered]@{
    ExtensionKey = Test-Path -LiteralPath $deckExtensionKey
    ProgIdKey = Test-Path -LiteralPath $deckProgIdKey
    ProgId = Get-DefaultRegistryValue $deckExtensionKey
    InOpenWith = (Test-Path -LiteralPath $openWith) -and
      (@((Get-Item -LiteralPath $openWith -ErrorAction Stop).GetValueNames()) -contains 'Ritemark.rtms')
    Name = Get-DefaultRegistryValue $deckProgIdKey
    Icon = $icon
    IconFileExists = (-not [string]::IsNullOrWhiteSpace($icon)) -and (Test-Path -LiteralPath $icon -PathType Leaf)
    OpenCommand = Get-DefaultRegistryValue "$deckProgIdKey\shell\open\command"
  }
}

switch ($mode) {
  'seed-canary' {
    New-Item -Path $canaryKey -Force | Out-Null
    New-ItemProperty -Path $canaryKey -Name DisplayName -Value $expectedDisplayName -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $canaryKey -Name Publisher -Value $expectedPublisher -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $canaryKey -Name DisplayVersion -Value $expectedVersion -PropertyType String -Force | Out-Null
  }
  'remove-canary' {
    if (Test-Path -LiteralPath $canaryKey) {
      Remove-Item -LiteralPath $canaryKey -Recurse -Force
    }
  }
  'verify-installed' {}
  'verify-uninstalled' {}
  'replace-association-defaults' {
    New-Item -Path "HKCU:\Software\Classes\$otherProgId" -Value 'Other editor' -Force | Out-Null
    foreach ($extension in $associationDefaults.Keys) {
      Set-Item -LiteralPath "HKCU:\Software\Classes\$extension" -Value $otherProgId
    }
  }
  'verify-replacement-defaults' {}
  default {
    throw "Unsupported RITEMARK_CI_REGISTRY_MODE: $mode"
  }
}

$registrations = @(Get-RitemarkRegistrations)
$deckFileType = if ([string]::IsNullOrWhiteSpace($installRoot)) { $null } else { Get-DeckFileType }
$defaults = [ordered]@{}
if ($verifyAssociations) {
  foreach ($extension in $associationDefaults.Keys) {
    $defaults[$extension] = Get-DefaultRegistryValue "HKCU:\Software\Classes\$extension"
  }
}
$result = [ordered]@{
  Mode = $mode
  Identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  Count = $registrations.Count
  KeyNames = @($registrations | ForEach-Object { $_.KeyName })
  DisplayNames = @($registrations | ForEach-Object { $_.DisplayName })
  Publishers = @($registrations | ForEach-Object { $_.Publisher })
  DisplayVersions = @($registrations | ForEach-Object { $_.DisplayVersion })
  DeckFileType = $deckFileType
  AssociationDefaults = $defaults
}

$result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $resultPath -Encoding utf8NoBOM
$result | ConvertTo-Json -Depth 4

if ($mode -eq 'verify-installed') {
  if ($registrations.Count -ne 1) {
    throw "Expected exactly one Ritemark registration for the current user, found $($registrations.Count)."
  }
  if ($registrations[0].DisplayName -ne $expectedDisplayName -or
      $registrations[0].Publisher -ne $expectedPublisher -or
      $registrations[0].DisplayVersion -ne $expectedVersion) {
    throw "Installed registration does not match DisplayName '$expectedDisplayName', Publisher '$expectedPublisher', and DisplayVersion '$expectedVersion'."
  }
}

if (($mode -in 'verify-uninstalled', 'verify-replacement-defaults') -and $registrations.Count -ne 0) {
  throw "Uninstall left $($registrations.Count) Ritemark registration(s) for the current user."
}

if ($null -ne $deckFileType) {
  $root = $installRoot.TrimEnd('\')
  $written = $deckFileType.ExtensionKey -or $deckFileType.ProgIdKey
  if ($mode -eq 'verify-installed' -and -not $deckFileTypeRequired -and -not $written) {
    Write-Host "The deck file type is not checked: this $expectedVersion installer predates it ($deckFileTypeSince) and wrote no .rtms keys."
  } elseif ($mode -eq 'verify-installed') {
    $expectedIcon = "$root\resources\deck.ico"
    $expectedCommand = '"' + "$root\Ritemark.exe" + '" "%1"'
    if ($deckFileType.ProgId -ne 'Ritemark.rtms') {
      throw "HKCU .rtms names '$($deckFileType.ProgId)', expected 'Ritemark.rtms'."
    }
    if (-not $deckFileType.InOpenWith) {
      throw "HKCU .rtms\OpenWithProgids does not list Ritemark.rtms."
    }
    if ($deckFileType.Name -ne 'Ritemark Deck') {
      throw "Ritemark.rtms is named '$($deckFileType.Name)', expected 'Ritemark Deck'."
    }
    if ($deckFileType.Icon -ine $expectedIcon -or -not $deckFileType.IconFileExists) {
      throw "Ritemark.rtms DefaultIcon is '$($deckFileType.Icon)' (file present: $($deckFileType.IconFileExists)), expected the installed '$expectedIcon'."
    }
    if ($deckFileType.OpenCommand -ine $expectedCommand) {
      throw "Ritemark.rtms opens with '$($deckFileType.OpenCommand)', expected '$expectedCommand'."
    }
    Write-Host "The deck file type is registered: .rtms -> Ritemark.rtms 'Ritemark Deck', icon $expectedIcon, open $expectedCommand"
  }
  if ($mode -eq 'verify-uninstalled') {
    if ($written) {
      throw "Uninstall left the deck file type behind (.rtms key: $($deckFileType.ExtensionKey), Ritemark.rtms key: $($deckFileType.ProgIdKey))."
    }
    Write-Host 'The deck file type is gone: no .rtms or Ritemark.rtms key for the current user.'
  }
}

if ($verifyAssociations) {
  foreach ($extension in $associationDefaults.Keys) {
    $expected = switch ($mode) {
      'verify-installed' { $associationDefaults[$extension] }
      'replace-association-defaults' { $otherProgId }
      'verify-replacement-defaults' { $otherProgId }
    }
    if ($defaults[$extension] -ne $expected) {
      throw "HKCU $extension names '$($defaults[$extension])', expected '$expected' in $mode."
    }
  }
  if ($mode -in 'verify-uninstalled', 'verify-replacement-defaults') {
    if ($deckFileType.ProgIdKey -or $deckFileType.InOpenWith -or
        (Test-Path -LiteralPath 'HKCU:\Software\Classes\Ritemark.md')) {
      throw 'Uninstall left a Ritemark file association registration behind.'
    }
  }
}

[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string]$InstallerPath,

  [Parameter(Mandatory)]
  [string]$SignatureVerifierPath,

  [Parameter(Mandatory)]
  [string]$RegistryProbePath,

  [Parameter(Mandatory)]
  [string]$SignToolPath,

  [Parameter(Mandatory)]
  [string]$ExpectedPublisher,

  [Parameter(Mandatory)]
  [string]$ExpectedVersion,

  [Parameter(Mandatory)]
  [string]$EvidenceDirectory,

  # The update case, optional: install this earlier release first, then
  # InstallerPath over it, as a person updating does. Nothing the new release
  # does not ship may be left behind (Sprint 136: 1.14's unpacked node_modules
  # stopped 2.0's extension host).
  [string]$PreviousInstallerPath,

  [string]$PreviousInstallerSha256,

  # Optional: scripts/verify-windows-app-starts.ps1, run after the fresh
  # install and after the update.
  [string]$AppStartVerifierPath
)

$ErrorActionPreference = 'Stop'

$previousInstaller = $null
if (-not [string]::IsNullOrWhiteSpace($PreviousInstallerPath)) {
  if ($PreviousInstallerSha256 -notmatch '^[0-9a-fA-F]{64}$') {
    throw 'PreviousInstallerSha256 must be the exact SHA-256 of the previous release''s installer.'
  }
  $previousInstaller = (Resolve-Path -LiteralPath $PreviousInstallerPath).Path
  $previousInstallerSha = (Get-FileHash -LiteralPath $previousInstaller -Algorithm SHA256).Hash
  if ($previousInstallerSha -ine $PreviousInstallerSha256) {
    throw "Previous installer SHA-256 mismatch (got '$previousInstallerSha', expected '$PreviousInstallerSha256')."
  }
}
$appStartVerifier = $null
if (-not [string]::IsNullOrWhiteSpace($AppStartVerifierPath)) {
  $appStartVerifier = (Resolve-Path -LiteralPath $AppStartVerifierPath).Path
}

$installer = (Resolve-Path -LiteralPath $InstallerPath).Path
$signatureVerifier = (Resolve-Path -LiteralPath $SignatureVerifierPath).Path
$registryProbeSource = (Resolve-Path -LiteralPath $RegistryProbePath).Path
$signTool = (Resolve-Path -LiteralPath $SignToolPath).Path
$evidenceRoot = [System.IO.Path]::GetFullPath($EvidenceDirectory)
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null

& $signatureVerifier `
  -Mode Verify `
  -Root (Split-Path -Parent $installer) `
  -SignToolPath $signTool `
  -ExpectedPublisher $ExpectedPublisher `
  -OwnedPathPattern ([System.IO.Path]::GetFileName($installer))

$runIdentity = [string]$env:GITHUB_RUN_ID
if ([string]::IsNullOrWhiteSpace($runIdentity)) {
  $runIdentity = [guid]::NewGuid().ToString('N').Substring(0, 12)
}
$runIdSuffix = if ($runIdentity.Length -gt 15) {
  $runIdentity.Substring($runIdentity.Length - 15)
} else {
  $runIdentity
}
$userName = "rmci-$runIdSuffix"
if ($userName.Length -gt 20) {
  throw "Generated Windows test username exceeds 20 characters: $userName"
}

$plainPassword = "Ritemark!$([guid]::NewGuid().ToString('N'))"
$securePassword = ConvertTo-SecureString $plainPassword -AsPlainText -Force
$credential = [pscredential]::new("$env:COMPUTERNAME\$userName", $securePassword)
$profileRoot = $null
$userEvidence = $null
$installLog = $null
$uninstallLog = $null
$previousInstallLog = $null
$updateInstallLog = $null
$updateUninstallLog = $null

New-LocalUser -Name $userName -Password $securePassword -AccountNeverExpires | Out-Null
try {
  $initializeProfile = Start-Process -FilePath 'cmd.exe' -Credential $credential -LoadUserProfile `
    -WorkingDirectory $env:SystemRoot -ArgumentList '/c','exit 0' -Wait -PassThru
  if ($initializeProfile.ExitCode -ne 0) {
    throw 'Could not initialize the standard-user profile.'
  }

  $profileRoot = "C:\Users\$userName"
  if (-not (Test-Path -LiteralPath $profileRoot -PathType Container)) {
    throw "Standard-user profile was not created at $profileRoot."
  }

  $installRoot = Join-Path $profileRoot 'AppData\Local\Programs\Ritemark'
  $localAppData = Join-Path $profileRoot 'AppData\Local'
  $roamingAppData = Join-Path $profileRoot 'AppData\Roaming'
  $userTemp = Join-Path $localAppData 'Temp'
  $stagedInstaller = Join-Path $profileRoot 'Ritemark-Setup.exe'
  $installLog = Join-Path $profileRoot 'Ritemark-install.log'
  $uninstallLog = Join-Path $profileRoot 'Ritemark-uninstall.log'
  $environmentProbeScript = Join-Path $profileRoot 'Ritemark-Ci-Environment-Probe.ps1'
  $environmentProbeResult = Join-Path $profileRoot 'Ritemark-Ci-Environment-Probe.json'
  $registryProbeScript = Join-Path $profileRoot 'Ritemark-Ci-Registry-Probe.ps1'
  $userEvidence = Join-Path $profileRoot 'Ritemark-Ci-Evidence'
  New-Item -ItemType Directory -Path $userTemp -Force | Out-Null
  New-Item -ItemType Directory -Path $userEvidence -Force | Out-Null

  # The hosted runner workspace is owned by the runner account and is not
  # guaranteed to be readable by a newly-created standard user. Stage the exact
  # signed bytes and the reviewed probe inside the user's own profile first.
  Copy-Item -LiteralPath $installer -Destination $stagedInstaller
  Copy-Item -LiteralPath $registryProbeSource -Destination $registryProbeScript
  $originalInstallerSha = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash
  $stagedInstallerSha = (Get-FileHash -LiteralPath $stagedInstaller -Algorithm SHA256).Hash
  if ($stagedInstallerSha -ne $originalInstallerSha) {
    throw 'Standard-user installer staging changed the signed installer bytes.'
  }

  # Start-Process inherits the runner administrator's environment even with
  # -Credential and -LoadUserProfile. Supply the full standard-user boundary.
  $userProcessEnvironment = @{
    USERNAME = $userName
    USERDOMAIN = $env:COMPUTERNAME
    USERPROFILE = $profileRoot
    HOMEDRIVE = 'C:'
    HOMEPATH = "\Users\$userName"
    LOCALAPPDATA = $localAppData
    APPDATA = $roamingAppData
    TEMP = $userTemp
    TMP = $userTemp
    RITEMARK_CI_INSTALLER = $stagedInstaller
    RITEMARK_CI_PROBE = $environmentProbeResult
    RITEMARK_CI_PUBLISHER = $ExpectedPublisher
    RITEMARK_CI_VERSION = $ExpectedVersion
  }

  function Write-ChildProcessDiagnostics([string]$label, [string]$stdoutPath, [string]$stderrPath) {
    foreach ($entry in @(
      @{ Name = 'stdout'; Path = $stdoutPath },
      @{ Name = 'stderr'; Path = $stderrPath }
    )) {
      if (Test-Path -LiteralPath $entry.Path) {
        Write-Host "--- $label $($entry.Name) ---"
        Get-Content -LiteralPath $entry.Path -Encoding oem | ForEach-Object { Write-Host $_ }
      }
    }
  }

  function Invoke-UserProcess {
    param(
      [Parameter(Mandatory)][string]$Label,
      [Parameter(Mandatory)][string]$FilePath,
      [Parameter(Mandatory)][string[]]$ArgumentList,
      [Parameter(Mandatory)][hashtable]$Environment
    )

    $safeLabel = $Label -replace '[^A-Za-z0-9_.-]', '-'
    $stdoutPath = Join-Path $userEvidence "$safeLabel.stdout.log"
    $stderrPath = Join-Path $userEvidence "$safeLabel.stderr.log"
    Remove-Item -LiteralPath $stdoutPath,$stderrPath -Force -ErrorAction SilentlyContinue
    $process = Start-Process -FilePath $FilePath `
      -Credential $credential -LoadUserProfile -WorkingDirectory $profileRoot `
      -Environment $Environment -ArgumentList $ArgumentList `
      -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath `
      -Wait -PassThru
    Write-ChildProcessDiagnostics $Label $stdoutPath $stderrPath
    return $process
  }

  # Prove identity, environment, working directory, write access, and the exact
  # installer bytes from inside the alternate-user process before installation.
  $environmentProbeContents = @'
$ErrorActionPreference = 'Stop'
[ordered]@{
  Identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  WorkingDirectory = (Get-Location).Path
  UserName = $env:USERNAME
  UserProfile = $env:USERPROFILE
  LocalAppData = $env:LOCALAPPDATA
  AppData = $env:APPDATA
  Temp = $env:TEMP
  Tmp = $env:TMP
  InstallerSha256 = (Get-FileHash -LiteralPath $env:RITEMARK_CI_INSTALLER -Algorithm SHA256).Hash
} | ConvertTo-Json | Set-Content -LiteralPath $env:RITEMARK_CI_PROBE -Encoding utf8NoBOM
'@
  Set-Content -LiteralPath $environmentProbeScript -Value $environmentProbeContents -Encoding utf8NoBOM

  $environmentProbe = Invoke-UserProcess `
    -Label 'environment-probe' `
    -FilePath (Join-Path $PSHOME 'pwsh.exe') `
    -Environment $userProcessEnvironment `
    -ArgumentList '-NoLogo','-NoProfile','-NonInteractive','-File',$environmentProbeScript
  if ($environmentProbe.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $environmentProbeResult)) {
    throw "Standard-user environment probe failed ($($environmentProbe.ExitCode))."
  }
  Copy-Item -LiteralPath $environmentProbeResult `
    -Destination (Join-Path $userEvidence 'environment-probe.result.json') -Force

  $probe = Get-Content -LiteralPath $environmentProbeResult -Raw | ConvertFrom-Json
  $expectedProbe = [ordered]@{
    Identity = "$env:COMPUTERNAME\$userName"
    WorkingDirectory = $profileRoot
    UserName = $userName
    UserProfile = $profileRoot
    LocalAppData = $localAppData
    AppData = $roamingAppData
    Temp = $userTemp
    Tmp = $userTemp
    InstallerSha256 = $originalInstallerSha
  }
  foreach ($name in $expectedProbe.Keys) {
    if ([string]$probe.$name -ine [string]$expectedProbe[$name]) {
      throw "Standard-user environment probe mismatch for $name (got '$($probe.$name)', expected '$($expectedProbe[$name])')."
    }
  }

  # HKCU must be inspected inside the same proven standard-user boundary.
  function Invoke-RegistryProbe([string]$mode) {
    $resultPath = Join-Path $profileRoot "Ritemark-Ci-Registry-$mode.json"
    Remove-Item -LiteralPath $resultPath -Force -ErrorAction SilentlyContinue
    $userProcessEnvironment.RITEMARK_CI_REGISTRY_MODE = $mode
    $userProcessEnvironment.RITEMARK_CI_REGISTRY_RESULT = $resultPath
    $registryProbe = Invoke-UserProcess `
      -Label "registry-$mode" `
      -FilePath (Join-Path $PSHOME 'pwsh.exe') `
      -Environment $userProcessEnvironment `
      -ArgumentList '-NoLogo','-NoProfile','-NonInteractive','-File',$registryProbeScript
    if ($registryProbe.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $resultPath)) {
      throw "Standard-user registry probe '$mode' failed ($($registryProbe.ExitCode))."
    }
    Copy-Item -LiteralPath $resultPath `
      -Destination (Join-Path $userEvidence "registry-$mode.result.json") -Force
    $result = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
    if ([string]$result.Identity -ine "$env:COMPUTERNAME\$userName") {
      throw "Registry probe '$mode' ran as '$($result.Identity)' instead of the standard user."
    }
    return $result
  }

  $install = Invoke-UserProcess `
    -Label 'installer' `
    -FilePath $stagedInstaller `
    -Environment $userProcessEnvironment `
    -ArgumentList @(
      '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-', '/CURRENTUSER',
      "/DIR=$installRoot", "/LOG=$installLog"
    )
  if ($install.ExitCode -ne 0) {
    if (Test-Path -LiteralPath $installLog) {
      Write-Host '--- Inno Setup install log ---'
      Get-Content -LiteralPath $installLog
    }
    throw "Standard-user silent install failed ($($install.ExitCode))."
  }

  & $signatureVerifier `
    -Mode Verify `
    -Root $installRoot `
    -SignToolPath $signTool `
    -ExpectedPublisher $ExpectedPublisher `
    -OwnedPathPattern 'Ritemark.exe','unins*.exe'

  $startMenu = Join-Path $profileRoot 'AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Ritemark'
  $appLinks = @(Get-ChildItem -LiteralPath $startMenu -Filter 'Ritemark.lnk' -File -ErrorAction Stop)
  if ($appLinks.Count -ne 1) {
    throw "Expected one Ritemark Start menu entry, found $($appLinks.Count)."
  }
  $installedRegistration = Invoke-RegistryProbe 'verify-installed'
  Write-Host "Verified $($installedRegistration.Count) current-user Ritemark registration after install."

  # Every file of a fresh install, relative to the install folder; Inno's own
  # uninstaller files are not the app's.
  function Get-InstalledFiles {
    $prefix = $installRoot.TrimEnd('\') + '\'
    @(Get-ChildItem -LiteralPath $installRoot -Recurse -File -Force |
      ForEach-Object { $_.FullName.Substring($prefix.Length) } |
      Where-Object { $_ -notmatch '^unins\d+\.(exe|dat|msg)$' })
  }
  $freshFiles = [System.Collections.Generic.HashSet[string]]::new(
    [string[]](Get-InstalledFiles), [System.StringComparer]::OrdinalIgnoreCase)
  Write-Host "A fresh install holds $($freshFiles.Count) files."
  if ($appStartVerifier) {
    & $appStartVerifier -AppRoot $installRoot -EvidenceDirectory (Join-Path $evidenceRoot 'fresh-app-start')
  }

  $uninstaller = Get-ChildItem -LiteralPath $installRoot -Filter 'unins*.exe' -File | Select-Object -First 1
  if ($null -eq $uninstaller) {
    throw 'Signed uninstaller was not installed.'
  }
  $uninstall = Invoke-UserProcess `
    -Label 'uninstaller' `
    -FilePath $uninstaller.FullName `
    -Environment $userProcessEnvironment `
    -ArgumentList '/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART',"/LOG=$uninstallLog"
  if ($uninstall.ExitCode -ne 0) {
    if (Test-Path -LiteralPath $uninstallLog) {
      Write-Host '--- Inno Setup uninstall log ---'
      Get-Content -LiteralPath $uninstallLog
    }
    throw "Standard-user silent uninstall failed ($($uninstall.ExitCode))."
  }

  # Inno's cleanup helper may outlive the uninstaller process briefly. Poll a
  # bounded interval so a correct asynchronous cleanup is not reported as a race.
  $cleanupDeadline = [DateTime]::UtcNow.AddSeconds(15)
  while (((Test-Path -LiteralPath $installRoot) -or (Test-Path -LiteralPath $startMenu)) -and
         [DateTime]::UtcNow -lt $cleanupDeadline) {
    Start-Sleep -Milliseconds 250
  }
  if (Test-Path -LiteralPath $installRoot) {
    throw 'Uninstall left the Ritemark install directory behind.'
  }
  if (Test-Path -LiteralPath $startMenu) {
    throw 'Uninstall left the Ritemark Start menu group behind.'
  }
  $removedRegistration = Invoke-RegistryProbe 'verify-uninstalled'
  Write-Host "Verified $($removedRegistration.Count) current-user Ritemark registrations after uninstall."

  $update = $null
  if ($previousInstaller) {
    # The update case, as the same standard user into the same folder: the
    # previous release, then this installer over it.
    foreach ($mode in 'verify-installed', 'verify-uninstalled') {
      $freshResult = Join-Path $userEvidence "registry-$mode.result.json"
      if (Test-Path -LiteralPath $freshResult) {
        Move-Item -LiteralPath $freshResult -Destination (Join-Path $userEvidence "fresh-registry-$mode.result.json") -Force
      }
    }
    $stagedPreviousInstaller = Join-Path $profileRoot 'Ritemark-Previous-Setup.exe'
    Copy-Item -LiteralPath $previousInstaller -Destination $stagedPreviousInstaller
    if ((Get-FileHash -LiteralPath $stagedPreviousInstaller -Algorithm SHA256).Hash -ine $PreviousInstallerSha256) {
      throw 'Standard-user staging changed the previous installer bytes.'
    }
    $previousInstallLog = Join-Path $profileRoot 'Ritemark-previous-install.log'
    $updateInstallLog = Join-Path $profileRoot 'Ritemark-update-install.log'
    $updateUninstallLog = Join-Path $profileRoot 'Ritemark-update-uninstall.log'

    $previousInstall = Invoke-UserProcess `
      -Label 'previous-installer' `
      -FilePath $stagedPreviousInstaller `
      -Environment $userProcessEnvironment `
      -ArgumentList @(
        '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-', '/CURRENTUSER',
        "/DIR=$installRoot", "/LOG=$previousInstallLog"
      )
    if ($previousInstall.ExitCode -ne 0) {
      throw "The previous release's silent install failed ($($previousInstall.ExitCode))."
    }
    $updateInstall = Invoke-UserProcess `
      -Label 'update-installer' `
      -FilePath $stagedInstaller `
      -Environment $userProcessEnvironment `
      -ArgumentList @(
        '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-', '/CURRENTUSER',
        "/DIR=$installRoot", "/LOG=$updateInstallLog"
      )
    if ($updateInstall.ExitCode -ne 0) {
      throw "Installing over the previous release failed ($($updateInstall.ExitCode))."
    }
    $updatedRegistration = Invoke-RegistryProbe 'verify-installed'
    Write-Host "Verified $($updatedRegistration.Count) current-user Ritemark registration after the update."

    # Anything a fresh install of this release does not hold was left by the previous one.
    $staleFiles = @(Get-InstalledFiles | Where-Object { -not $freshFiles.Contains($_) })
    [System.IO.File]::WriteAllLines((Join-Path $evidenceRoot 'update-stale-files.txt'), [string[]]$staleFiles)
    if ($staleFiles.Count -gt 0) {
      Write-Host "The update left $($staleFiles.Count) files the new release does not ship, first ones:"
      $staleFiles | Select-Object -First 20 | ForEach-Object { Write-Host "  $_" }
    }
    $updateStartFailure = $null
    if ($appStartVerifier) {
      try {
        & $appStartVerifier -AppRoot $installRoot -EvidenceDirectory (Join-Path $evidenceRoot 'update-app-start')
      } catch {
        $updateStartFailure = $_.Exception.Message
        Write-Host "After the update: $updateStartFailure"
      }
    }

    $updateUninstaller = Get-ChildItem -LiteralPath $installRoot -Filter 'unins*.exe' -File | Select-Object -First 1
    if ($null -eq $updateUninstaller) {
      throw 'The update left no uninstaller.'
    }
    $updateUninstall = Invoke-UserProcess `
      -Label 'update-uninstaller' `
      -FilePath $updateUninstaller.FullName `
      -Environment $userProcessEnvironment `
      -ArgumentList '/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART',"/LOG=$updateUninstallLog"
    if ($updateUninstall.ExitCode -ne 0) {
      throw "Uninstalling after the update failed ($($updateUninstall.ExitCode))."
    }
    $cleanupDeadline = [DateTime]::UtcNow.AddSeconds(15)
    while (((Test-Path -LiteralPath $installRoot) -or (Test-Path -LiteralPath $startMenu)) -and
           [DateTime]::UtcNow -lt $cleanupDeadline) {
      Start-Sleep -Milliseconds 250
    }
    if (Test-Path -LiteralPath $installRoot) {
      throw 'Uninstalling after the update left the Ritemark install directory behind.'
    }
    if (Test-Path -LiteralPath $startMenu) {
      throw 'Uninstalling after the update left the Ritemark Start menu group behind.'
    }
    $null = Invoke-RegistryProbe 'verify-uninstalled'

    if ($staleFiles.Count -gt 0 -or $updateStartFailure) {
      $problems = @()
      if ($staleFiles.Count -gt 0) {
        $problems += "$($staleFiles.Count) files of the previous release were left behind (update-stale-files.txt)"
      }
      if ($updateStartFailure) {
        $problems += $updateStartFailure
      }
      throw "The update from the previous release failed: $($problems -join '; ')."
    }
    $update = [ordered]@{
      previousInstallerSha256 = $PreviousInstallerSha256.ToLowerInvariant()
      staleFiles = 0
      appStarted = [bool]$appStartVerifier
    }
    Write-Host 'The update from the previous release left nothing behind.'
  }

  [ordered]@{
    status = 'passed'
    installer = [System.IO.Path]::GetFileName($installer)
    sha256 = $originalInstallerSha.ToLowerInvariant()
    publisher = $ExpectedPublisher
    version = $ExpectedVersion
    standardUser = "$env:COMPUTERNAME\$userName"
    freshAppStarted = [bool]$appStartVerifier
    update = $update
  } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $evidenceRoot 'roundtrip-result.json') -Encoding utf8NoBOM
} finally {
  foreach ($path in @($installLog, $uninstallLog, $previousInstallLog, $updateInstallLog, $updateUninstallLog)) {
    if (-not [string]::IsNullOrWhiteSpace($path) -and (Test-Path -LiteralPath $path)) {
      Copy-Item -LiteralPath $path -Destination $evidenceRoot -Force
    }
  }
  if (-not [string]::IsNullOrWhiteSpace($userEvidence) -and (Test-Path -LiteralPath $userEvidence)) {
    Copy-Item -Path (Join-Path $userEvidence '*') -Destination $evidenceRoot -Force -ErrorAction SilentlyContinue
  }
  Remove-LocalUser -Name $userName -ErrorAction SilentlyContinue
}

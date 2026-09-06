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
  [string]$EvidenceDirectory
)

$ErrorActionPreference = 'Stop'

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

  [ordered]@{
    status = 'passed'
    installer = [System.IO.Path]::GetFileName($installer)
    sha256 = $originalInstallerSha.ToLowerInvariant()
    publisher = $ExpectedPublisher
    version = $ExpectedVersion
    standardUser = "$env:COMPUTERNAME\$userName"
  } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $evidenceRoot 'roundtrip-result.json') -Encoding utf8NoBOM
} finally {
  foreach ($path in @($installLog, $uninstallLog)) {
    if (-not [string]::IsNullOrWhiteSpace($path) -and (Test-Path -LiteralPath $path)) {
      Copy-Item -LiteralPath $path -Destination $evidenceRoot -Force
    }
  }
  if (-not [string]::IsNullOrWhiteSpace($userEvidence) -and (Test-Path -LiteralPath $userEvidence)) {
    Copy-Item -Path (Join-Path $userEvidence '*') -Destination $evidenceRoot -Force -ErrorAction SilentlyContinue
  }
  Remove-LocalUser -Name $userName -ErrorAction SilentlyContinue
}

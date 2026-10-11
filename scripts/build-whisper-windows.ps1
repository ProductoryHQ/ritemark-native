<#
.SYNOPSIS
  Builds the Windows whisper.cpp speech engine that ships in extensions/ritemark/binaries/win32-x64/.

.DESCRIPTION
  Sprint 129 (#133). .github/workflows/build-whisper.yml runs this on windows-latest and then
  the contract test (scripts/qa/whisper-contract-test.mjs) on its output.

  Config V  CPU code picked at run time (GGML_BACKEND_DL + GGML_CPU_ALL_VARIANTS), so an older
            processor gets a slower code path instead of a crash. Shared libraries; dynamic C
            runtime with the Microsoft-signed VC++ runtime DLLs copied beside the exe.
  Config S  One static whisper-cli.exe, AVX2 baseline, static C runtime.

  Both      GGML_NATIVE off (the build machine's CPU never leaks into the binary), OpenMP off
            (no vcomp140.dll), and scripts/build-whisper-utf8.manifest embedded so paths with
            any characters open. Nothing needs the Visual C++ Redistributable on the user's PC.

.EXAMPLE
  ./scripts/build-whisper-windows.ps1 -Config V -Source whisper.cpp -Out out/win32-x64 -Info out/info
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidateSet('V', 'S')][string]$Config,
  [Parameter(Mandatory)][string]$Source,
  [Parameter(Mandatory)][string]$Out,
  [string]$Info
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Keep in step with scripts/build-whisper.sh.
$WhisperTag = 'v1.8.3'
$WhisperCommit = '2eeeba56e9edd762b4b38467bab96c2517163158'

function Invoke-Native {
  param([Parameter(Mandatory)][string]$File, [string[]]$Arguments = @())
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$([System.IO.Path]::GetFileName($File)) failed with exit code $LASTEXITCODE" }
}

$Source = (Resolve-Path -LiteralPath $Source).Path
$head = (git -C $Source rev-parse HEAD).Trim()
if ($head -ne $WhisperCommit) { throw "whisper.cpp source is at $head, expected $WhisperCommit ($WhisperTag)." }

$manifestPath = Join-Path $PSScriptRoot 'build-whisper-utf8.manifest'
$tempRoot = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [System.IO.Path]::GetTempPath() }
$build = Join-Path $tempRoot "whisper-build-$Config"
if (Test-Path -LiteralPath $build) { Remove-Item -LiteralPath $build -Recurse -Force }

# Tools: Visual Studio via vswhere, mt.exe from the newest Windows SDK.
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$vs = (& $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Select-Object -First 1)
if (-not $vs) { throw 'Visual Studio with the C++ x64 tools was not found.' }
$dumpbin = Get-ChildItem -LiteralPath (Join-Path $vs 'VC\Tools\MSVC') -Recurse -Filter dumpbin.exe |
  Where-Object { $_.FullName -match '\\bin\\Hostx64\\x64\\dumpbin\.exe$' } |
  Sort-Object FullName | Select-Object -Last 1
$mt = Get-ChildItem -LiteralPath (Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin') -Recurse -Filter mt.exe |
  Where-Object { $_.FullName -match '\\x64\\mt\.exe$' } |
  Sort-Object FullName | Select-Object -Last 1
if (-not $dumpbin) { throw 'dumpbin.exe was not found.' }
if (-not $mt) { throw 'mt.exe was not found.' }

$flags = @(
  '-A', 'x64',
  '-DCMAKE_BUILD_TYPE=Release',
  '-DCMAKE_POLICY_DEFAULT_CMP0091=NEW',
  '-DGGML_NATIVE=OFF',
  '-DGGML_OPENMP=OFF',
  '-DWHISPER_SDL2=OFF',
  '-DWHISPER_BUILD_TESTS=OFF',
  '-DWHISPER_BUILD_SERVER=OFF'
)
if ($Config -eq 'V') {
  $flags += @('-DBUILD_SHARED_LIBS=ON', '-DGGML_BACKEND_DL=ON', '-DGGML_CPU_ALL_VARIANTS=ON',
    '-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreadedDLL')
} else {
  $flags += @('-DBUILD_SHARED_LIBS=OFF', '-DGGML_AVX=ON', '-DGGML_AVX2=ON', '-DGGML_FMA=ON', '-DGGML_F16C=ON',
    '-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded')
}

Write-Host "Configuring whisper.cpp $WhisperTag, config $Config"
Invoke-Native cmake (@('-S', $Source, '-B', $build) + $flags)
# Config V loads its CPU backends at run time, so they are not dependencies of
# whisper-cli and the whole tree is built. Config S needs only whisper-cli.
$buildArgs = @('--build', $build, '--config', 'Release', '--parallel')
if ($Config -eq 'S') { $buildArgs += @('--target', 'whisper-cli') }
Invoke-Native cmake $buildArgs

$binDir = Join-Path $build 'bin\Release'
$exe = Join-Path $binDir 'whisper-cli.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw "The build produced no $exe." }

if (Test-Path -LiteralPath $Out) { Remove-Item -LiteralPath $Out -Recurse -Force }
New-Item -ItemType Directory -Path $Out -Force | Out-Null
Copy-Item -LiteralPath $exe -Destination $Out
if ($Config -eq 'V') {
  Get-ChildItem -LiteralPath $binDir -Filter *.dll | Copy-Item -Destination $Out
}
$outExe = Join-Path $Out 'whisper-cli.exe'

# Replace the default manifest (resource 1) with ours, then read it back.
Invoke-Native $mt.FullName @('-nologo', '-manifest', $manifestPath, "-outputresource:$outExe;#1")
$readBack = Join-Path $tempRoot 'whisper-cli.manifest.check'
Invoke-Native $mt.FullName @('-nologo', "-inputresource:$outExe;#1", "-out:$readBack")
if (-not (Select-String -LiteralPath $readBack -Pattern '>UTF-8<' -Quiet)) { throw 'The UTF-8 code-page manifest is not embedded.' }

function Get-Dependents {
  param([Parameter(Mandatory)][string]$Path)
  $lines = & $dumpbin.FullName /nologo /dependents $Path
  if ($LASTEXITCODE -ne 0) { throw "dumpbin failed on $Path" }
  # Bare DLL names only: the "Dump of file <path>" header also ends in .dll.
  @($lines | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '^[\w.-]+\.dll$' })
}

# Config V: copy each VC++ runtime DLL the payload links, from the newest redist folder.
$vcRedist = '^(vcruntime|msvcp|vcomp|concrt)\d.*\.dll$'
if ($Config -eq 'V') {
  $needed = @(Get-ChildItem -LiteralPath $Out -File | ForEach-Object { Get-Dependents $_.FullName } |
    Where-Object { $_ -match $vcRedist } | Sort-Object -Unique)
  $crtDir = Get-ChildItem -LiteralPath (Join-Path $vs 'VC\Redist\MSVC') -Directory |
    Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' } |
    Sort-Object { [version]$_.Name } -Descending |
    ForEach-Object { Get-ChildItem -LiteralPath (Join-Path $_.FullName 'x64') -Directory -Filter 'Microsoft.VC*.CRT' -ErrorAction SilentlyContinue } |
    Select-Object -First 1
  if ($needed.Count -gt 0 -and -not $crtDir) { throw 'The VC++ runtime redist folder was not found.' }
  foreach ($dll in $needed) {
    $from = Join-Path $crtDir.FullName $dll
    if (-not (Test-Path -LiteralPath $from)) { throw "$dll is not in $($crtDir.FullName)." }
    Copy-Item -LiteralPath $from -Destination $Out
    Write-Host "  app-local runtime: $dll"
  }
} else {
  $linked = @(Get-Dependents $outExe | Where-Object { $_ -match $vcRedist })
  if ($linked.Count -gt 0) { throw "Config S must not link the VC++ runtime DLLs: $($linked -join ', ')" }
}

$files = @(Get-ChildItem -LiteralPath $Out -File | Sort-Object Name)
Write-Host "Payload ($($files.Count) files):"
$files | ForEach-Object { Write-Host ("  {0,-28} {1,10:N0} bytes" -f $_.Name, $_.Length) }

if ($Info) {
  New-Item -ItemType Directory -Path $Info -Force | Out-Null
  $files | ForEach-Object { '{0}  {1}' -f (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(), $_.Name } |
    Set-Content -LiteralPath (Join-Path $Info 'SHA256SUMS') -Encoding utf8NoBOM
  $dependents = [ordered]@{}
  foreach ($file in $files) { $dependents[$file.Name] = @(Get-Dependents $file.FullName) }
  [ordered]@{
    target = 'win32-x64'
    config = $Config
    whisperCpp = [ordered]@{ tag = $WhisperTag; commit = $WhisperCommit }
    cmakeFlags = ($flags -join ' ')
    cmake = ((cmake --version) | Select-Object -First 1)
    visualStudio = $vs
    dependents = $dependents
    runId = if ($env:GITHUB_RUN_ID) { $env:GITHUB_RUN_ID } else { 'local' }
  } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $Info 'build-info.json') -Encoding utf8NoBOM
}

if ($env:GITHUB_OUTPUT) { "dumpbin=$($dumpbin.FullName)" | Add-Content -LiteralPath $env:GITHUB_OUTPUT }
Write-Host "Done: $outExe"

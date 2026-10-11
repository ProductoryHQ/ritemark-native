<#
.SYNOPSIS
  Sprint 129 A2: measures the Windows whisper engine on this computer, before Ritemark ships it.

.DESCRIPTION
  Uses the engine built by .github/workflows/build-whisper.yml (the zip downloaded from the
  workflow run) and Ritemark's speech model. Prints one table and writes the same numbers to a
  JSON file. Changes nothing outside a temporary folder, except that it downloads the 1.5 GB
  model to %USERPROFILE%\.ritemark\models\ when it is not there yet, where Ritemark will use it.

  Runs on the Windows PowerShell 5.1 that comes with Windows. Plug a laptop in first.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\windows-whisper-bench.ps1 -Zip "$HOME\Downloads\whisper-win32-x64-V.zip"

.EXAMPLE
  # also an Estonian recording of your own (wav, mp3, flac or ogg)
  powershell -ExecutionPolicy Bypass -File .\windows-whisper-bench.ps1 -Zip "$HOME\Downloads\whisper-win32-x64-V.zip" -Audio "$HOME\Desktop\eesti.wav"
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Zip,
  [string]$Audio,
  [string]$Language = 'et'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# Same pins as scripts/qa/whisper-contract-test.mjs and the model Ritemark downloads.
$WhisperCommit = '2eeeba56e9edd762b4b38467bab96c2517163158'
$ModelUrl = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-large-v3-turbo.bin'
$ModelSha256 = '1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69'
$ModelBytes = 1624555275
$SampleUrl = "https://raw.githubusercontent.com/ggml-org/whisper.cpp/$WhisperCommit/samples/jfk.wav"

function Get-Sha256([string]$Path) { (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }

function Get-Download([string]$Url, [string]$Path, [switch]$Progress) {
  $quiet = if ($Progress) { '--progress-bar' } else { '--silent' }
  & curl.exe --fail --location $quiet --show-error --output $Path $Url
  if ($LASTEXITCODE -ne 0) { throw "Download failed: $Url" }
}

$work = Join-Path $env:TEMP 'rm-whisper-bench'
if (Test-Path -LiteralPath $work) { Remove-Item -LiteralPath $work -Recurse -Force }
New-Item -ItemType Directory -Path $work | Out-Null

Write-Host 'Unpacking the engine...'
Unblock-File -LiteralPath $Zip
Expand-Archive -LiteralPath $Zip -DestinationPath $work
$exe = Join-Path $work 'win32-x64\whisper-cli.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw "No win32-x64\whisper-cli.exe in $Zip. Use the whisper-win32-x64-V or -S zip from the workflow run." }
$sums = Join-Path $work 'info\SHA256SUMS'
foreach ($line in (Get-Content -LiteralPath $sums)) {
  $hash, $name = $line -split '\s+', 2
  $file = Join-Path $work "win32-x64\$name"
  if ((Get-Sha256 $file) -ne $hash) { throw "$name does not match the build's checksum." }
}
$buildInfo = Get-Content -LiteralPath (Join-Path $work 'info\build-info.json') -Raw | ConvertFrom-Json

$modelDir = Join-Path $HOME '.ritemark\models'
$model = Join-Path $modelDir 'ggml-large-v3-turbo.bin'
if ((Test-Path -LiteralPath $model) -and ((Get-Item -LiteralPath $model).Length -eq $ModelBytes)) {
  Write-Host 'Checking the speech model already on this computer...'
} else {
  Write-Host 'Downloading the speech model (1.5 GB, once; Ritemark uses the same file)...'
  New-Item -ItemType Directory -Path $modelDir -Force | Out-Null
  Get-Download $ModelUrl "$model.partial" -Progress
  Move-Item -LiteralPath "$model.partial" -Destination $model -Force
}
if ((Get-Sha256 $model) -ne $ModelSha256) { throw "The model at $model is damaged. Delete it and run this again." }

$jfk = Join-Path $work 'jfk.wav'
Get-Download $SampleUrl $jfk

# Ten minutes for the Transcribe run: jfk.wav (16 kHz mono PCM, 44-byte header) repeated with 1 s gaps.
$jfkBytes = [System.IO.File]::ReadAllBytes($jfk)
$pcm = New-Object byte[] ($jfkBytes.Length - 44)
[Array]::Copy($jfkBytes, 44, $pcm, 0, $pcm.Length)
$gap = New-Object byte[] 32000
$long = Join-Path $work 'ten-minutes.wav'
$stream = [System.IO.File]::Create($long)
$writer = New-Object System.IO.BinaryWriter($stream)
$repeats = [int][Math]::Ceiling(600 / (($pcm.Length + $gap.Length) / 32000.0))
$dataBytes = $repeats * ($pcm.Length + $gap.Length)
$writer.Write([Text.Encoding]::ASCII.GetBytes('RIFF')); $writer.Write([int](36 + $dataBytes))
$writer.Write([Text.Encoding]::ASCII.GetBytes('WAVEfmt ')); $writer.Write([int]16); $writer.Write([int16]1); $writer.Write([int16]1)
$writer.Write([int]16000); $writer.Write([int]32000); $writer.Write([int16]2); $writer.Write([int16]16)
$writer.Write([Text.Encoding]::ASCII.GetBytes('data')); $writer.Write([int]$dataBytes)
for ($i = 0; $i -lt $repeats; $i++) { $writer.Write($pcm); $writer.Write($gap) }
$writer.Close()

function Invoke-Whisper {
  param([string[]]$Arguments)
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $exe
  $psi.Arguments = ($Arguments | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }) -join ' '
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.StandardOutputEncoding = [Text.Encoding]::UTF8
  $psi.StandardErrorEncoding = [Text.Encoding]::UTF8
  $watch = [Diagnostics.Stopwatch]::StartNew()
  $process = [Diagnostics.Process]::Start($psi)
  $stderrTask = $process.StandardError.ReadToEndAsync()
  $stdout = $process.StandardOutput.ReadToEnd()
  $process.WaitForExit()
  $watch.Stop()
  $stderr = $stderrTask.Result
  $timing = @{}
  foreach ($name in 'load', 'encode', 'decode', 'batchd', 'total') {
    $m = [regex]::Match($stderr, "$name time\s*=\s*([\d.]+) ms")
    $timing[$name] = if ($m.Success) { [double]$m.Groups[1].Value } else { $null }
  }
  [pscustomobject]@{
    exit = $process.ExitCode
    wallMs = $watch.ElapsedMilliseconds
    loadMs = $timing['load']; encodeMs = $timing['encode']; decodeMs = $timing['decode'] + $timing['batchd']; totalMs = $timing['total']
    text = (($stdout -split "`n") | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_ -notmatch '^(whisper_|main:|system_info)' }) -join ' '
    stderr = $stderr
  }
}

# Dictation's flags (voiceDictation/whisperCpp.ts dictationArgs), with -d for a 5 s or 10 s chunk.
function Get-DictationArgs([string]$File, [string]$Lang, [int]$Threads, [int]$Beam, [int]$DurationMs, [int]$AudioCtx = 0) {
  $list = @('--model', $model, '--language', $Lang, '--threads', "$Threads", '--no-timestamps', '--no-fallback',
    '--beam-size', "$Beam", '--entropy-thold', '2.4', '--logprob-thold', '-1.0', '--max-len', '0',
    '--duration', "$DurationMs")
  # Not a pre-approved setting: measured so Jarmo can decide with numbers (Sprint 129 W6).
  if ($AudioCtx -gt 0) { $list += @('--audio-ctx', "$AudioCtx") }
  $list + @($File)
}

$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$logical = [int]$cpu.NumberOfLogicalProcessors
$cores = [int]$cpu.NumberOfCores
$os = Get-CimInstance Win32_OperatingSystem
$sac = $null
try { $sac = (Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy' -Name VerifiedAndReputablePolicyState -ErrorAction Stop).VerifiedAndReputablePolicyState } catch { }
$sacText = switch ($sac) { 0 { 'Off' } 1 { 'On' } 2 { 'Evaluation' } default { 'unknown' } }
$power = 'unknown'
try { $battery = Get-CimInstance Win32_Battery -ErrorAction Stop; $power = if (-not $battery) { 'mains (no battery)' } elseif ($battery.BatteryStatus -eq 2) { 'plugged in' } else { 'on battery' } } catch { }

Write-Host ''
Write-Host "CPU: $($cpu.Name.Trim()) - $cores cores, $logical threads. Windows: $($os.Caption) $($os.Version). Power: $power. Smart App Control: $sacText."
Write-Host 'Warming up (the first run reads the model from disk and lets antivirus scan it)...'
$warm = Invoke-Whisper (Get-DictationArgs $jfk 'en' 4 8 5000)
if ($warm.exit -ne 0) { Write-Host $warm.stderr; throw "whisper-cli exited with $($warm.exit) on the first run." }
$backend = ([regex]::Matches($warm.stderr, 'load_backend: loaded CPU backend from (.+)') | ForEach-Object { Split-Path -Leaf $_.Groups[1].Value.Trim() }) -join ', '
$systemInfo = [regex]::Match($warm.stderr, 'system_info:.*').Value

$rows = New-Object System.Collections.Generic.List[object]
function Add-Row([string]$Case, [int]$Threads, [int]$Beam, [string]$Audio, $Result, [int]$AudioCtx = 0) {
  $row = [pscustomobject]@{
    case = $Case; threads = $Threads; beam = $Beam; audioCtx = $AudioCtx; audio = $Audio; exit = $Result.exit
    wallMs = $Result.wallMs; loadMs = $Result.loadMs; encodeMs = $Result.encodeMs; decodeMs = $Result.decodeMs; text = $Result.text
  }
  $rows.Add($row)
  Write-Host ('{0,-22} t={1,-2} beam={2} {3,-6} wall {4,7:N0} ms  load {5,6:N0}  encode {6,7:N0}  decode {7,6:N0}  exit {8}' -f
    $Case, $Threads, $Beam, $Audio, $row.wallMs, $row.loadMs, $row.encodeMs, $row.decodeMs, $row.exit)
}

Write-Host ''
Write-Host '1/3  Thread count (dictation, 5 s chunk, beam 8)'
$threadOptions = @(4, [Math]::Max(1, [int]($logical / 2)), $logical) | Sort-Object -Unique
foreach ($t in $threadOptions) { Add-Row 'threads' $t 8 'jfk 5s' (Invoke-Whisper (Get-DictationArgs $jfk 'en' $t 8 5000)) }
$best = ($rows | Where-Object { $_.case -eq 'threads' -and $_.exit -eq 0 } | Sort-Object wallMs | Select-Object -First 1).threads

Write-Host ''
Write-Host "2/3  Beam size and chunk length (dictation, $best threads)"
foreach ($beam in 8, 5, 1) {
  foreach ($ms in 5000, 10000) {
    Add-Row 'beam/chunk' $best $beam ("jfk {0}s" -f ($ms / 1000)) (Invoke-Whisper (Get-DictationArgs $jfk 'en' $best $beam $ms))
  }
}
if ($Audio) {
  foreach ($beam in 8, 5, 1) {
    Add-Row 'your audio 10s' $best $beam 'yours' (Invoke-Whisper (Get-DictationArgs (Resolve-Path -LiteralPath $Audio).Path $Language $best $beam 10000))
  }
}

Write-Host ''
Write-Host "2b   Shorter audio window for short chunks (beam 8, $best threads)"
# Whisper normally pads every call to 30 s (audio context 1500). A 5 s chunk needs ~250 of it.
foreach ($pair in @(@(5000, 320), @(10000, 576))) {
  $label = "jfk {0}s ac{1}" -f ($pair[0] / 1000), $pair[1]
  Add-Row 'audio window' $best 8 $label (Invoke-Whisper (Get-DictationArgs $jfk 'en' $best 8 $pair[0] $pair[1])) $pair[1]
}
if ($Audio) {
  Add-Row 'your audio ac576' $best 8 'yours' (Invoke-Whisper (Get-DictationArgs (Resolve-Path -LiteralPath $Audio).Path $Language $best 8 10000 576)) 576
}

Write-Host ''
Write-Host "3/3  Transcribe: ten minutes of audio, $best threads (takes a while)"
$outBase = Join-Path $work 'transcript'
# Transcribe's flags (speech/engines/whisperLocalEngine.ts transcribeArgs).
$long10 = Invoke-Whisper @('-m', $model, '-f', $long, '-ojf', '-of', $outBase, '-pp', '-t', "$best", '-l', 'en')
Add-Row 'transcribe 10 min' $best 5 'synthetic' $long10

$report = [ordered]@{
  computer = $env:COMPUTERNAME
  cpu = $cpu.Name.Trim(); cores = $cores; threads = $logical
  memoryGB = [Math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
  windows = "$($os.Caption) $($os.Version)"
  power = $power
  smartAppControl = $sacText
  build = [ordered]@{ config = $buildInfo.config; runId = $buildInfo.runId; cmakeFlags = $buildInfo.cmakeFlags }
  cpuBackend = $backend
  systemInfo = $systemInfo
  warmupWallMs = $warm.wallMs
  bestThreads = $best
  rows = $rows
}
$reportPath = Join-Path (Get-Location) "whisper-bench-$($env:COMPUTERNAME).json"
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $reportPath -Encoding UTF8

Write-Host ''
Write-Host 'Transcripts, to compare beam sizes:'
$rows | Where-Object { $_.case -ne 'threads' -and $_.case -ne 'transcribe 10 min' } |
  ForEach-Object { Write-Host ('  beam {0} {1,-12}: {2}' -f $_.beam, $_.audio, $_.text) }
Write-Host ''
Write-Host "CPU backend chosen: $backend"
Write-Host "Done. Please send the output above, or this file: $reportPath"

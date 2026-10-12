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
  # Round 2: Whisper large-v3-turbo q8_0 against f16, speed and Estonian accuracy on the same clips
  powershell -ExecutionPolicy Bypass -File .\windows-whisper-bench.ps1 -Zip "$HOME\Downloads\whisper-win32-x64-V.zip" -Round 2 -Clips "$HOME\Downloads\whisper-bench-audio-et.zip"

.EXAMPLE
  # Round 3: the same clips on the GPU (Vulkan), with the config VK engine, plus ten minutes of Transcribe
  powershell -ExecutionPolicy Bypass -File .\windows-whisper-bench.ps1 -Zip "$HOME\Downloads\whisper-win32-x64-VK.zip" -Round 3 -Clips "$HOME\Downloads\whisper-bench-audio-et.zip"

.EXAMPLE
  # also an Estonian recording of your own (wav, mp3, flac or ogg)
  powershell -ExecutionPolicy Bypass -File .\windows-whisper-bench.ps1 -Zip "$HOME\Downloads\whisper-win32-x64-V.zip" -Audio "$HOME\Desktop\eesti.wav"
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Zip,
  [string]$Audio,
  [string]$Language = 'et',
  [ValidateSet(1, 2, 3)][int]$Round = 1,
  [string]$Clips
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# Same pins as scripts/qa/whisper-contract-test.mjs and the model Ritemark downloads.
$WhisperCommit = '2eeeba56e9edd762b4b38467bab96c2517163158'
$ModelUrl = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-large-v3-turbo.bin'
$ModelSha256 = '1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69'
$ModelBytes = 1624555275
$SampleUrl = "https://raw.githubusercontent.com/ggml-org/whisper.cpp/$WhisperCommit/samples/jfk.wav"
# Round 2 (Sprint 129 W11). Jarmo, 2026-10-12: Parakeet (poor Estonian) and the Zipformer
# (Estonian and English only) are out, so no sherpa-onnx; Whisper q8_0 is measured against f16.
# q8_0 was 1.9x faster than f16 on a CPU in the Mac test, with the same Estonian WER.
$Q8Url = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-large-v3-turbo-q8_0.bin'
$Q8Sha256 = '317eb69c11673c9de1e1f0d459b253999804ec71ac4c23c17ecf5fbe24e259a1'
$Q8Bytes = 874188075

function Get-Sha256([string]$Path) { (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }

function Get-Download([string]$Url, [string]$Path, [switch]$Progress) {
  # Resumes and retries: the model CDN can drop a 1.6 GB transfer more than once.
  $quiet = if ($Progress) { '--progress-bar' } else { '--silent' }
  for ($try = 1; $try -le 5; $try++) {
    & curl.exe --fail --location $quiet --show-error --continue-at - --retry 10 --retry-all-errors --retry-delay 5 --output $Path $Url
    if ($LASTEXITCODE -eq 0) { return }
    Write-Host "Download interrupted (curl exit $LASTEXITCODE); resuming, attempt $($try + 1) of 5..."
  }
  throw "Download failed after 5 attempts: $Url"
}

$work = Join-Path $env:TEMP 'rm-whisper-bench'
if (Test-Path -LiteralPath $work) { Remove-Item -LiteralPath $work -Recurse -Force }
New-Item -ItemType Directory -Path $work | Out-Null

Write-Host 'Unpacking the engine...'
Unblock-File -LiteralPath $Zip
Expand-Archive -LiteralPath $Zip -DestinationPath $work
$exe = Join-Path $work 'win32-x64\whisper-cli.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw "No win32-x64\whisper-cli.exe in $Zip. Use the whisper-win32-x64-V, -S or -VK zip from the workflow run." }
$sums = Join-Path $work 'info\SHA256SUMS'
foreach ($line in (Get-Content -LiteralPath $sums)) {
  $hash, $name = $line -split '\s+', 2
  $file = Join-Path $work "win32-x64\$name"
  if ((Get-Sha256 $file) -ne $hash) { throw "$name does not match the build's checksum." }
}
$buildInfo = Get-Content -LiteralPath (Join-Path $work 'info\build-info.json') -Raw | ConvertFrom-Json

$modelDir = Join-Path $HOME '.ritemark\models'
$model = Join-Path $modelDir 'ggml-large-v3-turbo.bin'
if ($true) {  # both rounds use the f16 model
  if ((Test-Path -LiteralPath $model) -and ((Get-Item -LiteralPath $model).Length -eq $ModelBytes)) {
    Write-Host 'Checking the speech model already on this computer...'
  } else {
    Write-Host 'Downloading the speech model (1.5 GB, once; Ritemark uses the same file)...'
    New-Item -ItemType Directory -Path $modelDir -Force | Out-Null
    Get-Download $ModelUrl "$model.partial" -Progress
    Move-Item -LiteralPath "$model.partial" -Destination $model -Force
  }
  if ((Get-Sha256 $model) -ne $ModelSha256) { throw "The model at $model is damaged. Delete it and run this again." }
}

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

if ($Round -ge 2) {
  if (-not $Clips) { throw "Round $Round needs -Clips: the whisper-bench-audio-et zip from the same workflow run." }
  $gpuLines = @()
  if ($Round -eq 3) {
    # Round 3 (Sprint 129 W12, Jarmo 2026-10-12: Windows GPU "if it can be done"): config VK only.
    if (-not (Test-Path -LiteralPath (Join-Path $work 'win32-x64\ggml-vulkan.dll'))) { throw 'Round 3 needs the whisper-win32-x64-VK zip (it has ggml-vulkan.dll).' }
    Write-Host 'Looking for a Vulkan GPU...'
    $probe = Invoke-Whisper @('--model', $model, '--language', 'en', $jfk)
    $gpuLines = @(($probe.stderr -split "`n") | ForEach-Object { $_.Trim() } | Where-Object { $_ -match 'ggml_vulkan|Vulkan|backend_init_gpu' })
    $gpuLines | ForEach-Object { Write-Host "  $_" }
    if ($probe.exit -ne 0) { Write-Host $probe.stderr; throw "whisper-cli exited with $($probe.exit) on the GPU check." }
    if (-not ($probe.stderr -match 'using Vulkan\d* backend')) { throw 'whisper-cli did not use a Vulkan GPU on this computer (lines above). Please send this output.' }
    Write-Host 'Checking that the same engine still works without the GPU (--no-gpu)...'
    $cpuOnly = Invoke-Whisper @('--model', $model, '--language', 'en', '--no-gpu', $jfk)
    if ($cpuOnly.exit -ne 0 -or -not $cpuOnly.text) { Write-Host $cpuOnly.stderr; throw "The engine failed without the GPU (exit $($cpuOnly.exit))." }
    Write-Host ("  CPU only: exit 0, {0:N0} ms: {1}" -f $cpuOnly.wallMs, $cpuOnly.text)
  }

  $clipDir = Join-Path $work 'clips'
  Unblock-File -LiteralPath $Clips
  Expand-Archive -LiteralPath $Clips -DestinationPath $clipDir
  $clipRows = @(Get-Content -LiteralPath (Join-Path $clipDir 'refs.tsv') -Encoding UTF8 | Where-Object { $_ } | ForEach-Object {
    $f = $_ -split "`t"; [pscustomobject]@{ file = (Join-Path $clipDir $f[0]); name = $f[0]; reference = $f[1] }
  })
  $clipSeconds = ($clipRows | ForEach-Object { ((Get-Item -LiteralPath $_.file).Length - 44) / 32000.0 } | Measure-Object -Sum).Sum

  $q8 = Join-Path $modelDir 'ggml-large-v3-turbo-q8_0.bin'
  if (-not ((Test-Path -LiteralPath $q8) -and ((Get-Item -LiteralPath $q8).Length -eq $Q8Bytes))) {
    Write-Host 'Downloading the Whisper q8_0 model (870 MB, once)...'
    New-Item -ItemType Directory -Path $modelDir -Force | Out-Null
    Get-Download $Q8Url "$q8.partial" -Progress
    Move-Item -LiteralPath "$q8.partial" -Destination $q8 -Force
  }
  if ((Get-Sha256 $q8) -ne $Q8Sha256) { throw "The model at $q8 is damaged. Delete it and run this again." }

  function Get-WerText([string]$Text) {
    ($Text.Normalize([Text.NormalizationForm]::FormC).ToLowerInvariant() -replace '[^\p{L}\p{N}]+', ' ').Trim()
  }
  function Get-WordErrors([string]$Ref, [string]$Hyp) {
    $r = @(if ($Ref) { $Ref -split ' ' }); $h = @(if ($Hyp) { $Hyp -split ' ' })
    $prev = 0..$h.Count
    for ($i = 1; $i -le $r.Count; $i++) {
      $cur = New-Object int[] ($h.Count + 1); $cur[0] = $i
      for ($j = 1; $j -le $h.Count; $j++) {
        $cost = if ($r[$i - 1] -eq $h[$j - 1]) { 0 } else { 1 }
        $cur[$j] = [Math]::Min([Math]::Min($prev[$j] + 1, $cur[$j - 1] + 1), $prev[$j - 1] + $cost)
      }
      $prev = $cur
    }
    [pscustomobject]@{ errors = $prev[$h.Count]; words = $r.Count }
  }
  function Measure-Wer($Texts) {
    $e = 0; $w = 0
    for ($i = 0; $i -lt $clipRows.Count; $i++) {
      $s = Get-WordErrors (Get-WerText $clipRows[$i].reference) (Get-WerText $Texts[$i]); $e += $s.errors; $w += $s.words
    }
    [Math]::Round(100.0 * $e / [Math]::Max(1, $w), 1)
  }
  $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
  $threads = [int]$cpu.NumberOfLogicalProcessors
  $cores = [int]$cpu.NumberOfCores
  $results = New-Object System.Collections.Generic.List[object]
  Write-Host ''
  Write-Host ("CPU: {0}, {1} cores / {2} threads. {3} Estonian clips, {4:N0} s of audio (FLEURS, CC BY 4.0)." -f $cpu.Name.Trim(), $cores, $threads, $clipRows.Count, $clipSeconds)

  # Whisper: one process per clip with dictation's flags, the way Ritemark runs it today.
  $device = if ($Round -eq 3) { 'gpu' } else { 'cpu' }
  foreach ($m in @(@("whisper-turbo-q8_0-$device", $q8), @("whisper-turbo-f16-$device", $model))) {
    Write-Host "$($m[0]) (one process per clip, as dictation runs today)..."
    $null = Invoke-Whisper @('--model', $m[1], '--language', 'et', '--threads', "$threads", $jfk)
    $wTexts = @(); $wWall = 0; $wLoad = 0; $wEncode = 0
    foreach ($c in $clipRows) {
      $r = Invoke-Whisper @('--model', $m[1], '--language', 'et', '--threads', "$threads", '--no-timestamps', '--no-fallback',
        '--beam-size', '8', '--entropy-thold', '2.4', '--logprob-thold', '-1.0', '--max-len', '0', $c.file)
      $wTexts += , $r.text; $wWall += $r.wallMs; $wLoad += [double]$r.loadMs; $wEncode += [double]$r.encodeMs
    }
    $results.Add([pscustomobject]@{ engine = $m[0]; threads = $threads; wer = (Measure-Wer $wTexts); wallMs = $wWall; loadMs = [int]$wLoad
      encodeMs = [int]$wEncode; perClipMs = [int]($wWall / $clipRows.Count); rtf = [Math]::Round($wWall / 1000.0 / $clipSeconds, 3); texts = $wTexts })
  }
  $transcribe = $null
  if ($Round -eq 3) {
    Write-Host 'Transcribe: ten minutes of audio on the GPU...'
    # Transcribe's flags (speech/engines/whisperLocalEngine.ts transcribeArgs).
    $t10 = Invoke-Whisper @('-m', $model, '-f', $long, '-ojf', '-of', (Join-Path $work 'transcript'), '-pp', '-t', "$threads", '-l', 'en')
    $transcribe = [pscustomobject]@{ exit = $t10.exit; wallMs = $t10.wallMs; loadMs = $t10.loadMs; encodeMs = $t10.encodeMs; decodeMs = $t10.decodeMs
      realTime = [Math]::Round($t10.wallMs / 600000.0, 3) }
  }

  Write-Host ''
  Write-Host ('{0,-26} {1,7} {2,7} {3,10} {4,9} {5,10} {6,10} {7,7}' -f 'engine', 'threads', 'WER %', 'per clip', 'load', 'encode', 'total', 'RTF')
  foreach ($r in $results) {
    Write-Host ('{0,-26} {1,7} {2,7} {3,8:N0}ms {4,7:N0}ms {5,8:N0}ms {6,8:N0}ms {7,7}' -f $r.engine, $r.threads, $r.wer, $r.perClipMs, $r.loadMs, $r.encodeMs, $r.wallMs, $r.rtf)
  }
  Write-Host '(Per clip includes loading the model each time, as dictation does today; load and encode are the totals of those.)'
  if ($transcribe) {
    Write-Host ('Transcribe, ten minutes on the GPU: {0:N0} ms ({1}x real time), load {2:N0}, encode {3:N0}, decode {4:N0}, exit {5}' -f
      $transcribe.wallMs, $transcribe.realTime, $transcribe.loadMs, $transcribe.encodeMs, $transcribe.decodeMs, $transcribe.exit)
  }
  $reportPath = Join-Path (Get-Location) "asr-bench-round$Round-$($env:COMPUTERNAME).json"
  [ordered]@{ computer = $env:COMPUTERNAME; cpu = $cpu.Name.Trim(); cores = $cores; threads = $threads; build = $buildInfo.runId; config = $buildInfo.config
    gpu = $gpuLines; transcribe = $transcribe
    clips = @($clipRows | ForEach-Object { $_.name }); references = @($clipRows | ForEach-Object { $_.reference }); results = $results } |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $reportPath -Encoding UTF8
  Write-Host ''
  Write-Host "Done. Please send the table above and this file: $reportPath"
  return
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

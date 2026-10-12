# Sprint 129 Scenarios

These scenarios are the manual QA matrix. **Stage** says where each is run (see [technical-plan.md](./technical-plan.md#w8--verification-path-no-full-windows-build-before-merge)): **B** = branch test in the installed app on Jarmo's Windows machine, **C** = Gate 2 on the signed RC, **M** = RunDev on Apple silicon, **CI** = `build-whisper.yml` contract test, **U** = unit test.

## Feature: Windows engine is present and signed (R1)

### Scenario: The engine ships and runs (CI, C)
Given the v1.14.0 Windows installer is installed
When I open the install folder's `resources\app\extensions\ritemark\binaries\win32-x64\`
Then `whisper-cli.exe` and its DLLs are there
And each file's Digital Signatures tab shows Productory Services OÜ with a timestamp

### Scenario: Unicode paths (CI)
Given model, audio and output sit in a folder named `Tõõ-äöü Тест`
When the contract test transcribes `jfk.wav`
Then the transcript contains "ask not what your country"

### Scenario: No Visual C++ Redistributable needed (CI)
When the contract test lists `whisper-cli.exe`'s dependencies
Then each one is a Windows system DLL or a file in the same folder

### Scenario: A broken payload never ships (U)
Given `binaries/win32-x64/whisper-cli.exe` differs from `whisper-manifest.json`
When `validate-build-output.sh win32-x64` runs on the unsigned payload
Then it fails and names the file

## Feature: Intel Mac engine (R2, if approved)

### Scenario: Intel Mac dictation and transcription (CI, C if an Intel Mac is available)
Given Ritemark v1.14.0 on an Intel Mac with the model downloaded
When I dictate one English sentence and transcribe a WAV with on-device Whisper
Then the text appears in the document and the transcript opens

## Feature: Readiness before the download (R3, R6)

### Scenario: First dictation on Windows offers the model (B)
Given a fresh profile with no model in `%USERPROFILE%\.ritemark\models`
When I click the microphone button
Then Ritemark asks "Download voice model (1.5GB)?"
And after the download, the next click starts listening

### Scenario: Engine missing — no download offered (U, B)
Given `whisper-cli.exe` is removed from the test copy
When I click the microphone button
Then I see "Ritemark's speech engine is missing from this installation. Reinstall Ritemark to restore it."
And no download is offered

### Scenario: Intel Mac without a binary (U; only if R2 is declined)
Given darwin-x64 with no `binaries/darwin-x64/`
When I click the microphone button
Then I see "On-device speech recognition needs a Mac with Apple silicon."
And no download is offered

### Scenario: Unsupported processor (U)
Given whisper-cli exits with `3221225501` (illegal instruction)
When dictation or Transcribe runs it
Then the user sees "On-device speech recognition needs a newer processor than this computer has."
And dictation stops listening
And Transcribe adds "You can transcribe with ElevenLabs instead."

### Scenario: Blocked by the operating system (U; B/C only if Smart App Control is On somewhere)
Given starting whisper-cli fails with `EACCES` or `EPERM`
Then the user sees "Your computer's security settings stopped Ritemark's speech engine from starting."

## Feature: Dictation and Transcribe on Windows (R4)

### Scenario: Dictate in Estonian and English (B, C)
Given the model is downloaded
When I dictate two minutes in Estonian, then one minute in English (language picked from the dropdown)
Then the text appears in the document in the order I spoke
And no sentence is missing (I read it back against what I said)

### Scenario: On-device Transcribe with WAV and MP3 (B, C)
When I add a 10-minute MP3 and choose On-device · Whisper
Then the job shows progress, finishes, and the transcript opens with word timings
And the same works for a recording made with Record

### Scenario: m4a on Windows (B)
When I add an .m4a file and choose On-device · Whisper
Then I see ".m4a files need converting before they can be transcribed on this device. Use .mp3 or .wav, or transcribe with ElevenLabs."

### Scenario: Cancel a running transcription (B)
When I press Cancel during an on-device job
Then the job stops within a second and no `whisper-cli.exe` stays in Task Manager

### Scenario: Apple silicon is unchanged (M)
When I dictate and transcribe on-device on an Apple silicon dev build
Then both behave as in v1.13.0, apart from R8 (no dropped audio)

## Feature: Windows microphone problems (R5)

### Scenario: Desktop apps blocked from the microphone (B; A3 records the error)
Given Settings → Privacy & security → Microphone → "Let desktop apps access your microphone" is Off
When I click the microphone button
Then a dialog says Windows is blocking the microphone and lists: turn on **Microphone access** and **Let desktop apps access your microphone**
And **Open Microphone Settings** opens that Windows page
And no raw error text is shown

### Scenario: No microphone (B)
Given no input device is connected
When I click the microphone button
Then I see "No microphone found. Connect a microphone or headset and try again."

### Scenario: Microphone in use (B)
Given another app holds the microphone exclusively
When I click the microphone button
Then the busy message says another app may be using it or Windows may be blocking access, and offers **Open Microphone Settings**

### Scenario: macOS wording is unchanged in substance (M, U)
Given macOS with Ritemark denied in Privacy & Security
When I click the microphone button
Then the dialog names System Settings → Privacy & Security → Microphone and offers **Open Microphone Settings**

## Feature: Model storage (R7)

### Scenario: Resume and remove (B)
Given a model download interrupted at about 40%
When I click the microphone button again
Then Ritemark offers "Resume download?" and finishes it
And Settings → Component readiness → Voice model → Remove deletes the file in `%USERPROFILE%\.ritemark\models`

### Scenario: Antivirus holds the new file (U)
Given rename fails with `EPERM` twice and then succeeds
When the download completes
Then the model is installed and no error is shown

## Feature: No lost words (R8)

### Scenario: Slow transcription joins audio instead of dropping it (U, B)
Given each transcription takes longer than a chunk
When I speak continuously for one minute
Then every chunk's audio is transcribed exactly once, in order

### Scenario: Last words before Stop (U, M, B)
Given a transcription is still running
When I say a final sentence and press Stop at once
Then that sentence is inserted before the button returns to idle

### Scenario: Computer far too slow (U)
Given the waiting audio passes 60 s
Then dictation stops listening, inserts everything captured, and says "Dictation can't keep up on this computer, so it stopped listening. The rest of what you said will appear in a moment." (live dictation only; R12 has no such stop)

## Feature: Speed (R9)

### Scenario: Benchmark (A2, Jarmo's machine)
When Jarmo runs `windows-whisper-bench.ps1`
Then the table shows load/encode/decode/total per configuration, and the chosen settings follow the rule

### ~~Scenario: Dictation keeps up (B)~~
Superseded on 2026-10-12 by R12 ("speak, then text" on Windows; see that feature). On a CPU-only laptop no setting kept live text both prompt and accurate (research/windows-performance-audit.md).

### Scenario: Recording does not glitch on a busy CPU (B)
Given "speak, then text" on Jarmo's Windows PC, where whisper uses every logical CPU in the background while recording
When I dictate for two minutes in Estonian
Then the text after Stop has no gaps or garbled stretches that a quiet recording wouldn't have

## Feature: Apple silicon engine on macOS 12+ (R11, added 2026-10-12)

### Scenario: The engine starts on older macOS (CI)
Given the darwin-arm64 build from `build-whisper.yml`
When the contract test runs on the `macos-14` runner
Then all checks pass, including "runs on macOS 12.0+"

### Scenario: Nothing changes on a current Mac (M, C)
Given Ritemark with the new Apple silicon engine on Jarmo's Mac
When I dictate in Estonian and transcribe a recording on-device
Then both behave as in v1.13.0

## Feature: "Speak, then text" (R12, added 2026-10-12)

### Scenario: Recording says the text comes after Stop (B, C; M with the QA switch)
Given Ritemark on Windows (or a Mac dev instance started with `RITEMARK_DICTATION_MODE=deferred`)
When I click the mic button
Then its tooltip said "Your text appears after you stop" before the click
And the document shows "🎤 Recording... your text appears after you stop" at the cursor
And nothing changes in the document while I speak, not even after half a minute

### Scenario: Stop, then the text (B, C, M)
Given I dictated for about a minute in Estonian
When I click Stop
Then the button shows a spinner and is disabled, with the tooltip "Processing your recording. Your text will be added when it's done."
And the document says "⏳ Processing your recording." and how long it usually takes
And about 20 s later (Jarmo's laptop) all the text appears where the placeholder was, in the order I spoke, and the button is idle again

### Scenario: The note never reaches the file (M, U)
Given autosave is on (Ritemark's default, 1 s)
When I record for half a minute and look at the file on disk
Then the file does not contain "Recording..." or "Processing", and after Stop it holds only my text

### Scenario: Work elsewhere while it processes (B, M)
Given I clicked Stop and the placeholder is showing
When I click into another paragraph and type
Then my typing is not interrupted, and the text goes where the placeholder was, not where I am typing

### Scenario: A slow computer waits longer instead of stopping (U)
Given transcription is slower than speech
When I dictate for two minutes
Then dictation does not stop on its own, and everything I said appears after Stop

### Scenario: The engine fails part-way (U)
Given a part of the recording was already transcribed
When the engine fails on the next part
Then the text already transcribed is inserted first, then the problem dialog explains

### Scenario: Cancel while it gets ready (M)
Given I clicked the mic button and it shows "Getting the microphone ready..."
When I click it again
Then the microphone does not start and the button is idle

### Scenario: Apple silicon keeps live text (M)
Given an Apple silicon Mac in the normal mode
When I dictate and press Stop
Then text appears while I speak, and after Stop the button shows "Adding your last words" until the last words are in

## Feature: The 8-bit model on Windows (R13, added 2026-10-12)

### Scenario: The smaller download is offered (B, C)
Given Windows with no speech model downloaded
When I click the mic button for the first time
Then Ritemark offers "Download voice model (834 MB)?"
And after the download, Settings shows the model as installed, and Transcribe On-device works with it

### Scenario: Apple silicon keeps its model (U, M)
Given an Apple silicon Mac with `ggml-large-v3-turbo.bin`
When I dictate or open Settings
Then nothing asks for a new download

## Feature: Tiers and docs (R10)

### Scenario: Whisper binaries count as shell-tier (U)
Given a change only under `extensions/ritemark/binaries/win32-x64/`
When `release-extension-preflight.sh` classifies it
Then it is shell-tier and the extension release stops
And `CLAUDE.md`'s list and the preflight denylist are identical (`release-tier-paths.test.mjs`)

### Scenario: Docs say what Windows users get (review)
When I read `docs/user/features/transcribe.md` and the dictation section
Then Windows is listed for on-device Whisper, with the measured timing, the m4a note and the microphone settings
And `docs/development/architecture.md` no longer calls on-device Whisper macOS-only

## Intentionally untested (unless the hardware turns up)

- Smart App Control set to On (if no available machine has it On).
- A Windows user account whose folder name has non-ASCII characters (CI covers the path handling).
- Windows on ARM (x64 build under emulation).
- Intel Mac hands-on (if none is available; the CI contract test runs on `macos-15-intel`).

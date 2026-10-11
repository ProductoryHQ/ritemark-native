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
Then dictation stops listening, inserts everything captured, and says "Dictation can't keep up on this computer. Everything you said so far has been added."

## Feature: Speed (R9)

### Scenario: Benchmark (A2, Jarmo's machine)
When Jarmo runs `windows-whisper-bench.ps1`
Then the table shows load/encode/decode/total per configuration, and the chosen settings follow the rule

### Scenario: Dictation keeps up (B)
Given the chosen settings
When I dictate for two minutes at a normal pace
Then text appears within about one chunk length after I pause (measured in A2 terms: the median call stays under the chunk length)

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

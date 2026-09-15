# Sprint 118 Scenarios

BDD examples for [spec.md](./spec.md). ★ scenarios require automation or live/native evidence.

## Feature: Start and stop recording (R1)

### ★ Scenario: Record produces a pending import
Given Transcribe is open and a supported microphone is available
When I choose Record, speak, and choose Stop and use recording
Then the host finalizes one valid WAV in the approved destination
And the existing pending-import card shows its measured length and engine choices
And nothing transcribes or uploads before I choose an engine

### Scenario: Record and Add recording remain distinct
Given the panel is idle
Then Record uses a microphone icon and Add recording uses a file action
And keyboard/screen-reader names distinguish them without relying on icon or position

### Scenario: Double Stop is idempotent
Given Stop is finalizing a recording
When I activate Stop again or a duplicate stop message arrives
Then only one final file and one pending import are produced
And the UI stays in Saving until the terminal host result

### Scenario: Cancel does not create a library item
Given a valid recording is in progress
When I choose Cancel and confirm if required
Then capture stops and the exact partial follows the approved discard/recovery rule
And no pending import, transcription job, or transcript session is created

## Feature: Permission and device errors (R2)

### ★ Scenario: macOS permission is denied
Given microphone delegation is valid but macOS denies the app
When I choose Record
Then the UI says microphone access is denied
And offers the existing macOS microphone settings action
And creates no successful recording

### ★ Scenario: webview delegation is broken
Given Permissions Policy does not delegate microphone to the Transcribe webview
When I choose Record
Then the UI identifies an internal Ritemark configuration problem
And does not tell me to change System Settings

### Scenario: no microphone exists
Given no audio input device is available
When I choose Record
Then the UI says no microphone was found
And releases any partial capture resources

### Scenario: microphone disconnects mid-recording
Given recording is active
When the media track ends unexpectedly
Then capture stops with a device-lost error
And the host exposes the exact non-empty partial through the approved recovery path

### Scenario: microphone is busy or cannot be opened
Given an input exists but the browser cannot open it
When capture starts
Then the error distinguishes unreadable/busy from missing hardware where the platform permits
And no fake Saved state appears

## Feature: Ordered typed capture (R3)

### ★ Scenario: Ordered chunks finalize exactly
Given a host-created session and chunks 0 through N
When every bounded chunk is accepted in order and Stop declares N
Then the final WAV data length equals the accepted PCM byte count
And measured duration matches the sample count within tolerance

### ★ Scenario: Duplicate chunk is idempotent
Given sequence 4 has been acknowledged
When sequence 4 is delivered again
Then it is acknowledged or ignored as an exact duplicate
And its PCM bytes are not appended twice

### ★ Scenario: Sequence gap never drops silently
Given sequence 7 arrives before sequence 6
When the host validates it
Then it requests bounded replay or fails visibly under the approved rule
And no successful file is finalized with missing audio

### Scenario: stale session message is rejected
Given session A ended and session B is active
When a late chunk/stop from A arrives
Then B is unchanged
And the stale message cannot rename, finalize, or append to either file

### Scenario: second panel tries to record
Given one host recording session is active
When another window/panel requests Record
Then it receives an active-session conflict with a safe action
And a second microphone/file sink is not opened

### ★ Scenario: backpressure prevents memory growth
Given host writes are deliberately slowed
When the webview produces chunks faster than acknowledgment
Then capture pauses/buffers only within the approved bound or fails visibly
And chunks are never silently dropped

## Feature: Destination and file integrity (R4)

### ★ Scenario: single workspace destination
Given one writable workspace is open
When recording begins
Then the proposed `Recordings/Recording YYYY-MM-DD HH-mm-ss.wav` destination is visible
And a collision creates a new safe name rather than overwriting

### Scenario: multi-root workspace requires explicit root
Given several workspace folders are open and no root preference exists
When I choose Record
Then I choose the destination root before microphone capture starts
And that choice determines the session's project scope

### Scenario: no-folder destination is selected first
Given no workspace folder is open
When I choose Record
Then Ritemark obtains an explicit final location or clearly approved managed recovery location before capture
And canceling the choice does not request microphone permission

### ★ Scenario: valid WAV is atomically promoted
Given non-empty PCM chunks were written to a managed `.part` file
When Stop succeeds
Then RIFF/data sizes are patched, the file is closed and validated, and one atomic rename creates `.wav`
And the `.part` path is not shown as a normal recording

### Scenario: final target appears before rename
Given another process creates the target name during recording
When finalization runs
Then Ritemark chooses a collision-safe target or asks explicitly
And never overwrites the other file silently

### Scenario: disk becomes full
Given the filesystem rejects a chunk write or finalization
When recording is active
Then capture stops with a storage error
And any exact recoverable partial is offered honestly without a pending import

## Feature: Existing Transcribe pipeline (R5)

### ★ Scenario: local engine choice stays explicit
Given a recording finalized successfully
When its pending card appears
Then on-device and ElevenLabs availability/cost/privacy behave exactly like an imported WAV
And no engine is selected merely because the audio came from Record

### ★ Scenario: ElevenLabs upload starts only after consent
Given a finalized recording and configured ElevenLabs key
When I have not pressed Transcribe for ElevenLabs
Then no audio leaves the machine
When I choose ElevenLabs and Transcribe
Then the existing upload/job path handles the same final file

### Scenario: clearing pending leaves audio intact
Given a finalized recording is staged but not transcribed
When I clear the pending card
Then the user-owned WAV remains at its destination
And no session is invented

### Scenario: transcription failure leaves recording intact
Given a direct recording enters JobManager
When transcription fails or is cancelled
Then the original WAV is unchanged and can be retried

## Feature: Interruption and recovery (R6)

### ★ Scenario: panel reload during capture
Given recording is active
When the Transcribe webview reloads or is disposed
Then behavior follows the approved detach/interrupt rule
And the host never keeps an unowned invisible microphone session indefinitely
And a non-empty partial is recovered or discardable after reopen

### ★ Scenario: application closes during capture
Given several chunks are durably written
When Ritemark exits unexpectedly
Then restart shows one Recording interrupted item
And Save recovered recording rebuilds/validates a playable WAV before staging it

### Scenario: empty partial is cleaned
Given recording started but no valid audio chunk was accepted
When it is cancelled or recovered after restart
Then no zero-byte/invalid recording is offered as useful audio

### Scenario: discard targets only managed partial
Given recovery shows one interrupted capture
When I choose Discard
Then only that exact managed partial/record is removed
And imported/final user files and transcript sessions are untouched

## Feature: Performance, flag, and closeout (R7, R8)

### ★ Scenario: one-hour stream stays bounded
Given a deterministic one-hour PCM source at the approved format
When it is streamed through the protocol and sink
Then renderer/host memory remains within measured bounds
And final size/duration/sequence count are correct

### ★ Scenario: macOS and Windows real-device capture
Given supported packaged/dev targets
When direct recording is exercised on macOS and Windows
Then permissions, capture, stop, WAV playback/probe, pending import, and cancellation pass
And platform-specific failures use the right recovery copy

### ★ Scenario: flag-off preserves Transcribe
Given `transcribe-direct-recording` is disabled
When I open Transcribe
Then Record and recording messages are unavailable
And Add recording, library, jobs, workbench, and existing audio files remain unchanged

### ★ Scenario: accessibility matrix passes
Given narrow width, keyboard-only use, screen reader, 200% zoom, high contrast, and reduced motion
When I start, observe, stop, cancel, recover, and dismiss recording states
Then every control/state is perceivable and operable without color or animation alone

### ★ Scenario: sprint closes with existing regressions green
Given every ★ scenario, focused tests, existing Transcribe/dictation suites, docs, and repository QA pass
When Sprint 118 closes
Then the release tracker records evidence and no existing import/transcription behavior regressed

# Sprint 108 Scenarios

BDD examples for R1–R13. This file is the source for the Phase 6 manual QA matrix — `tasks.md` refers back here rather than duplicating.

Fixtures needed before QA:
- `short-2spk.m4a` — ~3 min, two speakers, Estonian + English code-switching
- `long-meeting.m4a` — ~60 min, 3+ speakers (the long-run fixture for A1/A2)
- `mono-lecture.mp3` — ~20 min, single speaker
- `broken.m4a` — truncated file
- `screen-recording.mp4` — video container

---

## Feature: Transcribe app and import (R1)

### Scenario: First run with nothing configured
Given no Whisper model is downloaded and no ElevenLabs key is set
When I open Transcribe from the activity bar
Then I see two engine cards with their real state — "Model not downloaded — 1.5 GB, one time" and "No API key — needed for speaker separation"
And each card offers exactly one action: **Download model** and **Add key**
And the drop zone is still present and usable

### Scenario: Import by drag and drop
Given the Transcribe panel is open
When I drag `short-2spk.m4a` onto it
Then the file appears with its real duration and size
And I am asked which engine to use before anything runs

### Scenario: Open an audio file from the Explorer
Given `short-2spk.m4a` sits in my workspace and has no session
When I double-click it in the Explorer
Then the Transcript Workbench opens
And it offers to transcribe the file, with an engine choice

---

## Feature: Job pipeline (R2)

### Scenario: Panel close does not kill the job
Given `long-meeting.m4a` is transcribing at 40%
When I close the Transcribe panel and keep writing in another document
Then the job keeps running
And when I reopen the panel the progress has advanced

### Scenario: Cancel
Given a transcription is running
When I press Cancel
Then the job stops within a few seconds
And any whisper-cli child process is terminated
And temp files for that job are removed
And the recording returns to "Not transcribed"

### Scenario: Quit during a job
Given `long-meeting.m4a` is transcribing
When I quit Ritemark and reopen it
Then the recording is listed as **Interrupted**
And I am offered **Retry** and **Discard**
And no progress bar claims the job is still running

### Scenario: Second import queues
Given a job is running
When I import a second recording
Then it shows as **Queued** and starts when the first finishes

---

## Feature: On-device transcription (R3)

### Scenario: Local transcription of a long file
Given the Whisper model is downloaded on macOS
When I transcribe `long-meeting.m4a` on-device
Then progress advances during the run rather than jumping from 0 to 100
And the finished transcript has timestamped segments
And the process is not killed by a fixed timeout

### Scenario: Local transcript states it cannot separate speakers
Given a completed on-device transcription
When the workbench opens
Then there are no speaker chips
And a row reads "On-device — no speaker separation", with **Re-run with ElevenLabs**
And no segment is attributed to an invented speaker

### Scenario: Live dictation still works
Given I have used file transcription
When I use voice dictation in the editor
Then it behaves exactly as before this sprint

---

## Feature: ElevenLabs transcription (R4)

### Scenario: Consent before upload
Given an ElevenLabs key is configured
When I choose ElevenLabs for a 47-minute recording
Then I am told the audio will be uploaded to ElevenLabs, with the duration and an estimated cost
And nothing is uploaded until I explicitly confirm

### Scenario: Diarized result
Given I confirmed an ElevenLabs transcription of `short-2spk.m4a`
When it finishes
Then segments are attributed to `Speaker 1` and `Speaker 2`
And the header shows the engine, detected language and speaker count

### Scenario: Invalid key
Given the stored ElevenLabs key is wrong
When I start a cloud transcription
Then I see a message saying the key was rejected, with a link to Settings
And no raw 401 or JSON body is shown
And the job is marked failed, not stuck

### Scenario: Rate limited or out of quota
Given ElevenLabs returns 429 or a quota error
When the job fails
Then the message says which of the two happened and what to do
And **Retry** is offered

---

## Feature: Audio preparation (R5)

### Scenario: Video file is refused with guidance
Given I drop `screen-recording.mp4`
Then it is refused with a message saying video isn't supported yet, and to export the audio track
And the panel does not show it as a failed transcription job

### Scenario: Broken file
Given I drop `broken.m4a`
When preparation runs
Then I get a message that the file could not be read as audio
And no partial session is created

### Scenario: Peaks computed once
Given a recording has been imported
When I close and reopen its workbench tab
Then the waveform renders immediately from stored peaks
And the audio is not decoded again

---

## Feature: Workbench and playback (R6, R7)

### Scenario: Click a line to hear it
Given a completed transcript is open
When I click the segment at 12:04
Then the audio seeks to 12:04 and plays
And that segment is highlighted

### Scenario: Auto-scroll follows playback, then yields
Given the audio is playing
Then the active segment stays in view
When I scroll up manually
Then auto-scroll stops
When I click another segment
Then auto-scroll resumes from there

### Scenario: Playback speed
When I set speed to 1.5×
Then the audio plays faster with no pitch artefacts that make speech unintelligible
And the setting persists for that session

### Scenario: Audio file is not copied
Given a recording has been transcribed
Then no copy of the audio exists in the extension's global storage
And playback reads the original path

---

## Feature: Speakers (R8)

### Scenario: Rename applies everywhere
Given a diarized transcript with `Speaker 2` in 34 segments
When I rename `Speaker 2` to `Jarmo`
Then all 34 segments show `Jarmo`
And the chip, the transcript and a later export all agree

### Scenario: Rename persists
Given I renamed a speaker
When I close the tab and restart Ritemark
Then the rename is still applied

### Scenario: Unassigned segments
Given the engine left 3 segments unattributed
Then an **Unassigned · 3** chip is shown
And those segments are visibly distinct from attributed ones

---

## Feature: Confidence (R9)

### Scenario: Low-confidence words are marked
Given an ElevenLabs transcript containing a mis-heard proper noun
Then that word is highlighted with a dotted amber underline
And hovering explains that the engine was unsure

### Scenario: No confidence data on-device
Given an on-device transcript
Then no confidence highlighting appears anywhere
And the UI does not present an empty confidence affordance

---

## Feature: Insights (R10)

### Scenario: Generate and cite
Given a completed transcript
When I generate insights
Then Summary, Decisions, Action items and Key quotes appear
And each item carries a timestamp
When I click a timestamp
Then the audio seeks there and the transcript scrolls to it

### Scenario: Insights are labelled as generated
Then the rail states that the content is AI-generated and names the model used

### Scenario: No runtime configured
Given no agent runtime is configured
When I open the insights rail
Then it explains what to configure and links to Settings
And it does not show a spinner that never resolves

---

## Feature: Export (R11)

### Scenario: Automatic export on completion
Given a transcription completes
Then a `.md` is written to the configured location without me asking
And the panel row links to it

### Scenario: Manual export after corrections
Given I renamed speakers and generated insights
When I press **Export to Markdown**
Then the written file contains the corrected names, timestamps, front matter and the insights
And it opens in the Ritemark editor

### Scenario: Re-export does not silently overwrite
Given an export already exists for this recording
When I export again
Then I am asked whether to overwrite, or a numbered sibling is written

---

## Feature: Sessions (R12)

### Scenario: Corrections survive a restart
Given renames and insights on a session
When I restart Ritemark and reopen the recording
Then everything is restored

### Scenario: Audio file moved
Given I move the audio file to another folder
When I open Transcribe
Then the session is shown as unlinked with a way to relocate the file
And the transcript data is not deleted

### Scenario: Delete a session
When I delete a session from the panel
Then its stored data is removed
And the original audio file and any exported `.md` are untouched

---

## Feature: Platform and failures (R13)

### Scenario: Windows
Given I am on Windows
When I open Transcribe
Then the on-device card reads "Not available on Windows yet" and links to #133
And ElevenLabs transcription works end to end
And nothing in the UI is a dead control with no explanation

### Scenario: Offline with a cloud engine
Given I am offline
When I choose ElevenLabs
Then I am told before any upload attempt that a connection is required
And the on-device engine is offered instead where available

### Scenario: Not enough disk for the model
Given the disk has less free space than the model needs
When I press **Download model**
Then I am told how much is needed and how much is free
And no partial download is started

### Scenario: Feature flag off
Given `transcription-workbench` is disabled
Then the activity-bar item is absent
And audio files do not claim a custom editor
And no transcription code path runs

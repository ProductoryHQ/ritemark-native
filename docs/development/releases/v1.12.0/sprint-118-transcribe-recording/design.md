# Sprint 118 Design — Direct Recording in Transcribe

**Status:** Draft for Phase 0 approval<br>
**System:** Ritemark Indigo-Editorial<br>
**Scope:** Start/Stop/Cancel, destination, permission, saving, recovery, and handoff to existing engine choice

## User Model

- **Record** creates an audio file; it does not start transcription.
- **Stop and use recording** saves the file and places it into the same engine-choice card as Add recording.
- **Cancel** abandons the capture under the approved partial-file rule.
- The engine card remains the only point where cloud upload/cost consent is given.

## Idle State

```text
TRANSCRIBE

┌──────────────────┐ ┌──────────────────┐
│ ● Record         │ │ + Add recording  │
└──────────────────┘ └──────────────────┘

Library and existing jobs continue below.
```

At narrow width the two actions stack, Record first. They remain visually equal entry paths; Record is not a destructive/emergency red button.

## Recording State

```text
┌──────────────────────────────────────┐
│ ● Recording                    12:34 │
│ Recordings/Recording 2026-09-13…wav  │
│ About 24 MB written                  │
│                                      │
│ [Cancel]      [■ Stop and use]       │
└──────────────────────────────────────┘
```

- Use a restrained live indicator plus text; reduced motion removes pulse.
- Elapsed time is prominent. Size is approximate and must not claim bytes are safe beyond the host-acknowledged rule.
- Existing jobs/library remain visible but Record cannot start a second session.
- No Pause, waveform, meter, device selector, or engine selector in this state.

## Saving and Success

```text
┌──────────────────────────────────────┐
│ Saving recording…              12:34│
│ Finalizing and checking the audio    │
└──────────────────────────────────────┘
```

Stop/Cancel are disabled while the host patches, closes, validates, and promotes the file. Success transitions directly to the existing pending-import card:

```text
Recording 2026-09-13 14-32-08.wav
12 min

( ) On-device …
( ) ElevenLabs …
                       [Cancel] [Transcribe]
```

The normal engine/privacy/cost copy is reused unchanged.

## Permission and Device Errors

| Case | Copy direction | Action |
|---|---|---|
| OS denied | Microphone access is denied for Ritemark. | Open Microphone Settings (macOS where valid) |
| no device | No microphone was found. | Retry after connecting one |
| device lost | The microphone disconnected. | Recover/discard partial if available |
| busy/unreadable | Ritemark could not open this microphone. | Retry |
| delegation/build | Recording is blocked by an internal configuration error in this build. | Update/report; no OS-settings blame |
| storage | Recording stopped because the file could not be written. | Recover/discard if valid partial exists |

Raw DOM/provider/filesystem errors never appear directly.

## Interrupted Recovery

```text
NEEDS ATTENTION

Recording interrupted · about 18 min
Ritemark closed before the file was finalized.
[Discard] [Save recovered recording]
```

Recovery is shown once per exact managed partial. Save recovered recording rebuilds and validates the WAV, then stages the existing pending card. Discard never targets a finalized or imported file.

## Active Session Conflict

If another Ritemark panel/window owns capture:

> A recording is already in progress. Return to that Transcribe panel to stop or cancel it.

No second permission request or file is created. Phase 0 decides whether an **Open recording** action can safely reveal the owner.

## Accessibility and Focus

- Record receives focus after panel entry only under normal navigation rules, not by stealing focus on state pushes.
- Starting announces “Recording started”; Stop announces “Saving recording”; terminal states announce once politely.
- Stop is always reachable without hover; Cancel has explicit wording and confirmation only if meaningful audio exists.
- Validate 280–480 px panel widths, 200% zoom, keyboard, screen reader, high contrast, reduced motion, long destination names, and long elapsed times.

## Phase 0 Decisions for Jarmo

- [ ] Approve separate Record/Add actions and responsive stacking.
- [ ] Approve Start/Stop/Cancel only; no Pause in v1.11.
- [ ] Approve visible destination, timer, acknowledged-size wording, and non-red live state.
- [ ] Approve saving/no-interruption state and transition to existing pending card.
- [ ] Approve permission/device/storage copy and interrupted recovery card.
- [ ] Approve one-active-session conflict behavior.

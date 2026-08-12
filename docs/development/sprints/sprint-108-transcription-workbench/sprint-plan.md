# Sprint 108 — Transcription Workbench

**Track:** SDD (spec-driven)
**Status:** Phase 0 complete (2026-08-12) — audits passed, spec revised. Phase 1 not started.
**Branch:** `sprint-108-transcription-workbench`
**Release:** not assigned — not v1.9.0 (Cloud). Proposed v1.10.0.
**Source vision:** [`docs/development/analysis/2026-08-12-audio-transcription/vision.md`](../../analysis/2026-08-12-audio-transcription/vision.md)
**Selected UI:** Option B — Transcript Workbench ([prototype](../../analysis/2026-08-12-audio-transcription/prototypes/b-transcript-workbench.html))

## What this sprint delivers

Ritemark gets **Transcribe**: an activity-bar app and a dedicated workbench editor that turn a recording into a corrected, speaker-attributed transcript and then into markdown — without OneDrive, Word, or a browser.

Drop an audio file → it transcribes on-device (Whisper) or via ElevenLabs Scribe when you need to know who spoke → the workbench opens with a waveform player, a speaker-separated transcript you can click to hear, one-click speaker renaming, and an insights rail → **Export to Markdown** puts a clean `.md` in the workspace.

## Product decisions (2026-08-12, Jarmo)

| # | Decision | Consequence |
|---|---|---|
| D1 | **Option B — Transcript Workbench** | Custom editor surface + audio pipeline; A and C not built |
| D2 | **One sprint, everything** | Largest sprint in recent history — 13 requirements, ~5 subsystems. Recorded as a deliberate call; see Risk below |
| D3 | **On-device = no speakers, stated plainly** | No LLM speaker-guessing. Local transcripts are one track; the workbench offers "Re-run with ElevenLabs" |
| D4 | **Windows ships, ElevenLabs-only** | On-device engine card reads "Not available on Windows yet" → [#133](https://github.com/ProductoryHQ/ritemark-native/issues/133). No Windows Whisper build in this sprint |
| D5 | **Sessions live in extension global storage** | Not sidecar files. Mitigation in R11: a markdown export is written automatically on completion, so a transcript is never *only* in the hidden store |
| D6 | **Audio only, no video** (Claude's call, stated assumption) | `.mp4`/`.mov` rejected with an actionable message; no ffmpeg bundled — avoids a new notarization surface |

## MVP scope

- **R1** Transcribe activity-bar app · **R2** job pipeline + persistence · **R3** on-device Whisper file engine · **R4** ElevenLabs Scribe engine · **R5** audio preparation + peaks · **R6** workbench custom editor · **R7** synced playback · **R8** speaker chips + global rename · **R9** low-confidence highlighting · **R10** insights rail · **R11** markdown export · **R12** session store · **R13** platform and failure honesty

Full acceptance criteria in [spec.md](spec.md).

## Explicitly out of scope

Live meeting / system-audio capture · real-time streaming transcription · translation · video files · Windows local Whisper (#133) · batch import of many files at once · cloud storage or sharing of recordings · ElevenLabs speaker library / voice fingerprints · multi-channel per-speaker tracks.

## Risk register

*(updated 2026-08-12 after Phase 0 — three of the six risks are retired.)*

| Risk | Status | Notes |
|---|---|---|
| **Large-file audio transfer** | ✅ **Retired** | [A1](research/audio-transfer-audit.md): whisper-cli reads mp3/wav/flac/ogg natively; `afconvert` converts m4a host-side in 1.2 s per 60 min. Nothing crosses the bridge. An entire implementation strategy was deleted. |
| **whisper-cli long-run behaviour** | ✅ **Retired** | [A2](research/whisper-longrun-audit.md): 23.5× realtime, clean SIGTERM, flag set fixed. One new trap found and handled — undecodable audio exits **0**. |
| **Audio playback inside a webview** | ✅ **Retired** | [A3](research/webview-audio-audit.md): verified live — 223 ms seek to 45:00 in a 42 MB file, range requests served. Fallback plan deleted. |
| **Sprint size (D2)** | ⚠️ **Live, reduced** | Still 13 requirements, but Phase 0 removed the webview decode path, the chunked transfer protocol and the range-serving fallback. Mitigation unchanged: per-workstream commits. |
| **Webview bundle size** | ⚠️ **Live** | Already ~7.6 MB ([#107](https://github.com/ProductoryHQ/ritemark-native/issues/107)). No waveform library — peaks computed once at import. New surfaces lazy-loaded. Size reported in Phase 7. |
| **ElevenLabs cost surprises** | ⚠️ **Live** | Cost estimate + explicit consent before any upload (R4); engine and cost recorded on the session. |
| **Speaker identity across a long file** | 🆕 **New, handled** | [Prior art](research/elevenlabs-prior-art.md): `speaker_id` is per-request, so windowing a meeting renumbers speakers. Sprint 108 sends one request and trades granular progress for correct attribution. |

## Success criteria

- [ ] A 45-minute `.m4a` dropped on the panel produces a speaker-attributed transcript with ElevenLabs, and a single-track transcript on-device
- [ ] Clicking any line plays the audio from that point; the playing line highlights
- [ ] Renaming `Speaker 2` once renames it in every segment and in the exported markdown
- [ ] Export writes a clean `.md` into the workspace that opens in the Ritemark editor
- [ ] Closing the panel does not kill a running job; quitting mid-job reports it honestly on restart
- [ ] On Windows the app works with ElevenLabs and says plainly why on-device is unavailable
- [ ] No API key / offline / video file / no model each produce a designed message with a next action — never a raw error code
- [ ] `pre-commit-validator.sh` green; `qa-validator` green; architecture.md updated

## SDD Artifacts

- [spec.md](spec.md) — the behaviour contract (R1–R13)
- [scenarios.md](scenarios.md) — BDD examples, incl. negative paths (the QA matrix)
- [technical-plan.md](technical-plan.md) — architecture and workstreams
- [tasks.md](tasks.md) — implementation checklist
- `research/` — Phase 0 audits A1–A3 (written before implementation)

## Architecture gate

This sprint adds a new subsystem (`src/speech/`) and a new editor surface. Per CLAUDE.md it needs the Sprint Architecture Gate before Phase 3. The proposal — a `TranscriptionEngine` interface + registry mirroring the existing `AgentRuntime` pattern, with its own engine registry rather than folding STT engines into `ai/modelConfig.ts` — is argued in [technical-plan.md](technical-plan.md) § Architecture Overview.

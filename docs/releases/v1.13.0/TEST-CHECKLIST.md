# Ritemark 1.13.0 Test Checklist

> **Released 2026-10-11 as v1.13.0 (first candidate).** Source commit `1abac303d4bbebddcdaa0fab1eb647b01370abd3` (tag `v1.13.0`). Closeout evidence is in [`evidence/`](evidence/closeout.md).

Release: Minor Improvements ([release plan](../../development/releases/v1.13.0/release-plan.md)). Candidate source commit `1abac303d4bbebddcdaa0fab1eb647b01370abd3` (`main` frozen from this commit until publish).

**Shell-tier:** #386 updates the bundled agents (Claude Code 2.1.289 / Agent SDK 0.3.289, Codex 0.160.0, OpenCode 1.18.34), so this is a full app rebuild: Gate 1, Gate 2, notarization after the 60-minute hardening wait.

## What is new, and therefore what has to be exercised

| Change | Where it is tested |
|---|---|
| #386 Claude Code 2.1.289, Codex 0.160.0, OpenCode 1.18.34; Sonnet 5.5 the recommended Claude model | Gate 1, and **Gate 2 for the new agents on x64 and Windows** |
| Sprint 128 (#394) Claude background work: honest status, Claude's follow-up turn, per-task stop, Ask mode covers background work | Gate 1 |
| #379 Codex model list ignores other Codex versions' caches; new Codex chats start on GPT-5.6 Sol | Gate 1 |
| #380 Word count, Contents, comment markers follow agent and disk edits | Gate 1 |
| #381 / #389 Conversation list and Transcribe library rows; one More actions (…) menu; rename recordings | Gate 1, and **Gate 2 for rename on Windows** |
| #382 / #387 Composer menus beside the rail; narrow side bar footer | Gate 1 |
| #385 Send uses the Claude model you picked after a switch from Codex | Gate 1 |
| #370 Word preview pads unstyled table cells | Gate 1 |

## RC1 — 2026-10-05 (released)

Built in `.worktrees/release-1abac303d4bb`, a clean-room release worktree at `origin/main`.

| Platform | Built | Signed | Notarization | Published asset |
| --- | --- | --- | --- | --- |
| macOS arm64 | locally, DMG 2026-10-05 14:47 EEST | `JKBSC3ZDT5`, hardened runtime; 52 components, 0 failures; `codesign --verify --deep --strict` passes | `df9d4177-b1c6-4363-a0c5-e009c2e80da4`, Accepted 2026-10-08, stapled | `Ritemark-arm64.dmg`, 652,695,664 bytes, SHA-256 `7fe788304ab04dfb3cb0645247c62292e7aaa50123113addd34ad02f5a333c3e` |
| macOS x64 | CI run `37299068682`, signed here against `RITEMARK_RELEASE_COMMIT`, DMG 2026-10-07 21:06 EEST | 50 components, 0 failures; `JKBSC3ZDT5`, hardened runtime; `codesign --verify --deep --strict` passes | `bbdd8041-8b9a-4bcc-a015-245a28fb93de`, Accepted 2026-10-11, stapled | `Ritemark-x64.dmg`, 694,047,555 bytes, SHA-256 `499da5b8e1a65025d152329c6d2ab49feb06e8051875d21a2552bea51dcec688` |
| Windows x64 | CI run `37299072290` | Productory Services OÜ; standard-user roundtrip `passed` | not applicable | `Ritemark-Setup.exe`, 465,986,944 bytes, SHA-256 `08eb2f169206ec446b57006e22134743b9d2ce4049adee2dd6fa19f06afc58bc` |

Published 2026-10-11T14:20:40Z as Latest on `jarmo-productory/ritemark-public`, with `update-feed.json` (23 releases, v1.12.0 and every older entry retained).

The first arm64 notarization attempt, on 2026-10-07, was refused with HTTP 403 because Apple's updated Developer Program License Agreement had not been accepted. Apple rejected the request before accepting the DMG, so the DMG was unchanged. Jarmo accepted the agreement on 2026-10-08 and the retry was Accepted. `notarize-dmg.sh` exited 0 on the refusal; that script defect is tracked for after the release.

## Automated checks (before handover)

- [x] `build-prod.sh` passed its source gate and built clean from `1abac303`
- [x] `media/webview.js` and `media/office-preview.js` in both built apps (arm64 and x64) are byte-identical to the release source; 0 zero-byte `.js` under `out/` (rechecked at closeout, 2026-10-11)
- [x] Embedded provenance records `sourceCommit=1abac303`; `ritemarkVersion` is `1.13.0` in both built apps (rechecked at closeout)
- [x] `scripts/check-google-oauth-build.mjs` passes on the built extension
- [ ] `(cd extensions/ritemark && npm run check:anthropic-models)` OK, no warnings: no result was recorded at handover. The runtime review (2026-10-04) found Sonnet 5.5 missing, and #386 added it
- [x] `./scripts/verify-agent-runtimes.sh` on the release Mac: Claude Code 2.1.289, Codex 0.160.0, OpenCode 1.18.34 match the manifest. The OpenCode gate passed 4/4 with a free model named through `RITEMARK_VERIFY_OPENCODE_MODEL`; the first free model the probe picks did not answer, as for v1.12.0
- [x] macOS x64 (`37299068682`) and Windows (`37299072290`) CI green on `1abac303`; Windows CI Canary (`37319843137`) green on the same commit

## ⛔ Gate 1 — Jarmo, on the installed arm64 DMG (un-notarized)

Gatekeeper will warn: right-click → **Open**, or `xattr -dr com.apple.quarantine '/Applications/Ritemark.app'`.

### Agents and models (#386)
- [ ] Claude menu shows **Sonnet 5.5** as recommended; a conversation on Sonnet 5.5 answers
- [ ] A Claude conversation on Opus 5.5 answers
- [ ] Codex: a new conversation starts on GPT-5.6 Sol and answers; the menu offers the GPT-6 models your account has
- [ ] OpenCode: a short task asks before writing (Ask mode) and writes after approval

### Claude background work (Sprint 128)
- [ ] Ask Claude to do something with a background subagent (e.g. "Launch a background subagent that runs `sleep 40; echo done`, reply launched"): the card says **Running in the background**, the status line **Done — 1 task still running in the background**
- [ ] When it finishes, a turn **A background task finished — Claude is continuing** appears with Claude's answer, the card ends ✓, the status line is plain **Done**
- [ ] The card's stop button ends the task as **Stopped**; Claude explains in a follow-up
- [ ] **Main Stop while a background task runs**: the turn stops, the status line says **Stopped — 1 task still running in the background**, the task keeps going
- [ ] Ask mode: a background subagent that wants to write a file asks for approval; rejecting it writes nothing
- [ ] Switching model while a task runs asks first (**Keep current model** keeps everything); after **Switch**, "1 background task ended with the session."

### Everyday fixes
- [ ] Codex (#379): with another Codex app installed, the menu shows no model Ritemark's Codex cannot run
- [ ] Word count (#380): let an agent append text to an open document — the status bar count and Contents update without typing; the count follows the active tab and hides on a non-Markdown tab
- [ ] Conversations list (#381): long titles wrap to two lines; the row's **…** menu has Rename…, Pin, Delete; right-click shows the same
- [ ] Composer (#382/#387): the permission and model menus are not hidden under the rail at the default width; in a narrow side bar Send stays visible
- [ ] Model after a runtime switch (#385): Claude → Codex → another Claude model: the button and the answer use the new Claude model
- [ ] Transcribe (#389): rows show title, date · length; **…** and right-click menus; **Rename…** renames the file (extension kept), from the list and from the transcript header; the open transcript reopens under the new name
- [ ] Word preview (#370): a generated .docx with an unstyled table shows padding inside cells

**Gate 1 verdict:** passed. Jarmo, 2026-10-07, *"Gate 1 on läbitud!"*, on the arm64 DMG with SHA-256 `3658c952c101ac14262b97d120076c5df58e84148d63ef8620ecb84af4f446ca` before stapling. The verdict was given for the gate as a whole; individual items above were not reported separately.

## ⛔ Gate 2 — Jarmo, on the un-notarized x64 DMG and the Windows installer

- [ ] x64: app opens; Claude (Sonnet 5.5) and Codex answer; a background subagent completes and its follow-up turn appears
- [ ] Windows: installer runs; Claude and Codex answer; OpenCode asks before writing; Transcribe **Rename…** works; Codex sandbox commands run (Windows helpers)

**Gate 2 verdict:** passed. Jarmo, 2026-10-11, in the Development manager session: Jarmo had tested it and asked to approve (*"ma testisin ära"*), on the x64 DMG with SHA-256 `971dda08dae21af7990a1ed3006bc0d1c91aaa2537025afcf5852dfb0172391c` before stapling and the Windows installer above. The verdict was given for the gate as a whole; individual items above were not reported separately. Jarmo's word to publish followed in the same session (*"publish 1.13"*).

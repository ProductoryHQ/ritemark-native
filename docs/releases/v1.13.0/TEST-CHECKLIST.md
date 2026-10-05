# Ritemark 1.13.0 Test Checklist

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

## Automated checks (before handover)

- [ ] `build-prod.sh` passed its source gate and built clean from `1abac303`
- [ ] `media/webview.js` and `media/office-preview.js` in the built app match the release source; 0 zero-byte `.js` under `out/`
- [ ] Embedded provenance records `sourceCommit=1abac303`; `ritemarkVersion` is `1.13.0`
- [ ] `scripts/check-google-oauth-build.mjs` passes on the built extension
- [ ] `(cd extensions/ritemark && npm run check:anthropic-models)` OK, no warnings
- [ ] `./scripts/verify-agent-runtimes.sh` on the release Mac: Claude Code 2.1.289, Codex 0.160.0, OpenCode 1.18.34; OpenCode gate 4/4 (with `RITEMARK_VERIFY_OPENCODE_MODEL` if the first free model is unavailable)
- [ ] macOS x64 and Windows CI green on `1abac303`

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

## ⛔ Gate 2 — Jarmo, on the un-notarized x64 DMG and the Windows installer

- [ ] x64: app opens; Claude (Sonnet 5.5) and Codex answer; a background subagent completes and its follow-up turn appears
- [ ] Windows: installer runs; Claude and Codex answer; OpenCode asks before writing; Transcribe **Rename…** works; Codex sandbox commands run (Windows helpers)

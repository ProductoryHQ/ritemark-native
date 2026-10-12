# Sprint 129 QA Evidence

## Mac (Apple silicon) dev instance — 2026-10-12 (Phase 4, scenarios marked M)

**Setup:**
- A dev instance of this worktree (`vscode/` copy-on-write cloned from main at gitlink `10c8e557`, canonical patches applied, `transpile-client`).
- The extension compiled from branch head `a1c55e14` plus the dialog focus fix below.
- Fresh profile, CDP on port 9339 (not the shared 9224), driven by a scratch CDP script.
- The engine is the committed `binaries/darwin-arm64/whisper-cli` (static, macOS 12+). The model is the one already on this Mac.

| Check | How | Result |
|---|---|---|
| Dictation end to end with the new engine (R11, R8) | `dictation:start`, two 5.5 s chunks of `jfk.wav`, then `dictation:stop`, posted through the editor webview's own bridge right after a real click at the end of a paragraph | Both texts inserted at the cursor, in order. The second chunk arrived while the first was transcribing and was held, not dropped. `idle` came only after the last text (Stop flush). Calls took 9.6 s (cold model and Metal) and 1.6 s |
| Microphone blocked on macOS (R5) | `getUserMedia` made to reject with `NotAllowedError`, then the real mic button | **Microphone Access Is Off**, with the macOS steps, **Try Again** and **Open Microphone Settings** ([qa/mac-mic-blocked.png](qa/mac-mic-blocked.png)). Try Again re-ran the start (the dialog came back while still blocked); X closed it and the button returned to idle |
| Host-reported problems (R6) | `dictation:problem` dispatched in the webview | engine-cpu, engine-missing: **Dictation Can't Start** + Close. engine-blocked: Close + Try Again. engine-failed: **Dictation Stopped** + Close + Try Again. model-missing: **Speech Model Needed** + Close + Download Speech Model ([qa/mac-model-missing.png](qa/mac-model-missing.png)) |
| Transcribe on-device with the new engine (R3, R11) | `jfk.wav` opened from the Explorer → Transcribe with On-device · Whisper | Engine ready, correct transcript with waveform and word timing ([qa/mac-transcribe-on-device.png](qa/mac-transcribe-on-device.png)) |

**Found and fixed during the check:** the new tooltip on the dialog's X popped up every time a dialog opened, because Radix focuses the first button and a tooltip opens on focus. `ui/dialog.tsx` now focuses the dialog itself on open, so screen readers announce its title, unless a dialog passes its own `onOpenAutoFocus`. Re-checked: no tooltip on open.

**Seen, not caused by this sprint (follow-up):** opening a `.wav` from the Explorer shows VS Code's "There are multiple default editors available for the resource." Ritemark's Transcript Workbench and the built-in media preview both claim audio files, and `branding/product.json`'s `workbench.editorAssociations` has no audio entries. This branch does not change either.

**Not covered here:** Windows (branch test, stage B), the Windows microphone wording (unit-tested in `dictationProblems.test.ts`), and macOS 12–13 hands-on (no hardware; CI runs the engine on macOS 14).

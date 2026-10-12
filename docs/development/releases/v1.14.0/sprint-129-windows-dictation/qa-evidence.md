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

## Mac dev instance, "speak, then text" and live mode (2026-10-12, R12, R13, R8)

**Setup:** the same dev instance method as above, with the branch's working tree after merging `main` (#410). The microphone was replaced in the webview by a looping recording of `jfk.wav`, so the real hook, button and placeholder ran end to end. The mic button was clicked with real mouse events. "Speak, then text" was forced with `RITEMARK_DICTATION_MODE=deferred`, the QA switch; on this Mac it changes the mode only, not the model.

| Check | Result |
|---|---|
| Recording (deferred) | The placeholder "🎤 Recording... your text appears after you stop" at the cursor; nothing else changed in the document for 32 s; no `processing` status ([qa/mac-deferred-recording.png](qa/mac-deferred-recording.png)) |
| Background piece | One 28 s piece was transcribed during recording. Its text was held, and its duration fed the estimate |
| After Stop (deferred) | `finishing` with `waitSeconds: 10`; the button disabled with a spinner; the placeholder "⏳ Processing your recording. This usually takes about 10 seconds." ([qa/mac-deferred-processing.png](qa/mac-deferred-processing.png)) |
| Text (deferred) | One `dictation:transcription` 2.6 s after Stop, with both pieces in order, then `idle` ([qa/mac-deferred-done.png](qa/mac-deferred-done.png)) |
| Settings (deferred) | The chunk row is hidden ([qa/mac-deferred-settings.png](qa/mac-deferred-settings.png)) |
| Live mode | Text appears every ~5 s, and "🎤 Listening..." moves to after each new text. After Stop: "⏳ Adding your last words...", the button disabled until the last words are in, then `idle`. Settings shows "Update text every / How often new text appears while you speak" |

| The note never reaches the file (found and fixed in this check) | Ritemark autosaves 1 s after each edit (`files.autoSaveDelay`), and the note used to be document text, so it was written into the `.md` file for the whole recording. The note is now an editor decoration (`extensions/DictationPlaceholder.ts`). Re-checked by reading the file on disk: during a deferred recording, at 6 s and at 32 s, it held only `Text goes here:`; after Stop, only the dictated text. In live mode the file held only the text as it arrived, never "Listening..." or "Adding your last words...". When the first background piece (a cold model load) was still running at Stop, the note said "This can take up to a minute.", the intended fallback when nothing has been measured yet |

The first deferred run used Estonian on English audio, so its last piece came out as "Kõige, kõige." (visible in the "done" screenshot); a second run in English was clean. Both runs show the expected piece-boundary effect: a word pair cut at 28 s ("your country | can do for you"). This is the boundary loss measured in the performance audit; cutting at pauses is the follow-up for it.

**Not covered here:** the start-up cancel (model already present, so the "preparing" window was too short to click into; covered by code reading); the "Still processing" line (needs a slow computer; unit-tested copy); tooltips by hover (CDP hover did not open the Radix tooltips; their text is unit-tested in `dictationProblems.test.ts`); Windows (branch test).

## qa-validator review and fixes (2026-10-12)

The first `qa-validator` review (HEAD `4aa74cb8`) returned **BLOCK** with two defects. Both are fixed:

- **B1: a transcription that throws left the button disabled forever.** A full disk, or a process that can't start, made `drain()` reject. Stop then never posted `idle`, and the button stayed in "finishing". Now the call is wrapped: dictation stops with **Dictation Stopped**, and Stop posts `idle` in a `finally`. `controller.test.ts` covers both modes with a transcriber that throws ENOSPC.
- **B2: one dictation controller was shared by every editor tab.** After dictating in tab A, tab B's text and status went to tab A, so tab B's button never left "finishing". There is now one controller per webview, removed when its tab closes.
  - Checked on the Mac dev instance: dictate in `Dictation test.md`, then in `Second.md`. Each tab got its own `listening → finishing → idle`, and its button came back. Each file on disk holds its own dictated text, and tab A received nothing from tab B.

Also fixed from the review:
- Failed calls no longer feed the wait estimate.
- whisper's output is read on `close`, not `exit`.
- Temp file names are unique per call.
- **Remove** clears every speech model Ritemark downloads, so an Intel Mac's old 1.5 GB file doesn't stay behind.
- The settings dialog's Remove and Yes/No are shadcn `Button`s with tooltips.
- Two stale "macOS-only" comments were corrected.

**Test-setup note:** a dev window covered by other windows reports `visibilityState: hidden` and stops rendering. Its editors then can't confirm a document update in time: `apply-error`, a **Retry document update** button, and edits that aren't saved. That is the known occlusion effect, not a product defect. Launch with `--disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-background-timer-throttling`, placed after the folder argument (`code.sh` would otherwise take the folder as a flag's value). Audio also needs one real mouse click into the webview first.

**Since fixed on main:** the "multiple default editors" note for `.wav` files seen above is fixed by #412.

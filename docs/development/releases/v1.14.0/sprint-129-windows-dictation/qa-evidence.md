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

## Windows branch test, stage B (2026-10-12)

Run by the "Ritemark on Windows" session with Jarmo at the PC, relayed by the Development manager. Overlay artifact 11756844647 (`d38be0ad`) over the installed 1.13.0; Ryzen 7 5825U, built-in Realtek microphone.

| Scenario | Result |
|---|---|
| Model offer and download | "Download voice model (834 MB)?", then "Voice model ready!". The file is 874,188,075 B with the right SHA-256, and Transcribe On-device used it |
| Resume | Paused at 33%: "Resume download? (313/834MB done)"; it continued from the `.partial` file |
| Engine missing | In a fresh window, the dialog at once and no download offered |
| English dictation | 97 words (33.7 s), WER 6.2%, in order, last sentence present. Estonian: "eesti keelt testisin varem see oli ok" (Jarmo) |
| Transcribe | A 4:27 WAV (the FLEURS stream) at 16.6% WER; a 22 s recording worked |
| m4a | Pass |
| Microphone access off (fresh window) | "Microphone Access Is Off", **Try Again**, and **Open Microphone Settings** opened the right page |
| Recording copy and tooltips | As built; the document didn't change while recording |
| Processing | Spinner, button disabled, the note with the estimate (table below) |
| Typing elsewhere while it processes | Pass |

Estimate shown against the actual wait:

| Recording | Shown | Actual |
|---|---|---|
| 27.0 s | "up to a minute" | 29.4 s |
| 65.9 s | about 60 (flashed "up to a minute" first) | 43.7 s |
| 42.4 s | about 50 | 42.0 s |
| 26.7 s | about 30 | 32.1 s |
| 33.7 s | about 70 | 50.3 s |
| 10.2 s | about 30 | 29.7 s |
| 19.0 s | about 30 | 34.5 s |

**Not run:** MP3 Transcribe, cancelling a transcription, no microphone, microphone in use, and the two-minute recording on a busy CPU.

**Bugs found, all fixed in this sprint (R14):**
- **C:** a hardware-muted microphone's silence became invented text, with no message. Reproduced on the Mac: 28 s of zeros gave "Kõige!" (et) and "you" (en).
- **B:** with microphone access turned off after the window had dictated, there was no dialog; it "recorded", processed and inserted nothing.
- **A:** the resume prompt slid into the notification centre, and the mic then seemed to do nothing.
- **D:** an engine removed after the readiness check was found only after Stop, under a "Can't Start" title.
- The two estimate issues (the running call counted whole, and the "up to a minute" flash) are fixed too.

## Mac dev instance after the R14 fixes (2026-10-12)

Deferred mode via the QA switch, launched with the anti-backgrounding flags. Audio was started after one real click into the editor.

| Check | Result |
|---|---|
| Muted microphone (a stream of exact zeros) | The button read **Transcribe now**. About 3 s later recording stopped by itself: `finishing`, `mic-silent`, `idle`. **Ritemark Heard Nothing** offered **Try Again** and **Open Microphone Settings** ([qa/mac-heard-nothing.png](qa/mac-heard-nothing.png)). Nothing was inserted, and the file was unchanged |
| Real speech (English) | **Transcribe now** while recording; **Transcribing…**, disabled, right after Stop ([qa/mac-transcribing-label.png](qa/mac-transcribing-label.png)); then **EN**, with the text in the file. The note said "This can take up to a minute.", correct with no call measured yet |
| Engine removed after a dictation in the same window | The next mic click showed "Dictation Can't Start" before any recording. The engine file was restored, and git shows it unchanged |
| Silence on the Mac engine before the fix | 28 s of zeros gave "Kõige!" (et) and "you" (en); faint hiss gave "Kõige." / "so". Now such audio is never sent to the engine |
| Console | Radix warned that the problem dialog's description was missing (Sprint 129 code: it overrode the description id). Fixed and re-checked: `aria-describedby` points at the description, and the warning is gone |

**Not checked by hand:** the modal download/resume prompt. The model was present, and it is a VS Code API option; the Windows re-test covers it.

## Windows re-test 1 (2026-10-12, `72cf3c18`) and the follow-up fixes

Run by the "Ritemark on Windows" session, relayed by the Development manager: artifact 11766506167, branch extension 1.99.1791829794. The laptop's hardware mute key stayed on for the whole run and Jarmo was away, so "pause with speech" and B (stale access) could not run.

| Item | Result |
|---|---|
| A, prompt can't hide | **Pass.** Native Windows task dialogs for both offers. Resume opened every time after focus moved away; it continued from 34.5 MB to 40.3 MB |
| D, engine gone in an open window | **Pass.** "Dictation Can't Start" at once, with no recording |
| Labels | **Pass.** **Transcribe now**, then **Transcribing…** (disabled), then **ET**; no "up to a minute" flash. "Estonian" showed for ~0.3 s during the start-up check |
| Transcribe | **Pass.** An MP3 transcribed in 166 s; Cancel ended whisper-cli.exe within ~0.3 s |
| C, muted mic | **Partial.** After Stop, the dialog was right and nothing was inserted (2 of 3 runs). But the live stop never fired: the muted Realtek mic gives 99.2% non-zero samples, peak 2.6e-5 (about -92 dBFS). And the first run after launch inserted "Kõige! Kõige!" |
| E (new) | A "missing" engine stayed missing after the file came back, and Remove offered no download, until Reload Window |

**Fixes (this commit):**
- The live check stops when the peak stays below 1e-4 (-80 dBFS) for 3 s.
- The host check was re-measured on real speech. A first try at -40 dBFS would have treated 32 of 100 FLEURS clips as silence (their loudest frame is -49 dBFS). Now:
  - fewer than three frames above -65 dBFS means silence;
  - weak audio (fewer than 10 frames above -50 dBFS) drops output that is only whisper's silence phrases;
  - "heard nothing" means no text and no voiced audio;
  - result: across the 100 clips, no clip is skipped and the least audible has 37 audible frames; 8 of 246 six-second pieces are skipped, all of them silent tails.
- A mic click probes the engine afresh, and a remembered "missing" ends when the file is back.
- The start-up label shows the language code.

**Mac dev-instance check:**
- A mic stub delivering noise at a 2.6e-5 peak (the measured muted level) stopped by itself within 3 s with **Ritemark Heard Nothing**.
- Noise at a 1e-3 peak (about -60 dBFS, room noise) kept recording. After Stop, whisper's output for it was dropped, nothing was inserted, and the dialog said nothing was heard.
- With the engine removed: "Can't Start". Put back, the next click recorded and transcribed with no reload. git shows the engine unchanged.

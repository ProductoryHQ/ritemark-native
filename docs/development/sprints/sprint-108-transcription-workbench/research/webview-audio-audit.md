# A3 — Webview audio playback audit

**Blocks:** R7 (synced playback) — the heart of Option B
**Date:** 2026-08-12 · dev instance on `sprint-108-transcription-workbench`, CDP port 9333
**Verdict: SHIP. No fallback needed.**

## The question

`drawioEditorProvider.ts` documents that Ritemark's webview resource pipeline has sharp edges — iframe navigations bypass the service worker, and a `srcdoc` client's subresources 404. R7 depends on an `<audio>` element playing a workspace file and seeking accurately inside a 60-minute recording. Whether that works, and whether seeking requires range requests the pipeline may not serve, was unknown.

## Prior art in our own tree

VS Code ships `vscode/extensions/media-preview`, whose `audioPreview.ts` is a custom editor that plays audio in a webview. It does nothing exotic:

- CSP `media-src ${cspSource}`
- `webview.asWebviewUri(resource)` with a `?version=` cache-buster
- a plain `<audio controls>` element created in `media/audioPreview.js`

It claims `*.{mp3,wav,ogg,oga}` at priority **`builtin`**.

## What was tested live

A dev instance was launched against a workspace containing the fixtures, and JS was evaluated **inside the audio-preview webview's content frame** via CDP (`.claude/skills/ritemark-automation/scripts/cdp-eval.js`).

### Small file — `mono-lecture.mp3` (22 s, 265 KB)

```
readyState: 4        duration: 22.607     controls: true
src: https://file+.vscode-resource.vscode-cdn.net/private/tmp/…
seek to 15.0  →  currentTime 15          buffered end: 22.607
```

Resource serving works, metadata parses, seeking is exact.

### Large file — `long-meeting.mp3` (60 min 36 s, 42 MB)

```
duration: 3636       readyState: 4        metadata: immediate
seek to 2700 s (45:00)  →  currentTime 2700, completed in 223 ms
buffered ranges: 2   buffered end: 2714
```

**Two disjoint buffered ranges** is the finding that matters: the element did not fetch the whole 42 MB to reach 45:00. It requested a range around the seek target and got it. **Range requests are served through the vscode-resource pipeline**, so seeking in a long meeting is cheap and the host-side range-serving fallback in the technical plan is unnecessary.

## Finding — the first play must come from a real user gesture

Programmatic `audio.play()` from evaluated JS is refused:

```
NotAllowedError: play() can only be initiated by a user gesture.
```

This is the standard autoplay policy, not a resource failure — `a.error` was `null`, `networkState` was 1 (idle, loaded), and the media was fully buffered.

**Consequence for R7:** playback must be started by a genuine user interaction — a click on the play button or on a transcript line. Our design does exactly that, so this costs nothing. But two things must not be built:

- no auto-play when the workbench opens;
- no play triggered from a programmatically dispatched event.

After the user's first real interaction, subsequent programmatic `play()` calls (click-a-line → seek → play) are allowed.

Audible output under a real click was not verified — CDP `Runtime.evaluate` cannot produce a user gesture. Everything upstream of the speaker is confirmed. First task of Phase 4 is a click-and-listen check.

## Finding — a custom-editor collision to handle

`vscode.audioPreview` already claims `*.{mp3,wav,ogg,oga}`. Registering `ritemark.transcriptWorkbench` for the same patterns is a contest:

| Pattern | Claimed by | Priority |
|---|---|---|
| `mp3`, `wav`, `ogg`, `oga` | `vscode.audioPreview` | `builtin` |
| `m4a`, `aac`, `flac` | nobody | — |

`default` outranks `builtin`, so registering at `priority: "default"` should win for the contested extensions while `m4a`/`aac`/`flac` are uncontested. **Verify the resolution in Phase 4 rather than assuming it** — if the built-in wins, the fallbacks are `"Reopen Editor With…"`, or stripping `media-preview` from the build (it is a built-in extension we control, like `copilot`).

Either way, `vscode.audioPreview` staying available as a secondary editor is a *feature*: it is the escape hatch when a user wants to just hear a file without a transcript.

## Changes to the plan

1. **R7** — no change to the acceptance criteria, plus an explicit "first play requires a user gesture; never auto-play" rule.
2. **Technical plan Workstream 4** — drop the "host-side range-serving message channel" fallback; use a plain `<audio>` with `asWebviewUri`, `localResourceRoots` covering the audio file's folder, and `media-src` in the CSP.
3. **Phase 4 first tasks** — (a) click-and-listen confirmation, (b) verify custom-editor priority resolution against `vscode.audioPreview`.

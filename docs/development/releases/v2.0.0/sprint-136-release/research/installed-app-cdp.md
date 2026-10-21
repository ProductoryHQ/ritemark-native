# The frame scripts against an installed, signed app

Sprint 136, Phase 1 (technical plan, audit 2; spec R2, R3, R10, E4). Written on 20 October 2026 from what earlier sprints did on installed builds. The 2.0 scenes on a production build are checked at the dress rehearsal (E3).

## Does the debugging port open on a signed, hardened app?

Yes. The installed, signed and notarized app (hardened runtime) has been driven over CDP several times:

- v1.12.0 on 2 October (the word count faults, #378; the side bar's bootstrap, #375);
- v1.14.0 on 17 October, to make Sprint 132's lived-in profile (S45);
- the Social manager's and the marketing captures from installed builds since.

`--remote-debugging-port` is a Chromium switch that VS Code passes through, and the hardened runtime does not block it. No entitlement change is needed, and the risk in the technical plan's register is retired on this evidence.

## The launch

On the Mac, in the background, so no window comes in front of Jarmo's work:

```bash
S=/private/tmp/claude-501/rc1          # short: the IPC socket path has a length limit
mkdir -p "$S/ud/User" "$S/ext" "$S/shared"
RITEMARK_BUILD_CHANNEL=test open -n -g -a /Applications/Ritemark.app --args \
  --remote-debugging-port=9411 \
  --user-data-dir="$S/ud" --extensions-dir="$S/ext" --shared-data-dir="$S/shared" \
  --new-window "<workspace>"
```

- `open -n` starts a new instance, which inherits the shell's environment (`man open`), so `RITEMARK_BUILD_CHANNEL=test` reaches the extension host (R10).
- `--shared-data-dir` is VS Code 1.142's own option (`environmentService.ts`, `appSharedDataHome`). Without it the run reads and writes `~/.ritemark-shared`, the recent list every build on the Mac shares (E4, #475).
- **The x64 build under Rosetta** (D4): the same command with `open --arch x86_64 -n -g -a <x64 app path>`. The x64 app must not be in `/Applications` while the arm64 candidate is, because both have the same bundle id: run it from its DMG's mount or a folder of its own.
- **Quitting so state is kept:** `"window.confirmBeforeClose": "never"` in the profile's `User/settings.json`, then ⌘Q over CDP (`Input.dispatchKeyEvent`, KeyQ with modifiers 4). SIGTERM skips the shutdown save.
- A port other than 9224 (other sessions use it), and quit only the instance whose command line names this `--user-data-dir`.

## How a production build's scenes differ from the dev baseline

Sprint 135's E5 at `d60b9652` ran `frame-screenshots.mjs --compare` against a production build on a fresh profile: 32 of 34 scenes the same, and More differing (1.05% Light, 1.02% Dark) because a production build has no Copilot Chat or Chat Debug in More. `frame-geometry.mjs`: 22 pass, 0 fail, 2 skipped.

So the release images (D2) are those two scenes. `frame-screenshots.mjs --release <dir>` compares a scene with its image in `<dir>` when there is one (`docs/development/frame-baseline/release/`, from the first candidate with Jarmo's approval).

## Windows

The same flags work on `Ritemark.exe` (a Windows build is a VS Code build). Whether the Windows session can run the Node scripts on the PC is a question for that session, through the Development manager. If it can, its first candidate's captures become `release-win32/` with Jarmo's approval. If not, its screenshots are compared by eye with rounds 4 and 5 (R3).

## Left for the dress rehearsal

- The 2.0 scenes on the dress rehearsal's production build, with `--release` not yet given: More's two scenes are expected to differ, and nothing else.
- The welcome's scenes (`welcome-screenshots.mjs`) on a production build, which no earlier sprint ran.

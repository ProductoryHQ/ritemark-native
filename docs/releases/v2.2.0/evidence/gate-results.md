# v2.2.0 gate results

The candidate is `d08d0c53110dccb7e2ee480f4c2771ef5ac89e2e`, built on 9 November 2026 in `.worktrees/release-d08d0c53110d`. Jarmo's words are in `../TEST-CHECKLIST.md`, in the sign-off table and the deferrals.

## Release session, arm64 (9 November)

- **Rows 1–4a passed.** The release source was verified and preflight passed. `check:anthropic-models` was OK, and `verify-agent-runtimes.sh` passed with isolated AI homes. The build validation passed (Electron 43.8.6). `codesign-app.sh` signed 47 components with 0 failures. The deep strict check passed, team `JKBSC3ZDT5`.
- **The DMG** was made with the `ditto` + `hdiutil` fallback and signed. It was built at 11:27:19 EET, SHA-256 `ff32aca0…1e9e`.
- **Mounted read-only, the app inside passed every check:**
  - the signature;
  - the architecture, `arm64`;
  - version 2.2.0;
  - provenance naming `d08d0c53`;
  - a manifest identical to `VSCode-darwin-arm64/`, 23,034 entries.
- `spctl` said "Unnotarized Developer ID", as expected before notarization.
- **Rows 5–10** (launch checks) were not run. They were deferred in writing.

## Gate 1, macOS arm64

- **Jarmo tested the installed candidate.** On 10 November he wrote "Gate 1 passed".
- **Notarized on 10 November.** Accepted, stapled, `stapler validate` passed, and Gatekeeper accepted it ("Notarized Developer ID"). The SHA-256 after stapling is `a1fd99cb…c8a1`.

## Gate 2, macOS x64

- **84a passed.**
  - CI run 42585266003 succeeded at `d08d0c53`.
  - `extract-macos-x64-artifact.sh` ran, then `codesign-app.sh darwin-x64` with `RITEMARK_RELEASE_COMMIT=d08d0c53…`: 48 signed, 0 failed. The bundled agents were signed, and the build provenance was verified against the release commit.
  - `create-dmg.sh x64` stopped on Finder's AppleScript error -1743, as expected here, so the `ditto` + `hdiutil` fallback made the DMG. It was signed and built at 18:53:23 EET on 10 November, SHA-256 `b36d4c41…5a7d`.
  - Mounted read-only, the app inside passed every check:
    - signature and team;
    - `lipo` `x86_64`;
    - version 2.2.0;
    - provenance verified against the release commit's objects;
    - a checksum compare (`rsync -rlcn`) with `VSCode-darwin-x64/` found 0 differences.
- **The isolated run**, by the Development manager on 10 November. It used the signed app in an isolated background window on this Mac under Rosetta, not on an Intel Mac, and `/Applications` was not touched.
  - **Isolation:** its own profile, extensions, shared data and AI homes, a mock keychain, and usage data sent to a dead local address.
  - **Results:**
    - The process ran translated (Intel).
    - Home and the Task board opened pinned.
    - A Markdown edit was saved, and the bytes were read back from disk.
    - An `.html` file opened as a page with Publish.
  - **The first start under Rosetta** took 50 s. Two things showed then and cleared with one press: the AI sheet showed Claude as not installed until Re-check, and "Retry document update" showed until it was pressed. The cause is probably Rosetta's first translation, but that is not proven.
- **Jarmo:** "Gate 2 passed", 11 November. The x64 DMG was notarized on 11 November and stapled, and Gatekeeper accepted it. The SHA-256 after stapling is `8d3f205d…2c46`.

## Gate 2, Windows x64

- **Before install:** CI run 42585270616 succeeded. The sidecar's `source_commit` and `workflow_commit` are `d08d0c53…`, and its SHA-256 `3b290edd…464e` matches the file. The CI round trip passed: fresh install, update with 0 stale files, the app started both times, and uninstall.
- **Rows run on the PC** by the Windows session, installed over 2.1.0 with Jarmo's OK. His own profile was not touched, and every test profile was launched with `RITEMARK_BUILD_CHANNEL=test`.
  - **92 PASS:** the hash and sidecar match, the signature is Productory Services OÜ, the version is 2.2.0, and the silent install exited 0. SmartScreen was not seen: the file came through `gh` without a Mark-of-the-Web.
  - **93 PASS:** About shows 2.2.0, `d08d0c53`, Electron 43.8.6 and Node.js 24.22.1. `exthost.log` is clean, a setting was kept, Ctrl+` opened a terminal, and Ritemark's browser opened a page.
  - **94 PASS:** a cold first start on a new profile. The first frames are plain ground, then the welcome stands alone. Home and the Task board open with the project.
  - **95 PASS:** the update from 2.1.0. Home is chosen from the first frame, the AI column is there and nothing moves.
    - Measured: the first start after the update took about 30 s to Home, and a warm start took 9.2 s to Home's content.
    - 2.1 on this PC took about 3.5 s, but to a different mark (`didStartWorkbench`). 2.2's warm `didStartWorkbench` was 4.44 s on a lived-in profile.
    - No cause is claimed.
  - **97 PASS:** the slow-start notice.
  - **98, partly:** a reload names the tabs at once, and there is no `slot released` line.
  - **100 PASS:** ten runs, both changes kept every time.
  - **101 PASS:** a locked card file.
  - **102 PASS for Markdown at 150%.**
  - **105 PASS:** `settings: drawn 1376, filled 1815`. 2.1 took about 13 s.
  - **106 PASS** without its Test step, using a dummy value on a fresh profile.
  - **107 PASS:** the Claude turn.
  - **108 PASS for a silent file**, and voice dictation's silent-microphone message showed on a muted input.
  - **109 and 110, partly.**
- **Findings, none a 2.2 regression:**
  - #703: Claude's Windows fallback reads `cmdkey`'s header as a sign-in. It dates from 1.5.0, and Jarmo placed it in 2.3.
  - On-device transcription doesn't take `.m4a` on Windows. 2.1 is the same.
- **Jarmo:** "Gate 2 passed", 11 November.

## Publication

- **Jarmo:** "jah, lähme live'i", 11 November.
- **Tag:** v2.2.0 on `d08d0c53`.
- **The GitHub release** was published at 19:02:57 UTC.
- **The update feed:** 28 full releases (2.1.0's 27, plus one). It was uploaded at 19:10:52 UTC, and the latest URL served it by about 19:11 UTC.
- **The feed's first generation** took the notes' HTML comment as the update notice's line. It was caught before upload and regenerated from the text without the comment. The generator is fixed in this closeout.
- **The privacy page** lists 2.2's three counts. It went live on ritemark.app at about 18:06 UTC, from ritemark-web #685.

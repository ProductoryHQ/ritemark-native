# A6: Is there an Electron 43.x on Node 24.22.1? (R12, S50, #515)

Run at the sprint's start, 31 October 2026, 20:35 UTC, on the Mac, and again for PR 6 on 1 November 2026, 17:21 UTC (below). If a newer 43.x is out when 2.2's candidate is built, the candidate's run records it.

## Run again for PR 6: 1 November 2026, 17:21 UTC (measured)

Same sources: Electron's release list (`releases.json`, its `node` field), npm (`npm view electron time`, `dist-tags`) and the GitHub releases.

- **The newest 43.x is still 43.8.6, on Node 24.22.1.** npm's `43-x-y` tag is 43.8.6; nothing on the 43 line is newer on npm, in `releases.json` or on GitHub (no draft, no prerelease). 43.8.4, 43.8.5 and 43.8.6 are on Node 24.22.1, all with Chromium 150.0.7871.250 and native-module ABI 148, the same as 43.8.3.
- **The release:** GitHub's `v43.8.6`, published 30 October 23:35 UTC from `43-x-y`, tag commit `294458de94162d6f71ab2d740cdd5d5643d32aad`. Its notes: a `net.fetch()` speed-up for `file:` URLs and backported fixes from ANGLE, Chromium, libaom, libvpx, PDFium, Skia, V8 and WebRTC. 43.8.5's: a Linux D-Bus crash fix, a `net.fetch()` speed-up, Chromium, Dawn, Skia and V8 backports. 43.8.4's: Node 24.22.1 (electron/electron#55161), File System Access blocklist fixes, asar archive handling fixes, tzdata 2026e, `utilityProcess` exit on quit.
- **Its `SHASUMS256.txt`:** 7610 bytes, 75 entries, no newline after the last, SHA-256 `91b08f0fe67f1b274dfff20995e9423d3a483ccc5bb4329792605aa25dd88e54`, equal to the digest GitHub shows for the asset.
- **Node 24.22.1's tag commit** in nodejs/node: `ce7aaf1cee78b8cf0ce17364260535c418d3ed26` (for the notices).
- **Upstream VS Code** `main` is still on 43.8.3 (`d6e20fdc`, 23 October), so no VS Code update brings the fix.
- **The extension host's Node network calls** are unchanged since the 31 October read: of the four PRs merged to `extensions/ritemark/src` since `39b4e37f` (#605, #607, #610, #612; `main` at `d2fc595a`), no added line calls `fetch(`, `https.request(`, `http.request(`, `https.get(`, `http.get(`, `net.request`, `posthog-node` or `new OpenAI(`, and the files that do are the same list.

**So PR 6 takes 43.8.6.** Measured in PR 6 ([pr6-electron-checks.md](pr6-electron-checks.md)): the downloaded 43.8.6 reports Node 24.22.1.

## The newest 43.x and its Node on 31 October (measured)

From Electron's own release list (`https://releases.electronjs.org/releases.json`, its `node` field), npm's publish times (`npm view electron time`) and each GitHub release's notes:

| Electron | Node | Chromium | Published on npm (UTC) | Release note on Node |
|---|---|---|---|---|
| 43.8.3 (patch 020 today) | 24.22.0 | 150.0.7871.250 | 21 Oct 03:18 | — |
| **43.8.4** | **24.22.1** | 150.0.7871.250 | **27 Oct 18:05** | "Updated Node.js to v24.22.1" (electron/electron#55161) |
| 43.8.5 | 24.22.1 | 150.0.7871.250 | 30 Oct 20:59 | — |
| **43.8.6** (newest 43.x) | 24.22.1 | 150.0.7871.250 | 30 Oct 23:35 (GitHub) / 31 Oct 01:03 (npm) | — |

43.8.4 came out on the evening of 27 October, after Sprint 144 had checked that morning and found none. 43.8.5 and 43.8.6 add Chromium, V8 and other upstream backports and two `net.fetch()` performance fixes; neither changes Node again.

Not measured here: the `process.versions.node` of a downloaded 43.8.6 build. That is checked in PR 6, where the build is downloaded anyway (S51: About shows the Node version), and Electron's `SHASUMS256.txt` for the chosen version is copied byte for byte into `build/checksums/electron.txt` there.

## Node network calls in the extension host, re-read (measured by reading the code)

Sprint 144's list (`v2.1.0/sprint-144-release-harness/research/electron-node-audit.md`, *Who in Ritemark makes a Node request…*) was re-checked against `main` at `39b4e37f`:

- `grep` for `fetch(`, `fetchImpl`, `https.request(`, `http.request(`, `https.get(`, `http.get(`, `net.request`, `posthog-node` and `new OpenAI(` in `extensions/ritemark/src`, outside tests, finds the same files as Sprint 144's table, plus two that are not network calls of their own: `analytics/consent.ts` (a comment naming `posthog-node`) and `flows/FlowEditorProvider.ts:873` (the OpenAI image step's model list, which goes to OpenAI at a fixed address).
- The only commits to `extensions/ritemark/src` since that audit are 2.1.0 RC4's #586 and #587, which change a test file and `package.json` only.

So the finding stands: one path fetches an address a person or an agent supplies, Flows' Save File step with an image URL (`flows/nodes/SaveFileNodeExecutor.ts`). With Node 24.22.1 that path gets the fix.

## What this changes

- **R12 takes its first branch:** a 43.x on Node 24.22.1 exists. PR 6 moves patch 020 to the newest 43.x when it is made (43.8.6 today), as Sprint 144 did, and is checked as S51 says. `spec.md` R12 and the sprint plan say so (31 October addendum).
- **Decision 4** (ship on 43.8.3 with the risk recorded) is not needed unless PR 6 fails its checks.
- The tier does not change: patch 020 was already the sprint's named shell-tier path.
- PR 6 still comes last, so it takes the newest 43.x before the candidate; this file is run again then.

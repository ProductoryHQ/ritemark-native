# A6: Is there an Electron 43.x on Node 24.22.1? (R12, S50, #515)

Run at the sprint's start, 31 October 2026, 20:35 UTC, on the Mac. To be run again before 2.2's candidate is built.

## The newest 43.x and its Node (measured)

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

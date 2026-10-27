# Audit A2 — Electron and Node for 2.1 (#515)

Done on 27 October 2026, while planning, from `origin/main` (`c99a8596`, VS Code gitlink `d956e8a6`). Each line says whether it was **measured** (read from a file, an API or a release) or **inferred**.

## The question

Node.js shipped security releases on 21 October 2026 (fixed in 22.23.4, 24.22.1 and 26.12.1). Ritemark's extension host runs on the Node that Electron embeds, so the fix reaches Ritemark only with an Electron that carries Node 24.22.1. Which Electron does 2.1 ship on, and what does it cost to move?

## What the pinned VS Code ships (measured)

| | Value | Source |
|---|---|---|
| VS Code | 1.142.0 | `package.json` at `d956e8a6` |
| Electron | **43.7.7** | `.npmrc` `target="43.7.7"` at `d956e8a6` |
| Electron's Node | **24.21.0** | `cgmanifest.json` at `d956e8a6`; Electron's `releases.json` |
| Electron's Chromium | 150.0.7871.250 | Electron's `releases.json` |
| Native-module ABI | 148 | Electron's `releases.json` (`modules`) |
| Build-time Node | 24.18.0 | `vscode/.nvmrc`; `NODE_VERSION` in both CI workflows |

The build-time Node only runs the build. It is not shipped, so the advisory doesn't reach users through it (inferred from how the build works; `.nvmrc` follows the VS Code pin, as #515 says).

## Is the fix in any Electron yet? (measured, 27 October)

- **No released Electron carries Node 24.22.1.** Electron 43.8.0 (16 October) moved to Node 24.22.0; 43.8.1, 43.8.2 and 43.8.3 (20 and 21 October) stayed on it. So did 44.9.3 and 45.0.0.
- **The fix is merged on Electron's 43 line and waiting for a release.** electron/electron#55161, "chore: bump node to v24.22.1 (43-x-y)", merged 22 October 04:00 UTC. `43-x-y` is 21 commits ahead of `v43.8.3`, and no 43.x has been published since 21 October. The same bump is merged for 44, 45 and main (#55162, #55163, #55164).
- **No VS Code has it either.** VS Code 1.143.1 still ships 43.7.7; `release/1.144` and `main` (1.145) ship 43.8.3, Node 24.22.0.

So "update VS Code" doesn't help today: the newest VS Code is on the same Node as Electron 43.8.3.

## Where the high-severity fixes sit (measured)

- **Brotli (CVE-2026-111497)** is a bug in the upstream Brotli decoder, not Node's glue. Node 24.22.1 changes `deps/brotli/c/dec/decode.c`; google/brotli published v1.2.1, v1.1.1 and v1.0.10 on 21 October with "CVE-2026-111497: out-of-bounds write permits remote code execution", changing the same file.
- **Chromium is not exposed through it.** Chromium 150.0.7871.250 (Electron 43's) carries Brotli `cfa184a9` (`third_party/brotli/README.chromium`), and its `DecodeBlockTypeAndLength` already returns `BROTLI_DECODER_ERROR_FORMAT_BLOCK_SWITCH` and `BROTLI_DECODER_NEEDS_MORE_INPUT`, the control flow v1.2.1 backports. So the integrated browser and the webviews, which decode `Content-Encoding: br` from any site, are not the exposure. Only Node's own copy is.
- **The TLS hostname checks** (CVE-2026-105483, CVE-2026-106069, CVE-2026-106072) and **`dns.resolve`** (CVE-2026-105482) are in Node's own code.
- **The eMudhra intermediate CA** is already distrusted in Electron 43.8.1 and later ("This release contains the fix for GHSA-jr5w-w6x2-84p9, the mitigation for compromised eMudhra intermediate certificates"). 43.7.7 doesn't have it.
- **OpenSSL** is not in Electron's Node (Electron builds Node against BoringSSL), so that line of the advisory doesn't apply (inferred from Electron's build, not re-checked here).

## Who in Ritemark makes a Node request to a URL from outside (measured by reading the code)

#515 asks whether the extension host fetches any URL that a person or an agent supplies. Every Node network call in `extensions/ritemark/src` (`fetch(`, a `fetchImpl` defaulting to `fetch`, `https.request(`, and `posthog-node`), outside tests:

| Where | Goes to | URL from |
|---|---|---|
| `update/updateFeed.ts`, `update/githubClient.ts`, `update/userExtensionInstaller.ts` | GitHub (the update feed, releases) | Ritemark, or the feed GitHub serves |
| `ai/modelCatalog/remoteSource.ts` | GitHub (`ritemark-public`'s model feed) | Ritemark (fixed, with an origin allowlist) |
| `analytics/posthog.ts` (`posthog-node`) | PostHog | Ritemark (fixed) |
| `ai/geminiRequest.ts` | Google | Ritemark (fixed) |
| `ai/connectivity.ts`, `ai/modelCatalog/providerDiscovery.ts` | Anthropic, OpenAI | Ritemark (fixed) |
| `settings/RitemarkSettingsProvider.ts` (key checks) | Google, Anthropic, ElevenLabs, OpenRouter | Ritemark (fixed) |
| `googleDocs/oauth.ts` | Google | Ritemark (fixed) |
| `speech/engines/elevenLabsEngine.ts` | ElevenLabs | Ritemark (fixed) |
| `flows/nodes/LLMNodeExecutor.ts`, `ImageNodeExecutor.ts` | Google, OpenAI; the image the image API returns | Ritemark, or the provider's own response |
| **`flows/nodes/SaveFileNodeExecutor.ts:200`** | **Any URL** | **A flow's previous step: a text the person typed into a flow's input, or an AI step's answer**, when Save File's format is Image and its input is a string |

- **One path takes an outside URL:** a flow whose Save File step (format Image) receives a string downloads it with Node's `fetch`, which decodes Brotli. A flow is written by the person or by an agent (agents write flow JSON); a hostile flow or a hostile answer could point it at a hostile server. It is a narrow path: someone has to run that flow.
- **No custom base URLs.** Ritemark's extension has no setting for a provider's base URL or endpoint (`baseURL`, `baseUrl`, endpoint: none in `src/`), so the TLS hostname flaws have no person-supplied host to act on there.
- **VS Code's built-in JSON support** downloads a JSON file's `$schema` URL from its language server, through `request-light`. `request-light` decodes gzip and deflate only, not Brotli (`src/node/main.ts` on its main branch; the 1.142 server depends on `^0.8.0`). Inferred to hold for the shipped version, not checked in the built app.
- **The bundled agents** don't run on Ritemark's Node: Claude Code and OpenCode are their own binaries, Codex is Rust (from #515, not re-checked).

So the issue's condition ("if one exists, it raises this issue's priority") is met, narrowly: one Ritemark path fetches an outside URL with Node.

## What moving Electron costs (measured)

An Electron patch release inside 43 is a small change in the VS Code tree, carried as a Ritemark patch:

- **`vscode/.npmrc`**: `target`. `ms_build_id` names Microsoft's own Electron build and is read only when `product.electronArtifactFeed` is set (`build/lib/electron.ts`). OSS's `product.json` sets it to `""` and Ritemark's `branding/product.json` doesn't set it, so Ritemark downloads Electron's own release from GitHub.
- **`vscode/build/checksums/electron.txt`**: the build verifies every Electron download against it (`validateChecksum: true`). At the pin it is exactly Electron's own `SHASUMS256.txt` for 43.7.7 (sorted, byte for byte), so the new file is the new release's `SHASUMS256.txt`.
- **`vscode/cgmanifest.json`**: the Electron and Node versions in the notices (honesty, not a build input).
- **No source change is needed for a patch bump.** Upstream's own 43.7.7 → 43.8.3 bump (microsoft/vscode `d6e20fdc`, 23 October) also changed `.nvmrc`, `remote/.npmrc`, the Node checksums, Chromium feature switches and the compile cache; those are VS Code's own tuning, not requirements of 43.8.3. Ritemark's build Node stays at the pin's 24.18.0.
- **Native modules stay compatible:** every 43.x has ABI 148. `build-prod.sh` applies patches before `npm ci` in `vscode/`, so the Mac's native modules build against the new headers. Both CI workflows run `npm ci` before their patch step, so CI's native modules build against 43.7.7's headers and run on the new 43.x: the same ABI, so they load (inferred from the ABI, to be proven on the built app, see the technical plan).
- **About already shows the Node version** (patch 001: `Node.js: ${process.versions['node']}`), so #515's "About shows that Node version" needs no code.

## Options

1. **Update VS Code past 1.142.** Doesn't bring Node 24.22.1 today (no VS Code has it), and it is the biggest shell change there is: Sprint 135 was one, rebasing 18 patches. Not for the last sprint before a candidate.
2. **An Electron patch bump inside 43, through one Ritemark patch.** Three files in `vscode/`, no source change, ABI unchanged. Upstream VS Code runs 43.8.3 at 1.144. It brings Node 24.22.1 the day Electron publishes a 43.x with it, and today it already brings 43.8.x's Chromium backports and the eMudhra distrust.
3. **Stay on 43.7.7 and accept the risk in writing.** The exposure above is narrow, but 2.1 would also miss three weeks of Chromium security backports for a browser that opens any site.

## Recommendation

**Option 2.** Build the patch now with the newest published 43.x (43.8.3 today), and move it to the first 43.x with Node 24.22.1 when Electron publishes it: one `target` line and one checksum file. If no such 43.x is published by the time 2.1's candidate is cut, 2.1 ships on 43.8.3 (Node 24.22.0) with this audit as the written risk, #515 stays open, and the 43.x with the fix goes into the first release after 2.1 that rebuilds the app. Holding the candidate for an Electron release is the manager's and Jarmo's call, not this sprint's.

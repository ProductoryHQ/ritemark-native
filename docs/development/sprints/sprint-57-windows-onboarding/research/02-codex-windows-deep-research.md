# Sprint 57 Research 02: Codex Windows Reality + First-Principles Solution

## Why this document exists

Esimene research voor (Doc 01) järeldas et "Codex Windowsil ei tööta, drop it." Jarmo lükkas selle õigustatult tagasi — see oli laisk, mitte first-principles. See dokument on uus uurimine kolme paralleelse research agendiga, primary sources only, GitHub URL'idega ja koodirea numbritega.

**Bottom line muutub täielikult:** OpenAI ships ametlikult signed Windows binaarid. "Drop Codex on Windows" oli vale järeldus, mis põhines ühel doc lausel. Tegelik valik on kahe arhitektuuriotsuse vahel — mõlemad teostatavad, aga mõlemal on eraldi product/supportability risk.

---

## Faktid mida Doc 01 ei tea

### F1. OpenAI ships native Windows binaries

| Tag | Date | Windows assets |
| --- | --- | --- |
| `rust-v0.125.0` (stable) | 2026-04-24 | `codex-x86_64-pc-windows-msvc.exe`, `codex-aarch64-pc-windows-msvc.exe`, Windows npm packages, `codex-command-runner.exe`, `codex-windows-sandbox-setup.exe`, `codex-responses-api-proxy.exe` |
| `rust-v0.126.0-alpha.15` | 2026-04-29 | 44 Windows artefakti (4 binaarid × 2 arch × 4 formaati) + `install.ps1` |

**Allikad:**
- https://github.com/openai/codex/releases/expanded_assets/rust-v0.125.0
- https://github.com/openai/codex/blob/main/.github/workflows/rust-release-windows.yml — ametlik CI workflow mis builds 5 binaarid × 2 arhitektuuri, signs Azure Trusted Signing'iga.

**Verification note (2026-04-30):** workflow builds `codex-app-server` for Windows, but the `rust-v0.125.0` expanded assets page checked during sprint prep did not visibly list a `codex-app-server-*-pc-windows-msvc.exe` asset. Path A must verify the exact downloadable artefact before implementation. If `codex-app-server` is not directly available for the pinned release, alternatives are bundling full `codex.exe`, consuming the npm platform package at build time, or mirroring an internally built app-server binary.

**"WSL2 only" docs claim** (https://github.com/openai/codex/blob/main/docs/install.md) on **dokumendi-poliitika lause, mitte tehniline reaalsus**. Tõestus:
1. Sama repo ships signed Windows .exe-d.
2. npm shim `codex-cli/bin/codex.js` mapib `process.platform === 'win32'` → Windows target triple → `codex.exe`.
3. npm package `@openai/codex@0.125.0` `optionalDependencies` sisaldab `@openai/codex-win32-x64` ja `@openai/codex-win32-arm64` (esbuild/swc/turbo muster).
4. Windows-spetsiifiline sandboxing on aktiivses arenduses (`codex-rs/windows-sandbox-rs/` täielik Win32 binding'ute crate, "Help test experimental Windows sandbox" pinned discussion).

### F2. The PowerShell execution policy error is npm's problem, not Codex's

`npm install -g <package>` Windowsil loob `.ps1` shim wrapper'i. PS execution policy default `Restricted` blokeerib selle. See juhtub **iga** globaalse npm paketiga, mitte ainult Codex'iga. Lahendused:
- `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
- Spawn `codex.cmd` mitte `codex.ps1`
- Spawn `codex.exe` otse, jättes npm shim'id vahele

### F3. Source code crate-level analüüs

`codex-rs/` workspace = **86 crate'i**. Ainult kaks on platform-spetsiifilised:

| Crate | Platform | Eesmärk |
| --- | --- | --- |
| `codex-rs/windows-sandbox-rs/` | Windows (`[target.'cfg(windows)']`) | JobObjects, Win32 sandboxing |
| `codex-rs/linux-sandbox/` | Linux (landlock) | Linux sandbox |

Ainus tõeline `cfg(unix)` gate workspace'is: `codex-rs/core/Cargo.toml` `[target.'cfg(unix)'.dependencies]` pulls `codex-shell-escalation` (sudo/setuid Unix-only). See on **leaf-crate feature, mitte foundation**.

### F4. Codex `app-server` ON juba embeddable

`codex-rs/app-server/README.md`: JSON-RPC 2.0 üle stdio (newline-delimited), websocket, või unix socket. Built-in TS schema generator: `codex app-server generate-ts --out DIR`.

**Ritemark juba räägib seda protokolli** (`extensions/ritemark/src/codex/codexAppServer.ts:118+`). See teeb app-serveri bundling'u arhitektuurselt atraktiivseks, aga täpne public release artefact tuleb enne Path A implementatsiooni lukku panna.

---

## Industry benchmark — Ritemark on the outlier

Kõik võrreldavad agent tools 2026'is on **in-process**. Ritemark on ainus mis spawn'ib välist CLI binaari.

| Project | License | CLI binary dep? | Agent loop runs in | Windows | Source |
| --- | --- | --- | --- | --- | --- |
| **Cline** | Apache-2.0 | No | In-process Node, `Task.recursivelyMakeClineRequests()` | Native | [src/core/task/index.ts](https://github.com/cline/cline/blob/main/src/core/task/index.ts) |
| **Roo Code** | Apache-2.0 | No | In-process Node (Cline fork) | Native | [src/core/task/Task.ts](https://github.com/RooCodeInc/Roo-Code/blob/main/src/core/task/Task.ts) |
| **Continue.dev** | Apache-2.0 | Yes — own pkg-built binary, all OS targets in CI | Subprocess (own binary) | Native | [binary/utils/targets.js](https://github.com/continuedev/continue/blob/main/binary/utils/targets.js) |
| **Aider** | Apache-2.0 | No — pure Python in-process | `aider/coders/base_coder.py` `run()` line 1075 | Native (Python) | [aider/coders/base_coder.py](https://github.com/Aider-AI/aider/blob/main/aider/coders/base_coder.py) |
| **GitHub Copilot Chat** | MIT | No | In-process Node, `AgentIntent.invoke()` | Native | [src/extension/intents/node/agentIntent.ts](https://github.com/microsoft/vscode-copilot-chat/blob/main/src/extension/intents/node/agentIntent.ts) |
| **Cursor** | Closed | No (proprietary server proxy) | Server-side | Native | — |
| **Ritemark Native (täna)** | Apache-2.0 | **Yes** — spawns `codex app-server` | Subprocess JSON-RPC | **Broken** | `extensions/ritemark/src/codex/` (2153 LOC) |

Codex Windows breakage issues kinnitamiseks: [#11744](https://github.com/openai/codex/issues/11744), [#17432](https://github.com/openai/codex/issues/17432), [#19243](https://github.com/openai/codex/issues/19243), [#16874](https://github.com/openai/codex/issues/16874), [#18648](https://github.com/openai/codex/issues/18648). Codex npm install on krooniliselt katki Windowsil — ja see on probleem mille Ritemark "endale tellis", spawning välist binaari.

---

## ChatGPT OAuth WITHOUT Codex CLI (load-bearing finding)

Kõige tähtsam first-principles avastus: **ChatGPT subscription monetisatsioon EI VAJA Codex CLI'd**. OAuth client_id ja backend route on **avalikult dokumenteeritud OpenAI enda Rust koodis ja Cline'i TypeScript port'is**.

**Primary source citations:**

```
openai/codex/codex-rs/login/src/auth/manager.rs:1149
  pub const CLIENT_ID: &str = "app_EMoamEEZ73f0CkXaXp7hrann";

openai/codex/codex-rs/login/src/auth/manager.rs:106
  const DEFAULT_CHATGPT_BACKEND_BASE_URL: &str = "https://chatgpt.com/backend-api";

openai/codex/codex-rs/login/src/server.rs:46,425,535
  - issuer: https://auth.openai.com
  - endpoints: /oauth/authorize, /oauth/token
  - scopes: openid profile email offline_access api.connectors.read api.connectors.invoke
  - redirect: http://localhost:1455/auth/callback
  - PKCE S256

cline/cline/src/core/api/providers/openai-codex.ts:22,380
  CODEX_API_BASE_URL = "https://chatgpt.com/backend-api/codex"
  request URL: ${CODEX_API_BASE_URL}/responses
  Authorization: Bearer ${accessToken}
```

**Third-party validation:** [EvanZhouDev/openai-oauth](https://github.com/EvanZhouDev/openai-oauth) kasutab sama `app_EMoamEEZ73f0CkXaXp7hrann` client_id'd, ehitab localhost proxy ja kinnitab et `/v1/responses`, `/v1/chat/completions`, streaming, tool calls, reasoning — kõik töötab.

**Cline ships seda production'is** ([blog post](https://cline.bot/blog/introducing-openai-codex-oauth)) ChatGPT Plus/Pro kasutajatele.

**Supportability note:** see on tugev tehniline signaal, mitte sama asi mis OpenAI ametlik public API guarantee. Path B vajab product/legal otsust, kas Ritemark võib võtta `chatgpt.com/backend-api/codex` sõltuvuseks. API-key fallback peab jääma esimese klassi teeks ka siis, kui ChatGPT OAuth valitakse.

---

## Two viable solution paths

### Path A: Bundle Codex Runtime with Ritemark VSIX

**Mida teeme:**
- Build pipeline laeb valitud Codex Windows runtime artefakti GitHub releases'ist või npm platform package'ist
- Bundle'ime per-platform .vsix'i (sama muster nagu Anthropic Claude extension teeb)
- Spawn'ime bundled binary mitte system-installed
- Eemaldame `npm install -g @openai/codex` täielikult

**Plusses:**
- Säilitab existing `codex/codexAppServer.ts` (368 LOC) + `codexProtocol.ts` (419 LOC) integration'i
- ~1500 LOC `codexManager.ts` kustutaks (Node version repair, arch detect, nvm scan)
- Kohene Windows tugi, kui täpne artefact source on kinnitatud
- Sama muster mida VS Code ise kasutab ripgrep'i jaoks
- Säilitab OS-level sandbox (Seatbelt mac, Landlock linux, Win32 JobObjects experimentaalne)

**Miinused:**
- Tracking burden — Codex CLI release tempo, audited version range tüli
- Bundle size +30MB per platform .vsix
- Ikka kaks subprocess'i protsessihaldus probleem
- Pinitud OpenAI app-server protokollile (mis muutub minor version'idega)
- Enne implementation'it vaja artefact verification: kas app-server binary on public release asset, npm package sees, või tuleb mirror/build pipeline teha

**Implementation effort:** ~2 nädalat. Tagasiminek ei ole.

### Path B: Replace Codex CLI entirely with in-process OpenAI SDK + agent loop (Cline pattern)

**Mida teeme:**
- Kustutame kogu `extensions/ritemark/src/codex/` (~2153 LOC)
- Kirjutame `extensions/ritemark/src/openaiAgent/`:
  - `oauthFlow.ts` — PKCE flow (port `codex-rs/login/src/server.rs` Rust → TS), kasutab `app_EMoamEEZ73f0CkXaXp7hrann` client_id'd
  - `tokenStore.ts` — VS Code SecretStorage + 401 refresh
  - `responsesClient.ts` — fetch wrapper `https://chatgpt.com/backend-api/codex/responses` (OAuth) ja `https://api.openai.com/v1/responses` (API key) jaoks, SSE parser
  - `agentLoop.ts` — `while(toolCalls)` loop, `previous_response_id` chaining
  - `tools/` — `readFile.ts`, `writeFile.ts`, `applyPatch.ts`, `execShell.ts`, `listDir.ts`
  - `approval.ts` — port `codexApproval.ts` (53 LOC) decoupled JSON-RPC'st
- Modify: `UnifiedViewProvider.ts`, `RitemarkSettingsProvider.ts`, `flows/nodes/CodexNodeExecutor.ts`

**Net code change:** -1800 LOC (delete codex/), +800 LOC (openaiAgent/) = **-1000 LOC**

**Plusses:**
- **Kohene native Windows tugi** — pure TS, mingit binary haldust
- Industry consensus pattern (Cline, Roo, Aider, Copilot Chat)
- Vabastus OpenAI Codex CLI release tempo eest
- Pin'itud `/v1/responses` API'le (stabiilne avalik) mitte `app-server` JSON-RPC'le (churning)
- Üks vähem subprocess
- Lihtsam debug, lihtsam audit, lihtsam ship
- Eemaldab `codex/codexManager.ts:55-57` audited version range haldust

**Miinused:**
- OS-level sandbox kaob — **AGA Ritemarki threat model on markdown editor, mitte agentic CLI. Sandbox pole load-bearing.**
- Implementatsiooni töö suurem (~4 nädalat vs Path A 2 nädalat)
- Risk: OpenAI võib `chatgpt.com/backend-api/codex` route'i tighten'ida (mitigation: User-Agent header sama mis Codex'il, fallback API-key path)

**Implementation effort:** ~4 nädalat.

---

## What we'd need to research more (genuine unknowns)

1. **`chatgpt.com/backend-api/codex/responses` ToS staatus** — Cline ships seda production'is, OpenAI client_id on avalik, aga ametlikku dokumentatsiooni pole. Risk: tighten kunagi tulevikus. Mitigation: User-Agent + fallback API-key.
2. **Windows sandbox parity** — `windows-sandbox-rs` on testing'is, mitte GA. Path A jaoks: mac/linux saavad sandbox'i, Windows ei pruugi.
3. **`@openai/agents` SDK ChatGPT OAuth tugi** — praegu API key only. Hand-rolled vajalik OAuth path'iks.

---

## Recommendation

**Update after Jarmo decision (2026-05-01): Path A is selected for Sprint 57.** The earlier recommendation below remains useful strategic context, but it is no longer the active Sprint 57 implementation direction.

**Path B (in-process replace), lähtudes:**

1. **Industry consensus:** 5/6 võrreldavat projekti on in-process. Codex CLI sõltuvus on ainulaadselt Ritemarki valik, mis ei tee toodet paremaks vaid loob churning'u.

2. **Net code reduction:** -1000 LOC. Vähem koodi = vähem buge = vähem hooldust.

3. **Native Windows by construction:** Pure TS jookseb Node'is mis jookseb VS Code'is mis jookseb Windowsil. Kogu Windows-spetsiifiline complexity (PowerShell shim, npm optional deps, Rosetta, nvm, arch detect) kaob.

4. **Threat model match:** Ritemark on markdown editor. OS-level sandbox kaitseb "agent käivitas tundmatuid shell commande" stsenaariumi eest, mis on Codex CLI use case. Markdown editor'is approval-gate-pre-execution annab samaväärse turvalisuse nii vähem koodiga.

5. **Strategic decoupling:** Pin'itud OpenAI avalikule API'le mitte sisemisele tooling protokollile.

**Path A (bundle binary) on legitiimne fallback** kui Path B implementatsiooni risk on liiga kõrge — aga ainult pärast artefact source'i kinnitamist. See lükkab churning'u edasi, ei lahenda seda.

Sprint 57 active direction now:

- Bundle Claude using the official Anthropic VSIX native-runtime pattern verified in `03-official-claude-vsix-inspection.md`.
- Bundle Codex using the smallest redistributable runtime that preserves the current app-server integration.
- Do not use global npm, `install.ps1`, or PATH detection as the happy path.

---

## Files referenced

**Ritemark (kustutatav Path B'is):**
- `extensions/ritemark/src/codex/codexManager.ts` (768 LOC, lines 78–160 Windows handling, lines 55–57 version audit)
- `extensions/ritemark/src/codex/codexAppServer.ts` (368 LOC, JSON-RPC client)
- `extensions/ritemark/src/codex/codexProtocol.ts` (419 LOC, message types)
- `extensions/ritemark/src/codex/codexAuth.ts`
- `extensions/ritemark/src/codex/codexApproval.ts` (53 LOC — port'itav)
- `extensions/ritemark/src/codex/codexModels.ts`
- `extensions/ritemark/src/codex/codexStatusEvents.ts`
- `extensions/ritemark/src/codex/codexTrace.ts`

**Ritemark (modify'tav):**
- `extensions/ritemark/src/views/UnifiedViewProvider.ts`
- `extensions/ritemark/src/settings/RitemarkSettingsProvider.ts`
- `extensions/ritemark/src/flows/nodes/CodexNodeExecutor.ts`

**Reference port allikas:**
- https://github.com/cline/cline/blob/main/src/core/api/providers/openai-codex.ts (TypeScript reference port of Codex OAuth + Responses API)
- https://github.com/cline/cline/blob/main/src/core/task/index.ts (in-process agent loop reference)

---

## Sources (kõik primary)

- OpenAI Codex repo: https://github.com/openai/codex
- Codex Windows release workflow: https://github.com/openai/codex/blob/main/.github/workflows/rust-release-windows.yml
- Windows sandbox crate: https://github.com/openai/codex/tree/main/codex-rs/windows-sandbox-rs
- App-server protocol: https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md
- npm shim: https://raw.githubusercontent.com/openai/codex/main/codex-cli/bin/codex.js
- Cline OpenAI Codex provider: https://github.com/cline/cline/blob/main/src/core/api/providers/openai-codex.ts
- Cline blog (ChatGPT OAuth): https://cline.bot/blog/introducing-openai-codex-oauth
- Third-party OAuth validation: https://github.com/EvanZhouDev/openai-oauth
- OpenAI Agents JS SDK: https://github.com/openai/openai-agents-js
- VS Code Language Model API: https://code.visualstudio.com/api/extension-guides/language-model
- Aider source: https://github.com/Aider-AI/aider/blob/main/aider/coders/base_coder.py
- Roo Code source: https://github.com/RooCodeInc/Roo-Code/blob/main/src/core/task/Task.ts
- Continue binary build targets: https://github.com/continuedev/continue/blob/main/binary/utils/targets.js
- Cursor architecture (closed): https://blog.sshh.io/p/how-cursor-ai-ide-works
- ChatGPT Plus ≠ API access: https://community.openai.com/t/api-chatgpt-subscription-cannot-use-api-with-chatgpt-subscription/875542

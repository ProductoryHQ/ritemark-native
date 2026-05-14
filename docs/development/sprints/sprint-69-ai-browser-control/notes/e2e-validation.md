# Sprint 69 — End-to-End Validation Handoff

> What to run, what to expect, and how to know it works. This is the validator's
> playbook — designed so a fresh QA pass (Jarmo, Claude, Codex) can prove the
> feature without reverse-engineering intent.

## What was built

Sprint 69 wires the integrated Ritemark browser as a write-surface for AI
agents. The Claude SDK and Codex App Server both get a set of browser-action
tools (navigate, click, fill, type, scroll) that drive the active integrated
browser tab via Playwright through patch 010's workbench bridge.

The feature is **off by default** (experimental flag `browser-agent-control`,
darwin-only). Within an enabled session, the **first** browser-tool call from
the AI triggers a workbench-level consent dialog. Declining keeps subsequent
calls in a typed-error state; accepting persists for the session.

## Pre-flight

1. **Be on the sprint branch.**
   ```bash
   git branch --show-current   # must print: sprint-69-ai-browser-control
   ```
2. **Patches are applied.**
   ```bash
   ./scripts/apply-patches.sh --dry-run
   # Patches 001–010 should all read "Already applied" *except* 009 which may
   # read CONFLICT — this is the layered-detection artifact noted below.
   ```
   Verify reverse/forward roundtrip works:
   ```bash
   cd vscode
   git apply --reverse ../patches/vscode/010-ritemark-browser-action-bridge.patch
   git apply --reverse ../patches/vscode/009-ritemark-browser-context-bridge.patch
   git apply ../patches/vscode/009-ritemark-browser-context-bridge.patch
   git apply ../patches/vscode/010-ritemark-browser-action-bridge.patch
   ```
   All four steps must print `OK` (no `error:` lines). This is what we tested
   during build.
3. **VS Code workbench is transpiled.**
   ```bash
   cd vscode
   PATH=/Users/jarmotuisk/.nvm/versions/node/v22.21.1/bin:$PATH \
     node build/next/index.ts transpile
   ```
   Should complete in ~2s. Verify Sprint 69 files exist:
   ```bash
   ls vscode/out/vs/workbench/contrib/browserView/electron-browser/features/ \
     | grep ritemarkBrowserActionFeature
   ```
4. **Extension is compiled.**
   ```bash
   cd extensions/ritemark && yarn compile
   ```
   Should print `Done in <Ns>` with no errors.
5. **All unit tests pass** (arm64 node required, see [vscode-development skill](../../../.claude/skills/vscode-development/SKILL.md)):
   ```bash
   cd extensions/ritemark
   PATH=/Users/jarmotuisk/.nvm/versions/node/v22.21.1/bin:$PATH yarn test
   ```
   The new `browser/browserActionTools.test.ts` (9 tests) must pass.
   `flows/nodes/SaveFileNodeExecutor.integration.test.ts` failure is a
   pre-existing flake unrelated to this sprint.

## Launch

```bash
./vscode/scripts/code.sh
```

When Ritemark opens:

1. Open the **AI sidebar** (chat panel).
2. **Enable the feature flag.** Settings → Ritemark Features → **AI Browser
   Control**. Check the box. (It is experimental, opt-in, darwin-only.)
3. Open a new browser tab inside Ritemark (Cmd+P → enter a URL, or the
   built-in **Open URL** command).
4. Accept the **Share with Agent?** dialog (this is the read-consent prompt
   from Sprint 67; you may have already dismissed it with "Don't ask again").
5. The browser tab should now show its globe-icon **Browser: <title>** chip
   in the AI sidebar composer.

## Test 1 — Claude path (must pass)

**Goal:** prove the Claude SDK can call browser tools and receive results.

**Setup:** active tab on a deterministic local page. The simplest reproducible
target is the Ritemark welcome page (`vscode://welcome`) or a `localhost:*`
dev server. For canonical end-to-end:

```bash
cd /tmp
echo '<!doctype html><meta charset=utf-8><title>Sprint69 Test</title>
  <h1 id="hello">Hello Sprint 69</h1>
  <input id="name" placeholder="Your name" />
  <button id="go">Go</button>
  <p id="output"></p>
  <script>
    document.getElementById("go").addEventListener("click", () => {
      document.getElementById("output").textContent =
        "Hello, " + document.getElementById("name").value + "!";
    });
  </script>' > sprint69-test.html
open -a "Ritemark" sprint69-test.html
```

In the AI sidebar, with the Sprint 69 test page focused, paste:

> Look at the browser tab I have open. Fill the "Your name" input with
> "Sprint 69", then click the Go button. Tell me what the page says
> afterwards.

**Expected behaviour:**
1. Claude requests the read-context (Sprint 67 — already proven path).
2. Claude requests one of `mcp__ritemark_browser__browser_fill` and/or
   `_click`. The **control-consent dialog** pops up. Click **Allow Control**.
3. Claude executes browser_fill → browser_click → reads the resulting page.
4. Claude's final answer mentions "Hello, Sprint 69!".

**Pass evidence to capture:**
- Screenshot of the consent dialog (must be distinct from Sprint 67's
  read-consent dialog — wording mentions "navigate, click, fill, scroll").
- Screenshot of the browser tab AFTER the agent's actions (input populated,
  output showing "Hello, Sprint 69!").
- AI sidebar transcript showing `mcp__ritemark_browser__*` tool use blocks
  with their inputs and results.
- Extension host log lines (`traceClaude execution session started`) with
  `browserMcpEnabled: true`.

**Negative test:** **decline** the consent dialog on a fresh tab. The agent
should report an error like "Browser control consent was not granted for
this tab" in the tool result, and continue the turn without crashing.

## Test 2 — Codex path (must pass)

**Goal:** prove Codex `dynamicTools` are wired and `item/tool/call` round-trip
works.

**Setup:** same test page from Test 1. In the AI sidebar, switch to Codex
(model selector). Make sure Codex is signed in (Settings → Codex).

Same prompt as Test 1.

**Expected behaviour:**
1. Codex thread starts with `dynamicTools` array attached.
2. Codex requests `ritemark_browser_fill` / `ritemark_browser_click`. The
   extension host receives `item/tool/call` JSON-RPC requests.
3. Consent dialog fires on the first call (same workbench bridge — UX is
   uniform across runtimes).
4. Codex's final answer mentions "Hello, Sprint 69!".

**Pass evidence:**
- Extension host log line `traceCodex execution thread started` with
  `browserToolCount: 5`.
- Codex transcript shows `ritemark_browser_*` tool calls (not the
  `mcp__...` Claude format — Codex uses the bare names).
- Workbench `tool_call response` traces showing `success: true`.

**Known risk:** `dynamicTools` is marked **experimental** in Codex App Server.
If you see `Unknown method "item/tool/call"` or the tools never fire,
suspect a Codex upstream regression. Verify the installed Codex binary
version matches Sprint 66's bump (or newer).

## Test 3 — Feature flag gate (must pass)

**Goal:** with the flag off, browser tools are NOT registered.

**Setup:** Settings → Ritemark Features → **uncheck** AI Browser Control. Restart Ritemark (the AgentSession only re-reads the flag on session creation).

Run a prompt that would otherwise use browser tools.

**Expected:** the AI never calls `browser_*` tools (they're not in
`allowedTools` for Claude; not in `dynamicTools` for Codex). Read-only browser
context from Sprint 67 still works.

**Pass evidence:** extension host log `browserMcpEnabled: false`,
`browserToolCount: 0`.

## Test 4 — No browser tab open (must pass)

**Goal:** browser tools fail gracefully when no browser tab is active.

**Setup:** flag on, no browser tab open. Open a markdown file. Force the agent
to call a browser tool, e.g.:

> Use the browser_navigate tool to go to https://example.com

**Expected:** the agent receives an error result like "No active integrated
browser tab." and reports that back to the user. No crash.

## Test 5 — Consent revoke cascade (should pass)

**Goal:** revoking read consent also revokes control consent.

**Setup:** open browser tab, grant read consent (chip turns gray), grant
control consent (Test 1's dialog). Then via browser toolbar, click the share
toggle to **disable** sharing. The `_setSharedWithAgent(false)` path in
patch 010 must also flip `sharedWithAgentForControl` to false.

**Expected:** next browser-tool call from agent prompts for control consent
again (control was revoked along with read).

## Trace-log locations

- Claude SDK execution: `~/Library/Application Support/Ritemark/logs/<date>/extensionHost/<id>/output_logging_<n>/ritemark-trace-claude.log`
- Codex App Server: same path, `ritemark-trace-codex.log`
- Workbench JS console: VS Code Help → Toggle Developer Tools

The relevant Sprint 69 trace breadcrumbs:
- `traceClaude execution session started { browserMcpEnabled }`
- `traceCodex execution thread started { browserToolCount }`
- `traceCodex event server-request { method: 'item/tool/call' }` (Codex tool dispatch)

## What this sprint did NOT ship

If validation surfaces any of these, they are **out of scope** for Sprint 69
and should be filed as follow-up issues, not regressions:

- Cross-origin iframe interaction (Stripe, OAuth popups, embedded YouTube).
- Drag-and-drop, raw `run_playwright_code`, file upload picker handling.
- Multi-tab orchestration (agent driving more than one tab in parallel).
- Coordinate-based clicking / vision-only fallback.
- Persistent session recording / replay.

The Sprint 69 plan's "Deferred" section lists the full list.

## Pass criteria for handoff back to Sprint 69 plan

- [ ] Test 1 (Claude) passes end-to-end with consent prompt + tool execution.
- [ ] Test 2 (Codex) passes end-to-end. If Codex `dynamicTools` is broken on
  upstream, file the regression but mark the **Claude** sub-feature as
  shipping; Codex stays behind the same flag.
- [ ] Test 3 (flag off) — tools not registered.
- [ ] Test 4 (no tab) — typed error, no crash.
- [ ] Test 5 (revoke cascade) — control consent dies with read consent.

When the above are green, Sprint 69 can transition to Phase 6 (cleanup) and
Phase 7 (close-out) per the sprint plan.

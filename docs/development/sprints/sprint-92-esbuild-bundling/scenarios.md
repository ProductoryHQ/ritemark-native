# Sprint 92: esbuild Extension Host Bundling — Scenarios

BDD-style examples. Doubles as the manual QA matrix at Phase 4. Requirement IDs reference `spec.md`.

---

## R1 — Single bundled entry point

### Scenario: Dev-mode launch boots cleanly with the bundled host
```
Given extensions/ritemark has been rebuilt with the new esbuild config (npm run compile)
And a dev-mode instance is launched (scripts/vscode-development skill's dev launch path)
When Ritemark activates
Then no "Cannot find module" or "Invalid or unexpected token" errors appear in the dev console
And the editor loads a .md file in the TipTap webview as before
```

### Scenario: Full production build boots cleanly with the bundled host
```
Given ./scripts/build-prod.sh has run against the new bundling config
When the built Ritemark.app launches
Then Ritemark activates with no activation errors
And editor, AI sidebar, and Settings all load (the three surfaces the release skill's post-mortem pattern checks first)
```

### Scenario: Per-module out/ files no longer exist for the bundled entry
```
Given a fresh build
When inspecting extensions/ritemark/out/
Then out/extension.js exists and is substantially larger than pre-sprint (inlines what used to be ~130 files)
And out/ritemarkEditor.js, out/codex/codexManager.js, and similar per-module files no longer exist as separate artifacts
```

---

## R2 — browserMcpAdapter.ts stays standalone

### Scenario: OpenCode browser-tools MCP subprocess still launches and works
```
Given ritemark.opencode.autoApprove or an OpenCode/ACP session with browser tools enabled
And the extension host is bundled per R1/R2
When BrowserToolsInjector.getServers() resolves the adapter path
Then the resolved path points to a real, executable out/browser/browserMcpAdapter.js
When OpenCode spawns `node <adapterPath>` as an MCP stdio server
Then the 6 browser tools (per browserMcpAdapter.ts's tool set) respond correctly over JSON-RPC via the RITEMARK_IPC socket
```

### Scenario: browserMcpAdapter.js runs standalone with node, no other out/ files present
```
Given only out/browser/browserMcpAdapter.js is copied to an empty temp directory (simulating a partial/corrupted extraction)
When `node browserMcpAdapter.js` is run directly
Then it starts without requiring any sibling file (per its "zero external dependencies" design) — proves the entry point is genuinely self-contained
```

---

## R3 — Path-resolution landmines fixed

### Scenario: findBundledAgentRuntime resolves the extension root correctly post-bundling
```
Given the bundled extension host (out/extension.js)
When Claude Code, Codex, or OpenCode runtime discovery calls findBundledAgentRuntime() with no explicit extensionRoot override
Then the resolved path correctly points inside extensions/ritemark/binaries/agents/<platform-arch>/
And the correct binary is found and launched (not a false "not found" / null result)
```

### Scenario: Regression — bundledAgentRuntime.test.ts still passes unmodified
```
Given bundledAgentRuntime.test.ts passes an explicit extensionRoot override in every test case (verified: temp dir fixture pattern)
When the fix from R3 is applied
Then `npx tsx src/utils/bundledAgentRuntime.test.ts` still passes with no test changes needed
  (confirms the fix preserves the override path, only changes the no-override default)
```

### Scenario: All three agent runtimes launch end-to-end in a bundled dev build
```
Given the bundled host and a configured API key / bundled binary for each runtime
When the user starts a Claude Code session, a Codex session, and an OpenCode session in turn
Then all three launch their respective bundled binaries successfully (no "runtime not found" errors)
```

---

## R4 — Type-checking preserved

### Scenario: A deliberately introduced type error still fails the build
```
Given a deliberately broken type (e.g. assigning a string to a typed number parameter) in any src/ file
When `npm run compile` runs
Then it fails with a clear TypeScript error, exactly as it does pre-sprint
And no out/extension.js bundle is produced (or the stale one from the previous successful build is left in place, not silently replaced with broken output)
```

### Scenario: A clean tree compiles and bundles successfully
```
Given no type errors
When `npm run compile` runs
Then it exits 0, tsc --noEmit reports no errors, and out/extension.js + out/browser/browserMcpAdapter.js are both freshly written
```

---

## R5 — No hidden dynamic-require breakage

### Scenario: Full require()/import() audit finds no unresolved landmines
```
Given a grep sweep of extensions/ritemark/src/** for require(`...`), require(path...), import(`...`) patterns
When cross-checked against the two already-known landmines (R3) and the zero-additional-matches planning-time finding
Then the Phase 3 code-verified audit either confirms zero additional landmines, or lists every additional finding with a disposition (safe / needs rework) in notes/require-audit.md
```

---

## R6 — Validation scripts updated

### Scenario: validate-build-output.sh passes against a bundled darwin-arm64 build
```
Given a bundled production build
When ./scripts/validate-build-output.sh darwin-arm64 runs
Then it reports OK for the extension.js check (updated size floor + content sentinel)
And it does NOT attempt to check a nonexistent out/ritemarkEditor.js path
```

### Scenario: pre-commit-validator.sh Check 7 passes unchanged
```
Given the bundled extension host
When a commit is attempted
Then Check 7 ("Extension compiles") passes via `npm run compile --silent` exiting 0, with no hook script changes required
```

---

## R7 — Stale-file-list problem closed by construction (verification only — no code change this sprint)

### Scenario: The file-count reduction is visible
```
Given the bundled out/ tree (R1) vs. the pre-sprint tree
When counting files that a hypothetical extension-release manifest would need to enumerate
Then the count drops from ~130 (pre-sprint, per scripts/create-extension-release.sh's stale attempt) to ~3 (out/extension.js, out/browser/browserMcpAdapter.js, media/webview.js) plus package.json
This scenario is descriptive evidence for sprint-93, not a functional test — no code in create-extension-release.sh changes in this sprint.
```

---

## R8 — architecture.md updated

### Scenario: Sprint Architecture Gate satisfied
```
Given this sprint changes the build-pipeline structure (a "changes structure" trigger per architecture.md's Sprint Architecture Gate)
When the sprint closes
Then architecture.md's Last Updated date and Version History table both include an entry for this sprint, dated on or after the sprint branch creation date
```

---

## R9 — Droppability

### Scenario: Scope-change protocol invoked if the audit surfaces large rework
```
Given R5's Phase 3 audit finds a large or fragile list of dynamic-require call sites beyond the two known landmines
When this is discovered
Then the Mid-Sprint Scope Change Protocol is invoked (spec.md gets a dated addendum, not a silent rewrite) and the sprint's remaining scope is either reduced or deferred to a follow-up sprint
And sprint-91 is unaffected (no dependency); sprint-93 falls back to fixing scripts/create-extension-release.sh against the current multi-file tree directly, without waiting on this sprint
```

## Intentionally-untested / accepted limitations

- Windows EMFILE-class closure is only qualitatively verifiable via a real Windows CI run (post-sprint, when sprint-91's CI de-risk work + a real build are both available) — not a scenario this sprint can execute standalone in Phase 4.
- Bundle-size micro-optimization (tree-shaking tuning, minification level) is not a functional-correctness bar for this sprint — R1/R4's pass/fail scenarios are the bar.

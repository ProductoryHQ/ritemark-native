# Sprint 116 Scenarios

BDD examples for [spec.md](./spec.md). ★ scenarios require automated or native audit evidence.

## Feature: Exact snapshot approval (R1)

### ★ Scenario: Candidate table freezes one coherent set
Given Phase 0 has inspected every official runtime and SDK source
When the recommendation is presented
Then it lists current, candidate, evidence date, supported targets, and compatibility result for every component
And no product pin changes before Jarmo approves the whole set

### Scenario: Upstream publishes a newer version after approval
Given an exact snapshot is approved
When a vendor publishes another version before sprint close
Then the approved snapshot remains unchanged
And the newer version is recorded for a later dated decision rather than silently substituted

### Scenario: One candidate is not ready
Given four components pass but one required platform artifact or protocol path fails
When Phase 0 closes
Then the affected runtime stays on its last coherent known-good set or the sprint stops for a decision
And no partial incompatible mixture is called complete

## Feature: Runtime manifest completeness (R2)

### ★ Scenario: Complete manifest validates
Given the approved exact component matrix
When manifest validation runs
Then each required agent/component/target row appears exactly once
And every URL, checksum, install name, architecture, license, and validation rule passes

### ★ Scenario: Required Codex helper is missing
Given a manifest omits code-mode-host or a required Windows helper
When validation runs
Then it fails before fetch or build
And names the missing component and target

### Scenario: Archive content differs from the manifest
Given a downloaded checksum or archive path is wrong
When fetch runs
Then installation stops without promoting partial output
And the existing installed runtime is not presented as the new candidate

### Scenario: IPC helper has no CLI version command
Given a platform helper accepts only IPC input
When it is verified
Then checksum, architecture, and packaged presence are checked
And Ritemark does not invent a misleading `--version` smoke test

## Feature: SDK and protocol compatibility (R3)

### ★ Scenario: Claude lockstep is enforced
Given Claude binary and Agent SDK patches differ
When validation runs
Then it fails with both versions
And no package or release build proceeds

### ★ Scenario: Codex real canary exercises file tools
Given app-server and code-mode-host are installed from the candidate snapshot
When an authenticated workspace-write canary reads and edits a fixture through the normal runtime path
Then both components start and the turn completes under unified approval policy

### ★ Scenario: OpenCode negotiates ACP capabilities
Given the candidate OpenCode and ACP SDK
When a session initializes and runs a tool-bearing turn
Then capabilities, progress, question/approval behavior, and completion match the typed adapter contract

### Scenario: Candidate adds an optional protocol field
Given a runtime response includes an unknown optional field
When the adapter parses it
Then the known response remains usable
And no broad untyped cast is added

### Scenario: Candidate changes a required field
Given a required response shape no longer matches
When the conformance fixture runs
Then the adapter fails explicitly with captured evidence
And implementation waits for an approved measured compatibility plan

## Feature: Canonical model truth (R4)

### ★ Scenario: Live discovery and bundled catalog agree
Given authenticated provider discovery is available
When curated entries are resolved
Then every visible canonical item is accepted or deliberately retained as an offline-only documented fallback
And unsupported/deprecated entries are not presented as current defaults

### ★ Scenario: Alias spellings resolve to one picker item
Given two provider spellings resolve to the same underlying model
When the picker projection is built
Then one canonical identity is shown
And persisted selections migrate or resolve without duplicate rows

### Scenario: Provider is offline at startup
Given no network or credential is available
When the model picker initializes
Then the bundled/cached floor remains usable
And the UI distinguishes cached truth from live verification

### Scenario: Default model is retired
Given a configured default no longer resolves as usable
When the catalog loads
Then a documented supported fallback is selected
And the user is not sent a removed model ID

### Scenario: Model ID is added outside modelConfig
Given a code change hardcodes a new model identifier elsewhere
When focused/static validation runs
Then the change fails review or an automated single-source test

## Feature: Preserved behavior (R5)

### ★ Scenario: Runtime behavior matrix passes
Given the final candidates
When Claude, Codex, and OpenCode run their applicable start/stream/tool/approval/question/cancel/completion paths
Then every supported path matches the existing user contract
And differences are explicitly documented rather than normalized falsely

### ★ Scenario: Provider failure stays isolated
Given Claude is signed out while Codex is ready
When Agent Chat hydrates and sends through Codex
Then Codex remains available and completes
And Claude alone shows its recovery state

### ★ Scenario: Continuation truth is revalidated
Given saved conversations with provider-native, normalized-handoff, and no-usable-context cases
When they continue on final pins
Then the Sprint 110 result labels and context boundaries remain truthful

### ★ Scenario: Thinking effort is revalidated
Given Auto and explicit supported/unsupported effort choices
When turns run on final pins
Then sent values, downgrade copy, and persisted selection match Sprint 112

### Scenario: Browser tools use the shared injector
Given every runtime starts a browser-capable turn
When tool configuration is inspected
Then all browser tools come through `BrowserToolsInjector`
And no adapter-specific browser path appears

## Feature: Native targets and rollback (R6, R7)

### ★ Scenario: Every native target proves startup
Given final manifest artifacts
When the native matrix runs on darwin-arm64, darwin-x64, and win32-x64
Then architecture and startup pass for each invocable component
And evidence records the exact commit, manifest digest, target, and result

### Scenario: Final candidate must be rolled back
Given a post-pin regression is found
When the rollback record is applied
Then manifest, SDKs, lockfile, catalog/defaults, and measured adapter changes return to one known-good snapshot
And durable conversations remain readable

## Feature: Closeout (R8)

### ★ Scenario: Baseline is ready for Sprint 117
Given focused tests, native evidence, docs, and repository QA pass
When Sprint 116 closes
Then the release tracker records its merged commit and exact versions
And Sprint 117 can consume the frozen baseline without re-auditing moving inputs

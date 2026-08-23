# Sprint 111 Scenarios

BDD examples for [spec.md](./spec.md). These are the manual QA matrix; ★ scenarios require automated or scripted evidence.

## Feature: Reproducible runtime snapshot (R1, R2, R5)

### ★ Scenario: Manifest materializes exact target bytes
Given the Sprint 111 target manifest is checked in
When the fetch script downloads every supported artifact
Then every URL contains the pinned version rather than latest
And every archive passes its recorded SHA-256 before extraction
And each installed file matches its platform and architecture

### ★ Scenario: Claude pair cannot drift
Given the Claude binary pin is 2.1.239
When the package dependency or installed Agent SDK is not 0.3.239
Then the parity check fails with both observed versions
And release preflight cannot pass

### Scenario: One platform artifact is missing
Given a runtime release lacks the expected Windows x64 archive
When Phase 0 validates the target set
Then the sprint does not invent an alternative source or reuse an old Windows binary
And the target is blocked or explicitly revised at the Jarmo decision gate

## Feature: Codex protocol compatibility (R3)

### ★ Scenario: Updated app-server completes the core lifecycle
Given bundled Codex 0.149.0 is selected
When I authenticate, start a conversation, send two turns, approve a request, and cancel a later turn
Then events stay bound to the correct conversation
And the final transcript and runtime status are correct

### ★ Scenario: Protocol fixture detects a required-field change
Given an upstream response omits or changes a required field used by Ritemark
When the Codex contract fixture is parsed
Then the focused test fails with the method and field name
And the event is not silently routed using guessed defaults

### Scenario: Unknown optional Codex field arrives
Given Codex adds an optional response field Ritemark does not use
When the message is received
Then the known contract continues to work
And diagnostics do not dump sensitive raw payloads

## Feature: OpenCode and ACP compatibility (R4)

### ★ Scenario: ACP 1.x supports the existing OpenCode lifecycle
Given OpenCode 1.18.21 is connected through ACP SDK 1.4.0
When I create two sessions, choose different models, send turns, approve one request, and cancel the other
Then session events never cross-bind
And each operation settles with the expected ACP result

### ★ Scenario: Thought-level capability is discoverable
Given OpenCode exposes session config options
When Ritemark inspects the options
Then a thought-level control is identified by the ACP semantic category rather than a hardcoded option ID
And its current value and allowed choices are recorded for Sprint 112

### Scenario: Major SDK contract is incompatible
Given ACP SDK 1.4.0 cannot preserve a required Ritemark behavior
When Phase 0 reaches its decision gate
Then production dependencies remain unchanged
And the blocker, smallest compatible option, and follow-up decision are documented

## Feature: Regression and isolation floor (R6, R7)

### ★ Scenario: Two runtime sessions remain isolated
Given two conversations use the same refreshed runtime
When both stream, request input, and finish concurrently
Then each event, approval, and completion reaches only its owning conversation

### ★ Scenario: Continuation conclusions are revalidated
Given Sprint 110 recorded native and fallback continuation behavior on older pins
When the refreshed runtimes run the continuation matrix
Then every runtime receives a new result against the final v1.10.0 version
And any changed conclusion updates the Sprint 110/release evidence before feature complete

### Scenario: One runtime fails to start
Given the OpenCode binary is corrupt or cannot launch
When I open Agent Chat
Then OpenCode is marked unavailable with actionable diagnostics
And Claude, Codex, and durable conversation history remain usable

### Scenario: System runtime preference is enabled
Given I explicitly choose the system runtime preference
When a supported runtime starts
Then Ritemark reports the selected source and version
And bundled release validation remains tied to the manifest pins rather than my local system version

# Sprint 76 Scenarios — ACP Client + OpenCode BYOK Runtime

These scenarios are the source for the manual QA matrix in `tasks.md` (final phase). Do not
duplicate them there — reference them.

## Feature: ACP Client Core (R1)

### Scenario: Successful session round-trip
Given the OpenCode binary is installed and resolvable
When the ACP client spawns it and sends `initialize` followed by `session/new` and `session/prompt` with "Summarize this document"
Then the client receives `session/update` notifications with streaming text
And the prompt completes with a final response
And the agent process exits cleanly when the client shuts down

### Scenario: Agent process crashes mid-session
Given an ACP session is streaming a response
When the agent process is killed externally (simulating a crash)
Then the AI sidebar shows an error progress event with a human-readable message
And the sidebar returns to idle state
And a new session can be started without reloading the window

### Scenario: Malformed JSON from agent
Given an ACP session is active
When the agent emits a line that is not valid JSON-RPC
Then the client logs the line to the trace channel and continues processing subsequent messages
And the session does not hang

## Feature: OpenCode Bundling & Discovery (R2)

### Scenario: Bundled binary is found and used
Given a production build with the OpenCode binary installed under `binaries/agents/darwin-arm64/`
When the user selects OpenCode in the agent selector and sends a prompt
Then the bundled binary is spawned (not a system-PATH one)
And the trace channel logs the resolved binary path

### Scenario: Binary missing from bundle
Given the OpenCode binary is absent from both the bundle and system PATH
When the user selects OpenCode
Then the sidebar shows a setup message explaining the runtime is unavailable
And no crash or unhandled rejection occurs

### Scenario: sha256 mismatch at fetch time
Given the manifest's sha256 for OpenCode does not match the downloaded archive
When the fetch script runs
Then installation fails loudly with a checksum error
And no binary is installed

## Feature: BYOK Key Configuration (R3)

### Scenario: Gemini key configured, Gemini models available
Given the user has saved a Google Gemini API key in Ritemark Settings → BYOK
When the user opens the model dropdown with OpenCode selected
Then Gemini models appear in the list
And selecting one and prompting produces a streamed response generated via the user's key

### Scenario: No keys configured
Given no BYOK keys are saved
When the user selects OpenCode in the agent selector
Then the sidebar shows a "Set up your keys" prompt with a button that opens Settings → BYOK
And no prompt can be sent until at least one key is saved

### Scenario: Key removed after configuration
Given the user previously configured an OpenAI key and used OpenCode with it
When the user deletes the key in Settings and starts a new OpenCode session
Then OpenAI models no longer appear in the model dropdown
And the agent process spawned for the new session does not receive `OPENAI_API_KEY` in its environment

### Scenario: Keys never leak to the webview (negative, security)
Given BYOK keys are configured
When any webview message is inspected in the trace channel during an OpenCode session
Then no message payload contains a key value
And keys appear only in the spawned process environment

## Feature: File-Edit Approval Gating (R4)

### Scenario: Agent edit requires approval
Given an OpenCode session in the AI sidebar with a workspace document open
When the agent attempts `fs/write_text_file` on `notes.md`
Then an approval card appears in the sidebar showing the target file and a diff/preview
And the file on disk is unchanged until the user clicks Approve

### Scenario: User rejects an edit (negative)
Given an approval card is shown for a pending `fs/write_text_file`
When the user clicks Reject
Then the file on disk is unchanged
And the agent receives the rejection outcome and continues (e.g. reports it could not complete the edit)
And the session does not hang or crash

### Scenario: Write outside workspace root (negative, security)
Given an OpenCode session scoped to workspace `/Users/x/notes`
When the agent attempts to write to `/Users/x/.zshrc` or a path containing `../`
Then the write is rejected automatically without prompting the user
And a notice appears in the progress stream explaining the rejection

### Scenario: "Always allow for this session"
Given the user approves an edit with "always allow" selected
When the agent makes a second `fs/write_text_file` request in the same session
Then the write proceeds without a new approval card
And starting a new session resets to per-edit approval

## Feature: Streaming Progress (R5)

### Scenario: Tool calls visible during execution
Given an OpenCode session processing a multi-step prompt
When the agent reads files and runs tools
Then the sidebar shows progress entries for each tool call with the tool name
And text chunks stream into the response area as they arrive

### Scenario: Cancellation
Given an OpenCode session is mid-execution
When the user clicks the stop button
Then `session/cancel` is sent
And the UI returns to idle within 2 seconds
And a subsequent prompt starts a fresh turn successfully

## Feature: Model Selection (R6)

### Scenario: Composite value routing
Given keys for both Gemini and OpenAI are configured
When the user selects `Gemini 3 Pro` under OpenCode in the model dropdown
Then the dropdown value is `opencode:google/gemini-3-pro` (composite format)
And the next prompt is executed by that provider/model
And switching to `opencode:openai/gpt-5.2` mid-conversation applies on the next prompt

## Feature: Feature Flag (R7)

### Scenario: Flag disabled hides everything
Given `opencode-integration` is set to disabled (via the feature-flag JSON layer)
When the user opens the AI sidebar and Settings
Then OpenCode does not appear in the agent selector
And the BYOK section does not appear in Settings
And existing Claude Code / Codex functionality is unaffected

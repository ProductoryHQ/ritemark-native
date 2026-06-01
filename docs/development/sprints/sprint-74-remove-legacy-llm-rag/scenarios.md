# Sprint 74 Scenarios

## Feature: RAG subsystem removed (R2)

### Scenario: No RAG citations after removal
Given the RAG subsystem has been deleted
When I open a Markdown file and use the AI sidebar with a canonical runtime
Then no RAG citation chips appear
And no `rag-results` message is sent to the webview
And no vector DB is initialised on workspace open.

### Scenario: Build no longer ships the vector dependency
Given `@orama/orama` has been removed from package.json
When I run `npm install` and `tsc`
Then compilation succeeds with zero references to `src/rag/`
And `@orama/orama` is absent from the dependency tree.

## Feature: Legacy direct-LLM runtime removed (R3)

### Scenario: Agent selector offers only canonical runtimes
Given the legacy runtime has been removed
When I open the agent selector in the AI sidebar
Then I see Claude Code and Codex
And I do NOT see a "Legacy Agent" option.

### Scenario: Ghost client is gone
Given `openAIClient.ts` has been deleted
When I search the source for `executeCommand` defined in `ai/`
Then there is no such definition
And nothing imports `openAIClient`.

## Feature: Canonical runtimes intact (R4) — negative / guard scenarios

### Scenario: Claude Code chat still works
Given the legacy runtime and RAG are removed
When I select Claude Code and send a message
Then the agent runs end-to-end via `ai-execute-agent`
And cancellation (`ai-cancel`) still aborts the run.

### Scenario: Codex chat still works
Given the removal is complete
When I select Codex and send a message
Then Codex responds end-to-end as before.

### Scenario: Flows LLM and Image nodes still execute
Given `openai`, `apiKeyManager`, and `modelConfig` are retained
When I run a Flow containing an LLM node and an Image node
Then both nodes execute successfully using the configured API key.

### Scenario: Old legacy conversation does not crash history (data-safety)
Given a saved conversation whose `agentId` is `ritemark-agent`
When I open the conversation history panel
Then the conversation still displays (read-only, via the `legacy-ritemark` compat mapping)
And the panel does not error
And I cannot start a NEW legacy conversation.

### Scenario: API key configuration still works
Given Flows depend on API keys
When I run the `configureApiKey` command
Then I can still set OpenAI / Gemini keys.

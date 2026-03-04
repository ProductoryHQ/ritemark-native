# Ritemark v1.4.1

**Released:** 2026-03-XX  
**Type:** Minor (multi-agent AI + UX improvements)  
**Download:** [GitHub Release](https://github.com/jarmo-productory/ritemark-public/releases/tag/v1.4.1)

## Highlights

Ritemark v1.4.1 turns the AI sidebar into a **multi-agent workspace**. You can now choose between three AI agents -- Claude Code, OpenAI Codex, and the built-in Ritemark Agent -- and switch between them with a single dropdown. New Plan Mode lets you review what the agent intends to do before it touches your files, and smarter context handling keeps long conversations from breaking silently.

## What's New

### Choose Your AI Agent: Codex Joins the Team

Ritemark now supports **three AI agents** in the sidebar:

-   **Ritemark Agent** -- the built-in assistant for writing, translation, and content tasks
    
-   **Claude Code** -- Anthropic's autonomous coding agent (added in v1.4.0)
    
-   **OpenAI Codex** -- OpenAI's coding agent, new in this release
    

Switch between them using the agent dropdown in the AI sidebar. Each agent has its own chat view, but they share the same clean interface -- chat bubbles, activity feed, running indicator, and chat history all look and work the same way regardless of which agent you pick.

**Codex authentication** uses your ChatGPT account. Sign in via browser-based OAuth directly from Ritemark Settings. Your token is stored securely in the OS keyring.

**Getting started with Codex:**

1.  Install the Codex CLI: `npm install -g @openai/codex`
    
2.  Open Settings and sign in with your ChatGPT account
    
3.  Select "Codex" from the agent dropdown in the AI sidebar
    

Requires a ChatGPT Plus, Pro, Team, or Business account.

### Plan Mode: Review Before Executing

Sometimes you want to see the plan before the AI starts changing files. Now you can.

Type something like **"plan first"** or **"show me the plan"** in your message, and the agent will propose a structured plan instead of acting immediately. The plan appears as a formatted outline with numbered steps. You then click **Approve** to execute or **Reject** to provide feedback and ask for a revised approach.

This gives you a safety net for complex operations -- you stay in control of what gets changed.

### Interactive Questions

When the AI agent needs clarification mid-task, it now asks you directly instead of guessing or stalling.

Questions appear inline in the conversation with selectable answer options. Pick one, pick several, or type a custom answer using the "Other" option. The conversation resumes as soon as you respond.

No more silent blocks where the agent stops doing anything and you are not sure why.

### File Context: Right-Click to Add Context

Give the AI agent more context without manually typing file paths.

-   **Right-click in Explorer:** Select any file or folder, choose "Send to AI Chat", and its path appears as a removable chip in the chat input. Works with multi-select.
    
-   **Active file chip:** The file you are currently editing automatically appears as context above the chat input. It updates as you switch tabs and can be dismissed.
    
-   **Smart deduplication:** If you manually add a file that is already the active file, Ritemark skips the automatic context to avoid wasting tokens.
    

File path drops via drag-and-drop now work with all three agents, not just Claude Code.

### Context Window Protection

Long AI conversations can exceed the model's context window, causing cryptic errors or silent failures. Ritemark now handles this gracefully.

-   **Usage bar:** A thin progress bar at the top of the conversation shows estimated context usage. It turns yellow at 60% and red at 80%.
    
-   **Warning banner:** At 70% capacity, a banner suggests using `/compact` or starting a fresh conversation.
    
-   **Overflow handling:** If the model returns a "prompt too long" error, Ritemark shows a clear explanation and a button to start a fresh conversation -- instead of a confusing error message.
    

## Bug Fixes

-   Fixed Codex feature flag mismatch that could prevent the integration from activating
    
-   Fixed a memory leak in the settings provider
    
-   Fixed JSON-RPC calls to Codex hanging indefinitely if unanswered
    
-   Fixed Codex binary detection on Windows
    
-   Fixed OAuth login spinner getting stuck when authentication fails silently
    

## Improvements

-   **Patch consolidation:** 21 individual VS Code patches have been consolidated into 4 domain-grouped patches. No functional change, but the codebase is significantly easier to maintain.
    
-   **Cleaner Source Control:** The VS Code submodule no longer appears in the Source Control panel.
    
-   **Agent badges in history:** The chat history panel now shows which agent (Claude, Codex, or Agent) was used for each conversation.
    

## Known Limitations

-   **Codex requires separate installation:** The Codex CLI must be installed via npm before use.
    
-   **Codex requires a paid ChatGPT plan:** Free ChatGPT accounts may not have the required API access.
    
-   **Plan mode starts a new session:** Activating plan mode on an existing session creates a new one (the existing conversation cannot be converted).
    
-   **Context estimation is approximate:** The usage bar uses a heuristic (~4 characters per token). Actual usage may vary.
    

## Upgrade Notes

**macOS:**

1.  Download `Ritemark-arm64.dmg` (Apple Silicon) or `Ritemark-x64.dmg` (Intel)
    
2.  Open the DMG and drag to Applications (replace existing)
    
3.  Launch Ritemark
    

**Windows:**

1.  Download the Windows installer from the GitHub release page
    
2.  Run the installer (upgrades existing installation)
    
3.  Launch Ritemark
    

Your documents, settings, Flows, chat history, and RAG index are all preserved.

## What's Next

-   Agent workspace permissions UI (visual picker for folder access)
    
-   Checkpoint system for agent file modifications (undo/redo)
    
-   More agent integrations
    

## Support

**Issues:** [GitHub Issues](https://github.com/jarmo-productory/ritemark-native/issues)  
**Documentation:** [docs/](https://github.com/jarmo-productory/ritemark-native/tree/main/docs)

* * *

**Sprint Credits:**

-   Sprint 36: Codex CLI + ChatGPT Integration
    
-   Sprint 38: Patch Consolidation
    
-   Sprint 39: Agent UX (Plan Mode, Questions, File Context)
    
-   Sprint 40: Context Window Protection
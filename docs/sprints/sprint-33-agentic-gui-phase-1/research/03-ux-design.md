# UX Design: Agentic GUI Phase 1

**Sprint 33: Agentic GUI - Phase 1**
**Date:** 2026-02-07
**Updated:** 2026-02-07 (Jarmo feedback: simplified agent selector)

## Design Principles (from Research Doc)

1. **Simplicity first:** Two clear choices, not abstract mode names
2. **Activity feed, not terminal:** Structured cards with icons
3. **Undo > Approval:** Easy rollback is the real safety net
4. **Folder permissions:** Non-technical users understand folders
5. **Show the "why":** Agent explains reasoning, not just actions
6. **Writing-specific skills:** Not just code tools
7. **Persistent selection:** Choice sticks until user changes it

## Agent Selector (Replaces Three-Mode)

**Jarmo's decision:** No abstract modes (Chat/Assist/Auto). Instead, a simple persistent agent selector with two concrete choices.

Located at top of Unified AI View sidebar as a dropdown or toggle.

```
┌──────────────────────────────────────┐
│ Agent: [Ritemark Agent ▼]            │
│        ┌─────────────────────┐       │
│        │ Ritemark Agent    ← │       │
│        │ Claude Code         │       │
│        └─────────────────────┘       │
└──────────────────────────────────────┘
```

### Agent: Ritemark Agent (Default)

**What it is:** Current AI chat behavior + RAG. The familiar Ritemark assistant.

**Capabilities:**
- LLM chat with context (existing behavior)
- RAG-powered knowledge search
- Image generation
- No autonomous file operations

**UI:** Unchanged from current -- same chat interface users already know.

### Agent: Claude Code

**What it is:** Full agentic assistant powered by Claude Agent SDK. Can read, write, search, and organize files autonomously.

**Capabilities:**
- Everything Ritemark Agent does, plus:
- Read/write/edit files in workspace
- Search across files (grep, glob)
- Execute multi-step tasks autonomously
- Activity feed shows all operations in real time

**UI additions when selected:**
- Activity feed with structured cards (replaces plain chat)
- Folder permission selector
- Stop/cancel button during execution
- Results summary with file change review

**Requirements:**
- Anthropic API key configured
- Feature flag enabled (experimental phase)

### Persistence

- Selection stored in VS Code settings (`ritemark.ai.selectedAgent`)
- Persists across sessions, restarts, workspace changes
- Default: `ritemark-agent`
- No per-conversation switching -- global preference

### Future: More Agents

The selector is designed as a dropdown, not a toggle, so it naturally accommodates future additions:

```
┌─────────────────────┐
│ Ritemark Agent     ← │  (default, current chat + RAG)
│ Claude Code          │  (Phase 1: Claude Agent SDK)
│ Codex                │  (Phase 2: OpenAI Codex SDK)
│ Gemini Agent         │  (Future: if Google ships agent SDK)
└─────────────────────┘
```

This also means each provider's agent can have its own personality, tool set, and capabilities -- no need to abstract them behind generic mode names.

## Activity Feed UI

Replaces terminal-style output with structured cards.

### Card Types

#### 1. Thinking Card
```
┌──────────────────────────────────────┐
│ 💭 Thinking                          │
│ Planning how to reorganize notes...   │
│ • Found 23 markdown files            │
│ • Identified 5 topic clusters        │
└──────────────────────────────────────┘
```

#### 2. Tool Use Card (Read)
```
┌──────────────────────────────────────┐
│ 📖 Reading                           │
│ research/chapter-3.md                │
│ [Expand for preview]                 │
└──────────────────────────────────────┘
```

#### 3. Tool Use Card (Write)
```
┌──────────────────────────────────────┐
│ ✏️ Writing                           │
│ outline.md (new file)                │
│ "Creating thesis outline with 5..."  │
│ [Preview] [Undo]                     │
└──────────────────────────────────────┘
```

#### 4. Tool Use Card (Edit)
```
┌──────────────────────────────────────┐
│ ✏️ Editing                           │
│ research/intro.md                    │
│ "Moving methodology section before..." │
│ [Show Diff] [Undo]                   │
└──────────────────────────────────────┘
```

#### 5. Tool Use Card (Search)
```
┌──────────────────────────────────────┐
│ 🔍 Searching                         │
│ Pattern: "climate data"              │
│ Found 12 matches in 5 files          │
│ [Show Results]                       │
└──────────────────────────────────────┘
```

#### 6. Done Card
```
┌──────────────────────────────────────┐
│ ✅ Done                              │
│ Reorganized 3 files, created 1 new   │
│ Duration: 2.3s • Cost: $0.04         │
│ [Review All Changes]                 │
└──────────────────────────────────────┘
```

#### 7. Error Card
```
┌──────────────────────────────────────┐
│ ❌ Error                             │
│ Permission denied: /System/...       │
│ [Retry] [Cancel]                     │
└──────────────────────────────────────┘
```

### Visual Hierarchy

- **Icons:** Large (24px), colored by type
- **File names:** Bold, truncated to basename if long
- **Explanations:** Regular text, italic for reasoning
- **Actions:** Buttons at bottom of card
- **Timestamps:** Small, right-aligned

## Folder Selector

Appears when Claude Code agent is selected.

```
┌──────────────────────────────────────┐
│ 📁 Allowed Folders                   │
│                                      │
│ ✓ ~/Documents/research               │
│ ✓ ~/Documents/drafts                 │
│ ✗ ~/Documents/personal               │
│                                      │
│ [ + Add Folder ]                     │
└──────────────────────────────────────┘
```

### Behavior

- Default: Entire workspace allowed (with warning)
- User clicks "+ Add Folder" → VS Code folder picker
- Agent cannot access paths outside selected folders
- Validation happens before SDK execution

## Checkpoint Timeline (Future)

Appears at bottom of activity feed when Claude Code agent is selected. Deferred to future sprint.

```
──────── Checkpoints ────────

●───●───●───●
^   ^   ^   ^
0s  12s 28s 45s (current)

[◀ Undo to 28s] [▶ Redo]
```

### Behavior

- Checkpoint created before each file modification
- Scrubber allows visual navigation
- Undo restores file state from checkpoint
- Redo moves forward if user undid

## Integration with Existing UI

### Changes to UnifiedViewProvider Webview

1. **Add agent selector dropdown** at top
2. **Add folder selector** (conditional, Claude Code only)
3. **Replace chat messages** with activity feed cards (when Claude Code selected)
4. **Keep input area** unchanged (prompt entry)

### What Stays the Same

- API key status indicator
- Connectivity banner
- Index footer (RAG stats)
- Message input field
- Send/Stop buttons
- Everything when "Ritemark Agent" is selected (zero UI change)

## Responsive Behavior

- Activity cards stack vertically
- File names truncate with ellipsis
- Folder selector scrolls if many folders
- Timeline scrubber horizontal scroll on narrow sidebars

## Accessibility

- Icons have aria-labels
- Cards are keyboard navigable
- Buttons have clear focus states
- Screen reader announces new activity cards

## Mobile Considerations

N/A - VS Code desktop only

## Color Coding (VS Code Theme Variables)

- Thinking: `--vscode-textLink-foreground`
- Reading: `--vscode-charts-blue`
- Writing/Editing: `--vscode-charts-green`
- Searching: `--vscode-charts-yellow`
- Error: `--vscode-errorForeground`
- Done: `--vscode-charts-green`

## Animation

- New cards fade in from top
- Undo action fades out affected card
- Timeline scrubber smooth scroll
- No excessive animation (VS Code aesthetic)

## Resolved Questions

1. ~~Should we use Chat/Assist/Auto modes?~~
   - **RESOLVED (Jarmo):** No. Simple agent selector: Ritemark Agent / Claude Code. Persistent until user changes it. Dropdown to support future agents (Codex, Gemini).

## Open Questions for Jarmo

1. Should folder selector default to workspace root or require explicit selection?
   - **Recommendation:** Default to workspace root with clear indicator

2. Should we show cost per request after completion?
   - **Recommendation:** Yes, in the Done card ("Duration: 2.3s | Cost: $0.04")

3. Maximum number of allowed folders?
   - **Recommendation:** No limit, but UI collapses after 5 (scroll list)

4. Should agent selector be visible only when feature flag is ON, or always visible but Claude Code option disabled?
   - **Recommendation:** Always show dropdown, but Claude Code option shows "(experimental)" label and requires flag to be ON

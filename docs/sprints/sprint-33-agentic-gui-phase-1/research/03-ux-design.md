# UX Design: Agentic GUI Phase 1

**Sprint 33: Agentic GUI - Phase 1**
**Date:** 2026-02-07

## Design Principles (from Research Doc)

1. **Progressive autonomy:** Users choose risk level
2. **Activity feed, not terminal:** Structured cards with icons
3. **Undo > Approval:** Easy rollback is the real safety net
4. **Folder permissions:** Non-technical users understand folders
5. **Show the "why":** Agent explains reasoning, not just actions
6. **Writing-specific skills:** Not just code tools
7. **Background tasks:** Long operations with notifications

## Three-Mode Selector

Located at top of Unified AI View sidebar.

```
┌──────────────────────────────────────┐
│ Ritemark AI  [Chat▼][Assist][Auto]   │
└──────────────────────────────────────┘
```

### Mode: Chat (Default)

**What it does:**
- Current behavior (LLM chat + RAG)
- No file modifications
- Zero risk

**UI state:**
- Chat mode active (highlighted)
- No folder selector visible
- Standard chat input

### Mode: Assist

**What it does:**
- Agent can read files, suggest edits
- User approves each action
- Low risk

**UI additions:**
- Folder selector appears below mode tabs
- Activity feed shows proposed actions
- Approve/Deny buttons per action

**Example:**
```
[Thinking] I'll reorganize your notes...

[Proposed Action]
├─ Read: research/chapter-1.md
├─ Read: research/chapter-2.md
└─ Write: outline.md (new file)

[ Approve ] [ Deny ]
```

### Mode: Auto

**What it does:**
- Agent executes multi-step tasks autonomously
- User can pause at any time
- Medium risk

**UI additions:**
- Folder selector (required)
- Activity feed shows real-time progress
- Pause button always visible
- Checkpoint timeline

**Example:**
```
[Working on: "Reorganize research notes"]

● Reading files...              12/23 files
● Analyzing content...          Done
● Creating outline...           In progress

[ ⏸ Pause ]

──── Checkpoint: 2 min ago ────
[Timeline] ●───●───●
           ^       ^
         start   current
```

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

Appears when Assist or Auto mode is active.

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

## Checkpoint Timeline

Appears at bottom of activity feed in Auto mode.

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

1. **Add mode tabs** at top
2. **Add folder selector** (conditional, Assist/Auto only)
3. **Replace chat messages** with activity feed cards
4. **Add checkpoint timeline** at bottom (Auto only)
5. **Keep input area** unchanged (prompt entry)

### What Stays the Same

- API key status indicator
- Connectivity banner
- Index footer (RAG stats)
- Message input field
- Send/Stop buttons

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

## Open Questions for Jarmo

1. Should Chat mode still show RAG citations?
   - **Recommendation:** Yes, keep existing behavior

2. Should folder selector default to workspace root or require explicit selection?
   - **Recommendation:** Show warning if entire workspace, encourage folder selection

3. Should we show cost estimation before execution in Assist mode?
   - **Recommendation:** Yes, "Estimated cost: ~$0.05" before approval

4. Maximum number of allowed folders?
   - **Recommendation:** No limit, but UI collapses after 5 (scroll list)

5. Should timeline checkpoints auto-expire after X operations?
   - **Recommendation:** Keep last 20 checkpoints, older ones garbage collected

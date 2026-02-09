# UX Improvements: AI Sidebar

**Problem:** Current sidebar looks like a CI/CD build log, not a conversation with an AI assistant.

---

## What's Wrong (from screenshot)

| Issue | Impact |
|-------|--------|
| User message labeled "> You" with `>` icon | Feels like a log entry, not YOUR message |
| "Starting" shows raw `claude-opus-4-5-20251101` | Technical noise, meaningless to users |
| "Thinking" card contains the actual response | Confusing — response mislabeled as "thinking" |
| TWO "Done" cards (one summary, one with full text) | Duplicate, cluttered |
| Text icons: `>`, `?`, `#`, `+`, `!` | Primitive, hard to scan |
| Agent selector is plain `<select>` | Feels like a debug form, not a product |
| All cards have equal visual weight | No hierarchy — can't find the answer |

**Root cause:** The UI treats every SDK event as an equal-weight card. Users want a CONVERSATION where the response is prominent and the "work" is secondary.

---

## Design Principle: Progressive Disclosure

```
┌─────────────────────────────────┐
│  YOUR MESSAGE          (clear)  │  ← Prominent, clearly yours
├─────────────────────────────────┤
│  RESPONSE              (star)   │  ← The main content
├─────────────────────────────────┤
│  ▶ Activity  4.6s  $0.03       │  ← Collapsed, expandable
└─────────────────────────────────┘
```

Show the answer. Hide the plumbing.

---

## Proposed Changes

### 1. User Message → Chat Bubble

**Before:**
```
┌─ Card ─────────────────┐
│ >  You                 │
│    Hei, Claude         │
└────────────────────────┘
```

**After:**
```
              ┌──────────────────┐
              │  Hei, Claude     │  ← Right-aligned, accent bg
              └──────────────────┘
```

### 2. Response → Prominent, Readable

**Before:** Buried in a "Done" card with `+` icon, mixed with metrics

**After:**
```
┌─ Claude Code ──────────────────┐
│                                │
│  Hei! Kuinka voin auttaa       │
│  Ritemark Native -projektissa  │
│  tanaan?                       │
│                                │
│  ▶ 3 steps  ·  4.6s  ·  $0.03 │  ← Collapsed activity
└────────────────────────────────┘
```

Click `▶` to expand:
```
│  ▼ 3 steps  ·  4.6s  ·  $0.03 │
│  ├─ ⚡ Started                  │
│  ├─ 🧠 Analyzed request        │
│  └─ ✅ Completed               │
```

### 3. Icons → Proper SVG

| Type | Current | Proposed | Why |
|------|---------|----------|-----|
| Starting | `>` | `⚡` Zap | Energy, action |
| Thinking | `?` | `🧠` Brain | Cognition |
| Tool: Read | `#` | `📄` FileText | Reading files |
| Tool: Write | `#` | `✏️` Pencil | Writing files |
| Tool: Bash | `#` | `>_` Terminal | CLI command |
| Done | `+` | `✅` CheckCircle | Success |
| Error | `!` | `⚠️` AlertTriangle | Warning |

Use inline SVGs from Codicons (already in VS Code) — no external deps.

### 4. Agent Selector → Segmented Tabs

**Before:** Plain HTML `<select>` dropdown

**After:**
```
┌─────────────────────────────────────┐
│  ┌──────────────┬─────────────────┐ │
│  │ 💬 Ritemark  │ 🤖 Claude Code  │ │
│  │   [active]   │   (beta)        │ │
│  └──────────────┴─────────────────┘ │
└─────────────────────────────────────┘
```

CSS-only: two `<button>` elements with active state styling. No JS framework needed.

### 5. Kill Duplicate Cards

**Current flow produces:**
1. `init` → "Starting" card
2. `thinking` → "Thinking" card (contains response!)
3. `done` → "Completed in 4.6s" card
4. `agent-result` → ANOTHER "Done" card with full text

**Fix:** In `renderAgentFeed()`:
- Skip rendering `init` as a card (it's just "Starting model-id")
- `thinking` events with text → accumulate into response bubble
- Merge `done` + `agent-result` into ONE completion state
- Show activity as collapsible summary BELOW the response

### 6. Hide Technical Noise

- **Model ID** (`claude-opus-4-5-20251101`) → Never show to user
- **Cost** → Subtle gray text in activity summary, not a card
- **Duration** → Same, subtle in summary line

---

## Implementation Plan (CSS + JS only, no React migration)

### Quick wins (change in `UnifiedViewProvider.ts`):

1. **User message styling** — right-align, accent background, rounded
2. **Merge response logic** — accumulate `thinking` text events into response, don't create separate cards
3. **Collapse activity** — wrap tool trace in `<details><summary>`
4. **Replace text icons** — use Codicon SVGs inline
5. **Style agent selector** — two buttons with toggle state
6. **Hide model ID** — filter out from "Starting" message
7. **Single Done** — merge completion card with result

### Estimated scope: ~200 lines of CSS + ~100 lines of JS changes in the inline HTML

---

## Empty States

### Ritemark Agent
```
     💬
  Ask about your documents
  or edit selected text

  "Summarize this section"
  "Fix grammar in selection"
```

### Claude Code
```
     🤖
  Claude Code can read, write,
  and organize your files

  "Create a README from this project"
  "Reorganize my notes into folders"
```

---

## Edge Cases

| Case | Solution |
|------|----------|
| Long response (>400px) | Scroll within bubble, "Show more" link |
| Many tools (10+) | Collapsed: "Used 12 tools · 45s", scroll on expand |
| Error | Red card with retry button, replaces response area |
| Offline | Banner above input, disable send |
| No API key | Full-width setup card with "Configure API Key" button |

---

*Created: 2026-02-07*

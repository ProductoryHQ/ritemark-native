# Agent Library Sidebar — UI Specification

Extracted from the annotated mockup and `Next-gen — Agent Management view (Light).png`.

---

## 1. Layout (top to bottom)

### 1.1 Header

- **Title**: "AGENT LIBRARY" — uppercase, 11px, 600 weight, letter-spacing 0.05em
- **Stats line**: Below title. Format: `{N} agents · {N} skills · {N} commands` — 11px, muted color. Counts are totals across both scopes.

### 1.2 Search

- Single text input, full width with horizontal padding
- Magnifying glass icon (left-aligned or inline placeholder icon)
- Placeholder: `"Search"`
- Filters all visible items by name and path

### 1.3 Scope Tabs

Two tabs in a horizontal row:

| Tab | Label format | Example |
|-----|-------------|---------|
| Project | `Project {N}` | `Project 5` |
| User | `User {N}` | `User 27` |

- Active tab has a bottom border/underline indicator (accent color)
- Inactive tab is plain text, clickable
- Counts reflect total items (agents + skills + commands) within that scope
- Default active tab: **Project**

**Scope definitions:**
- **Project** = items discovered in `{workspace}/.claude/` (project-level)
- **User** = items discovered in `~/.claude/` (user-level, shared across projects)

### 1.4 Section Headers

Format: `SECTION_NAME` (uppercase) with count badge on the right.

Example: `AGENTS    5`

- Uppercase, 11px, 600 weight
- Count badge: pill shape, small (10px), VS Code badge colors
- Sections shown: **AGENTS**, **SKILLS** (and **COMMANDS** if any exist)
- Only sections with items in the active scope tab are rendered
- Not collapsible (no chevrons, no toggle)

### 1.5 List Items

Each item is a row with two lines:

```
Name                    [icon]
.claude/agents/file.md
```

**Line 1 — Name:**
- 13px, 500 weight
- Text: display name derived from filename or frontmatter `name` field
- Truncated with ellipsis if too long

**Line 1 — Right icon (conditional):**
- **Filled star** (&#9733;): shown if the file is `CLAUDE.md` (the main project agent config)
- **Warning triangle** (&#9888;): shown if frontmatter is missing or incomplete (no `description` field)
- Star takes priority over warning (main agent file doesn't show warning)

**Line 2 — Path:**
- 11px, muted/description color
- Relative path from workspace root, e.g. `.claude/agents/vscode-expert.md`
- Warning state: path text turns orange/warning color when frontmatter is missing

### 1.6 Item States

| State | Visual |
|-------|--------|
| Default | Transparent background, no left border |
| Hover | `--vscode-list-hoverBackground` |
| Selected | Accent-colored left border (2–3px), highlighted background (`--vscode-list-activeSelectionBackground`), foreground color change |

### 1.7 Empty State

When no items exist in the active scope:

- Centered text, muted color
- Title: "No agents or skills found"
- Subtitle: helpful hint about where to add files (`.claude/agents/` or `.claude/skills/`)
- No illustrations or CTAs

---

## 2. Behavior

### 2.1 Search

- Filters by name and path (case-insensitive substring match)
- Applied within the active scope tab
- Results update on every keystroke
- If no matches: show "No matches for '{query}'" centered message
- Search does NOT switch tabs — only filters within the active tab

### 2.2 Tab Switching

- Click tab → show items for that scope
- Search text is preserved across tab switches
- Selected item highlight is preserved if that item exists in the new tab

### 2.3 Item Click

- Click → file opens in the markdown editor (via `vscode.open`)
- Item gets selected state (left border + highlight)
- Only one item selected at a time
- Selection follows the open editor — if the user switches editor tabs, the sidebar selection should update to match (future: not required for Sprint 54 MVP)

### 2.4 Refresh

- Discovery re-runs when:
  - Sidebar first becomes visible
  - User triggers explicit refresh (if a refresh button is added)
  - Files change in `.claude/` directories (future: file watcher, not Sprint 54 MVP)

---

## 3. Data Model Changes Required

### 3.1 Scope Field

Each discovered item needs a `scope` field:

```typescript
scope: 'project' | 'user'
```

- `project`: discovered in `{workspace}/.claude/`
- `user`: discovered in `~/.claude/` (user home directory)

### 3.2 Frontmatter Validation

Each item needs a `hasFrontmatter` or `warnings` field:

```typescript
warnings: string[]  // e.g. ['missing-description', 'missing-frontmatter']
```

Items with warnings get the ⚠ icon and orange path text.

### 3.3 Main Agent Detection

```typescript
isMainAgent: boolean  // true for CLAUDE.md files
```

CLAUDE.md at project or user level gets the filled star icon.

---

## 4. Gap Analysis — Current vs. Spec

### Present in current implementation

| Feature | Status |
|---------|--------|
| Header with title "AGENT LIBRARY" | Done |
| Stats line with counts | Done |
| Search input | Done |
| Section headers with count badges | Done |
| Item click → open file | Done |
| Selected state with left border | Done |
| Empty state | Done |
| Hover state | Done |

### Missing from current implementation

| # | Gap | Severity | Notes |
|---|-----|----------|-------|
| G1 | **Project/User scope tabs** | High | Discovery only scans workspace `.claude/`, not `~/.claude/`. No tab UI. Need to extend `discoverAgents()` and `discoverCommands()` to scan both locations and tag each item with its scope. |
| G2 | **Relative path as secondary line** | High | Current shows description text + type tags. Mockup shows relative file path (e.g. `.claude/agents/vscode-expert.md`). Must replace description/tags with path. |
| G3 | **Warning icon for missing frontmatter** | Medium | No validation. Need to check if frontmatter exists and has a `description` field. Show ⚠ + orange path text when missing. |
| G4 | **Star icon for main agent (CLAUDE.md)** | Medium | No detection of CLAUDE.md as special. Need `isMainAgent` flag in discovery. |
| G5 | **Remove type tags** | Low | Current shows "agent"/"skill" badge tags. Mockup does not — the section header already conveys type. Remove tags. |
| G6 | **Remove description line** | Low | Current shows `item.description` as third line. Mockup does not show description in list. Remove it. |
| G7 | **Search placeholder text** | Low | Current: "Filter by name, scope, vendor...". Mockup: "Search". Change placeholder. |
| G8 | **Section headers not collapsible** | Low | Current has `cursor: pointer` and hover on section headers suggesting collapsibility, but no collapse logic. Mockup has no collapse. Remove pointer cursor. |
| G9 | **User-level discovery (`~/.claude/`)** | High | Discovery module only scans workspace path. Must add home directory scanning for the User tab. |

### Summary

- **3 high-severity gaps**: Scope tabs (G1), path display (G2), user-level discovery (G9)
- **2 medium gaps**: Warning icon (G3), star icon (G4)
- **4 low gaps**: Remove tags (G5), remove description (G6), placeholder (G7), section cursor (G8)

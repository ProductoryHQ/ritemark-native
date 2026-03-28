# UX Design: Curated Extensions Recommendations Panel

**Sprint:** 47 — Extension Recommendations
**Date:** 2026-03-28
**Status:** Phase 1 Research
**Author:** ux-expert

---

## User Story

As a non-technical writer using Ritemark, I want to discover tools that extend what I can do — writing helpers, agent integrations, design tools — so that I can expand Ritemark's capabilities without having to browse a confusing developer marketplace.

---

## Design Principles for This Panel

### 1. It Is a Curated App Store, Not a Package Manager

The VS Code Extensions panel is built for developers who know what they want. This panel is built for writers and product people who want to be shown what is good. Every decision flows from this: the language, the layout, the hierarchy.

### 2. Extensions Are "Tools", Not "Extensions"

The word "extension" is developer-speak. In copy, use "tools" where possible. The panel title is "Recommended Tools". Reserve "extension" only for technical contexts (e.g., status badges that mirror VS Code's own terminology in the API).

### 3. The Ritemark Team Curated This

This is not a search interface. It is an editorial recommendation list. The panel communicates editorial authority — similar to an App Store "Editors' Choice" or a curated Product Hunt collection. This is why hand-picking matters and why it must feel premium, not generic.

### 4. Install Should Be One Action

A non-technical user must never have to leave the panel, open a terminal, or configure anything to install a recommended tool. One button click. Done.

### 5. "Office for Agents" Framing

Extensions in this panel exist because they make Ritemark more powerful as a collaborative workspace between the user and AI agents. Where relevant, copy should reflect this: "Works with AI agents", "Extends your agent's capabilities", "Used by the Ritemark team".

---

## Layout: Two-Column Card Grid (Recommended)

A fixed two-column grid of cards. Each card is self-contained with icon, name, tagline, and an action button. Categories are shown as section headers that divide the grid vertically.

```
┌─────────────────────────────────────────────────────────┐
│  Recommended Tools                                       │
│  Hand-picked by the Ritemark team to extend your         │
│  workspace.                                              │
├─────────────────────────────────────────────────────────┤
│  [ All ]  [ Writing ]  [ Agents ]  [ Code ]  [ Design ] │
│  ───────────────────────────────────────────────────     │
│                                                          │
│  Writing                                                 │
│                                                          │
│  ┌───────────────────────┐  ┌───────────────────────┐   │
│  │ [icon]  Tool Name     │  │ [icon]  Tool Name     │   │
│  │         Publisher     │  │         Publisher     │   │
│  │                       │  │                       │   │
│  │  Short tagline here,  │  │  Short tagline here,  │   │
│  │  one or two lines.    │  │  one or two lines.    │   │
│  │                       │  │                       │   │
│  │  [Writing]            │  │  [Writing]            │   │
│  │                       │  │                       │   │
│  │  [ Install ]          │  │  ✓ Installed          │   │
│  │  View in Marketplace→ │  │  View in Marketplace→ │   │
│  └───────────────────────┘  └───────────────────────┘   │
│                                                          │
│  Agents                                                  │
│                                                          │
│  ┌───────────────────────┐  ┌───────────────────────┐   │
│  │ ...                   │  │ ...                   │   │
│  └───────────────────────┘  └───────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Why grid, not list:** A list layout looks too much like VS Code's Extensions panel. The grid signals curation, uses familiar app-store visual language, and scales naturally from 10 to 30+ items.

---

## Card Component Spec

```
┌───────────────────────────────────┐
│  [48×48 icon]  Tool Name          │  ← icon + name on same baseline
│                Publisher name     │  ← muted, smaller text
│                                   │
│  Short tagline (1–2 lines max).   │  ← description, also muted
│                                   │
│  [Category]                       │  ← pill badge
│                                   │
│  ┌─────────────────────────────┐  │
│  │          Install            │  │  ← primary action button
│  └─────────────────────────────┘  │
│                                   │
│  View in Marketplace →            │  ← secondary link, always visible
└───────────────────────────────────┘
```

### Sizing and Spacing

| Property | Value |
|----------|-------|
| Card padding | 16px all sides |
| Icon size | 48×48px, `rounded-lg` (8px radius) |
| Gap between icon and text block | 12px |
| Gap between description and action area | 12px |
| Card border-radius | 12px (matches `Dialog.tsx`) |
| Card border | 1px `var(--vscode-panel-border)` |
| Card background | `var(--vscode-editor-background)` |
| Card hover state | `var(--vscode-list-hoverBackground)` on the card container |
| Grid gap | 12px |
| Grid columns | `grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))` |

### Icon Treatment

Icons are fetched from the VS Code marketplace CDN. Display at 48×48px. If the icon fails to load, show a fallback: a `rounded-lg` square using `var(--vscode-badge-background)` as background with the first letter of the tool name as text in `var(--vscode-badge-foreground)`.

### Typography

| Element | Tailwind Classes |
|---------|-----------------|
| Tool name | `text-sm font-semibold text-[var(--vscode-foreground)]` |
| Publisher | `text-xs text-[var(--vscode-descriptionForeground)]` |
| Tagline | `text-xs text-[var(--vscode-descriptionForeground)]` (2-line clamp) |
| Category badge | `text-[11px] px-2 py-0.5 rounded-full bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]` |
| Marketplace link | `text-xs text-[var(--vscode-textLink-foreground)] hover:underline` + ExternalLink icon at 10px |

### Install Button — All States

| State | Visual | Copy |
|-------|--------|------|
| Not installed | Full-width primary button | "Install" |
| Installing | Button disabled with `Loader2` spinner | "Installing..." |
| Installed | No button; icon + text badge | "✓ Installed" |
| Reload required | Full-width secondary button | "Reload to Activate" |
| Failed | Button resets to "Install"; inline error below | "Installation failed — try again" |

No Uninstall button — this is a recommendation panel, not a package manager.

---

## Categories and Filter Tabs

| Category | What Goes Here |
|----------|---------------|
| Writing | Grammar, spelling, readability, dictionary, thesaurus, language tools |
| Agents | CLI integrations, MCP servers, agent-aware extensions |
| Code | Language support, syntax highlighting, linters |
| Design | Color pickers, image tools, diagram support, drawing |

### Tab Design

```
[ All ]  [ Writing ]  [ Agents ]  [ Code ]  [ Design ]
```

- Horizontally scrollable row of pill-style tabs
- Active tab: `bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] px-3 py-1 rounded-full text-xs font-medium`
- Inactive tab: `text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)] px-3 py-1 rounded-full text-xs font-medium`
- No item counts on tabs

---

## Panel Header

Same structure as `RitemarkSettings.tsx`:
- Title: `text-2xl font-bold text-[var(--vscode-foreground)] mb-2`
- Subtitle: `text-sm text-[var(--vscode-descriptionForeground)]`
- Outer wrapper: `max-w-2xl mx-auto p-8`
- Header bottom margin: `mb-6`

---

## Interaction Patterns

### Install Flow

1. User clicks "Install" on a card
2. Button becomes disabled with `Loader2` spinner, "Installing..."
3. Webview sends `{ type: 'extensions:install', extensionId: string }` to host
4. Host calls VS Code extension install API
5. On success: card transitions to Installed state — no toast, no modal
6. If reload required: card shows "Reload to Activate" secondary button
7. On failure: inline error text, button returns to "Install"

### Filter Tabs

Instant filter, no animation. "All" restores all cards.

### "View in Marketplace" Link

Always visible on every card. Opens marketplace URL in system browser via `vscode.env.openExternal`.

---

## State Diagrams

### Panel-Level States

```
Panel opened → Webview sends { type: 'ready' }
  ├── Host responds → Render grid with install states
  └── Timeout → Error state: "Could not load recommended tools." + [ Try Again ]
```

**Loading:** Centered `Loader2` spinner (same as Settings).

**Category empty:** "No tools in this category yet. The Ritemark team is working on recommendations."

**All installed banner:** "✓ You have everything installed. All recommended tools are active in your workspace." (above grid; cards still shown)

### Card Install State Machine

```
Not Installed → [click] → Installing → Success → Installed
                                     → Success (reload) → Reload Required → [click] → Window reloads
                                     → Failure → Not Installed (with error)
```

---

## Entry Points

### Primary: Settings Page Link (Sprint 47)

New section at bottom of `RitemarkSettings.tsx`:

```
┌──────────────────────────────────────────────────────┐
│  [Puzzle piece icon]  Recommended Tools              │
│  Extend Ritemark with tools hand-picked by our team. │
│                                    Browse Tools →    │
└──────────────────────────────────────────────────────┘
```

### Secondary: Command Palette

`ritemark.openExtensionRecommendations` → "Ritemark: Browse Recommended Tools"

### Tertiary: Welcome Page (Post-Sprint 47)

Future entry point if analytics show users aren't discovering the panel.

---

## Copy and Microcopy

### Panel-Level

| Element | Copy |
|---------|------|
| Page title | "Recommended Tools" |
| Page subtitle | "Hand-picked by the Ritemark team to extend your workspace." |
| Settings section title | "Recommended Tools" |
| Settings CTA | "Browse Tools →" |
| Command palette | "Ritemark: Browse Recommended Tools" |
| WebviewPanel tab title | "Recommended Tools" |

### Tagline Writing Guidelines

- Maximum two lines at card width
- Start with a verb: "Adds grammar checking to your documents."
- Avoid filler: "powerful", "amazing", "the best"
- Mention agent compatibility when relevant: "Works with Claude and Codex agents."
- Never say "This extension..." — describe the capability directly

### Language to Avoid

| Avoid | Use Instead |
|-------|-------------|
| "extension" (user-facing) | "tool" |
| "Package", "Plugin" | (never use) |
| "Install failed" | "Installation failed — try again" |
| "No description available" | (write a custom tagline for every item) |

---

## Accessibility Notes

### Keyboard Navigation

- All interactive elements reachable via Tab
- Tab order: filter tabs → card-by-card (Install button → Marketplace link)
- Filter tabs use `role="tablist"` with `aria-selected`
- Enter and Space activate focused element

### Screen Readers

- Category headings use `<h2>` for heading navigation
- Card action area uses `aria-live="polite"` for state changes
- Install button: `aria-label="Install [Tool Name]"`
- Marketplace link: `aria-label="View [Tool Name] in Marketplace"`
- Spinner: `aria-label="Installing"`, `aria-busy="true"`

### Color and Contrast

- All text uses VS Code CSS custom properties (auto-adapts to themes incl. high-contrast)
- Installed state: check icon AND text (not color alone)
- Error state: red color AND error string (not color alone)

### Motion

Only animation: `Loader2` spinner (`animate-spin`). No card entrance animations, no hover transitions beyond `transition-colors`.

---

## Responsive Behavior

| Panel width | Grid behavior |
|-------------|---------------|
| >= ~520px | Two columns (`auto-fill minmax`) |
| < ~520px | Single column (auto-fill collapses) |

Use CSS grid `repeat(auto-fill, minmax(240px, 1fr))` — not Tailwind `sm:` breakpoints (they reference viewport, not container).

---

## Message Protocol

Same pattern as Settings:

| Direction | Message |
|-----------|---------|
| Webview → Host | `{ type: 'ready' }` |
| Host → Webview | `{ type: 'extensionList', data: ExtensionEntry[] }` |
| Webview → Host | `{ type: 'extensions:install', extensionId: string }` |
| Host → Webview | `{ type: 'extensions:installResult', extensionId, success, requiresReload, error? }` |

---

## What This Panel Is Not

- Not a search interface (no search box)
- Not for installing arbitrary extensions by ID
- Not an uninstall surface
- Not a ratings/reviews surface
- Not a proactive notification system
- Not paginated (under 40 items, single scroll)

---

## Source References

- `extensions/ritemark/webview/src/components/settings/RitemarkSettings.tsx` — layout, spacing, typography
- `extensions/ritemark/webview/src/components/Dialog.tsx` — border-radius, shadow
- `extensions/ritemark/webview/src/components/ui/button.tsx` — shadcn/ui Button
- `extensions/ritemark/webview/src/components/ai-sidebar/EmptyState.tsx` — empty state pattern
- `extensions/ritemark/webview/tailwind.config.ts` — VS Code CSS variable tokens

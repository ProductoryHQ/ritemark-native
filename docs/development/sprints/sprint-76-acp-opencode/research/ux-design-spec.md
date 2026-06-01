# Sprint 76 UX Design Specification — BYOK Keys + OpenCode Model Selection

**Phase:** 0b — Design pass, pre-prototype
**Date:** 2026-06-01
**Author:** ux-expert agent (Phase 0b)
**Feeds:** HTML prototypes under `prototypes/`, reviewed by Jarmo before any implementation
**Addresses:** spec.md R3 (BYOK keys via Settings), R6 (model selection)

* * *

## Baseline observations (what the existing code tells us)

**Settings page pattern** (`RitemarkSettings.tsx`): Each credential/service lives in its own card (`p-5 rounded-lg bg-surface border border-hairline shadow-sm`). Header row has label on left, status badge on right. Below it: input row with show/hide toggle + Save + Test buttons. Footer has a "Used for:" footnote with a "Get API key" external link. This is the established pattern for OpenAI, Google AI, and Anthropic — it's familiar and should be extended, not replaced.

**AgentSelector pattern** (`AgentSelector.tsx`): A single `<Select>` wrapping Radix primitives. Groups are rendered as `<SelectGroup>` with a `<SelectLabel>` at `text-[10px]`, separated by `<SelectSeparator>`. Composite values use `prefix:modelId` strings. Below the trigger, Codex shows a two-button mode rail (Edit / Plan). The trigger itself shows "Agent · ModelLabel" at `text-xs h-7`.

**No-key / setup view patterns** (`NoApiKey.tsx`, `CodexSetupView.tsx`): Centered empty-state container, icon in rounded circle, short heading, short paragraph, primary action button, optional secondary link. CodexSetupView uses an inline card with icon + text + button — the more polished pattern of the two, and should be the reference for OpenCode's setup prompt.

**Design tokens in play:**
- `bg-surface`, `border-hairline`, `shadow-sm` — cards
- `text-ink-strong` / `text-ink-muted` / `text-ink-faint` — ink ladder
- `text-accent-deep`, `bg-accent-soft` — indigo accent
- `bg-ritemark-success-soft`, `text-ritemark-success` — success states
- `bg-ritemark-error-soft`, `text-ritemark-error` — error states
- `Icon` component for all iconography (Phosphor set, no emojis)
- `Button` with `size="lg"` variant for all action buttons
- Focus ring: `focus:ring-[4px] focus:ring-[var(--r-ring-color)]`

* * *

## ⚠️ REVISION 2026-06-01 — Holistic Settings redesign (supersedes Surface 1 below)

**Jarmo rejected the original Surface 1 design** ("go back to the drawing board"): it created a
second set of OpenAI/Anthropic key cards next to the existing ones, ballooning the page to ~9
credential cards. The revised design principle:

> **A key is a key.** One card per provider on the whole page. Every feature that needs that
> provider (AI Chat, Flows, Image Generation, Claude OAuth-alternative, OpenCode) consumes the
> same stored key. The "Used for:" line tells the user everything that key powers.

### The whole Settings page (real structure, with Sprint 76 changes marked)

| Section | Contents | Sprint 76 change |
| --- | --- | --- |
| Appearance | Theme preview cards | — |
| Agent Runtime | Runtime preference (bundled / system) | — |
| **API Keys** | Claude Account (OAuth) · ChatGPT Account (OAuth) · OpenAI API Key · Google AI API Key · Anthropic API Key | **"Used for:" lines gain OpenCode mentions** on OpenAI / Google AI / Anthropic cards; **one new card: OpenRouter API Key** *(optional)* after Anthropic |
| Agent Timeout | Timeout slider | — |
| Chat Appearance | Font/density settings | — |
| Updates | Update center | — |

### Card-level changes (the only changes on the page)

1. **OpenAI API Key** — "Used for:" becomes:
   `AI Chat, Flows (LLM), Image Generation (GPT Image 1.5), OpenCode (GPT models)`
2. **Google AI API Key** — "Used for:" becomes:
   `Gemini models in OpenCode and Flows`
   (the stale "Imagen 3 (coming soon)" in today's production copy is removed — no such feature;
   this cleanup ships regardless of flag state)
3. **Anthropic API Key** — "Used for:" becomes:
   `Claude in Ritemark (alternative to signing in with Claude.ai), OpenCode (Claude models)`
4. **NEW: OpenRouter API Key** *(optional)* — identical card anatomy to the existing key cards:
   - Placeholder: `sk-or-...`
   - "Used for:" `OpenCode — hundreds of models from multiple providers through a single key`
   - Get key link: `Get an OpenRouter key` → `https://openrouter.ai/keys`
   - Hidden entirely when `opencode-integration` flag is off
5. **No other card, section, heading, or copy changes anywhere on the page.**

### Why this is better

- Zero duplication: a user with an existing OpenAI key gets GPT models in OpenCode with **no
  additional setup**.
- The Settings page grows by exactly one card instead of a whole section.
- Model-picker filtering (Surface 2) keys off the same booleans the page already manages:
  Google AI key exists → Gemini models appear under OpenCode.
- Implementation shrinks: no new SecretStorage keys, no new section component — just "Used for:"
  copy updates, one new card, and the spawn-env injection reading existing storage.

### Prototype states (settings.html — whole page)

| ID | State to show |
| --- | --- |
| S1 | **Whole page**, default state: all 7 sections visible, OpenRouter card present (empty), updated "Used for:" lines highlighted with annotations |
| S2 | Whole page, Google AI key configured: shows the one-key-unlocks-OpenCode story |
| S3 | API Keys section close-up: all 6 cards (2 accounts + 4 keys) with updated copy |
| S4 | OpenRouter card configured state |
| S5 | Flag-off: page identical to today — no OpenRouter card, no OpenCode mentions in "Used for:" lines |

*(Original S1–S7 states below are superseded.)*

* * *

## Surface 1 (SUPERSEDED — kept for audit trail): Settings — "Your API Keys" section (BYOK)

### User story

As a writer who wants to use AI writing assistance with their own accounts, I want to enter my provider API keys in one place in Ritemark's Settings so that OpenCode can access Gemini, OpenAI, or Anthropic models without me configuring anything else.

### Section placement

The BYOK section lives inside the existing **"API Keys" section** (`<section className="mb-8">`), immediately after the existing "Anthropic API Key" card and before "Agent Timeout." It does NOT become a separate top-level section.

Rationale: The existing API Keys section already has three key cards (OpenAI, Google AI, Anthropic). The BYOK keys for OpenCode serve the same conceptual purpose — credentials for AI services — but scoped to a different runtime. Grouping them under one `<h2>API Keys</h2>` heading keeps the page short and avoids confusing users with two "keys" sections. A visual sub-heading ("Your Keys for OpenCode") creates internal hierarchy without a new `<section>`.

**When the `opencode-integration` feature flag is off:** the entire BYOK sub-section does not render. No placeholder, no hidden div. The existing OpenAI / Google / Anthropic cards are unaffected.

### Layout: per-provider cards, not a table

Each provider (Gemini, OpenAI, Anthropic, OpenRouter) gets its own card, matching the exact pattern already used for "OpenAI API Key" and "Google AI API Key." A table layout would be denser but breaks the established visual language and requires new components.

**Note on duplication with existing cards:** OpenAI and Anthropic keys already appear as standalone cards above (for the general AI Chat / Flows features). The BYOK variants for OpenCode are separate — stored under different SecretStorage keys, with different "Used for:" descriptions. This duplication is intentional (see Q-UX2).

### Section structure

```
─────────────────────────────────────────────────────
  [sub-section divider: mt-8 pt-8 border-t border-hairline]

  [Icon: key-return, 20px, text-ink-strong]
  "Your Keys for OpenCode"  [h3, text-lg font-semibold text-ink-strong]
  "OpenCode is a local AI assistant that uses your own provider accounts.
   Add a key for any provider you have, and those models will appear in
   the OpenCode section of the AI assistant."
  [p, text-sm text-ink-muted, mb-4]

  [card: Gemini]
  [card: OpenAI — OpenCode]
  [card: Anthropic — OpenCode]
  [card: OpenRouter]
─────────────────────────────────────────────────────
```

### Provider card anatomy (all 4 providers follow this template)

```
┌────────────────────────────────────────────────────────┐
│  [Provider name + optional (optional) label]  [status] │
│                                                         │
│  [password input with show/hide eye]  [Save]  [Test]   │
│                                                         │
│  [validation/test result banner — only when present]   │
│                                                         │
│  Used for: OpenCode — [Provider] models                 │
│  [Get API key ↗]                                        │
└────────────────────────────────────────────────────────┘
```

**State A — Nothing configured (empty):** No status badge. Placeholder in input. Save enabled on typing; Test disabled. "Used for:" footnote with external "Get API key" link. The empty card includes a short sentence explaining what the key unlocks (non-technical users will not know what "Gemini API" is by name).

**State B — Key saved (configured):** Status badge top-right: green dot + "Configured" (`flex items-center gap-1 text-xs text-ritemark-success`). Input shows masked value (**full mask**, not last-4 — last-4 can show stale digits after key rotation; the "Configured" badge is sufficient confirmation). Show/hide eye works. Test enabled.

**State C — Validation feedback:**
- Test in progress: spinner in Test button, disabled.
- Test result: banner below input row. Green (`bg-ritemark-success-soft text-ritemark-success`) + check icon for success; red (`bg-ritemark-error-soft text-ritemark-error`) + x icon for failure. Dismisses when user edits the field.
- Format check (client-side, before Save): known prefix per provider. Mismatch shows a light inline hint ("Gemini keys start with AIza — double-check your key."). A hint, not an error — does not block saving.

### Per-provider copy

| | Google Gemini | OpenAI (OpenCode) | Anthropic (OpenCode) | OpenRouter |
| --- | --- | --- | --- | --- |
| Label | Google Gemini API Key | OpenAI API Key *(sub-label: for OpenCode)* | Anthropic API Key *(sub-label: for OpenCode)* | OpenRouter API Key *(optional)* |
| Placeholder | `AIza...` | `sk-...` | `sk-ant-...` | `sk-or-...` |
| Format hint | Gemini keys start with "AIza" | OpenAI keys start with "sk-" | Anthropic keys start with "sk-ant-" | OpenRouter keys start with "sk-or-" |
| Used for | OpenCode — Gemini models (Gemini 3 Pro, Gemini 3 Flash, and others) | OpenCode — GPT models (GPT-5.2, GPT-4o, and others) | OpenCode — Claude models via direct API key | OpenCode — hundreds of models from multiple providers through a single key |
| Get key link | Get a Gemini key → aistudio.google.com/apikey | Get an OpenAI key → platform.openai.com/api-keys | Get an Anthropic key → console.anthropic.com/settings/keys | Get an OpenRouter key → openrouter.ai/keys |

### Component reuse (Settings surface)

All existing primitives. No new components required.

| Need | Reuse |
| --- | --- |
| Card container | `p-5 rounded-lg bg-surface border border-hairline shadow-sm` |
| Input with show/hide | existing password input + eye-toggle pattern (RitemarkSettings.tsx:773-784) |
| Save / Test buttons | `<Button size="lg">` / `<Button variant="secondary" size="lg">` |
| Status badge | `flex items-center gap-1 text-xs text-ritemark-success` + `Icon name="check" size={12}` |
| Success/error banner | existing conditional div pattern (RitemarkSettings.tsx:803-820) |
| External link | `<a>` with `Icon name="arrow-square-out" size={12}` |
| Format hint | `<p className="text-xs text-ink-muted mt-1">` |
| Section divider + sub-heading | `<div className="mt-8 pt-8 border-t border-hairline">` + `<h3>` |

### Edge cases (Settings surface)

- **Test fails (network):** "Could not verify key — check your internet connection and try again."
- **Wrong-shape key pasted:** hint fires; saving not blocked; server-side test catches bad keys.
- **Same OpenAI key in both general and BYOK sections:** fine — stored separately, no warning.
- **Flag toggled off at runtime:** section disappears; keys remain in SecretStorage; reappear if flag re-enables.
- **Key removal:** clear input + Save → badge disappears, Test disables.

* * *

## Surface 2: Agent Selector + Model Picker with OpenCode

> **Correction (2026-06-01, Jarmo's prototype review):** the original draft of this section placed
> the selector at the top of the sidebar with a downward-opening dropdown. **The real Ritemark UI
> places the agent·model trigger in the chat input footer at the BOTTOM of the panel** (next to the
> context chip and send button), and **the dropdown opens UPWARD**, overlaying the chat transcript.
> Group labels are sentence case ("Claude", "Codex"), and model rows are two-line (model name +
> description below), with the selected row showing an indigo-soft background and a checkmark on
> the right. The sections below and the prototypes have been corrected to match production.

### User story

As a writer who has set up at least one provider key, I want to pick "OpenCode" and then choose which AI model to use from a simple grouped list, so that switching from Gemini to GPT-5 is a single click without leaving the sidebar.

### Layout and trigger

The selector layout does not change structurally. The trigger lives in the **chat input footer**
(bottom-left of the input box, next to the "1 context" chip, paperclip, and send button) and reads
`OpenCode · Gemini 3 Pro`. Clicking it opens the dropdown **upward**, anchored just above the input
box and overlaying the chat transcript. The Codex mode rail (Edit / Plan) is **not** shown for
OpenCode (no plan/edit modes this sprint).

### Group structure inside the dropdown (opens upward)

OpenCode appended after Codex (see Q-UX3), as a third group with separator. Real production row
format: model name on the first line (15px, ink-strong), description on the second line (13px,
ink-muted). For OpenCode rows, **the description line carries the provider name**:

```
  ┌──────────────────────────────────────────────┐
  │ Claude                                        │   ← group label, sentence case, muted
  │   Opus 4.8 with 1M context                    │
  │   Most capable for complex work               │
  │   Sonnet 4.6                              ✓   │   ← selected: indigo-soft bg + check right
  │   Best for everyday tasks                     │
  │   …                                           │
  ├──────────────────────────────────────────────┤
  │ Codex                                         │
  │   GPT-5.5                                     │
  │   Frontier model for complex coding…          │
  │   …                                           │
  ├──────────────────────────────────────────────┤
  │ OpenCode                                      │   ← new group
  │   Gemini 3 Pro                                │
  │   Google                                      │
  │   Gemini 3 Flash                              │
  │   Google · faster                             │
  │   GPT-5.2                                     │
  │   OpenAI                                      │
  │   GPT-4o                                      │
  │   OpenAI · faster                             │
  │   Claude Sonnet 4.6                           │
  │   Anthropic                                   │
  └──────────────────────────────────────────────┘
        ▲ dropdown opens upward from the trigger below
  ┌──────────────────────────────────────────────┐
  │  [input box]                                  │
  │  OpenCode · Gemini 3 Pro ⌄   1 context   📎 ➤ │   ← trigger in input footer
  └──────────────────────────────────────────────┘
```

- **Group label:** `OpenCode` — sentence case, muted, same style as `Claude` and `Codex` labels.
- **Provider as description line:** model name primary, provider name (`Google`, `OpenAI`,
  `Anthropic`, `OpenRouter`) on the description line — same two-line row format as existing
  groups, so OpenCode rows look native. Not nested sub-group headers (Radix Select doesn't
  support them, and inline description is friendlier for non-technical users).
- **Composite value format:** `opencode:google/gemini-3-pro`, `opencode:openai/gpt-5.2`, etc.

### State A — Keys configured

OpenCode group renders with the filtered model list (only providers that have a configured key). If only Gemini is configured, only Gemini models appear — group label still shows. **No inline "add a key" CTA within the dropdown** (the dropdown is a picker, not a navigation surface).

### State B — No keys configured

**In-dropdown:** the `OPENCODE` group still appears (discoverability — if it vanished, users would never find it), showing a single non-selectable row:

```
  OPENCODE
  Add API keys to use OpenCode   [→ Open Settings]
```

- Primary text: `text-xs text-ink-muted`; link: `text-xs text-accent-deep cursor-pointer`
- Clicking the link closes the dropdown and navigates to Settings BYOK section

**In-sidebar (OpenCode selected + no keys):** inline card following `CodexSetupView` layout:

```
┌──────────────────────────────────────────────────────┐
│  [icon: plugs, 20px, text-accent]                    │
│  Set up your API keys                                 │
│  OpenCode uses your own provider accounts for         │
│  AI. Add at least one key (Gemini, OpenAI,            │
│  Anthropic, or OpenRouter) to get started.            │
│                                                       │
│  [primary button: Open Key Settings]                  │
└──────────────────────────────────────────────────────┘
```

- Container: `rounded-xl border border-[var(--r-hairline)] bg-[var(--vscode-editor-background)] p-4`
- Button fires `vscode.postMessage({ type: 'settings:openBYOK' })` to deep-link to the BYOK section

### State C — Mid-conversation model switch

The existing `pendingRuntime` pattern (AgentSelector.tsx:78-88) handles this: `setPendingRuntime({ runtimeId: 'opencode', modelId })`. Model change applies on the next prompt, not mid-stream. No toast/modal. Trigger label updates immediately.

### Trigger label

`OpenCode · [Model Label]`. If the selected model's provider key was removed: `OpenCode · Select a model…` in `text-ink-muted`.

### Component reuse (AgentSelector surface)

| Need | Reuse |
| --- | --- |
| Group wrapper | existing `<SelectGroup>` + group label (sentence case, matches "Claude"/"Codex" rendering) |
| Model row | existing two-line row (name + description); OpenCode rows put the provider name in the description line |
| Selected row | existing indigo-soft background + right-side checkmark |
| Zero-key row | non-interactive `<div>` inside the OpenCode group — muted text + accent "Open Settings" link |
| Sidebar zero-key card | follows `CodexSetupView` layout exactly |
| Trigger | existing input-footer trigger; extend `triggerLabel` logic with `opencode:` prefix branch |
| Dropdown placement | existing upward-opening behavior (no change — Radix `Select` already handles side/position) |
| `handleChange` | new `else if (value.startsWith('opencode:'))` branch mirroring the `codex:` branch |

### Edge cases (AgentSelector surface)

- **Provider key removed mid-session:** group shrinks; if selected model's provider gone → "Select a model…" trigger; user must re-pick before sending.
- **All keys removed after OpenCode selected:** zero-key sidebar card on next render.
- **OpenRouter:** curated list from `modelConfig.ts`, not live-fetched (keeps dropdown manageable).
- **Long model labels:** existing `shortenDescription` (4-word cap) + `max-w-[280px]` truncation.
- **Binary missing:** model picker renders normally; "runtime unavailable" error surfaces at session-start layer, not the picker.

* * *

## HTML Prototype States Required

Static HTML + Tailwind CDN, light mode only, hardcoded light-mode token values (`#4338CA` accent, `#FFFFFF` surface). Each state navigable for click-through review.

### Settings prototypes

| ID | State to show |
| --- | --- |
| S1 | BYOK sub-section visible; all 4 provider cards empty; no status badges |
| S2 | Gemini card configured (badge + masked input); other 3 empty |
| S3 | Gemini card: test success banner |
| S4 | Gemini card: test failure banner ("Invalid API key — check your key and try again.") |
| S5 | Gemini card: format hint visible; input has obviously wrong value ("my-key-here") |
| S6 | All 4 BYOK cards configured |
| S7 | Flag-off state: BYOK sub-section absent; only existing cards visible |

### AgentSelector prototypes

| ID | State to show |
| --- | --- |
| A1 | Dropdown open, keys configured: OpenCode group with 5 model rows + provider sub-text; Claude/Codex groups for context |
| A2 | Dropdown open, no keys: "Add API keys to use OpenCode [→ Open Settings]" row |
| A3 | Dropdown closed, OpenCode·Gemini 3 Pro selected; no mode rail |
| A4 | Full sidebar: OpenCode selected, no keys → zero-key inline card |
| A5 | Dropdown open, only Gemini key: 2 Gemini models only |
| A6 | Trigger stale state: "OpenCode · Select a model…" muted |

**Total: 13 prototype states across 2 surfaces.**

* * *

## Open Design Questions for Jarmo

| # | Question | Options |
| --- | --- | --- |
| Q-UX1 | Sub-section naming — "BYOK" is engineering jargon | "Your Keys for OpenCode" (designed) / "Provider API Keys" / "OpenCode API Keys" / "Bring Your Own Keys" |
| Q-UX2 | OpenAI + Anthropic key duplication: separate BYOK cards (designed) vs reuse the existing Chat/Flows keys for OpenCode too | Separate (clear intent, more fields) / Unified (fewer fields, shared key) |
| Q-UX3 | OpenCode group position in dropdown | After Codex (designed) / Before Codex (if OpenCode is the sprint's hero feature) |
| Q-UX4 | "Test" button on BYOK cards — consistent with existing cards but needs a validation endpoint per provider | Include (designed) / Omit for Sprint 76 (errors surface on first use) |
| Q-UX5 | OpenRouter scope | Curated 3-5 models in Sprint 76 (designed) / Defer OpenRouter entirely to follow-up |

* * *

## Relevant file paths

- `extensions/ritemark/webview/src/components/settings/RitemarkSettings.tsx` — Settings page to extend
- `extensions/ritemark/webview/src/components/ai-sidebar/AgentSelector.tsx` — Selector to extend
- `extensions/ritemark/webview/src/components/ai-sidebar/CodexSetupView.tsx` — zero-key card reference pattern
- `extensions/ritemark/webview/src/components/ai-sidebar/NoApiKey.tsx` — simpler zero-key reference
- `extensions/ritemark/webview/src/components/ui/input.tsx` — input primitive
- `.claude/skills/ritemark-design/SKILL.md` + `references/components.md` — design tokens
- `docs/development/sprints/sprint-76-acp-opencode/spec.md` — R3, R6

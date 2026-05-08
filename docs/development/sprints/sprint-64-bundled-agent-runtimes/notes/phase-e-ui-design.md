# Phase E — Runtime/Auth Status UI Design
# Sprint 64: Bundled Agent Runtimes

**Surface:** Settings page (ComponentCard for Codex and Claude) + AI sidebar `getCompatibilityNotice`
**Design system:** Ritemark Indigo-Editorial (`tokens.css`, `references/components.md`, `references/webview-ui.md`)
**Status:** Design-only. No code edits until Jarmo approves.

---

## 1. Status Matrix

Every combination of `runtime` × `auth` that the backend can produce, with the exact user-facing label, sub-label, and recommended primary action for the card.

| runtime | auth | Primary label | Sub-label | Primary action |
|---|---|---|---|---|
| `installed` | `ready` | **Ready** | "Bundled with app" or "System installation" (from source chip) | Check installation |
| `installed` | `sign_in_required` | **Sign in required** | "Runtime is installed — connect your account to continue" | Sign in button |
| `installed` | `unknown` | **Status unknown** | "Could not verify account connection" | Check installation |
| `installed` | `error` | **Account error** | "There was a problem verifying your account" | Check installation |
| `missing` | *(any)* | **Runtime missing** | "The agent runtime was not found" | Repair runtime |
| `architecture_mismatch` | *(any)* | **Architecture mismatch** | "The installed runtime does not match this Mac" | Repair runtime |
| `launch_failed` | *(any)* | **Launch failed** | "The runtime could not start — see diagnostics" | Repair runtime |

**Rule for auth when runtime is non-`installed`:** auth state is not shown. The primary problem is the runtime; surfacing auth on top of a broken runtime creates noise. Auth fields appear only when `runtime === 'installed'`.

**Status dot colors** (using `.ritemark-dot` pattern from `components.md`):

| Combination | Dot color token |
|---|---|
| `installed` + `ready` | `--ritemark-success` |
| `installed` + `sign_in_required` | `--ritemark-warning` |
| `installed` + `unknown` or `error` | `--ritemark-warning` |
| `missing` | `--ritemark-error` |
| `architecture_mismatch` | `--ritemark-error` |
| `launch_failed` | `--ritemark-error` |

---

## 2. Component Card Mock

The new `ComponentCard` replaces the current single-`status`-string + flat `details[]` model with four distinct zones: header row, status row, source chip, and action row. Diagnostics stay collapsible below.

```
┌─────────────────────────────────────────────────────────┐
│  [icon]  Claude                          [● dot]        │  ← header row
│─────────────────────────────────────────────────────────│  hairline divider (--r-hairline)
│  Ready                                                   │  ← primary label   (13px, ink-strong, 500)
│  Connected with Claude.ai                                │  ← sub-label       (12px, ink-muted)
│                                                         │
│  [chip: Bundled with app]  [chip: v1.7.3]               │  ← source + version row
│─────────────────────────────────────────────────────────│  hairline divider
│  [Check installation]  [Repair runtime]                  │  ← action row      (ghost buttons)
│                                                         │
│  ▸ Diagnostics                                          │  ← collapsible (hidden by default)
└─────────────────────────────────────────────────────────┘
```

### Zone-by-zone token spec

**Card container** — existing `rounded-lg bg-surface border border-hairline shadow-sm` stays. No change to outer shape.

**Header row** — `flex items-center justify-between gap-2 pb-3 border-b border-hairline`
- Left: `[icon 16px] [title: 13px, font-weight 500, ink-strong]`
- Right: status dot — `ritemark-dot` (8px circle) in success/warning/error color. Include `.is-pulse` on the dot only for `sign_in_required` (the gentle pulse draws attention without alarming).

**Primary label** — `mt-3 text-[13px] font-medium text-ink-strong leading-snug`
- Single short string from the Status Matrix column "Primary label" above.

**Sub-label** — `mt-0.5 text-[12px] text-ink-muted leading-normal`
- Single short string from the Status Matrix column "Sub-label" above.

**Source + version chip row** — `mt-3 flex items-center gap-2`
- Source chip: `ritemark-pill-soft` pattern (`px-2 py-0.5 rounded-[3px] text-[11px] font-medium bg-surface-soft text-ink-body`). Two possible labels:
  - "Bundled with app" — when `source === 'bundled'`
  - "System installation" — when `source === 'system'`
  - Omit chip entirely when `source === 'unknown'`
- Version chip: same `ritemark-pill-soft` style. Label: `"v1.7.3"` (version string when available). Omit when version is unavailable.

**Action row** — `mt-3 pt-3 border-t border-hairline flex flex-wrap gap-2`
- All action buttons use the **ghost button** pattern from `components.md` (`bg-transparent text-ink-body px-[10px] py-[6px] rounded-[4px] text-[13px]`, hover: `bg-surface-soft text-ink-strong`).
- Exception: the sign-in button when `auth === 'sign_in_required'` is the **primary CTA** (`bg-primary text-primary-foreground shadow-ritemark-accent active:scale-[0.98]`), because signing in is the single unblocking action.
- "Check for updates" does NOT appear per-card. It lives at the section header level (see Section 5).

**Diagnostics accordion** — `mt-3 details` element, identical to current implementation (`text-[12px] text-ink-muted`, summary uses `text-accent-deep hover:underline`). No change needed here.

### Layout note on 3-column grid

The existing `grid gap-3 md:grid-cols-3` keeps Voice Model, Claude, and Codex in a row. The new card is taller than the old one due to the source chip row and the hairline dividers. This is fine — CSS grid stretches all three to equal height automatically. No grid changes required.

---

## 3. Action Buttons — Three New Actions Per Card

| Action | Trigger condition | Button style | Placement |
|---|---|---|---|
| Check installation | Always visible | Ghost | Action row, leftmost |
| Repair runtime | Always visible | Ghost | Action row, second |
| Sign in | `auth === 'sign_in_required'` only | **Primary CTA** | Action row, replaces or leads the row |

The "Sign in" button replaces the ghost "Check installation" as the leftmost button when auth is required, pushing "Repair runtime" right. This ensures the single unblocking action gets the primary position and the indigo-shadow treatment.

**"Check for updates"** appears once, at the section-header level of "Component readiness", not per-card. See Section 5.

---

## 4. Microcopy Table

### Primary and sub-labels (verbatim strings)

| State | Primary label | Sub-label |
|---|---|---|
| `installed` + `ready` | Ready | — (sub-label omitted; let version chip carry the detail) |
| `installed` + `sign_in_required` | Sign in required | Runtime is installed — connect your account to continue |
| `installed` + `unknown` (auth) | Status unknown | Could not verify account connection |
| `installed` + `error` (auth) | Account error | There was a problem verifying your account |
| `missing` | Runtime missing | The agent runtime was not found |
| `architecture_mismatch` | Architecture mismatch | The installed runtime does not match this Mac |
| `launch_failed` | Launch failed | The runtime could not start — see diagnostics |

### Action button labels and tooltips

| Button | Label | Tooltip (on hover, 200ms delay) |
|---|---|---|
| Check installation | Check installation | Run a health check on this agent runtime |
| Repair runtime | Repair runtime | Re-download and reinstall the bundled runtime |
| Sign in (Claude) | Sign in with Claude.ai | Opens your browser to complete sign-in |
| Sign in (Codex) | Sign in with OpenAI | Opens your browser to complete sign-in |
| Refresh status | Refresh status | Check whether sign-in completed |

**Tone rules applied:**
- No abbreviations. "CLI", "binary", "runtime" — all replaced with plain language in sub-labels.
- No error codes or path strings visible in primary/sub-labels. Those go in diagnostics.
- "Repair" not "Reinstall" — repair is recovery language, not a ground-up reinstall.
- Source chip says "Bundled with app" not "bundled binary" or "managed by Ritemark".

### Source chip labels

| `source` value | Chip label |
|---|---|
| `bundled` | Bundled with app |
| `system` | System installation |
| `unknown` | *(chip omitted)* |

### Status dot aria-labels (for screen readers)

| Dot color | `aria-label` on the dot element |
|---|---|
| Success (green) | "Status: ready" |
| Warning (amber) | "Status: attention required" |
| Error (red) | "Status: error" |

---

## 5. "Check for updates" Placement

The sprint plan (Q4) specifies a single "Check for updates" button wired to the existing app-update flow — not a per-runtime update channel. Per-card placement would suggest each card has its own update channel, which is wrong.

**Recommendation:** Place "Check for updates" as a ghost button in the "Component readiness" section header row, right-aligned.

```
Component readiness                        [Check for updates ↗]
─────────────────────────────────────────────────────────────────
[ Voice model card ]  [ Claude card ]  [ Codex card ]
```

The `↗` is a Lucide `arrow-up-right` icon (14px). The button uses the ghost style and triggers `updates:check` — identical to the existing update-check action already wired in Settings. No new backend plumbing needed.

When `updateCenter.state === 'checking'`, the button shows a spinning Lucide `loader-2` icon and `aria-disabled="true"`.

---

## 6. Sidebar `getCompatibilityNotice` Decision

### Current behavior

`getCompatibilityNotice` fires for two cases:
1. `compatibility.state === 'untested'` — "Codex version not yet audited"
2. `compatibility.state === 'limited'` — "Codex session is running with limits"

Phase E removes the "audited Codex range" disclaimer (the `untested` branch). The question is whether to keep `limited` in place as-is or fold it into the new runtime/auth model.

### Recommendation: keep `limited` notice, remove `untested` branch, rename title

The `limited` case represents genuine capability gaps at runtime (missing `--approvals` support, missing `requestUserInput`, etc.). These gaps are session-level facts, not setup errors — they affect what the user can do right now in the conversation panel, not whether the runtime is healthy.

The Settings card communicates setup health. The sidebar notice communicates session capability. These are different audiences at different moments. Merging them would require the user to leave the conversation panel and navigate to Settings to understand why an approval dialog is missing.

**Changes to `getCompatibilityNotice`:**

1. Remove the `compatibility.state === 'untested'` branch entirely. After Phase E, bundled runtimes are version-pinned and tested before shipping; "untested" is no longer a valid runtime state for bundled runtimes. For system installs where `untested` could still occur, silence the notice — we no longer promise to audit arbitrary system versions.

2. Keep the `limited` branch. Rename the title from "Codex session is running with limits" to "Some agent features are unavailable" — same information, no jargon.

3. Keep the dismissal key logic unchanged.

**Result:** `getCompatibilityNotice` returns non-null only when `state === 'ready'` and `compatibility.state === 'limited'`. All other cases return null.

---

## 7. Full ASCII Card Mock (Ready + Bundled state)

```
┌─────────────────────────────────────────┐
│  [shield]  Claude                   ●   │  ● = green dot, aria-label "Status: ready"
│ ─────────────────────────────────────── │
│  Ready                                  │
│                                         │
│  [Bundled with app]  [v1.7.3]           │  soft pills, 11px, surface-soft bg
│ ─────────────────────────────────────── │
│  [Check installation]  [Repair runtime] │  ghost buttons, 13px
└─────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────┐
│  [robot]  Codex CLI                 ●   │  ● = amber dot (pulse), "Status: attention required"
│ ─────────────────────────────────────── │
│  Sign in required                       │
│  Runtime is installed — connect your    │
│  account to continue                    │
│                                         │
│  [Bundled with app]  [v0.1.16]          │
│ ─────────────────────────────────────── │
│  [Sign in with OpenAI]  [Repair runtime]│  Sign-in = primary CTA (indigo + shadow)
└─────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────┐
│  [robot]  Codex CLI                 ●   │  ● = red dot, "Status: error"
│ ─────────────────────────────────────── │
│  Architecture mismatch                  │
│  The installed runtime does not match   │
│  this Mac                               │
│                                         │
│  [Bundled with app]                     │  version chip omitted (can't get it)
│ ─────────────────────────────────────── │
│  [Check installation]  [Repair runtime] │  ghost buttons; Repair is the right path
│                                         │
│  ▸ Diagnostics                          │  collapsed by default
└─────────────────────────────────────────┘
```

---

## 8. Existing Component Patterns Referenced

| Pattern | File / token | How used |
|---|---|---|
| Card container | `components.md` § Card | Outer shell unchanged; new zones added inside |
| Ghost button | `components.md` § Ghost button | Check installation, Repair runtime |
| Primary CTA | `components.md` § Signature CTA | Sign in button only |
| Dot badge | `components.md` § Badge / pill `.ritemark-dot` | Header row status indicator |
| Soft pill | `components.md` § Badge / pill `.ritemark-pill-soft` | Source chip, version chip |
| `details` / `summary` | Existing in current `ComponentCard` children | Diagnostics accordion — no change |
| `--r-hairline` dividers | `tokens.css` role tokens | Header row bottom, action row top |
| `--ritemark-success/warning/error` | `tokens.css` semantic | Dot colors |
| `shadow-ritemark-accent` / `active:scale-[0.98]` | Already in Settings button classes | Sign-in primary CTA |

No new primitives introduced. No new CSS classes required — all patterns are covered by existing token + component vocabulary.

---

## 9. Open Questions for Jarmo

1. **Sign-in flow for Codex (OpenAI).** The current Codex card has no sign-in button — `auth` state was never surfaced there. Phase E adds `auth === 'sign_in_required'` for Codex. Does the backend already support a `codex:login` action, or does it need to be wired in Phase E? If not implemented, the button should be omitted and a diagnostics message substituted.

2. **"Refresh status" button after sign-in.** For Claude, there's currently a "Refresh Status" button shown while `auth-in-progress`. Should the same pattern apply to Codex after the sign-in browser flow opens? Recommendation: yes, for consistency — but confirm the Codex backend can detect auth completion.

3. **Voice model card.** The current Voice Model card has no auth dimension and no repair action. Should it receive the "Check installation" and "Repair runtime" buttons too, for consistency with the 3-card grid? Or keep it minimal since it's managed differently (download, not bundled binary)?

4. **"Bundled with app" chip on system installs.** If `source === 'system'` and the user has manually installed Codex themselves, the chip reads "System installation". Is this the right framing, or should it say "Managed by you"? "System installation" is more accurate technically but "Managed by you" is friendlier.

5. **Diagnostics section default state.** Currently `<details>` is always collapsed. For `launch_failed`, should diagnostics start expanded since the user needs the information immediately? Recommendation: yes, auto-expand when `runtime === 'launch_failed'`.

6. **"Check for updates" section-level placement.** Confirm the section header row is the right place, not a dedicated row above the 3-column grid. The section header approach saves vertical space but may be missed by users who don't look at section labels.

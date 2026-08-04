# Sprint 103 Design — Mode Control, Plan Review, Activity Truth

Design spec for the three Sprint 103 surfaces, in the **Indigo-Editorial** system (`.claude/skills/ritemark-design`). All values reference `tokens.css` tokens; chrome tone throughout (13px Sofia Sans, small radii, ink ladder, indigo as the only chromatic accent + semantic amber/red/green).

Current-state visual evidence: [research/screenshots/](./research/screenshots/) — `03` (plan card with broken markdown, unlabeled context), `05` (blocking plan card in Auto), `04` (result-text-as-plan banner, misleading totals).

---

## 1. Composer mode control (R8)

### What's wrong today

Three 10px-text peer buttons (`auto | ask | plan`) rank a mode choice as equal thirds, promise parity that doesn't exist (OpenCode), and mix two concepts (permission policy + collaboration style) into one strip. At 10px/capitalize they also read as debug chrome, not product.

### New control

Two elements in the composer footer, left-aligned after the model select:

```
[ Claude · Sonnet 5 ▾ ]  [ ⛨ Manual ▾ ]  [ ▤ Plan ]      … [ⓘ] [📎] [Send]
```

**Autonomy select** (shadcn `Select`, same visual family as the model select) — labels per decision D1 (2026-08-04): **Manual / Auto**:
- Trigger: ghost style, 13px `--r-ink-body`, 16px Lucide icon (`shield-check` for Manual, `zap` for Auto), chevron 12px `--r-ink-faint`.
- Two options with one-line descriptions (13px label + 11px `--r-ink-muted` description):
  - **Manual** — "Approves each file change and command with you."
  - **Auto** — "Makes changes without asking. You review the result."
- Active option: standard sidebar active treatment (accent-soft bg, 2px indigo left border).

**Plan chip** (toggle, label "Plan" — decision D2):
- Off: ghost chip, 1px `--r-hairline` border, 6px radius, 13px `--r-ink-muted`, icon `clipboard-list` 14px.
- On: `--r-accent-soft` bg, `--r-accent-deep` text, inset 1px `--r-accent-fainter` ring (same recipe as today's selected mode button — the one good part), icon turns accent.
- Tooltip off-state: "Ask for a reviewable plan before any changes."
- On-state helper: placeholder text of the composer switches to "Describe the task — Claude will plan first…" (placeholder is the cheapest honest signal).
- After plan APPROVAL the chip visibly deactivates (150ms ease-out from accent-soft to ghost) — the D2 auto-reset must be *seen*, not inferred. Cancel/discard leaves it on.

**Capability gating (R6):** with OpenCode active, the chip is not rendered (decision D3: hidden). Runtime switch animates the chip out/in; composer text always survives.

No three-button strip remains. Total footprint is ~the same width; density unchanged.

## 2. Plan review card (R2/R5 surface, shared Claude+Codex)

### What's wrong today

Screenshot `03`: plan markdown renders with hard line breaks mid-sentence (raw text, not prose), no visual separation of plan structure, buttons float unanchored below a scroll area, "Reject" is a bare negative with no feedback path visible, and the card gives no account of *why* it appeared.

### Anatomy

```
┌──────────────────────────────────────────────┐
│ ▤ PLAN — waiting for your review        ● │   ← header
│ Requested by you · Plan                      │   ← provenance line
├──────────────────────────────────────────────┤
│  (rendered markdown, prose styles)           │   ← body, max-height 45vh, scrolls
│  ## Changes                                  │
│  …                                           │
├──────────────────────────────────────────────┤
│ No files changed yet.                        │   ← enforcement line (verified claim)
│ [ ✓ Approve & continue ] [ Keep planning ] [ Cancel ] │  ← sticky footer
└──────────────────────────────────────────────┘
```

- **Card:** `--r-surface` bg, 1px `--r-hairline` border, 10px radius, no shadow (cards in the transcript are chrome, not CTAs).
- **Header:** 11px/600 letter-spaced eyebrow in `--r-accent-deep`, icon `clipboard-list`; right side a 8px pulsing dot in `--r-amber` (the thread-rail attention color — same semantic, same hue). Header bg `--r-accent-soft` at 40%.
- **Provenance line** (11px `--r-ink-muted`): "Requested by you · Plan" or **"Claude chose to plan first"** (R4 autonomous case). This one line is the difference between "the UI is broken" and "the agent made a judgment call and told me."
- **Body:** rendered via `RenderedMarkdown` with the editor's prose styles scaled to chrome (13px body, 14px/600 h2, `--r-ink-strong` headings, `--r-ink-body` text, code spans on `--r-surface-soft`). Never raw text with preserved hard wraps.
- **Enforcement line:** 11px `--r-ink-muted` with a `check-circle` 12px icon — "No files changed yet." Only rendered when the runtime contract actually enforced it (R2/R5); this line is a *verified claim*, not decoration.
- **Sticky footer** (card-internal, `--r-surface` with top hairline):
  - **Approve & continue** — signature primary CTA: `--r-accent` bg, white, 600, 10px radius, indigo shadow `--ritemark-shadow-indigo-sm`. This is the one shadowed element in the transcript — the brand moment lands on the decision that matters.
  - **Keep planning** — secondary (surface-soft bg, no shadow). Click swaps footer into a feedback row: 1-line input (6px radius, focus = 2px accent border + 4px 10% ring) + "Send feedback" primary-small + "Back".
  - **Cancel** — ghost, `--r-ink-muted`; hover surface-soft. Not red: cancelling a plan is routine, not destructive.
- **Resolved state (F12):** card collapses to a 32px summary row: `✓ Plan approved · 14:32` / `✕ Plan discarded` / `↻ Sent back with feedback`, 12px `--r-ink-muted`, left border 2px in `--r-green`/`--r-ink-faint`/`--r-accent` respectively. Click re-expands read-only. Same collapse pattern applies to answered question cards.
- **Codex step status (structuredPlanSteps):** when `turn/plan/updated` arrives during execution, the approved-plan banner (not the card) shows steps with 12px checkboxes: `✓` `--r-green` done, `●` accent in-progress, `○` `--r-ink-faint` pending.

## 3. Activity status line (R7)

One 24px status line directly under the last turn, replacing scattered "Done"/ticker signals as the single truth point. 12px Sofia Sans.

| State | Icon (14px Lucide) | Color | Copy pattern |
| --- | --- | --- | --- |
| running | `loader` spin 1.2s linear | `--r-accent` | "Working — Reading itinerary.md" (live activity) |
| plan-review | `clipboard-list` | `--r-amber` | "Waiting for your review" |
| waiting-input | `message-circle-question` | `--r-amber` | "Needs your answer" |
| waiting-approval | `shield` | `--r-amber` | "Waiting for approval" |
| done | `check` | `--r-ink-muted` | "Done in 1m 32s" (active time; tooltip: "+5m 4s waiting for you") |
| failed | `x-circle` | `--r-red` | "Failed — {first error line}" |
| cancelled | `circle-slash` | `--r-ink-faint` | "Stopped" |

Rules:
- Amber is exclusively "blocked on you" — identical semantic to the Sprint 99 thread-rail badge, so rail and chat never disagree (both derive from `deriveActivityState`).
- The done line is muted, not celebratory — a writing tool for adults, no confetti, no bold green.
- "Modified N files" appears beside done only with the workspace-filtered count; file list expands below (existing `FilesSummary`).
- Dark mode: same tokens (they invert per `tokens.css`); amber/red/green use the dark-calibrated semantic set; spinner accent switches to Indigo-400 automatically.

## 4. Copy vocabulary (en, one voice)

- Never "Done" while anything is pending — the three waiting states own that window.
- "Claude chose to plan first" / "Codex chose to plan first" — agent-initiated events are attributed, active voice, no apology.
- Session reset (R3): "New session — earlier conversation isn't carried over." 12px `--r-ink-faint` divider row.
- No exclamation points, no emoji (system rule).

## 5. Out of design scope

Thread rail visuals (Sprint 99, unchanged), composer queue UI (Sprint 104), Comments surfaces (Sprint 105). The mode control's *position* in the footer row does not change — only the control itself.

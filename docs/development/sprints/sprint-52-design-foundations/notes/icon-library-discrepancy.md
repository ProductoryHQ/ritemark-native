# Icon library discrepancy — design vs. docs

**Status:** Open question for Jarmo. Raised 2026-04-24 by dev review.

## The contradiction

Sprint-52 locked **Lucide** as the sole icon family. But the design source of truth (`docs-internal/design/ritemark-ui.pen`) is ~95% **Phosphor** (thin / weight 100).

### What the docs say

- `sprint-plan.md` line 28: *"Lucide is the default icon family (1px stroke, 14–18px sizes); Phosphor + Material Symbols usage is inventoried and documented with per-surface rationale"*
- `sprint-plan.md` line 54 — Icon family lockdown, **status DONE**: *"Lucide is sole family; no Phosphor/Material Symbols found"*
- `research/foundations-audit.md` line 38: *"Phosphor imports: 0 — No webview Phosphor dependency found"*
- `.claude/skills/ritemark-design/references/iconography.md` line 3: *"Ritemark uses Lucide icons, 1px stroke, inherited text color."*
- Same file line 12: *"No mixing. Don't introduce Phosphor, Heroicons, Tabler, or any other icon set."*

### What the `.pen` file actually contains

- ~230 `icon_font` nodes with `iconFontFamily: "phosphor"` (weight 100, very thin)
- Tokens frame (`bi8Au`) defines a `$icon-family` variable — set to Phosphor
- A dedicated "Icon Usage Guide (UI)" frame titled *"Icon System Spec (Phosphor)"*
- Lucide was down to ~25 stragglers across the `8LEia` VS Code-surface-states frame (explorer chevrons/files, tab icons, activity bar, one list-checks)

### What happened in this session

The dev asked *"we use Phosphor here in design?"* — I confirmed yes and then converted the 25 Lucide stragglers to Phosphor for consistency with the rest of the design. That cleanup made the design internally consistent, but **widened the gap between design and docs**. If the decision is to return to Lucide, that conversion needs to be reversed.

## Why this matters

The implementation (`extensions/ritemark/webview/**`) uses `lucide-react` with the 1px-stroke override in `index.css`. Shipping the current Phosphor-weight-100 design to code would require:

- New dependency: `@phosphor-icons/react` (sprint-52 audit recorded zero Phosphor imports)
- Removing the Lucide stroke-width override
- Renaming ~65 icon call sites (chevron-right → caret-right, search → magnifying-glass, bot → robot, workflow → flow-arrow, settings → gear, etc.)
- Rewriting `references/iconography.md` (currently forbids Phosphor)

None of this is in any sprint-52 deliverable. The icon-family decision appears to have drifted during design execution without any accompanying doc update or sprint-plan amendment.

## Open questions for Jarmo

1. **Which is the source of truth — the design or the docs?**
   - If design → sprint-52 docs need updates (plan, audit, iconography.md, audit-current.md) and a new sprint task to migrate `lucide-react` → `@phosphor-icons/react` in the webview.
   - If docs → the `.pen` file needs a re-conversion back to Lucide (including undoing today's straggler cleanup).
2. **If Phosphor is the intended direction:** weight 100 is very thin. Is that the final pick, or should we align with Lucide's former 1px-stroke posture using Phosphor "Light" (weight 300)?
3. **Was this decided in a conversation that never made it into the sprint doc?** Worth grep'ing chat/transcripts before rewriting either side — we might be rediscovering a decision that exists only verbally.

## Recommended next step

Don't touch either side further until Jarmo rules. Once the direction is confirmed, file a sprint-52 addendum (or open sprint-53 scope) explicitly recording the icon-family decision and the migration path.

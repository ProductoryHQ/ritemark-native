# Sprint 112 Composer Thinking Effort — UX Contract

## Design Intent

Effort is a compact next-turn control, not a settings panel or AI spectacle. It lives in the existing Composer footer and uses Ritemark’s calm Indigo-Editorial chrome. The screenshots supplied for planning establish the interaction category—model-adjacent trigger plus anchored discrete control—but Ritemark owns the words, tokens, accessibility, and responsive behavior.

## Composer Placement

```text
┌──────────────────────────────────────────────────────────────┐
│ Type / for commands                                          │
├──────────────────────────────────────────────────────────────┤
│ Claude · Opus 5   Auto   Effort · Extra            [Send]    │
└──────────────────────────────────────────────────────────────┘
```

Footer order:
1. runtime/model selector;
2. Manual/Auto/Plan control;
3. **Effort · value** trigger;
4. existing context/actions and Send according to current layout.

The trigger is a compact ghost control: 11–12px Sofia Sans, ink-muted at rest, ink-strong on hover, surface-soft hover, 6px radius, standard focus ring. Use text without a decorative icon; the label already explains the action.

## Popover

```text
┌────────────────────────────────────────┐
│ Thinking effort                  Extra │
│                                        │
│ ( ) Auto   Let the model decide        │
│                                        │
│ Manual                                 │
│ Faster                   More thorough │
│   ○──────○──────○──────●──────○        │
│  Low   Medium  High   Extra   Max      │
│                                        │
│ Higher effort can take longer and use  │
│ more provider quota.                   │
└────────────────────────────────────────┘
```

- Width: 280–320px where space permits; never wider than the sidebar minus 16px.
- Surface: `--r-surface`; hairline border; 10px radius; Ritemark medium/large shadow.
- Header: 13px/500 **Thinking effort** and current value in ink-strong.
- Auto is a normal radio option, separate from the ordered manual scale because it is not a point between Faster and More thorough.
- Manual scale renders only provider-supported levels. Do not leave unexplained disabled dots in the track.
- Selected manual stop uses indigo plus a textual selected state; other stops use the ink/hairline ladder.
- Help copy is 11–12px ink-muted. No “smarter,” cost promise, token count, sparkles, lightning bolt, gradient, or vendor color.

## States

### Auto

Trigger: **Effort · Auto**. No provider override is sent.

### Explicit level

Trigger uses the label: Low, Medium, High, Extra, or Max. The choice is for the next accepted/queued turn.

### Running

The control remains editable. A short accessible description says changes apply to the next message; it never implies the running turn changes.

### Unsupported model

Keep sending available. If the runtime supports effort generally but the model does not, show a disabled **Effort · Auto** trigger with tooltip/helper:

> This model chooses its own thinking effort.

### Invalidated choice after model switch

Reset that runtime’s draft to Auto and announce through a polite live region/toast:

> Extra isn’t available for this model. Using Auto.

### Provider downgrade

Use a non-blocking inline notice near the turn result:

> Effort adjusted to High for this model.

### OpenCode capability unknown

Do not launch a session to fill the popover. Before ACP advertises `thought_level`, omit or disable the control with honest explanatory text. After live evidence exists, show only the advertised choices.

## Keyboard Contract

- Tab focuses the trigger.
- Enter/Space opens the popover and focuses the selected radio choice.
- Up/Down or Left/Right moves among available manual levels; Auto remains directly focusable.
- Enter/Space selects.
- Escape closes without change and restores trigger focus.
- Focus cannot escape behind the popover while using arrow-key interaction.

## Responsive Contract

- At normal width, keep model, mode, and effort on one footer row.
- At narrow width or 200% zoom, controls wrap as units; no label truncates to an ambiguous value and Send remains visible.
- The popover flips above/below and aligns within viewport bounds through the existing popover primitive.
- Touch/click targets remain at least 24px high in the dense Composer footer; the radio rows/track targets are larger inside the popover.

## Phase 0 Design Gate

- [ ] Jarmo approves the footer order and **Effort · value** trigger.
- [ ] Jarmo approves Auto as a separate choice above the manual scale.
- [ ] Jarmo approves Faster→More thorough and rejects “Smarter.”
- [ ] Jarmo approves Auto/Low/Medium/High/Extra/Max labels with capability-filtered visibility.
- [ ] Jarmo approves narrow-width wrapping and the unsupported/downgrade copy.

No implementation starts before this gate and the runtime capability audit are approved.

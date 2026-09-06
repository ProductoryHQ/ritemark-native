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

The trigger is a compact ghost control: 11–12px Sofia Sans, ink-muted at rest, ink-strong on hover, surface-soft hover, 6px radius, standard focus ring. Use **Effort** while the effort value is Auto, avoiding a visually duplicated Auto beside the separate Agent behavior selector; use **Effort · value** for a manual level. Use text without a decorative icon.

## Popover

```text
┌────────────────────────────────────────┐
│ Thinking effort                  Extra │
│                                        │
│ Faster                   More thorough │
│   ●━━━━━━●━━━━━━◉━━━━━━○━━━━━━○        │
│                                        │
│ [x] Auto                               │
└────────────────────────────────────────┘
```

- Width: 280–320px where space permits; never wider than the sidebar minus 16px.
- Surface: `--r-surface`; hairline border; 10px radius; Ritemark medium/large shadow.
- Header: 13px/500 **Thinking effort** and current value in ink-strong.
- Auto is a compact checkbox below the ordered manual scale because it enables or disables manual override; checking it restores runtime/model default behavior.
- Manual scale renders only provider-supported levels. Do not leave unexplained disabled dots in the track.
- The scale is a native draggable range input styled as one compact pill track: indigo fill up to a large white thumb, neutral remainder, and small internal stops. Dragging, clicking the track, and keyboard arrows snap to the capability-filtered levels; it must not be a row of buttons merely styled like a slider.
- Scale stops carry no persistent text labels. The current value is shown once in the header and every stop retains an accessible name plus a hover tooltip.
- Auto leaves the last manual thumb visible at reduced emphasis so the control does not collapse visually; selecting any stop turns Auto off. No “smarter,” cost promise, token count, sparkles, lightning bolt, decorative gradient, or vendor color.

## States

### Auto

Trigger: **Effort**. The adjacent Agent behavior selector may independently say Auto; the effort popover/header and checked checkbox communicate effort Auto. No user-selected provider override is active.

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
- Enter/Space opens the popover and focuses the selected manual stop or the Auto checkbox.
- Up/Down or Left/Right moves among available manual levels; Auto remains directly focusable as a checkbox below the scale.
- Enter/Space selects.
- Escape closes without change and restores trigger focus.
- Focus cannot escape behind the popover while using arrow-key interaction.

## Responsive Contract

- At normal width, keep model, mode, and effort on one footer row.
- At narrow width or 200% zoom, controls wrap as units; no label truncates to an ambiguous value and Send remains visible.
- The popover flips above/below and aligns within viewport bounds through the existing popover primitive.
- Touch/click targets remain at least 24px high in the dense Composer footer; the radio rows/track targets are larger inside the popover.

## Phase 0 Design Gate

- [x] Jarmo approves the footer order and compact **Effort** / **Effort · value** trigger (2026-08-24).
- [x] Jarmo approves Auto as a checkbox below the manual scale (2026-08-24).
- [x] Jarmo approves Faster→More thorough and rejects “Smarter” (2026-08-24).
- [x] Jarmo approves Auto/Low/Medium/High/Extra/Max/Ultra labels with capability-filtered visibility (2026-08-24).
- [x] Jarmo approves narrow-width wrapping and the unsupported/downgrade copy (2026-08-24).

No implementation starts before this gate and the runtime capability audit are approved.

# Sprint 115 Design Contract — Synchronization and Conflict UX

## Intent

Synchronization chrome should be quiet when the document is healthy and precise when user action is required. The current always-present indigo refresh action trains users to ignore it; Sprint 115 replaces that imperative signal with state-derived behavior.

This is an in-app chrome surface and follows the Indigo-Editorial design system: compact Sofia Sans UI, existing role tokens, Phosphor regular icons, one accessible focus pattern, no decorative animation, no emoji, and no success toast after ordinary convergence.

**Requirements covered:** R3 focused application feedback; R4 explicit conflict resolution; R5 truthful affordance; R8 accessibility and evidence.

## State Presentation

| Derived state | Header treatment | Interaction |
|---|---|---|
| Synced | No sync icon or label | None |
| Local edits only; autosave pending | No external-change icon or label | Existing dirty/save behavior only |
| Clean external update applying within normal latency | No persistent action; content update is the feedback | None |
| External update still unacknowledged after the bounded retry threshold | `arrows-clockwise`, label/tooltip **Retry document update** | Retry the same revision; keep visible until ACK |
| True local/disk conflict | `warning`, label/tooltip **Review changes** | Open the conflict dialog |
| Apply failed | `warning`, label/tooltip **Document update failed** | Open retry/review choices |

The icon is 16px Phosphor regular through `components/ui/Icon.tsx`. Color alone never distinguishes a state. The button uses the existing dense ghost-button shape and shared focus ring; it is not a filled indigo CTA.

## Conflict Dialog

**Title:** This document changed in two places

**Body:** Your edits and the version on disk both changed. Review them before choosing which version to keep.

Initial actions:

- **Compare changes** — safe primary action; opens labeled, read-only local and disk snapshots.
- **Cancel** — returns to the editor and leaves the conflict unresolved.
- **Keep my version…** — explicit resolution with a confirmation that the current disk version will be replaced.
- **Use disk version…** — explicit resolution with a confirmation that unsaved local edits will be discarded.

Neither destructive resolution is the default focused action. If disk changes again before confirmation, the dialog returns to the updated conflict rather than claiming success.

The dialog uses the existing Ritemark dialog primitive: 480px default maximum width, 10px radius, `--r-surface`, `--r-ink-*`, hairline divisions, Deep Space-tinted backdrop, and the standard 4px low-alpha indigo focus ring. Resolution controls remain usable at 200% zoom without horizontal scrolling.

## Compare View

Use VS Code's diff editor with immutable virtual documents rather than building a second diff algorithm in the webview.

- Left label: `On disk — revision <n>`
- Right label: `Your edits — based on revision <n>`
- Opening and closing compare changes no document state.
- Returning to Ritemark preserves the conflict indicator and dialog state.
- Snapshot titles use the filename and revision; document contents are never included in analytics or logs.

## Focus and Selection

A clean external update may arrive while the editor is focused. Ritemark keeps focus in the document, restores the previous selection when valid, clamps it when necessary, and retains the nearest practical scroll position. It does not skip the update solely to protect the caret.

If selection restoration cannot be proven safe for a structural change, the content update wins and the caret moves to a deterministic safe position; the system still acknowledges only the applied revision.

## Accessibility Acceptance

- Icon-only buttons have state-specific `aria-label` and matching tooltip text.
- Conflict/error meaning is expressed in copy and icon shape, not only color.
- Dialog focus is trapped; Escape cancels without resolution; focus returns to the header action.
- All actions are keyboard reachable and retain the shared focus ring in light, dark, and high-contrast contexts.
- Screen readers announce when a true conflict begins and when it resolves; ordinary successful sync is silent.
- No timer steals focus, opens a dialog, or resolves a version automatically.

## Evidence Required at Sprint Close

- Synced, retry, conflict, and apply-failure states in light and dark modes.
- Keyboard focus and screen-reader labels for the header action and dialog.
- 200% zoom layout.
- Focused external update with before/after selection evidence.
- A local-only typing/autosave recording proving the header action stays hidden.

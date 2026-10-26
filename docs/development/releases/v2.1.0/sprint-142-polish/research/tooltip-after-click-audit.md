# A4: The tooltip that stays after a click (R9; #505)

Run on 26 October 2026 on a dev build of `main` at `84ea15db` (hidden instance, CDP 9242, throwaway profile).

## The cause, in the code

`CardPage.tsx`'s `useKeepFocus()` (Sprint 136, W16, for the Windows keyboard test) watches the page. When a strip or block button that had the focus is removed (Give to … becoming Stop, Mark done becoming Reopen), it calls `.focus()` on the control that took its place (`FOCUS_FALLBACKS`). That is right for the keyboard.

For a mouse click it also gives Stop the focus. Radix Tooltip (`ui/tooltip.tsx`) opens on its trigger's focus unless a pointer press is in progress, and a tooltip opened by focus closes only on blur. So the tooltip "Stop the agent. You can give the task again" opens when Stop is focused and stays for the turn, wherever the pointer goes.

## Shown on screen

The real Give to would start a ChatGPT turn, so a probe stood in for it on Home:
- the probe is a plain button that, when clicked, removes itself and, a frame later, focuses "Change image", as `useKeepFocus` does;
- it was clicked with a real CDP mouse press, then the pointer was parked on the cover, away from "Change image".

Result:
- `focus-visible=false`: Chromium knows this focus came after a mouse click;
- the open tooltips read "Choose a picture for this project's cover": the tooltip opened on that focus and stayed with the pointer elsewhere.

Screenshot: `a4-tooltip-after-scripted-focus.png`.

## The buttons that replace themselves

- Give to → Sending… → Stop (the card's page; `useKeepFocus`);
- Mark done → Reopen (the card's page; `useKeepFocus`);
- the composer's Send → Stop;
- dictation's Start → Stop;
- Home's ready request → busy (the sample);
- Review with → reviewing.

All of them wrap their buttons in `ui/tooltip.tsx`, so one rule there covers them.

## Decision

In `ui/tooltip.tsx`, the trigger's `onFocus` calls `preventDefault()` when the focused element isn't `:focus-visible`. Radix composes its own handler after ours and skips a prevented event.
- A focus that follows a mouse or touch press opens nothing.
- Keyboard focus is `:focus-visible` (and a script focus after a keyboard step is too), so it still opens the tooltip. That keeps W16's keyboard behaviour.
- Hover opens and closes tooltips as before.

`useKeepFocus` stays as it is.

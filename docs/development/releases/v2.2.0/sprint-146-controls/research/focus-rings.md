# A2: every focus ring in the webview, and how the mode decides it (R3)

Read on 1 November 2026 from `sprint-146-controls-catalogue` (PR 1's head under it). Paths are under `extensions/ritemark/webview/`.

## The mechanism: one Tailwind variant

Tailwind is `^3.3.5` in `package.json`; the installed one is 3.4.19. A plugin's `addVariant('focus-visible', …)` replaces the core variant: the CSS it emits for the same classes, read with Tailwind's own PostCSS plugin on a two-class input:

| | `focus-visible:ring-[4px]` | `focus-visible:outline-none` |
|---|---|---|
| Core | `.focus-visible\:ring-\[4px\]:focus-visible` | `.focus-visible\:outline-none:focus-visible` |
| With the plugin | `:where(:root:not([data-input-mode="pointer"])) .focus-visible\:ring-\[4px\]:focus-visible` | `:where(:root:not([data-input-mode="pointer"])) .focus-visible\:outline-none:focus-visible` |

So every `focus-visible:` utility moves behind the mode in one place (`tailwind.config.ts`), and the fallback the plan held in reserve isn't needed. The prefix is "not pointer" rather than "keyboard", so a page whose tracker hasn't started yet draws its rings as before.

**The prefix sits in `:where()`, so it adds no specificity.** The first build put it bare, and the capture after the tracker caught it: the split button's keyboard focus lost its 1 px divider and gained the shared Button's 4 px ring, because the prefixed ring now outranked `.rm-split[data-tone] .rm-split-more`'s inset shadow and `.rm-split .rm-split-part { box-shadow: none }`. With `:where()` every rule keeps the rank it had, and keyboard focus draws as before.

One consequence: `focus-visible:outline-none` also applies only outside pointer mode. A control that relies on it alone (Tabs' triggers, `DialogButton`) would show Chromium's own outline after a script focus in pointer mode. One rule in `index.css` covers that: in pointer mode no element but a field draws an outline on `:focus-visible`.

## The rings, by kind

| Kind | Where | What happens |
|---|---|---|
| A non-field control's ring, Tailwind | 41 `focus-visible:` uses: `ui/button.tsx` (4 px), `switch.tsx` (3 px), `slider.tsx` (1 px), `tabs.tsx`, `filter-chip.tsx`, `dialog.tsx` (`DialogButton`), and screens' own buttons | Behind the mode, by the variant |
| A non-field control's ring, hand-written | `index.css`: `.rm-split .rm-split-part` (2 px outline), `.rm-check`, `.rm-marker`, `.thinking-effort-range`'s thumb, `.rm-flow-props button[role='combobox']`; `home/home.css`: `.rh-desk` buttons and links, `.rh-row`, `.rh-file`, `.rp-row`; `welcome/welcome.css`: `.rw-row`, `.rw-project`, `.rw-dbtn.default` | Behind the mode: each selector carries `:where(:root:not([data-input-mode="pointer"]))` |
| A non-field control's frame on any focus (`focus:`) | `ui/select.tsx`'s trigger (`focus:ring-1`); the composer's model and permission triggers (`ai-sidebar/ChatInput.tsx`, `focus:border-…`) | Moved to `focus-visible:`, so behind the mode |
| A field's focused look | `ui/input.tsx`, `ui/textarea.tsx` (`focus:ring-1`); the Flow panel's inputs and text areas (`.rm-flow-props input/textarea:focus-visible`); the card page's title and Done when (`tasks/tasks.css`, contenteditable); the composer; Settings' fields; the property rows; the schedule editor's time; Transcribe's search and language field; the bubble menu's link field | Unchanged: a field shows where the typing goes after a click too |
| A menu item's highlight | `focus:bg-…` on `DropdownMenuItem`, `ContextMenuItem`, `SelectItem` | Unchanged: it shows where the keyboard is inside an open menu, and the pointer moves it too |
| Chromium's own outline | Any focusable element with no ring of its own: `dialog.tsx`'s header close (Radix `DialogPrimitive.Close`) is the one the catalogue shows | Hidden in pointer mode by the `index.css` rule; in keyboard mode it stays, drawn in the system's accent colour (an image of it depends on the Mac's accent setting: noted in the baseline's README) |

## Local focus rules

| Rule | File | After the tracker |
|---|---|---|
| A tooltip opens on focus only for keyboard focus (Sprint 142 R9) | `ui/tooltip.tsx` | `focusOpensTooltip` reads the mode first: in pointer mode no focus opens one; in keyboard mode, `:focus-visible` as before |
| A menu or Select gives the focus back to its trigger | `ui/dropdown-menu.tsx`, `ui/select.tsx` | Radix's own again (decision 1): the focus returns after every close and the mode decides the ring. PR 1's `close-focus.ts` grew into `ui/input-mode.ts` |
| Share's stand-in trigger | `header/ExportMenu.tsx` | Share gets the focus back after every close but a click outside (decision 1); its own input bookkeeping is gone |
| The AI sheet's link menu | `ai-sidebar/ChatLinkMenu.tsx` | Gives its link the focus back after every close, as on `main`; the mode decides the ring |
| The dialog focuses itself on open | `ui/dialog.tsx` | Unchanged: it chooses where the focus goes, not the ring |
| The card page keeps the focus on the control that replaced a button | `tasks/CardPage.tsx` | Unchanged, for the same reason |
| Two popovers used directly | `ai-sidebar/ThinkingEffortControl.tsx`, `transcribe/workbench/InsightsLanguageCombobox.tsx` | No change needed: their rings are `focus-visible:` or a field's |

## Where the mode is started

`main.tsx` (every page of the shared bundle) and `office/main.tsx` (the Word and PowerPoint previews), each once, beside the page's other watchers.

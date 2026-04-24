# Webview UI

Ritemark's webview runs inside VS Code. That means CSS variables come from *two* sources: VS Code's own `--vscode-*` vars (pushed in by the host), and Ritemark's `--ritemark-*` and `--r-*` tokens (defined in `tokens.css`). This file explains how to layer them so Ritemark stays visibly Ritemark.

## The layering rule

For every surface, ask: *do we own this, or does VS Code?*

- **Surfaces Ritemark owns** (dialogs, Library panel, settings content, new webview views) → use `--r-*` role tokens. Never fall back to `--vscode-*` for a Ritemark-owned surface — that produces the "VS Code feeling" Jarmo wants to move away from.
- **Surfaces VS Code owns** (scrollbars, native context menus, system dialogs, notifications rendered by VS Code itself) → use `--vscode-*` tokens. These are rendered by VS Code's own code, and we can't override them from the webview without patching VS Code core (see `vscode-core.md`).
- **Hybrid surfaces** (tab strip, titlebar, activity bar) → theme them via `themes/ritemark-light.json` + `themes/ritemark-dark.json` (VS Code core theming), *not* from the webview.

## How `index.css` should look

The current `extensions/ritemark/webview/src/index.css` chains `--ritemark-*` defaults directly to `--vscode-*` values. That's backwards for any surface we own. The target pattern:

```css
/* BEFORE — current */
:root {
  --background: var(--vscode-editor-background, #1e1e1e);
  --foreground: var(--vscode-foreground, #cccccc);
  --primary: var(--vscode-button-background, #4338ca);
  /* ... */
}

/* AFTER — Ritemark-first, VS Code as a fallback only where appropriate */
:root {
  /* Ritemark tokens come from tokens.css — import that first */

  /* Role tokens for surfaces we own — resolve to Ritemark raw tokens */
  --background: var(--r-surface);
  --foreground: var(--r-ink-strong);
  --primary: var(--r-accent);
  --primary-foreground: #FFFFFF;
  --muted: var(--r-surface-soft);
  --muted-foreground: var(--r-ink-muted);
  --border: var(--r-hairline);
  --input: var(--r-hairline-strong);
  --ring: var(--r-accent);

  /* Only these fall back to VS Code — surfaces we don't paint */
  --vscode-scrollbar: var(--vscode-scrollbarSlider-background);
  --vscode-native-bg: var(--vscode-editor-background);
}

.ritemark-dark,
[data-theme="dark"] {
  /* Role tokens flip automatically via tokens.css — nothing to do here. */
}
```

The `shadcn/ui` primitives in `webview/src/components/ui/*.tsx` will pick up the role tokens through their Tailwind config — no per-component change needed if the tokens are right.

## Dark-mode detection

VS Code exposes a data attribute at `document.body[data-vscode-theme-kind]` with values `vscode-light`, `vscode-dark`, or `vscode-high-contrast`. Bridge it to the Ritemark token system with a small effect in the webview root:

```tsx
// webview/src/main.tsx or App.tsx
useEffect(() => {
  const updateTheme = () => {
    const kind = document.body.dataset.vscodeThemeKind
    document.body.classList.toggle('ritemark-dark', kind === 'vscode-dark' || kind === 'vscode-high-contrast')
  }
  updateTheme()
  const observer = new MutationObserver(updateTheme)
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-vscode-theme-kind'] })
  return () => observer.disconnect()
}, [])
```

Once `.ritemark-dark` is on the body, `tokens.css` flips every `--r-*` token to the dark variant. shadcn components, custom CSS, inline `style={}` — all reshape automatically.

## shadcn/ui — rebase the primitives

`components/ui/*.tsx` are already Radix + Tailwind. The primitives are correct; the *tokens* behind them are the drift point. Walk through each and confirm:

### `button.tsx`

The `buttonVariants` `cva` currently uses generic `bg-primary text-primary-foreground` etc. With the corrected `index.css`, these resolve to Ritemark tokens automatically. **But**:

- Add `shadow-[var(--ritemark-shadow-indigo-sm)]` to the `default` variant's class list. The indigo drop-shadow on primary is part of the brand (see `components.md`). Without it, the button reads as default shadcn.
- Add `active:scale-[0.98]` — the press feedback is part of the signature.
- Remove `aria-invalid` ring overrides — let the single focus-ring pattern cover it.

### `dialog.tsx`

Already uses `rounded-xl` (→12px) and `shadow-[0_8px_32px_rgba(0,0,0,0.24)]`. Change:

- `rounded-xl` → `rounded-[10px]` (`--ritemark-radius-lg`).
- Shadow → `shadow-[var(--ritemark-shadow-lg)]`. The 24% alpha shadow is a shadcn default; Ritemark's is softer and tinted with Deep Space.
- Backdrop `bg-black/40` → `bg-[rgba(30,27,75,0.45)]` (Deep Space 45%) + `backdrop-blur-sm`. Deep Space tint, not neutral black.

### `input.tsx`

Rebase border width: shadcn default is 1px `border-input`. Keep 1px (Ritemark is deliberately thinner than 2px — see `components.md`). Focus should use the shared `.ritemark-focus-ring` utility.

### `select.tsx`, `switch.tsx`, etc.

Same pattern — leave the Radix primitives, override the Tailwind class strings to reach Ritemark tokens.

## Fonts

Sofia Sans is already loaded. For Space Grotesk on design-y surfaces (welcome screen, in-webview onboarding):

```css
/* webview/src/index.css — add under existing @font-face for Sofia Sans */
@font-face {
  font-family: 'Space Grotesk';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url('./assets/fonts/SpaceGrotesk-VariableFont_wght.woff2') format('woff2-variations');
}
```

Commit the font file to `webview/src/assets/fonts/`. Then in components that need it:

```tsx
<h1 className="font-[var(--ritemark-font-display)] text-[56px] font-bold tracking-tight">
  ...
</h1>
```

Never `font-sans` in-chrome for moment surfaces; use `var(--ritemark-font-display)` explicitly so intent is visible in the source.

## Paths and mount points — do not break

- The webview is a single React app mounted into VS Code's webview API.
- The token CSS must load **before** any component CSS. Import `tokens.css` at the top of `index.css` (or import it directly from `main.tsx` at module-init time), not lazily.
- When adding a new CSS file, put `@import url("./tokens.css")` at the top if it runs standalone (e.g., a dev-time preview). Never duplicate token values.

## Anti-patterns — catch these in review

| Anti-pattern | Why bad | Fix |
|---|---|---|
| `background: var(--vscode-editor-background)` on a new Ritemark dialog | Surface we own reads as VS Code | `background: var(--r-surface)` |
| `color: #64748b` hardcoded in a new component | Drift; breaks dark mode | `color: var(--r-ink-muted)` |
| `border: 2px solid var(--r-hairline)` on an input | Too heavy; shadcn default; breaks visual rhythm | `border: 1px solid var(--r-hairline-strong)` |
| `box-shadow: 0 4px 6px rgba(0,0,0,0.1)` on a primary button | Missed the indigo signature | `box-shadow: var(--ritemark-shadow-indigo-sm)` |
| `rounded-xl` on a dialog (12px) | Off-grid | `rounded-[10px]` or `rounded-[var(--ritemark-radius-lg)]` |
| `font-bold text-2xl` on a dialog title | 24px is moment-scale | `text-base font-semibold` (16px, 600) |
| Import from `lucide-react` with `strokeWidth={1.5}` | Overrides the 1px stroke default | Let the CSS rule do it: `<Settings className="lucide" />` |
| New emoji (✓, ★, →) in body copy | Ritemark is emoji-free | Lucide `Check`, `Star`, `ArrowRight` |

## Testing the visual diff

When you change token values or rebase a shadcn primitive, verify the change without a full VS Code boot:

1. Run the webview in isolation: `cd extensions/ritemark/webview && npm run dev` — opens a Vite dev server.
2. Open the dev server URL. The webview renders outside VS Code. VS Code tokens are unset, so you'll see the *Ritemark-only* fallback. This is the cleanest way to confirm we're not leaking VS Code defaults.
3. For dark mode: add `class="ritemark-dark"` to `<body>` in `extensions/ritemark/webview/index.html` temporarily.
4. Or open `.claude/skills/ritemark-design/preview/components.html` in a browser — the isolated component library with both modes.

If the webview looks the same in isolation as it does inside VS Code, the tokens are wired correctly. If it looks *different* inside VS Code (usually bluer or greyer), something is still leaking from `--vscode-*`.

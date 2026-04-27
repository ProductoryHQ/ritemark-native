# Toolbar Button — Developer Spec

Sprint 54 · Agent Library toolbar

---

## Implementation rule

**Do not create new components.** Extend the existing `Button` in `components/ui/button.tsx` by adding a `toolbar` variant to `buttonVariants`. The pattern here mirrors how `FilterChip` extends a plain `<button>` with cva — same approach, applied to the shared `Button`.

---

## Step 1 — Add the `toolbar` variant to `button.tsx`

In `buttonVariants` → `variants.variant`, add:

```ts
toolbar:
  "border border-hairline bg-surface text-ink-strong font-medium " +
  "hover:bg-surface-soft " +
  "data-[state=active]:text-[--r-accent] data-[state=active]:font-semibold " +
  "data-[state=inactive]:bg-surface-soft data-[state=inactive]:text-ink-muted " +
  "data-[state=inactive]:hover:bg-surface",
```

No new size is needed. Use the existing `size="sm"` (h-8, px-3, gap-1.5) for labeled buttons and `size="icon-sm"` (32×32px) for icon-only buttons — both match the design exactly.

---

## Anatomy

### Labeled button (ToolbarButton in design)

```
┌─────────────────────────────────┐
│  [PhosphorIcon 14px]  [label]  [▾ optional]│  h=32px
└─────────────────────────────────┘
```

```tsx
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/Icon"   // Phosphor thin wrapper

<Button variant="toolbar" size="sm">
  <Icon name="list" size={14} weight={100} />
  Contents
</Button>
```

### Icon-only button (ToolbarButtonIcon in design)

```tsx
<Button variant="toolbar" size="icon-sm" aria-label="Refresh">
  <Icon name="arrows-clockwise" size={14} weight={100} />
</Button>
```

---

## States

Set `data-state` on the `<Button>` to drive all visual state changes. The cva class handles the rest.

| `data-state` | Background | Icon color | Label color | Label weight | When to use |
|---|---|---|---|---|---|
| _(unset)_ | `--r-surface` | `--r-ink-muted` | `--r-ink-strong` | 500 | Default action button |
| `"active"` | `--r-surface` | `--r-accent` | `--r-ink-strong` | **600** | Selected item in a toggle cluster |
| `"inactive"` | `--r-surface-soft` | `--r-ink-muted` | `--r-ink-muted` | 500 | Unselected item when a sibling is active |

Icon color is NOT driven by the `data-state` CSS above — apply it in JSX via `className` on the icon:

```tsx
// Tailwind doesn't pierce into child SVG fills from data-state on the parent.
// Apply icon color explicitly based on the state prop.

type ToolbarState = "active" | "inactive" | undefined

function iconColor(state: ToolbarState) {
  if (state === "active") return "text-[--r-accent]"
  if (state === "inactive") return "text-ink-muted"
  return "text-ink-muted"  // default
}
```

### `aria-pressed` — required for toggle buttons

```tsx
<Button
  variant="toolbar"
  size="sm"
  data-state="active"
  aria-pressed={true}
>
  <Icon name="list" size={14} weight={100} className="text-[--r-accent]" />
  Contents
</Button>

<Button
  variant="toolbar"
  size="sm"
  data-state="inactive"
  aria-pressed={false}
>
  <Icon name="info" size={14} weight={100} className="text-ink-muted" />
  Properties
</Button>
```

### Secondary / subdued (non-toggle action in a soft context)

`data-state` unset, add `className="bg-surface-soft text-ink-body"`:

```tsx
<Button variant="toolbar" size="sm" className="bg-surface-soft">
  <Icon name="download" size={14} weight={100} className="text-ink-body" />
  <span className="text-ink-strong">Export</span>
</Button>
```

### With dropdown caret

Enable the trailing caret by adding a small `ChevronDown` icon at the end. Icon and label both use `text-ink-body`:

```tsx
<Button variant="toolbar" size="sm" className="text-ink-body">
  <Icon name="microphone-thin" size={14} weight={100} />
  ET
  <Icon name="caret-down" size={12} weight={100} />
</Button>
```

### Disabled

Use the native `disabled` prop — `buttonVariants` base already applies `disabled:pointer-events-none disabled:opacity-50`.

```tsx
<Button variant="toolbar" size="sm" disabled>
  ...
</Button>
```

---

## Dark variant

The design has separate dark-surface versions for AI sidebar contexts. Do **not** create a new component — wrap with a `data-theme="dark"` attribute on the container and add dark overrides to the `toolbar` variant:

```ts
// append to the toolbar variant string:
"dark:border-[--r-dark-hairline-strong] dark:bg-[--r-dark-surface] dark:text-[--r-dark-ink-strong] " +
"dark:hover:bg-[--r-dark-surface-soft] " +
"dark:data-[state=active]:text-[--r-dark-accent] " +
"dark:data-[state=inactive]:bg-[--r-dark-surface-soft] dark:data-[state=inactive]:text-[--r-dark-ink-muted]",
```

If the sidebar container already sets the Tailwind dark class, this is automatic.

---

## Composition patterns

### Toggle cluster

A plain flex row with `gap-1`. No wrapper component needed.

```tsx
const [view, setView] = useState<"contents" | "properties">("contents")

<div className="flex items-center gap-1">
  <Button
    variant="toolbar" size="sm"
    data-state={view === "contents" ? "active" : "inactive"}
    aria-pressed={view === "contents"}
    onClick={() => setView("contents")}
  >
    <Icon name="list" size={14} weight={100}
      className={view === "contents" ? "text-[--r-accent]" : "text-ink-muted"} />
    Contents
  </Button>

  <Button
    variant="toolbar" size="sm"
    data-state={view === "properties" ? "active" : "inactive"}
    aria-pressed={view === "properties"}
    onClick={() => setView("properties")}
  >
    <Icon name="info" size={14} weight={100}
      className={view === "properties" ? "text-[--r-accent]" : "text-ink-muted"} />
    Properties
  </Button>
</div>
```

### Split toolbar (left / right groups)

```tsx
<div className="flex w-full items-center justify-between">
  {/* left: toggle cluster */}
  <div className="flex items-center gap-1">
    ...
  </div>

  {/* right: contextual actions */}
  <div className="flex items-center gap-1">
    <Button variant="toolbar" size="sm" className="text-ink-body">
      <Icon name="microphone-thin" size={14} weight={100} />
      ET
      <Icon name="caret-down" size={12} weight={100} />
    </Button>
    <Button variant="toolbar" size="icon-sm" aria-label="Refresh">
      <Icon name="arrows-clockwise" size={14} weight={100} />
    </Button>
    <Button variant="toolbar" size="sm" className="bg-surface-soft">
      <Icon name="download" size={14} weight={100} className="text-ink-body" />
      <span className="text-ink-strong">Export</span>
    </Button>
  </div>
</div>
```

---

## Token reference

```css
/* Fills */
--r-surface:       #FFFFFF      /* bg-surface */
--r-surface-soft:  #F1F5F9      /* bg-surface-soft */

/* Ink */
--r-ink-strong:    #1E1B4B      /* text-ink-strong */
--r-ink-body:      #475569      /* text-ink-body */
--r-ink-muted:     #64748B      /* text-ink-muted */
--r-ink-disabled:  #CBD5E1      /* text-ink-disabled */

/* Accent */
--r-accent:        #4338CA      /* text-[--r-accent] */

/* Borders */
--r-hairline:      #E2E8F0      /* border-hairline */

/* Sizing (Tailwind equivalents) */
h-8   = 32px   /* --r-control-md */
px-3  = 12px   /* --r-space-3 */
gap-2 = 8px    /* --r-space-2, icon–label */
gap-1 = 4px    /* --r-space-1, cluster gap */
rounded-md = 8px  /* --r-radius-md */

/* Icon — Phosphor thin */
weight: 100, size: 14px (leading), 12px (trailing caret)
```

# Properties Panel — Developer Spec

Sprint 54 · Agent Library

---

## What this is

The Properties panel is a 220px right-side pane that renders editable fields for the selected agent or skill. It appears when the toolbar is set to the "Properties" view.

---

## Structure

```
┌─ properties (outer wrapper) ──────────────────┐
│ padding: 20px / 20px / 24px / 20px            │
│ border-right: 1px                              │
│                                               │
│  ┌─ agentPropertiesPanel (card) ────────────┐ │
│  │  border: 1px  radius: 12px  gap: 16px   │ │
│  │  bg: --r-surface   padding: 16px         │ │
│  │                                          │ │
│  │  [header]                                │ │
│  │  [nameField]                             │ │
│  │  [descField]                             │ │
│  │  [toolsField]                            │ │
│  │  [modelField]                            │ │
│  │  [actions]                               │ │
│  └──────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
```

**Outer wrapper Tailwind:**

```tsx
<div className="flex h-full w-[220px] flex-col gap-3 border-r border-hairline px-5 pb-6 pt-5">
```

**Inner card:**

```tsx
<div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface p-4">
```

---

## Field pattern

Every field is a label + control pair in a vertical flex column with `gap-1.5` (6px).

```tsx
<div className="flex flex-col gap-1.5">
  <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-ink-muted">
    NAME
  </span>
  {/* control */}
</div>
```

**Do not** use the `Label` component from `ui/label.tsx` — it defaults to `ink-strong` and the wrong size. Use a plain `<span>` with the classes above.

---

## Controls

### Text input — NAME field

Use the existing `Input` from `ui/input.tsx` but **override all classes** — the current `Input` uses VS Code theme variables (`--vscode-input-*`), not Ritemark tokens. Pass `className` to reset:

```tsx
import { Input } from "@/components/ui/input"

<Input
  value={agent.name}
  onChange={(e) => onChange("name", e.target.value)}
  className="h-10 rounded-lg border border-hairline-strong bg-surface-muted px-3
             text-[13px] font-medium text-ink-strong placeholder:text-ink-faint
             focus:outline-none focus:ring-1 focus:ring-[--r-accent]
             [all:revert] [all:unset] [display:block] [width:100%]"
/>
```

> **Simpler alternative:** since `Input` applies VS Code vars by default, just use a raw `<input>` with the classes. The `Input` component adds no meaningful behavior beyond VS Code styling.

```tsx
<input
  value={agent.name}
  onChange={(e) => onChange("name", e.target.value)}
  className="h-10 w-full rounded-lg border border-hairline-strong bg-surface-muted
             px-3 text-[13px] font-medium text-ink-strong placeholder:text-ink-faint
             outline-none focus:ring-1 focus:ring-[--r-accent]"
/>
```

**Sizing:**

| Property | Value |
|---|---|
| Height | 40px (`h-10`) |
| Padding horizontal | 12px (`px-3`) |
| Corner radius | 8px (`rounded-lg`) |
| Font | Sofia Sans 13px / 500 |
| Background | `--r-surface-muted` |
| Border | `--r-hairline-strong` 1px |

---

### Textarea — DESCRIPTION field

No `Textarea` component exists yet. **Add it** at `webview/src/components/ui/textarea.tsx`:

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    data-slot="textarea"
    className={cn(
      "w-full resize-none rounded-lg border border-hairline-strong bg-surface-muted",
      "px-3 py-3 text-[13px] leading-[1.45] text-ink-strong placeholder:text-ink-faint",
      "outline-none focus:ring-1 focus:ring-[--r-accent]",
      "disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    {...props}
  />
))
Textarea.displayName = "Textarea"

export { Textarea }
```

Usage:

```tsx
import { Textarea } from "@/components/ui/textarea"

<Textarea
  value={agent.description}
  onChange={(e) => onChange("description", e.target.value)}
  rows={4}
  placeholder="Describe what this agent does…"
/>
```

---

### Select dropdown — TOOLS and MODEL fields

Use the existing `Select` + `SelectTrigger` from `ui/select.tsx`. The current `SelectTrigger` is `h-8` (32px); override to `h-10` (40px) to match the design.

```tsx
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"

{/* MODEL field */}
<Select value={agent.model} onValueChange={(v) => onChange("model", v)}>
  <SelectTrigger className="h-10 rounded-lg text-[13px] font-medium">
    <SelectValue placeholder="Select model…" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="sonnet">sonnet</SelectItem>
    <SelectItem value="opus">opus</SelectItem>
    <SelectItem value="haiku">haiku</SelectItem>
  </SelectContent>
</Select>
```

**TOOLS field** is a multi-value select (comma-separated list in the design: `"Read, Bash, Glob, Grep"`). Radix `Select` is single-value only. Options:

- Use a `<Combobox>` / multi-select (add from shadcn if needed)
- Or render as a tokenized chip input
- For MVP: render as a plain text input listing the tools, same styling as the NAME input

---

### Actions row

Use `Button variant="toolbar"` (see `toolbar-spec.md`). Gap between buttons: `gap-2`.

```tsx
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/Icon"

<div className="flex items-center gap-2">
  <Button variant="toolbar" size="sm" className="text-ink-body">
    <Icon name="plus" size={14} weight={100} />
    Add
  </Button>
</div>
```

---

## Header

The panel header is a plain title. No interactive state.

```tsx
<div className="flex flex-col gap-1">
  <h2 className="text-[18px] font-semibold text-ink-strong [font-family:'Sofia_Sans']">
    Properties
  </h2>
</div>
```

---

## Complete JSX skeleton

```tsx
export function PropertiesPanel({ agent, onChange }: Props) {
  return (
    <div className="flex h-full w-[220px] flex-col gap-3 border-r border-hairline px-5 pb-6 pt-5">
      <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface p-4">

        {/* Header */}
        <h2 className="text-[18px] font-semibold text-ink-strong">Properties</h2>

        {/* NAME */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-ink-muted">Name</span>
          <input
            value={agent.name}
            onChange={(e) => onChange("name", e.target.value)}
            className="h-10 w-full rounded-lg border border-hairline-strong bg-surface-muted
                       px-3 text-[13px] font-medium text-ink-strong placeholder:text-ink-faint
                       outline-none focus:ring-1 focus:ring-[--r-accent]"
          />
        </div>

        {/* DESCRIPTION */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-ink-muted">Description</span>
          <Textarea
            value={agent.description}
            onChange={(e) => onChange("description", e.target.value)}
            rows={4}
          />
        </div>

        {/* TOOLS */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-ink-muted">Tools</span>
          {/* MVP: plain text input; upgrade to multi-select chip input later */}
          <input
            value={agent.tools.join(", ")}
            onChange={(e) => onChange("tools", e.target.value.split(",").map(s => s.trim()))}
            className="h-10 w-full rounded-lg border border-hairline-strong bg-surface-muted
                       px-3 text-[13px] font-medium text-ink-strong placeholder:text-ink-faint
                       outline-none focus:ring-1 focus:ring-[--r-accent]"
            placeholder="Read, Bash, Glob…"
          />
        </div>

        {/* MODEL */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-ink-muted">Model</span>
          <Select value={agent.model} onValueChange={(v) => onChange("model", v)}>
            <SelectTrigger className="h-10 rounded-lg text-[13px] font-medium">
              <SelectValue placeholder="Select model…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sonnet">sonnet</SelectItem>
              <SelectItem value="opus">opus</SelectItem>
              <SelectItem value="haiku">haiku</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-2">
          <Button variant="toolbar" size="sm" className="text-ink-body">
            <Icon name="plus" size={14} weight={100} />
            Add
          </Button>
        </div>

      </div>
    </div>
  )
}
```

---

## Token reference

| Token | Value | Tailwind class |
|---|---|---|
| `--r-surface` | #FFFFFF | `bg-surface` |
| `--r-surface-muted` | #F8FAFC | `bg-surface-muted` |
| `--r-hairline` | #E2E8F0 | `border-hairline` |
| `--r-hairline-strong` | #CBD5E1 | `border-hairline-strong` |
| `--r-ink-strong` | #1E1B4B | `text-ink-strong` |
| `--r-ink-muted` | #64748B | `text-ink-muted` |
| `--r-ink-faint` | #94A3B8 | `text-ink-faint` |
| `--r-accent` | #4338CA | `focus:ring-[--r-accent]` |

Panel width: **220px** (fixed)  
Outer padding: **20px** sides/top, **24px** bottom  
Card corner radius: **12px** (`rounded-xl`)  
Field corner radius: **8px** (`rounded-lg`)  
Gap between fields: **16px** (`gap-4`)  
Gap between label and control: **6px** (`gap-1.5`)

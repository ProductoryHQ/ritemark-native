import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
/**
 * RULE: an icon inside a button is ALWAYS the same colour as the button's text.
 *
 * `Icon` defaults to `tone="muted"`, which sets the svg's colour (index.css,
 * with no specificity; #614), so a white-on-indigo button would otherwise get
 * a grey glyph. `[&_svg]:text-current` and `[&_svg]:fill-current` below give
 * the glyph the button's text colour, which makes the rule hold for every
 * button in the app without any call site having to remember it.
 */
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 [&_svg]:fill-current [&_svg]:text-current outline-none focus-visible:border-ring focus-visible:ring-[4px] focus-visible:ring-[var(--r-ring-color)] active:scale-[0.98] aria-invalid:ring-[var(--r-error-soft)] aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-ritemark-accent hover:bg-primary-hover hover:shadow-ritemark-accent-md",
        destructive:
          "bg-destructive text-white hover:bg-destructive-hover focus-visible:ring-[var(--r-error-soft)]", // Sprint 146: the hover darkens, as the primary's does
        outline:
          "border border-hairline-strong bg-background shadow-xs hover:bg-surface-soft hover:text-ink-strong",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-hairline",
        ghost:
          "hover:bg-surface-soft hover:text-ink-strong",
        toolbar:
          "border border-transparent bg-transparent text-ink-strong font-medium " + // Ritemark 2.0: plain icon buttons, a fill on hover, never a box
          "hover:bg-surface-soft " +
          "data-[state=active]:bg-surface-soft data-[state=active]:text-ink-strong data-[state=active]:font-medium", // a toggle that is on: the ground's fill and ink (kit: .docbar .icon.on)
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        // `lg` matches the canonical Ritemark Settings/CTA pattern: rounded-lg
        // (8px) corners, larger 18px / 10px padding for touch comfort. Use this
        // size for prominent actions like Save / Sign Out / Refresh Status.
        lg: "h-auto rounded-lg px-[18px] py-[10px] has-[>svg]:px-[14px]",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * Sprint 146 (#566; the Experience lead, 31 October, §4): a button too narrow for its first word shows its icon
 * alone, never "A…". The words stay in the button, out of sight, as its accessible name, and its tooltip starts with
 * them (`wholeWordsTip`). The icon-only button keeps its fill or outline and its height, and is that height square
 * (32 for `sm`, as `icon-sm`; index.css `[data-icon-only]`). A button with only words keeps today's cut.
 *
 * Whether the first word is cut is measured with the label drawn, whatever the button shows now, so the answer
 * depends on the room alone: as the room changes the button switches once each way, with no ellipsis in between (R6).
 * When the words run past the label, the ellipsis takes its own room at the end of what shows, so the first word fits
 * only with the ellipsis after it (`ellipsis`, its width; 0 when the words fit).
 */
export function firstWordCut(label: { right: number }, firstWord: { right: number }, ellipsis = 0): boolean {
  return firstWord.right + ellipsis > label.right + 0.5
}

let measure: CanvasRenderingContext2D | null | undefined
/** The width of "…" in the label's own font. */
function ellipsisWidth(label: Element): number {
  if (measure === undefined) measure = document.createElement("canvas").getContext("2d")
  if (!measure) return 0
  const style = getComputedStyle(label)
  measure.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  return measure.measureText("…").width
}

/** The words split for the rule: the first word, then the rest with the space before it. */
export function splitFirstWord(words: string): [string, string] {
  const match = /^(\s*\S+)([\s\S]*)$/.exec(words)
  return match ? [match[1], match[2]] : [words, ""]
}

/** A tooltip that starts with a button's whole words (#565, #566), then says what it does. */
export function wholeWordsTip(words: string, tip: React.ReactNode): React.ReactNode {
  if (tip === words || tip === undefined || tip === null || tip === "") return words
  return (
    <>
      <span className="block font-semibold">{words}</span>
      <span className="block">{tip}</span>
    </>
  )
}

const LABEL = '[data-slot="button-label"]'
const FIRST_WORD = '[data-slot="first-word"]'
// Measured before the first paint in a page; a markup render (the tests) has no layout and runs no effect
const useBeforePaint = typeof document === "undefined" ? React.useEffect : React.useLayoutEffect

function useIconWhenNarrow(on: boolean, words: string) {
  const ref = React.useRef<HTMLButtonElement | null>(null)
  useBeforePaint(() => {
    const button = ref.current
    if (!on || !button || typeof ResizeObserver === "undefined") return
    let watchingButton = false
    const observer = new ResizeObserver(() => check())
    // The button is watched only while it shows its words, when its size is the room's. With its icon alone it is a
    // fixed square, and the page's own size says when the room may have come back. Its own switch is never watched,
    // so the observer never reports a change it made itself.
    const watchButton = (watch: boolean) => {
      if (watch === watchingButton) return
      watchingButton = watch
      if (watch) observer.observe(button)
      else observer.unobserve(button)
    }
    const check = () => {
      const label = button.querySelector(LABEL)
      const first = label?.querySelector(FIRST_WORD)
      if (!label || !first) return
      button.removeAttribute("data-icon-only")
      const overflowing = label.scrollWidth > label.clientWidth
      const cut = firstWordCut(label.getBoundingClientRect(), first.getBoundingClientRect(), overflowing ? ellipsisWidth(label) : 0)
      watchButton(!cut)
      if (cut) button.setAttribute("data-icon-only", "")
    }
    observer.observe(document.documentElement)
    check()
    // A font that arrives after the first paint widens the words without moving the button's box
    const fonts = document.fonts
    let live = true
    fonts?.addEventListener?.("loadingdone", check)
    void fonts?.ready?.then(() => { if (live) check() })
    return () => {
      live = false
      fonts?.removeEventListener?.("loadingdone", check)
      observer.disconnect()
      button.removeAttribute("data-icon-only")
    }
  }, [on, words])
  return ref
}

/** The icon children and the words of a button that has both, or null (a button with only words keeps its cut). */
function iconAndWords(children: React.ReactNode): { icons: React.ReactNode[]; words: string } | null {
  const icons: React.ReactNode[] = []
  let words = ""
  for (const child of React.Children.toArray(children)) {
    if (typeof child === "string" || typeof child === "number") words += String(child)
    else if (React.isValidElement(child)) icons.push(child)
    else return null
  }
  return icons.length > 0 && words.trim() ? { icons, words } : null
}

// Sprint 122: forwards its ref (React 18 drops `ref` on a plain function
// component), so a Button can be a Radix trigger — a menu or popover needs the
// trigger's element to place itself.
const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean
      /**
       * #566: an icon and words that can be cut. Below the room for the first word the button shows its icon alone
       * (see `firstWordCut`). The children are the icon, then the words as text.
       */
      iconWhenNarrow?: boolean
    }
>(({ className, variant, size, asChild = false, iconWhenNarrow = false, children, ...props }, forwardedRef) => {
  const Comp = asChild ? Slot : "button"
  const parts = iconWhenNarrow && !asChild ? iconAndWords(children) : null
  const narrowRef = useIconWhenNarrow(parts !== null, parts?.words ?? "")
  const ref = React.useCallback(
    (node: HTMLButtonElement | null) => {
      narrowRef.current = node
      if (typeof forwardedRef === "function") forwardedRef(node)
      else if (forwardedRef) forwardedRef.current = node
    },
    [forwardedRef, narrowRef]
  )
  let content = children
  if (parts) {
    const [first, rest] = splitFirstWord(parts.words)
    content = (
      <>
        {parts.icons}
        <span data-slot="button-label" className="min-w-0 truncate">
          <span data-slot="first-word">{first}</span>
          {rest}
        </span>
      </>
    )
  }

  return (
    <Comp
      ref={ref}
      data-slot="button"
      // The words may be cut, so the button may shrink to its room
      className={cn(buttonVariants({ variant, size, className }), parts && "min-w-0 max-w-full shrink")}
      {...props}
    >
      {content}
    </Comp>
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }

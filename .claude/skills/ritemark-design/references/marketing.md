# Marketing

Ritemark-authored marketing — landing page, feature pages, social-share images, email headers, GitHub profile. **Productory-authored** materials featuring Ritemark use the `productory-design` skill instead.

## The promise

Ritemark marketing looks like Ritemark feels: calm, credible, writerly. It is **not** a launch-y SaaS landing. It is closer in tone to an editorial feature about a well-made tool. Type carries the weight. Color is sparing.

## Surface types

| Surface | Width | Type scale | Density |
|---|---|---|---|
| Landing hero | 1440px max canvas, 80px side margins | Display (Space Grotesk 56–72px) | Generous — 120–160px section gaps |
| Feature section | 1200px max | H2 30–40px, body 16–18px | Medium — 64–96px section gaps |
| Social share (1200×630) | 1200×630 fixed | Display 44px, body 18px | Dense, 40px side padding |
| Email header | 600px | H1 32px, body 16px | Dense, email-safe |
| GitHub banner (readme) | 1280×640 | Display 48px | Medium, centered |

## Hero pattern

The Ritemark hero is deliberately quiet — no radial gradient wash, no marketing-y floating device mockups. Structure:

```
[Top marker: 3px indigo bar flush to the viewport top]

[Eyebrow · Sofia Sans 11 / 600 / tracking 3px / indigo]
RITEMARK · VISUAL MARKDOWN FOR WRITERS

[H1 · Space Grotesk 56–72 / 700 / 1.1 / -0.5px]
Markdown, without the syntax.

[Lede · Sofia Sans 18 / 400 / 1.55 / ink-body]
A visual editor for the notes you already write. Local-first,
offline, and obviously designed.

[Primary CTA · indigo with indigo shadow]  [Secondary CTA · ghost outline]
Download for macOS                          See the release notes

[Hero visual: a screenshot of Ritemark in light mode, rounded 10px, shadow-lg]
```

Non-negotiables:

- **The top 3px indigo bar** is the opening move. Every Ritemark marketing page has it.
- **Eyebrow before H1.** Never an H1 alone.
- **CTA pair, not solo.** Primary in indigo with the drop-shadow signature; secondary as ghost / outline.
- **Screenshot is the hero visual, not an illustration.** No stock photos of writers, no abstract shapes. If the product has to be the hero, the product is the hero.

## Color in marketing

Still one accent — indigo. The difference from chrome is just *volume*:

- Shadows on primary CTAs go up one step: `--ritemark-shadow-indigo-md` or `-lg` instead of `-sm`.
- Bold primary text (H1) can pick up the indigo-to-violet gradient-text treatment *sparingly* — one word per page, never a full headline:

```css
.accent-text {
  background: linear-gradient(90deg, var(--ritemark-indigo), #7C3AED);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

Use `class="accent-text"` on a *single* headline word where the meaning lands (e.g., "Markdown, without the *syntax*."). If you're tempted to gradient-ize two words, pull back to one.

- Soft indigo backgrounds (`--ritemark-indigo-soft`, `#E0E7FF`) are fine for feature callouts, quote cards, or pricing-highlight boxes. Don't let them become pink-pastel marketing cards; keep them indigo.
- **No** pink, no lavender, no gradient wash anywhere.

## Feature sections

Alternating patterns:

### Pattern A — text left, screenshot right (default)

```
┌──────────────────────────────────┬────────────────────┐
│ [80×2px indigo bar]              │                    │
│                                  │                    │
│ Eyebrow                          │   [Screenshot]     │
│ H2 — sentence case, Space Grotesk│   rounded 10px     │
│ 30–40px                          │   shadow-lg        │
│                                  │                    │
│ Body paragraph, Sofia Sans 16/   │                    │
│ 1.6, ink-body                    │                    │
│                                  │                    │
│ Three bulleted affordances:      │                    │
│  • Lucide-icon + 14px inline text│                    │
│  • ...                           │                    │
│                                  │                    │
│ [Link CTA — indigo text + arrow] │                    │
└──────────────────────────────────┴────────────────────┘
```

### Pattern B — centered testimonial / quote

```
[Eyebrow centered]
ONE USER

[Quote — Space Grotesk 28 / 500 / 1.4]
"I stopped using Obsidian three weeks in. Ritemark is what I
wish markdown had always looked like."

[Attribution — Sofia Sans 14 / 500 / ink-muted]
Maya, writer • macOS
```

### Pattern C — data / pricing / compare

Dense tabular layout; rows with hairline borders between; no colored tablehead backgrounds; status via Lucide icons + color tokens (indigo for yes, faint for no).

## Forbidden marketing patterns

- ❌ **Hero radial wash.** No pink/lavender radial gradients bleeding off the canvas. That's Productory's brand; it doesn't belong on Ritemark pages.
- ❌ **Feature cards with colored backgrounds.** Keep cards on `--r-surface` with hairline borders. The system uses indigo-soft backgrounds for *callouts* (one or two per page), not for every feature tile.
- ❌ **Gradient-text headlines.** One gradient-text *word* per page is the ceiling.
- ❌ **Stock photos of people typing.** No.
- ❌ **3D-illustrated product visuals.** Screenshots only. If the real product doesn't photograph well, fix the product, not the marketing.
- ❌ **Emoji in headlines or body.** ("🚀 Fast" is an instant credibility failure.)
- ❌ **Testimonial carousels.** One fixed quote per page, more than enough.
- ❌ **"Trusted by" logo walls** unless we actually have notable customers to name. Empty logo walls are worse than no wall.

## Social-share (1200×630) layout

The Twitter / LinkedIn / OG image pattern:

```
1200 × 630
┌──────────────────────────────────────────────┐
│[3px indigo top marker, full width]           │
│                                              │
│  [Ritemark mark — 48×48px indigo rounded]    │
│                                              │
│  RITEMARK 1.6 — WHAT'S NEW                   │
│  (Sofia Sans 14 / 600 / tracking 2 / muted)  │
│                                              │
│  Markdown that finally                       │
│  looks like what you mean.                   │
│  (Space Grotesk 44 / 700 / -0.5px / ink)     │
│                                              │
│                                              │
│  ritemark.app         (Sofia Sans 14 / muted)│
└──────────────────────────────────────────────┘
```

Background stays `--r-surface` (`#FFFFFF`). The indigo appears in: top marker, mark, one word of the headline (optional) with gradient-text. That's it.

Dark variant: surface `#1E1B4B`, ink `#F8FAFC`, mark indigo-400, top marker indigo-400. Same layout.

## Email headers (600px)

Email constraints (no SVG animations, no complex CSS):

- Background: `#FFFFFF` (`--r-surface`).
- Top marker: `<div style="height:3px;background:#4338CA;"></div>`.
- Mark: inline SVG at 32px OR a 32×32 indigo-filled square with white "R" (Space Grotesk fallback to Arial).
- H1: Space Grotesk (fallback: Helvetica Neue, Arial), 28–32px, weight 700, `#1E1B4B`, sentence case.
- Body: Sofia Sans (fallback: Arial), 16px, `#475569`.
- CTA button: `<table>` with `bgcolor="#4338CA"` + 10px padding + 10px radius (via `border-radius` inline). Note: older email clients clip the indigo drop-shadow — it's acceptable to drop it in email.
- Footer: 12px, `--r-ink-muted`, sentence case.

## Landing page HTML starter

```html
<!-- In `<head>` -->
<link rel="stylesheet" href="path/to/ritemark-design/tokens.css">
<style>
  body { font-family: var(--ritemark-font-ui); background: var(--r-surface); color: var(--r-ink-strong); }
  .marker-top { height: 3px; background: var(--r-accent); width: 100%; }
  .container { max-width: 1200px; margin: 0 auto; padding: 0 80px; }
  .eyebrow { font-size: var(--ritemark-size-xs); font-weight: 600; letter-spacing: var(--ritemark-tracking-widest); text-transform: uppercase; color: var(--r-accent); }
  h1.hero { font-family: var(--ritemark-font-display); font-size: var(--ritemark-size-5xl); font-weight: 700; line-height: var(--ritemark-leading-tight); letter-spacing: var(--ritemark-tracking-tight); color: var(--r-ink-strong); max-width: 880px; }
  .lede { font-size: var(--ritemark-size-lg); line-height: var(--ritemark-leading-normal); color: var(--r-ink-body); max-width: 640px; }
  .cta-primary { background: var(--r-accent); color: #FFF; padding: 14px 26px; border-radius: var(--ritemark-radius-lg); font-size: var(--ritemark-size-md); font-weight: 600; box-shadow: var(--ritemark-shadow-indigo-md); border: 0; }
  .cta-secondary { background: transparent; color: var(--r-ink-strong); padding: 14px 26px; border-radius: var(--ritemark-radius-lg); font-size: var(--ritemark-size-md); font-weight: 500; border: 1px solid var(--r-hairline-strong); }
</style>
```

Copy the pattern, adapt.

## Anti-patterns one more time, short list

- Gradient wash backgrounds
- Multiple accent colors
- Emoji
- Testimonial carousels
- Stock photos of writers
- 3D illustrations
- Hero without the top marker + eyebrow pair
- "Get started free" — use "Download for macOS" or "Open a folder" instead; Ritemark is a download, not a SaaS signup.

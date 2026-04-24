# Slides

Ritemark-authored decks — release decks, product pitches, internal product comms, conference talks *about* Ritemark. Productory's own consultancy decks use `productory-design` instead.

## The canvas

**1920 × 1080 px**, always. Design for 16:9 displays, export to PDF or screenshot when a flat asset is needed. Do not design at any other aspect ratio.

Side margins: **96px**. That gives a live area of 1728 × 888. Use an invisible 1728 grid with 64–96px gutters.

Background:
- Light deck → `#FFFFFF` (`--r-surface`).
- Dark deck → `#1E1B4B` (`--ritemark-dark-surface` — Deep Space).

Pick one and stay there for the whole deck. Mixing light and dark slides inside a single deck is acceptable only when the *dark* slides are *section dividers* — never a random content slide.

## Slide types (the full set)

Ritemark decks use 7 slide types. Every slide in a well-made Ritemark deck is one of these:

### 1. Cover — deck intro

```
[4px indigo bar flush to top]

[Mark — 64×64 indigo rounded 12px, center-left near title]

RITEMARK · PRODUCT REVIEW          (Sofia Sans 18 / 600 / tracking 3 / indigo)

The agent curation layer is          (Space Grotesk 72 / 700 / 1.1 / -1px / ink)
boring, in a good way.

Sprint 52 recap · Jarmo · 2026-04-23 (Sofia Sans 16 / 500 / ink-muted)
```

Dark variant: surface `#1E1B4B`, ink `#F8FAFC`, indigo → `#818CF8`. Everything else same.

### 2. Section divider

High-impact break between deck sections. Use sparingly (max 4–5 per deck).

```
(Full bleed — no side margins on the indigo bar)

[4px indigo bar at top]

                      (1920 × 1080 canvas)

                       01 · THE PROBLEM      (Sofia Sans 20 / 600 / tracking 4 / indigo)

                   Viktor has 32 agents.    (Space Grotesk 96 / 700 / 1.0 / -1.5px / ink)
                   He's afraid to delete
                   any of them.
```

On dark variant: same text on `#1E1B4B` surface, indigo accent becomes `#818CF8`. This is where the dark variant lands best — section dividers feel weightier in dark.

### 3. Content — text-heavy

For talking points with one idea per slide. Avoid multi-column or tile layouts.

```
[4px indigo bar top]

[80×2px indigo bar]

PRINCIPLES                                 (eyebrow)

Density over decoration.                   (Space Grotesk 56 / 700 / -0.5px)

This is a power-user screen. Think GitHub insights, Linear lists,
VS Code's source-control panel — not a marketing landing page.
Scannable rows, small type weight variations, color used sparingly
and functionally.                          (Sofia Sans 24 / 400 / 1.5 / ink-body, max 880px)
```

Keep the paragraph to ~40 words. If it's longer, it's a 2-slide topic.

### 4. Quote — one voice

```
[4px indigo bar top]

                    [opening quote glyph " as 120px Space Grotesk 300]

"I stopped using Obsidian three weeks in.
 Ritemark is what I wish markdown
 had always looked like."                  (Space Grotesk 48 / 500 / 1.3 / ink, center, max 1120px)


                    — Maya, writer · macOS  (Sofia Sans 20 / 500 / ink-muted, centered, with 16px gap)
```

### 5. Comparison / Do-Don't

Two-column layout for showing contrasts.

```
[4px indigo bar top]

CONTRAST                                 (eyebrow)

Before and after.                        (Space Grotesk 48 / 700)

┌────────────────────────────┬────────────────────────────┐
│ BEFORE (ink-muted eyebrow) │ AFTER (indigo eyebrow)     │
│                            │                            │
│ Active row is just         │ Active row has indigo      │
│ a colored background.      │ left-border + background   │
│                            │ + 500 weight.              │
│                            │                            │
│ [screenshot]               │ [screenshot]               │
└────────────────────────────┴────────────────────────────┘
```

Avoid green/red "good/bad" coloring. The contrast is typographic, not chromatic.

### 6. Data — numbers / metrics

```
[4px indigo bar top]

[80×2px indigo bar]

BY THE NUMBERS                          (eyebrow)

32 → 19                                 (Space Grotesk 144 / 700 / -3px / 1.0)

Agents Viktor had before and after     (Sofia Sans 22 / 400 / 1.5 / ink-body)
a one-hour session with the
Library view.
```

For multi-metric slides, keep 3 metrics max, separated by generous whitespace. No pie charts, no bar charts — if charts are needed, it's a different slide.

### 7. End / Thanks

```
[4px indigo bar top]

[Mark — 64×64 indigo rounded 12px, centered]

Ritemark                                (Space Grotesk 88 / 700 / -1px, centered)


ritemark.app · productory.eu            (Sofia Sans 18 / 500 / ink-muted, centered, with 48px gap)
```

## Voice in decks

Slides are not the place to be coy. Ritemark decks are confident and short:

- **One idea per slide.** If a slide has two topics, it's two slides.
- **Don't pad.** "Ritemark 1.6 ships with inline headings, block-level search, and a settings page that remembers you" is a release slide. "Ritemark 1.6 — a landmark release bringing together our most requested features" is marketing fluff.
- **No emoji, no unicode glyphs.** Lucide icons only, at 24–48px depending on the slide.

## Animation

None, in static exports. If the deck is presented live (Keynote, etc.):

- Text fade-in 200ms, ease-quick.
- Never slide-from-left, never springy entries.
- Max one animation per slide. A quote slide has the quote itself do nothing; the attribution fades in after.

## Export settings

- PDF export: 300 DPI, embed fonts, slide per page.
- PNG export (for social or README embedding): 2× retina → 3840 × 2160 at PNG-24.
- When exporting a single slide for social, crop aggressively — a 1920×1080 slide shrunk to a 1200×630 social share looks cramped; redesign, don't shrink.

## HTML slide templates

The `slides/` folder ships a full deck of HTML templates — one per slide type plus `index.html` as an overview. Open any of them in a browser to preview the template, then copy-adapt for your deck.

```
ritemark-design/slides/
├── index.html          — overview, list of all templates
├── cover.html
├── section.html
├── content.html
├── quote.html
├── comparison.html
├── data.html
└── end.html
```

Each template loads `../tokens.css` and renders the slide at 1920×1080 inside a scaled container. For final output, render the template at 1:1 and screenshot or headless-Chrome-to-PDF.

## What not to do

- Don't use bullet lists on more than one slide per deck. Bullets = a tell that the content isn't well-structured yet.
- Don't put the Ritemark logo on every slide. Once on cover, once on end. The top 4px indigo bar is enough brand signal for every other slide.
- Don't use the Productory gradient on any Ritemark slide. (It's a separate brand.)
- Don't use tables unless the data actually needs tabular presentation. Prose and whitespace are usually better.
- Don't fill empty space with "decorative" shapes. Empty space *is* the design.

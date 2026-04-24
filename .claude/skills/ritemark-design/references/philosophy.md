# Philosophy — Indigo-Editorial

Ritemark is a visual markdown editor built on top of VS Code. Its users don't want to learn markdown syntax. They open Ritemark to write — essays, notes, documentation, plans — and stay inside it for hours.

The design language has to do three things at the same time:

1. **Feel credible.** Writers don't trust fluffy software. Ritemark looks like a tool made by people who ship software, not people who ship decks.
2. **Feel calm.** Whatever visual personality the brand has, it has to survive six hours of Tuesday. No part of the chrome should demand attention from the writing.
3. **Feel writerly.** Indigo on white, Deep Space on indigo — the palette is deliberately closer to an editorial paper than to a SaaS dashboard. No dashboard gradients. No emoji. No exclamation points in UI copy.

We call the system **Indigo-Editorial**.

## What it descends from

Ritemark currently ships a palette pulled from the *legacy* Productory brand — Indigo `#4338CA`, Deep Space `#1E1B4B`, slate neutrals. That palette was never treated as Ritemark's own; it was an accidental inheritance. This skill claims it.

Going forward:

- **Ritemark** owns the Indigo-Editorial system (this skill).
- **Productory** (the parent consultancy) has a separate, distinct Design System — editorial gradient (pink → lavender → blue), Hot Pink accent, Space Grotesk + Sofia Sans. That lives in the `productory-design` skill.
- Productory-authored artifacts that *feature* Ritemark (sales decks, consultancy comms) use Productory's system. Ritemark-authored artifacts (the app, its own landing page, release decks, social) use this system.
- No gradient in Ritemark chrome. Ever. If you want the gradient, you want the other skill.

## The one accent

The whole Ritemark system is built around **a single chromatic signal**: indigo. Everything else is a ladder of neutrals.

This matters because it forces hierarchy to come from *tone*, not from *color variety*. When you want a secondary action, you don't reach for orange — you use a hairline border on a surface-soft background. When you want to show "active," you don't introduce green — you add the indigo left-border + indigo-soft background. When you want an error state, you use red, but only for destructive or genuinely wrong states, never for emphasis.

This is the discipline that keeps Ritemark looking like a writing tool and not like a marketing page for a writing tool.

## The indigo signature

Primary CTAs in Ritemark carry an **indigo-colored drop-shadow**: `0 4px 6px -1px rgba(67, 56, 202, 0.25)`. This is small but load-bearing. It's the moment where indigo stops being an outline color and becomes a presence in the layout. If you take the shadow off, the button reads as a plain filled rectangle like every other shadcn app. With it, it reads as *Ritemark's* button.

This is the closest thing to a "brand flourish" in the system. Use it on:

- Primary CTAs (dialog primary action, welcome "Open folder", landing hero CTAs)
- Logo marks on welcome and splash
- Featured items in sparse layouts (marketing hero cards)

Do not use it on:

- Secondary / ghost buttons
- Row-level buttons in dense UI (the Library table, sidebar items)
- Anything that needs to feel subordinate

## The ink ladder

Text hierarchy in Ritemark is always a **four-step ladder**, and every surface uses the same four steps:

| Step | Token | Light | Dark | Use |
|---|---|---|---|---|
| ink-strong | `--r-ink-strong` | `#1E1B4B` | `#F8FAFC` | Body copy, headings, primary labels |
| ink-body | `--r-ink-body` | `#475569` | `#C7D2FE` | Paragraph body, secondary labels |
| ink-muted | `--r-ink-muted` | `#64748B` | `#94A3B8` | Captions, helper text, metadata |
| ink-faint | `--r-ink-faint` | `#94A3B8` | `#64748B` | Placeholders, disabled, counters |

If you find yourself reaching for a fifth tone, you're overdrawing the hierarchy — collapse something.

Crucially, on **dark mode**, the body text tone is `--r-ink-body: #C7D2FE` (indigo-fainter), *not* muted grey. Grey on deep indigo reads muddy and generic. Indigo-fainter keeps the mood unmistakably Ritemark.

## Density over decoration

Ritemark's primary surface — the editor — is already a dense surface (paragraphs of text). Every chrome surface around it has to be even denser, or the chrome reads as decorative compared to the writing.

This means:

- **Small type by default.** Body UI is 13px, not 15px. Dialog titles are 16px, not 20px.
- **Small radii.** 4–10px, never 16px on in-app surfaces. The 16px radius is a marketing-only size.
- **Tight spacing.** 4pt grid. 12–20px between related rows, not 32px.
- **Color used sparingly and functionally.** The only places color gets introduced: the indigo accent, semantic green/amber/red, vendor badges in the Library, file-status pills. Everything else is slate.

This isn't austerity for its own sake — it's what makes Ritemark look like a writing tool for adults.

## Two tones: chrome vs. moment

Ritemark has two volume levels:

1. **Chrome tone** — everything users look at all day. Dialogs, settings, sidebar, Library rows, tabs. Sofia Sans, 13px body, small radii, muted hierarchy, indigo-only accent.
2. **Moment tone** — surfaces users pass *through*. Welcome screen, marketing hero, release splash, slide covers. Space Grotesk headlines, larger type, more breathing room, the indigo shadow plays louder.

A dialog title is chrome. A welcome screen title is a moment. Never confuse them — a dialog in moment-tone looks like a marketing card inside a settings page, and a welcome screen in chrome-tone looks like a blank file.

## What we explicitly reject

- **VS Code chrome as default.** Even though Ritemark is built on VS Code, a user should feel they're in Ritemark, not in VS Code with a theme. Every surface we own gets Ritemark tokens; VS Code tokens only apply to surfaces VS Code owns that we can't override (scrollbars, system context menus).
- **The Productory gradient.** The pink → lavender → blue gradient belongs to the parent brand. It doesn't appear in Ritemark chrome, Ritemark marketing, or Ritemark slides. Full stop.
- **Dashboard multi-color.** No orange CTAs, no teal secondary accents, no purple tags, no color-coded "status" beyond the semantic green/amber/red for genuinely semantic states.
- **shadcn defaults.** shadcn/ui is the component library, but the defaults are the developer-friendly-modern-SaaS look. Ritemark overrides the focus ring, the CTA shadow, the radii, and the muted tones. If a new component looks like it came out of a shadcn example, it isn't done yet.
- **Emoji.** No emoji in UI copy, in marketing, in slides. Icons are Lucide, 16px in dense UI, 20px in comfortable UI, stroke 1px (already set in `webview/src/index.css`).
- **Decorative dark mode.** No purple gradients, no neon accents, no glow effects in dark. Dark mode is structurally the same as light — Deep Space surface, indigo accent, ivory ink — the palette just inverts.

## The test

When in doubt, ask: *"Does this look like a writing tool a careful adult would trust with three years of notes?"* If yes, proceed. If it reads as "AI-generated dashboard," "shadcn starter kit," or "ChatGPT wrapper," stop and reach for tone instead of color.

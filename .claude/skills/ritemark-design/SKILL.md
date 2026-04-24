---
name: ritemark-design
description: Design system for Ritemark Native — a VS Code-based markdown editor with its own Indigo-Editorial visual language. Use this skill whenever the user asks to design, build, mock, or refactor any Ritemark UI surface (dialogs, panels, settings pages, sidebars, webview components, welcome screens), any Ritemark marketing artifact (landing page, social-share images, release graphics), any Ritemark product deck or release slides, or any time a generated artifact needs to look like Ritemark rather than default VS Code. Pull this skill even when the user does not use the word "design" — if they're making any visual decision inside Ritemark Native or about Ritemark, you want this skill's tokens and rules. For the Productory parent-company brand (consultancy sales decks featuring Ritemark, company-level comms) use a separate `productory-design` skill instead; Ritemark has its own identity drawn from, but distinct from, Productory.
user-invocable: true
---

# Ritemark Design

Ritemark has its own visual language: **Indigo-Editorial**. It descends from the legacy Productory palette (Indigo `#4338CA`, Deep Space `#1E1B4B`, Slate neutrals) but is no longer "Productory's indigo hand-me-down" — it's Ritemark's own system, codified and polished here.

This skill covers three surfaces:

1. **In-app UI** — the webview + VS Code chrome (dialogs, sidebars, settings, welcome, new Library UIs)
2. **Marketing + release assets** — Ritemark's own landing page, social-share, release graphics
3. **Product slides** — release decks, product pitches, internal comms about Ritemark

For anything Productory (parent consultancy) produces *about* Ritemark — sales decks, company-level comms — use the separate `productory-design` skill. Two brands, two systems, no bleed.

## How to use this skill

**Always start by reading `references/philosophy.md`** — it's one page, and it's the frame everything else sits inside. Then branch to the reference file(s) that match your task.

| If you're doing… | Read first |
|---|---|
| Any in-app UI work (dialog, panel, settings, sidebar, webview component) | `references/webview-ui.md` + `references/components.md` + `tokens.css` |
| Theming VS Code core (tabs, activity bar, status bar, titlebar) | `references/vscode-core.md` |
| Typography decisions (sizing, weights, when to use Space Grotesk vs Sofia Sans) | `references/typography.md` |
| Icons | `references/iconography.md` |
| Landing page, social images, release graphics | `references/marketing.md` |
| Product deck / release deck / pitch slides | `references/slides.md` + `slides/` templates |
| Release notes, GitHub banners, social-share images | `references/release-assets.md` |
| Auditing or improving existing components | `references/audit-current.md` |
| Visual token browser | open `preview/tokens.html` |
| Component library preview | open `preview/components.html` |
| Type specimens | open `preview/typography.html` |

## Quick reference (for confidence-checks)

| Thing | Value |
|---|---|
| Primary accent | `--ritemark-indigo: #4338CA` (light) / `#818CF8` Indigo-400 (dark) |
| Light surface | `#FFFFFF` |
| Dark surface | `#1E1B4B` Deep Space (the light "ink" inverts to become dark "surface") |
| Body font | Sofia Sans (self-hosted; already loaded in webview) |
| Heading font (design-y only) | Space Grotesk — welcome screen, marketing, slides. **Not** in-app chrome. |
| UI chrome font | Sofia Sans (same as body) — system fallback is `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` |
| Corner radius | `0.625rem` / 10px for components, `0.375rem` / 6px for inputs, `999px` pills only for pill-style CTAs |
| Focus ring | 2px `--ritemark-indigo` border + 4px `rgba(67, 56, 202, 0.1)` ring |
| Primary CTA shadow | `0 4px 6px -1px rgba(67, 56, 202, 0.25)` — the indigo drop-shadow is part of the brand |

## Philosophy in one paragraph

Ritemark is a visual markdown editor for people who don't want to learn syntax. Its UI should feel **credible, calm, and writerly**: the indigo accent is the *only* chromatic signal, used sparingly and always with the colored drop-shadow that says "this is where your attention goes." Chrome is slate neutrals, never muted greys. Every surface has a clear ink ladder (strong → body → muted → faint) so hierarchy is carried by tone, not by adding color. The VS Code chrome underneath is *overridden*, not inherited — users should feel they're in Ritemark, not in VS Code with a theme.

## What NOT to do

- **No pink, lavender, or gradient anywhere in Ritemark UI.** The Productory brand gradient (pink → lavender → blue) belongs to the `productory-design` skill. Ritemark uses indigo. If you're tempted to reach for the gradient, you're either (a) thinking about Productory (use the other skill), or (b) trying to add visual interest the wrong way (reach for the ink ladder instead).
- **No muted grey body copy on dark mode.** Use the indigo-fainter and ivory tones defined in `tokens.css`. Grey on dark reads muddy.
- **No VS Code defaults for new surfaces.** If you're inheriting a `--vscode-*` var as a default, you're producing VS Code-flavored chrome. Wire the Ritemark token first; fall back to VS Code only when the surface must look like VS Code (e.g., scrollbars, system context menus).
- **No Space Grotesk in day-to-day chrome.** It's for moments — welcome screen titles, marketing headlines, slide covers. A settings page heading is not a moment.
- **No bold pure-white on pure-black "dramatic" dark mode.** Ritemark dark uses Deep Space `#1E1B4B` as the surface, ivory-tending-indigo as the ink. See `references/vscode-core.md` for why.

## When to extend vs. when to override

This skill is a living system. If you're about to invent a new component for Ritemark and none of the patterns fit cleanly, your default is to **extend the skill, not fork in-place**:

1. Sketch the component in the mock
2. Check if an existing primitive stretches to fit
3. If not, add the pattern to `references/components.md` with a rationale and a code snippet
4. Then implement

If Jarmo approves an exception in-flight, document it in `references/components.md` under "Exceptions" with the rationale and a date. Exceptions with no rationale are not exceptions — they're drift.

## Provenance

This skill was authored out of the design study at `docs-internal/analysis/design-study/` (Option D selected) as prep work for Sprint 52 (Agent Curation Layer). The indigo + slate palette it formalizes was already shipping in `extensions/ritemark/themes/ritemark-light.json`; this skill codifies it, extends it to a proper dark theme, documents the component polish (sidebar active borders, focus rings, CTA shadows, muted-tone hierarchy) that was implicit in the design study mocks, and adds the marketing + slides surfaces Ritemark didn't have a system for before.

# Typography

Ritemark uses two typefaces, and they have very different jobs.

## The two families

| Family | Where | Why |
|---|---|---|
| **Sofia Sans** | Everything in-chrome, all body copy everywhere, most marketing body | Sofia Sans is a variable-weight humanist sans with excellent density. It's self-hosted in the webview (`extensions/ritemark/webview/src/assets/fonts/SofiaSans-latin*.woff2`). The variable font covers weights 100–900 so we don't have to ship separate weight files. |
| **Space Grotesk** | Welcome screen titles, marketing H1–H2, slide covers | Space Grotesk is a geometric-ish sans with more personality than Sofia. It's how we get "designed" moments without introducing a third family. Not currently loaded in the webview — it's loaded only on surfaces that use it (see "Loading" below). |

**Monospace** is the system stack: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace`. Covered by `var(--ritemark-font-mono)`. Used for `<code>`, `<pre>`, file paths, JSON inspector, terminal-flavored surfaces.

## The rule of chrome vs. moment

Ritemark type has exactly two personalities:

### Chrome — Sofia Sans, small, tight

- Body UI: `var(--ritemark-size-base)` = 13px, `var(--ritemark-leading-normal)` = 1.55.
- Dialog titles: `var(--ritemark-size-lg)` = 16px, `var(--ritemark-leading-snug)` = 1.3.
- Section headings in Settings / Library: `var(--ritemark-size-xl)` = 20px max.
- Uppercase-spaced eyebrow style: only on sidebar group headers and status bar labels, `var(--ritemark-size-xs)` = 11px, `letter-spacing: var(--ritemark-tracking-wide)` (0.5px).

Chrome type is **always Sofia Sans**. Even welcome-screen body copy stays in Sofia. The contrast is between sizes/weights inside one family, not between two families.

### Moment — Space Grotesk for the headline, Sofia Sans for everything else

Moment surfaces are where Ritemark introduces itself: welcome screen, marketing hero, slide covers, release cards. Here, and only here, the **headline** switches to Space Grotesk:

- Welcome screen H1: Space Grotesk, `var(--ritemark-size-5xl)` = 56px, weight 700, `--ritemark-leading-tight` = 1.15, `--ritemark-tracking-tight` = -0.5px.
- Marketing hero H1: Space Grotesk, up to `--ritemark-size-5xl` (56px) on desktop.
- Slide cover title: Space Grotesk, `--ritemark-size-6xl` = 72px.
- H2 in marketing: Space Grotesk, `--ritemark-size-3xl` (30px) or `--ritemark-size-4xl` (40px).

Body copy on moment surfaces stays **Sofia Sans** — usually `--ritemark-size-lg` (16px) or `--ritemark-size-md` (14px) with `--ritemark-leading-normal` (1.55). The mix of Space Grotesk head + Sofia body is the moment-tone voice.

### Where the line is

A settings page has a heading. Is that heading a "moment"? No — it's chrome. Use Sofia Sans, 20px.
A welcome screen has a heading. Is that a moment? Yes — use Space Grotesk, 56px.
A dialog has a title. Moment? No — chrome. Sofia Sans, 16px.
A release card in a marketing email has a title. Moment? Yes — Space Grotesk, 40px.

The test: *Is this surface the user passes through once, or looks at every day?* Through → moment → Space Grotesk. Every day → chrome → Sofia Sans only.

## Full size scale (with guidance)

| Token | Px | Sofia Sans (chrome) | Space Grotesk (moment) |
|---|---|---|---|
| `--ritemark-size-xs` | 11 | Eyebrow labels, pill text | — |
| `--ritemark-size-sm` | 12 | Meta, helper text, column headers | — |
| `--ritemark-size-base` | 13 | **Default body UI** | — |
| `--ritemark-size-md` | 14 | Body copy in dialogs, comfortable text | — |
| `--ritemark-size-lg` | 16 | Dialog titles, marketing body copy | — |
| `--ritemark-size-xl` | 20 | Settings section heads, panel titles | Marketing H3 |
| `--ritemark-size-2xl` | 24 | — | Marketing H3 (preferred) |
| `--ritemark-size-3xl` | 30 | — | Marketing H2 (small hero) |
| `--ritemark-size-4xl` | 40 | — | Marketing H1 (compact), release card title |
| `--ritemark-size-5xl` | 56 | — | Welcome screen title, marketing H1 |
| `--ritemark-size-6xl` | 72 | — | Slide cover, section-dividing slide |

## Weights

Sofia Sans variable font gives us smooth weights. Standard steps we use:

- 300 — Lighter body on moment surfaces (marketing lede)
- 400 — Default body copy
- 500 — Emphasized body, labels, active row names
- 600 — Headings, group headers, primary button
- 700 — Display heads in Space Grotesk, welcome titles

Space Grotesk is loaded at 400/500/600/700 (no 300 — it's not flattering at display sizes).

## Tracking

- `--ritemark-tracking-normal` (0) — default. Most copy and all display heads.
- `--ritemark-tracking-tight` (-0.5px) — only for large Space Grotesk at 40px+. Keeps display heads from looking airy.
- `--ritemark-tracking-wide` (0.5px) — eyebrow labels, group headers, uppercase meta.
- `--ritemark-tracking-widest` (3px) — all-caps eyebrow headings in marketing. Never in chrome.

## Loading

### Sofia Sans — already wired

Loaded via `@font-face` in `extensions/ritemark/webview/src/index.css`. Both `latin` and `latin-ext` ranges are present. No further work needed.

For skill-authored artifacts (preview HTMLs, slide templates, standalone mocks), Sofia Sans is pulled from Google Fonts in `tokens.css` — use that for any design artifact produced through this skill.

### Space Grotesk — load per surface

Not currently loaded in the webview. Two loading strategies depending on where Space Grotesk is needed:

**Strategy A — welcome / onboarding screens only:**
Load via `@font-face` in the webview's `index.css`, with `font-display: swap`. Self-host a WOFF2 in `extensions/ritemark/webview/src/assets/fonts/SpaceGrotesk-VariableFont_wght.woff2`. Wire it up like Sofia Sans already is. Only pay this cost when a welcome-style screen is actually shipping.

**Strategy B — marketing / slides:**
Load from Google Fonts CDN. Marketing HTML pages are cached aggressively by the browser; slide templates are opened rarely. CDN is fine here.

Never mix both strategies in the same deliverable. Pick one.

## Casing

- **Sentence case** everywhere by default.
  - "Save changes" not "Save Changes"
  - "Open a folder" not "Open A Folder"
- **UPPERCASE** only for:
  - Sidebar group headers (`RECENTS`, `FOLDERS`)
  - Eyebrow labels (`01 — WHAT'S NEW`)
  - Status bar labels (`OFFLINE`, `CONNECTED`)
- Never ALL-CAPS a full sentence or a button label.

## Voice, briefly

Writing guidance isn't typography, but it's adjacent enough to be worth stating:

- **Direct.** "Ritemark doesn't have a backend," not "Ritemark has been designed without a backend."
- **Quiet.** No "unlock", "supercharge", "seamless", "revolutionary", "game-changing."
- **No emoji.** Icons are Lucide (see `iconography.md`).
- **Sparingly editorial.** One em-dash per paragraph is plenty.
- **Plural "we" for Ritemark/Productory, second-person "you" for the user.** Never "the user."

Writing body copy for marketing? Draft it at half the length, then add back only what carries weight.

## Type pairing example — welcome screen

```
[Ritemark mark — 48px indigo rounded square]

H1 · Space Grotesk 56 / 700 / 1.15 / -0.5px
Markdown, without the syntax.

lede · Sofia Sans 18 / 400 / 1.55
A visual editor for the notes you already write. Local-first, offline,
and obviously designed.

[CTA primary — Sofia Sans 14 / 600] · [CTA secondary — Sofia Sans 14 / 500]
```

That's the moment-tone voice: a Space Grotesk display head, Sofia Sans body, and two CTA weights.

## Type pairing example — dialog

```
[icon] dialog-title · Sofia Sans 16 / 600
Editor preferences
─────────────────────────────────
label · Sofia Sans 12 / 500
Line width
input · Sofia Sans 14 / 400
72 characters
─────────────────────────────────
[Cancel secondary] [Save primary]
```

Chrome tone: one family, tight sizes, weight contrast doing all the work.

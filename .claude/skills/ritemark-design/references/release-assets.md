# Release Assets

Things Ritemark publishes when a version ships: release notes, GitHub release banner, social-share image, changelog entry, in-app "What's new" card. These are the smallest-surface-area design artifacts in the brand and they still have to look like Ritemark.

## The set

| Asset | Format | Audience | Frequency |
|---|---|---|---|
| Release notes markdown | `.md` in `docs/releases/` | Users (read via GitHub or in-app) | Every version |
| GitHub release body | GitHub-flavored MD | Users following releases | Every version |
| GitHub banner image | PNG 1280×640 | GitHub profile + social preview | Major versions only |
| Social-share image | PNG 1200×630 | Twitter / LinkedIn | Major + notable minor versions |
| In-app "What's new" card | React component inside Ritemark | Existing users after update | Optional, feature-flag-gated |
| Changelog entry | `.md` in `CHANGELOG.md` | Developers / power users | Every version |

## Release notes — voice

The release notes file in `docs/releases/` is the canonical narrative. Rules:

- **Plain markdown, no emoji, no h1** (the version number is an h2 because the file is usually embedded in a larger release-notes index).
- **Three-tier structure:** Highlights → What's new (categorized) → Under the hood.
- **Sentence-case everything.** "Inline headings in the editor," not "Inline Headings In The Editor."
- **Past tense for changes, present tense for behavior.**
  - Past: "Added inline heading detection."
  - Present: "Headings now render inline as you type."
- **Write for a user who doesn't live inside your repo.** Explain why, not what line changed. The what belongs to the commit log.

### Template

```markdown
## 1.5.4 · 2026-04-09

### Highlights

- **Inline headings.** Start a line with `#` and the heading appears live, no markdown rendering pass.
- **Unified block menus.** The "/" slash menu and the drag-handle menu now share a single command list — no more remembering which is which.
- **CSV → Excel conversion.** Right-click a `.csv` to convert it to `.xlsx` (via the `xlsx` library).

### What's new

**Editor**
- Inline heading rendering for h1–h6.
- Drag-handle menu reorganized to match the slash-command list.

**Files**
- CSV-to-Excel conversion in the file context menu.

**Dev experience**
- TypeScript errors now surface in the CSV viewer.

### Under the hood

- Dependency bumps: ...
- Patch system: ...
- Known issues: ...
```

## GitHub release body

Shorter than the `.md` release notes. Typically highlights + a "Download" line + a link back.

```markdown
**Highlights**

- Inline headings — start a line with `#` and the heading renders live.
- Unified block menus across slash + drag-handle.
- CSV → Excel conversion in the context menu.

See the full release notes: https://github.com/ProductoryHQ/ritemark-native/blob/v1.5.4/docs/releases/1.5.4.md

**Download**

- macOS (arm64): `Ritemark-1.5.4-arm64.dmg`
- macOS (x64): `Ritemark-1.5.4-x64.dmg`
- Windows: `Ritemark-1.5.4-setup.exe`

Built from commit: `c63863b`
```

## GitHub banner (1280 × 640)

Used as the repo profile banner or the social preview. Appears cropped in many contexts — design for the center 1200×600.

Template (light):

```
1280 × 640
┌────────────────────────────────────────────────┐
│[4px indigo top bar]                            │
│                                                │
│                                                │
│  [Mark 56×56 indigo rounded 12px]              │
│                                                │
│  RITEMARK                        (Sofia 14/600)│
│                                                │
│  Markdown, without the syntax.                 │
│  (Space Grotesk 56 / 700 / 1.05 / -0.5px)      │
│                                                │
│                                                │
│  ritemark.app                (Sofia 14 / muted)│
│                                                │
└────────────────────────────────────────────────┘
```

Dark variant: surface `#1E1B4B`, ink `#F8FAFC`, indigo → `#818CF8`.

## Social-share image (1200 × 630)

See `references/marketing.md` (Social-share layout). For release-specific social images, swap the headline for the release tagline:

```
RITEMARK 1.6 — WHAT'S NEW         (eyebrow)

Markdown that finally             (display)
looks like what you mean.
```

Keep the layout identical across releases. Consistency is the message.

## Changelog entry

Terser than release notes. Keep-a-Changelog format, nothing fancier:

```markdown
## [1.5.4] - 2026-04-09

### Added
- Inline heading detection in TipTap editor
- CSV to Excel conversion via xlsx library

### Changed
- Drag-handle menu now shares command list with slash menu

### Fixed
- TypeScript errors no longer silent in CSV viewer
```

No emoji. No link dumps. No sales language.

## In-app "What's new" card (optional)

When a release introduces user-visible features significant enough to interrupt the user once, Ritemark can show a one-time "What's new" card after first launch on the new version. This is the only surface where release content shows up inside the chrome.

### Rules

- **Dismissible and dismissed-for-good on action.** Never re-show on next launch.
- **One card per release.** Not a stack.
- **Follows the dialog pattern.** Same radii, same shadow, same padding (see `components.md`).
- **Content pattern:**

```
┌─────────────────────────────────────┐
│ [Sparkles icon 16px indigo]         │
│ What's new in 1.5.4     [×]         │
├─────────────────────────────────────┤
│                                     │
│ Inline headings                     │  ← Sofia Sans 14/600/ink-strong
│ Type # at the start of a line — the │  ← 13/400/ink-body
│ heading appears live, no switch.    │
│                                     │
│ Unified block menus                 │
│ The "/" and drag-handle menus now   │
│ share a single command list.        │
│                                     │
│ CSV to Excel                        │
│ Right-click a .csv to convert.      │
│                                     │
├─────────────────────────────────────┤
│              [Release notes] [Got it]│
└─────────────────────────────────────┘
```

- **Max 3 items.** If a release has more user-facing changes, this card links to the full release notes — it doesn't try to enumerate.
- **Sparkles icon** in the header, indigo-colored. Yes, this is the only place an icon gets a semantic color override in chrome.
- **Primary CTA is "Got it"** (dismiss). Secondary is "Release notes" (opens full notes in a tab or browser).
- **Positioning:** centered dialog, 480px max-width, covers content with the dialog backdrop.

## Anti-patterns

- ❌ **Emoji in release notes.** `🎉 Exciting news!` — no. Ritemark is emoji-free and that includes release copy.
- ❌ **"Major UX refresh" language** without actual UX changes. Say what changed.
- ❌ **Banner images that need their own color to look good.** If the banner uses a custom gradient background or pink/teal, it's breaking the system. Indigo-on-Deep Space (dark) or indigo-on-white (light). Period.
- ❌ **"What's new" cards on patch releases.** Reserve the card for 1.x.0 releases where actual user-visible features shipped. 1.5.4 → 1.5.5 bug fix doesn't need a card.
- ❌ **Sales language in changelog.** "Get the most out of…" no. "Added X" is enough.

## Example filenames

When producing assets for a release, name them predictably:

```
docs/releases/1.5.4.md                       (release notes)
assets/releases/1.5.4-github-banner.png      (1280×640)
assets/releases/1.5.4-social.png             (1200×630)
```

Assets live outside this skill — they belong to the Ritemark repo. The skill just specifies the rules and templates; the repo owns the files.

# Ritemark Content Style Guide

This guide ensures consistent voice, tone, and formatting across all Ritemark content.

---

## Brand Voice

### Personality

- **Confident but not arrogant** - We know our product is good
- **Technical but accessible** - Power users are our audience, but clarity matters
- **Direct** - No fluff, get to the point
- **Practical** - Focus on what users can DO

### Tone by Context

| Context | Tone |
|---------|------|
| Release notes | Factual, concise |
| Blog posts | Conversational, informative |
| Landing page | Confident, benefit-focused |
| Error messages | Helpful, actionable |

---

## Writing Guidelines

### Do

- Lead with benefits, not features
- Use active voice
- Keep sentences short
- Be specific

### Don't

- Use marketing fluff ("revolutionary", "game-changing")
- Start with "We're excited to announce..."
- Over-explain simple concepts
- Use jargon without context

### Examples

| Don't | Do |
|-------|-----|
| "We're excited to announce..." | "Ritemark 1.5 is here." |
| "This amazing feature..." | "New: Spreadsheet toolbar" |
| "We think you'll love..." | "Export to Numbers in one click." |
| "It's super easy to..." | "Open any .md file. Done." |
| "The toolbar component has been implemented with spreadsheet export functionality" | "Export tables to Excel or Numbers" |

---

## Terminology

### Product Names

| Term | Usage | Never |
|------|-------|-------|
| Ritemark | Always capitalized, one word | Rite Mark, rite mark, RITEMARK |
| Ritemark Native | Full name (when distinguishing versions) | Ritemark native |

### Technical Terms

| Term | Correct Form |
|------|--------------|
| Markdown | Capitalized |
| VS Code | Space between, both capitalized |
| macOS | Lowercase 'mac', capital 'OS' |
| AI | All caps |
| Claude | Capitalized (it's a name) |
| TipTap | Capital T's |
| GitHub | Capital G and H |

### Feature Names

Use consistent names across all content:

| Feature | Name |
|---------|------|
| Rich text editor | "Ritemark editor" or just "editor" |
| Table export | "Spreadsheet toolbar" |
| Auto-update | "Extension updates" |
| File preview | "Document preview" |

---

## Formatting Conventions

### Release Notes & Changelog

- Use past tense verbs: "Added", "Fixed", "Changed", "Removed"
- Start each item with a verb
- No periods at end of bullet points
- Group by category: Added > Changed > Fixed > Removed

```markdown
## [1.5.0] - 2025-01-14

### Added
- Spreadsheet toolbar for one-click table export
- Support for Excel and Numbers formats

### Fixed
- Editor blank on first launch in some cases
```

### Blog Posts

- **Headline:** Action-oriented or benefit-focused (not "Ritemark 1.5 Released")
- **First paragraph:** What shipped and why it matters (2-3 sentences)
- **Body:** Features with brief explanations
- **End:** Clear download CTA

Good headline examples:
- "Ritemark 1.5: Tables Meet Spreadsheets"
- "Export Markdown Tables to Excel"
- "Local-First Editing Gets Smarter"

### Landing Page Copy

- **Headlines:** Short, punchy (3-5 words)
- **Subheads:** One benefit, one sentence
- **Feature cards:** Icon + title + one-line description
- **CTAs:** Action verbs ("Download", "Get Started", "Try Free")

---

## Bilingual Content

### Primary: Estonian (ET)

- Write Estonian content first
- Use natural Estonian, not translated English
- Estonian readers expect direct, no-nonsense tone

### Secondary: English (EN)

- Mirror the structure of Estonian version
- Adapt idioms appropriately (don't translate literally)
- Same information, natural English phrasing

### Translation Guidelines

| Estonian | English | Note |
|----------|---------|------|
| Lihtsalt | Simply / Just | Context-dependent |
| Kohalik | Local / Local-first | "Local-first" for privacy context |
| Tööriist | Tool | Not "instrument" |
| Avatud lähtekood | Open source | Standard term |
| Privaatsus | Privacy | Not "privateness" |

### File Naming

- Blog ET: `ritemark-1-5-uuendus.md` (Estonian slug)
- Blog EN: `ritemark-1-5-update.md` (English slug)
- Both files have same structure, different `lang` frontmatter

---

## Screenshot Guidelines

When requesting or creating screenshots:

### Technical Specs

- **Dimensions:** 1200x800 for landing page, 800x600 for blog
- **Format:** AVIF preferred, WebP acceptable, PNG for transparency
- **Mode:** Dark mode preferred for product shots

### Content Guidelines

- Use clean, minimal example content
- Avoid personal information in examples
- Show the feature in action, not just UI
- Include enough context to understand what's shown

### Naming

```
/public/images/ritemark/feature-name.avif
/public/images/blog/ritemark-1-5-feature.avif
```

---

## Numbers and Dates

### Dates

- Release notes: `YYYY-MM-DD` (ISO format)
- Blog posts: Natural format per language
  - ET: "14. jaanuar 2025"
  - EN: "January 14, 2025"

### Version Numbers

- Full: `1.5.0`
- In prose: "version 1.5" or "v1.5"
- Extension-only: `1.5.0-ext.1`

### File Sizes

- Use appropriate units: KB, MB, GB
- One decimal place: "1.2 MB" not "1.23 MB"

---

## Common Patterns

### Feature Announcement

```
[Feature Name]: [What it does in one line]

[2-3 sentences expanding on how it works and why it matters]
```

### Bug Fix Description

```
Fixed [what was broken] [in what context]
```

Examples:
- "Fixed editor blank on first launch after fresh install"
- "Fixed table export failing for tables with merged cells"

### CTA Buttons

| Context | Text |
|---------|------|
| Primary download | "Download for Mac" |
| Secondary action | "Learn More" |
| Update prompt | "Install Now" |
| Blog post end | "Get Ritemark" |

---

## Review Checklist

Before publishing, verify:

- [ ] No marketing fluff or superlatives
- [ ] Active voice throughout
- [ ] Correct product/technical terms
- [ ] Both ET and EN versions complete
- [ ] Dates in correct format
- [ ] Version numbers accurate
- [ ] Screenshots are current
- [ ] Links work

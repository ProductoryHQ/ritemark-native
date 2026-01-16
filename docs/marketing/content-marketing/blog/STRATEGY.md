# RiteMark Blog Strategy

**Version:** Draft 1.0
**Date:** 2026-01-16
**Status:** Awaiting Jarmo approval

---

## 1. Blog Purpose and Goals

### Primary Purpose

Establish RiteMark as the go-to choice for writers who value simplicity, privacy, and ownership of their work.

### Goals

| Goal | Metric | Target |
|------|--------|--------|
| Organic discovery | Search impressions | Growth over 6 months |
| Product awareness | Blog to download conversion | Track via UTM |
| Authority building | Backlinks, mentions | Qualitative |
| User education | Support ticket reduction | Fewer "how to" questions |

### What the Blog is NOT

- Not a personal blog (Jarmo's voice, but product-focused)
- Not a news site (no pressure to comment on every trend)
- Not documentation (docs live separately)

---

## 2. Target Audience Personas

### Persona 1: The Privacy-Conscious Writer

**Name:** Mari (ET) / Sarah (EN)
**Role:** Freelance writer, journalist, or author
**Pain points:**
- Distrusts cloud services with her work
- Wants her files to stay on her computer
- Tired of subscription fatigue

**Content she wants:**
- How local-first works
- Comparison with cloud alternatives
- Privacy-focused writing workflows

### Persona 2: The Markdown Enthusiast

**Name:** Kristjan (ET) / David (EN)
**Role:** Developer, technical writer, knowledge worker
**Pain points:**
- Loves Markdown but wants a better editor than plain text
- Wants clean formatting without fighting with Word
- Needs to export to multiple formats

**Content he wants:**
- Markdown tips and tricks
- Export workflows (PDF, Word)
- Power user features

### Persona 3: The Simplicity Seeker

**Name:** Liis (ET) / Emma (EN)
**Role:** Blogger, content creator, student
**Pain points:**
- Overwhelmed by complex tools
- Just wants to write without distractions
- Needs something that "just works"

**Content she wants:**
- Simple how-to guides
- Before/after comparisons (complexity vs simplicity)
- Getting started content

---

## 3. Content Pillars

Four main categories that all content maps to:

### Pillar 1: Product Updates

**What:** Release notes, new features, roadmap updates
**Frequency:** Per release (roughly monthly)
**Examples:**
- "RiteMark 1.5: What's New"
- "Coming Soon: Windows Support"

### Pillar 2: Writing Better

**What:** Tips for better writing, not just tool usage
**Frequency:** 1-2 per month
**Examples:**
- "Why Markdown Makes You a Better Writer"
- "Distraction-Free Writing: A Practical Guide"

### Pillar 3: Local-First Philosophy

**What:** Why local-first matters, privacy, data ownership
**Frequency:** 1 per month
**Examples:**
- "Your Words, Your Files: The Case for Local-First"
- "What Happens to Your Writing When Cloud Services Shut Down?"

### Pillar 4: Tutorials and How-Tos

**What:** Practical guides for using RiteMark
**Frequency:** As needed
**Examples:**
- "Exporting to PDF: A Complete Guide"
- "Working with Spreadsheets in RiteMark"

---

## 4. Topic Backlog (Initial Ideas)

### Phase 1: Foundational Posts (Start Here)

These posts establish what RiteMark is and why it exists. **Must publish before other content.**

| # | Title | Angle | Priority |
|---|-------|-------|----------|
| 1 | Why We Built RiteMark | Origin story - what problem we're solving, the journey | **FIRST** |
| 2 | Why Local-First Matters for AI Writing | Why cloud editors fail with AI agents, local files + AI = power | **SECOND** |
| 3 | What is RiteMark? | Product explainer - VS Code foundation, markdown native, local-first | **THIRD** |

### Phase 2: Differentiation Posts

Why RiteMark over alternatives? Position against competitors.

| # | Title | Pillar | Priority |
|---|-------|--------|----------|
| 4 | RiteMark vs Google Docs: An Honest Comparison | Philosophy | High |
| 5 | RiteMark vs Notion: When Local Beats Cloud | Philosophy | High |
| 6 | Why Not Just Use VS Code? | Philosophy | Medium |
| 7 | The Hidden Cost of "Free" Cloud Writing Tools | Philosophy | Medium |

### Phase 3: Evergreen Content

| # | Title | Pillar | Priority |
|---|-------|--------|----------|
| 8 | Markdown for Beginners: Everything You Need to Know | Tutorial | High |
| 9 | Exporting Your Work: PDF, Word, and Beyond | Tutorial | High |
| 10 | How to Build a Personal Knowledge Base with Markdown | Tutorial | Medium |
| 11 | Writing Without Distractions: A Minimalist Approach | Writing | Medium |
| 12 | Why Writers Should Own Their Files | Philosophy | Medium |
| 13 | Keyboard Shortcuts That Will Speed Up Your Writing | Tutorial | Low |
| 14 | From Idea to Published: A Complete Writing Workflow | Writing | Medium |

### Release-Triggered Content

| Trigger | Post Type | Example |
|---------|-----------|---------|
| Major release | Deep dive blog post | "RiteMark 2.0: The Full Story" |
| Minor release | Release notes + brief post | "What's New in 1.6" |
| Patch release | No blog post (changelog only) | - |
| New platform | Announcement post | "RiteMark is Now on Windows" |

### Seasonal/Timely Content

| Timing | Topic | Pillar |
|--------|-------|--------|
| January | "Fresh Start: Organize Your Writing This Year" | Writing |
| Data Privacy Day (Jan 28) | "Your Data, Your Control" | Philosophy |
| Back to School | "A Student's Guide to Markdown Notes" | Tutorial |
| NaNoWriMo (November) | "Write Your Novel with RiteMark" | Writing |

---

## 5. Posting Frequency Recommendation

### Proposed Cadence

| Content Type | Frequency | Annual Total |
|--------------|-----------|--------------|
| Release posts | Per release (~8/year) | 8 |
| Evergreen content | 2 per month | 24 |
| Timely/seasonal | 4 per year | 4 |
| **Total** | | **~36 posts/year** |

### Realistic Starting Point

**Phase 1 (Months 1-3):** 2 posts per month
- 1 evergreen piece
- Release posts as needed

**Phase 2 (Months 4-6):** 3 posts per month
- Increase if momentum builds

**Phase 3 (Month 7+):** Evaluate and adjust

### Quality Over Quantity

Better to publish one excellent post than three mediocre ones. Skip a month rather than publish filler.

---

## 6. Release Content to Blog Workflow

How product releases feed into blog content:

```
Release Happens
      |
      v
product-marketer creates:
  - docs/marketing/releases/vX.X.X/changelog.md
  - docs/marketing/releases/vX.X.X/release-notes.md
  - docs/marketing/releases/vX.X.X/blog/et.md (if warranted)
  - docs/marketing/releases/vX.X.X/blog/en.md (if warranted)
      |
      v
Jarmo reviews content
      |
      v
productory-2026 agent publishes:
  - Blog post (if created)
  - Updates landing page version
```

### Which Releases Get Blog Posts?

| Release Type | Blog Post? | Content Depth |
|--------------|------------|---------------|
| Major (X.0.0) | Yes, always | Full feature story, screenshots, use cases |
| Minor (X.X.0) | Usually | Highlight key features, brief |
| Patch (X.X.X) | No | Changelog entry only |
| Extension-only | Rarely | Only if significant feature |

---

## 7. Content Workflow

### Strategy: English in This Repo → Copywriter Imports

```
product-marketer (this repo)
      |
      v
Writes blog post in English
  → docs/marketing/content-marketing/blog/posts/[slug].md
      |
      v
Jarmo reviews and approves
      |
      v
copywriter agent (productory-2026)
      |
      v
Imports content to RiteMark site
  - Creates Estonian version if needed
  - Publishes to ritemark.ee/blog/
```

### What We Write Here

| Content | Language | Location |
|---------|----------|----------|
| All blog posts | English | `blog/posts/[slug].md` |
| Release posts | English | `releases/vX.X.X/blog.md` |

### What productory-2026 Does

- Imports English content from this repo
- Creates Estonian translations (via copywriter agent)
- Publishes to website
- Handles SEO, images, formatting for web

---

## 8. Success Metrics

### Quantitative

| Metric | Tool | Review Frequency |
|--------|------|------------------|
| Page views | Analytics | Monthly |
| Time on page | Analytics | Monthly |
| Blog to download | UTM tracking | Monthly |
| Search rankings | Search Console | Quarterly |

### Qualitative

- Are we getting mentioned/linked?
- Are support questions decreasing?
- User feedback on content

---

## 9. Content Guidelines

### Voice and Tone

- **Helpful, not salesy** - Educate first, mention product naturally
- **Honest** - Acknowledge limitations, don't oversell
- **Clear** - No jargon unless explained
- **Respectful** - Reader's time is valuable

### Post Structure

1. **Hook** - Why should reader care? (1-2 sentences)
2. **Context** - What's the situation? (1 paragraph)
3. **Content** - The actual value (bulk of post)
4. **Action** - What can reader do next? (soft CTA)

### Formatting

- Short paragraphs (2-4 sentences)
- Subheadings every 200-300 words
- Lists for scannable content
- Images/screenshots where helpful
- Code blocks for any technical content

---

## 10. Open Questions for Jarmo

1. **Frequency:** Is 2 posts/month realistic given other priorities?
2. **Voice:** Should posts be "Jarmo writing" or "RiteMark team"?
3. **Guest content:** Open to guest posts in the future?
4. **Newsletter:** Should blog tie into email newsletter later?

---

## Approval Request

This strategy document outlines the proposed approach for RiteMark's blog.

**To proceed with blog setup and content creation, please confirm:**

- [ ] Overall direction approved
- [ ] Posting frequency acceptable
- [ ] Content pillars make sense
- [ ] Topic backlog looks good
- [x] Workflow clarified (English here → copywriter imports to site)

**Awaiting:** Jarmo's approval before any blog post writing begins.

# Copywriter Handover: "Text, Data, Flow" Website Update

**Date:** 2026-02-02
**Version:** 1.2.0
**Priority:** High - aligns with v1.2.0 release messaging

---

## Executive Summary

Ritemark is repositioning from "a WYSIWYG markdown editor" to **"three editors in one app"**. The website needs to reflect this new identity.

**New tagline:** "Three editors. One app. Text, Data, Flow."

---

## The Core Message

### Before (Old Positioning)
> "A beautiful WYSIWYG markdown editor for your desktop."

### After (New Positioning)
> "Three editors. One app. Text, Data, Flow."

### Why the Change
With v1.2.0, Ritemark now has three distinct modes:
- **Text** - The original markdown editor
- **Data** - Spreadsheet/CSV editing (added in v1.1.0)
- **Flow** - Visual AI workflows (added in v1.2.0)

This isn't just a markdown editor anymore. It's a complete content creation environment.

---

## The Three Modes - Detailed Copy

### Text Mode

**Purpose:** Writing and editing markdown documents

**English Copy:**
> WYSIWYG markdown editor. Write in rich text, save as clean markdown. No more switching between preview and edit modes.

**Estonian Copy:**
> WYSIWYG markdowni redaktor. Kirjuta rikkas tekstis, salvesta puhta markdownina. Enam pole vaja vahetada eelvaate ja redigeerimisrežiimi vahel.

**Key Features:**
- True WYSIWYG editing
- Slash commands (`/` to insert)
- AI writing assistant
- Voice dictation (macOS only)
- PDF and Word export
- Clean markdown output

**Target User Feeling:** "Finally, markdown that doesn't feel like code."

---

### Data Mode

**Purpose:** Working with structured data alongside documents

**English Copy:**
> Spreadsheets and structure. Edit CSV files with inline cells. Preview Excel files. Manage YAML front-matter.

**Estonian Copy:**
> Tabelid ja struktuur. Muuda CSV faile otse lahtrites. Vaata Excel faile. Halda YAML metaandmeid.

**Key Features:**
- CSV inline editing
- Excel file preview (.xlsx, .xls)
- YAML front-matter editor
- Auto-refresh when files change

**Target User Feeling:** "My data lives alongside my docs, not in a separate app."

---

### Flow Mode

**Purpose:** Automating repetitive AI tasks

**English Copy:**
> Visual AI automation. Connect nodes, run flows, generate content automatically. Build once, run anytime.

**Estonian Copy:**
> Visuaalne AI automatiseerimine. Ühenda sõlmed, käivita voogusid, genereeri sisu automaatselt. Ehita üks kord, käivita igal ajal.

**Key Features:**
- Drag-and-drop workflow editor
- LLM nodes (GPT-4o, etc.)
- Image generation nodes
- Save to file nodes
- Reusable workflows

**Target User Feeling:** "I automated my entire content pipeline in 10 minutes."

---

## Suggested Website Structure

### Hero Section

**Headline Options:**
1. "Three Editors. One App." (recommended)
2. "Text. Data. Flow."
3. "Write. Structure. Automate."

**Subheadline:**
> Everything you need for writing, structured data, and AI automation—in one local-first app.

**CTA:** Download for macOS / Download for Windows

---

### Three Pillars Section

Display as three equal cards/columns:

| Text | Data | Flow |
|------|------|------|
| WYSIWYG markdown editor | Spreadsheets built-in | Visual AI workflows |
| Write in rich text, save as clean markdown | Edit CSV, preview Excel, manage metadata | Connect nodes, generate content automatically |
| [Icon: PenLine] | [Icon: Table2] | [Icon: Workflow] + NEW badge |

---

### Features Section

Reorganize existing features under their mode:

**Text Mode Features:**
- WYSIWYG Markdown Editor
- AI Writing Assistant
- Voice Dictation (NEW badge, macOS only note)
- Slash Commands
- PDF & Word Export

**Data Mode Features:**
- CSV Editing
- Excel Preview
- YAML Front-matter

**Flow Mode Features:**
- Visual Workflow Editor (NEW badge)
- LLM Nodes
- Image Generation
- File Output

**Cross-Cutting:**
- Local-First Privacy
- No Account Required
- Dark Mode

---

## Tone & Voice Guidelines

### Do:
- Use short, parallel phrases: "Text, Data, Flow"
- Emphasize the "three in one" value proposition
- Highlight local-first/privacy benefits
- Be concrete about what each mode does

### Don't:
- Call it "just a markdown editor" anymore
- Use technical jargon (no "YAML" in headlines)
- Oversell AI capabilities
- Promise features that require paid APIs without mentioning it

---

## Key URLs

**Downloads (correct URLs):**
- macOS: `https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark.dmg`
- Windows: `https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-Setup.exe`

**Note:** Old URLs may reference `ritemark-native` - these should be `ritemark-public`.

---

## Translation Notes (Estonian)

| English | Estonian |
|---------|----------|
| Text | Tekst |
| Data | Andmed |
| Flow | Voog |
| Three Editors. One App. | Kolm redaktorit. Üks rakendus. |
| Write. Structure. Automate. | Kirjuta. Struktureeri. Automatiseeri. |
| Local-first | Lokaalne-esmalt / Privaatsus esikohal |
| WYSIWYG | WYSIWYG (keep as-is, it's an industry term) |

---

## Screenshot Needs

The following screenshots are needed for the website:

- [ ] **Hero image:** Show all three modes in one frame (split screen or animation)
- [ ] **Text mode:** Editor with formatted content, slash command menu visible
- [ ] **Data mode:** CSV file open with inline editing, refresh badge visible
- [ ] **Flow mode:** Flow editor with connected nodes (Trigger → LLM → Save File)
- [ ] **Voice dictation:** Mic button active in toolbar with streaming text

---

## Reference Materials

These files contain the approved copy and detailed feature descriptions:

| Document | Location |
|----------|----------|
| Main README | `/README.md` |
| Feature documentation | `/docs/features/README.md` |
| Flows documentation | `/docs/features/flows.md` |
| Release notes | `/docs/marketing/releases/v1.2.0/release-notes.md` |
| Social media copy | `/docs/marketing/releases/v1.2.0/social.md` |
| Landing page features | `/docs/marketing/landing-page/features.md` |

---

## Questions for Jarmo

Before finalizing website copy:

1. Should we keep "Ritemark" as one word or style it as "RiteMark"?
2. Do we want to mention the OpenAI API key requirement prominently, or keep it in small print?
3. Is "Three editors. One app." the final tagline, or should we A/B test alternatives?
4. Should Flow mode be positioned as a "pro" feature or equally alongside Text/Data?

---

## Checklist for Website Update

- [ ] Update hero section with new tagline
- [ ] Add three pillars section
- [ ] Reorganize features by mode
- [ ] Update download URLs to ritemark-public
- [ ] Add Flow mode to feature list with NEW badge
- [ ] Update Estonian translations
- [ ] Add/update screenshots
- [ ] Test all download links
- [ ] Update meta description for SEO
- [ ] Update Open Graph tags for social sharing

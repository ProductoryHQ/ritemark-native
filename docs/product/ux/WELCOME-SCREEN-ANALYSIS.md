# Welcome Screen UX Analysis

**Date:** 2026-01-18
**Context:** Analyzing the first-run experience for new RiteMark users
**Key Assumption:** 95% of users seeing this screen are NEW users

---

## The User Journey Context

Before analyzing the screen itself, we need to understand what happened before the user got here:

```
ProductHunt/Discovery → Read pitch → Convinced to download →
200MB+ download → macOS Gatekeeper warnings → Launch →
THIS SCREEN (with high expectations)
```

### User Mental State on Arrival

A new user arrives thinking:
- "OK, I downloaded it. Now show me why this is special."
- "What can this do that VS Code/Obsidian/iA Writer can't?"
- "Was this worth the download?"

**Critical insight:** They're still in **evaluation mode**, not "ready to work" mode.

---

## Current Welcome Screen Audit

### What's Currently Shown

| Element | Content |
|---------|---------|
| Logo | RiteMark icon with "RITEMARK" text |
| Subtitle | "BY PRODUCTORY" |
| Tagline | "Write smarter. Think faster." |
| START section | "New Document" and "Open..." buttons |
| RECENT section | List of recent folders/projects |
| Footer | "Show welcome page on startup" checkbox |

### Screenshot Reference

![Welcome Screen](../../../screenshots/welcome-screen-2026-01-18.png)

---

## Gap Analysis

### Unanswered Questions (New User Perspective)

| Question | Current Answer |
|----------|----------------|
| What makes RiteMark different? | None - just a generic tagline |
| What are the key features? | Not shown |
| How do I use AI features? | Not mentioned |
| Is there a tutorial? | Not offered |
| What does a document look like? | Not previewed |
| Where are my files stored? | Not explained |
| What's Productory? | Unknown (creates confusion) |
| Is this local-first/private? | Not communicated |

### Missing First-Run Experience Elements

1. **No feature discovery** - User doesn't know what they installed
2. **No onboarding path** - Just "New Document" with no guidance
3. **No sample content** - Nothing to explore immediately
4. **No quick wins** - Can't experience value in first 60 seconds
5. **No trust signals** - Local-first, privacy not mentioned
6. **No help path** - Where do they go if confused?

### Specific Problems

#### Problem 1: Generic Tagline
"Write smarter. Think faster." could describe literally any writing app. It doesn't communicate what makes RiteMark unique.

#### Problem 2: Empty RECENT Section (First Run)
For new users, the RECENT section is empty or shows unrelated folders. This emphasizes "you've done nothing here" rather than inviting exploration.

#### Problem 3: "BY PRODUCTORY" Confusion
95% of users have no idea what Productory is. This creates cognitive load and questions instead of building trust.

#### Problem 4: Blank Page Anxiety
Clicking "New Document" leads to a blank page. New users don't know:
- What features are available
- How to access AI
- What keyboard shortcuts exist
- What makes this different from TextEdit

#### Problem 5: No Path to First Success
There's no guided path to help users experience RiteMark's value. They must figure it out themselves.

---

## Recommendations

### Priority 1: Sample Documents (Highest Impact)

Replace the empty RECENT area (for first-run only) with discoverable sample content:

```
DISCOVER RITEMARK

[Sample: Meeting Notes]     [Sample: Project Brief]     [Sample: Blog Post]
   See AI in action           Try markdown tables         Voice dictation demo
```

**Why this works:**
- Immediate value demonstration
- User can explore without commitment
- Shows features in context
- Reduces blank page anxiety

### Priority 2: Feature Highlights

Add key differentiators below the tagline:

```
Write smarter. Think faster.

AI-powered editing  •  Voice dictation  •  100% local & private  •  Beautiful exports
```

**Why this works:**
- Immediately answers "why this app?"
- Reinforces the value proposition from marketing
- No additional clicks required

### Priority 3: First-Run Document Template

When a user clicks "New Document" for the **first time**:

**Option A: Pre-populated template**
```markdown
# Welcome to RiteMark

Try these features:
- Select this text and press **Cmd+K** for AI assistance
- Type `/` for slash commands
- Press **Cmd+Shift+V** for voice dictation

Start writing below...
```

**Option B: Template chooser**
```
Start with:
[Blank Document]  [Meeting Notes]  [Project Brief]  [Blog Post]
```

**Why this works:**
- Guides users to first success
- Demonstrates features in context
- Reduces "now what?" moment

### Priority 4: Quick Start Guide (Optional Path)

Add a third option in the START section:

```
START
[New Document]  [Open...]  [Take the 2-min tour →]
```

The tour could be:
- A sample document with interactive hints
- Progressive tooltips on first document
- A short guided walkthrough

### Priority 5: Remove "BY PRODUCTORY"

Options:
1. Remove entirely from welcome screen
2. Move to About/Settings
3. Replace with: "Made in Estonia" (adds personality)
4. Replace with trust signal: "100% local & private"

---

## Competitive Analysis

| App | First-Run Approach | Applicable Lesson |
|-----|-------------------|-------------------|
| Notion | Sample workspace with examples | Pre-loaded sample documents |
| Figma | Interactive tutorial | Guided first experience |
| Linear | Feature highlights on welcome | Key differentiators visible |
| Obsidian | Clear "Open folder" + "Create vault" | Local-first messaging |
| Raycast | "Press X to try" immediate action | AI hotkey hint on welcome |
| iA Writer | Minimal but focused | Clean, clear value prop |
| Bear | Sample notes included | Immediate content to explore |

### Key Patterns from Successful Apps

1. **Show, don't tell** - Let users experience features, not read about them
2. **Reduce time to first value** - Under 60 seconds to "aha moment"
3. **Guide without forcing** - Optional onboarding, not mandatory
4. **Reinforce the pitch** - Welcome screen echoes marketing promises

---

## Implementation Suggestions

### Phase 1: Quick Wins (Low Effort)

1. Add feature highlights below tagline
2. Add "Cmd+K for AI" hint somewhere visible
3. Consider removing "BY PRODUCTORY"

### Phase 2: Sample Documents (Medium Effort)

1. Create 3-4 sample documents showcasing features
2. Show sample documents for first-run users
3. Include interactive elements (try AI, try voice, etc.)

### Phase 3: Guided Onboarding (Higher Effort)

1. First-run document template with hints
2. Progressive tooltip system
3. Optional "Take a tour" flow

---

## Success Metrics

How to measure if changes work:

| Metric | Current (Est.) | Target |
|--------|----------------|--------|
| Time to first document edit | Unknown | < 30 seconds |
| First-session AI feature usage | Low | 50%+ try AI |
| Day 1 retention | Unknown | Increase by 20% |
| "Blank page" drop-off | High | Reduce by 50% |

---

## Summary

The current welcome screen is **functional but not persuasive**. It assumes the sale is already made.

For ProductHunt traffic (high curiosity, low commitment), the screen needs to:

1. **Reinforce the value proposition** - Why RiteMark? (not just "write smarter")
2. **Provide a path to first success** - Within 60 seconds
3. **Show, don't tell** - Let users experience features immediately

**The goal:** Get users from "I downloaded this" to "Oh wow, this is good" as fast as possible.

Currently, users must figure out RiteMark's value entirely on their own.

---

## Appendix: Mockup Ideas

### Welcome Screen Redesign (Conceptual)

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│              [RiteMark Logo]                               │
│                                                            │
│           Write smarter. Think faster.                     │
│                                                            │
│   AI-powered  •  Voice dictation  •  100% local & private  │
│                                                            │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  New Document   │  │     Open...     │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                            │
│  ─────────────────────────────────────────────────────     │
│                                                            │
│  DISCOVER RITEMARK                                         │
│                                                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ Meeting Notes│ │ Project Brief│ │  Blog Post   │       │
│  │ Try AI assist│ │ See tables   │ │ Voice demo   │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                            │
│  ─────────────────────────────────────────────────────     │
│                                                            │
│  RECENT                                                    │
│  [recent files list...]                                    │
│                                                            │
│  ─────────────────────────────────────────────────────     │
│                                                            │
│  [ ] Show welcome page on startup                          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### First-Run Document Template

```markdown
# Welcome to RiteMark!

You're using a **local-first** markdown editor with AI superpowers.

## Try These Features

### AI Assistance
Select this paragraph and press **Cmd+K** to:
- Improve the writing
- Translate to another language
- Summarize or expand

### Voice Dictation
Press **Cmd+Shift+V** to start dictating. Works offline!

### Slash Commands
Type `/` anywhere to see available commands.

---

Delete this content and start writing, or explore the samples above.
```

---

*Document created: 2026-01-18*
*Author: Product Marketing Analysis*

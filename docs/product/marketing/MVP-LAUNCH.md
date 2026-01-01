# RiteMark Native - Minimum Viable Launch

**Goal:** Find 10 real users. Learn if this matters.

---

## The Problem We Solve

**The copy-paste hell:**
1. Write in Word/Docs/Notion
2. Copy text to ChatGPT/Claude
3. Get suggestions
4. Copy back to document
5. Repeat 50 times a day

**The deeper problem:** AI chat interfaces can *suggest* text, but they can't *edit* your files directly.

**The breakthrough:** Terminal-based agents (Claude Code, Codex CLI, Gemini CLI, Aider) don't suggest—they edit. They can read your file, change it, save it.

**What RiteMark solves:** A clean writing environment with a built-in terminal. Your AI agent can actually work on your documents. Not suggestions in a sidebar. Direct edits you approve.

---

## The Pitch (Problem-Focused)

**One-liner:**
> "Write with AI that can actually edit your files."

**Elevator:**
> Most AI tools give you suggestions to copy-paste. Terminal-based agents can edit directly. RiteMark gives you a writing app with a built-in terminal—so your AI works right in your documents. Local files. Any agent. One window.

**The key difference:**

| Approach | What Happens |
|----------|--------------|
| ChatGPT/Claude web | AI suggests → you copy-paste → repeat forever |
| Notion AI / Copilot | AI suggests → cloud-only → vendor lock-in |
| **RiteMark + any agent** | AI edits your file directly → you review → done |

---

## What We Need

### 1. Landing Page (1 hour to build)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  RiteMark Native                                            │
│                                                             │
│  Write with AI that can actually edit your files.           │
│                                                             │
│  [Download for macOS] ← Big button                          │
│                                                             │
│  ▶ Watch: See it work (10 sec)                              │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Stop copying between ChatGPT and your documents.           │
│                                                             │
│  RiteMark has a built-in terminal. Your AI agent            │
│  can read, edit, and save your files directly.              │
│                                                             │
│  Works with Claude Code, Codex CLI, Gemini CLI, Aider.      │
│  Local files. Any agent. One window.                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Hosting options:**
- GitHub Pages (free, 5 min setup)
- Carrd.co ($19/year, drag-drop)
- Notion public page (free, 2 min)

**Minimum content:**
- One headline
- One download button
- One video embed
- One sentence explaining the value

---

### 2. Video Script (10 seconds)

**Visual:** Screen recording, no talking head, just action.

```
[0-2s] Document open in RiteMark
       Text overlay: "Stop copying to ChatGPT"

[2-4s] Open terminal (Cmd+`)
       Text overlay: "Built-in terminal"

[4-7s] Type command, AI starts editing
       Text overlay: "AI edits your file directly"

[7-10s] Document updates, user reviews
        Text overlay: "Local files. Any agent. One window."
```

**The point:** Show the PROBLEM being solved (no more copy-paste), not which tool.

**Music:** None or subtle click sounds
**Format:** MP4, 1080p, can be GIF for Twitter
**Tools:** QuickTime screen record → trim in iMovie/ScreenFlow

---

### 3. Getting Started Flow

**Principle:** Show that it works with ANY terminal-based agent. User picks their preferred one.

**Installation (for landing page):**

```markdown
## Get Started

1. Download RiteMark Native
2. Install your preferred AI agent:
   - Claude Code: npm install -g @anthropic-ai/claude-code
   - Codex CLI: npm install -g @openai/codex
   - Gemini CLI: npm install -g @google/gemini-cli
   - Aider: pip install aider-chat
3. Open any .md file
4. Press Cmd+` to open terminal
5. Ask your AI to edit the document

That's it. AI edits directly. You review.
```

**For the video:** Pick whichever agent you have installed. The demo works the same regardless.

---

### 4. Where to Find 10 Users

**Best channels (effort vs. quality):**

| Channel | Effort | User Quality | How |
|---------|--------|--------------|-----|
| **Personal network** | Low | High | DM people you know who write |
| **Twitter/X** | Low | Medium | Post video, ask for feedback |
| **r/ChatGPT** | Medium | High | "I built an editor for Codex CLI" |
| **Indie Hackers** | Medium | High | "Looking for beta testers" |
| **Claude Discord** | Low | High | If you're active there |

**Skip for now:**
- ProductHunt (save for real launch)
- Hacker News (save for real launch)
- LinkedIn (too broad)
- Paid ads (too early)

**Outreach template:**

```
Hey [name],

I built a markdown editor that works with Codex CLI / Claude Code.

Basically: your AI subscription + a clean writing app.

Looking for 10 people to try it and tell me if it's useful or garbage.

Interested? Takes 5 min to set up.

[link]
```

---

### 5. What to Learn from 10 Users

**Ask these questions:**

1. Did you get it working? (If no, why?)
2. What did you try to write?
3. Did you use it again after the first time?
4. What's missing?
5. Would you recommend it to someone?

**Watch for:**
- Where do they get stuck?
- What do they try that doesn't work?
- Do they come back without being asked?

**Success signals:**
- User comes back on their own
- User tells someone else
- User asks for a feature (means they care)

**Failure signals:**
- Can't get it working
- Uses once, never returns
- "Cool" but no follow-up

---

### 6. Minimum Viable Stack

| Component | Choice | Why |
|-----------|--------|-----|
| **Landing page** | GitHub Pages or Carrd | Free, fast |
| **Download** | GitHub Releases | Free, trusted |
| **Video** | Embedded MP4 or YouTube unlisted | Simple |
| **Analytics** | None (ask users directly) | Too early for metrics |
| **Support** | Your email or Twitter DM | Personal |

**Total cost:** $0-19
**Total time:** 2-4 hours

---

### 7. Launch Checklist (Minimal)

**Before sharing:**
- [ ] DMG works (test on clean Mac)
- [ ] Landing page live
- [ ] 10-second video recorded
- [ ] Codex CLI instructions clear
- [ ] Your email/contact visible

**Day 1:**
- [ ] Share with 5 people you know personally
- [ ] Post on Twitter with video
- [ ] Post in 1-2 relevant communities

**Day 2-7:**
- [ ] Follow up with everyone who downloaded
- [ ] Ask the 5 questions
- [ ] Take notes on what you learn

**Day 7 decision:**
- Did 3+ people come back on their own? → Keep going
- Did everyone bounce? → Pivot or kill

---

### 8. What NOT to Do Yet

- ❌ ProductHunt launch
- ❌ Press outreach
- ❌ Content marketing
- ❌ Fancy analytics
- ❌ Multiple landing pages
- ❌ A/B testing
- ❌ Email list
- ❌ Social media strategy
- ❌ Brand guidelines enforcement
- ❌ Competitive positioning

**All of that comes after you find 10 people who care.**

---

### 9. The Positioning That Works

**Lead with the problem, not the tool.**

**Bad pitches (tool-focused):**
- "Claude Code, but for writing" ← assumes Claude familiarity
- "You have ChatGPT? Now you have an editor for it" ← focuses on tool

**Good pitch (problem-focused):**
- "Write with AI that can actually edit your files"
- "Stop copying between ChatGPT and your documents"
- "One window for writing and AI editing"

**The conversation:**
> "Do you use AI to help with writing?"
> "Yes, but I spend half my time copying back and forth"
> "What if AI could edit your document directly?"
> "How?"
> "Terminal-based agents can. Here's an editor built for that."

**Why this works:** You're solving a pain they already have, not selling a tool they need to learn about.

---

## Summary

| What | Time | Cost |
|------|------|------|
| Landing page | 1-2 hours | $0-19 |
| 10-sec video | 30 min | $0 |
| GitHub Release | Already done | $0 |
| Find 10 users | 1 week | $0 |
| **Total** | **~1 week** | **$0-19** |

**The only question that matters:**
Do 3+ of those 10 people come back without being asked?

If yes: You have something.
If no: Learn why and decide.

---

*"Find 10 people who care. Everything else is noise."*

# Ritemark Landing Page — Complete Handoff

**For:** Another Claude Code instance building the landing page
**Hosting:** Netlify (productory.ai)
**Goal:** 10-100 downloads from people who get it

---

## Quick Summary

Ritemark is a markdown editor with a built-in terminal. Your AI agent (Claude Code, Codex, Gemini CLI, Aider) can edit your files directly. No more copy-pasting between ChatGPT and your documents.

**The core problem we solve:**
> I got tired of copying text between ChatGPT and my documents.

**What it is:**
> A markdown editor with a terminal inside.

---

## 1. Approved Copywriting

Use this copy verbatim. Voice is personal, first-person (Jarmo speaking). Basecamp-style: direct, no hype, says what it is.

### Hero Section

```
RITEMARK

I got tired of copying text between ChatGPT and my documents.

Every time I wanted AI to help me write, the same thing happened:
copy my text, paste it into ChatGPT, get a suggestion, copy it back,
paste it into my document. Over and over. Dozens of times a day.

So I built Ritemark.

It's a markdown editor with a terminal inside. You open your document,
press Cmd+`, and your AI is right there. Claude Code, Codex, Gemini CLI,
Aider—whatever you use. It reads your file, edits it, saves it. You review.

No copying. No pasting. No switching windows.

Your files stay on your machine. Works offline. Plain markdown.

[Download for macOS]
```

### After the CTA (Bottom Section)

```
That's it. A text editor with a terminal.

If you already pay for ChatGPT or Claude, you have everything you need.
Ritemark just gives you a better place to use it.

Apple Silicon · macOS 11+
```

### How It Works (Optional Section)

If you want a "How it works" section, use this:

```
How it works:
1. Open a markdown file
2. Press Cmd+` for terminal
3. Tell your AI what to change
4. It edits. You review.
```

---

## 2. Page Layout (Wireframe)

Single-page, minimal. Scroll reveals content. No navigation menu needed.

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│                       RITEMARK                         │  ← Logo/wordmark
│                                                        │
│   I got tired of copying text between ChatGPT         │  ← Headline (large)
│   and my documents.                                    │
│                                                        │
│   [Body text - the personal story - 4-5 lines]        │  ← Paragraph
│                                                        │
│   So I built Ritemark.                                │  ← Transition
│                                                        │
│   [Explanation - what it is, what happens]            │  ← Paragraph
│                                                        │
│   No copying. No pasting. No switching windows.       │  ← Punchline
│                                                        │
│   Your files stay on your machine. Works offline.     │  ← Features (short)
│   Plain markdown.                                      │
│                                                        │
│              [ Download for macOS ]                    │  ← Primary CTA button
│                                                        │
│   ─────────────────────────────────────               │  ← Divider
│                                                        │
│   That's it. A text editor with a terminal.           │  ← Closing
│                                                        │
│   If you already pay for ChatGPT or Claude,           │
│   you have everything you need.                        │
│   Ritemark just gives you a better place to use it.   │
│                                                        │
│   Apple Silicon · macOS 11+                           │  ← System requirements
│                                                        │
│                                                        │
│   ─────────────────────────────────────               │
│                                                        │
│   Built by Jarmo Tuisk · Productory AI · Estonia      │  ← Footer
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Layout Rules

1. **Centered text** — Everything centered on page
2. **Max width** — Content max-width 600-700px (reading width)
3. **Generous whitespace** — Don't crowd it
4. **Single column** — No sidebars, no cards, no grid
5. **No images in MVP** — Copy-first. Add screenshot/video later if needed
6. **One CTA** — Single download button. Don't distract.

---

## 3. Visual Design Specifications

### Colors

| Element | Color | Hex |
|---------|-------|-----|
| Background | White or near-white | `#ffffff` or `#fafafa` |
| Text primary | Dark slate | `#1e293b` |
| Text secondary | Medium slate | `#64748b` |
| Accent (button, links) | Indigo | `#4338ca` |
| Button text | White | `#ffffff` |
| Divider | Light gray | `#e2e8f0` |

### Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Logo/wordmark | Space Grotesk | 24-32px | 700 |
| Headline | Space Grotesk | 28-36px | 600 |
| Body text | System stack or Inter | 18-20px | 400 |
| Small text (requirements) | Same as body | 14-16px | 400 |

**Font stack fallback:**
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

**Headline font:**
```css
font-family: 'Space Grotesk', -apple-system, sans-serif;
```

### Button Style

```css
.download-button {
  background: #4338ca;
  color: white;
  padding: 16px 32px;
  border-radius: 8px;
  font-size: 18px;
  font-weight: 600;
  border: none;
  cursor: pointer;
}

.download-button:hover {
  background: #3730a3;
}
```

---

## 4. Technical Requirements

### Hosting

- **Platform:** Netlify
- **Domain:** productory.ai (subdomain or path TBD)
- **SSL:** Automatic via Netlify

### Stack (Recommendations)

Keep it simple. Any of these work:

| Option | Pros |
|--------|------|
| Static HTML/CSS | Simplest, fastest, no build step |
| Astro | Good if you want components, still outputs static |
| Next.js static export | If you're comfortable with React |

**Recommendation:** Plain HTML/CSS. It's a single page. Don't over-engineer.

### File Structure (if plain HTML)

```
/
├── index.html
├── styles.css
├── ritemark.dmg          (or link to GitHub releases)
└── assets/
    └── og-image.png      (for social sharing)
```

### Meta Tags (SEO + Social)

```html
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ritemark — Markdown editor with terminal inside</title>
  <meta name="description" content="A markdown editor with a built-in terminal. Your AI edits your files directly. No more copy-paste from ChatGPT.">

  <!-- Open Graph -->
  <meta property="og:title" content="Ritemark">
  <meta property="og:description" content="I got tired of copying text between ChatGPT and my documents. So I built Ritemark.">
  <meta property="og:type" content="website">
  <meta property="og:image" content="/assets/og-image.png">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Ritemark">
  <meta name="twitter:description" content="Markdown editor with terminal inside. Your AI edits your files directly.">
</head>
```

### Download Link

For MVP, link to GitHub releases:
```html
<a href="https://github.com/jarmo-productory/ritemark/releases/latest/download/Ritemark.dmg">
  Download for macOS
</a>
```

(Adjust URL to actual release location)

---

## 5. Brand Voice Rules

### DO

- Use "I" voice (Jarmo speaking)
- Short sentences
- Specific situations, not abstract benefits
- Before/after, not feature lists
- Say exactly what it is

### DON'T

- Marketing superlatives ("revolutionary", "game-changing")
- Vague claims ("helps you write better")
- Feature bullet points in hero
- Multiple CTAs
- Emojis

### Examples

**Good:**
> I got tired of copying text between ChatGPT and my documents.

**Bad:**
> Ritemark is a revolutionary new way to supercharge your writing workflow.

---

## 6. Assets Needed

### Required

| Asset | Status | Notes |
|-------|--------|-------|
| Ritemark logo/wordmark | Needed | Simple text okay for MVP |
| OG image (1200x630) | Needed | For social sharing |
| DMG file or release URL | Needed | Actual download |

### Nice to Have (Not MVP)

| Asset | Notes |
|-------|-------|
| Screenshot of app | Can add after v1 |
| 10-second video | Shows terminal + editing |
| Favicon | 32x32, 16x16 |

---

## 7. Content Checklist

Before publishing:

- [ ] All copy matches approved text above
- [ ] Download link works
- [ ] Page loads fast (<2s)
- [ ] Looks good on mobile
- [ ] Meta tags are correct
- [ ] OG image shows when sharing

---

## 8. What NOT to Include (MVP)

- Navigation menu
- Multiple pages
- Contact form
- Newsletter signup
- Pricing section
- Feature comparison tables
- Testimonials (we don't have users yet)
- Analytics beyond basic Netlify

---

## 9. Example HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ritemark — Markdown editor with terminal inside</title>
  <meta name="description" content="A markdown editor with a built-in terminal. Your AI edits your files directly.">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main>
    <header>
      <h1 class="logo">RITEMARK</h1>
    </header>

    <section class="hero">
      <h2>I got tired of copying text between ChatGPT and my documents.</h2>

      <p>
        Every time I wanted AI to help me write, the same thing happened:
        copy my text, paste it into ChatGPT, get a suggestion, copy it back,
        paste it into my document. Over and over. Dozens of times a day.
      </p>

      <p><strong>So I built Ritemark.</strong></p>

      <p>
        It's a markdown editor with a terminal inside. You open your document,
        press Cmd+`, and your AI is right there. Claude Code, Codex, Gemini CLI,
        Aider—whatever you use. It reads your file, edits it, saves it. You review.
      </p>

      <p class="punchline">No copying. No pasting. No switching windows.</p>

      <p class="features">Your files stay on your machine. Works offline. Plain markdown.</p>

      <a href="https://github.com/jarmo-productory/ritemark/releases" class="download-button">
        Download for macOS
      </a>
    </section>

    <hr>

    <section class="closing">
      <p>That's it. A text editor with a terminal.</p>

      <p>
        If you already pay for ChatGPT or Claude, you have everything you need.<br>
        Ritemark just gives you a better place to use it.
      </p>

      <p class="requirements">Apple Silicon · macOS 11+</p>
    </section>

    <hr>

    <footer>
      <p>Built by Jarmo Tuisk · Productory AI · Estonia</p>
    </footer>
  </main>
</body>
</html>
```

---

## 10. Quick Reference Card

```
PRODUCT:     Ritemark
TAGLINE:     A markdown editor with a terminal inside
PROBLEM:     Copy-paste hell between ChatGPT and documents
SOLUTION:    Terminal-based AI agents edit files directly
TARGET:      People who already use Claude Code, Codex, etc.
VOICE:       Jarmo, first-person, Basecamp-style
CTA:         Download for macOS
PRICE:       Free (BYOA - Bring Your Own Agent)
PLATFORM:    macOS (Apple Silicon, 11+)
```

---

*End of handoff. Everything needed to build the landing page is in this document.*

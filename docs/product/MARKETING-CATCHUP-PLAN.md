# Marketing Catch-Up Plan for Ritemark

**Created:** 2026-01-14
**Status:** Awaiting Jarmo approval

---

## Executive Summary

Ritemark has shipped significant features that customers don't know about. The landing page focuses on "AI agents" but hides concrete value like PDF export, CSV editing, and offline mode.

**The Fix:**
1. Make "FREE" prominent
2. Add export/spreadsheet features visibly
3. Add trust signals for local-first
4. Create user documentation
5. Prepare launch content

---

## 1. Audit Summary

### Features Built (Not Marketed)

| Feature | Version | On Landing Page? |
|---------|---------|------------------|
| PDF Export | v1.0.1 | NO |
| Word Export | v1.0.1 | NO |
| CSV Editing | v1.0.1 | NO |
| Excel Preview | Unreleased | NO |
| Task Lists | v1.0.0 | Barely mentioned |
| Smart Paste | v1.0.0 | NO |
| Auto-save | v1.0.0 | NO |
| Offline Mode | v1.0.0 | Mentioned once |
| **FREE** | Always | NOT PROMINENT |

### What Customers Ask (That We Don't Answer)

| Customer Question | Current Answer | Problem |
|-------------------|----------------|---------|
| What IS this? | "Writing environment" | Too abstract |
| How much? | Not mentioned | FREE should be first thing they see |
| Is it safe? | Privacy Policy link | No trust signals |
| Works offline? | One line buried | Not emphasized |
| Export options? | Not mentioned | Major hidden feature |
| macOS only? | Mentioned | Windows status unclear |

---

## 2. Gap Analysis - Customer Perspective

### The Core Problem

**Landing page says:** "Sina motled. AI kirjutab." (You think. AI writes.)

**Customer thinks:** "What does that mean? Is this another AI writing tool?"

**What they need to hear:** "Markdown editor with built-in AI. Free. Local. Private."

### Hidden Value

These competitive advantages are invisible:

1. **PDF/Word Export** - One-click professional output
2. **CSV/Excel Viewing** - Open spreadsheets without Excel
3. **100% Local** - No account, no cloud, no tracking
4. **Offline Mode** - Works without internet
5. **Free** - No subscription, no payment

---

## 3. Priority-Ordered Action Plan

### Phase 1: Quick Wins (Critical)

**Goal:** Fix what loses potential users TODAY

| Task | Location | Effort |
|------|----------|--------|
| Add "Free" badge near download button | Landing page | 10 min |
| Add "Export to PDF/Word" feature card | Landing page | 30 min |
| Add "CSV/Excel preview" feature card | Landing page | 30 min |
| Add trust signals: "No account. No cloud. 100% local." | Landing page | 15 min |
| Clarify: "macOS now. Windows coming Q2 2026." | Landing page | 5 min |

**Screenshots needed:**
- [ ] PDF export in action
- [ ] CSV editing view
- [ ] Excel preview with sheet tabs

### Phase 2: Documentation (Important)

**Goal:** Answer customer questions

| Document | Purpose |
|----------|---------|
| `/docs/user-guide/GETTING-STARTED.md` | Non-technical onboarding |
| `/docs/user-guide/EXPORT-GUIDE.md` | How to export to PDF/Word |
| `/docs/user-guide/FAQ.md` | Common questions |

**FAQ Questions to Answer:**
1. Is Ritemark really free?
2. Why do I need to right-click to open? (notarization)
3. Does it work offline?
4. Where are my files stored?
5. Can I use it without AI?
6. When is Windows coming?
7. What is Markdown?

### Phase 3: Landing Page Improvements

**Goal:** Better conversion

| Section | Purpose |
|---------|---------|
| Use Cases | Concrete examples (blogger, consultant, student) |
| Before/After | Copy-paste hell vs. direct editing |
| Social Proof | Placeholder for testimonials |

### Phase 4: Launch Content

**Goal:** Prepare for broader marketing

| Content | Format |
|---------|--------|
| "Introducing Ritemark" | Blog post |
| "New: Export to PDF and Word" | Blog post |
| Demo video | 2-minute walkthrough |
| ProductHunt assets | Thumbnail, gallery, description |

---

## 4. Specific Content Recommendations

### Landing Page Hero Update

**Current:**
> Sina motled. AI kirjutab.

**Recommended:**
> Markdown editor with built-in AI terminal.
> Free. Local. Offline.

### Feature Cards to Add

**Card 1: Export Everywhere**
```
Icon: FileOutput
Title: "Export to PDF and Word"
Text: "One click to share with anyone. Clean formatting, professional output."
```

**Card 2: Spreadsheet Preview**
```
Icon: Table2
Title: "View CSV and Excel files"
Text: "Open spreadsheets directly. Edit CSV inline. No external app needed."
```

**Card 3: Offline-First**
```
Icon: WifiOff
Title: "Works without internet"
Text: "Your files on your machine. No cloud required. No account needed."
```

### Trust Signals (Near Download Button)

```
✓ No account required
✓ No subscription
✓ No cloud storage
✓ Your files stay on YOUR machine
```

---

## 5. Implementation Checklist

### Immediate (Before Next Release)

**ritemark-native:**
- [ ] Create `/docs/user-guide/GETTING-STARTED.md`
- [ ] Create `/docs/user-guide/EXPORT-GUIDE.md`
- [ ] Create `/docs/user-guide/FAQ.md`
- [ ] Create `/docs/blog/v1.0.0-release.md`
- [ ] Create `/docs/blog/v1.0.1-release.md`

**productory-2026:**
- [ ] Add "Free" badge to hero section
- [ ] Add Export feature card (ET + EN)
- [ ] Add Spreadsheet feature card (ET + EN)
- [ ] Add trust signals near CTA
- [ ] Add platform clarification
- [ ] Add/update FAQ section
- [ ] Capture new screenshots

### Before ProductHunt Launch

- [ ] Demo video (2 min)
- [ ] ProductHunt listing draft
- [ ] Gallery images (5-7)
- [ ] FAQ responses pre-written
- [ ] Social media templates

---

## 6. Customer-First Principle

Every piece of content should answer: **"Why should I care?"**

Features only matter if they solve a problem the customer recognizes:

| Feature (Technical) | Benefit (Customer) |
|--------------------|--------------------|
| PDF export | Share with anyone who doesn't use markdown |
| CSV editing | No need to open Excel for quick edits |
| Local-first | Your files are private, always accessible |
| Auto-save | Never lose work |
| Offline mode | Work anywhere, even on a plane |

---

## Approval

This plan requires Jarmo's approval before implementation.

**To approve:** Say "marketing plan approved" or "proceed with marketing"

**Questions to consider:**
1. Is the priority order correct?
2. Are there features I missed?
3. Which phase should we start with?
4. Should we update landing page before documentation?

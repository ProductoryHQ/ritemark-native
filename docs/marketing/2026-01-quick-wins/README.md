# Marketing Project: Quick Wins

**Created:** 2026-01-14
**Status:** COMPLETED (2026-01-14)

---

## Goal

Fix the landing page gaps that lose potential users. Make key value visible.

---

## Problem

Landing page hides:
- FREE (not prominent)
- PDF/Word export (not mentioned)
- CSV/Excel preview (not mentioned)
- Local-first privacy (buried)

---

## Deliverables

| Deliverable | File | Status |
|-------------|------|--------|
| Copywriting (ET + EN) | [copywriting.md](copywriting.md) | ✓ Approved |
| Screenshots | [screenshots.md](screenshots.md) | ✓ Captured |
| Landing page updates | productory-2026 | ✓ Implemented |

---

## Project Structure

```
2026-01-quick-wins/
├── README.md           # This file
├── copywriting.md      # All copy for review
└── screenshots/
    ├── README.md       # Instructions for captures
    ├── example.md      # Example doc for PDF export shot
    ├── example.csv     # Example data for CSV shot
    └── example.xlsx    # (use real file from test data)
```

---

## Workflow

1. **Copywriting** → Review `copywriting.md`
2. **Approval** → Jarmo approves copy
3. **Screenshots** → Capture using example materials
4. **Implementation** → Update landing pages
5. **Review** → Jarmo reviews in productory-2026
6. **Deploy** → Jarmo commits

---

## Landing Page Changes

Files to edit:
- `/src/app/ritemark/et/page.tsx`
- `/src/app/ritemark/en/page.tsx`

| Change | ET | EN |
|--------|----|----|
| Add "Tasuta" / "Free" badge | [x] | [x] |
| Add Spreadsheet feature card | [x] | [x] |
| Add trust signals | [x] | [x] |
| Add platform note | [x] | [x] |

**Note:** Export feature card removed from scope (deemed minor).

---

## Additional Work Completed

Beyond the original scope, the following improvements were made:

| Item | Description |
|------|-------------|
| Shared CtaButton component | `/src/app/ritemark/components/CtaButton.tsx` - single source of truth for all CTAs |
| Constants file | `/src/app/ritemark/constants.ts` - centralized `CTA_URL` and `DOWNLOAD_URL` |
| CTA flow optimization | Main CTAs scroll to #install section; install button links to GitHub |
| ET page cleanup | Removed duplicate "Andmefailide eelvaade" section |

---

## Completion Summary

**Completed:** 2026-01-14

All planned deliverables implemented in productory-2026:
- Free badge on hero CTA
- Trust signals below CTA
- Platform note (macOS now / Windows coming)
- Data File Preview feature card (EN page)
- Screenshots captured and available
- Shared component architecture for maintainability

**Note:** productory-2026 changes ready for Jarmo to review and deploy.

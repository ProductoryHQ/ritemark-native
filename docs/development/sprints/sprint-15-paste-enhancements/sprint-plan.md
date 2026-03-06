# Sprint 15: Paste Enhancements

## Status: Complete (Discovery)

**Original Goal:** Improve HTML paste handling to convert web tables to markdown.

**Finding:** TipTap's built-in paste handling with turndown-plugin-gfm already handles this correctly.

## Test Results

| Source | Result |
|--------|--------|
| Google Docs | Works - tables convert to markdown |
| Wikipedia | Works - preserves links and images |
| MS Word | Copies as image (clipboard limitation) |
| Excel | Copies as image (clipboard limitation) |

See `quick-test.md` for detailed test output.

## Notes

- Word/Excel limitation is due to how those apps put data on clipboard (they send images, not HTML)
- This is not something we can fix on our end

## Deferred

- **Inline image paste** (screenshots, data URLs → local files) moved to WISHLIST as separate item

---

*Sprint completed: 2026-01-06*

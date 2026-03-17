# AI Review Mode

**Date:** 2026-03-17
**Status:** Placeholder for deeper analysis
**Goal:** Evaluate a feature that turns AI edits into reviewable suggestions with accept/reject controls instead of applying them directly.

---

## Summary

Instead of directly mutating text, AI rewrites become proposed changes. Users can inspect, accept, reject, or selectively apply edits.

This is more than a cosmetic “track changes” feature. It changes the trust model of AI editing and makes the editor safer for serious writing.

---

## Why This Fits Ritemark

- Preview and approval-style UI pieces already exist in `extensions/ritemark/webview/src/components/ai-sidebar/WidgetPreview.tsx`.
- Message-side widget handling already exists in `extensions/ritemark/webview/src/components/ai-sidebar/store.ts`.
- Approval-style patterns also appear in `extensions/ritemark/webview/src/components/ai-sidebar/AgentResponse.tsx`.

---

## Current Gap

- Editor execution in `extensions/ritemark/webview/src/App.tsx` appears to go directly from AI tool result to replacement or insertion.
- There does not appear to be a persistent review layer for proposed edits.
- The current product model seems optimized for fast application rather than controlled acceptance.

---

## Market Validation

- [Craft AI Assistant](https://support.craft.do/en/ai-assistant)

The broader pattern is explicit separation between exploration/proposal and execution/application.

---

## Follow-up Analysis Questions

- Should review happen inline in the document, in a side panel, or both?
- Is the right primitive a diff against the full document, selected blocks, or individual AI actions?
- How should suggestion state survive reloads, file changes, or concurrent edits?
- Does this start with selection-based rewrites only, or all AI edit operations?

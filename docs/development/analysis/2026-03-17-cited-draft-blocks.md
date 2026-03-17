# Cited Draft Blocks

**Date:** 2026-03-17
**Status:** Placeholder for deeper analysis
**Goal:** Evaluate a feature that lets users insert AI-generated draft content into documents together with preserved citations and source references.

---

## Summary

A user researches in the AI sidebar, then clicks `Insert into document with sources`. Ritemark inserts a formatted answer block into the editor together with citations, source links, or a source appendix.

This is compelling because much of the hard infrastructure already exists. The gap is the final step from sidebar answer to trustworthy in-document output.

---

## Why This Fits Ritemark

- RAG and citation plumbing already exist in `extensions/ritemark/src/views/UnifiedViewProvider.ts`.
- Citations are already rendered in `extensions/ritemark/webview/src/components/ai-sidebar/CitationChips.tsx`.
- The editor already supports AI-driven insertion behavior in `extensions/ritemark/webview/src/App.tsx`.

---

## Current Gap

- Citations appear to stop in chat instead of becoming first-class document content.
- The current AI tool layer in `extensions/ritemark/src/ai/openAIClient.ts` appears oriented around plain-text rewrite, replace, and insert operations.
- Export flows would need a clear story for citation formatting, bibliography generation, and source preservation.

---

## Market Validation

- [Google Workspace: linked sources and AI work patterns](https://workspace.google.com/blog/product-announcements/new-ways-to-do-your-best-work)
- [Notion release notes: connected research and source-grounded workflows](https://www.notion.com/releases/2025-05-13)

The external pattern is moving toward grounded drafting from trusted sources, not ungrounded generic chat output.

---

## Follow-up Analysis Questions

- What should the inserted citation format be in markdown: footnotes, inline references, or an appendix block?
- Should citations remain editable and traceable after insertion?
- How should export to PDF/Word handle references and source sections?
- Can the current AI tool schema be extended cleanly, or does this require a higher-level “insert cited block” action?

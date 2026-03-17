# Watched Flow Jobs

**Date:** 2026-03-17
**Status:** Placeholder for deeper analysis
**Goal:** Evaluate a feature that runs Flows automatically when files or folders change, turning manual Flows into local-first automations.

---

## Summary

Let a Flow run automatically when a folder changes, a new PDF appears, or a spreadsheet updates. Example: when new PDFs arrive in an inbox folder, extract facts, append a CSV, and write a markdown brief.

This would make Ritemark feel less like a manual Flow editor and more like a local-first automation system.

---

## Why This Fits Ritemark

- File-watch patterns already exist in `extensions/ritemark/src/ritemarkEditor.ts`.
- Similar editor/file monitoring logic exists in `extensions/ritemark/src/excelEditorProvider.ts`.
- Stored executable Flows already exist via `extensions/ritemark/src/flows/FlowStorage.ts` and `extensions/ritemark/src/flows/FlowsViewProvider.ts`.

---

## Current Gap

- Flow execution appears to be manual and message-driven today.
- There is no scheduler or watch-trigger type in `extensions/ritemark/src/flows/types.ts`.
- There is no persisted automation metadata model for watch conditions, debounce behavior, job history, or retry strategy.

---

## Market Validation

- [Cursor background agents](https://docs.cursor.com/en/background-agents)

The adjacent product expectation is durable, revisit-able background work rather than one-shot interactive execution only.

---

## Follow-up Analysis Questions

- Should v1 support folder watchers, file watchers, or both?
- What safety model is required to avoid runaway loops or repeated executions?
- How should watch-triggered runs be surfaced to users: activity log, notifications, output documents, or all three?
- Does this belong in the existing Flow model, or as a separate automation wrapper around Flows?

# Run Flow Over Rows

**Date:** 2026-03-17
**Status:** Placeholder for deeper analysis
**Goal:** Evaluate a feature that lets users run one Flow across CSV data, selected rows, or table-like inputs and write outputs back to CSV or generated documents.

---

## Summary

Users pick a CSV or selected rows, map columns to Flow inputs, and run the same Flow across the dataset. Results can be written back to a new CSV, appended to an existing table, or saved as generated documents.

This is a strong fit because it joins two existing product pillars that are currently adjacent but not connected: spreadsheet editing and reusable Flows.

---

## Why This Fits Ritemark

- Spreadsheet editing already exists in `extensions/ritemark/webview/src/components/SpreadsheetViewer.tsx` and `extensions/ritemark/webview/src/components/DataTable.tsx`.
- Reusable Flows already exist in `extensions/ritemark/src/flows/FlowExecutor.ts` and `extensions/ritemark/src/flows/nodes/SaveFileNodeExecutor.ts`.
- The missing bridge appears to be structured tabular input into Flow execution.

---

## Current Gap

- Flow inputs are still only `text` and `file` in `extensions/ritemark/src/flows/types.ts`.
- The webview flow store also models inputs around text/file concepts in `extensions/ritemark/webview/src/components/flows/stores/flowEditorStore.ts`.
- Spreadsheet selection and range context do not appear to be exposed as Flow-ready input primitives.

---

## Market Validation

- [Coda AI features](https://help.coda.io/hc/en-us/articles/39555802361613-Coda-AI-features)
- [Google Sheets AI](https://workspace.google.com/resources/spreadsheet-ai/)
- [Excel Copilot function](https://support.microsoft.com/en-us/office/copilot-function-5849821b-755d-4030-a38b-9e20be0cbf62)

The broader pattern is clear: users increasingly expect to talk to structured data, not just edit cells manually.

---

## Follow-up Analysis Questions

- What is the smallest viable input model: whole CSV, selected rows, or named column mappings?
- Should output target only CSV first, or also support generated markdown/doc files in v1?
- How should row-level errors, retries, and partial success be represented in the UI?
- Does this need a new Flow trigger type, or can it extend the current trigger model safely?

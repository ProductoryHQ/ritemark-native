# Meeting-to-Action Notes

**Date:** 2026-03-17
**Status:** Placeholder for deeper analysis
**Goal:** Evaluate a feature that turns local dictation and transcript capture into structured meeting notes with summaries, decisions, action items, and follow-up workflows.

---

## Summary

Use the existing local dictation stack to create a true meeting mode: live transcript, rolling summary, decisions, action items, and optionally a follow-up Flow.

This is stronger than plain dictation because it solves a complete recurring job instead of only providing raw transcription.

---

## Why This Fits Ritemark

- The transcription path already exists in `extensions/ritemark/webview/src/hooks/useVoiceDictation.ts`.
- The controller side already exists in `extensions/ritemark/src/voiceDictation/controller.ts`.
- Ritemark already has document workflows and Flows that could be used for post-processing and follow-up automation.

---

## Current Gap

- Existing voice functionality appears focused on dictation/transcription rather than structured meeting output.
- There does not appear to be a meeting-specific UX, schema, or output format.
- There is no obvious handoff from transcript capture to a reusable structured follow-up workflow.

---

## Market Validation

- [Notion AI Meeting Notes](https://www.notion.com/product/ai-meeting-notes)
- [Notion Help: AI Meeting Notes](https://www.notion.com/help/ai-meeting-notes)
- [Granola updates](https://www.granola.ai/updates/your-meeting-notes-now-connected-with-8000-apps)

The delight pattern is not “speech to text.” It is “my conversation became useful notes and next actions automatically.”

---

## Follow-up Analysis Questions

- Should meeting mode be live-only, or also support post-recording transcript cleanup?
- What is the minimum structured output: summary, decisions, and action items?
- How should speaker labels, timestamps, and privacy expectations be handled?
- Should this produce a normal markdown document, a template-based document, or a Flow-ready artifact?

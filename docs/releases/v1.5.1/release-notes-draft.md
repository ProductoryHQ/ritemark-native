# Ritemark v1.5.1 — Release Notes (DRAFT)

**Target Version:** 1.5.1  
**Drafted:** 2026-03-20  
**Status:** DRAFT — pending final release validation and approval

---

## Summary

Ritemark v1.5.1 adds mermaid diagram rendering and improves AI reliability. Mermaid code blocks now render as visual diagrams directly in the editor with full Word/PDF export support. The release also hardens Claude and Codex plan/question flows, simplifies key menus and file-creation entry points, and fixes regressions in screenshot paste and conversation state.

---

## What's New

### AI Agent Lifecycle Hardening (Sprint 45)

Claude and Codex now behave much more consistently when they need clarification, present a plan, and continue into execution.

- **Interactive questions now work reliably:** Claude and Codex can render inline multiple-choice questions and resume the same task after you answer.
- **Plan approval flow is explicit:** Plans are surfaced as reviewable UI state instead of getting lost in normal chat text.
- **Current plan widget:** After plan approval, the sidebar keeps a compact live plan summary above the input so you can track execution progress at a glance.
- **Shared lifecycle UI:** Claude and Codex now reuse the same core plan/question UI building blocks where the protocol allows it, instead of drifting into separate behaviors.
- **Better lifecycle state resets:** Starting fresh conversations and clearing chat now clean up plan state more predictably.

### Claude and Codex Reliability

- **Claude tool lifecycle parity:** Claude now correctly uses structured question and plan-review transitions instead of falling back to plain prose in common plan-mode workflows.
- **Codex compatibility visibility:** Codex setup/status now surfaces compatibility and capability information more clearly so unsupported states are easier to understand.
- **Trace-based debugging support:** Internal runtime tracing was added for Claude and Codex lifecycle debugging, making future agent regressions much faster to diagnose.

### Mermaid Diagram Rendering (Sprint 46)

Mermaid code blocks now render as visual diagrams directly in the editor.

- **Live diagram rendering:** Fenced `mermaid` code blocks automatically render as SVG diagrams with theme-aware styling that matches your editor theme (light/dark).
- **Code/Diagram toggle:** Switch between the rendered diagram and raw mermaid source with a single click.
- **Export support:** Mermaid diagrams export as embedded PNG images in both Word (.docx) and PDF, properly scaled to fit page width.
- **Broad diagram support:** Flowcharts, sequence diagrams, class diagrams, state diagrams, ER diagrams, Gantt charts, and pie charts are all supported.
- **Error handling:** Invalid mermaid syntax shows a clear error message while still allowing source editing.

### Menu and File Creation Cleanup

The app menu is now more focused on the workflows Ritemark actually supports.

- **Cleaner Help menu:** Reduced to the essentials, including Support, View License, and Advanced.
- **Simplified New File flow:** The new-file picker is narrowed to the document types that matter most in Ritemark right now: **Markdown** and **CSV**.
- **CSV quick-start flow:** CSV creation continues to route into the table-oriented flow instead of a generic empty file path.

---

## Bug Fixes

- **Fixed screenshot paste regression:** Pasting a new screenshot no longer overwrites earlier images unexpectedly.
- **Fixed welcome screen asset/render drift in dev workflows:** Welcome screen media and compiled output now stay aligned more reliably during iterative development.
- **Fixed plan banner dismissal edge case:** Clearing chat now also resets dismissed plan-banner state so new approved plans are not accidentally hidden.
- **Fixed patch-stack drift around menu cleanup:** Menu-related VS Code patch changes were folded back into the right patch layers to keep the patch stack reappliable.

---

## Improvements

- **More predictable AI execution after plan approval:** Agents are less likely to get stuck in plan loops after a plan is approved.
- **Better progress visibility:** The current-plan widget now behaves more like a lightweight task list instead of a static block of markdown.
- **More maintainable lifecycle coverage:** Added targeted regression tests for conversation reset, plan transitions, and provider-specific lifecycle edge cases.

---

## Technical Notes

- Includes Sprint 45 agent lifecycle hardening work across:
  - `extensions/ritemark/src/agent/`
  - `extensions/ritemark/src/views/UnifiedViewProvider.ts`
  - `extensions/ritemark/src/codex/`
  - `extensions/ritemark/webview/src/components/ai-sidebar/`
- Includes Sprint 46 mermaid diagram rendering:
  - `extensions/ritemark/webview/src/lib/mermaid.ts` — lazy mermaid init, theme config, SVG→PNG rasterization
  - `extensions/ritemark/webview/src/lib/mermaidExport.ts` — HTML inlining for export
  - `extensions/ritemark/webview/src/components/CodeBlockWithCopy.tsx` — TipTap NodeView with diagram/code toggle
  - `extensions/ritemark/src/export/v2/imageSource.ts` — shared image loader with data: URL support
  - `extensions/ritemark/src/export/v2/wordHtmlExporter.ts` — improved image scaling (600px/480px caps)
  - `extensions/ritemark/src/export/v2/pdfHtmlExporter.ts` — improved image scaling (55% page height cap)
- Includes menu and patch-stack cleanup from the post-`v1.5.0` maintenance work.
- Includes follow-up fixes validated through `./scripts/validate-qa.sh`.

---

## Included Work Since v1.5.0

| Commit | Summary |
| --- | --- |
| `4dceff0` | Prevent screenshot paste from overwriting previous images |
| `0033b16` | Bump to `v1.5.1` and introduce menu UX work |
| `636b7f2` | Repair menu cleanup patch structure and add screenshot skill |
| `c7b9bd5` | Simplify new-file picker |
| `e7d887f` | Harden agent plan/question flows |
| `2bb0783` | Align Claude lifecycle with shared plan flow |
| `53ff9da` | Reset dismissed current plan state on clear-chat |
| `3fc549d` | Implement mermaid diagram rendering in TipTap editor (Sprint 46) |
| `bcc642c` | Fix mermaid diagram export to Word and PDF |

---

## Open Questions Before Finalizing

1. Should `v1.5.1` be positioned primarily as an **AI reliability** release, or as a broader **desktop polish** release?
2. Do we want to explicitly mention the internal trace/debug infrastructure in public notes, or keep that implied under reliability improvements?
3. Should the final notes mention the Help menu / new-file cleanup as headline items, or keep them under polish/bug fixes?

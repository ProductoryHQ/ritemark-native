# Research: Dependency Audit

## Already Available (No New Dependencies Needed)

| Library | Version in package.json | How We Use It |
|---------|--------------------------|---------------|
| `@xyflow/react` | `^12.3.5` | Graph canvas for the knowledge graph view |
| `elkjs` | `^0.9.3` | Force-directed layout via `elk.algorithm: 'force'` |
| `@tiptap/suggestion` | `^2.1.0` | Autocomplete popup when user types `[[` |
| `@tiptap/core` | `^2.1.0` | Base for wiki-link Node extension |
| `@tiptap/pm` | `^2.1.0` | ProseMirror plugin API for click interception |
| `@tiptap/react` | `^2.1.0` | `NodeViewWrapper`, `NodeViewContent` for chip rendering |
| `lucide-react` | `^0.294.0` | Icons in backlinks panel and graph controls |
| `tippy.js` | `^6.3.7` | Already used for slash command popup (suggestion rendering) |
| `zustand` | `^5.0.2` | State management if graph needs shared state |

## New Dependencies Required

| Library | Purpose | Weight |
|---------|---------|--------|
| None identified | The ELK force algorithm replaces d3-force | — |

## Potential New Dependencies (Decisions Open)

| Library | When Needed | Alternative |
|---------|-------------|-------------|
| `d3-force` | If ELK force layout proves inadequate for organic look | ELK force algorithm (preferred — zero new deps) |
| `fuse.js` | If file name fuzzy search in autocomplete needs sophistication | Simple `.includes()` / `.startsWith()` filter is sufficient for 1000 files |

## Conclusion

This feature can be built with **zero new npm dependencies**. All graph, suggestion, and node-view machinery is already present. This is a significant advantage — no bundle size concerns, no compatibility risks, no install friction.

The ELK `force` algorithm confirmation:

From ELK docs, `elk.algorithm: 'force'` is a bundled algorithm in `elkjs`. It produces spring-based layouts suitable for knowledge graphs. The existing `elk.bundled.js` import in `FlowCanvas.tsx` already includes it.

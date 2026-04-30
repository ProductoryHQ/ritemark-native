---
name: outline-from-notes
description: Reformats unstructured notes into a hierarchical markdown outline with clear sections and a separate action-items list. Use when the input is paragraphs of meeting notes, brainstorm output, or rough drafts that need shape — bullets without nesting, prose without headings, mixed observations and decisions.
---

# Outline from Notes

Take unstructured prose, brainstorming output, or meeting notes and produce a hierarchical markdown outline.

## Process

1. Read the entire input first. Do not start writing the outline until you've identified the major topic shifts.
2. Group related sentences into sections. Use H2 (`##`) for major topics, H3 (`###`) for sub-topics.
3. Promote action items to a dedicated `## Actions` section at the bottom. An action item is anything in the form *"X will do Y"*, *"need to Z"*, or imperative voice directed at someone.
4. Preserve the original wording where possible. Don't paraphrase unless the original is unclear or contradicts itself.
5. If the input is already partly structured (has some headings, ordered lists), enhance rather than replace — fix gaps, level inconsistencies, missing transitions.

## What not to do

- Don't summarize. The user has the original; they want it organized, not shortened.
- Don't invent action items the user didn't write.
- Don't add commentary or *"based on the notes…"* prose.

## Output format

Plain markdown. The outline replaces or supplements the input depending on the user's instruction.

---

# Provenance

Ships with Ritemark Native as part of the first-run starter pack. File location: `~/.claude/skills/outline-from-notes/SKILL.md`. Edit freely.

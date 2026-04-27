# Sprint 54: Agent Library

## Goal

Ship the **first step** of Ritemark's agent-curation direction by:

- surfacing discovered **agents** and **skills** in an **Agent Library** sidebar
- opening those files in the **existing markdown editor**
- moving **frontmatter editing** from the current dialog into a **side-by-side Properties panel**
- updating the editor toolbar so **TOC** and **Properties** become explicit, mutually exclusive side modes

This sprint is about **surfacing and editing existing markdown files**, not building the full long-term curation console.

## Why This Sprint Exists

Ritemark already has the most important primitive: a markdown editor.

Agents and skills are markdown files. The earlier Sprint 54 framing leaned toward a net-new management interface, but the better first step is more direct and more Ritemark-native:

- let the user **see** their discovered agent/skill files in one place
- let them **open** those files directly in the existing editor
- let them edit both **frontmatter** and **body content** from the same overall workspace

This keeps the product honest: file-first, editor-first, and compatible with the round-trip guarantee.

## Required Visual References

The following files in the Sprint 54 folder are required implementation references and must be treated as the intended UI direction for this sprint:

- `docs/development/sprints/sprint-54-agent-curation-layer/Next-gen — Default view (Light).png`
- `docs/development/sprints/sprint-54-agent-curation-layer/Next-gen — Agent Management view (Light).png`

These references must guide:

- Agent Library sidebar structure
- editor toolbar toggle placement
- side-by-side Properties panel shape
- the overall editor-first layout

If code-level constraints force a deviation, record that deviation explicitly in sprint notes or implementation notes.

## Sprint Positioning

This sprint should now be understood as:

**Agent Curation Layer — Step 1: Agent Library + Editor Integration**

Not:

- duplicate-management workflow
- archive/trash workflow
- bulk destructive ops
- provenance dashboard
- canonical/drift management surface

Those remain possible future steps. They are not the implementation target of Sprint 54.

## Success Criteria

- [ ] Ritemark surfaces an **Agent Library** sidebar with discovered **agents** and **skills**
- [ ] Selecting a library item opens the underlying markdown file in the **existing markdown editor**
- [ ] The editor toolbar exposes a **TOC toggle** and a **Properties toggle**
- [ ] **TOC** and **Properties** are **mutually exclusive** and occupy the same side-panel slot
- [ ] The **Properties** panel renders editable frontmatter **side-by-side** with the markdown body
- [ ] The implementation explicitly reuses the **existing frontmatter editing capability**, moving it from dialog to inline/side-by-side use
- [ ] The Properties panel works as a **generic markdown frontmatter editor**, not only for agent files
- [ ] The existing round-trip expectation remains intact: file content remains the source of truth
- [ ] Existing editor behavior remains stable when neither TOC nor Properties is open
- [ ] Existing AgentSelector, ChatView, Flows, and other unrelated surfaces are not regressed

## Deliverables

| Deliverable | Description | Phase | Status |
| --- | --- | --- | --- |
| Updated design brief | Rewrite Sprint 54 design framing around **Agent Library**, existing editor reuse, and side-by-side Properties mode | 1 | TODO |
| Revised sprint plan | Narrow scope from full management UI to first-step library + editor integration | 1 | TODO |
| Discovery integration notes | Document how existing discovery output maps into the Agent Library sidebar | 2 | TODO |
| UI implementation notes | Define toolbar state model, panel exclusivity, and editor integration boundaries | 2 | TODO |
| Agent Library sidebar | Surface discovered agents/skills in a library/browser sidebar | 3 | TODO |
| Properties side panel | Reuse frontmatter editor in side-by-side editor mode | 3 | TODO |
| Toolbar update | Add explicit TOC / Properties controls with mutual exclusivity | 3 | TODO |
| Validation | Build, smoke test, and confirm no regressions in existing flows | 4 | TODO |

## In Scope

- Surface an **Agent Library** sidebar for discovered markdown-based items
- Show at least **Agents** and **Skills** groupings
- Open selected library items in the **existing markdown editor**
- Reuse existing frontmatter-editing functionality in a **side-by-side Properties panel**
- Update editor toolbar controls for:
  - TOC
  - Properties / Frontmatter
- Enforce **mutual exclusivity** between TOC and Properties
- Keep the Properties panel generic enough for **any markdown file with frontmatter**
- Update Sprint 54 docs to reflect the narrowed first-step direction

## Out of Scope

- Duplicate diff workflows
- Orphan/stale sweep workflows
- Archive/trash/delete workflows
- Bulk destructive operations
- Audit log UX
- Provenance dashboard or advanced provenance write-back
- Canonical/drift management workflows
- New custom agent-details page replacing the editor
- Creation wizard, template picker, or agent-builder flow
- Any broad redesign of the markdown editor beyond the side-panel integration and toolbar update

## Implementation Checklist

### Phase 1: Sprint-Doc Realignment

- [ ] Rewrite `design-brief.md` around **Agent Library** and existing editor reuse
- [ ] Rewrite `sprint-plan.md` around the narrowed first-step scope
- [ ] Add the Next-gen PNGs as required Sprint 54 visual references in both docs
- [ ] Remove or defer references to diff, orphan, bulk-op, provenance-panel, and canonical-management workflows
- [ ] Ensure both docs use the same vocabulary:
  - Agent Library
  - markdown editor
  - TOC
  - Properties
  - mutually exclusive side panels
  - generic frontmatter editor

### Phase 2: Technical Framing

- [ ] Confirm the existing discovery pipeline/source to feed the Agent Library sidebar
- [ ] Review the Next-gen reference images before implementation decisions on layout or toolbar behavior
- [ ] Confirm where the library state lives in extension ↔ webview messaging
- [ ] Confirm how existing frontmatter-editing code is reused instead of forked
- [ ] Define the toolbar state model:
  - markdown only
  - markdown + TOC
  - markdown + Properties
- [ ] Define tab/selection behavior between library selection and open editor tabs

### Phase 3: UI Integration

- [ ] Surface the **Agent Library** sidebar in the webview/app shell
- [ ] Render grouped discovered items (agents, skills)
- [ ] Open selected item in the **existing markdown editor**
- [ ] Implement the **Properties** side panel in the same side slot currently used by TOC
- [ ] Add toolbar toggles for **TOC** and **Properties**
- [ ] Enforce **TOC/Properties mutual exclusivity**
- [ ] Preserve markdown-only mode when neither panel is active

### Phase 4: Validation

- [ ] Confirm agent and skill files open correctly from the Agent Library
- [ ] Confirm Properties editing works side-by-side
- [ ] Confirm TOC and Properties cannot be open together
- [ ] Confirm generic markdown documents with frontmatter also work in Properties mode
- [ ] Confirm existing editor behavior is unchanged outside the new side-panel mode
- [ ] Run repository QA validation before any handoff/commit readiness decision

## Design / UX Notes

### Primary mental model

The user is not entering a separate management app. They are:

1. browsing files in the **Agent Library**
2. opening one in the **editor**
3. editing either:
   - the markdown body
   - the frontmatter via **Properties**

This mental model must remain visually consistent with the Next-gen reference images in the sprint folder.

### Side-panel state model

The editor area has exactly three meaningful states:

1. **Markdown only**
2. **Markdown + TOC**
3. **Markdown + Properties**

TOC and Properties share the same side-panel slot and are **mutually exclusive**.

### Frontmatter implementation note

Sprint 54 must explicitly state and implement this:

> Take the frontmatter editing capability that currently lives in a dialog and surface it as a side-by-side mode inside the existing markdown editor.

That is the core product move in this sprint.

## Invariants This Sprint Must Uphold

1. **Editor-first workflow** — the markdown editor remains the main editing surface
2. **File-first truth** — agents and skills are still treated as markdown files, not converted into a proprietary management model
3. **No separate custom management UI as primary scope** — the Agent Library is a browser/sidebar, not a full management console in this sprint
4. **TOC and Properties are mutually exclusive** — one side slot, one active side mode
5. **Generic frontmatter support** — the Properties panel is not architected as agent-only
6. **No regressions in existing surfaces** — AgentSelector, ChatView, Flows, and unrelated editor workflows remain stable

## Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Scope drifts back toward the old full-management concept | HIGH | Keep docs and implementation language anchored to "first step", Agent Library, editor reuse, and out-of-scope list |
| Frontmatter implementation is rebuilt instead of reused | HIGH | Make reuse of the current dialog-based capability an explicit implementation requirement |
| TOC/Properties state model becomes ambiguous | MEDIUM | Define the three-state model early and keep a single shared side-panel slot |
| Agent-specific assumptions leak into generic frontmatter editing | MEDIUM | Validate Properties mode on non-agent markdown with frontmatter |
| Sidebar selection/open-tab behavior becomes confusing | MEDIUM | Define the selection/open state behavior before implementation |
| Existing editor UX regresses | MEDIUM | Validate markdown-only mode and existing TOC behavior after the new Properties mode lands |

## Key Files

| File | Purpose |
| --- | --- |
| `docs/development/sprints/sprint-54-agent-curation-layer/design-brief.md` | Design framing for the narrowed Sprint 54 scope |
| `docs/development/sprints/sprint-54-agent-curation-layer/sprint-plan.md` | Sprint execution plan |
| `extensions/ritemark/src/agent/discovery.ts` | Existing discovery source likely feeding the Agent Library |
| `extensions/ritemark/webview/src/components/` | Likely location for Agent Library sidebar and Properties panel work |
| `extensions/ritemark/src/views/UnifiedViewProvider.ts` | Likely bridge integration point for library/editor state |

## Status

**Current Phase:** Phase 1 — sprint-doc realignment in progress  
**Current Branch:** `sprint/54-agent-library`  
**Next Step:** finish rewriting sprint docs, then confirm implementation boundaries before code work starts

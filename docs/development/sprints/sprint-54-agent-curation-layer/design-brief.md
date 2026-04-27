# Design Brief — Sprint 54: Agent Library

Audience: a designer or implementer who has not followed the earlier Sprint 54 framing. This brief is self-contained and reflects the *current* sprint direction.

## 0. Visual references that must be followed

The following Sprint 54 design files are not optional inspiration. They are the concrete visual direction for this sprint and must be followed during both design refinement and implementation:

- `docs/development/sprints/sprint-54-agent-curation-layer/Next-gen — Default view (Light).png`
- `docs/development/sprints/sprint-54-agent-curation-layer/Next-gen — Agent Management view (Light).png`

Use them as the primary source for:

- Agent Library sidebar structure and tone
- toolbar toggle placement and behavior
- side-by-side Properties panel layout
- the relationship between library selection, Properties, and the markdown editor

If implementation needs to deviate from these references, the deviation should be explicitly documented in the sprint notes rather than silently improvised.

## 1. What this sprint is now

Sprint 54 is **not** about inventing a brand-new agent-management application inside Ritemark.

It is the first step toward that direction:

- surface discovered **agents** and **skills** in an **Agent Library** sidebar
- open those markdown files in Ritemark's **existing markdown editor**
- move **frontmatter editing** from the current dialog into the editor area as a **side-by-side Properties panel**
- update the editor toolbar so the user can switch between **TOC** and **Properties**

This is a file-native, markdown-first improvement. The core editing surface remains the existing editor.

## 2. The product idea in one paragraph

Ritemark already has the important primitive: a markdown editor. Agents and skills are markdown files. So instead of building a parallel custom management UI, Sprint 54 should treat those files like first-class documents. The user browses them through an **Agent Library** sidebar, opens one in the editor, and edits both body content and frontmatter from the same overall workspace. The only new UI concept is a **Properties** side panel inside the editor area, reusing the existing frontmatter-editing capability but surfacing it inline instead of in a dialog.

## 3. The one user to design for

**Viktor, veteran Claude Code + Codex user.**

Short version:

- He already has a pile of agent and skill markdown files
- He wants to inspect and refine them without losing the sense that they are just files
- He does **not** want a flashy bespoke management experience if the existing editor already solves the job
- He values transparency and directness over abstraction

His ideal feeling is: *"Good — I can see the library, open the file, edit the properties, edit the markdown, done."*

## 4. Core design decision

### 4.1 Reuse the existing editor

The center of gravity stays in the current markdown editor. Sprint 54 should not introduce a separate custom agent-details screen as the primary editing model.

### 4.2 Properties editing moves from dialog to side-by-side

Ritemark already has frontmatter editing functionality. In this sprint, that capability should be brought into the main editor experience as a **side-by-side Properties panel**.

### 4.3 TOC and Properties are mutually exclusive

Inside the editor region, the user can have:

1. **Markdown only**
2. **Markdown + TOC**
3. **Markdown + Properties**

The **TOC panel** and **Properties panel** cannot be open at the same time. They occupy the same side slot.

### 4.4 Generic markdown frontmatter editor

Although the sprint is driven by agents and skills, the Properties panel is a **generic markdown frontmatter editor**. It is not conceptually limited to agent files.

## 5. Design principles

1. **Markdown editor stays primary.** The sprint should feel like an extension of the existing document workflow, not a detour away from it.
2. **Files stay legible.** The user should never lose the sense that agents and skills are markdown files being edited directly.
3. **Properties are inline, not hidden in a modal.** Frontmatter editing should feel present and immediate.
4. **One side panel at a time.** Avoid visual clutter. TOC and Properties share the same role and should not compete.
5. **Agent Library is a browser, not yet a full management console.** This sprint is about surfacing and editing, not about archive flows, diff tooling, or destructive bulk operations.
6. **Generic before special-case.** The Properties panel should be described as generic frontmatter editing that happens to be especially useful for agents and skills.

## 6. Required surfaces

Deliver wireframes and implementation notes for these states.

### 6.1 Agent Library sidebar — populated state

The left-side library/browser for discovered markdown-based items.

Must include:

- clear title: **Agent Library**
- summary counts for discovered categories (at minimum agents and skills; commands only if they are still part of the actual implementation scope)
- filter/search input
- grouped sections such as **Agents** and **Skills**
- row metadata sufficient to distinguish items (for example vendor, scope, source, warnings)
- clear selected state
- ability to open an item in the markdown editor

Important framing: this is a **library browser / selector**, not a dense data table.

### 6.2 Agent Library sidebar — empty state

Show the honest no-content state for a workspace with no discovered agent/skill files.

It should be quiet and practical — no onboarding campaign energy.

### 6.3 Editor — markdown only

The baseline state with neither TOC nor Properties open.

Show:

- existing markdown editor as primary surface
- toolbar controls that make the side-panel modes discoverable

### 6.4 Editor — TOC mode

The existing TOC shown in the editor-side slot.

Must communicate:

- TOC is the current active side mode
- the markdown document remains primary
- the user can switch to Properties from the same toolbar area

### 6.5 Editor — Properties mode

The new target state for this sprint.

Must show:

- a **Properties** side panel occupying the same slot where TOC normally appears
- editable frontmatter fields
- the markdown body still visible alongside it
- clear visual continuity with the document being edited

Important: this should be explicitly described as **taking the existing frontmatter dialog capability and surfacing it side-by-side in the editor**.

### 6.6 Toolbar toggle behavior

Design the toolbar state model.

Must communicate:

- how the user opens TOC
- how the user opens Properties
- how the user returns to markdown-only mode
- that **TOC and Properties are mutually exclusive**

### 6.7 File selection flow

Design the flow from Agent Library row selection into the editor.

Must answer:

- what opens when a library item is selected
- how the selected library item stays visually linked to the open document
- how selection/open state behaves across tabs

### 6.8 Generic frontmatter behavior

Show or document how the Properties panel behaves for:

- agent markdown files
- skill markdown files
- a general markdown document with frontmatter

The goal is to reinforce that this is a **generic editor capability**, not a one-off agent form.

## 7. What this sprint is not designing

- No duplicate diff workflow
- No orphan/stale sweep workflow
- No archive/delete bulk-op UX
- No provenance dashboard
- No canonical-management workflow beyond whatever minimal metadata is already naturally visible in the file/editing model
- No new custom "agent detail" page replacing the editor
- No creation wizard or template gallery
- No redesign of the markdown editor itself beyond integrating the Properties mode into the existing layout and toolbar

Those may come later. Sprint 54 is the first-step surface.

## 8. Open design questions this brief already answers

These should now be treated as resolved for Sprint 54:

1. **Placement**: the Agent Library should surface as a sidebar/library browser, while editing happens in the existing markdown editor.
2. **Primary editing model**: not a new custom UI; use the markdown editor.
3. **Frontmatter editing**: reuse the existing frontmatter editor and move it from dialog to side-by-side.
4. **TOC coexistence**: TOC and Properties are mutually exclusive.

## 9. What to deliver

At minimum, deliver:

1. Wireframes for the required surfaces in Section 6
2. Short rationale per surface
3. Toolbar interaction notes for TOC/Properties switching
4. Empty-state notes
5. Width/responsive notes for the sidebar and editor-side panel
6. Any implementation-sensitive notes about generic frontmatter rendering in the Properties panel
7. Explicit confirmation that the deliverables stay aligned with:
   - `Next-gen — Default view (Light).png`
   - `Next-gen — Agent Management view (Light).png`

## 10. Success criteria for the design

- [ ] A developer can implement Sprint 54 without assuming a brand-new management UI
- [ ] The Agent Library is clearly framed as a sidebar browser/selector
- [ ] The existing markdown editor is clearly framed as the primary editing surface
- [ ] The Properties panel is clearly defined as the existing frontmatter editor moved from dialog into a side-by-side editor mode
- [ ] TOC and Properties are clearly specified as mutually exclusive
- [ ] The resulting design reads as generic markdown/frontmatter editing, not agent-only form building

## 11. Implementation note that must be explicit

The brief and sprint plan should both say this plainly:

> Sprint 54 takes the frontmatter editing capability that currently lives in a dialog and implements it as a side-by-side editor mode inside the existing markdown editor.

That is the core scope change.

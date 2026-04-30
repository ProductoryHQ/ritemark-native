# Sprint 56: Agent Authoring Loop

## Goal

Take Ritemark from *"you can browse and edit agents/skills"* (shipped 1.6.0 / Sprint 54) to **"you can create and fork them"** — the table-stakes creation surface — without yet committing to the more speculative or as-yet-underspecified moves (a test loop, capture-from-conversation, description coach, template gallery, builder agent).

This sprint ships the obvious-fix creation surface only. The inline test loop (*Try it*) is parked for a follow-up sprint; it still needs a clearer answer to "what exactly does it run against, and how, given the runtime we have."

## Why This Sprint Exists

Sprint 54 surfaced the Agent Library and moved frontmatter editing into a side-by-side Properties panel. The library is now read-and-edit. It is not yet author.

Concretely, today the library:

- tells the user in the empty state to *"add markdown files to `.claude/agents/`"* — i.e. open a terminal
- has no `+` affordance in its header
- has no right-click context menu on rows
- offers no way to create a new file from inside Ritemark
- does not refresh when files appear or change externally

None of this is interesting design work. It is missing functionality, and shipping it unblocks every more interesting move that follows.

The deliberate scope cut for this sprint: ship only the obvious fixes and obvious enhancements. Defer everything that requires a real product decision — *Try it*, capture-from-conversation, description-quality coach, template chooser, builder agent — until after the basic creation surface is in users' hands and we can see which of them actually pulls.

## Sprint Positioning

This is **the first authoring sprint** in the Agent Curation series:

- Sprint 54 — surfacing + inline editing (shipped 1.6.0)
- **Sprint 56 — authoring loop** ← this sprint
- Sprint 57+ — capture, coach, templates, builder (separate sprints, separate decisions)

It is **not**:

- a redesign of the Agent Library
- a capture-from-conversation feature
- a template gallery
- a builder agent
- a marketplace or share surface

## Scope — The Staircase

### Tier 1 — Obvious fixes (current behavior fails)

| # | Fix | Why |
|---|---|---|
| 1 | Empty state shows two action buttons — *New skill* and *New agent* — instead of "add files to `.claude/`" | Current copy tells the user to open a terminal. The two-button choice mirrors the two sections of the populated library. |
| 2 | `+` affordance per section header (one next to **Agents**, one next to **Skills**) so the user picks the type by clicking the right list | A populated library has no way to add. The two existing lists are the natural affordance for "skill vs agent." |
| 3 | Row context menu — *Duplicate*, *Reveal in Finder*, *Delete*, *Move scope* | Right-click does nothing today. |
| 4 | "New blank skill / agent" command — creates the `.md` in the correct directory and opens it in the editor | Today the user must leave Ritemark to create a file. |
| 5 | File watcher on `.claude/{agents,skills,commands}/` for live refresh | External adds/edits don't appear without manual reload. |

### Tier 2 — Obvious enhancements (clearly missing)

| # | Enhancement | Why |
|---|---|---|
| 6 | Frontmatter skeleton injected on every new file | Without scaffolding, "new" just relocates the schema-memorization problem. |
| 7 | *Duplicate* surfaced as the primary authoring path (in the `+` chooser and the row menu) | Real `.claude/` directories are mostly forks. |
| 8 | One-click promote / demote between project and user scope | Common move; today requires a manual file move. |
| 9 | Starter pack — 3–5 exemplary skills/agents seeded into `~/.claude/` on first run | Solves cold-start; teaches by example. |
| 10 | Alphabetical / recently-modified sort in the sidebar | Trivial; matters above ~30 files. |

## Out of Scope (deliberately)

| Item | Why deferred |
|---|---|
| *Try it* test loop in the Properties panel | High-leverage move (it makes authoring feedback-driven instead of faith-based) but still needs thought on what it runs against, how the runtime invokes a single helper one-shot against arbitrary input, and how the output is rendered. Own sprint once that's settled. |
| Capture-from-conversation (*Save approach as skill* from chat) | Highest novelty + cost in the family. Several open product decisions (what is being bottled, deterministic vs LLM distillation, default scope) need to be settled before build. Own sprint. |
| Description-quality coach | Largely obviated by shipping `skill-creator` in the starter pack — its own guidance covers the *undertrigger* / weak-description failure mode. Revisit only if telemetry shows users skipping `/skill-creator` and producing weak descriptions anyway. |
| Template chooser / template gallery | Premature curation. Ship the starter pack (#9) first; let actual usage signal what templates would even be. |
| Builder agent (conversational creator) | Largely obviated by shipping `skill-creator` in the starter pack — Anthropic already built this. Don't build a Ritemark-branded duplicate. The agent-creation side has no upstream equivalent; revisit only if a real need for guided agent authoring emerges. |
| Share / install-from-URL / marketplace | Different altitude (distribution, not authoring). Park. |

## Success Criteria

- [ ] A user can create a new skill or agent from inside Ritemark, end to end, without opening a terminal.
- [ ] The empty state offers actionable creation buttons.
- [ ] The `+` affordance is discoverable in the Agent Library header and via row context menu.
- [ ] *Duplicate* exists and is the recommended path in the `+` chooser when an existing item is selected.
- [ ] *Delete* requires confirmation and is scope-aware (project files surface a teammate-impact note).
- [ ] New files arrive with valid frontmatter scaffolding.
- [ ] Files added externally appear in the sidebar without manual refresh.
- [ ] On first run with an empty `~/.claude/`, the starter pack is seeded.
- [ ] The Sprint 54 invariants remain intact — file-first truth, generic frontmatter editing, TOC/Properties exclusivity, no regressions in editor / chat / Flows.

## Resolved Decisions (Jarmo, Phase 1)

These were the open product decisions for this sprint. All four are now settled and should be treated as fixed for implementation.

1. **Default scope for new files: project (`.claude/`).** New skills/agents land in the workspace's `.claude/` by default. A one-click promote to user scope is offered from the row context menu (Tier 1 #3).
2. **Skill vs agent: user picks up front, by which list they create from.** The Agent Library has two visible sections — **Agents** and **Skills** — and the `+` affordance lives at each section header. Clicking the `+` next to **Skills** creates a skill; clicking the `+` next to **Agents** creates an agent. The empty state mirrors this with two buttons (*New skill*, *New agent*). No separate chooser modal.
3. **Starter pack: ship + auto-seed.** A curated set ships under `extensions/ritemark/starter-pack/`. On first run, if `~/.claude/{agents,skills}/` is empty, the starters are copied into `~/.claude/`. Users can edit, disable, or delete them like any other file.

   **Anchor of the starter pack: Anthropic's [skill-creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator).** It is the meta-skill for building skills — it interviews the user, writes the SKILL.md, and ships its own evaluation sub-agents (`analyzer.md`, `comparator.md`, `grader.md`) for empirical skill-quality testing. Pre-installing it means the *Builder agent* and *description coach* work we'd previously deferred is largely already solved upstream — we don't need to build either; we just need to make `/skill-creator` discoverable.

   **Asymmetry to note for `creation-spec.md`:** Anthropic does not ship an equivalent `agent-creator`. Creating an agent stays bare-bones (frontmatter skeleton + open in editor). Creating a skill, after this anchor lands, becomes guided. The empty agent file should mention this gap honestly — there's no upstream meta-helper to point at.
4. **Delete safety: OS trash via the VS Code API.** Deletions use `vscode.workspace.fs.delete` with `useTrash: true`. Recovery happens via the OS trash, not an internal `.claude/.trash/` folder. Matches the rest of VS Code's delete semantics; no internal trash directory to maintain.

### Still open (lower-altitude, resolve while drafting `creation-spec.md`)

- **Filename derivation when the user creates a new skill/agent.** Take the user-typed *name* and slugify it (lowercase, hyphens), or open the editor with a placeholder filename and let them rename via "Save As"?
- **Starter pack contents beyond the anchor.** Anchor (`skill-creator`) is settled. *Which other 2–4 exemplars* ship alongside it is the main content of `starter-pack.md`. Candidates worth weighing: a Ritemark-flavored writing helper (e.g. outline-from-notes), a release-notes drafter, a frontmatter cleanup helper, plus possibly one well-chosen example agent so the **Agents** section isn't empty on first run.
- **Vendoring / licensing for skill-creator.** `anthropics/skills` is public; we still need to confirm its LICENSE permits redistribution as part of an installer, settle on a vendoring strategy (snapshot at a pinned commit vs. fetch on first run), and decide how we track upstream updates. `starter-pack.md` topic.
- **Frontmatter skeleton fields.** Minimal (`name`, `description`) or richer (`name`, `description`, `tools`, `model` placeholder)? Probably content of `creation-spec.md`.

## Phases

| Phase | Focus | Approval gate |
|---|---|---|
| 1. Decisions + spec | Four product decisions settled (above). Remaining work: write `creation-spec.md` and `starter-pack.md` under this sprint folder. | Jarmo signs the specs |
| 2. Implementation — Tier 1 | Empty state, `+`, row menu, *New blank* command, file watcher. | qa-validator |
| 3. Implementation — Tier 2 | Skeleton, duplicate, scope move, starter pack, sort. | qa-validator |
| 4. Validation | Build, smoke test, confirm no regressions in Sprint 54 surfaces. | qa-validator + Jarmo manual test |

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Scope drifts to include *Try it* or capture-from-conversation | HIGH | Out-of-scope list explicit; reject in PR review. |
| Starter pack becomes a maintenance burden | MEDIUM | Cap at 5; treat as exemplars, not curation. |
| Skeleton schema diverges from upstream Claude Code skill/agent format | MEDIUM | Treat the schema as canonical to upstream; re-derive on each upstream sync. |
| *Skill vs agent* creation choice confuses non-Viktor users | LOW | Sprint targets Viktor + the halfway user. Newbie-friendly creation is later. |

## Invariants This Sprint Must Uphold

1. **File-first truth** — agents and skills remain markdown files; creation is a thin authoring shell over the filesystem, not a proprietary management model.
2. **Editor-first workflow** — every new file ends up open in the existing markdown editor.
3. **Generic frontmatter** — the Properties panel does not become agent-only; *Try it* is the only agent-specific affordance.
4. **No regressions** — AgentSelector, ChatView, Flows, Sprint 54 sidebar/Properties behavior remain stable.
5. **Round-trip** — anything authored through this UI must remain a normal `.md` file readable and editable outside Ritemark.

## Key Files

| File | Purpose |
|---|---|
| `extensions/ritemark/src/views/AgentLibraryViewProvider.ts` | Sidebar host. `+`, empty-state buttons, row context menu wire here. |
| `extensions/ritemark/src/agent/discovery.ts` | Discovery; gains file-watcher integration. |
| `extensions/ritemark/webview/src/components/properties/AddPropertyMenu.tsx` | Existing primitive likely reused for skeleton injection. |
| *(new)* `extensions/ritemark/starter-pack/` | Seeded on first run. |
| *(new)* `docs/development/sprints/sprint-56-agent-authoring-loop/{creation-spec,starter-pack}.md` | Phase 1 deliverables. |

## Status

**Current Phase:** Phase 1 — spec drafting (the four product decisions are now settled)
**Current Branch:** `claude/design-agents-skills-ui-ARdo7`
**Next Step:** Draft `creation-spec.md` and `starter-pack.md` under this folder. `creation-spec.md` covers per-section `+` affordances, the empty-state two-button layout, the new-file flow (skeleton + filename derivation), the duplicate / scope-move / delete row actions, and the file watcher. `starter-pack.md` decides which 3–5 helpers ship as seeds.

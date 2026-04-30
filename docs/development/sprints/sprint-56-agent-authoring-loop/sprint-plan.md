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
| 1 | Empty state shows action buttons (*New skill*, *New agent*) instead of "add files to `.claude/`" | Current copy tells the user to open a terminal. |
| 2 | `+` affordance in the Agent Library header | A populated library has no way to add. |
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
| Description-quality coach | High leverage, but only earns its keep once authoring volume is real enough to surface the silent-failure mode. Wait for telemetry. |
| Template chooser / template gallery | Premature curation. Ship the starter pack (#9) first; let actual usage signal what templates would even be. |
| Builder agent (conversational creator) | Repositioned as a coach, not an entry point. Same gating as the description coach. |
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

## Open Product Decisions to Resolve in Phase 1

These are not analysis-doc gaps — they are decisions this sprint must make before implementation. Each has a recommendation; Jarmo signs.

1. **Default scope for new files** — project (`.claude/`) or user (`~/.claude/`)? Lean: project, with a one-click promote.
2. **Skill vs agent at the create moment** — ask up front, or infer from intent questions? Lean: ask, but with plain-language labels (*"Always behave a certain way" / "Run something in the background"*).
3. **Starter pack contents** — which 3–5 helpers ship as the first-run seed, and where do they live in the repo? Lean: a curated set under `extensions/ritemark/starter-pack/` copied on activation.
4. **Delete safety** — trash to a recoverable folder, or hard-delete with confirm? Lean: trash, recoverable, no audit log yet.

## Phases

| Phase | Focus | Approval gate |
|---|---|---|
| 1. Decisions + spec | Settle the four open product decisions; write `creation-spec.md` and `starter-pack.md` under this sprint folder. | Jarmo signs the specs |
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

**Current Phase:** Phase 1 — decisions + spec drafting
**Current Branch:** `claude/design-agents-skills-ui-ARdo7`
**Next Step:** Resolve the four open product decisions with Jarmo, then draft `creation-spec.md` and `starter-pack.md` under this folder before any implementation begins.

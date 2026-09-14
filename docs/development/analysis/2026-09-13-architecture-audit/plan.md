# Ritemark architecture audit

## Current direction — user review checkpoint

Jarmo explicitly clarified that the task is a strategic architecture audit,
not diagnosis or repair of current bugs. It must offer a solution from product
principles through the domain model and target architecture to a migration
strategy, with a reasonable balance of abstraction and detail. The primary
deliverable is now [the target architecture and transition strategy](conclusions.md).
It uses the existing map, report and evidence. No new code investigations,
experiments or implementation are part of this synthesis. Unverified behavior
remains unverified; historical test lists below do not authorize further work.

Status: in progress — whole-system source/component assessment, macOS document
recovery, two-window document protection and duplicate scheduled execution recorded;
controlled two-host conversation storage/restore and actual browser dispatcher
consent/queue/target probes recorded. Actual speech providers also reproduced lost
speaker changes and false recovery of a live peer job, with a synthetic engine
boundary. Actual warm Markdown open metrics now isolate script execution from
resource loading in six fresh-process trials; separate profile/coverage captures
identify initialization beyond this document's content. Remaining native lifecycle,
crash variants and Windows evidence are
tracked in coverage.md.
Date: 2026-09-13
Owner: Jarmo (product direction and decisions); Codex (audit).
Branch: `codex/architecture-audit`
Baseline: `30ea2ab32d15be161991d1bb8924a4c4ca331f8c` (local `main` and `origin/main` at worktree creation; no remote freshness claim).
Worktree: `/Users/jarmotuisk/Projects/ritemark-dev/ritemark-native/.worktrees/architecture-audit`

## Mandate and product direction

Jarmo authorized this separate worktree and the start of the audit on 2026-09-13.
This is cross-release research, not implementation of a release-bound sprint.

Ritemark is an agentic knowledge-work tool, independent of agent runtime and
covering knowledge work across file formats. Work happens in data/knowledge
spaces of different scope: folders and projects backed by local or cloud file
systems. Its distinguishing product experience is collaboration around a
concrete, visible document and file tree/knowledge space. Both the human's work
and the agent's work must be intelligible in that shared context.

VS Code/Electron remains the assumed foundation. Revisit it briefly only if
specific evidence reveals a material contradiction with the product strategy.
Do not turn this audit into a speculative platform replacement project.

## User-reported concerns (initial input; current evidence is tracked below)

1. Slow loading on weak Windows computers.
2. Startup visibly jumps from a terminal to the AI conversation pane; a shell
   layout/startup remnant is suspected, not established.
3. Concurrent writes: a human edits in the editor while an agent, or another
   external actor, overwrites the file on disk. Investigate data preservation,
   conflict handling, and the need for real-time collaboration.
4. A prior discussion cited a shared 8.4 MB `webview.js` and the risk of adding
   PPTX rendering/ECharts to every Markdown document. Verify the checked-in
   baseline and dependency paths before treating that figure or attribution
   as current measured evidence.

## Audit requirements

- The visible document and knowledge space are shared work context.
- Runtime adapters must preserve common document, permission, cancellation,
  and collaboration rules; differences in native capabilities remain explicit.
- Format-specific editors share coherent lifecycle/conflict expectations;
  format independence does not imply identical editing capabilities.
- Local and cloud storage need explicit identity, version, capability, and
  failure semantics. Cloud-synced local folders and non-file URI providers are
  distinct scenarios.
- Common workflows must remain responsive on representative weak Windows
  hardware, including when AI is unavailable or not in use.
- Repeated open/close, cancellation, failure, and restart must preserve user
  work and release bounded resources.

## Scope and work order

### 0. Establish evidence baseline

- [x] Create an isolated worktree at a recorded commit.
- [x] Preserve the primary checkout and its existing untracked release plans.
- [x] Read repository guidance and begin with the architecture document.
- [x] Record initial source/package inventory, relevant dependencies, and artifact sizes.
- [x] Map standard/additional test commands and review Sprint 115 live evidence.
- [x] Build actual dependency graph and attribute a reproducible production webview.
- [x] Reproduce shared-state and trust-boundary failures using synthetic component fixtures.
- [x] Write whole-system ownership map, subsystem coverage and interim synthesis.
- [x] Verify the actual loaded audit extension in a compatible isolated macOS shell.
- [x] Reproduce pane transitions, XLSX external overwrite and CSV row truncation; validate Markdown split/conflict/recovery paths within one host.
- [x] Record actual process/resource inventory and darwin-arm64 manifest version/help/signature checks.
- [x] Validate durable Markdown/XLSX recovery in normal extension mode and ordinary Save after recovery.
- [x] Validate two-host Markdown conflict protection and reproduce duplicate scheduled Flow execution across workspace aliases.
- [x] Exercise actual Codex/ACP native connection initialization, outstanding requests on crash, restart and dispose; record ACP cold-start race and successful controls.
- [x] Exercise draw.io external change/autosave and reopen, PDF/DOCX reference preview and actual change/delete messages, explicit reload controls and 20-page PDF canvas retention.
- [x] Exercise the actual AI webview HTML/CSS/CSP boundary with synthetic projection messages: action-control styling, locally intercepted HTTPS image, blocked inline handlers, escaped user markup and restoration controls.
- [x] Exercise shared conversation storage through actual cached controllers in two same-scope no-folder hosts: successful sequential/single-host controls, controlled lost preference/result writes, both webview readbacks and persistence after verified shutdown/restart.
- [x] Exercise actual cached browser dispatcher through shell/Playwright: observed read/control consent, delayed-action queue, same-tab stale target, pending revocation and denied-response metadata. Synthetic callers only; hidden revocation handler and unobserved initial grants are explicitly scoped.
- [x] Exercise actual speech providers/job managers/stores in two normal-mode hosts: single-host pipeline/view and sequential rename controls; false peer-job interruption, owner completion, two acknowledged conflicting snapshot writes and both real view readbacks. Preserve engine-stub and initial harness-error limits; verify cleanup.
- [x] Measure six warm Markdown openings at alternating 1×/4× renderer CPU in a fresh process without profiling, with visible active frames and pre-request metrics. Separate profile/coverage evidence, calibration failures, macOS occlusion control and Windows/cold-launch limits; verify both process trees stopped.
- [ ] Complete remaining native application and representative Windows measurement evidence.

### 1. System and ownership map

Map shell/extension/webview/process boundaries, document identity and ownership,
workspace scoping, runtime lifecycle, storage, browser/tools, flows, exports,
binary dependencies, updates, and build/patch ownership. Label intended design
separately from source-verified behavior. Use change history where it clarifies
actual coupling or recurring defects.

### 2. Document integrity and concurrent actors — first deep investigation

Trace read/edit/save/external-change/conflict/recovery paths for Markdown, CSV,
XLSX, draw.io and other supported formats. Include multi-view and multi-window
behavior, two agents, external replacement/delete/rename, interrupted saves,
stale agent reads, and cloud reconnect.

Record the owner, authority and preconditions for every write path. Distinguish
conflict detection, recovery, prevention and atomic compare-and-swap. An
approval prompt is not a stale-write guard. Filesystem watchers are not a
collaboration protocol. Uncooperative external writers cannot be assumed to
participate in a lock or broker.

Evaluate optimistic version checks, mediated writes, merge strategies, and
CRDT/OT only against explicit collaboration requirements and measured gaps.

### 3. Startup and loading on weak Windows hardware

Map the sequence from process creation to stable workspace, visible document,
and responsive input, with the AI pane in a known state. Trace layout defaults,
persisted restoration, extension activation, webview entrypoints and runtime
probes. Attribute dependencies to the workflows that load them.

Measure cold and warm launch, first/repeated document open, input blocking,
CPU, process memory and repeated open/close. Compare clean and existing user
profiles, AI offline, and multiple open documents. Use the same packaged build,
hardware, fixtures and sample protocol for comparisons. Separate process-cold
launch from OS-cache-cold launch and report variance.

No startup timing target or acceptable memory ceiling has been agreed yet;
record the baseline and propose budgets rather than invent pass/fail targets.
Mac/source evidence cannot establish a Windows performance result.

### 4. Runtime, format and storage independence

Use three change probes: add a runtime, add a format, add a cloud knowledge
space. Identify the contracts and the edits each change would require. Check
runtime-specific branches, cross-boundary message validation, attachment
capabilities, workspace identity, URI-versus-path assumptions, approvals,
cancellation, error isolation, and consistent document context.

### 5. Maintainability, security and delivery

Assess change coupling, duplicated rules, large responsibility owners, test
seams, resource lifecycle, subprocess isolation, trust boundaries and secrets.
Include the VS Code patch burden, package/binary provenance, reproducible
builds and shell/extension update compatibility. Deepen investigation based on
impact and uncertainty instead of assigning equal line-by-line review effort.

### 6. Synthesis and bounded follow-up work

For each significant finding record the trigger, source/evidence, user impact,
root cause, confidence, affected formats/runtimes/platforms, existing coverage,
solution alternatives, costs and a verification criterion. Prioritize work
preservation first, then startup/performance, then extensibility/maintenance.

Recommend separate release/sprint work for implementation. Do not silently
turn audit experiments into production changes.

## Evidence and reporting rules

- Source evidence is pinned to the baseline above with file/line references.
- Historical docs, user reports, static paths, executed tests and runtime
  measurements are distinct evidence classes.
- Record important counterevidence and current safeguards, not just deficits.
- Binary size does not prove startup cost; file counts do not prove coupling.
- Do not claim an end-to-end guarantee based on a pure state-machine test.
- Every unresolved hypothesis carries the next experiment needed to resolve it.
- Use synthetic documents for destructive/race scenarios. Do not operate on
  the user's live knowledge spaces or credentials.

## Environment and constraints

The worktree now has independent extension/webview locked dependencies and uses
Node 22.22.1 from .nvmrc on arm64 macOS. Extension compilation, standard component
tests and repository QA passed. A production webview rebuild reproduced the
checked-in SHA-256. The audit VS Code submodule is not initialized. A compatible
installed shell has now run with the audit extension and an observational driver;
source provenance, unchanged shell inputs and the actual loaded extension path
are recorded. This is not a fresh release build. Native darwin-arm64 validation
commands and strict codesign verification passed. Extension development mode
skips durable backups. A subsequent independent normal-mode extension staging
verified persistent Markdown/XLSX backups, restoration after CDP close/reopen,
and Save of the recovered work. This does not cover every native crash/quit variant.
No dependencies or build outputs were linked from the primary checkout.

Packaged Windows measurements require a representative Windows machine and
recorded build provenance; availability has not yet been established. Continue
independent source analysis while tracking that measurement requirement.

Untracked v1.11.0/v1.12.0 planning files in the primary checkout are not part of
this baseline and were not copied. Consult them separately with their provenance
if later product-roadmap comparison is needed.

## Deliverables

- [Target architecture and transition strategy](conclusions.md): product principles, domain model, proposed responsibilities, alternatives/tradeoffs and staged migration; start here.
- [Whole-system report](audit-report.md): product alignment, strengths and systemic/local findings.
- [System map](system-map.md): responsibilities, boundaries and dataflows.
- [Coverage](coverage.md): every subsystem, three change probes and completion ledger.
- [Findings](findings.md): evidence-backed observations and open hypotheses.
- [Evidence](evidence/README.md): baseline inventory and reproducible checks.
- [Live observations](live-observations.md): application outcomes, counterevidence and harness limitations.
- [Normal-mode observations](normal-mode-observations.md): persistent recovery, two-window document protection and shared Flow ownership.
- [Native runtime observations](native-runtime-observations.md): real binary connection lifecycle, ACP initialization race and counterevidence.
- [Format observations](format-observations.md): draw.io graph loss, preview freshness and PDF rendering lifetime with memory counterevidence.
- [Performance observations](performance-observations.md): fresh-process warm Markdown timing, renderer CPU sensitivity, separate initialization profiles and calibration limits.
- [Recommendations](recommendations.md): synthesis and staged follow-up work.

## Completion conditions

Under Jarmo's explicit clarification, completion means a whole-system assessment
with a traceable strategic solution: product-derived principles, domain/state
ownership, target components and process boundaries, alternatives and tradeoffs,
and a staged transition using the existing platform and components where sound.
The proposed architecture must be distinguished from current implementation.
Measurement gaps constrain claims about performance and native behavior; they
do not turn this audit into exhaustive runtime testing. No bug diagnosis,
repair, implementation, release readiness or invented performance guarantee is
part of the requested end state.

No user-facing behavior is changed by these research documents, so no changelog
or release-note update is appropriate at this stage. No commit, push, release,
or implementation is part of this setup.

## First-pass checkpoint — 2026-09-13

- Recorded 8,844,955-byte shared webview artifact and the current single-IIFE
  build configuration. No ECharts-named entry in the webview lockfile.
- Traced terminal creation at 2,500 ms and AI focus at 4,000 ms, alongside the
  shell's AI-pane default. Source evidence supports an explicit startup sequence
  hypothesis; packaged timing is still required.
- Compared existing Markdown/CSV coordination with XLSX direct buffer saves and
  the ACP approved-write path. Logged A01–A05 with counterevidence and next tests.
- Recorded runtime path versus URI-based project identity as a strategy gap to
  investigate for cloud/multi-root knowledge spaces.
- Ran repository QA: fixture suites and pre-commit validation passed; the full
  command exited 1 in `validate-chrome-fast.sh` because the uninstalled extension
  dependencies contain no Phosphor source font. See evidence; this is not a
  successful application QA run.

The first-pass checkpoint above is historical. See evidence/README.md for the
subsequent successful checks and experiments, and coverage.md for the current
completion audit. The subsequent app passes are recorded in live-observations.md
and normal-mode-observations.md. Normal staging, persistent recovery and the
document/scheduler two-window cases are completed with their stated limits.
Continue native/tool lifecycle, remaining resource ownership cases and
representative Windows measurement work.
All commands continue to use the worktree above, not the primary checkout.

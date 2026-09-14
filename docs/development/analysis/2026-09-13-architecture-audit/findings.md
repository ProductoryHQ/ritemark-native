# Findings and investigation register

Status: whole-system source/component assessment plus verified macOS application cases, including normal-mode recovery and document/scheduler multi-window tests. Native Codex/ACP connection lifecycle tested; ACP cold-start race added as A15. Actual conversation storage/restore and transcript multi-window rename/recovery cases are recorded with controlled ingress limits. Native model/tool lifecycle, additional crash variants and Windows measurements remain open. See [audit-report.md](audit-report.md), [live observations](live-observations.md) and [native results](native-runtime-observations.md).
Further [format cases](format-observations.md) add draw.io graph loss (A16),
PDF/DOCX stale visible state (A17), working reload/round-trip controls and a
20-page PDF resource observation with memory counterevidence.
[Browser cases](browser-observations.md) add A18/A19 and working consent/queue
controls; [speech cases](speech-observations.md) strengthen A06 and add A20.
Baseline: `30ea2ab32d15be161991d1bb8924a4c4ca331f8c`.

Evidence classes: user report; documented design; static source observation;
executed component test; application reproduction; packaged measurement.

## Questions opened from user input

| ID | Question | Current evidence | Next step |
| --- | --- | --- | --- |
| Q1 | Can concurrent human/agent/external changes lose work? | Writer map, component races, app XLSX overwrite and Markdown conflict/recovery controls; CSV hidden-row loss has a separate cause | Native model/file-tool writers, remaining shared-store and filesystem-event cases |
| Q2 | What delays weak-Windows startup and document loading? | Reproduced bundle, import attribution, actual macOS resource loads/process inventory; no Windows CPU attribution | Controlled packaged startup/input samples on representative Windows hardware |
| Q3 | What causes the terminal-to-agent-pane startup jump? | Shell defaults and competing timers traced; two dev launches show the sequence; normal-mode sample differs | Input-focus interference and offline/Windows samples |
| Q4 | How independent are runtime, format and storage integrations? | Whole-system ownership/contract map and three source-based change probes; native initialization comparison | Complete the remaining application-boundary evidence in coverage.md |

Findings below carry explicit evidence, scope and confidence. Existing safeguards
and contrary evidence belong beside each finding; the table summarizes current
progress rather than resetting completed investigations to a future plan.

## A01 — XLSX saves have no provider-level external-version precondition

Priority: high integrity defect. Evidence: static source path and two actual
macOS application reproductions with the audit extension. Confidence: high
for ordinary Save after external replacement; concurrent-write timing and
Windows behavior require separate checks.

Trigger: edit an XLSX workbook in Ritemark, let another actor replace its disk
contents, then save the stale in-memory workbook.

`saveCustomDocument()` calls `writeFileSuppressingWatcher()` with the complete
document buffer. That helper calls Node `fs.writeFile()` without comparing a
retained disk version or hash. Its watcher ignores all changes while the path
is in `savingFiles`, including the 1,000 ms period after the write. External
changes outside this window produce a refresh notification, not a save
precondition. This is a materially weaker write contract than Markdown/CSV.

Evidence: [excelEditorProvider.ts](../../../../extensions/ritemark/src/excelEditorProvider.ts),
lines 180–187, 200–210, 263–274 and 427–455.

Safeguards already present: refresh of a dirty workbook requires explicit
discard confirmation (lines 122–135); backup/revert exist; only one custom editor
per document is supported; XLS is read-only. These do not supply a stale-version
check in the inspected save callback. Do not claim they are absent.

Observed impact: an external actor's workbook changes were replaced by an
older local buffer in both synthetic runs. Whether the user's reported incident involved XLSX is
unknown. No claim that all formats have the same defect.

Application evidence: [first run](evidence/live-excel-probe.json) and
[repeat](evidence/live-excel-repeat-probe.json). Real table input made the custom
document dirty. A separate filesystem writer saved a different cell value;
Refresh indicated the external change. Ordinary workbench Save returned success,
made the tab clean and overwrote the external value. No confirmation action was
performed between Save and completion. The repeat separately checked modal UI;
the first harness had incorrectly named nonmodal role=dialog notifications.

Normal-mode counterevidence: an unsaved XLSX cell survived persistent backup,
application close/relaunch and ordinary Save; see [normal recovery](normal-mode-observations.md).
Remaining verification: replacement during write and the watcher suppression
window, native Quit/OS-crash variants, and Windows filesystem behavior.

## A02 — Startup view ownership is split between the shell and timed commands

Priority: medium user-experience defect. Evidence: static source, patches and
two macOS launch sequences. Confidence: high for the observed focus transitions;
their Windows timings and user-input interference remain unmeasured.

At extension activation, a timer unconditionally focuses `ritemark.unifiedView`
after 4,000 ms. A second timer, registered later, focuses the auxiliary bar and
creates a terminal after 2,500 ms if no terminal exists. These delays are relative
to timer registration, not guaranteed launch-to-display timings.

Evidence: [extension.ts](../../../../extensions/ritemark/src/extension.ts),
lines 305–308 and 508–518. The latter is adjacent to a contrary comment saying
that AI is not auto-shown (505–506); executable behavior is the authority here.

Shell evidence: [002-ritemark-ui-layout.patch](../../../../patches/vscode/002-ritemark-ui-layout.patch),
lines 780–793, clears the auxiliary bar's saved active composite and sets the AI
container as its default. Thus layout intent is already encoded in the shell,
while extension timers actively change it after activation.

Impact: a concrete mechanism consistent with terminal-to-AI jumping and possible
late focus stealing. It is Ritemark-specific startup logic; do not attribute it
solely to stock VS Code. Existing-terminal sessions follow a different branch.

Next verification: timestamp shell restoration, view registration and both
commands in clean and established profiles; include a user typing before the
4-second timer and an AI-offline launch. Establish one lifecycle owner and an
event-based transition contract before proposing a production fix.

Actual sequence: [fresh-profile run](evidence/live-startup.json) observed terminal
focus at 4,528 ms and AI focus at 9,552 ms; [same-profile restart](evidence/live-restart-probe.json)
observed terminal focus at 4,155 ms and AI focus at 5,512 ms. These are individual
instrumented macOS functional samples, not a performance distribution or proof
that AI initialization accounts for the entire interval. In the first normal-mode
27-second sample the terminal was the last observed focused pane from 6,763 ms;
no AI state was captured. Do not assume a fixed transition order across starts.
See [normal startup](evidence/normal-startup-probe.json) and
[selected logs](evidence/normal-log-observations.json); no CPU attribution follows.

## A03 — Shared IIFE prevents feature-level script delivery isolation

Priority: measured performance/extension-boundary work. Evidence: static
configuration, import paths, reproducible bytes and actual warm-view timing.
Confidence: high for packaging and this measured macOS case; cold launch,
physical memory and weak-Windows cost shares remain unmeasured. An actual production rebuild now reproduces the checked-in bytes and SHA-256 exactly; [webview-build.json](evidence/webview-build.json) records the module attribution and absence of chunk imports.

[vite.config.ts](../../../../extensions/ritemark/webview/vite.config.ts), lines
28–35, configures one `main.tsx` entry, IIFE output and `inlineDynamicImports: true`.
[main.tsx](../../../../extensions/ritemark/webview/src/main.tsx), lines 1–4 and
49–83, imports `App` eagerly and declares several React-lazy surfaces.
[App.tsx](../../../../extensions/ritemark/webview/src/App.tsx), lines 10–13,
statically imports the Markdown editor, spreadsheet viewer, PDF and DOCX viewers.
Their modules import SheetJS, react-pdf, docx-preview and mammoth. FlowCanvas also
imports ELK. Source-level `lazy()` therefore does not establish separate
downloadable/evaluable feature bundles under this build configuration. Rendering
and individual heavy operations may still be deferred; do not claim every
renderer fully executes merely because its code is delivered together.

The checked-in artifact is **8,844,955 bytes (8.85 MB decimal / 8.44 MiB)**.
SHA-256 and inventory are in [baseline.json](evidence/baseline.json). The PDF
worker is separately present at 1,046,214 bytes. That worker's size must not be
added to every Markdown load without observing a worker request.

The common script is referenced by the Markdown, Excel, PDF, DOCX, AI sidebar,
settings, flow and transcription providers. This is shared resource delivery
per webview, not proof that physical memory grows linearly with its byte size;
Chromium caching and execution behavior need measurement.

[Live resource entries](evidence/live-runtime-inventory-probe.json) now confirm
the 8,844,955 decoded bytes in AI, Markdown and XLSX webview contexts. None of
those inspected contexts requested the PDF worker. Resource loading duration
and transferSize=0 are not measures of evaluation CPU or physical memory.

[Format-viewer observations](evidence/formats-preview-probe.json) confirm the
same shared script in PDF and DOCX. A separate 20-page PDF experiment found
that visited canvases stay mounted when returning to page one; `LazyPage` is
initial render deferral, not eviction of previously loaded pages. The paired
RSS/JS-heap snapshots did **not** demonstrate a corresponding memory increase.
The calculated 160,221,600-byte RGBA surface area is not allocated memory;
see [resource analysis](evidence/formats-pdf-resource-analysis.json). Entry
delivery and page-cache lifetime need separate measurements and budgets.

Counterevidence/context: draw.io is separately vendored/hosted. Webview bundle
debt is already recorded in the baseline architecture document as issue #107;
its remote status was not queried. No package named ECharts appears in the
webview lockfile. The original PPTX/ECharts concern described an addition risk,
not evidence of an already installed PPTX/ECharts renderer.

An actual fresh-process warm-view measurement now separates local resource load
from script execution. Six openings of a 79-byte Markdown document used new,
visible editable webviews, alternating normal and 4× renderer CPU throttling.
Median open-to-ready was 469 / 1523 ms, ScriptDuration 301 / 1346 ms, and local
script resource load 88 / 92 ms. Longest-task medians were 273 / 1207 ms. The
final process never enabled CPU profiling or precise coverage; every metric
baseline preceded the bundle request. These are controlled macOS sensitivity
measurements with focus emulation and warm caches, not Windows benchmarks or
whole-app launch measurements. See [method and limits](performance-observations.md).

Separate profile/coverage captures in the previous process show executed ELK
loader and parser initialization during this diagram-free opening. About 28.1%
of bundle UTF-16 ranges executed; unexecuted code is not all removable. Profile
overhead and late capture are explicitly separated from final timing results.
The evidence supports measuring and separating initialization as well as bytes;
it does not promise a package-specific percentage saving.

Next verification: compare feature entrypoints or real chunking with the same
packaged fixtures, then measure cold launch/input and browser/GPU resource
accounting on representative Windows hardware.
First-open feature latency and cache/CSP/update behavior belong in that comparison.

## A04 — Knowledge-space identity is broader than current execution/storage paths

Priority: strategic capability gap. Evidence: static contracts. Confidence: high
for the inspected paths; this is not a claim that a shipped cloud feature is broken.

The conversation scope resolver can represent workspace files, multiple folders,
and non-file URIs. Runtime sessions instead receive one `workspacePath: string`,
and startup captures the first workspace folder's `uri.fsPath`. The Markdown/CSV
coordinator reconciles disk only for `file:` URIs and reads via Node fs. XLSX
also uses `uri.fsPath` with Node fs for read/write/backup.

Evidence:

- [projectScope.ts](../../../../extensions/ritemark/src/conversations/projectScope.ts), lines 19–64.
- [AgentRuntime.ts](../../../../extensions/ritemark/src/runtime/AgentRuntime.ts), lines 93–105.
- [extension.ts](../../../../extensions/ritemark/src/extension.ts), lines 346–348.
- [DocumentSyncCoordinator.ts](../../../../extensions/ritemark/src/editorSync/DocumentSyncCoordinator.ts), lines 501–507 and 903–927.
- [excelEditorProvider.ts](../../../../extensions/ritemark/src/excelEditorProvider.ts), lines 56–65 and 200–246.

Impact: a strategy covering provider-backed cloud spaces needs an explicit
execution/materialization and versioning contract. A cloud-synced local folder
can still be a normal `file:` path; it must not be confused with a remote URI
provider. A local subprocess cwd is itself a legitimate requirement.

Next verification: distinguish synchronized local folders, mounted filesystems
and virtual/cloud URI providers; trace multi-root selection and runtime
permissions. Compare a local materialization layer, brokered file tools and
native provider support against the actual product requirements. No conclusion
here requires replacing Electron/VS Code.

## A05 — ACP approval and document-version validation are separate concerns

Priority: high integrity investigation. Evidence: one source-verified agent write
path; remaining native runtime tool paths need separate tracing.

[acpFsProxy.ts](../../../../extensions/ritemark/src/acp/acpFsProxy.ts), lines
104–134, reads text and later approves a write, then writes the supplied full
content. The inspected path does not pass or validate the revision of the prior
read. Its default backend (160–177) writes a local-file URI through
`vscode.workspace.fs`. User approval is an authorization check, not proof that
the submitted contents include another actor's intervening edits.

Counterevidence: workspace bounds and write approval exist. Markdown/CSV's
coordinator separately detects disk/model divergence and can preserve conflict
snapshots. A write mediation design must preserve these protections. The
coordinator's per-URI map is in one extension-host instance, not a proven
cross-window or cross-process lock.

Next verification: exercise read → human change → approved write, including
changes while approval is pending. Distinguish unsaved human edits (which may
surface a conflict) from saved human edits (where a stale full replacement can
appear as an ordinary external update). Trace Claude/Codex native editing and
shell tools before proposing a common write contract. The need for CRDT remains
an open design question.

## Baseline strengths and documentation caveats

- Markdown/CSV already has per-URI queues, per-view epochs/revision receipts,
  three-way state and explicit conflict actions. `keep-local` checks the exact
  disk validator and verifies after writing; its final check/write interval is
  not atomic CAS (coordinator, lines 410–498).
- The audit's own Markdown app cases preserve conflict versions, apply use-disk,
  deliver peer changes to a second split view, and complete keep-local with both
  tabs clean. Workbench Undo recovers the prior human text; editor-focused Cmd-Z has
  different history semantics. CSV shares the coordinator but A14 shows that
  transport integrity cannot protect against a truncated renderer payload.
- Runtime construction and capability metadata are centralized in
  `runtime/runtimeFactory.ts` and `runtime/capabilities.ts`; evaluate remaining
  coupling without assuming that no runtime abstraction exists.
- The inventory contains 189 extension and 197 webview non-test TypeScript
  files, plus 132 TypeScript test files across both trees. File/line counts are
  scope indicators, not quality grades or coverage measurements.
- Some architecture sections retain historical AS IS/TO BE claims and sizes.
  For example, the document quotes a 1,097-line `UnifiedViewProvider`, while
  this baseline contains 2,485 lines and the debt section acknowledges regrowth.
  Verify responsibilities before recommending extraction based on length.
- The development README names Node 22.21.1; root `.nvmrc` pins 22.22.1. The
  initial shell Node was 22.21.1. This audit subsequently selected installed Node 22.22.1 for dependency installation, component tests, compilation and the production webview rebuild. No Windows timing claim follows from those checks.

## A06 — Shared durable state has only instance-local serialization

Priority: high, systemic integrity. Evidence: actual-source component
reproductions, actual two-window scheduled execution, and controlled storage
interleavings in two production extension hosts followed by real UI reads and
restart, plus actual transcript-provider writes in two hosts. Confidence: high
for the reproduced boundaries. Native model delivery and natural race frequency
are untested.

Three different subsystems apply similar assumptions at different scopes:

- `ConversationStore` serializes mutations with its own `mutationTail`. Expected
  revision is read, then the record is written through unique temp + rename.
  Two stores over the same directory can both pass the same revision check.
  The deterministic barrier experiment returned success/revision 2 to both
  writers, but disk retained only one actor's appended event. An acknowledged
  event was lost. Rename atomicity prevents a partial file, not this lost update.
- Speech `SessionStore.save` writes a fixed target `.tmp`, then renames it. Ten
  two-save experiments produced one ENOENT per pair; some final content belonged
  to the writer whose promise rejected. This can occur within one Store object.
  Workbench speaker rename and asynchronously generated insights both perform
  read/modify/save on a complete session, so the component has real overlapping
  consumers, not only a hypothetical second window.
- Two `FlowScheduler` instances reading shared synthetic schedule state both
  started the same due slot. Each has its own running set; writing a slot marker
  is not an atomic claim of that slot.

Evidence: [concurrency-probes.cjs](evidence/concurrency-probes.cjs) and
[results](evidence/concurrency-probes.json);
[ConversationStore](../../../../extensions/ritemark/src/conversations/ConversationStore.ts),
checkpoint at 278 and atomicWrite at 709;
[SessionStore](../../../../extensions/ritemark/src/speech/SessionStore.ts), save at 56;
[workbench](../../../../extensions/ritemark/src/transcriptWorkbenchProvider.ts),
speaker rename at 157 and insight persistence at 253;
[FlowScheduler](../../../../extensions/ritemark/src/flows/FlowScheduler.ts).
UnifiedViewProvider constructs a store under globalStorage, and speech startup
uses the same host-provided global storage root. Scheduler state is a separate
workspace Memento; the experiment injects shared state, not a real VS Code DB.

Counterevidence: ConversationStore has schema checks, binding/revision checks,
quarantine, tombstones and unique temp files. Scheduler prevents duplicate work
inside one instance. JobManager explicitly recovers interrupted jobs. Preserve
these protections while extending their ownership scope.

The one-Store control confirmed that scope difference: one concurrent stale
checkpoint was rejected, and retrying it against the refreshed revision retained
both actor events at revision 3. The loss is not a claim that normal serialized
appends are broken.

Actual conversation storage: [two-host observations](shared-store-observations.md)
used two no-folder windows with the same verified scope and global store path.
The audit observer accessed already-loaded provider/controller/store instances;
it did not create replacement product objects. Bounded holds on only fixture
record renames let both hosts prepare revision 2 from revision 1. Different
composer preference updates both returned success, but only the later one
survived. More significantly, a real `completeRuntimeTurn` checkpoint first
returned and durably stored an assistant response with an idle lifecycle;
the other host's prepared preference update then replaced it with the old
one-event/working record, also returning success at revision 2.

Both controllers subsequently read the missing response, both actual webviews
displayed the reduced transcript through host postMessage, and a new app/host
process still read no assistant response. Sequential two-host and concurrent
one-host preference controls retained both independent fields at revision 3.
The controller's five-attempt stale-revision retry cannot act when neither
writer receives a stale-revision error. A provider-local checkpoint queue also
cannot serialize a second process.

This is an instrumented real-host storage test, not an ordinary mouse/model
end-to-end run. Native completion ingress was synthetic, and rename timing was
deliberately controlled; native dispatch count stayed zero. The initial UI
lookup failed after storage cases had finished; a separate ready-view follow-up
completed without redoing the storage mutations. Folder and workspace-file
aliases have different conversation scopes, so that earlier scheduler scenario
alone did not establish shared-conversation access. Scope checks are preserved.

Actual transcript storage: [speech observations](speech-observations.md) used the
existing registered providers and SessionStores in two normal-mode hosts. The
sequential control preserved both speaker labels. Two fixture-only holds just
before original save calls captured full-session candidates with independent
speaker changes; A was released and acknowledged first, then B. Both provider
methods completed successfully, but B's stale full record removed A's name.
Both real webviews subsequently read the loss through the production host push.
The original saves were sequential, so this demonstrates lost updates separately
from the shared `.tmp` collision. No model/insight call ran. Holds and synthetic
method ingress are explicit limits, not a claim of natural UI race frequency.

Actual app extension: [normal scheduler probe](evidence/normal-scheduler-probe.json)
opened the same folder as a folder window and through a .code-workspace alias.
Both normal-mode hosts ran one new trigger→SaveFile schedule for the same
2026-09-13T10:43:00.000Z slot. Two output files and two read-only SQLite
workspaceState snapshots each marked success prove two executions. No agent
or external service ran; the fixture schedule and temporary flag were disabled
after the observation.

This exposes a second dimension: FlowScheduleState uses context.workspaceState,
so these two workspace identities have separate markers for the same Flow path.
Even perfect atomicity inside each separate database would not deduplicate them.
The resource identity and ownership scope must be shared before a claim/lease can
protect that resource. Different intended schedules still need distinct identity.

Architectural consequence: every mutable resource needs an explicit owner and
concurrency scope (view, host, window, process, workspace, account). A single
global service is not mandatory; an atomic transaction/claim or a well-defined
single writer is. Transcript temp-name uniqueness is an immediate local repair,
but it alone does not solve stale full-session overwrites.

Acceptance: no successful durable mutation can disappear without an explicit
conflict/error; two workers cannot claim one scheduled slot; interruption at
each persistence stage recovers a complete last acknowledged state. Test the
same-store control, independent stores, independent OS processes and real windows.

The live-test preflight found another ownership mismatch to investigate:
activation confirmation is stored in profile globalState, but
`confirmActivationAndCleanup` constructs an installer rooted in the shared
`~/.ritemark/extensions` directory. A fresh user-data-dir does not isolate that
cleanup. Launch guards subsequently confirmed there were no removable version
directories before both app launches. No installation was removed; this remains
a source observation about cleanup/rollback scope, documented in
[app-preflight.json](evidence/app-preflight.json).

## A07 — Flows form a second execution and policy architecture

Priority: medium/high, systemic extensibility and lifecycle. Evidence: source,
existing FlowExecutor/runtime tests. Native execution not invoked by this audit.

`FlowExecutor` is a pure, injectable DAG runner used by scheduled/panel flows.
`FlowEditorProvider.executeFlowWithProgress` (480 onward) independently parses,
sorts and dispatches nodes. It passes `undefined` AbortSignal to Claude/Codex
executors. LLM/image/save nodes in the common executor also do not receive a
signal, so cancellation checks between nodes do not imply cancellation of an
active external request.

The Claude node calls `runAgent`; the Codex node creates its own app-server,
registers result listeners after awaited `turnStart`, and auto-approves server
requests. These paths bypass RuntimeSession. The daemon instead uses the factory
with Ask policy and blocks mutating requests in headless runs unless explicitly
allowed. These are real differences in ownership, not just separate UIs.

Evidence: [FlowEditorProvider](../../../../extensions/ritemark/src/flows/FlowEditorProvider.ts),
[FlowExecutor](../../../../extensions/ritemark/src/flows/FlowExecutor.ts),
[CodexNodeExecutor](../../../../extensions/ritemark/src/flows/nodes/CodexNodeExecutor.ts),
[ClaudeCodeNodeExecutor](../../../../extensions/ritemark/src/flows/nodes/ClaudeCodeNodeExecutor.ts),
[AgentTaskHandler](../../../../extensions/ritemark/src/daemon/handlers/AgentTaskHandler.ts).

Counterevidence: a user-started autonomous flow may intentionally approve its
work in advance. This audit does not classify all flow autonomy as unauthorized.
Dedicated native process disposal exists in the Codex executor's finally block.
The issue is whether the product exposes one clear execution policy/lifecycle
contract and verifies it for every entry point.

[flow-lifecycle-probe.json](evidence/flow-lifecycle-probe.json) exercises the
actual Codex node executor with a fake transport. A successful completion after
the awaited turnStart response is observed; the same completion before that
response is lost and the executor returns timeout. Its finally disposal works
in both cases. The probe accelerates the timer and establishes ordering
tolerance only; native protocol ordering is not yet reproduced.

Acceptance: one flow produces equivalent graph/results/policy via editor,
panel and schedule; cancellation settles active work and approvals; late native
events cannot alter a completed/cancelled run. UI lifetime must not determine
whether a background task remains observable and stoppable.

## A08 — Agent Markdown crosses the HTML/style boundary without sanitization

Priority: high trust-boundary correction. Evidence: actual React component
server-rendering and an unchanged production AI webview with its actual CSP.

`RenderedMarkdown` calls `marked.parse()` and supplies its result directly to
`dangerouslySetInnerHTML` (lines 29 and 72). GFM/break options are not a sanitizer.
The component probe preserved both a raw style element and an HTTPS image.
UnifiedViewProvider's CSP (2223) permits inline style and HTTPS images.

Evidence: [component](../../../../extensions/ritemark/webview/src/components/ai-sidebar/RenderedMarkdown.tsx),
[boundary-probes.cjs](evidence/boundary-probes.cjs),
[SSR results](evidence/boundary-probes.json),
[application observations](security-observations.md),
[application probe](evidence/formats-security-probe.json).

Application result: a synthetic assistant message's style element changed the
computed styles of the real Approve/Reject buttons and Message textarea, all
outside `.rendered-markdown`. The screenshot visibly confirms the button effect.
Replacing the message with ordinary Markdown restored those styles. User-message
raw markup remained escaped; a heading, table and inline code also rendered.

The HTTPS image reached request-stage CDP interception and loaded a 1 × 1 PNG
fulfilled locally. This establishes policy acceptance, not external DNS/TLS or
data transfer. Both image inline handlers stayed unexecuted and generated two
enforced `script-src-attr` violations. Script blocking is observed counterevidence,
not merely an inference from the CSP string.

Impact: lower-trust assistant content shares CSS authority with the AI webview's
trusted action controls. This can support misleading presentation; no actual
user deception or backend authorization bypass was tested. The experiment uses
host-shaped MessageEvent fixtures, not a native model turn or a demonstrated
host-bridge injection. Effects are proved inside the AI webview, not in the
separate workbench or other document webviews. No script or OS-code execution
was demonstrated. Approval buttons were synthetic requests and never clicked.

Acceptance: define and enforce an allowlist for rendered content and URL types;
source content cannot restyle trusted controls outside its message. Preserve
the nonce script policy and explicitly choose the external-image policy. Verify
raw HTML, SVG/style, malformed HTML, external images and ordinary rich Markdown
in both incoming and restored conversations in the real webview.

## A09 — Update manifest controls an uncontained installation root

Priority: high, local defect at a privileged delivery boundary. Evidence:
actual validator and installer using a synthetic app and user-data directory.

The manifest validator requires only a nonempty `extensionDirName`. The installer
checks it the same way, then joins it to both extensions and staging roots
(userExtensionInstaller, 140–141). It may remove an existing target that fails
its package/node_modules structural check before cloning the bundled extension.

The probe supplied `../synthetic-sibling`, with a valid delete-only file entry
and a sentinel in that sibling. Validation accepted it; applyUpdate returned
success; the sentinel disappeared. All paths were constrained to a mkdtemp
directory. No actual user installation, release or remote feed was changed.

Evidence: [manifest](../../../../extensions/ritemark/src/update/updateManifest.ts),
[installer](../../../../extensions/ritemark/src/update/userExtensionInstaller.ts),
[probe and result](evidence/boundary-probes.json).

Counterevidence: individual manifest file paths are checked twice, downloads
are checksum-verified, bundled base is required, minimum app version is checked,
and the feed comes from the configured publication channel. This is not evidence
that an ordinary document can control the updater or that a released feed is
malicious. Hashes in the same manifest do not constrain its root path.

Acceptance: require one safe directory basename of the intended extension
identity/version; resolve and contain both target and staging roots again at
mutation time before any deletion. Include separator/parent/drive/absolute
path, malformed identity, existing sibling, and Windows path tests. Preserve
the bundled-base, integrity and rollback safeguards.

## A10 — Product capability claims and execution boundaries have drifted apart

Priority: strategic contract clarification; source evidence.

The extension manifest declares virtual-workspace support and untrusted-workspace
support with the explanation that it renders Markdown and does not execute
workspace code. The product now has native agents, shell-capable flows and
scheduled jobs, while many format/storage paths still require local fsPath.
A search across extension source found no shared workspace.isTrusted gate.
Daemon workspace consent and browser consent are independent controls.

`ai/capabilityContext.ts` is a valuable single source of agent guidance, but
still defines Ritemark as a Markdown editor and file writes as the way to act.
Its safety exclusions are prose; enforcement must be evaluated separately in
each runtime/tool policy. The common RuntimeSession API and normalized project
scope already provide useful foundations for a broader contract.

Evidence: [package capabilities](../../../../extensions/ritemark/package.json),
[agent capability context](../../../../extensions/ritemark/src/ai/capabilityContext.ts),
[runtime contract](../../../../extensions/ritemark/src/runtime/AgentRuntime.ts),
and the three change probes in [coverage.md](coverage.md).

Acceptance: explicit capabilities for storage kind, format, runtime and trust
state; UI, manifest and agent guidance derive from those capabilities. Merely
opening a knowledge space must not imply consent to execute scheduled code.
Do not promise provider-backed cloud editing until materialization/versioning
semantics and failure recovery have passed their contract tests.

## A11 — Integration responsibilities concentrate in the UI/provider pair

Priority: medium maintainability, systemic boundary issue. Evidence: source,
AST dependency graph and commit history; no causal performance claim.

UnifiedViewProvider and the AI store combine runtime selection, auth/bootstrap,
conversation persistence/projection, approval routing, attachment capacity,
document context and UI state. The provider/store pair changed together in 18
of the examined 2–20-file commits. Editor send-to-agent reaches the exported
extension singleton through lazy require, creating a dependency cycle.

This does not mean these files should be split by length. The useful seams are
host-owned conversation/application operations, runtime lifecycle, context
capture and UI projection. Extract along a tested responsibility only when it
removes duplicated rules or a cross-boundary change requirement. Existing
ConversationController and pure reducer/protocol tests show that this direction
is already feasible without a platform rewrite.

Evidence: [system map](system-map.md), [graph](evidence/dependency-graph.json),
[history](evidence/change-history.json).
Acceptance: a runtime adapter or UI presentation change does not require edits
to unrelated persistence/context rules; semantic contract tests remain stable.

## A12 — Older dictation lifecycle assumes processing keeps up with capture

Priority: medium, local lifecycle/performance investigation. Source evidence,
not a user-reproduced audio-loss incident.

`voiceDictation/controller.ts` returns immediately for a new audio chunk while
`isProcessing` is true (lines 51–54). Stop changes the recording flag but does not
abort the current whisper process; temporary WAV cleanup occurs after successful
transcription rather than in finally. A slow transcription path can therefore
discard incoming chunks. The newer speech JobManager has an explicit queue and
engine cancellation, demonstrating a stronger existing pattern.

Acceptance: slow/failing transcription cannot silently discard accepted audio;
queue/backpressure is visible, stop semantics are explicit, and temporary files
are cleaned on success/error/cancel. Verify with synthetic audio and CPU pressure
on the supported dictation platform before assigning measured user impact.

## A13 — The green test command does not represent the whole contract surface

Priority: medium assurance/maintainability. Evidence: command expansion,
additional executed tests and source fixtures.

The standard pretest/test script explicitly includes 119 of 132 tracked TS/TSX
test files. Eleven additional local test files passed in this audit. Windows
bootstrap and a separate live LLM integration remain unrun here. Standard
command API cases were skipped explicitly. This is command inclusion, not a
statement or branch coverage measurement.

`RuntimeRegistry.test.ts` constructs a fixture with the former runtime-level
start/prompt/cancel API. The present interface instead requires createSession
and disposeSession. tsx transpiles without checking that type, and extension
tsconfig excludes test files; the registry test still passes because it only
uses the registry operations. `codexManager.test.ts` and `opencodeFlag.test.ts`
explicitly mirror portions of implementation. Their passing status offers
less assurance about the actual production call path than an imported contract
test. These tests are not automatically useless; their scope must be truthful.

Evidence: [test-command-map.json](evidence/test-command-map.json),
[additional-tests.json](evidence/additional-tests.json),
[runtime fixture](../../../../extensions/ritemark/src/runtime/RuntimeRegistry.test.ts),
[tsconfig](../../../../extensions/ritemark/tsconfig.json).

Acceptance: an explicit default/native/API/Windows matrix, typechecked contract
fixtures where interfaces matter, and import-based tests for policy that can
drift. Include same-process, cross-process and actual application tests at the
resource boundaries identified by this audit. Do not inflate confidence with
duplicated assertions or require every test to boot a full app.

## A14 — CSV display truncation becomes a destructive whole-document edit

Priority: high integrity defect. Evidence: actual source and a live application
reproduction at the audit baseline. Confidence: high for the tested cell edit.

Trigger: open a CSV with more than 10,000 data rows, edit one visible cell, save.
No second actor, agent, malformed data or large file is necessary. The synthetic
fixture had 10,005 rows and was 219,026 bytes. After one cell edit and ordinary
Save, disk had 10,000 rows; row-10000 through row-10004 were gone. The changed
first cell was correct and the tab was clean. The last retained row was row-09999.

Root cause: `parseCSV` slices `results.data` to MAX_DISPLAY_ROWS and stores the
truncated rows as `parsedData`. `handleCellChange` then serializes all of
`parsedData.rows` and publishes that as the entire new CSV. Add-row/column,
rename-column and deletion handlers use the same authoritative truncated data.
The view projection has replaced the complete document model.

Source: [SpreadsheetViewer.tsx](../../../../extensions/ritemark/webview/src/components/SpreadsheetViewer.tsx),
lines 33, 220–235, 249–271 and 273–375. Application proof:
[row-limit probe](evidence/live-csv-row-limit-probe.json) and
[screenshot](evidence/live-csv-row-limit.png).

Counterevidence: the UI says “showing first 10,000 rows”; this is a display notice,
not explicit consent to delete the remainder. Markdown/CSV synchronization can
faithfully deliver this edit because the payload itself is already incomplete.
The table virtualizes rendered rows, which is a useful performance protection;
it does not justify discarding the underlying model. XLSX editing uses a cached
whole workbook rather than serializing only the displayed rows, so this finding
does not establish equivalent XLSX truncation. A01 is a different XLSX defect.

Recommended direction: retain the full data model and apply view operations to
stable row/column identities, or send bounded operations against the full host
document. Until that exists, explicitly disallow editing a truncated preview
rather than accept a destructive full replacement. A temporary editing limit
must remain visible and must not be presented as complete format support.

Acceptance: 9,999/10,000/10,001+ row fixtures; cell/row/column operations preserve
all unrelated records including the hidden tail; normal Save and reopen verify
the complete result. Check sorted/filtered/virtualized row identity separately.
This narrow integrity fix should not wait for a whole renderer rewrite.

## A15 — ACP publishes a client before its shared initialization finishes

Priority: medium reliability defect in concurrent session creation. Evidence:
actual Ritemark manager/client and locked SDK against bundled native OpenCode
1.18.21, with a successful warm-session control. Confidence: high for two
concurrent `AcpManager.start()` calls; GUI occurrence/frequency is not measured.

Trigger: a second conversation requests a new session while the shared ACP
connection is still starting. `ensureClient()` returns an existing client at
line 195 but assigns that client at line 218, before the initialization await
at line 220. The client's SDK import and handshake have not necessarily finished.

Evidence: [acpManager.ts](../../../../extensions/ritemark/src/acp/acpManager.ts),
lines 160–162 and 194–225; [acpClient.ts](../../../../extensions/ritemark/src/acp/acpClient.ts),
lines 105–145 and 153–158. `AcpRuntime.createSession()` uses manager.start();
the reproduced boundary is the manager API, not a full UI interaction.

[Native reproduction](evidence/native-acp-lifecycle-probe.json): two simultaneous
starts produced one valid session and one `ACP client is not initialized` error.
There was one actual native process. A later start succeeded with a distinct
session ID in that same process. This separates the initialization race from
runtime multi-session capability. The harness supplied configuration, isolated
child environment, trace observation and deny-only file handlers; transport
and initialization code were unchanged. No model prompt was submitted.

Counterevidence: warm multi-session operation, rejection of an outstanding
request on native crash, subsequent reinitialization and normal dispose passed.
Codex's existing shared initialize promise also handled three simultaneous
callers with one native process/handshake. Preserve these patterns.

Recommended direction: share the in-flight initialization promise, distinguish
created/initializing/ready/exited states, clear the promise on failure and reject
waiters consistently on dispose. This is a bounded adapter fix within the wider
runtime lifecycle work, not a reason to add another runtime or abandon sharing.

Acceptance: two cold concurrent starts both obtain distinct sessions after one
handshake; initialization failure settles both callers; retry after confirmed
exit works; dispose during initialization leaves no live owned process or
stranded caller. Verify the corresponding two-conversation UI case separately.

## A16 — Draw.io autosave replaces externally updated diagrams from a stale canvas

Priority: high integrity defect. Evidence: actual normal-mode macOS application,
ordinary label editing/autosave and decoded embedded graph comparison.
Confidence: high for external replacement followed by a local diagram edit.

The provider sends document text on `drawio:ready`, but registers no subsequent
document-change synchronization for the canvas. Its save handler applies the
entire exported SVG to the current TextDocument without a retained version/base
precondition. The per-view `applyingSave` flag prevents overlapping handlers in
that view; it does not protect an external writer or another view's snapshot.

Source: [drawioEditorProvider.ts](../../../../extensions/ritemark/src/drawioEditorProvider.ts),
lines 71–121 for host load/save, 209–228 for initial delivery and 247–263 for
the production autosave debounce. This provider already uses VS Code's text
model, so replacing Node fs writes alone would not address this defect.

[App reproduction](evidence/formats-drawio-conflict-probe.json): an external
writer added an independent `external-cell`. The clean TextDocument received
it while the visible canvas stayed at the baseline. Editing the original shape's
label triggered the real export/autosave chain, made the tab clean and removed
the external shape without a conflict choice. The [model check](evidence/formats-drawio-model-check.json)
decodes compressed diagram XML and confirms the shape ID is absent, rather
than inferring loss from missing literal text in a compressed SVG attribute.

Counterevidence: own label editing, xmlsvg export and close/reopen retained an
editable diagram with the user's new text. Initial-load ACK/retry and the
separate vendored renderer are working protections worth preserving. The test
does not establish that the lost variant is impossible to recover through
native history/undo; it establishes unannounced replacement of the saved file.

Recommended direction: define canvas/base/model revision ownership and stale
export handling. Refresh a clean canvas from document updates; preserve local
changes and the external version when dirty. Verify document.save() success
before a saved receipt. A format adapter may retain draw.io's graph semantics
while sharing the document conflict/recovery contract.

Acceptance: an independently added shape survives or produces an explicit
conflict with both versions recoverable; same-file split views, external writes,
autosave overlap and save failure have truthful receipts. Do not blindly reload
a dirty graph or make safe editing depend on disabling autosave globally.

## A17 — Readonly previews ignore delivered change and deletion notifications

Priority: medium visible-state correctness defect. Evidence: actual PDF/DOCX
viewer messages, rendered text, external disk hashes and explicit-refresh controls.
Confidence: high for the small synthetic local fixtures; no original-file
overwrite is claimed for these readonly providers.

Both providers watch the file and post `fileChanged` and `fileDeleted`.
The current App/preview paths do not consume those events. The PDF toolbar has
no refresh action; DOCX has a manual Refresh button that works but does not
indicate the detected change. The user can therefore view an obsolete version
while an agent or external editor has already replaced or removed the file.

Source: [pdfEditorProvider.ts](../../../../extensions/ritemark/src/pdfEditorProvider.ts),
lines 183–219; [docxEditorProvider.ts](../../../../extensions/ritemark/src/docxEditorProvider.ts),
lines 195–231; [App.tsx](../../../../extensions/ritemark/webview/src/App.tsx),
lines 292–350 and 739–761; [PDFViewer.tsx](../../../../extensions/ritemark/webview/src/components/viewers/PDFViewer.tsx),
lines 262–320; [DOCXViewer.tsx](../../../../extensions/ritemark/webview/src/components/viewers/DOCXViewer.tsx),
lines 111–113 and 253–268.

[Actual viewer test](evidence/formats-preview-probe.json): real host events
arrived, but old markers remained visible after replacement and no change
indicator appeared. DOCX Refresh and PDF close/reopen loaded the new marker.
Deletion notifications also arrived while cached content remained without a
deletion indication. The fixture files were restored before closing the views.

Counterevidence: the watchers and explicit reload paths work, and the basic
PDF/text/shape and DOCX text/table/page-break references render. Keeping a
deleted file's preview can be useful if its cached/deleted state is explicit;
the finding is the missing state transition/indication, not a requirement to
discard the cache. Readonly preview and editable round-trip remain distinct.

History: `c0343a92` removed the shared App fileChanged case, but the preceding
PDF/DOCX branches already bypassed the header consumer. [History evidence](evidence/formats-history.json)
does not justify blaming that synchronization change as the defect's origin.

Acceptance: external replace/delete/recreate has a visible, correct version
state; a clean readonly preview can reload or offer an explicit reload action;
failed reload retains identifiable cached content and reports the failure.
Test the provider and real viewer contract together, including future formats.

## A18 — Browser actions lack a precondition tying them to the observed page

Priority: high for concurrent agent/browser workflows; existing known design
limitation confirmed in the actual shared tool path. Confidence: high for the
local selector-based scenario; natural native-model frequency is unmeasured.

[BrowserActionTools.ts](../../../../extensions/ritemark/src/browser/BrowserActionTools.ts),
lines 33–62, accepts no expected page, URL or observation version. Its global
per-host queue at 69–96 serializes individual commands and explicitly documents
that conversation ownership remains unresolved. `formatActionResultForAgent`
at 146–164 also omits pageId from the result. The
[shell bridge](../../../../patches/vscode/010-ritemark-browser-action-bridge.patch),
lines 429–447, resolves the active browser model for each invocation.

[Actual-host experiment](browser-observations.md): synthetic caller A took a
snapshot of local page A, caller B navigated the same tab to B, then A filled
`#entry` with `AUDIT A INTENDED FOR A`. The B page's actual DOM and production
ARIA result contained that value; pageId stayed the same. A caller's logical
target can therefore change between observation and mutation without rejection.

Counterevidence: an overlapping delayed click and navigation were serialized
correctly. Control Deny prevented mutation, and revoking sharing cancelled a
pending locator call. This is not a failure of the queue or evidence that
permission checks are bypassed. A/B labels exist only in the observer; no native
model sessions were started. The mismatched workbench screenshot is explicitly
excluded as visual proof; actual page-target DOM and tool ARIA are preserved.

History: `401c6da862b7657dcfbb0525c5f3cc75a0e61022` added the queue and recorded
this remaining scope limitation; the audit confirms its product significance.

Acceptance: bind the action to a browser resource and relevant navigation or
observation epoch; reject a stale target before mutation. Preserve serialization
within that resource and make ownership/revocation visible. A pageId alone is
insufficient for this same-tab navigation case. Cover human navigation between
agent steps and concurrent callers; keep runtime adapters on the shared contract.

## A19 — Denied browser actions disclose metadata outside the read-share guard

Priority: medium privacy-boundary inconsistency. Confidence: high for the
actual fill-denial result; no page-body disclosure or external model transmission
is claimed by the synthetic test.

[BrowserContextStore.ts](../../../../extensions/ritemark/src/browser/BrowserContextStore.ts),
lines 168–172, defines read consent to cover URL/title as well as content.
Snapshot obeys that rule. However,
[patch 010](../../../../patches/vscode/010-ritemark-browser-action-bridge.patch),
line 437, returns `modelMeta(model)` after control consent is denied without
checking read consent. The equivalent navigation branch at 337–339 and explicit
ensure-control branch at 283–285 use the same pattern. The formatter passes
URL and title to the agent-facing tool string.

[Observed result](evidence/normal-browser-ownership-finish-probe.json), stages
`read-denied-after-revoke` and `control-denied-after-revoke`: sharing was false;
snapshot returned only an error; fill/Deny left the input unchanged but included
the local page URL and title in its error result. A private URL/title can carry
sensitive identity even if the action itself is prevented.

Counterevidence: page content was not returned on these denials, the write did
not occur, and pending-action revocation worked. The test used synthetic local
pages and called the real dispatcher directly, without sending data to a model.

Acceptance: apply one read-permission projection to success and error responses
across all browser tools. With read-share false, denial/error must omit protected
URL/title/content. Keep the useful distinction between read permission and control
permission when read-share is true. The hidden upstream share toggle observed
in the audit also needs an explicit Ritemark revocation affordance; hiding one
turn's context chip does not revoke the shell's permission.

## A20 — Opening another window misclassifies a live transcription as interrupted

Priority: medium lifecycle correctness; systemic background-work ownership gap.
Confidence: high for actual two-host recovery and UI behavior, with a synthetic
engine response boundary. Native Whisper/cloud execution and crash after peer
recovery were not tested.

[JobManager.ts](../../../../extensions/ritemark/src/speech/JobManager.ts),
lines 90–110, treats every stored `speech:inflightJobs` entry as interrupted
without checking whether another host still owns it, then clears that key.
[extension.ts](../../../../extensions/ritemark/src/extension.ts), lines 405–443,
creates a subsystem and starts recovery in every host.
[speech/index.ts](../../../../extensions/ritemark/src/speech/index.ts), lines
56–63, supplies the product's shared globalState, while jobs/controllers/queue
remain local to each JobManager.

[Two-window evidence](speech-observations.md): A had job `job-mtzwsnna-3`
actively waiting at its transcription boundary. A normally opened B window
recovered the same ID as `interrupted` and displayed a false app-closed message
and Try again action. A remained alive, then completed the same job successfully;
B's store read its saved result while B's local job and UI still said interrupted.
The test held a synthetic response, not a native recognizer. Real preparation,
job management, globalState, providers and UI were used.

Counterevidence: the single-host job path saved and displayed its result,
and the original A job was not cancelled by B. Thus this is not proof that
opening another window stops native transcription or necessarily loses its
result. The intermediate SQLite state was not sampled; differing host Memento
snapshots must not be presented as a timed on-disk measurement. An earlier
observer timeout has a different job ID and is preserved as a harness failure.

Acceptance: persist an owner identity and an authoritative liveness/lease rule;
recover a job only after its owner is known to have ended. A newly opened window
must attach to or accurately describe another owner's active work, and completion
must update its view. Scope inflight persistence to prevent one host from clearing
another's recoverable work. Test two live windows, owner crash, peer restart and
retry without duplicate work. Retain the existing webview-independent pipeline
and single-instance queue while making the ownership boundary explicit.

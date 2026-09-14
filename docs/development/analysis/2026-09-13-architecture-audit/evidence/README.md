# Audit evidence

Baseline: `30ea2ab32d15be161991d1bb8924a4c4ca331f8c` (2026-09-13).
All experiments run from the isolated architecture-audit worktree. Product source,
checked-in media, the primary checkout and user documents are unchanged.
Source inspection, component experiments, historical live evidence and packaged
measurements are distinct evidence classes.

## Current environment

- macOS arm64; initial default Node 22.21.1 was replaced for experiments by the
  repository-pinned installed Node **22.22.1**.
- Extension and webview each have their own locked `npm ci` dependencies in this
  worktree. No dependency directories or build outputs were linked from primary.
- VS Code submodule remains uninitialized at recorded gitlink
  `10c8e557c8b9f9ed0a87f61f1c9a44bde731c409`.
- Source-map build hit the default roughly 4 GiB Node heap limit. The production
  configuration (no source maps) rebuilt successfully in 15.33 seconds, exactly
  reproducing the checked-in webview bytes. This is a local build duration,
  not a user startup measurement or a performance benchmark distribution.
- Installed /Applications/Ritemark.app is 1.10.1 with bundled extension 1.10.1-0
  and provenance source `23493cef1f4d38cd997be5509e057cb75560fb5c`. Git comparison
  to the audit baseline shows no difference in the VS Code gitlink, patches or
  branding/product.json. Any use as a live-test shell must record this separately
  and verify which extension code is loaded. Development-mode and independently
  staged normal-mode launches have verified the actual loaded audit extension.
  See [live observations](../live-observations.md) and
  [normal-mode observations](../normal-mode-observations.md); this is not a release rebuild.
- Representative Windows hardware has not been established. Mac data cannot
  prove weak-Windows startup, memory or native subprocess behavior.

## Executed checks

| Check | Current result and scope | Evidence |
| --- | --- | --- |
| Extension locked dependencies | npm ci passed; 99 packages | npm-extension-network.log |
| Webview locked dependencies | npm ci passed; 514 packages; existing TipTap patch applied | npm-webview.log |
| Standard extension test command | `SKIP_API_TESTS=true npm test`, exit 0; includes pretest | npm-test-local.log |
| Additional tracked tests | 11 non-native/API files outside standard command passed; two ESM entries needed the correct loader | additional-tests.json |
| TypeScript + host bundle | `npm run compile`, exit 0; tests are excluded by extension tsconfig | extension-compile.log |
| Actual Vite production rebuild | exit 0; 8,844,955 bytes, SHA exactly matches checked-in artifact | webview-build.json, webview-build-production.log |
| Repo QA after dependencies | `./scripts/validate-qa.sh`, exit 0 | qa-after-deps.log |
| Concurrent resource mutations | Event loss across two ConversationStores; ten transcript save collisions; duplicate schedule slot; same-store revision control succeeds | concurrency-probes.json |
| Update/HTML boundary tests | Installer accepts parent directory and removes synthetic sibling sentinel; actual Markdown component preserves style and external img | boundary-probes.json |
| Flow completion ordering | Completion after turnStart response succeeds; same completion before response is lost and times out | flow-lifecycle-probe.json |
| Actual macOS startup | Loaded extension path verified; terminal→AI focus in fresh and reused profiles | live-startup.json, live-restart-probe.json |
| Markdown document lifecycle | Clean external update, preserved conflict, use-disk, host Undo recovery, split peer-edit, keep-local and one-view close | live-markdown-probe.json, live-host-history-probe.json, live-markdown-split-probe.json |
| XLSX external replacement | Two ordinary Save runs overwrite the external actor's value; repeat has no intervening approval UI action | live-excel-repeat-probe.json |
| CSV complete document integrity | One visible-cell edit/save loses the five rows beyond the 10,000-row display limit | live-csv-row-limit-probe.json |
| Runtime/resource snapshot | Four webview contexts load the same 8,844,955 bytes; native version/help and four strict codesign checks pass | live-runtime-inventory-probe.json |
| Development-mode restart | Unsaved marker did not persist; source proves dev windows have in-memory backups. Not a normal-mode hot-exit verdict | live-restart-probe.json, live-restart-mode-analysis.json |
| Normal-mode extension staging | Independent extension clone with matching hashes; actual Production-mode loading and persistent backup configuration verified | normal-session.json, normal-startup-probe.json |
| Durable Markdown/XLSX recovery | Both unsaved edits restored after CDP close/reopen, then ordinary Save persisted both. Initial XLSX DOM selector error was resumed without restarting or re-entering data | normal-recovery-probe.json, normal-recovery-finish-probe.json |
| Two native windows, Markdown | Saved propagation, two independent drafts, preserved conflict and explicit resolution propagation passed across two extension hosts | normal-multiwindow-probe.json |
| Two native windows, scheduled Flow | Same physical Flow and same scheduled slot executed twice, producing two files and two successful markers in distinct workspaceState databases | normal-scheduler-probe.json |
| Native Codex connection lifecycle | Three callers share one initialization; real RPC deadline, late reply, native crash with pending request, restart and dispose passed | native-codex-lifecycle-probe.json |
| Native ACP connection lifecycle | Two cold starts yield one success and one not-initialized error (A15); warm multi-session, crash during pending request, restart and dispose passed | native-acp-lifecycle-probe.json |
| Draw.io external writer/autosave | External independent shape reached the clean TextDocument but was removed by a stale canvas autosave; compressed graph decoded; own edit/reopen works | formats-drawio-conflict-probe.json, formats-drawio-model-check.json, formats-preview-probe.json |
| PDF/DOCX reference preview | Basic text/shape, DOCX table values/diacritics/page break render. Delivered change/delete events do not update visible state; DOCX Refresh and PDF reopen work | formats-preview-probe.json |
| PDF page lifetime | 20 visited canvases stay mounted. Paired RSS/JS-heap snapshots do not demonstrate a proportional memory increase; calculated pixel surface area is not measured RAM | formats-pdf-pages-probe.json, formats-pdf-resource-analysis.json |
| Actual AI webview content boundary | Assistant CSS styles real approval buttons/composer; locally fulfilled HTTPS image loads; two inline handlers blocked by enforced CSP; user markup escaped; removing content restores styles | formats-security-probe.json, formats-security-baseline.png, formats-security-styled-controls.png |
| Actual shared conversation storage | Same-scope production controllers in two hosts lose an acknowledged assistant result to a stale preference write under controlled rename timing; successful single-host/sequential controls, both UI readbacks and new-process readback | normal-store-probe.json, normal-store-view-finish-probe.json, normal-store-restart-probe.json |

The standard npm command explicitly includes 119 of 132 tracked TS/TSX test files;
see [test-command-map.json](test-command-map.json). The additional 11 passed.
Windows bootstrap requires a Windows host; the separately named live LLM API
integration was not called. Standard-command live API scenarios were explicitly
skipped. These file counts are command inclusion, not assertion/branch coverage.
Some old tests mirror logic or use a pre-Session runtime fixture: a successful
tsx run is not a typechecked verification of today's whole interface.

QA exercises manifest, target staging, provenance, release-source and worktree
fixtures plus pre-commit/fast-chrome validation. With no product changes, some
change-selected suites and shell TypeScript checks do not run. The separate
compile and npm test results above supply broader extension evidence. QA's local
fixture pushes are to disposable local repositories, not the audit remote.

Earlier failures remain in logs for transparency: the first dependency attempt
failed DNS inside the sandbox, the first tsx CLI attempt hit an IPC permission
limit, and initial QA lacked the Phosphor source font before dependencies were
installed. Authorized retries/installation resolved these environment failures.
The source-map heap failure was resolved only for the production no-map build;
no claim that the debug source-map build now passes.

The first ACP native probe exited with `ServeError` in the restricted environment;
the actual process exit was verified before a permitted retry completed the
sequence. [Initial result](native-acp-lifecycle-sandbox.json) is preserved and
is not classified as a product regression. Native connection experiments use
isolated runtime profiles without model prompts; see
[scope and outcomes](../native-runtime-observations.md).

[Format observations](../format-observations.md) record a further independently
staged normal-mode launch, verified loaded path, synthetic fixtures and visual
inspection. Its reference files exercise selected capabilities, not universal
Word/PDF fidelity or editable round-trip. `analyze-formats.py` reproduces the
decoded graph comparison, bounded source-history evidence and paired resource
analysis from preserved raw observations. History does not establish that the
preview defect originated in the App synchronization change.

[Security observations](../security-observations.md) reuse that staged extension
and profile in a subsequent normal-mode launch. The renderer input is explicitly
a synthetic host-shaped MessageEvent fixture, not a native model response or a
bridge-forgery exploit. HTTPS audit.invalid image requests were intercepted at
request stage and fulfilled with local PNG bytes; no external server was used.
This strengthens A08 from SSR markup preservation to observed styling of trusted
controls, while recording enforced script blocking and unchanged shell scope.
`formats-security-probe.mjs` runs through the existing persistent formats client;
it requires a verified live isolated app and its AI view. It does not create a
native model turn or click approval. `analyze-security.py` verifies the recorded
comparisons and captures pinned source excerpts and recent path history.

[Shared-store observations](../shared-store-observations.md) use a further fresh
profile with two no-folder windows, which have the same actual conversation
scope. `prepare-store-probe.py` stages an audit-only observer around the existing
unchanged production extension. The observer accesses live cached provider and
controller objects; it can hold only four allowed fixture records' renames for
at most eight seconds. It cannot dispatch model turns, shell commands or arbitrary
conversation IDs. Actual record IO and controller revision checks are delegated
to the production code. Synthetic native-completion ingress and controlled IO
timing are explicit limitations; ordinary UI race frequency is not measured.

The main shared-store probe completed its storage cases and readbacks, then
failed its initial UI lookup. Its error is preserved. The separate view-finish
probe matched each host to the real webview response requestId and completed
without reseeding or repeating the writes. A fresh app process subsequently read
the same missing result. These sequential artifacts must be read together;
the first JSON is not relabeled as a fully passing end-to-end test. The precise
cause of the first UI lookup failure was not isolated.

The store helpers require the isolated prepared environment and their recorded
sequence; they are not generic tests to rerun against existing fixture IDs.
After completion the prior observer was restored. `analyze-shared-store.py`
validates the correlated recorded controls, lost updates, UI finish, restart,
explicit barrier releases, source/history, harness syntax and cleanup.

## Reproduce source inventory and experiments

Run from this worktree root with Node 22.22.1 first in PATH:

```bash
python3 docs/development/analysis/2026-09-13-architecture-audit/evidence/collect-baseline.py
node docs/development/analysis/2026-09-13-architecture-audit/evidence/dependency-graph.cjs
python3 docs/development/analysis/2026-09-13-architecture-audit/evidence/change-history.py
node docs/development/analysis/2026-09-13-architecture-audit/evidence/build-webview.mjs
node docs/development/analysis/2026-09-13-architecture-audit/evidence/concurrency-probes.cjs
node docs/development/analysis/2026-09-13-architecture-audit/evidence/boundary-probes.cjs
node docs/development/analysis/2026-09-13-architecture-audit/evidence/flow-lifecycle-probe.cjs
```

- [baseline.json](baseline.json): tracked source inventory, artifact size/hash,
  direct dependencies, patch list and gitlink. Initial environment is historical.
- [dependency-graph.json](dependency-graph.json): TypeScript AST import/export and
  literal require/import edges. Type-only edges are excluded from runtime SCC;
  deferred imports still count as dependencies. Nonliteral imports and IPC need
  manual mapping; one unresolved CSS asset is outside the TS resolver.
- [change-history.json](change-history.json): 198 reachable non-merge commits
  since 2026-06-01. Co-change analysis restricts to 2–20 touched files; association
  does not establish cause or architectural quality.
- [webview-build.json](webview-build.json): actual Vite/Rollup build output under
  /private/tmp, chunk imports, package attribution and preserved artifact SHA.
  renderedLength is **before output minification**, not final package bytes or RAM.
- [concurrency-probes.json](concurrency-probes.json): actual classes, synthetic
  local files, two-writer barrier at temp writes, and shared fake scheduling
  state. A one-Store negative control rejects a stale revision and retains both
  events after an explicit retry. No real agent or scheduled side effect ran.
- [boundary-probes.json](boundary-probes.json): actual validator/installer with
  fake vscode appRoot and test-only userData override under mkdtemp; no download.
  Actual React component SSR establishes markup preservation only; no browser
  request, CSS effect, script execution or RCE is claimed.
- [flow-lifecycle-probe.json](flow-lifecycle-probe.json): actual node executor,
  fake EventEmitter transport, 60-second timer accelerated to 20 ms. Establishes
  tolerance to event ordering, not observed native protocol ordering.

## Actual webview startup work

[performance-analysis.json](performance-analysis.json), recomputed by
[analyze-performance.mjs](analyze-performance.mjs), separates final timing in
a fresh unprofiled app process from earlier CPU/precise-coverage observations.
[normal-performance-final-load-probe.json](normal-performance-final-load-probe.json)
contains six new visible Markdown webviews at alternating 1×/4× renderer CPU.
Every Performance baseline preceded the product bundle request. The same
79-byte fixture rendered exactly; host logs contain six open commands.
Median open-to-ready was 469/1523 ms, ScriptDuration 301/1346 ms, and local
resource duration 88/92 ms. This uses warm caches and focus emulation to avoid
macOS occlusion effects; it is not a cold launch or weak-Windows benchmark.

[normal-performance-profile-load-probe.json](normal-performance-profile-load-probe.json)
links two raw `.cpuprofile` and coverage files from the previous process.
They show bundle execution and sampled initialization paths; their instrumented
timing is excluded from the final six-trial comparison. About 28.1% of bundle
UTF-16 ranges executed in this opening; this is not a removable-byte estimate.
Generated-source anchors match ELK and parser dependency initialization.

[performance-observations.md](../performance-observations.md) records the
earlier unsuccessful calibration attempts, inactive service-worker observation,
hidden-frame timeout, successful controls, exact method and inference limits.
[Calibration cleanup](normal-performance-calibration-cleanup-probe.json) and
[final cleanup](normal-performance-cleanup-probe.json) each confirmed 13 owned
processes stopped and port 9243 closed; the client exited 0. Product, observer
and fixture hashes remained unchanged. Analysis correlates 44 final host events.

## Historical evidence

[Sprint 115 live smoke](../../../releases/v1.10.0/sprint-115-editor-disk-sync/research/phase-1-live-smoke.md)
records August 24–25 RunDev Markdown/CSV external updates, true conflict,
keep/use-disk recovery, ACKs and split-view behavior with disposable files.
It explicitly leaves native runtime writers, rename/delete/multi-root, large
files and a noncooperating write inside the validator/write interval open.
This audit reads it as valuable prior evidence, not a new run at this baseline.

## Remaining proof

Remaining native runtime tool/cancel lifecycle, actual speech engine and
additional owner-crash/peer-restart cases; large-format memory/fidelity; cold startup/input
and weak-Windows repeat measurements. Warm Markdown script execution now has
a six-view fresh-process sample plus separate profile/coverage attribution.
Normal-mode recovery and the
two-window document/scheduler cases plus controlled same-scope conversation
storage and restart are recorded with their limits. The coverage
ledger keeps the remaining requirements open. No implementation,
commit, release or full audit-completion claim is made by these artifacts.

## Live-test preflight and artifact validation

[app-preflight.json](app-preflight.json) records installed-shell provenance and
unchanged shell inputs. It also identifies profile/global installation cleanup:
--user-data-dir alone does not isolate the installer's fixed home-directory
root. Preflight and launch guards confirmed there were no removable version
directories before either launch; existing starter-library state prevented seeding.
No user installation or starter library was modified.

The development-mode application runs and persistent driver client have stopped. See
[live-cleanup-probe.json](live-cleanup-probe.json) for exact owned PIDs and
closed CDP port. [live-driver-events.jsonl](live-driver-events.jsonl) preserves
the synthetic document/shell sequence; it contains no real user documents.
Harness syntax checks are recorded in [live-harness-syntax.json](live-harness-syntax.json).

The normal-mode test application and all 22 observed owned processes also
stopped; CDP port 9238 closed. See [normal-cleanup-probe.json](normal-cleanup-probe.json).
Its persistent control client then exited successfully. The three
`normal-driver-events-*.jsonl` files preserve synthetic host observations;
endpoint authentication tokens were not copied into evidence.

Native connection probes also confirmed exit of every directly spawned owned
child. They do not claim cleanup of all possible model/tool descendants, which
were not started. Normal/native harness syntax checks are recorded in
[normal-harness-syntax.json](normal-harness-syntax.json).

The format-test application and its 12 captured owned processes stopped and
CDP port 9239 closed; its control client exited successfully. See
[formats-cleanup-probe.json](formats-cleanup-probe.json) and the synthetic
[host events](formats-driver-events-85175.jsonl). Format harness syntax and
JSONL parsing are recorded in [formats-harness-syntax.json](formats-harness-syntax.json).

The subsequent security-test launch and all 12 captured owned processes stopped,
port 9239 closed and the control client exited 0. See
[formats-security-cleanup-probe.json](formats-security-cleanup-probe.json).
The reused events directory also contained the prior format host's log, which
cleanup copied again under the security prefix; only host 4637 belongs to the
security launch. Source/result and harness checks are recorded in
[security-analysis.json](security-analysis.json).

The shared-store experiment closed 18 captured owned processes before restarting,
then 12 captured processes at the end (counts include each app's main process).
Both checks confirmed port 9240
closed. See [first shutdown](normal-store-stop-before-restart.json) and
[final shutdown](normal-store-final-cleanup.json). The control client exited 0.
The prior audit-only driver was restored after shutdown; the temporary helper
was removed from the staged extension folder. See
[observer restoration](normal-store-observer-restoration.json).
The [correlated analysis](shared-store-analysis.json) records five explicitly
released barriers, 11 JS syntax checks, two Python AST checks and 30 current
host event records. Endpoint authentication tokens were not copied.

Run `python3 docs/development/analysis/2026-09-13-architecture-audit/evidence/validate-artifacts.py`
for JSON, link, whitespace and tracked-product-change checks. The output
[artifact-checks.json](artifact-checks.json) is artifact hygiene only, not proof
that the audit's open behavioral requirements are complete.

## Browser ownership and consent experiment

[Browser observations](../browser-observations.md) distinguish actual shell/Playwright
behavior from the synthetic dispatcher ingress. The [completed probe](normal-browser-ownership-finish-probe.json)
records denied and allowed actions, read denial, a working per-action queue,
same-tab stale-target mutation, successful pending-locator cancellation, and
URL/title disclosure in a denied fill result. No native runtime session started.

[Initial probe](normal-browser-ownership-probe.json) has a preserved observation
timeout: the earlier dialog was gone and job 3 had actually succeeded. Jobs 1
and 3 do not establish how consent was granted. The subsequent probe revoked
permissions again and observed each new dialog. The word DENIED in initial
fixture values is not an observed denial.

The revocation handler belonged to a hidden upstream share button and was
invoked through CDP; normal user revocation UI was not demonstrated. Dialog
screenshots were inspected. `normal-browser-wrong-target.png` contains a stale
BrowserView surface and is excluded as page-state proof; actual browser-target
DOM plus production ARIA establish the target mutation.

[Cleanup](normal-browser-cleanup-probe.json) verified all 13 captured owned
processes stopped and port 9241 closed; the client exited 0. The original
observer was restored and its temporary browser helper removed. Four staged
product hashes remained unchanged. [Analysis](browser-analysis.json), generated
by [analyze-browser.py](analyze-browser.py), correlates all 15 jobs with 59
current-host events, source excerpts, immutable upstream UI code and syntax checks.
Endpoint tokens and unrelated user-profile UI content were not retained.

## Speech ownership and recovery experiment

[Speech observations](../speech-observations.md) describe the actual registered
provider/job/store instances, accessed through a local inspector reference to
the existing extension context. Source was not re-evaluated and no replacement
product instances were constructed. The engine response was synthetic and
bounded; no Whisper inference, cloud audio upload or native model turn ran.

The [first probe](normal-speech-recovery-probe.json) completed the one-host
pipeline and actual view, then failed on a wrong body-vs-root selector. The
[resume precondition](normal-speech-recovery-finish-probe.json) later found the
120-second observer timeout terminal. The [new observed job](normal-speech-recovery-observed-probe.json)
started only after that terminal state was verified. B's ordinary window
activation falsely recovered A's still-live job as interrupted, displayed the
error, and retained it after A completed the same job and saved its result.
`normal-speech-false-interrupted.png` was visually inspected.

[Two-host rename](normal-speech-store-probe.json) preserved the sequential
control but lost one of two acknowledged speaker changes. Original save calls
were released sequentially after bounded 4/109 ms holds, so this is separate
from the component test's `.tmp` collision. Both real webviews read the lost
change after a production host push.

[Cleanup](normal-speech-cleanup-probe.json) verified 20 captured owned processes
stopped, port 9242 closed, three generated peak-file paths absent, observer
methods restored and four product artifacts unchanged. The second-window CLI
was [separately confirmed absent](normal-speech-cli-exit.json); the persistent
client exited 0. [Analysis](speech-analysis.json), generated by
[analyze-speech.py](analyze-speech.py), correlates 42 host events, the actual
controls/failures and source/syntax evidence. Intermediate SQLite persistence,
app restart, native engine fidelity and real playback are outside this run.

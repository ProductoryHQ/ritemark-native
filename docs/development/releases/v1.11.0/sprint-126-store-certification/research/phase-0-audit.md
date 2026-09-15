# Sprint 126 Phase 0 — code audit

**Parent:** [sprint-plan.md](../sprint-plan.md) · **Date:** 2026-09-15 · **Status:** audit complete for R2 and R4; R1 and R3 need Partner Center access

Covers Phase 0 items 1 and 4 (generative-surface inventory, Git-promotion trace). Items 2, 3, 5 need decisions that are not in the code and are listed at the end. Every claim below carries a `file:line`; anything not verifiable from source is marked as such.

---

## R4 — external software acquisition promotion

### What the reviewer saw (upstream, built-in `git` extension)

Four `viewsWelcome` contributions in `vscode/extensions/git/package.json` (`contributes.viewsWelcome`), with text in `vscode/extensions/git/package.nls.json`:

| Key | Text | `when` |
|---|---|---|
| `view.workbench.scm.missing.windows` | `[Download Git for Windows](https://git-scm.com/download/win)` + reload/troubleshoot/Marketplace links | `config.git.enabled && git.missing && remoteName == '' && isWindows` |
| `view.workbench.scm.missing.mac` | same shape, `https://git-scm.com/download/mac` | …`&& isMac` |
| `view.workbench.scm.missing.linux` | `Source control depends on Git being installed.` + `https://git-scm.com/download/linux` | …`&& isLinux` |
| `view.workbench.scm.missing` | `Install Git… Learn more in our [Git guides](https://aka.ms/vscode-scm)` | `… && remoteName != ''` |

**All four are gated on `git.missing`.** They appear only when Git is absent, which is why removing them cannot break Source Control for a user who has Git — that satisfies R4's "without breaking use of installed Git" directly, by construction rather than by testing.

### What the reviewer did not see — and it is ours

`patches/vscode/001-ritemark-branding.patch` adds a launch-check list to the Ritemark welcome page (`vscode/src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts`). Two of its items promote external acquisition:

| Line | Item | Action |
|---|---|---|
| `gettingStarted.ts:1186-1195` | `ritemark.gitMissing` — "Ritemark needs Git." | "Click here to install" → `https://git-scm.com/downloads` |
| `gettingStarted.ts:1197-1206` | `ritemark.nodeMissing` — "Ritemark needs Node." | "Click here to install" → `https://nodejs.org/en/download` |

This is Ritemark's own code, added by patch 001 — not upstream. It is also **more prominent** than the flagged surface: the welcome page renders on launch, whereas the SCM empty state must be navigated to.

The Node prompt is the same policy class as the Git one. It was not flagged, presumably because the reviewer's machine had Node or they did not reach that state.

### URL discrepancy, recorded rather than resolved

The certification report cites `git-scm.com/install/windows`. Neither of our surfaces uses that path — the extension uses `/download/win`, our welcome page uses `/downloads`. The reviewer most likely paraphrased or followed a redirect. This does not change the fix, but the packaged app should be checked to confirm which surface they actually reached before the resubmission claims a specific one was corrected.

### Why it renders as a button — and what that makes the fix

`viewPane.ts:249-253` decides how a welcome-view line is drawn: if the line parses to **exactly one link and nothing else**, it becomes a `Button` with `defaultButtonStyles` — a full-width primary button. A line with any surrounding prose renders as text with inline links.

`view.workbench.scm.missing.windows` is precisely the first case. Its first line is the bare link `[Download Git for Windows](https://git-scm.com/download/win)`; its second line ("After installing, please [reload]… or [troubleshoot]…") has prose around the links and stays text. So the flagged element is a large blue call-to-action button, and the reviewer's finding is most plausibly about that prominence rather than the mere existence of the link.

Supporting this reading: **Visual Studio Code itself ships in the Microsoft Store with this same button** (Jarmo, 2026-09-15). The finding therefore cannot mean that mentioning Git acquisition is categorically forbidden. The resubmission should describe what we changed — the prominent acquisition call-to-action is gone — and must not claim a general policy interpretation we cannot support.

### Decision (Jarmo, 2026-09-15): inform, do not offer

Ritemark tells the user that Git or Node is missing and must be obtained. It does not provide the action that obtains it. Scope stays deliberately small:

| Surface | Change |
|---|---|
| `view.workbench.scm.missing.windows` / `.mac` / `.linux` | Drop the bare download link line. Keep an informational sentence that Source Control needs Git installed, and keep the `reload` / `troubleshoot` commands. With no single-link line left, nothing renders as a button. |
| `gettingStarted.ts:1186-1195` (patch 001) | Keep "Ritemark needs Git."; drop the `action` object, so no "Click here to install". |
| `gettingStarted.ts:1197-1206` (patch 001) | Keep "Ritemark needs Node."; drop the `action` object. |

Node is included because it is the same construct and the same policy class, not because it was flagged. The user still learns exactly what is missing.

### Fix shape

Both live in `patches/vscode/`, so this is a shell-tier change — which the release already is, from the Sprint 116 runtime binaries. Both are text/contribution edits, not code removal, so the blast radius is small.

One durability requirement: an upstream VS Code bump can silently restore the `package.nls.json` strings. The patch needs an applicability check that fails loudly rather than a change that quietly reverts.

---

## R2 — where generative content reaches the user

### Surfaces that can carry a report action today

| Surface | Renderer | Stable id | Flag |
|---|---|---|---|
| Claude Code transcript | `AgentResponse.tsx:260` (via `AgentView.tsx:19`) | `AgentConversationTurn.id` (`types.ts:226`) | `agentic-assistant` — stable |
| Codex transcript | `CodexView.tsx:236` | `CodexConversationTurn.id` (`types.ts:327`) | `codex-integration` — stable |
| OpenCode / ACP | same component; provenance is a field (`store.ts:736`) | as above | `opencode-integration` — stable |
| Legacy runtime transcript (read-only, still rendered) | `ChatMessage.tsx:45` | `ChatMessage.id` (`types.ts:131`) | — |
| Comment-task completion summary | `MarginCommentRail.tsx:570` | `taskId` (`types.ts:208`), with an existing action channel at `MarginCommentRail.tsx:465` | `comment-callouts` — **experimental** |
| Flows execution output | `ExecutionPanel.tsx:380` | `ExecutionStep.nodeId` — ephemeral panel state only | `ritemark-flows` — declared but never checked |
| AI-generated conversation titles | `ConversationsPanel.tsx:80`, `:116` | conversation id | — |

### Surfaces that cannot carry one without new plumbing

- **Transcribe Insights** (`InsightsRail.tsx:203`) — model-generated, and the rail says so, but `InsightItem` has no id; the React key is `kind` + array index, which shifts on regeneration. Attachable only at whole-insights granularity (`generatedAt` + `model`) unless an id is added.
- **Generated images** (`ImageNodeExecutor.ts`) — written to `.flows/images/` as ordinary files. Provenance is lost at the file boundary; the rendered image (`ResizableImage.tsx`) has no marker.
- **Agent edits written into the document** — land as plain text with no provenance attribute. The sidebar widget *preview* is addressable (`WidgetPreview.tsx:11`), the applied text is not.
- **Voice dictation** (`controller.ts:89` → `App.tsx:326`) — inserted as ordinary document text, no id. Transcription rather than generation; whether 11.16 covers it is a policy call, not a code fact.

### There is no single rendering chokepoint

`RenderedMarkdown` (`RenderedMarkdown.tsx:25`) is the shared markdown leaf for all sidebar text, but its props are `{ content, className }` only — no turn id, conversation id or runtime — and it renders user- and host-authored text as well as model output. It cannot serve as the anchor without a signature change.

There is also **no per-message action row in the transcript today**. A sweep of `webview/src/components/ai-sidebar/*.tsx` finds clipboard *icons* only (decorative). A report affordance has no existing hover-action host to join; it introduces one.

### The identity gap that decides the report's granularity

The host records per-event ids — `ConversationEventBaseV1.eventId`, a persisted `randomUUID()` with enforced uniqueness (`src/conversations/types.ts:54-60`, `ConversationStore.ts:198`). The webview does not keep them: on rehydration, every assistant event in a turn is flattened into one string (`conversationProjection.ts:35`), so only `turnId` survives a reload. Webview-minted ids are worse still — `store.ts:102-105` resets a counter on each load.

**Consequence:** a report keyed on `turnId` is stable across reload. Anything finer requires plumbing `eventId` through the projection. And the durable archive itself is behind `durableAgentConversations`, which is **experimental** (`flags.ts:67-72`) — without it, conversations live in webview `localStorage`.

### The existing feedback path, and why it does not satisfy 11.16 as-is

One affordance exists: `ritemark.reactions`, "Send Feedback", in the editor title bar (`extensions/ritemark/package.json:103-107`, `:525-528`), implemented at `src/analytics/reactions.ts`.

It asks for a sentiment ("Love it / It's good / It's okay / Needs work") and an optional free-text message, then calls `trackEvent('reaction_submitted', …)` and `trackEvent('feedback_sent', …)` (`reactions.ts:47`, `:55`). Three properties make it unsuitable for a certification-grade reporting mechanism without change:

1. **It carries no reference to any content.** No conversation, turn, message or document — by design.
2. **It goes to PostHog only** (`posthog.ts`, default host `https://eu.i.posthog.com`). Anonymous, fire-and-forget analytics, not a monitored intake.
3. **It is silently off for an opted-out user.** `isAnalyticsEnabled()` (`posthog.ts:161-166`) checks both `ritemark.analytics.enabled` and `features.analytics`; when either is false the call no-ops and the user sees "Feedback was not sent." A reporting mechanism the user can disable does not meet "a discoverable, working user action".

The closest structural neighbour is the **AI Information** disclosure already mounted in the composer (`ChatInput.tsx:1459`, `:1507`; links in `aiDisclosure.ts:6-8`). That is where the product already talks to the user about AI, and is the natural place to also say where to report it.

---

## R2 — decisions taken (Jarmo, 2026-09-15)

| Question | Decision |
|---|---|
| Where does a report go? | `info@productory.eu` — the same public contact already approved and saved in the Store listing. |
| May the report carry the offending output? | Yes. |
| How is that safe? | The user reviews it before it is sent: a simple window showing the content that will be included, in an editable field. Nothing leaves without being seen. |

This reverses the posture `CommentTaskProjectionV1` takes for comment tasks (`src/commentTasks/types.ts:206-207` deliberately excludes prompt text and content hashes). The difference is consent: a comment task's projection is machine-to-machine and the user never sees it, whereas a report is user-initiated, user-reviewed and user-edited. The exclusion rule stays in force everywhere else.

**Editable, not just previewable.** The field is an input, so a user who wants to report an output while removing something private from it can. That makes the minimisation requirement the user's own action rather than a heuristic we have to write.

### Still open: transport

The recipient is fixed; how bytes reach it is not, and it decides whether the mechanism survives review.

- **`mailto:`** — no backend, works today, recipient is a real monitored mailbox. But Ritemark cannot confirm delivery, so the copy must say "your mail app will open" and never "sent" — the sprint DoD already requires this (`sprint-plan.md`, "the UI never claims delivery when it only opens a compose window"). The risk is a reviewer on a clean Windows 11 VM with no mail account configured: the action would appear to do nothing.
- **An owned HTTP endpoint** — delivers regardless of the reviewer's machine and can be confirmed in the UI. Costs a small ingestion service; `ritemark-cloud` is the obvious host.

A combination is the cheapest way to be honest and still always work: open `mailto:` when a handler exists, and when it does not, show the address with a Copy button and the report text ready to paste. The action then always does something visible, and Ritemark never claims a delivery it cannot observe.

**Not decided here.** Whoever decides must also name the triage owner and the response expectation — "a discoverable, working user action, with an owned receiving/triage process" is the finding's wording, and an unread mailbox does not satisfy it.

## Decisions this audit cannot make

R4 is decided — see the decision table above. R2's recipient, content policy and consent model are decided above; its transport is open. What follows is the rest.

1. **Who reads `info@productory.eu` for these, and how fast?** The address is decided; the triage owner and response expectation are not.
2. **Transport** — see above.
4. **Is the reporting action required on experimental-flag surfaces?** `comment-callouts` and `durableAgentConversations` are both experimental, i.e. user-disableable. If the submitted build must expose reporting unconditionally, either those surfaces are out of R2 scope or the flags change for the Store build.
5. **Does transcription count as generative content** for 11.16 — voice dictation and Transcribe segments?
6. **R1 and R3 need Partner Center.** The live StoreLogo2 asset must be identified before replacement artwork is prepared — the plan's own warning that a repository logo is not evidence of the live asset stands, and the audit could not check it from the repo. Freemium copy likewise needs the saved listing text.

---

## Not verified

- Whether the Store build ships the same feature-flag defaults; `flags.ts` defaults are compile-time and packaging overrides were not traced.
- Which of the two Git surfaces the reviewer actually reached (see the URL discrepancy above).
- The runtime behaviour of the `durableAgentConversations` cutover (`ConversationCutoverState.ts` was not traced), so which storage path is live for a given install is unknown.

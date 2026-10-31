# Unchecked Important findings from the baseline review

The blind review behind [`incidents.md`](incidents.md)'s baseline score raised 31 Important findings on the
incident diffs besides the ones scored (the incidents themselves and #142). **They are unverified.** Nobody has
checked that any of them was, or is, a real defect. They are listed so they can be triaged, not as known bugs.

- **Line numbers** are at the diff's head commit (`reviewer-brief.md` has each item's base and head).
- **On `main`** says only whether the code the finding names is still on `main` today (`6fa90921`, 31 October 2026),
  from a quick `git grep` or `git show main:<path>`:
  - **Still there:** the named code is unchanged, perhaps at another line or in another file;
  - **Changed:** the file is there, but the named code was reworked;
  - **Gone:** the file or the function was removed.

  "Still there" doesn't mean the failure still happens.

**Count:** 17 still there, 11 changed, 3 gone.

| # | Diff | `file:line` at the head | The failure, as the reviewer put it | On `main` |
| --- | --- | --- | --- | --- |
| 1 | D04 (PR #113, `f04dc202`) | `extensions/ritemark/src/views/UnifiedViewProvider.ts:283` | Codex is forced to `approvalPolicy: 'never'` in Auto and Plan, and OpenCode auto-allows in Auto, so Settings' Codex approval policy and OpenCode's auto-approve switch do nothing | Still there (`UnifiedViewProvider.ts:1022`) |
| 2 | D04 | `extensions/ritemark/src/agent/AgentRunner.ts:498` | Plan for Claude runs as `bypassPermissions` with only a prompt reminder, so an edit made before ExitPlanMode isn't approved | Changed (no `bypassPermissions`; Sprint 103) |
| 3 | D04 | `extensions/ritemark/src/agent/AgentRunner.ts:838` | Ask mode only removes four tool names, while `settingSources` still loads `permissions.allow` from settings files, so other tools run with no card | Changed (`settingSources` still has `'user'`, `AgentRunner.ts:209`; the four-name list wasn't found) |
| 4 | D04 | `extensions/ritemark/src/agent/AgentRunner.ts:1058` | The Ask gate allows a tool ("fail open") when no approval UI is wired, as in the window after a timeout | Still there (`AgentRunner.ts:1706`) |
| 5 | D04 | `extensions/ritemark/src/agent/AgentRunner.ts:1065` | One pending-approval slot: two concurrent tool approvals overwrite each other and the turn hangs | Changed (a map of pending approvals) |
| 6 | D04 | `extensions/ritemark/webview/src/components/ai-sidebar/store.ts:692` | `rejectPlan` drops the person's feedback, so Claude never sees why a plan was rejected | Changed (`rejectPlan` takes `feedback`) |
| 7 | D04 | `extensions/ritemark/webview/src/components/ai-sidebar/CodexView.tsx:382` | "Always allow" removed and OpenCode's `alwaysAllow` ignored, a working feature taken away | Changed (`AcpRuntime.ts` passes `alwaysAllow`) |
| 8 | D04 | `extensions/ritemark/webview/src/components/ai-sidebar/store.ts:839` | OpenCode turns send only prompt, model and approval mode, so attachments and a dismissed active-file chip are ignored | Changed (attachments and `skipActiveFile` sent) |
| 9 | D04 | `extensions/ritemark/src/codex/CodexRuntime.ts:282` | Codex maps only image attachments, so PDF and text attachments are silently dropped | Still there (`CodexRuntime.ts:336`) |
| 10 | D04 | `extensions/ritemark/src/views/UnifiedViewProvider.ts:299` | Codex lost its browser reminder (use Ritemark's browser tools, never `open`); the routing hint is Claude's only | Changed (neither line is there) |
| 11 | D04 | `extensions/ritemark/src/daemon/AgentDaemon.ts:153` | The headless runner starts runtimes with no approval mode, so scheduled runs default to Auto and never ask | Gone (`AgentDaemon.ts` removed) |
| 12 | D04 | `extensions/ritemark/src/codex/CodexRuntime.ts:300` | A Codex model ID hard-coded outside `modelConfig.ts`, beside other copies | Changed (only in a test now) |
| 13 | D09 (PR #141, `f0b9d34a`) | `extensions/ritemark/src/extension.ts:234` | A quarantine launch records the attempt again and skips confirmation, so every later launch says "Reverting" | Still there (`extension.ts:299`) |
| 14 | D09 | `extensions/ritemark/src/extension.ts:223` | A quarantined version isn't marked as skipped, so Auto mode downloads it again and the crash loop repeats | Still there (`extension.ts:288`; no skip on quarantine found) |
| 15 | D09 | `extensions/ritemark/src/update/activationIntegrity.ts:65` | Attempted and confirmed versions live in shared `globalState`, so a second window can quarantine a good update | Still there (`activationIntegrity.ts:41`) |
| 16 | D09 | `extensions/ritemark/src/update/activationIntegrity.ts:100` | Cleanup keeps only the current and last confirmed versions, so another profile or a dev build deletes the rollback copy and staged updates | Still there (`activationIntegrity.ts:100`) |
| 17 | D09 | `scripts/release-extension-preflight.sh:97` | `grep -F` matches a shell-tier path anywhere in a file's path (`vscode` in `.claude/skills/vscode-development/`), blocking extension releases | Changed (a prefix match now) |
| 18 | D09 | `docs/development/RELEASING.md:45` | The guide says a failed start reverts automatically; the code misses load-time failures | Still there (`RELEASING.md:72`) |
| 19 | D06 (PR #8, `473e3da4`) | `extensions/ritemark/webview/src/components/DataTable.tsx:254` | Delete and insert row use the sorted view's index, so in a sorted CSV another row is deleted from the file | Changed (`row.index`, `DataTable.tsx:545`) |
| 20 | D06 | `extensions/ritemark/src/docxEditorProvider.ts:175` | Security: "Open in Word" passes the file name through a shell (`open -a … "${filePath}"`), so a crafted name runs a command | Gone (file removed; `utils/openExternal.ts` passes arguments, no shell) |
| 21 | D06 | `extensions/ritemark/webview/src/components/viewers/PDFViewer.tsx:66` | Every page box takes page 1's size, so a PDF with mixed page sizes is cut off | Still there (one `pageWidth`/`pageHeight`, `PDFViewer.tsx:166`, `:580`) |
| 22 | D08 (`f8acfb17`) | `extensions/ritemark/src/ritemarkEditor.ts:1058` | An outside change repaints the editor but leaves the document stale, so a later property change saves over the agent's edit | Gone (`handleExternalDiskChange` removed; Sprint 115's sync coordinator) |
| 23 | D08 | `extensions/ritemark/package.json:14` | Security: `untrustedWorkspaces.supported: true` runs the whole extension, agents included, in Restricted Mode | Still there (`package.json:13`) |
| 24 | D11 (`9cc928ed`) | `extensions/ritemark/src/agent/setup.ts:363` | Any saved Anthropic key makes Claude's sign-in read as an API key before the CLI is asked, moving a Claude.ai user to API billing | Changed (the CLI is asked first) |
| 25 | D11 | `branding/product.json:54` | Security: trust off trusts every folder, so a downloaded folder's automatic tasks and workspace settings take effect | Still there (`product.json:201`; since patch 013 the key takes effect) |
| 26 | D13 (PR #27, `46380193`) | `extensions/ritemark/webview/src/components/FindBar.tsx:145` | The find bar is absolutely placed inside the scrolling editor, so it scrolls out of view | Still there (`FindBarShell.tsx:91`) |
| 27 | D13 | `extensions/ritemark/webview/src/components/FindBar.tsx:61` | The scroll effect is keyed on the match count, so editing with the bar open scrolls away from the caret | Still there (`FindBar.tsx:57`) |
| 28 | D13 | `docs/releases/v1.5.3/release-notes.md:56` | The notes describe an `onUpdate` change the commit doesn't make, and leave out the block-menu changes | Still there (`release-notes.md:65`) |
| 29 | D15 (PR #266, `640e2aac`) | `extensions/ritemark/webview/src/components/ai-sidebar/store.ts:2368` | The new `refreshing` flag is read nowhere, so a re-check of a known runtime shows no progress and can't time out | Still there (`store.ts:2694`; no reader found) |
| 30 | D01 (PR #543, `53a0456a`) | `extensions/ritemark/src/guidance/GuidanceHost.ts:280` | Home's key sheet stores keys with a bare `secrets.store`, skipping the Claude status refresh and the OpenRouter switch that Settings and the welcome do | Still there (`GuidanceHost.ts:320`) |
| 31 | D01 | `extensions/ritemark/webview/src/components/home/home.css:490` | Home restyles `ui/` controls locally (the input, buttons, the split button's parts) | Still there for the input and buttons (`home.css:525`, `:543`); the split button's rules moved to `ui/split-button.tsx` |

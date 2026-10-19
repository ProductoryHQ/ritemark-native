# The browser's share question: the audit (W14, R20)

Checked 2026-10-19 on `sprint-134-project-at-the-centre` (main `eae1dedd` with #462's plan). Line numbers are this branch's; `vscode/` paths are VS Code 1.117.0 with the 18 patches applied.

## 1. Every path that opens upstream's share dialog

The dialog lives in one place: `BrowserViewModel.setSharedWithAgent(true)` (`vscode/src/vs/workbench/contrib/browserView/common/browserView.ts:596–661`). With no stored choice it calls `dialogService.confirm` ("Share with Agent?", Allow, Deny, "Don't ask again"), which is modal and blocks the window (#455). With the stored choice (`browserView.shareWithAgent.dontAskAgain`, profile scope, stored only with Allow, `:630–632`), it shares at once. Before both, a page the network policy blocks gets an info dialog and is not shared (`:598–610`).

| Caller | Who starts it | What this sprint does |
|---|---|---|
| 009's `workbench.action.browser.ensureActiveBrowserShared` (`ritemarkBrowserContextFeature.ts:255–273`), from `BrowserContextStore.ensureSharedForActiveTab` (`src/browser/BrowserContextStore.ts:114–130`), from the AI sheet's poll (`views/UnifiedViewProvider.ts:3057–3063`) | Ritemark, when a page becomes the AI's context | **Moves to the AI's sheet** |
| Annotation mode on an unshared page: `setAnnotationMode(true)` (`browserView.ts:693–700`), from 009's toggle on the browser tab | The person's click on the browser tab | Keeps today's dialog |
| Control: `setSharedWithAgentForControl(true)` on an unshared page (`browserView.ts:680–691`), after 010's own "Allow AI to control this browser tab?" (`ritemarkBrowserActionFeature.ts:28–43`) | The AI asking to act on a page | Keeps today's dialogs (*Non-Requirements*) |
| Upstream's "Share with Agent" toggle in the URL bar (`browserEditorChatFeatures.ts:203–259`) | The person's click | Unchanged. It shows only while `canShareBrowserWithAgentContext` holds, meaning Copilot Chat's agent and its browser tools are on (`:216–224`) |

Only the first is the question #455 is about: it opens without a click, while the person may be doing something else. The other three answer a click of the person's own, so a dialog there blocks nothing they didn't start.

Found on the way: on a page not yet shared, Allow Control is followed by the share dialog (control needs read sharing, `browserView.ts:681–686`), so the person is asked twice. That is today's behaviour; this sprint leaves it.

## 2. When the host asks

- The sheet's host polls the active browser tab every 1.5 s, only while the sheet is visible (`_refreshBrowserContextPolling`, `UnifiedViewProvider.ts:3124–3135`, started and stopped on `onDidChangeVisibility`, `:1560`). So the question is only asked while the sheet is shown. A hidden sheet asks nothing and shares nothing; the page is asked about once the sheet shows.
- `ensureSharedForActiveTab` marks the tab (`pageId`) as asked before it asks (`BrowserContextStore.ts:118`), so a tab is asked about once per session, whatever the answer. A tab keeps its `pageId` across reloads and navigation (memory: integrated browser events), and its sharing stays with it.
- `buildTurnContext` sends nothing about a tab that isn't shared, not even its address (`BrowserContextStore.ts:167–175`, Sprint 67 D5). That holds whatever the sheet shows.

## 3. The bridge takes the answer

`ensureActiveBrowserShared` gains one optional argument: `{ pageId, answer?: 'share' | 'notNow', withoutAsking?: boolean }`.

- **No answer:** if the tab is shared, it returns as today. If the stored choice is set, it shares as today (`setSharedWithAgent(true)` opens no dialog then). Otherwise it returns the tab's DTO with `needsAnswer: true` and opens nothing.
- **`share`:** if `pageId` is no longer the active tab, it shares nothing and returns `stale: true`. Otherwise it runs a new model method beside upstream's, `shareWithAgentAnswered(withoutAsking)`. It does exactly what Allow does in `setSharedWithAgent`: the network policy's check and notice first, the stored choice only when `withoutAsking` is set, then `startTrackingPage` and `_setSharedWithAgent(true)`. It is a hunk in `browserView.ts`, which 009 already patches (`009:76`), and an interface line in `IBrowserViewModel`.
- **`notNow`:** it shares nothing.

Upstream's telemetry call goes with Allow's copy too; product telemetry is off in Ritemark, so it sends nothing.

## 4. The host and the sheet

- **Asking:** `ensureSharedForActiveTab` calls the bridge with no answer. On `needsAnswer`, the host posts `browser:share-question` to the sheet with the tab's `pageId`, its title (the address's host when there is no title) and the AI's name in use. It no longer marks the tab as asked before the answer.
- **Answering:** the sheet posts `browser:share-answer` (`pageId`, `answer`, `withoutAsking`), and the host calls the bridge with it. Only then is the tab marked as asked for this session: after Share it is shared; after Not now it is not asked again this session (today's Deny).
- **Withdrawing:** when the poll finds another tab in front, or no browser tab, the host posts `browser:share-question-clear`. The tab left unanswered stays unshared, and is asked about again when it comes back in front (S55).
- **The card** is new, in the sheet above the message box: `webview/src/components/ai-sidebar/ShareQuestionCard.tsx`, from the UI components (`Button`, the checkbox, a tooltip on each button), with experience 28 frame 1's words. A message sent while it shows goes without the page, because `buildTurnContext` still finds the tab unshared.
- The three messages are typed in `views/agentSidebarProtocol.ts`.

## 5. What changes in the plan

- **Spec R20:** one refinement. A page left unanswered is asked about again when it comes back in front (S55 already expects it), and only an answer marks it as asked for the session. Today the tab is marked before the dialog opens.
- **Technical plan W14:** `pageId` in the bridge's argument, and `stale` when the tab in front has changed; the model method `shareWithAgentAnswered`. The other three callers keep upstream's dialog, recorded in the architecture's browser section.
- **Tests:** `BrowserContextStore.test.ts` (new): no answer with the stored choice shares; no answer without it asks; Share; Share with the box; Not now, then not asked again; a stale answer shares nothing; a withdrawn question asks again later; `buildTurnContext` gives nothing before Share. A webview test for the card's states, keyboard and words per AI. A CDP check that the tab row works while it waits.

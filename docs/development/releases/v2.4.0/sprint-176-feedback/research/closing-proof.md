# Sprint 176 closing proof

The six implementation PRs are on main. PR 1 (#1068, `22bc481c`) landed earlier. On 27 November 2026, PR 2a (#1135, `519090a8`) added the card quote, prefill, chosen answer, drafts per context and dismissal. PR 2b (#1136, `baa8e034`) added the e-mail-only window picture and Copy words / Copy picture. PR 3 (#1137, `121314aa`) added answer thumbs, inline words and AI failure feedback. PR 4 (#1139, `3da82723`) added Home's open-source card and Help's two community links. PR 3b (#1140, `e78feaf9`) added Publish and unreadable Word and PowerPoint file feedback.

Each PR's GitHub **Review record** holds its High review rounds and proof. The manager's close-out summary records a clean `/security-review` for each PR, Experience lead approval of every visible PR, and isolated Rundev runs with screenshots in the manager's scratchpad.

| Scenario from [scenarios.md](../scenarios.md) | Result | Evidence and remaining checks |
| --- | --- | --- |
| S1 · Completed answers | Waits for Gate 2 | #1137 covers completed-answer thumbs. The sidebar's `answerFeedback.test.ts`, `lifecycle.test.ts` and `runtimeSwitching.test.ts` exercise the feedback and plan approval paths, including store behavior. Check ChatGPT plan approval with thumbs in the app using Jarmo's sign-in. |
| S2 · Usage data off or offline | Proven by test | #1137 host `answerFeedback.test.ts` and #1135 `consent.test.ts` cover local marks and consent-gated telemetry. |
| S3 · Optional words and selected answer | Proven | #1135 and #1137 Rundev review records cover the sheet and sidebar. `feedback.test.ts` and the sidebar's `answerFeedback.test.ts` cover payloads, the selected turn and closing the line. |
| S4 · Removable failure quote | Waits for Gate 2 | #1135, #1137 and #1140 cover the quote, AI failures and unreadable Word and PowerPoint files. `feedback.test.ts`, `consent.test.ts`, `failureFeedback.test.ts` and `officeFailureFeedback.test.ts` cover routing, consent and quote checks. In the app, open **Tell us about this** from the Publish failure notification using a Cloudflare token (covered by `vscodePublish.test.ts)) and from OpenCode's quota failure card (the dev build had no bundled OpenCode). |
| S5 · Failed send and e-mail fallback | Proven | #1135 and #1136 review records cover the sheet and picture handoff. `feedback.test.ts` and patch 018's `ritemarkFeedbackSheet.test.ts` cover retry, mail and clipboard outcomes. |
| S6 · Home eligibility and priority | Proven by test | #1068 and #1139 `homeEligibility.test.ts` and `guidance.test.ts` cover both qualifying paths, the later session, update and slot priority. #1139 has Rundev proof of the card. |
| S7 · Home choices and display caps | Proven by test | #1068 and #1139 `homeEligibility.test.ts`, `GuidanceHost.test.ts` and `HomePanel.test.ts` cover the shared reservation, release and rolling caps, restoration, dismissal and link outcomes. |
| S8 · Local window picture | Proven | #1136 Rundev review record covers the window preview and macOS handoff. Patch 018's `ritemarkFeedbackSheet.test.ts` covers clipboard timing, detached windows and the 1.5-second capture timeout. |
| S9 · Windows capture and mail | Waits for Gate 2 | #1136 covers the macOS handoff and tests the Windows clipboard format. At 150% Windows scaling, check the correct window picture and readable controls. Paste the picture into Windows Mail, Thunderbird and Outlook. The clipboard writes only the registered `PNG` format on Windows. |
| S10 · Native Help | Waits for Gate 2 | #1139 covers Help on macOS; `open-source-links.test.mjs` checks the fixed link targets. Check the two items beside Send feedback and their mnemonics in the Windows native menu. |
| S11 · Upgrade and saved days | Proven by test | #1068 `homeEligibility.test.ts` covers migration, repeated and nonqualifying saves, and the shared reservation across windows. |
| S12 · Controls and dismissal | Waits for Gate 2 | #1135, #1136, #1137 and #1139 carry the visible review evidence. Patch 018's `ritemarkFeedbackSheet.test.ts` covers sheet dismissal and short-window layout. The Windows native Help items and their mnemonics still need the S10 check. |

**Totals** · 3 proven, 4 proven by test, 5 wait for Gate 2.

Growth owns the privacy wording on its page. Jarmo's yes is still due before publication.

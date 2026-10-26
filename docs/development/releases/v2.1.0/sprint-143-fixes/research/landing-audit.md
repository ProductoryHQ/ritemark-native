# A1: the first chat's AI after the welcome (#551)

The planning session's 21 runs are this audit's first table ([reproductions.md](reproductions.md#551-after-the-welcome-is-finished-with-chatgpt-the-chat-sometimes-opens-on-claude)): 21 of 21 landed on ChatGPT. Nothing reproduced it, so R2 closes every way found in the code for the first chat to stay on Ritemark's default AI.

## The paths, from the welcome to the first chat

1. The welcome's Continue (or a sign-in, or saved keys) sets `readyProvider` (`welcomeHost.ts`, `welcome/continue`, `providerReadyFromWelcome`).
2. Open a folder…, a new project or the sample calls `goTo()`: it writes the landing record (`ritemark.welcome.landing.v1`) with `landingProvider()`, marks the welcome finished, and calls `vscode.openFolder`, which reloads the window.
3. After the reload, `runLanding()` reads the record. `decideLanding` lands only for this window's folder, within ten minutes, once.
4. `land()` shows Home and calls `openLandingChat(runtime, "Ask ChatGPT about this project")`, which posts `landing:new-chat` to the AI's sheet when it is ready (`sidebar/ready`), or holds it until then.
5. The sheet's store makes a new chat and keeps the landing pending until the AI's model is known; then it switches the chat to that AI (`selectRuntimeModel`, which also posts `ai-select-agent`, saving `ritemark.ai.selectedAgent`).

Until step 5, the sheet's blank chat is bound to `ritemark.ai.selectedAgent`, which the welcome never wrote: on a fresh profile, Claude.

## The three ways the chat stays on Claude, and what R2 does

| Way | Before | Sprint 143 |
|---|---|---|
| No usable landing record after the reload (not written in time, another folder's spelling, older than ten minutes) | Silent; the chat is on the default | The chosen AI is saved as `ritemark.ai.selectedAgent` before the reload (`selectedAgentOnLeave`), so the chat is on it anyway; the reason is logged (`whyNoLanding`), including "the welcome finished, but it left no landing record" |
| The landing posted to a sheet that is then replaced | The new sheet never hears of it; its chat is on the default | The same saved setting: the new sheet's first bootstrap binds its blank chat to the chosen AI |
| The sheet's wait for the model list ends (20 s, every AI) | The landing is dropped; the chat stays on the default | ChatGPT's and Claude's lists are local and always come, so their landing waits for them; only OpenCode's gives up, and tells the log (`landing/dropped`). Unit-tested: a ChatGPT list arriving after 25 s still lands (it failed on `main`) |

## Not done

The plan asked for each way forced by hand in a running app (a deleted record, a sheet replaced during the landing, a held model list). They were not run: the first two are closed by the same saved setting, whose write is unit-tested and whose effect the sheet's first bootstrap already has (`agent:bootstrap` binds the blank chat to `selectedAgent` while the store isn't ready); the third is unit-tested. The 20-run check is the running-app proof (S3).

# Terminal tabs audit (Sprint 132, Workstream 7, R8)

Read-only audit of VS Code 1.117.0 for "the terminal is a tab". Written 2026-10-17.

- VS Code paths are relative to `vscode/src/vs/`. Extension paths are relative to `extensions/ritemark/`.
- The tree read is the `T17b` scratch tree: patches 001–017 with commit `73a1cecf`'s new 002 and 007. So 002's terminal guards are already gone there, and `terminal.contribution.ts` keeps only the removal of the Toggle Terminal shortcut and its View-menu entry.

## Five things the plan should change

1. **Running starts at `onCommandExecuted`, not `onCommandStarted`.** `onCommandStarted` fires when the prompt is drawn, while the shell sits idle (sequence B). The command runs between C (`onCommandExecuted`) and D (`onCommandFinished`).
2. **The working dot cannot be drawn by `multiEditorTabsControl.ts`.** Code in `vs/workbench/browser` may not import terminal code (`vscode/eslint.config.js:1709-1723`). The tab already asks the editor input for extra classes (`multiEditorTabsControl.ts:1647`). So the class comes from `TerminalEditorInput.getLabelExtraClasses()` (`terminalEditorInput.ts:205`), and the stylesheet draws the dot. The tab control needs no change.
3. **Ctrl+` does nothing while a terminal has focus** unless the command is in `terminal.integrated.commandsToSkipShell`. Without that, the key goes to the shell.
4. **A terminal can still open by itself at start.** If the panel shows the terminal view at start and no terminal was restored, the view makes one (`terminalView.ts:166-171`). `terminal.integrated.hideOnStartup: "always"` stops this.
5. **The extension undoes "editor" at every start.** `src/extension.ts:311-331` removes `terminal.integrated.defaultLocation` whenever its value is `editor`. With an `editor` default this does nothing today, but its comment and purpose are now wrong. It goes, together with the start-up terminal at `src/extension.ts:598-608`.

## 1. Shell integration

**How the capability arrives.**
- Every instance has a capability store that merges the stores of its parts (`workbench/contrib/terminal/browser/terminalInstance.ts:214`). The xterm shell-integration store is added at `terminalInstance.ts:925-927`.
- `TerminalCapability.CommandDetection` (`platform/terminal/common/capabilities/capabilities.ts:30`) is created lazily. It appears when the first VS Code (`633`) or FinalTerm (`133`) sequence arrives, normally at the first prompt (`platform/terminal/common/xterm/shellIntegrationAddon.ts:484-497`, `764-770`).
- So a component that binds to a new terminal must expect the capability to come later. Use `instance.capabilities.onDidAddCommandDetectionCapability` (`capabilities.ts:82`) or `createOnDidAddCapabilityOfTypeEvent` (`capabilities.ts:95`). For all terminals at once there is `ITerminalService.createOnInstanceCapabilityEvent` (`terminalService.ts:1374-1376`). It handles terminals created later and capabilities added later.

**The events** (`capabilities.ts:207-224`):
- `onCommandStarted` (sequence B): the prompt is drawn and the person can type. Fired at `commandDetectionCapability.ts:560`.
- `onCommandExecuted` (sequence C): Enter was pressed and output begins. Fired at `commandDetectionCapability.ts:576` (Windows heuristics: `817`, `911`).
- `onCommandFinished` (sequence D): the command ended, also after Ctrl+C. Fired at `commandDetectionCapability.ts:423`. If C never came, it fires `onCommandExecuted` first (`:386-388`).
- `executingCommand` is the command line once E or C has arrived (`:45`, `:444`, `:575`). It is cleared when D arrives (`:425`).
- To read the state at bind time, use `currentCommand.commandExecutedMarker` set and `commandFinishedMarker` not set (`capabilities/commandDetection/terminalCommand.ts:229-244`).

**Which shells get it automatically** (`platform/terminal/node/terminalEnvironment.ts:53-280`). This needs `terminal.integrated.shellIntegration.enabled`, which defaults to true (`workbench/contrib/terminal/common/terminalConfiguration.ts:612-617`).
- macOS: zsh (`:197-276`), bash (`:147-162`), fish (`:163-182`) and pwsh (`:183-196`). The Mac default profile is `zsh -l` (`platform/terminal/common/terminalPlatformConfiguration.ts:240-242`), which is supported (`:200-202`).
- Windows: `pwsh.exe` (PowerShell 7) **and** `powershell.exe` (Windows PowerShell 5.1) both get the same script (`:110-124`). Git Bash `bash.exe` gets it too (`:125-140`). The setting's help text lists only "pwsh, git bash", but the code covers 5.1.
- Windows `cmd.exe` and any other shell: no integration (`:141-142`). Windows builds before 18309: none (`:78-81`).
- Not injected for task and debug terminals (`:70-72`), or when a profile passes its own arguments (`:118-119`, `:206-207`).
- In PowerShell, C is sent only when PSReadLine is loaded (`workbench/contrib/terminal/common/scripts/shellIntegration.ps1:205-232`). Without PSReadLine, Running would only flash at the end. In ConstrainedLanguage mode (locked-down company PCs) the script exits and there is no integration at all (`shellIntegration.ps1:11-14`).

**Without integration** there is no `CommandDetection`. Only `PartialCommandDetection` exists (`shellIntegrationAddon.ts:369`), and it knows that Enter was pressed but not when the command ends. So the bar shows no Running chip. One option exists if we ever want a signal without integration: `onDidChangeHasChildProcesses` (`workbench/contrib/terminal/browser/terminal.ts:966`, `terminalInstance.ts:357-358`). It comes from a process poll in the pty host (`platform/terminal/node/childProcessMonitor.ts:81-95`), works on every shell, and lags by about a second. I do not recommend it for the chip.

**After a window reload**, a command that was still running comes back with only its start marker. `onCommandStarted` fires, but `onCommandExecuted` does not (`commandDetectionCapability.ts:475-490`). So Running is lost until that command ends.

**The scripts ship.** The desktop build copies `out-build/vs/workbench/contrib/terminal/common/scripts/*.{fish,ps1,psm1,sh,zsh}` and `psreadline/**` (`vscode/build/gulpfile.vscode.ts:87-93`). Patch 001's change to that file only adds fonts. The installed v1.14.0 app has all eight scripts in `Contents/Resources/app/out/vs/workbench/contrib/terminal/common/scripts/`.

## 2. Stop

Use `instance.sendText('\x03', false)`.
- It writes Ctrl+C into the terminal's input (`terminalInstance.ts:1360-1381`). On macOS, the terminal turns it into SIGINT for the running program. On Windows, ConPTY turns it into a Ctrl+C event for the console's programs. VS Code itself stops commands this way (`terminalInstance.ts:1029-1030`, `terminalContrib/chatAgentTools/browser/executeStrategy/noneExecuteStrategy.ts:77`).
- `instance.sendSignal('SIGINT')` (`terminalInstance.ts:1384-1387`) calls node-pty's `kill`. On macOS that signals the shell, not the running program (`vscode/node_modules/node-pty/lib/unixTerminal.js:226-229`). On Windows it throws "Signals not supported on windows." (`windowsTerminal.js:150-154`).
- `workbench.action.terminal.sendSequence` writes to the active terminal (`terminalContrib/sendSequence/browser/terminal.sendSequence.contribution.ts:42`). That may not be the bar's terminal.

## 3. Names

**How a tab's title is made.**
- The tab shows `instance.title` (`terminalEditorInput.ts:194-196`) and updates when it changes (`:161`).
- With no name, the title follows `terminal.integrated.tabs.title`, default `${process}` (`terminalConfiguration.ts:348-352`), so the tab says "zsh" or "powershell". `${sequence}` is the title the program sets for itself (`:30`). There is no numbering variable.
- A name set by the API or `rename()` is a "static title" and always wins in the label (`terminalInstance.ts:2740-2741`), even when Claude Code runs inside and asks for its own title (`:2690-2695`).

**Does a name survive a reload or a restart?** Yes, when it is an API name.
- The workbench sends a static title to the pty host, 500 ms after it changes, while `enablePersistentSessions` is on (`terminalService.ts:737-747`). The pty host stores it (`platform/terminal/node/ptyService.ts:377-380`, `:736-743`).
- A terminal editor saves `title` and `titleSource` in the window's editor state (`terminalEditorSerializer.ts:37-52`). On reload the instance takes them back (`terminalInstance.ts:571-574`).
- On a restart the pty host passes the name on only when its source was the API (`ptyService.ts:290`).
- Side effect: an API name marks the session as used (`ptyService.ts:737-739`), so an unused named terminal is also revived after a restart (`:837`). That fits R8.

**One trap with `rename()`.** Renaming before the shell is ready leaves VS Code listening to the shell's own title (`terminalInstance.ts:1491-1500`). The next title the shell sends sets the source to "Sequence" (`:1892-1895`, `:2119-2130`). The tab still says "Terminal", but the editor state then saves source "Sequence", and after a reload the shell's title can replace the name.

**Naming new terminals reliably.**
- `ITerminalService.onDidCreateInstance` (`terminalService.ts:129-130`, `:201-203`) fires right after the instance is built (`terminalInstanceService.ts:52`). That is before its process starts, which waits for xterm and the container (`terminalInstance.ts:540-545`).
- In that handler, set `instance.shellLaunchConfig.name` (`platform/terminal/common/terminal.ts:496`). VS Code fills this object in the same way (`terminalInstance.ts:551-559`). Then the terminal behaves exactly like "Install Codex": the title is static from the start, VS Code never listens to the shell's title (`:1491-1492`), and the pty host gets the name (`ptyService.ts:794-796`). Also call `instance.rename(name)` so the tab shows the name before the shell is ready.
- A terminal "has its own name" when `shellLaunchConfig.name` is set. Skip terminals that are revived (`attachPersistentProcess`, `:562`), hidden (`hideFromUser`, `:607`), task or debug (`isFeatureTerminal`, `:619`; `type === 'Task'`, `:501`), extension pseudoterminals (`customPtyImplementation`, `:552`) or templated (`titleTemplate`, `:685`).
- Pick the lowest free number among the open terminals' titles: "Terminal", then "Terminal 2". Counting open tabs would give two "Terminal 2" tabs after the first one closes.

## 4. Moving panel terminals to the desk

**Where saved terminals come back.**
- Terminal editors come back through the editor serializer as tabs (`terminalEditorService.ts:238-244`, `terminalProcessManager.ts:339`).
- Terminals from the terminal view are recreated from the saved layout, always with `location: TerminalLocation.Panel` (`terminalService.ts:536-556`). That includes a v1.14.0 profile's terminals from the AI column, because 1.14 kept every terminal in the view.
- On a restart, the pty host first revives the saved processes (`electron-browser/localTerminalBackend.ts:325-369`). Only orphans are recreated, and `restoredGroupCount` counts them (`terminalService.ts:497-521`). Hidden terminals come back as hidden background terminals (`:523-534`). They are not in any group and must be left alone.
- `whenConnected` resolves after the panel terminals exist and their old output has been replayed (`terminalService.ts:311-332`). That is the moment to move them.
- The view container is now registered in the panel as the default (`terminal.contribution.ts:107-116`). VS Code saves only locations a person changed (`services/views/browser/viewDescriptorService.ts:667-677`), so a 1.14 profile's terminal view is in the panel now. An AI column that last showed the terminal falls back to its default container (`browser/layout.ts:1195-1209`).

**Can a contribution move them all?** Yes.
- `ITerminalService.moveToEditor` (`terminalService.ts:800-811`) removes the instance from its panel group and opens it in the active desk. It opens without `preserveFocus` (`terminalEditorService.ts:140-160`), so each moved terminal takes the front and the focus. At start that would hide the person's document.
- Better: open the instance's resource with `IEditorService.openEditor({ resource: instance.resource, options: { pinned: true, inactive: true, preserveFocus: true } })`. The terminal editor resolver removes it from its panel group itself (`terminalMainContribution.ts:91-123`).
- For terminals made later in the panel, listen to `ITerminalGroupService.onDidChangeInstances`. Do not use `onDidCreateInstance` for moving: at that point the group is not registered yet (`terminalGroupService.ts:162-185`). Move on the next tick, never inside the event.

**Pitfalls.**
- **Panel flash.** An extension that asks for the panel and then calls `terminal.show()` opens the panel first (`api/browser/mainThreadTerminalService.ts:201-211`, `terminalGroupService.ts:188-208`). When the last panel terminal leaves, `hideOnLastClosed` (default true) closes the panel again (`terminalService.ts:204-212`). Expect a short flash, only for third-party callers. Ritemark's own calls never use the panel.
- **A terminal made by the view.** See "Five things", item 4. Toggle Panel (Cmd/Ctrl+J) can also open the terminal view, which then makes a terminal that moves to a tab.
- **`terminalView.ts:225`** calls `showPanel(false)` again, now that it is upstream. It only runs when the view is already visible, so it does no harm.
- **Move Terminal into Panel** (in a terminal tab's menu) still exists. The guard will move the terminal straight back. Hiding that menu entry is optional.
- **W4's guard.** If a person dragged the terminal *view* into the AI container in 1.14, the saved view locations hold that. R16's "other views go to the left column" would then put the terminal view there. The W4 guard should send the terminal view back to its own container.

## 5. The default

- New terminals use the location asked for, else `terminalConfigurationService.defaultLocation` (`terminalService.ts:1073`). With 002's guard gone, that getter honours the setting again (`terminalConfigurationService.ts:29-34`). The editor branch opens a tab (`terminalService.ts:1227-1241`).
- The extension host passes no location when the caller gives none (`api/common/extHostTerminalService.ts:195`, `api/browser/mainThreadTerminalService.ts:180-182`). So with `"terminal.integrated.defaultLocation": "editor"`, `vscode.window.createTerminal(...)` opens a tab. `terminal.show()` then reveals that tab (`mainThreadTerminalService.ts:205-206`).
- Every extension call, none of which passes a location:

| Call | Where | Shell |
|---|---|---|
| Codex Repair (Settings) | `src/settings/RitemarkSettingsProvider.ts:1363` | `powershell.exe` on Windows, else default |
| Claude Login | `src/agent/installer.ts:279` | same. **No caller:** only exported (`src/agent/index.ts:23`); sign-in uses the subprocess |
| Install Git | `src/agent/installer.ts:379` | `powershell.exe` (Windows, winget only) |
| Install Node.js | `src/agent/installer.ts:400` | `powershell.exe` (Windows, winget only) |
| Install Codex | `src/agent/installer.ts:421` | `powershell.exe` on Windows, else default |
| Codex Repair (AI column) | `src/views/UnifiedViewProvider.ts:2648` | `powershell.exe` on Windows, else default |

- All are named, so they keep their names. All get shell integration: zsh on the Mac, Windows PowerShell 5.1 on Windows.
- Today `package.json:769` says `"view"`.

## 6. The shortcut

- An extension may bind any command. `"key": "ctrl+`"` means ⌃` on the Mac and Ctrl+` on Windows. VS Code's own Ctrl+` binding is gone with 002's removal (`terminal.contribution.ts:125-126`).
- `workbench.action.createTerminalEditor` (`workbench/contrib/terminal/common/terminal.ts:448`) creates a terminal in the active desk (`terminalActions.ts:315-326`).
- It sets no folder, so the terminal starts in the last active workspace folder, or the home folder without one (`terminalService.ts:1186-1202`, `common/terminalEnvironment.ts:215-218`, `terminalProcessManager.ts:503-509`). With one project open, that is the project's folder.
- **Inside a terminal** the key reaches the shell. Only commands in `commandsToSkipShell` skip it (`terminalInstance.ts:1147-1155`), and `createTerminalEditor` is not in the default list (`common/terminal.ts:507-635`). Add `"terminal.integrated.commandsToSkipShell": ["workbench.action.createTerminalEditor"]` to `configurationDefaults`. The list adds to VS Code's defaults (`terminalInstance.ts:1962-1967`), and extensions may set it (`api/common/configurationExtensionPoint.ts:191`).
- **Other backquote bindings:** Ctrl+Shift+` is New Terminal (`terminalActions.ts:1219-1220`). Under the `editor` default it also opens a tab. Ctrl+Shift+Alt+` is New Terminal Window (`:361-362`). Alt+` is Windows-only dictation in a text editor (`codeEditor/browser/dictation/editorDictation.ts:54`). Nothing else uses Ctrl+`.

## 7. What else relied on the terminal in the AI column

- In VS Code: nothing left. `73a1cecf` removed View > Advanced > Terminal (it ran `workbench.action.terminal.toggleTerminal`), and 007 no longer pins `terminal` in the AI column's list. Patch 003 hides the top Terminal menu and patch 001 gives the terminal a Phosphor icon; neither cares where the terminal is.
- In the extension: only `src/extension.ts:598-608`, which focuses the AI column and runs `workbench.action.terminal.new`, plus the reset at `:311-331` and `package.json:769`. Nothing uses `workbench.panel.terminal`, `terminal.focus`, `toggleTerminal` or a terminal `TerminalLocation`. The webview only mentions terminals in text.

## Recommendation

**`ritemarkTerminalTabs.ts`** (019), in `workbench/contrib/terminal/browser/`. Register it with `registerWorkbenchContribution2(..., WorkbenchPhase.AfterRestored)`, imported from `terminal.contribution.ts` after line 49 and registered after line 66, well away from 002's lines.
- *Names:* on `onDidCreateInstance`, if the instance is eligible (see section 3), set `shellLaunchConfig.name` to the lowest free "Terminal"/"Terminal N" and call `rename()`. Leave revived 1.14 terminals named as they are ("zsh"). Numbering them too is a product choice.
- *Move:* `await terminalService.whenConnected`, then move every `terminalGroupService.instances` entry with `openEditor(..., { pinned, inactive, preserveFocus })`. After that, on `terminalGroupService.onDidChangeInstances`, schedule the same sweep (`RunOnceScheduler`, 0 ms). For a terminal made at runtime, open it active with `preserveFocus: true`. Skip `hideFromUser`.
- *Running state* lives here too, so the bar and the tab share it: a map from instance to running. Feed it from `createOnInstanceCapabilityEvent(CommandDetection, c => c.onCommandExecuted)` (running) and the same for `onCommandFinished` (not running). Expose `isRunning(instance)` and `onDidChangeRunning`.

**`ritemarkTerminalBar.ts`** (019), used by `terminalEditor.ts`.
- One fixed-height bar placed before the overflow guard in `createEditor` (`terminalEditor.ts:117-123`). Hook it in `setInput`/`clearInput` (`:76-101`) to bind the instance, and in `layout` (`:163-170`) give the terminal `height - barHeight`. That is four one-line calls in one file.
- Keep the height fixed. Showing and hiding the bar would resize the terminal at every command, and full-screen programs such as Claude Code redraw on every resize.
- The bar shows "Running" and Stop only while `isRunning`, and shows nothing without `CommandDetection`. Stop calls `instance.sendText('\x03', false)`, then `instance.focus()`. Stop is a shadcn-style button with a tooltip ("Stop the running command"), and `cursor: pointer` comes from the global rule.

**The working dot.**
- Change `TerminalEditorInput.getLabelExtraClasses()` (`terminalEditorInput.ts:205`) to add `ritemark-terminal-running` while `isRunning`. Also fire `_onDidChangeLabel` on `onDidChangeRunning`, next to the listeners at `:153-166`.
- CSS: `.tabs-container .tab:not(.active) .ritemark-terminal-running::after` draws the chat rail's dot. No change to `multiEditorTabsControl.ts`.

**The extension.**
- `package.json` `configurationDefaults`:
  - `"terminal.integrated.defaultLocation": "editor"`
  - `"terminal.integrated.hideOnStartup": "always"`
  - `"terminal.integrated.commandsToSkipShell": ["workbench.action.createTerminalEditor"]`
- `package.json` `keybindings`: `{ "key": "ctrl+`", "command": "workbench.action.createTerminalEditor" }`.
- Remove `src/extension.ts:598-608` (the start-up terminal) and the `defaultLocation` reset with its comment (`:312-315`, `:322-327`).
- The six `createTerminal` calls need no change. Separately, decide whether the unused `openClaudeLoginTerminal` should go.

**Tests.** VS Code unit tests:
- the sweep moves a panel instance to an editor and skips hidden ones;
- names pick the lowest free number;
- `onCommandExecuted` and `onCommandFinished` flip the running state.

002's `terminalConfigurationService.test.ts` change is already gone.

## Checked only at runtime

1. **Mac, zsh (default) and bash.** `sleep 5` shows Running and the dot, which clear on finish. Stop interrupts `sleep 30` and `npm install`. Running clears after Ctrl+C. Repeat with oh-my-zsh or powerlevel10k if available.
2. **Claude Code in a terminal tab.** Running stays on while it runs. Stop may need two presses, because Claude asks for a second Ctrl+C. The name stays "Terminal".
3. **Windows.** Default PowerShell 7 if installed, Windows PowerShell 5.1 (our own terminals) and Git Bash: Running, Stop with `ping -t localhost` and a `winget` install. `cmd.exe` shows no chip. Note whether PSReadLine is loaded.
4. **Ctrl+`** opens a new tab in the project's folder, from a document and from inside a focused terminal, on the Mac and Windows. Try an Estonian keyboard layout too. Ctrl+Shift+` also gives a tab.
5. **Names.** Open three terminals: "Terminal", "Terminal 2", "Terminal 3". Close "Terminal", open one: it is "Terminal". "Install Codex" keeps its name.
6. **Reload Window.** Tabs reconnect with their names and output. A command still running loses its Running chip until it ends (expected, see section 1).
7. **Restart.** Cmd+Q, then start: tabs come back as tabs with their names and a "restored" banner. On the Mac, closing the window without quitting does not revive (`persistentSessionReviveProcess: onExit`, `terminalConfiguration.ts:550-560`).
8. **v1.14.0 profile**, with terminals in the AI column, then first 2.0 start:
   - they come back as tabs behind the open document;
   - no panel flash and no extra terminal;
   - the AI column shows the AI;
   - no terminal opens by itself 2.5 s later.
   Repeat with that profile's panel left open.
9. **Toggle Panel** (Cmd/Ctrl+J) and **Move Terminal into Panel.** Note what the person sees. Both should end with a terminal tab and a closed panel.

# PR 3's checks: a Flow is written only by an edit (R4, #571), a step without its key (R5, #580)

Run on 1 November 2026 on the Mac, branch `sprint-145-loose-ends-flows` from `main` at `39b4e37f`. Each check was run on `main` first (E1).

## R4: selecting or measuring a step writes nothing

**The cause** (A9, [flow-save-timing.md](flow-save-timing.md) on PR 1's branch): `onNodesChange` and `onEdgesChange` set `isDirty` for every React Flow change. React Flow reports a selection (`select`) and a measurement (`dimensions`) as changes too, so opening a flow (its steps are measured once drawn) and clicking a step each started the 500 ms autosave. Neither is in the file (`toFlow` keeps a step's id, type, position and data, an edge's id and ends). **The fix**: only a change other than `select` or `dimensions` marks the flow dirty, and a look never clears a change that is waiting to be saved. Edges get the same rule: clicking an edge was the same write.

**A9's runner** (`research/repro/a9-flow-save.mjs` on PR 1's branch; Sprint 144's harness with the committed `media/webview.js`, headless, three runs a row):

| Case | `main` | This branch |
|---|---|---|
| Opened, the step clicked 400 ms after `flow:load` | one `flow:save` 509–516 ms after load (110 ms after the click) | none |
| Opened, nothing clicked | one `flow:save` 507–512 ms after load | none |
| Opened, the save answered, then clicked 1.5 s after load | a second `flow:save` 519–523 ms after the click | none |

**Sprint 144's harness** (`flow-step-panel/shoot.mjs`, all four scenarios): the panel's layout, the model picker's states over time and the late-config case are the same on both bundles, measurement for measurement; `main`'s log has a `flow:save`, the branch's has none. (The harness rewrites its `theme-light.css`; that change was reverted, not committed.)

**Unit test** `webview/src/components/flows/stores/flowEditorStore.test.ts` (S26): `dimensions` and `select` on steps, `select` on an edge, and a look after an edit (stays dirty); `position`, `remove`, `add`, `replace`, a mixed batch, an edge removed or added, and a field edit all mark the flow dirty. It fails on `main` at its first assertion ("measuring the steps does not mark the flow dirty").

**Dev instance** (`scripts/qa/flow-step-check.mjs`, below): the flow file's modified time is unchanged 3 s after the flow is drawn and after each of four steps is selected with a real mouse press and release (CDP input, so React Flow's pointer path runs) (S29). A step's label typed in its panel, a step dragged on the canvas and a step deleted from its panel each wrote the file (S28). Adding a step from the palette (an HTML drag and drop) was not driven; the unit test covers the store's `addNode`.

### Review round 1: what R4 had been hiding

A look used to mark the flow dirty, so the next click or measurement wrote whatever an earlier write had missed. R4 took that away, and the review found what it had covered:

- **An edit made while the host wrote the flow was marked saved and never written.** `flow:saved` cleared the dirty flag whatever had changed since the copy was sent, and the host dropped a `flow:save` that came during another write (`isUpdating`), answering nothing. Now the webview remembers the copy it sent; a `flow:saved` while the flow differs from it writes again after the usual 500 ms, and the host runs its writes one after another. `research/repro/pr3-save-race.mjs` (the harness, a host that answers 600 ms late, the label typed again during the wait), three runs each: `main` and round 1's head write "First" only; this branch writes "First", then "Second". So this was `main`'s too, whenever no look came after the write.
- **Cmd+S saved the document without the edit the autosave hadn't sent, then marked it clean.** Cmd+S now sends the pending flow with `flow:requestSave`; the host writes it, then saves (after any write in progress). In the dev instance a label typed and saved with Cmd+S at once is in the file.
- **A step added from the palette, or brought back by undo, had no step number** until something else changed: it took its number from React Flow's measurement, which R4 had stopped recomputing the run order for. The run order is recomputed on every change again, and `addNode`, `deleteNode`, `deleteEdge`, `undo` and `redo` compute it themselves.

`src/flows/flowSaves.test.ts` (the host's writes) fails on round 1's head and `main` in 3 of 4 cases; `flowEditorStore.test.ts` adds the store's own edits.

## R5: one sentence and a link for every step without its key

**The four places** and what they said on `main` (from `src/flows/stepNeedsKey.test.ts` run against `main`'s source):

| Place | `main` | This branch |
|---|---|---|
| AI step on OpenAI, a run | `LLM error: OpenAI API key not configured. Go to Ritemark Settings to add your API key.` | `This step needs an OpenAI API key to run. Add it in Settings` |
| AI step on Gemini, a run | `LLM error: Google AI API key not configured. Go to Ritemark Settings to add your API key.` | `This step needs a Google AI API key to run. Add it in Settings` |
| OpenAI image step, a run | `OpenAI API key not configured. Use Command Palette → "Ritemark: Configure OpenAI API Key"` | the OpenAI sentence |
| OpenAI image step's model list (panel) | `⚠️ OpenAI API key not configured` (the host's answer, from the test; the panel's line read from the code) | the OpenAI sentence, "Add it in Settings" as the link |
| AI step's panel (either provider) | nothing (no key check; the host's answer, from the test) | the provider's sentence and link, beside the model list |
| Google image step (run and panel) | Sprint 144's sentence and link | unchanged |

The "LLM error:" prefix was the AI step's wrapper for any error; a missing key's sentence now passes through it, as Sprint 141's `FlowStepError` does. The test fails on `main` in 10 of its 12 cases; the two that pass are the unchanged ones (the Google image step, and a step with its key).

**Dev instance**: a hidden dev instance of this branch (`open -n -g -j`, an isolated profile under `/private/tmp`, `--use-mock-keychain`, scratch homes for the AIs, CDP on a free port), on a fresh profile with no keys stored, the check's flow open (`flow-step-check.mjs --make-flow`). Every check passed:

- Each of the four steps' panels reads its key's sentence, "Add it in Settings" is a link button with no native title, and hovering it shows the Experience lead's tooltip ("Open Settings at the OpenAI API key", "Open Settings at the Google AI API key") (S30–S33).
- The link opens Settings with that key's card at the top: the OpenAI card's top 24 px from the page's top (its `scroll-mt-6`), the Google AI card's the same (S30, S32).

Screenshots (Ritemark Light, 1440 × 900 at 2×): [the AI step on OpenAI](../qa/r5-llm-openai-panel.png), [the AI step on Gemini](../qa/r5-llm-gemini-panel.png), [the OpenAI image step](../qa/r5-image-openai-panel.png), [the Google image step](../qa/r5-image-gemini-panel.png) (each with its tooltip shown), [Settings at the OpenAI key](../qa/r5-settings-openai-api-key.png).

**A key set** (S34): covered by `stepNeedsKey.test.ts` with a placeholder in a stand-in secret store (no sentence for either provider). No key was typed into the dev instance.

**Review round 1:** the host checks the key before any network call (the missing-key answer no longer waits on the catalog's refresh), in one place for both step kinds; the secret names are in one map (`STEP_KEY_SECRETS`); both panels draw the line under the model picker with one function, in Sprint 144's order (loading, a saved model the list lacks, the missing key, any other error); a key change asks for the list again without first dropping the list the panel shows; `GOOGLE_IMAGE_KEY_NEEDED` is gone (the Google image step uses `GOOGLE_AI_KEY_NEEDED`, the same words).

## What was found beside them

- **Settings named the wrong image model.** The OpenAI card said "Image Generation (GPT Image 1.5)" while the image steps' default is GPT Image 2 (`DEFAULT_MODELS.flowImage`). The same class as Sprint 144's image card ("one fixed model name"). The name is dropped: "Image Generation".
- **Dev-tree noise, not this change:** the dev instance's clone of the patched VS Code tree has no compiled built-in extensions, so it shows three notifications at start ("Activating extension 'vscode.configuration-editing' / 'vscode.emmet' / 'vscode.github-authentication' failed: Cannot find module …/out/…"), as A7 recorded. They were cleared before the screenshots. A file passed on the command line at start opened in the text editor; opened from Quick Open it took the Flow editor (its default). Neither is in a release build.

## Not run

- Windows (the overlay), for S26–S34.
- The dev-instance check on `main`'s build (the harness and the unit tests are the `main` side).

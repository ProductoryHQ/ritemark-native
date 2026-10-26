# The Word spike (#497): what each AI reads

Run on 26 October 2026, on Jarmo's Mac (Apple silicon), by Sprint 140's engineer. The protocol is the technical plan's *Phase 1*. This note holds the runs, the numbers and the decision. Its scripts and the run summaries are in `spike/`.

## Summary

| AI | Word documents | PDFs | Offers through a tool (part B) |
|---|---|---|---|
| **ChatGPT** (Codex 0.163, GPT-6.1 Sol, Auto) | **Pass on the Mac:** 3 of 3 first looks read all three newest Word files, with no approval, no error and no stall (40–73 s). Manual asked before its first command. The open Word file was answered from the file, and the answer named the older note that disagrees. | **5 of 6 Mac runs read every newest PDF.** The other run answered right but only after 7 min 27 s, which the rule counts as a stall. | **Fails:** 0 of 3 first looks called `offer_next_steps`, although the tool was in its tool list. |
| **Claude** | **Not run.** No Claude sign-in on this Mac can be read: `claude auth status --json` says `loggedIn: false` for the bundled dev copy, the installed 2.0.1's copy and `~/.local/bin/claude`. The Development manager saw the same from its own shell. Nobody signs in for Jarmo while he is away, so Claude's runs are an open item. | Not run | Not run |
| **OpenCode** | **Not run.** Ritemark's picker and send gate need one of the four cloud keys (OpenAI, Google, Anthropic, OpenRouter). No test key exists yet, and placeholder keys or redirected providers are ruled out (the Development manager, 26 October). | Not run | Not run |
| Any AI on **Windows** | Not run: the Windows rounds need the Development manager's Windows session. | Not run | Not run |

**Decision, from what ran:**

- **Word documents:** no Ritemark reading is built (R1a is not built). The one AI that ran passes. The rule's step 3, Ritemark's Markdown of a Word file as a tool, waits on Claude's and OpenCode's runs. If either fails, it is built then for all three, as the rule says.
- **PDFs:** no Ritemark reading. ChatGPT passes at 5 of 6 on the Mac, one stall included.
- **Every AI's standing instructions gain the honesty line** (spec R1). It is built: when an AI can't open a file it was asked to read, it says which.
- **The ready request is sent as drawn**, with no "read what you can" words (R1b is not applied). The card's note, "Reads the names, then the five newest documents.", is true of the one AI measured.
- **The Word-or-PDF starting points stay behind the spike's gate.** They need every AI to pass a kind (spec R1, R8). Until Claude and OpenCode are run, a Word file or PDF in front gets the project's starting points. The gate is one constant (`READ_KINDS_EVERY_AI_PASSED` in `guidance/startingPlace.ts`); the words for a Word file or PDF are built and tested behind it.
- **R7, the answer's two offers as cards, is not built.** Part B fails for ChatGPT, and the rule needs all three AIs to pass. Frame 2 goes back to the Experience lead to redraw with the offers written into the answer (spec J3).

## The fixture

`spike/make-training-work.py` writes two fictional folders under `/private/tmp/s140`. Every Office file's author and saver fields are empty.

- **Training work:** 37 files: 20 Word documents, 10 PDFs (8 with text, 2 scanned pictures of a page), 4 spreadsheets and 3 Markdown files, in client folders. The five newest files are 3 Word documents and 2 PDFs. Each holds a planted fact that only reading it gives (`spike/facts.json`). An older Markdown note says the Harbour survey is "to be decided", so an answer that never opened the proposal shows it.
- **Training PDFs:** 10 PDFs (8 with text, 2 scanned). The five newest are text PDFs.

## How the runs were made

Each run used the dev build of this sprint's base (2.0.1 plus the part B prototype) on a clean profile. It was launched hidden, with `--use-mock-keychain`, its own user-data and shared-data folders, `RITEMARK_BUILD_CHANNEL=test`, usage data off, and the `PATH` a new Mac has (`/usr/bin:/bin:/usr/sbin:/sbin`, so `pdftotext` and `tesseract` were out of reach). Agent binaries were the 2.0.1 release's bundled ones (Codex 0.163.0).

`spike/spike-run.mjs` drives one run over CDP:

1. a new chat with the AI (the landing's own message);
2. the mode set from the composer's menu;
3. the drawn message sent from the message box;
4. it waits for the turn to end, at most 6 minutes;
5. it keeps the chat's record, a trace of the host's messages to the AI's sheet, and a summary.

`spike/analyze.mjs` scores each answer against the planted facts. A file counts as read when its fact is in the answer.

The record does not keep Codex's command lines, and a process sampler at 250 ms caught none of them. Codex reads inside its own sandbox: Ritemark sees `commandExecution` 3 to 8 times per first look, and not which program ran. On the Mac, `textutil` and `mdls` are always there for Word files.

`~/.codex/config.toml` was not changed by the runs: its modification time is 22 October before and after. Codex writes its own session logs under `~/.codex/sessions`, as every Ritemark ChatGPT chat does.

## The runs (ChatGPT)

| Run | Mode | Time | Newest files read | Approval | Notes |
|---|---|---|---|---|---|
| chatgpt-auto-1 | Auto | 73 s | 5 of 5 (3 Word, 2 PDF) | none | |
| chatgpt-auto-2 | Auto | 40 s | 5 of 5 | none | 3 commands |
| chatgpt-auto-3 | Auto | 49 s | 5 of 5 | none | 8 commands |
| chatgpt-manual-1 | Manual | n/a | n/a | asked before its first command (`find . -maxdepth 2 …`) | Stopped by the driver after the question; "says plainly that it needs approval" holds |
| chatgpt-open-word-1 | Auto, `Proposal to Harbour Logistics.docx` in front | 46 s | the proposal: week 2, Mari Tamm, 4 December | none | It named the older note's "to be decided" as a conflict |
| chatgpt-pdfonly-1 | Auto | 7 min 27 s | 5 of 5 | none | **Stall:** no tool use for the first ~6 minutes. It was the first turn after the window switched folders. |
| chatgpt-pdfonly-2 | Auto | 85 s | 5 of 5 | none | |
| chatgpt-pdfonly-3 | Auto | 31 s | 5 of 5 | none | |
| chatgpt-diag-tools | Auto | 13 s | n/a | none | Asked it to list its `ritemark_` tools: `ritemark_offers_offer_next_steps` was among them |

**Part B's ordinary chats** were not run: part B had already failed for ChatGPT (0 of 3 first looks), and the rule's other half can't pass it.

**The scanned PDFs** were never among the newest, as the protocol sets the folders. ChatGPT listed them by name and said it had not opened them, as asked.

## Found on the way

- **ChatGPT's file citations show as raw text.** Codex 0.163 writes `:codex-file-citation{path="…" purpose="source"}` in its answers. Ritemark 2.0.1 draws it as text, so the first look's table reads `Oct 25 — :codex-file-citation{path="/private/tmp/…"}` (2 of 3 first looks, all 3 PDF-only looks). The first look is the ready request's own answer, so this sprint fixes it: the AI's sheet draws the directive as a link to the file, by its name.
- **The first ChatGPT turn after a folder switch waited ~6 minutes before acting** (chatgpt-pdfonly-1). Codex's app-server starts the MCP servers in the person's own `~/.codex/config.toml` (here a design tool's server and ChatGPT.app's computer-use tools), and that start-up is the likely wait. It is not proven, and it is not in this sprint.

## Open

- **Claude's runs** (the first look in Auto ×3, Manual ×1, a Word file in front ×1, the PDF-only folder ×3; part B's three first looks and five ordinary chats), once Jarmo is signed in to Claude Code on this Mac.
- **OpenCode's runs**, once the registry has an OpenCode test key. The bundled OpenCode 1.19.3 lists free models without a key (`opencode models opencode`), but Ritemark's own gate requires a key, and this spike does not go around it.
- **The Windows rounds** for every AI.
- Then the rule decides again for each kind: whether R1a is built, and whether the Word-or-PDF starting points open (one constant).

# A5: ⌘⇧P / Ctrl+Shift+P on Home (R11, S48, #507)

**The script is written; nothing is run.** 31 October 2026.

- [`scripts/qa/home-keys-check.mjs`](../../../../../../scripts/qa/home-keys-check.mjs), from Sprint 143's `repro-513-507.mjs`, made self-contained (raw CDP, no helper library): one hidden launch (or `--attach`), scratch AI homes, and per round the palette key in each of S48's five cases (a click on Home's title, Tab to a control, the line's input, after Home redraws, back on Home by its tab), plus Quick Open and Settings in the first case. Each press prints PASS or FAIL with the workbench's and Home's active elements before it; the exit code is the number of FAILs. Ctrl on Windows, ⌘ on the Mac. `node --check` passes; it has not been run against an instance.
- **The run that counts is a person's** at a real Windows keyboard, ten presses per case, with the dev instance's trace log on (S48). That is the "Ritemark on Windows" session's: **waiting**. Synthetic presses never failed in Sprint 143, and Jarmo's own keyboard on the Mac never failed at 2.1's Gate 1 (S49), so the script is the reproducer for the next sighting, not the proof.
- No code changes without a reproduction (decision 5): if the person's run shows no failure, the evidence goes on #507 and it closes.

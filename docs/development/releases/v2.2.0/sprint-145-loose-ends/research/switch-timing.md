# A3: Who shows the AI column after a project switch (R9, S42–S44, #569)

**Not run in this pass.** 31 October 2026.

`scripts/qa/project-check.mjs --switch-to <folder> --measure 10` switches through File ▸ Open Recent, so the dev instance's profile needs a second project in its recent list. The one hidden instance used for A1, A7 and A8 had only its first project: adding a second needs a folder picked in a native dialog, or a CLI open forwarded to the running window, which can bring the window to the front on Jarmo's screen. The shipped 2.1.0 half would mean launching the installed app, which this run was asked not to touch.

What is known stays as the plan says: Sprint 144 measured the 2.1.0 candidate (10 switches, FAIL), with Home and the AI column timings in #569. A3 gates PR 2's R9 item or PR 5's patch half, not PR 1, so it runs next, on a profile that is given two projects before its one launch (the shared recent list seeded before start), with the markers the plan names.

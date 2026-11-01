# A2: What each AI's edit tool does with a file that changed since it read it (R1, S9, #588)

**Not run.** 31 October 2026.

S9 needs each AI to read a file, have the file changed by a writer, and then be asked to edit it. That needs the AI signed in. This sprint's rule for test launches is scratch homes for the AIs (`CODEX_HOME`, `CLAUDE_CONFIG_DIR`, `XDG_CONFIG_HOME`), never the real `~/.codex`, `~/.claude` or `~/.config/opencode`, and no sign-in or sign-out from a test. A scratch home has no sign-in, so none of the three can take a turn there; signing one in would mean a sign-in from the test, which is not allowed.

The 27 October sighting's ChatGPT write: its session record would be in the real `~/.codex` sessions, which this audit may not read. **Not read.**

What would let it run: Jarmo signs a test home in himself (one per runtime) for a scratch project, or the Windows session runs S9 with its own test accounts. Until then the issue keeps what is known from the sighting and from #588 itself: Claude Code's Edit refuses a write when the file changed since it read it; Codex and OpenCode are not known.

R1 doesn't depend on this: the guard holds a stale write from any writer within its window (A1), and S8 says what it can't cover.

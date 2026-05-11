# Known Issues

This page tracks Ritemark issues whose root cause is in a third-party component (an upstream binary, OS, or external service). Ritemark cannot fix these in our own codebase; they need to be patched upstream or worked around locally.

---

## Codex agent: "failed to install system skills: Directory not empty"

**Status:** Upstream bug in OpenAI Codex Rust binary. Not fixable in the Ritemark extension layer.

### What it looks like

When the Codex agent starts up, it logs an error such as:

```text
ERROR codex_core_skills::manager: failed to install system skills:
io error while remove existing system skills dir: Directory not empty (os error 66)
```

On Darwin, `os error 66` is `ENOTEMPTY` — a directory removal call failed because the target directory still had contents the call could not delete (typically a `.DS_Store` file, an extended attribute, or a stale file held open by a previous Codex process).

### Why it happens

The error comes from inside the `codex-app-server` binary itself, specifically the upstream `codex_core_skills::manager` module ([openai/codex](https://github.com/openai/codex)). The Rust skill-manager calls a non-recursive directory removal during startup, and that call fails on platforms where the directory contains hidden files the call does not handle.

This is **not** in the Ritemark TypeScript layer. Searching the Ritemark source for the error string returns no matches — it originates entirely inside the Codex Rust binary that Ritemark spawns.

### Workaround

Quit Ritemark, manually remove the Codex skills directory, then relaunch:

```bash
# macOS / Linux
rm -rf ~/.codex/skills

# Windows (PowerShell)
Remove-Item -Recurse -Force "$env:USERPROFILE\.codex\skills"
```

After the next Codex startup, the skill-manager will recreate the directory cleanly. The error usually does not recur unless a stale process or `.DS_Store` is reintroduced.

### What Ritemark does about it

- Ritemark cannot fix the bug in our extension layer because the failing code path is inside the upstream Codex Rust binary.
- Bumping the bundled Codex version (which Ritemark does periodically as part of normal releases) may pick up an upstream fix if OpenAI ships one.
- If you hit this and the workaround above does not help, please open an issue at [openai/codex](https://github.com/openai/codex/issues) so it is tracked at the source.

### Related

- Ritemark issue: [#40](https://github.com/ProductoryHQ/ritemark-native/issues/40) — closed; root cause confirmed as upstream.

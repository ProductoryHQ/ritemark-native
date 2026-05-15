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

---

## Codex agent: `ManagerError::Init` on certain repository shapes

**Status:** Upstream issue in OpenAI Codex. A diagnostic note is shown in Settings when this error is detected.

### What it looks like

When the Codex agent starts in certain repositories, it fails to initialize and logs:

```text
ERROR codex_core_skills::manager: ManagerError::Init
```

The Ritemark Settings page shows a diagnostic note when this error is detected, with a link to this page.

### Why it happens

The Codex skill manager fails to initialize in repositories that have unusual shapes — very large directory trees, non-standard encodings, or certain git configurations. The failure happens inside the `codex-app-server` binary before Ritemark's extension layer is involved.

### Workaround

1. Try opening Codex from a smaller working directory: use **File → Open Folder** to open a specific subfolder rather than a large monorepo root.
2. If the error persists, switch the Agent Runtime to **Bundled** in Settings → Agent Runtime (in case a manually installed Codex version introduced the issue).
3. Check the [openai/codex issues](https://github.com/openai/codex/issues) for upstream fixes — Ritemark ships the latest stable Codex binary with each release.

### Related

- Release notes: v1.7.0 — Codex Runtime Hardening (Sprint 66)

---

## AI Browser Control on Codex: `dynamicTools` is experimental upstream

**Status:** Experimental upstream feature in OpenAI Codex App Server. Stable in Ritemark v1.7.1 against the bundled Codex version; could regress with future Codex bumps.

### What it looks like

When using the v1.7.1 AI Browser Control feature with the Codex runtime, the agent silently fails to call any of the `ritemark_browser_*` tools, or Codex's extension trace log shows:

```text
Unknown method "item/tool/call"
```

The Claude runtime is unaffected — only Codex relies on the `dynamicTools` protocol path.

### Why it happens

Codex App Server's `dynamicTools` parameter on `thread/start` is marked experimental upstream. Ritemark v1.7.1 ships against a Codex version where this path works end-to-end, but a future bundled-Codex bump (which Ritemark does periodically) could introduce a protocol change that breaks the wiring.

### Workaround

1. Switch the AI sidebar to the Claude runtime — Claude's MCP-based path (`mcp__ritemark_browser__*`) is not affected by this issue.
2. If you need Codex specifically, downgrade to the Codex binary that shipped with v1.7.1 (Settings → Agent Runtime → bundled).
3. Report the regression at [openai/codex](https://github.com/openai/codex/issues) so the upstream API surface is tracked.

### What Ritemark does about it

Ritemark cannot stabilise an upstream-experimental Codex feature on its own. Each release cycle re-validates the `dynamicTools` round-trip as part of Sprint 69's e2e checklist; if a Codex bump breaks the path, the v1.7.1 AI Browser Control flag's documentation flags Codex as the affected runtime and the workaround above applies.

# Bundled Agent Runtimes

Sprint 57 uses this directory for per-platform agent runtime artifacts.

Expected layout:

```text
binaries/agents/
  win32-x64/
    claude.exe
    codex.exe
    # or codex-app-server.exe
  darwin-arm64/
    claude
    codex
    # or codex-app-server
```

Ritemark prefers these bundled runtimes before falling back to system-installed
`claude` or `codex` binaries. Do not commit runtime artifacts until their
source, checksum, and release redistribution review are recorded.

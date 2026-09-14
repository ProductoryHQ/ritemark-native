# Sprint 116 QA validation

**Date:** 2026-09-14<br>
**Branch:** `codex/sprint-116-runtime-model-baseline`<br>
**Node:** 22.22.1

The final local repository gate passed:

```text
./scripts/validate-qa.sh
Codex QA validation passed
```

The final post-review rerun exited `0` after the schema-v3 build consumers,
shared browser injection, saved unavailable-model presentation, and Windows
pre-sign/post-sign runtime integrity checks were in place.

The gate covered the schema-v3 runtime manifest, installed-file expansion, immutable target copy, safe archive extraction, negative manifest fixtures, release-source/worktree integrity, VS Code native TypeScript, Flow mappings and execution, agent lifecycle and approval routing, webview bootstrap/model presentation, the TipTap security backport, and pre-commit checks.

Before the passing run, this isolated worktree needed its own VS Code submodule checkout, `vscode/node_modules`, `vscode/extensions/ritemark` development link, and webview `patch-package` postinstall. These were workspace setup failures rather than product regressions; the passing run used the worktree-local copies.

All 12 manifest source rows and all 25 installed runtime files also passed `./scripts/fetch-agent-runtimes.sh --all-platforms --verify-only`. Native Apple Silicon version/startup probes and the final authenticated Codex immediate Stop/resend canary passed. Native Intel macOS, Windows, and signed application checks remain PR/release gates.

The accepted fresh-profile RUNDEV session used a clean compiled Ritemark shell,
not either of the rejected stale/Code OSS launches. Codex `0.154.0` then passed
exact response, workspace file-tool, immediate Stop, and resend canaries inside
Ritemark. Claude `2.1.270` then completed a question-and-file-edit turn. OpenCode
`1.18.30` with Gemini reproduced a false `Failed` marker after a successful edit;
normalizing ACP `end_turn` to the shared `completed` status fixed it. The repeated
Gemini 3.1 Pro turn edited README, returned `OPENCODE_UI_OK`, and visibly ended as
`Done`. Full details and the starred-scenario disposition are recorded in
[rundev-smoke.md](./rundev-smoke.md).

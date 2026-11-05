# 2.2.0 runtime review

Done on 5 November 2026 for the 2.2.0 candidate, read-only: no binary, manifest or lockfile changed. The `release-notes` skill doesn't ask for this in the notes, so it lives here. The notes mention the bundled AI tools only if a release updates them.

## Bundled vs latest published

| Runtime | Bundled (`binaries/agents/manifest.json`) | Latest published | Published | Source |
|---|---|---|---|---|
| Claude Code | 2.1.310 (23 Oct) | 2.1.318 | 3 Nov | `npm view @anthropic-ai/claude-code` |
| Claude Agent SDK | 0.3.310 (`extensions/ritemark/package.json`) | 0.3.318 | — | `npm view @anthropic-ai/claude-agent-sdk` |
| Codex (`codex-app-server`) | 0.164.0 (23 Oct) | 0.166.0 (0.165.0 on 27 Oct) | 29 Oct | `gh release list -R openai/codex`, `npm view @openai/codex` |
| OpenCode | 1.19.4 (22 Oct) | 1.19.5 | 28 Oct | `npm view opencode-ai`, `gh release view -R sst/opencode` |
| ripgrep (OpenCode's) | 15.1.0 | 15.2.0 | 15 Jul 2026 (checked on the GitHub release) | `gh release view -R BurntSushi/ripgrep` |

Every runtime is behind by a patch or minor step. None of the newer versions has been run with Ritemark.

## Anthropic model check

`(cd extensions/ritemark && npm run check:anthropic-models)` on `origin/main` (bedd5f77):

```
OK: the bundled Claude Code supports every model in Anthropic's Claude Code catalog.
```

Catalog v4073, issued 2026-11-05T19:44:22Z, expires 2026-11-12T19:44:22Z. Main models: Opus 5.5 (needs 2.1.280+), Sonnet 5.5, Fable 5.1 (needs 2.1.251+), Haiku 5.5. No ALERT, no WARNING.

## Recommendation for the manager

- **Ship 2.2.0 on the bundled runtimes.** The model check is OK, so no current Claude model needs a newer Claude Code. A runtime update is shell-tier and needs its own verification (the `release` skill, *Claude Code and model currency*, step 2, and `docs/development/agent-runtime-compatibility.md`), which doesn't fit 24 hours before the candidate without moving `main` again.
- **Update all three in 2.3** (or a 2.2.x), with the compatibility matrix rows and the verify scripts, unless a newer version's release notes name a fix 2.2 users need. Those notes were not read for this review.
- Re-run `check:anthropic-models` in the release worktree at Step 0: the catalog expires on 12 November and a new model can arrive before then.

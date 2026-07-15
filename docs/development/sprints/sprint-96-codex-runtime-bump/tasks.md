# Sprint 96 — Codex runtime bump (partial #146)

**Scope decision (Jarmo, 2026-07-15):** fold a **Codex-only** runtime bump into the in-flight v1.8.3 release. Claude + OpenCode bumps stay deferred to the full #146 (higher risk: Claude SDK pairing, OpenCode Desktop v2 migration).

**Why now:** the newest Codex model family GPT-5.6 (`gpt-5.6-sol`/`terra`/`luna`, GA 2026-07-09) is absent from bundled `codex-app-server 0.135.0`'s baked catalog, so it never appears in the model picker. The only clean fix is bumping the binary. v1.8.3 is already a shell-tier full-DMG release with Windows/x64 CI + notarization still ahead — piggybacking avoids a second full shell release cycle.

## Change: `codex-app-server` 0.135.0 → 0.144.4

Target 0.144.4 (latest stable as of 2026-07-15; deliberately NOT the 0.145 alpha).

- [x] Manifest: all 3 codex entries (darwin-arm64 / darwin-x64 / win32-x64) — `version`, `sourceUrl` (`rust-v0.144.4`), and recomputed per-tarball `sha256`. `generated` → 2026-07-15. Claude (2.1.156) + OpenCode (1.15.13) untouched.
- [x] Tarball verification (all 3): sha256 computed from the real download; internal `archivePath` unchanged; arch matches `expectedFileArchPattern` (Mach-O arm64 / Mach-O x86_64 / PE32+ x86-64).
- [x] `invocationMode: direct-app-server` re-verified — 0.144.4 still ships the standalone `codex-app-server-*` asset (NOT re-merged into the `codex` CLI). No manifest field flip needed.
- [x] `--version` output `codex-app-server 0.144.4` still matches `codexManager.ts` regex `/codex(?:-app-server|-cli)?\s+([\d.]+)/i`.
- [x] `fetch-agent-runtimes.sh` re-run: downloaded, archive sha256 ok, arch check ok, `--help` smoke ok. (Sidecar `.sha256` guards the installed binary, not the manifest version — had to delete the old binary + sidecar to force a clean re-fetch.)
- [x] Fallback catalog refreshed to the GPT-5.6 family (slugs confirmed directly from the installed binary's baked strings): `bundledCatalog.ts` codex default `gpt-5.3-codex` → `gpt-5.6-sol`, models → sol/terra/luna. `CodexRuntime.ts:300` plan-mode default → `gpt-5.6-sol`.
- [x] `binaries/agents/README.md` bundled table refreshed (Codex 0.144.4, Claude 2.1.156, OpenCode row added).

## Regression pre-flight (#146 checklist — Codex only)

- [x] Tarball: standalone binary confirmed, `archivePath` unchanged.
- [x] Protocol diff 0.135.0 → 0.144.4 (researched vs the openai/codex repo at both tags): core RPC surface UNCHANGED — `thread/start`, `turn/*`, `account/*`, `model`/`model/list`, `item/*` events, `ReviewDecision` enum all identical. Only breaking removal is `thread/turns/items/list` → `thread/items/list`, which Ritemark **does not use** (grep clean).
- [x] `--version` regex + models_cache slug format unchanged.
- [x] Codex unit tests pass (`codexApproval`, `bundledAgentRuntime`, `modelCatalog`); extension compiles clean.
- [ ] **Manual live-turn smoke — deferred to re-Gate-1:** drive one real Codex turn on `gpt-5.6-sol` through the app (needs Jarmo's Codex auth) — confirm streaming, approval gate, and that GPT-5.6 now appears in the picker. This is the coverage gap the mocks can't fill; Jarmo does it as part of testing the rebuilt v1.8.3 DMG.

## Notes / follow-ups

- **ReviewDecision discrepancy (pre-existing, NOT introduced here):** our `codexProtocol.ts` types `ReviewDecision = 'accept'|'acceptForSession'|'decline'|'cancel'` and `CodexRuntime.ts` sends `'accept'`/`'decline'`, but the upstream app-server protocol crate uses `'approved'`/`'approved_for_session'`/`'denied'` at BOTH 0.135.0 and 0.144.4. Approval works in prod on 0.135.0 and the enum did not change across the bump, so this bump introduces no new risk — but it's worth reconciling under the full #146.
- Full #146 (Claude 2.1.156 → 2.1.210 + SDK, OpenCode 1.15.13 → 1.18.1 Desktop-v2) remains open for a later shell release.

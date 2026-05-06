# Sprint 64 — Handover Note (2026-05-06)

For the next Claude session continuing this sprint. Read this **before** the sprint plan — it captures live state, gotchas, and where to pick up.

## Identity

- **Sprint:** 64 — Bundled Agent Runtimes
- **Branch:** `sprint-64-bundled-agent-runtimes`
- **Plan:** `docs/development/sprints/sprint-64-bundled-agent-runtimes/sprint-plan.md`
- **Approval gate:** Phase 2→3 cleared by Jarmo on 2026-05-06 with the canonical phrase `approved`. Implementation phase is active.
- **Owner of decisions:** Jarmo (product). Q1–Q5 all locked — see "Locked Decisions" section at top of sprint plan.

## Phase status

| Phase | Status | Notes |
|---|---|---|
| A — Artifact contract + manifest | ✅ Committed (`5329053`) | `manifest.json` (6 entries), `README.md`, `.gitignore` rules |
| B — `fetch-agent-runtimes.sh` | ✅ Committed (`5329053`) | 392 lines; idempotent via `.sha256` sidecar; cross-platform fetch verified |
| C — macOS packaging gate | 🟡 In progress, **uncommitted** | Build-script edits done + gate logic verified manually; **full prod build not yet run** |
| D — Windows packaging gate | ⬜ Not started | Touches `build-prod-windows.sh`, `build-windows.sh`, `create-windows-installer.sh`, `installer/windows/ritemark.iss` |
| E — Runtime/auth status + Settings UI | ⬜ Not started | Includes obsolete-disclaimer removal (see "Carry-forwards" below) |
| F — `thread/start` timeout UX | ⬜ Not started | Independent of A–E; can be done any time |
| Phase 3→4 gate | ⬜ Pending | qa-validator review at sprint end before final commit |

## Uncommitted changes (Phase C work-in-progress)

```
M scripts/build-prod.sh                   (Step 2 fetch + renumber to /8)
M scripts/validate-build-output.sh        (Check 5: manifest-driven artifact gate)
M docs/.../sprint-64.../sprint-plan.md    (Phase C checklist results + smoke-test rationale)
```

Out of Sprint 64 scope (do not include in Sprint 64 commits):

```
M docs/development/sprints/sprint-62-conversation-runtime/ux-options.html  (pre-existing; not Sprint 64)
?? docs/development/sprints/sprint-64-bundled-agent-runtimes/notes/        (Codex bonus-track planning note)
```

## Phase C — what's done and what's left

### Done (uncommitted)

- `build-prod.sh`: new **Step 2/8** "Bundled Agent Runtimes" calls `./scripts/fetch-agent-runtimes.sh --platform darwin --arch "$ARCH"` between validate-env (Step 1) and gulp (Step 3). All step numbers renumbered to /8.
- `validate-build-output.sh`: new **Check 5** "Bundled Agent Runtimes" — Python parses `manifest.json` from inside the `.app`, iterates entries matching `darwin-$ARCH`, asserts file presence, exec bit, and `expectedFileArchPattern` substring match in `file -b` output.
- Sprint plan Phase C checklist updated with completion + rationale.

### Left

1. **Run one full `./scripts/build-prod.sh darwin-arm64`** end-to-end to confirm the new Step 2 fetches correctly and Step 6 (validate) passes on a freshly-built `.app`. ~25 min wall time.
2. (Optional) Same for `darwin-x64` if a build host is convenient. Gate logic is parameterised, not duplicated, so if arm64 works x64 should too.
3. Commit Phase C work.

## ⚠️ Critical gotcha discovered during Phase C verification

**Do not execute binaries from inside a previously-codesigned `.app` bundle as part of build validation.**

What happened: validate-build-output.sh originally ran the manifest's `validationArgs` (`--help`/`--version`) against the binary inside `Contents/Resources/...`. Manually copying the runtimes into the existing signed `Ritemark.app` invalidated its embedded codesign hash table. Subsequent invocation of any binary inside the bundle returned `Killed: 9` (SIGKILL from Gatekeeper). Worse, the entire `.app` then refused to launch with "Ritemark.app is damaged and can't be opened" — it had to be recovered with `codesign --force --deep --sign - <app>` ad-hoc + `xattr -dr com.apple.quarantine`.

**Rule (now encoded in code comment + sprint plan):** post-copy smoke-test inside the `.app` is intentionally dropped. The fetch script (Phase B) already runs the smoke test against the source binary at fetch time. The bytes copied into the `.app` are byte-identical, so re-running adds no value while introducing signing-stage fragility.

If a future change requires post-build binary execution:
- Run it BEFORE the bundle is codesigned, OR
- Re-sign with `codesign --force --deep --sign -` after any modification, OR
- Run it OUTSIDE the bundle against the source path.

The existing local `.app` at `VSCode-darwin-arm64/Ritemark.app` was re-signed ad-hoc and is currently usable. The next full `build-prod.sh` run will produce a fresh, properly assembled `.app` regardless.

## Carry-forwards (raised by sprint-manager during Phase A review)

1. **Before Phase E:** Decide whether to add `invocationMode` to Claude manifest entries or document explicitly that Claude spawn is hard-coded and the field is intentionally absent. Today the field is missing for the 3 Claude entries.

2. **Phase E task already added to plan:** Remove obsolete "audited Codex range" disclaimer.
   - Code: `extensions/ritemark/src/codex/codexManager.ts:71-73,717,764-765` (`MIN_AUDITED_VERSION`, `MAX_AUDITED_VERSION_EXCLUSIVE`, `AUDITED_RANGE_LABEL`, `isInAuditedRange()`, `'untested'` branch of `compatibility.state`).
   - UI: `extensions/ritemark/webview/src/components/ai-sidebar/CodexView.tsx:102-135` (`getCompatibilityNotice` returning title "Codex version not yet audited").
   - Also audit `webview/src/components/settings/RitemarkSettings.tsx` for sibling references.
   - Rationale: bundled Codex is pinned to `0.128.0` which is OUTSIDE the existing `0.111.x-0.124.x` audited window, so the notice would fire on every bundled-runtime user. With manifest-pinned bundled runtime, the version is no longer unknown; capability detection (`approvals`/`requestUserInput`/`planUpdates`) is independently sufficient.

3. **Bundled-vs-system resolver verification:** "Verify bundled runtime wins over system `which codex` / `which claude` when healthy" was originally Phase C; moved to Phase E since it's runtime-resolver code (`setup.ts`/`codexManager.ts`), not packaging.

## Locked decisions (just-in-case quick reference)

| Q | Decision |
|---|---|
| Q1 | On by default. No new flag. |
| Q2 | Build-time fetch. Codex from GitHub Releases (`rust-v0.128.0`); Claude from npm optional packages (`2.1.131`). Pinned by version + sha256. Payloads `.gitignore`d. |
| Q3 | macOS arm64 + macOS x64 + Windows x64. Windows arm64 deferred. |
| Q4 | Manual updates. Settings "Check for updates" button wires to existing Ritemark app-update check. Auto-update deferred. |
| Q5 | Check + Repair only. "Use system runtime" override deferred. |

## Where to pick up (next session, in order)

1. **Read this handover** + `sprint-plan.md`. Verify branch is `sprint-64-bundled-agent-runtimes` and `git status` matches the "Uncommitted changes" list above.
2. **Run `./scripts/build-prod.sh darwin-arm64`** to verify Phase C end-to-end. Watch for: Step 2 fetches successfully (or no-ops via idempotence cache), Step 4 picks up the binaries into the `.app`, Step 6 (validate-build-output.sh Check 5) reports both Codex and Claude OK with their `Mach-O 64-bit executable arm64` lines.
3. **If Phase C build passes:** commit Phase C with a message like `feat(sprint-64): macOS packaging gate for bundled runtimes`. Then move to Phase D.
4. **Phase D:** mirror Phase C wiring into `scripts/build-prod-windows.sh`, `scripts/build-windows.sh`, `scripts/create-windows-installer.sh`, and `installer/windows/ritemark.iss`. Manifest already has `win32-x64` entries; fetch script already supports `--platform win32 --arch x64`. Check 5 of `validate-build-output.sh` is currently darwin-only — extend or fork it for win32.
5. **Phase E:** runtime/auth status model, Settings UI, **and** removal of the obsolete audited-range disclaimer (paths above). UX-expert + vscode-expert collaboration per plan.
6. **Phase F:** `thread/start` timeout UX in `codexAppServer.ts`. Independent.
7. **Sprint end:** invoke `qa-validator` for Phase 3→4 gate before any final commits/release.

## Agents and skills used so far this sprint

- `sprint-manager` — gate enforcement, Phase A review, kickoff routing
- `vscode-expert` — Codex/Claude artifact inspection (Phase A data gathering); fetch script implementation (Phase B)
- Phase C build-script edits done by main agent (no delegation needed)

## Useful commands

```bash
# Verify all 6 runtimes are present and hashes match
./scripts/fetch-agent-runtimes.sh --verify-only

# Re-fetch one platform
./scripts/fetch-agent-runtimes.sh --platform darwin --arch arm64
./scripts/fetch-agent-runtimes.sh --platform darwin --arch x64
./scripts/fetch-agent-runtimes.sh --platform win32 --arch x64

# Validate post-build (after build-prod.sh completes)
./scripts/validate-build-output.sh darwin-arm64

# Recover from a tampered codesigned .app (don't tamper in the first place)
codesign --force --deep --sign - VSCode-darwin-arm64/Ritemark.app
xattr -dr com.apple.quarantine VSCode-darwin-arm64/Ritemark.app

# Full production build
./scripts/build-prod.sh darwin-arm64
```

---

Last updated: 2026-05-06 by main Claude session that completed Phases A+B (committed) and Phase C build-script edits (uncommitted).

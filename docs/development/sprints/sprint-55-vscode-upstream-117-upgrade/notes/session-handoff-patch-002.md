# Session handoff: Patch 002 rebase

Read this doc + `sprint-plan.md` before doing anything. This brief is self-contained — you do not need any prior conversation context.

## Where we are

**Sprint 55** — VS Code OSS upgrade 1.109.5 → 1.117.0. Branch `feat/sprint-55-vscode-117`. Phase 3 (DEVELOP) in progress.

**ULTIMATE RULE — non-negotiable:** ZERO regression from Sprint 54 (Agent Library, v1.6.0). Jarmo was explicit. Agent Library activity bar entry, 6px icon spacing, Properties side panel, every v1.6.0 feature must work identically after the upgrade. If you cannot guarantee a hunk preserves Sprint 54 behavior, STOP and ask.

**Phase 3 approval is already granted** by Jarmo ("approved - proceed"). Patch work continues. Build/dev-mode/release work is for Jarmo personally — do NOT trigger builds.

## What's done (committed)

| Commit | What |
|---|---|
| `58e89ff` | Sprint setup — sprint dir, plan, 4 research docs, marker dirs removed |
| `bf218f3` | 4 patches rebased onto 1.117.0: 001, 003, 005, 006 |

`./scripts/apply-patches.sh --dry-run` reports **5/6 OK** on clean 1.117.0:
- 001 OK, 002 CONFLICT, 003 OK, 004 OK (no changes needed), 005 OK, 006 OK

## What's NOT done

1. **Patch 002 (UI layout)** — only this remains. 29 files in patch, 8 with rejects on 1.117.0. Contains all Sprint 54 chrome work. ← THIS IS YOUR JOB
2. Submodule SHA bump (`vscode` from `0725862` → `10c8e55`) — commit AFTER 002 is done
3. Run `./scripts/validate-qa.sh` — gate before handoff
4. Hand off to Jarmo for Phase 4 (dev mode + Sprint 54 regression checks + prod build + DMG)

## The approach to use (proven on patches 001, 003)

For files in 002 that **do NOT have Sprint 54 contributions**, you can use sprint-57's post-patched version verbatim:
1. `cp /Users/jarmotuisk/Projects/ritemark-native-sprint-57-vscode-upstream-value-audit/vscode/<file> vscode/<file>`
2. Repeat for every file in the patch
3. `git -C vscode diff --no-color > /tmp/patch-002-body.txt`
4. Wrap with header, save as `patches/vscode/002-ritemark-ui-layout.patch`
5. Validate round-trip (forward apply, reverse apply, status clean)

For files in 002 that **DO have Sprint 54 contributions**, the sprint-57 shortcut would lose Sprint 54 work. You must manually merge:
1. Read main's `.rej` hunk (= what Sprint 54 + chrome work intends)
2. Read 1.117.0's current source for that file (upstream's new state)
3. Apply main's intent at the new line position, preserving any new upstream code that doesn't conflict
4. Verify: does the resulting source contain BOTH Sprint 54's specific lines AND any required upstream additions?

## Patch 002 — files needing manual merge (Sprint 54 risk)

Sprint 54 commits that touched 002:
- `a696814` (Sprint 54 release v1.6.0) — Agent Library activity bar entry
- `86e3844` (6px activity bar spacing fix) — only touches `activitybar/media/activityaction.css`

The 8 files with `.rej` on apply:

| File | Sprint 54 risk | Approach |
|---|---|---|
| `src/vs/workbench/browser/parts/activitybar/activitybarPart.ts` | **HIGH** (Agent Library entry) | Manual merge |
| `src/vs/workbench/browser/parts/activitybar/media/activitybarpart.css` | **HIGH** (Sprint 54 chrome) | Manual merge |
| `src/vs/workbench/browser/parts/activitybar/media/activityaction.css` | **HIGH** (6px spacing fix) | Manual merge |
| `src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarActions.ts` | Unclear | Verify via `git log 0ccbedc..main -- patches/vscode/002-*.patch` first |
| `src/vs/workbench/browser/parts/panel/panelActions.ts` | Unclear | Verify first |
| `src/vs/workbench/browser/parts/paneCompositePart.ts` | Unclear | Verify first |
| `src/vs/workbench/browser/parts/titlebar/titlebarPart.ts` | Unclear | Verify first |
| `src/vs/workbench/contrib/terminal/browser/terminal.contribution.ts` | Likely no Sprint 54 | Sprint-57 shortcut may be safe — verify |

To check whether Sprint 54 commits touched a specific file in 002:
```
git show a696814 -- patches/vscode/002-ritemark-ui-layout.patch | grep "<file path>"
git show 86e3844 -- patches/vscode/002-ritemark-ui-layout.patch | grep "<file path>"
```

The 21 files in 002 NOT in the rejects list apply cleanly — leave them alone.

## Validation protocol (use this for every patch)

```bash
# Reset to clean 1.117.0
git -C vscode reset --hard 1.117.0
find vscode -name "*.rej" -delete

# Apply check (must exit 0)
git -C vscode apply --check /Users/jarmotuisk/Projects/ritemark-native/patches/vscode/002-ritemark-ui-layout.patch
echo "CHECK=$?"

# Round-trip
git -C vscode apply /Users/jarmotuisk/Projects/ritemark-native/patches/vscode/002-ritemark-ui-layout.patch
echo "FWD=$?"
git -C vscode apply -R /Users/jarmotuisk/Projects/ritemark-native/patches/vscode/002-ritemark-ui-layout.patch
echo "REV=$?"
git -C vscode status --short
# Must be empty
```

Then full system check:
```bash
./scripts/apply-patches.sh --dry-run
# Must show: Can apply: 6, Already applied: 0, Conflicts: 0
```

## Key reference paths

- Sprint-57 worktree (post-patched files for the easy shortcut): `/Users/jarmotuisk/Projects/ritemark-native-sprint-57-vscode-upstream-value-audit/vscode/`
- Sprint-57's patches (USE AS REFERENCE ONLY for line-number drift hints, NEVER copy verbatim for 002): `/Users/jarmotuisk/Projects/ritemark-native-sprint-57-vscode-upstream-value-audit/patches/vscode/`
- Main repo vscode submodule: `/Users/jarmotuisk/Projects/ritemark-native/vscode/` (currently HEAD detached at 1.117.0)
- This sprint dir: `/Users/jarmotuisk/Projects/ritemark-native/docs/development/sprints/sprint-55-vscode-upstream-117-upgrade/`

## Critical: Why sprint-57 patches don't work for 002

Sprint-57 was started before Sprint 54 was merged. Sprint-57's patch 002 was rebased from a tree that didn't have Sprint 54's contributions. Cherry-picking sprint-57's 002 silently loses:
- Agent Library activity bar entry registration
- 6px activity bar icon spacing
- Possibly other v1.6.0 chrome polish

For patches 001 and 003, sprint-57's source files were safe because main had no commits to those patches since sprint-57 branched (verified with `diff <(git show 0ccbedc:patches/vscode/001-*) <(git show main:patches/vscode/001-*)` → empty).

For 002, that diff is NOT empty — main has 530+ lines of Sprint 54 + 6px fix changes that sprint-57 lacks.

## After 002 is done

1. Run `./scripts/apply-patches.sh --dry-run` → verify 6/6 OK
2. Bump submodule (it's already at the right SHA in working tree, just need to stage):
   ```
   git add vscode
   ```
3. Commit: `feat(sprint-55): rebase patch 002 (UI layout) + bump vscode to 1.117.0`
4. Run `./scripts/validate-qa.sh` → must pass
5. Update `docs/development/sprints/sprint-55-vscode-upstream-117-upgrade/sprint-plan.md`:
   - Mark Phase 3 checklist items complete
   - Move to Phase 4 (validation by Jarmo)
6. STOP. Hand off to Jarmo with explicit message:
   - Phase 3 complete
   - Phase 4 = dev mode launch + explicit Sprint 54 regression checks
   - Specifically test: Agent Library activity bar entry, 6px spacing, Properties side panel, every v1.6.0 feature
   - Build/DMG is for Jarmo per CLAUDE.md

## Working tree state notes

- The working tree has unrelated dirty state (D old release docs v1.0.x-v1.5.x, M v1.6.0 release-notes.md and screenshots README). Leave these alone — they belong to Jarmo.
- vscode submodule HEAD is detached at 1.117.0 (already moved). Working tree may or may not have patches applied depending on session state — `reset --hard 1.117.0` to start clean.
- Do NOT touch `extensions/ritemark/` — that's Sprint 54 territory and not relevant to patch 002.

## CLAUDE.md reminders

- NEVER pipe build commands through `| tail` or `| head`
- Builds use: `arch -arm64 /bin/zsh -c 'source ~/.nvm/nvm.sh && nvm use 20 && ./scripts/build-prod.sh 2>&1'` (run as background task with 600000ms timeout)
- Dev mode: `arch -arm64 /bin/zsh -c 'unset ELECTRON_RUN_AS_NODE && source "$HOME/.nvm/nvm.sh" && nvm use && VSCODE_SKIP_PRELAUNCH=1 ./vscode/scripts/code.sh'`
- Builds and dev mode are for **Jarmo to run himself** — do not trigger them in patch-rebase work
- Bash CWD does NOT persist between calls — always use absolute paths
- Use `git -C vscode <cmd>` instead of `cd vscode && git <cmd>`

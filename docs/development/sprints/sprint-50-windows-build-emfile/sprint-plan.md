# Sprint 50: Windows Build EMFILE Hardening

## Goal

Restore a reliable Windows release build by reducing packaging-time file pressure in the copied extension tree and fixing the new Node compatibility risk introduced by analytics dependencies.

## Feature Flag Check

- [x] Does this sprint need a feature flag?
  - NO. This is CI/build hardening and dependency compatibility work, not a user-facing feature.

## Success Criteria

- [ ] Windows workflow no longer fails with `EMFILE: too many open files`
- [ ] `Build VS Code (win32-x64-min)` completes on GitHub Actions
- [ ] Build validation still passes for `media/webview.js`, `out/extension.js`, and welcome assets
- [ ] Workflow Node version satisfies the extension dependency engine requirement introduced by `posthog-node`
- [ ] Sprint research documents the root cause and the exact mitigation applied

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| Workflow cleanup hardening | Expand pre-build cleanup in `.github/workflows/build-windows.yml` to remove additional non-runtime extension files before `gulp` |
| Node version update | Raise workflow Node version to a supported value for current extension dependencies |
| RCA note | Document the failure mechanics, evidence, and rationale in `research/root-cause-analysis.md` |
| Re-run verification | Confirm the next Windows workflow run reaches or passes `bundle-non-native-extensions-build` |

## Implementation Checklist

### Phase 1: RCA (COMPLETE)

- [x] Identify the exact failed run and job
- [x] Pull failing GitHub Actions logs with `gh`
- [x] Compare against the last successful Windows build
- [x] Confirm the failure happens in `bundle-non-native-extensions-build`
- [x] Document the evidence in `research/root-cause-analysis.md`

### Phase 2: Workflow hardening

- [x] Update `.github/workflows/build-windows.yml` cleanup to remove more non-runtime extension files before `gulp`
- [x] Preserve only files required by runtime packaging and post-build validation
- [x] Keep the cleanup deterministic and easy to audit in logs

### Phase 3: Node compatibility

- [x] Bump Windows workflow `NODE_VERSION` to a version supported by `posthog-node`
- [x] Check for unintended fallout in install/build steps

### Phase 4: Validation

- [x] Run local QA validation after workflow changes
- [ ] Re-run `Build Windows (x64)` from this branch
- [ ] Confirm the packaging phase completes
- [ ] Record the result in sprint notes or update the checklist

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cleanup removes runtime-required files | High | Keep `out`, `media`, `themes`, `fileicons`, `binaries`, and manifest files intact |
| Node version bump changes dependency behavior | Medium | Limit to the smallest supported bump and verify the full workflow |
| EMFILE persists even after cleanup | Medium | Prune more aggressively or move Windows workflow to a larger/custom-image runner |

## Status

**Current Phase:** 4 (remote workflow verification pending)
**Approval Required:** No

## Branch

`fix/windows-build-emfile-sprint-50`

## What

Brief description of what this PR changes.

## Why

Why is this change needed? Link to related issue if applicable.

Closes #

## Lifecycle

- **Release:** vX.Y.Z / none
- **Sprint:** sprint-NN-name / none
- **Issues:** closes #...
- **User-facing change:** yes / no
- **Release notes needed:** yes / no
- **Architecture doc touched/needed:** yes / no

## How to Test

Steps to verify the change works:

1. ...
2. ...

## Checklist

- [ ] Release plan tracker updated, if release-bound
- [ ] Linked issues updated/closed/deferred
- [ ] Sprint docs updated
- [ ] Release notes/changelog updated or explicitly not needed
- [ ] `npx tsc --noEmit` passes in `extensions/ritemark/` when code changed
- [ ] `./scripts/apply-patches.sh --dry-run` shows every patch as "OK (can apply)" when patches changed
- [ ] Changes are in `extensions/ritemark/` (not direct `vscode/` edits) unless patch work is explicit
- [ ] No telemetry, tracking, or cloud dependencies added without release-plan approval
- [ ] Commit(s) are signed off (`git commit -s`) per DCO

## Screenshots

If this changes the UI, include before/after screenshots.

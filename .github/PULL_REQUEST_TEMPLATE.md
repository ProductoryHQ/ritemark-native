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

## Risk

- **Review tier:** Light / Standard / High (`REVIEW.md`; the highest path wins), set by: `path/...`
- **What could break, and for whom:** one or two sentences.

## How to revert

Pick one, with a line of detail:

- Revert the commit (only before it is in a release)
- An extension-tier release that undoes or fixes it
- A shell release (the change is shell-tier)
- A feature flag already in the build: `flag-name`

Users can't be moved back to an older version: the update feed only offers newer ones.

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

If this changes the UI, include one screenshot that shows the change (a before/after pair in one image is fine). High tier shows the fault first and then fixed, on each platform it touches (`REVIEW.md`).

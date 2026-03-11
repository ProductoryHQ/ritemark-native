# Sprint 43: Welcome Onboarding

## Status

Implementation is complete in dev. Cleanup is in progress. Validation is intentionally deferred until the `1.5.0` production test pass.

## Summary

This sprint turns Ritemark's startup Welcome experience into a branded onboarding home for people who do not know or care that the product is built on top of VS Code.

The implemented Welcome now includes:

- a branded hero with product framing
- `New` creation actions for document, table, and flow
- `Recent files and folders`
- a `Launch check` section powered by real settings/auth state
- external onboarding links to support and blog content

## Documents

| Document | Purpose |
| --- | --- |
| [sprint-plan.md](./sprint-plan.md) | Main sprint scope, current checklist state, and deferred validation items |
| [research/welcome-onboarding-principles.md](./research/welcome-onboarding-principles.md) | Product and UX principles distilled from the earlier analysis |
| [research/welcome-layout-spec.md](./research/welcome-layout-spec.md) | Visible-content spec for the final Welcome screen |
| [notes/implementation-notes.md](./notes/implementation-notes.md) | Current technical baseline and cleanup status |
| [handover.md](./handover.md) | Current implementation state and remaining release-pass work |

## Outcome Target

After this sprint:

- first-time users understand what to do in Ritemark without needing VS Code knowledge
- returning users still see and use `Recent files` as a fast home surface
- startup welcome, walkthroughs, and secondary empty states no longer compete as separate onboarding systems
- release validation can focus on prod parity instead of missing feature work

## Remaining Before Sprint Close

- remove obsolete implementation leftovers from the extension and docs
- run prod-side validation during `1.5.0` release testing

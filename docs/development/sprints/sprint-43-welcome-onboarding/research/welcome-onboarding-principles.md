# Welcome Onboarding Principles

## Source

Primary technical analysis:

- [2026-03-08-welcome-screen-patch-strategy.md](../../../../docs-internal/analysis/2026-03-08-welcome-screen-patch-strategy.md)

## Locked Principles

### 1. One canonical startup welcome

Ritemark should have one true startup Welcome surface:

- `welcomeGettingStarted`

Walkthroughs remain secondary onboarding, not the primary startup home.

### 2. Onboard to tasks, not tools

The Welcome page should orient users around things they want to do, not around editor concepts.

Primary user questions:

- What can I do here?
- What should I click first?
- How do I continue what I was doing?

### 3. Keep Recent files

`Recent files` is not a legacy leftover. It is a high-value returning-user shortcut and should stay visible on the home screen.

The fix is not to remove it. The fix is to place it inside a stronger onboarding structure.

### 4. Hide VS Code mental model in primary copy

Do not lead with:

- VS Code
- workspace
- explorer
- extension
- activity bar

These are implementation details for much of Ritemark's audience.

### 5. Two-level onboarding

Level 1:

- understand the product
- choose a first action

Level 2:

- learn deeper workflows
- walkthroughs
- guides
- tips

### 6. No double-welcome

The user should not see the startup welcome and then get redirected into a second competing onboarding surface unless they explicitly choose it.

---
name: feature-flags
description: Apply the Ritemark feature flag system for experimental, platform-specific, premium, or kill-switch features. Use when deciding whether a change needs a flag or when implementing a new gated feature in extension or webview code.
---

# Feature Flags

Ritemark already has a flag system. Use it deliberately instead of inventing ad hoc conditionals.

## Use A Flag When

- the feature is experimental
- the feature is platform-specific
- the feature needs a kill switch
- the feature is premium or staged rollout material
- the feature is a large or risky UX change

Do not add flags for small fixes, refactors, or routine UI polish.

## Primary Files

```text
extensions/ritemark/src/features/flags.ts
extensions/ritemark/src/features/featureGate.ts
extensions/ritemark/src/features/index.ts
extensions/ritemark/package.json
```

## Implementation Pattern

1. Define the flag in `flags.ts`.
2. Gate extension behavior with `isEnabled(...)`.
3. Add a settings entry in `package.json` if the flag is experimental and user-togglable.
4. Pass enabled state to the webview if UI behavior depends on it.
5. Add or update tests when flag evaluation rules change.

## Validation

```bash
cd extensions/ritemark
npx tsx src/features/featureGate.test.ts
```

## Deep References

- `.claude/skills/feature-flags/SKILL.md`
- `extensions/ritemark/src/features/flags.ts`
- `extensions/ritemark/src/features/featureGate.ts`

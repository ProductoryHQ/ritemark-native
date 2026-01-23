# Feature Flag Architecture Decisions

## Design Principles

1. **Simple over configurable** - 90% of features use defaults
2. **Static over dynamic** - Flags defined in code, not JSON
3. **Single source of truth** - `isEnabled(flagId)` is the only check
4. **Future-proof API** - Can add remote config without changing call sites

## Status Definitions

| Status | Default | User Override | Purpose |
|--------|---------|---------------|---------|
| `stable` | ON | No | Production-ready |
| `experimental` | OFF | Yes (Settings toggle) | Beta features |
| `disabled` | OFF | No | Kill-switch |
| `premium` | OFF | No | Future paid features |

## Evaluation Order

1. Flag exists? No → false
2. Status `disabled`? → false
3. Status `premium`? → false (future: check license)
4. Platform supported? No → false
5. Status `stable`? → true
6. Status `experimental`? → check user setting (default: false)

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| No JSON config file | Harder to type-check, less discoverable |
| No VS Code `when` clauses | Can't control code execution, only UI visibility |
| `disabled` ≠ `experimental` | disabled = emergency kill-switch, experimental = normal lifecycle |
| Include `premium` now | Prevents refactoring later, currently = disabled |
| Platform as explicit array | No wildcard `*`, just list all: `['darwin', 'win32', 'linux']` |
| Gate at highest level | Single check before case block, not scattered in each handler |

## Future Extensibility

- **Remote config**: Add fetch in `isEnabled()`, same public API
- **Premium licensing**: Add license check for `premium` status, same flag definitions
- **Call sites never change** - only `featureGate.ts` internals evolve

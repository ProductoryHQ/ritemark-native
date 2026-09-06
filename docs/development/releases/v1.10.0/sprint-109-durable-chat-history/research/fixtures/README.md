# Sprint 109 Synthetic Fixture Corpus

These files contain invented content only. They model legacy localStorage input,
project-scope identity, corrupt host storage, and injected write failures without
copying any user conversation into the repository.

Fixture values under `legacyEntries[].value` are the parsed JSON values that a
test adapter must serialize before placing them in a localStorage double.
`rawValue` is used when malformed source text itself is the test input.

| Fixture | Covers |
|---|---|
| `known-scoped.json` | Valid single-root scoped migration and repeat-run idempotency |
| `global-duplicate-malformed.json` | Global/unassigned migration, ID and fingerprint dedupe, conflicts, malformed isolation |
| `project-scopes.json` | Single-root, multi-root ordering, `.code-workspace`, Windows case, no-folder, moved-folder non-guessing |
| `corrupt-index.json` | Missing/corrupt index rebuild and one corrupt record quarantine |
| `atomic-failures.json` | Record/index failure ordering and last-verified-version behavior |

The product test harness added in Phase 1 must consume these fixtures directly;
they are not documentation-only examples.

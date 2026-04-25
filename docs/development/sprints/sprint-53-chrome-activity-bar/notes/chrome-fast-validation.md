# Chrome Fast Validation

Date: 2026-04-25

## Why

`npm run compile` catches VS Code chrome TypeScript problems correctly, but it is slow enough that small Activity Bar mistakes are discovered late. Sprint 53 now has a faster guard for patch and chrome work.

## Command

```bash
./scripts/validate-chrome-fast.sh
```

Useful options:

- `--force-ts`: run the VS Code native TypeScript check even when no chrome-sensitive changes are detected.
- `--with-assets`: also run the CI asset parity simulation.
- `--all`: run both optional checks.

## Coverage

- Runs `./scripts/apply-patches.sh --dry-run`.
- Parses `extensions/ritemark/producticons/ritemark-product-icon-theme.json`.
- Verifies the Phosphor 200 font source exists.
- Runs `npm run compile-check-ts-native` when VS Code chrome, patch, product icon, or chrome asset-copy files changed.
- `scripts/validate-qa.sh` now calls this guard before the existing targeted QA checks.

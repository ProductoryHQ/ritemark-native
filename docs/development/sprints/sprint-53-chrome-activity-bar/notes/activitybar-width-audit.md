# Activity Bar Width Audit

Date: 2026-04-25

## Finding

The Activity Bar rail width was split across CSS and TypeScript layout state:

- `activityaction.css` controlled individual action hitboxes and icon presentation.
- `activitybarpart.css` controlled the `.part.activitybar` CSS width.
- `activitybarPart.ts` controlled VS Code grid layout through `minimumWidth`, `maximumWidth`, `ACTION_HEIGHT`, `iconSize`, and `compositeSize`.

The action CSS had already moved the button boxes toward 40px, but the rail still had 48px layout constraints in `activitybarpart.css` and `activitybarPart.ts`.

## Change

- Set the rail container width to 40px.
- Set Activity Bar min/max grid width to 40px.
- Set Activity Bar action height and composite size to 40px.
- Set Activity Bar icon size to 16px.
- Kept URI-backed activity icons at 16px background size.

## Patch Discipline

`patches/vscode/002-ritemark-ui-layout.patch` now includes `src/vs/workbench/browser/parts/activitybar/activitybarPart.ts`, so the patch file count is 25.

Validation run:

```text
./scripts/apply-patches.sh --dry-run
Result: all 6 patches Already applied, 0 conflicts
```

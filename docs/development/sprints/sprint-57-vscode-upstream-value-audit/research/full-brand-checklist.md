# Full Brand Checklist (Sprint 57 / VS Code 1.117.0)

Date: 2026-04-27  
Branch: `codex/sprint-57-vscode-upstream-value-audit`  
Scope: dev runtime + packaged app branding consistency

## Purpose

This checklist verifies that Ritemark branding is consistent across:

1. source-of-truth assets (`branding/`)
2. VS Code fork runtime surfaces (`vscode/`)
3. packaged outputs (`build` artifacts)

Use this as the release gate for "Branding is correct."

## Current Snapshot (2026-04-27)

- `PASS`: app identity metadata is synced in `vscode/product.json` and onboarding defaults are preserved.
- `PASS`: app icons are synced in `vscode/resources/darwin/code.icns` and `vscode/resources/win32/code.ico`.
- `PASS`: workbench custom fonts are present in source and runtime output folders.
- `PASS`: phosphor icon font is present in source and runtime output folders.
- `PASS`: welcome hero assets are present in runtime output (`vscode/out/.../welcomeGettingStarted/browser/media`).
- `PASS`: Welcome editor tab icon now resolves to the branded app icon (`code-icon.svg`).

## Full Checklist

Legend: `PASS` / `FAIL` / `TBD`

| ID | Area | Check | Expected | Verify | Status |
|---|---|---|---|---|---|
| B01 | Source of truth | `branding/product.json` exists and valid JSON | Brand names and ids are Ritemark values | `cat branding/product.json` | PASS |
| B02 | Source of truth | `branding/icons/icon.icns` exists | macOS brand icon available | `ls branding/icons` | PASS |
| B03 | Source of truth | `branding/icons/icon.ico` exists | Windows brand icon available | `ls branding/icons` | PASS |
| B04 | Source of truth | Welcome assets exist in `branding/welcome` | all `ritemark-welcome-*` present | `ls branding/welcome` | PASS |
| B05 | Source of truth | UI font files exist in extension assets | Sofia Sans files present | `ls extensions/ritemark/webview/src/assets/fonts` | PASS |
| B06 | Source of truth | Phosphor web font available from extension deps | `Phosphor-Light.woff2` resolvable | `ls extensions/ritemark/node_modules/@phosphor-icons/web/src/light` | PASS |
| B07 | Source of truth | Branding overlay is merged without losing onboarding/chat defaults | branding keys present and upstream onboarding keys preserved | `node -e "const p=require('./vscode/product.json'); console.log(!!p.defaultChatAgent, !!p.trustedExtensionAuthAccess, !!p.onboardingThemes)"` | PASS |

| B10 | Runtime identity | App menu bar title | should display `Ritemark` (not `Code - OSS`) | visual smoke in dev app | TBD |
| B11 | Runtime identity | Window title app segment | `Ritemark` identity | visual smoke in dev app | TBD |
| B12 | Runtime identity | Bundle/app id | `ai.productory.ritemark` on macOS | `cat vscode/product.json` | PASS |
| B13 | Runtime identity | data folder identity | `.ritemark` | `cat vscode/product.json` | PASS |
| B14 | Runtime identity | URL protocol | `ritemark` | `cat vscode/product.json` | PASS |

| B20 | Runtime icons | mac runtime icon file is branded | `vscode/resources/darwin/code.icns` matches branding icon | `shasum -a 256 branding/icons/icon.icns vscode/resources/darwin/code.icns` | PASS |
| B21 | Runtime icons | win runtime icon file is branded | `vscode/resources/win32/code.ico` matches branding icon | `shasum -a 256 branding/icons/icon.ico vscode/resources/win32/code.ico` | PASS |
| B22 | Runtime icons | titlebar SVG icon is branded | `vscode/src/vs/workbench/browser/media/code-icon.svg` matches branding | inspect file + visual | TBD |
| B23 | Runtime icons | explorer/activity icons use intended set | no fallback/broken glyphs | visual smoke + icon spot check | TBD |
| B24 | Runtime icons | product icon theme loads cleanly | no icon font parse warnings | verify `weight: "normal"` in product icon theme + dev log check | PASS |

| B30 | Typography | Sofia Sans copied to workbench source fonts dir | `vscode/src/vs/workbench/browser/media/fonts/*.woff2` exists | `ls vscode/src/vs/workbench/browser/media/fonts` | PASS |
| B31 | Typography | Sofia Sans copied to runtime output path (dev) | out path has required `.woff2` files | `find vscode/out/vs/workbench/browser/media -name 'SofiaSans*'` | PASS |
| B32 | Typography | `style.css` has valid custom font variable | no malformed declaration | inspect `vscode/src/vs/workbench/browser/media/style.css` | PASS |
| B33 | Typography | Phosphor font copied to codicon source path | `phosphor.woff2` exists | `ls vscode/src/vs/base/browser/ui/codicons/codicon` | PASS |
| B34 | Typography | Phosphor font present in runtime output path (dev) | no missing `phosphor.woff2` at runtime | `ls vscode/out/vs/base/browser/ui/codicons/codicon` | PASS |
| B35 | Typography | Workbench text visually matches brand font | no fallback system font look | visual smoke | TBD |

| B40 | Welcome page | Welcome code imports custom guide CSS | `import './media/gettingStartedGuide.css'` exists | inspect `gettingStarted.ts` | PASS |
| B41 | Welcome page | Welcome hero assets in source media dir | all `ritemark-welcome-*` present | `ls vscode/src/.../welcomeGettingStarted/browser/media` | PASS |
| B42 | Welcome page | Welcome hero assets in runtime output dir | all `ritemark-welcome-*` present in `out` | `find vscode/out/.../welcomeGettingStarted/browser/media -name 'ritemark-welcome-*'` | PASS |
| B43 | Welcome page | Hero background/image renders | no broken image icons | visual smoke | PASS |
| B44 | Welcome page | Footer link icons render | no broken image icons | visual smoke | PASS |
| B45 | Welcome page | Launch check card typography and colors match design | visual parity with intended brand style | visual smoke + screenshot comparison | TBD |
| B46 | Welcome page | Welcome tab icon is branded | tab icon uses Ritemark app icon | inspect `gettingStartedInput.ts` + visual smoke | PASS |

| B50 | About and legal | About dialog branding strings | app name/version/license owner are correct | open About dialog + inspect | TBD |
| B51 | About and legal | Copyright strings | Productory copyright where expected | search patched dialog files | TBD |
| B52 | About and legal | Report issue + docs links | Ritemark URLs | inspect `product.json` values | PASS |

| B60 | Packaging | mac packaged app name and icon | Finder + Dock show Ritemark branding | build + install smoke | TBD |
| B61 | Packaging | windows packaged app name and icon | Start menu/taskbar show Ritemark branding | build + install smoke | TBD |
| B62 | Packaging | packaged welcome assets copied to app resources | hero renders in packaged build | package smoke | TBD |
| B63 | Packaging | installer assets are branded | installer splash/icon match | installer smoke | TBD |

| B70 | Automation guardrails | `scripts/apply-patches.sh` sync step updates branding payloads | product/icons/welcome/fonts copied | dry-run + real apply | PASS (script exists) |
| B71 | Automation guardrails | dev launch path also guarantees required brand assets in runtime output | no manual copy needed for clean worktree | clean-worktree run of `./vscode/scripts/code.sh` | PASS |
| B72 | Automation guardrails | QA includes branding regression checks | failing gate if name/icon/font/welcome breaks | `./scripts/validate-qa.sh` coverage review | TBD |

## Evidence Commands (Copy/Paste)

```bash
# identity hashes
shasum -a 256 branding/product.json vscode/product.json

# icon hashes
shasum -a 256 branding/icons/icon.icns vscode/resources/darwin/code.icns
shasum -a 256 branding/icons/icon.ico vscode/resources/win32/code.ico

# fonts present?
ls vscode/src/vs/workbench/browser/media/fonts
ls vscode/src/vs/base/browser/ui/codicons/codicon
find vscode/out/vs/workbench/browser/media -name 'SofiaSans*'
find vscode/out/vs/base/browser/ui/codicons/codicon -name 'phosphor.woff2'

# welcome assets present?
find vscode/src/vs/workbench/contrib/welcomeGettingStarted/browser/media -maxdepth 1 -name 'ritemark-welcome-*' | sort
find vscode/out/vs/workbench/contrib/welcomeGettingStarted/browser/media -maxdepth 1 -name 'ritemark-welcome-*' | sort
```

## Definition Of Done (Brand)

Branding is done only when all below are true:

1. `B07`, `B10..B14`, `B20..B21`, `B30..B35`, `B40..B45`, `B60..B63`, `B71` are `PASS`.
2. Fresh clean worktree run (no manual copy hacks) still produces branded app name/icon/fonts/welcome.
3. Result is repeatable from documented commands only.

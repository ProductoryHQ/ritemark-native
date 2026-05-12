# v1.7.0 Pre-Release Audit

**Run date:** 2026-05-11 (preparation)
**Runner:** local (macOS arm64)
**Command:** `./scripts/release-preflight.sh` — **NOT YET RUN**

> **Status:** Audit template prepared. Pre-flight script + DMG build + content verification still pending. Per release-manager protocol, this document must be FULLY completed before Gate 1 testing.

## Step 0 — Existing releases check

Run:

```bash
gh release list --repo jarmo-productory/ritemark-public --limit 10
```

Expected: latest published is `v1.6.3` (2026-05-09). Next valid version: **v1.7.0** (skips v1.6.4 — draft folded into v1.7.0).

| Item | Expected | Actual |
| --- | --- | --- |
| Latest full release | `v1.6.3` (2026-05-09) | _to fill at run time_ |
| Tag `v1.7.0` exists on remote? | NO (will be pushed by step 5) | _to fill_ |
| Tag `v1.6.4` exists on remote? | NO (skipped) | _to fill_ |

## Step 1 — Build state verification

After running `./scripts/build-prod.sh`, verify:

| Check | Command | Expected |
| --- | --- | --- |
| App build date recent (NOT 1980) | `stat -f "%Sm" VSCode-darwin-arm64/Ritemark.app` | within minutes of audit |
| product.json shows 1.7.0 | `node -p "require('./VSCode-darwin-arm64/Ritemark.app/Contents/Resources/app/product.json').ritemarkVersion"` | `1.7.0` |
| Info.plist version matches | `defaults read VSCode-darwin-arm64/Ritemark.app/Contents/Info CFBundleShortVersionString` | `1.7.0` |
| Code signature is real (not adhoc) | `codesign -dv VSCode-darwin-arm64/Ritemark.app 2>&1 \| grep TeamIdentifier` | `TeamIdentifier=` non-empty |
| DMG exists | `ls -lh dist/Ritemark-1.7.0-darwin-arm64.dmg` | file present |
| DMG signed | `codesign -dv dist/Ritemark-1.7.0-darwin-arm64.dmg 2>&1 \| grep TeamIdentifier` | non-empty |
| DMG dated after app build | `stat -f "%Sm" dist/Ritemark-1.7.0-darwin-arm64.dmg` | ≥ app build time |

## Step 2 — Red-flag hard blockers

| Red flag | Check | Status |
| --- | --- | --- |
| Extension missing in DMG | mount DMG; `ls .../Resources/app/extensions/ritemark` | _pending_ |
| webview.js > 500 KB | `stat -f%z .../extensions/ritemark/media/webview.js` | _pending_ |
| node_modules has 100+ packages | `ls .../extensions/ritemark/node_modules \| wc -l` | _pending_ |
| DMG adhoc-signed | `codesign -dv` TeamIdentifier set | _pending_ |
| ritemarkVersion present | `grep ritemarkVersion .../product.json` | _pending_ |
| Timestamps not 1980 | `stat -f "%Sm" .../Ritemark.app` | _pending_ |
| Patch 009 applied | confirm bridge file in app bundle | _pending_ |

## Step 2a — Browser-aware feature smoke (Sprint 67-specific)

Beyond the generic DMG audit, v1.7.0 adds capabilities that must be tested against the SIGNED, NOTARIZED DMG (not dev mode):

| Check | Expected |
| --- | --- |
| Browser tab opens (`workbench.action.browser.open`) | external + localhost + file:// all render |
| Browser chip appears in AI sidebar composer | with globe icon |
| "Share with Agent?" prompt fires on first tab activation | per session |
| After Allow, Claude content question answered from page (no kaamera vajalik) | rich answer |
| Camera toolbar action toggles annotation | chip flips grey → indigo |
| Decline prompt → no URL leak to AI | "Mode: normal" + no metadata |
| BrowserActionsToolbar shows camera icon next to DevTools | yes |

## Step 3 — Mandatory question to Jarmo (before tag push)

> "Have you installed and actually tested the latest DMG (`dist/Ritemark-1.7.0-darwin-arm64.dmg`) on your machine? Specifically:
> - Browser tab renders external sites and localhost
> - Browser-aware AI chat answers content questions correctly
> - Annotation toggle adds screenshot evidence
> - Codex system-runtime preference toggle works
> - Settings cleanup (no orphaned dropdowns)"

Do NOT push the release tag until Jarmo confirms testing with the **approval phrase** ("tested locally" / "approved for release" / "ship it").

## Step 4 — Audit report (fill at run time)

```
========================================
PRE-RELEASE AUDIT REPORT — v1.7.0
========================================
Target Version: 1.7.0
Existing releases: latest full v1.6.3
Next valid version: v1.7.0 (skips v1.6.4)
Build state:
  - App date: ___
  - App version: ___
  - App signed: ___
  - DMG date: ___
  - DMG version: ___
  - DMG signed: ___
Blockers: ___
Warnings: ___
VERDICT: [READY / NOT READY — fix required]
========================================
```

If ANY blockers exist → REFUSE to proceed.

## Materials prepared in this pass

- `release-notes.md` (draft v1, awaits Jarmo review)
- `MARKETING.md` (draft)
- `PRE-RELEASE-AUDIT.md` (this document, template; awaits build run)
- `TEST-CHECKLIST.md` (to be generated when Gate 1 is approached)
- `update-feed-entry.json` (TBD; required before publishing per release-manager protocol)
- `GITHUB_RELEASE.md` (TBD; to be drafted from release-notes after final wording)

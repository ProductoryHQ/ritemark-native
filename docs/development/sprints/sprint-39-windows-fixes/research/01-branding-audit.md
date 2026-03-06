# Sprint 39 Research: Branding Audit (Group A)

## Overview

Seven branding items in the VS Code source remain set to Microsoft/Code-OSS defaults.
All fixes belong in the existing `001-ritemark-branding.patch` — no new patch file needed.

---

## A1 — VisualElementsManifest.xml: ShortDisplayName

**File:** `vscode/resources/win32/VisualElementsManifest.xml`
**Line:** 8
**Current:**
```xml
ShortDisplayName="Code - OSS"
```
**Fix:**
```xml
ShortDisplayName="Ritemark"
```
**Impact:** Windows Start Menu tile short name shows "Code - OSS" instead of "Ritemark".

---

## A2 + A3 — Windows tile PNGs

**Files:**
- `vscode/resources/win32/code_150x150.png` (395 bytes — VS Code placeholder)
- `vscode/resources/win32/code_70x70.png` (338 bytes — VS Code placeholder)

**Fix:** Replace with Ritemark-branded tile PNGs.
**Note:** These are binary assets. The patch must use a binary patch or the files must be committed directly and the patch updated to skip these files (mark as "already ours"). Needs decision from Jarmo — see risk table in sprint plan.

**Impact:** Windows Start Menu shows VS Code logo tiles instead of Ritemark.

---

## A4 — build/lib/electron.ts: companyName

**File:** `vscode/build/lib/electron.ts`
**Lines:** 110-111
**Current:**
```typescript
companyName: 'Microsoft Corporation',
copyright: 'Copyright (C) 2026 Microsoft. All rights reserved',
```
**Fix:**
```typescript
companyName: 'Productory',
copyright: 'Copyright (C) 2026 Productory. All rights reserved',
```
**Impact:** Windows executable file properties show "Microsoft Corporation" as Company.
**Patch location:** `001-ritemark-branding.patch` (extend existing hunk or add new hunk).

---

## A5 — build/gulpfile.vscode.ts: rcedit metadata

**File:** `vscode/build/gulpfile.vscode.ts`
**Lines:** 481, 485
**Current:**
```
'CompanyName': 'Microsoft Corporation'
'LegalCopyright': 'Copyright (C) 2022 Microsoft. All rights reserved'
```
**Fix:**
```
'CompanyName': 'Productory'
'LegalCopyright': 'Copyright (C) 2026 Productory. All rights reserved'
```
**Impact:** Windows installer/EXE metadata shows Microsoft branding. The year 2022 is also clearly wrong.

---

## A6 — resources/win32/appx/AppxManifest.xml: Publisher

**File:** `vscode/resources/win32/appx/AppxManifest.xml`
**Lines:** 18, 23
**Current:** Publisher = Microsoft
**Fix:** Publisher = Productory
**Impact:** Windows Store package manifest shows wrong publisher. Less critical if not targeting the Store, but should be clean.

---

## A7 — resources/server/manifest.json

**File:** `vscode/resources/server/manifest.json`
**Lines:** 2-3
**Current:** `"Code - OSS"`
**Fix:** `"Ritemark"`
**Impact:** Server manifest references Code - OSS branding.

---

## Patch Strategy

All A1–A7 fixes extend `patches/vscode/001-ritemark-branding.patch`.

For A2/A3 (binary PNG files): Binary files cannot be embedded in a text patch reliably.
Recommended approach: Copy Ritemark-branded PNGs into `branding/` and add a build script step (or `apply-patches.sh` hook) to copy them over after patch application.

**Files that need Ritemark-branded assets created:**
- `branding/win32/code_150x150.png` (150x150 px tile)
- `branding/win32/code_70x70.png` (70x70 px tile)

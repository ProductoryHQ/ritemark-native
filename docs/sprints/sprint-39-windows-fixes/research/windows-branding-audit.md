# Windows Branding Audit

## Findings

### VisualElementsManifest.xml
- **Location:** `vscode/resources/win32/VisualElementsManifest.xml`
- **Problem:** Line 8: `ShortDisplayName="Code - OSS"`
- **Impact:** Windows Start Menu live tile shows "Code - OSS" instead of "Ritemark"
- **Build path:** `gulpfile.vscode.ts:425-426` renames to `Ritemark.VisualElementsManifest.xml` but content is unchanged

### Tile PNGs
- **Location:** `vscode/resources/win32/code_150x150.png` (395 bytes), `code_70x70.png` (338 bytes)
- **Problem:** These are VS Code placeholder images (nearly empty at 395/338 bytes)
- **Impact:** Start Menu tiles show blank/VS Code icon instead of Ritemark
- **Note:** These are binary files, cannot go in text patches — need copy script

### electron.ts
- **Location:** `vscode/build/lib/electron.ts:110-111`
- **Current:** `companyName: 'Microsoft Corporation'`, `copyright: 'Copyright (C) 2026 Microsoft...'`
- **Impact:** .exe Properties > Details shows Microsoft as company
- **Fix:** Change to `'Productory'`

### gulpfile.vscode.ts (rcedit)
- **Location:** `vscode/build/gulpfile.vscode.ts:481,485`
- **Current:** `'CompanyName': 'Microsoft Corporation'`, `'LegalCopyright': 'Copyright (C) 2022 Microsoft...'`
- **Impact:** .node files in build show Microsoft metadata
- **Fix:** Change to Productory, update year to 2026

### AppxManifest.xml
- **Location:** `vscode/resources/win32/appx/AppxManifest.xml:18,23`
- **Current:** Publisher = Microsoft Corporation
- **Impact:** MSIX/AppX packaging shows Microsoft as publisher
- **Fix:** Change to Productory (not urgent unless doing Store distribution)

### Server manifest.json
- **Location:** `vscode/resources/server/manifest.json:2-3`
- **Current:** `"name": "Code - OSS"`, `"short_name": "Code- OSS"`
- **Impact:** PWA/web access shows "Code - OSS" in browser
- **Fix:** Change to "Ritemark"

## Already Correct
- `vscode/resources/win32/code.ico` — Ritemark icon (143,879 bytes, matches branding/icons/icon.ico)
- `vscode/product.json` — All win32 names set to "RiteMark" / "Ritemark"
- `installer/windows/ritemark.iss` — Correct branding, icon paths, file associations

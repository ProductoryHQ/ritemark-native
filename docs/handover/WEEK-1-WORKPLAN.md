# Week 1 Handover Workplan: RiteMark Native Prototype

**Handover Date:** 2025-11-30
**From:** Claude (ritemark web repo)
**To:** Sibling Claude agent (ritemark-native repo)
**Owner:** Jarmo (Product Lead)

---

## Project Context

### What We're Building

**RiteMark Desktop** - A standalone native app built from VS Code OSS with RiteMark embedded as the default markdown editor.

- **Not an extension** - Full VS Code fork with complete control
- **Target users** - Local-first, offline-capable markdown editing
- **Examples** - Cursor, Windsurf, Positron (all VS Code forks)

### Repository Structure

```
/Users/jarmotuisk/Projects/
├── ritemark/              ← Web app (existing, separate team)
├── ritemark-native/       ← YOU ARE HERE - VS Code fork
└── ritemark-shared/       ← Shared packages (future extraction)
```

### Key Documentation

**READ THESE FIRST:**
1. `/Users/jarmotuisk/Projects/ritemark/docs/research/vscode-native-app/README.md` - Master plan
2. `/Users/jarmotuisk/Projects/ritemark/docs/research/vscode-native-app/OPTION-B-full-fork.md` - Technical spec

---

## Architecture Decisions (Locked)

These decisions are **final** - do not revisit:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| VS Code integration | Git submodule (not fork) | Easy upstream sync |
| Integration point | Custom Editor Provider | Native tab experience |
| Marketplace | Hidden by default | Prevent conflicts |
| Default .md handler | RiteMark WYSIWYG | Core UX |
| Telemetry | Minimal, opt-out | Privacy first |

---

## Week 1 Goal

**Prove the fork approach works with a minimal prototype**

### Exit Criteria (Jarmo Validates)

- [ ] App launches with RiteMark branding (not VS Code)
- [ ] Opening .md file shows custom editor (not text editor)
- [ ] Feels like "RiteMark Desktop" not "VS Code with extension"

---

## Week 1 Tasks

### Task 1: Add VS Code OSS as Submodule

**Priority:** Critical
**Estimate:** 1-2 hours

```bash
cd /Users/jarmotuisk/Projects/ritemark-native

# Add VS Code OSS as submodule (use stable tag)
git submodule add https://github.com/microsoft/vscode.git vscode
cd vscode
git checkout 1.94.0  # Use recent stable version
cd ..

git add .
git commit -m "Add VS Code OSS as submodule (v1.94.0)"
git push
```

**Verify:**
- `vscode/` folder exists with VS Code source
- Can navigate VS Code source code

---

### Task 2: Set Up Build Environment

**Priority:** Critical
**Estimate:** 2-3 hours

**Prerequisites (check with Jarmo):**
```bash
# Required tools
node --version    # Need v18+
npm --version     # Need v9+
python3 --version # Need 3.x
```

**Build VS Code OSS:**
```bash
cd /Users/jarmotuisk/Projects/ritemark-native/vscode

# Install dependencies
npm install

# Build
npm run compile

# Test run (should launch VS Code OSS)
./scripts/code.sh
```

**Document any issues** - VS Code build can be finicky on first run.

---

### Task 3: Create Branding Overrides

**Priority:** High
**Estimate:** 1-2 hours

Create branding files:

```
branding/
├── product.json          # App name, icons, update URLs
├── icons/
│   ├── icon.icns         # macOS icon
│   ├── icon.ico          # Windows icon
│   └── icon.png          # Linux icon
└── README.md             # Branding documentation
```

**product.json template:**
```json
{
  "nameShort": "RiteMark",
  "nameLong": "RiteMark Desktop",
  "applicationName": "ritemark",
  "dataFolderName": ".ritemark",
  "win32MutexName": "ritemarkdesktop",
  "licenseName": "MIT",
  "licenseUrl": "https://github.com/jarmo-productory/ritemark-native/blob/main/LICENSE",
  "serverLicenseUrl": "https://github.com/jarmo-productory/ritemark-native/blob/main/LICENSE",
  "darwinBundleIdentifier": "ai.productory.ritemark",
  "linuxIconName": "ritemark",
  "quality": "stable",
  "updateUrl": "",
  "extensionsGallery": null,
  "enableTelemetry": false
}
```

**For icons:** Create placeholder colored squares for now (512x512). Real icons come later.

---

### Task 4: Create Built-in Extension Structure

**Priority:** High
**Estimate:** 2-3 hours

Create extension scaffold:

```
extensions/ritemark/
├── package.json
├── src/
│   ├── extension.ts      # Extension entry point
│   └── ritemarkEditor.ts # Custom editor provider
├── media/
│   └── editor.html       # Webview HTML (placeholder)
├── tsconfig.json
└── README.md
```

**package.json:**
```json
{
  "name": "ritemark",
  "displayName": "RiteMark Editor",
  "description": "WYSIWYG Markdown Editor",
  "version": "0.1.0",
  "publisher": "ritemark",
  "engines": {
    "vscode": "^1.94.0"
  },
  "main": "./out/extension.js",
  "activationEvents": [],
  "contributes": {
    "customEditors": [
      {
        "viewType": "ritemark.editor",
        "displayName": "RiteMark",
        "selector": [
          { "filenamePattern": "*.md" },
          { "filenamePattern": "*.markdown" }
        ],
        "priority": "default"
      }
    ]
  }
}
```

**extension.ts (minimal):**
```typescript
import * as vscode from 'vscode';
import { RiteMarkEditorProvider } from './ritemarkEditor';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    RiteMarkEditorProvider.register(context)
  );
}

export function deactivate() {}
```

**ritemarkEditor.ts (minimal webview):**
```typescript
import * as vscode from 'vscode';

export class RiteMarkEditorProvider implements vscode.CustomTextEditorProvider {
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      'ritemark.editor',
      new RiteMarkEditorProvider(context),
      { webviewOptions: { retainContextWhenHidden: true } }
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = this.getHtml(document.getText());
  }

  private getHtml(content: string): string {
    return `<!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          padding: 20px;
          background: #1e1e1e;
          color: #d4d4d4;
        }
        h1 { color: #569cd6; }
        .content {
          background: #252526;
          padding: 20px;
          border-radius: 8px;
          white-space: pre-wrap;
        }
      </style>
    </head>
    <body>
      <h1>RiteMark Editor</h1>
      <p>This is a prototype. Full editor coming in Week 2.</p>
      <div class="content">${this.escapeHtml(content)}</div>
    </body>
    </html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
```

---

### Task 5: Wire Extension into VS Code Build

**Priority:** High
**Estimate:** 1-2 hours

Modify VS Code build to include our extension:

1. **Add extension to build config:**
   - Find `build/builtin/extensions.js` or similar in VS Code source
   - Add ritemark extension to built-in extensions list

2. **Alternative: Use extensions folder overlay**
   - Copy extension to `vscode/extensions/ritemark/` before build
   - VS Code auto-discovers extensions in this folder

3. **Build and test:**
```bash
cd /Users/jarmotuisk/Projects/ritemark-native/vscode
npm run compile
./scripts/code.sh
```

---

### Task 6: Create macOS Build

**Priority:** High
**Estimate:** 2-3 hours

```bash
cd /Users/jarmotuisk/Projects/ritemark-native/vscode

# Build for macOS
npm run gulp vscode-darwin-arm64  # or vscode-darwin-x64

# Output will be in ../VSCode-darwin-arm64/
# Rename to RiteMark.app
```

**Verify:**
- App launches from Finder
- Shows RiteMark branding in menu bar
- Opening .md file shows custom editor

---

## Build Scripts to Create

Create helper scripts in `scripts/`:

**scripts/setup.sh:**
```bash
#!/bin/bash
set -e

echo "Setting up RiteMark Native..."

# Initialize submodules
git submodule update --init --recursive

# Install VS Code dependencies
cd vscode
npm install

# Build extension
cd ../extensions/ritemark
npm install
npm run compile

echo "Setup complete!"
```

**scripts/build-mac.sh:**
```bash
#!/bin/bash
set -e

echo "Building RiteMark for macOS..."

# Copy branding
cp ../branding/product.json product.json

# Copy extension
cp -r ../extensions/ritemark extensions/

# Build
npm run gulp vscode-darwin-arm64

echo "Build complete: ../VSCode-darwin-arm64/"
```

---

## Communication Protocol

### With Jarmo (Product Owner)

- **Ask before** making architectural decisions
- **Show progress** with screenshots/screen recordings
- **Request testing** when milestone complete

### Progress Updates

After completing each task:
1. Commit with clear message
2. Push to GitHub
3. Update this document with status

---

## Success Criteria Checklist

### Week 1 Complete When:

- [ ] VS Code OSS compiles from source
- [ ] RiteMark branding visible (app name, icon)
- [ ] .md files open in custom editor (not text editor)
- [ ] Prototype webview shows file content
- [ ] macOS .app bundle builds
- [ ] Jarmo approves: "This feels like RiteMark Desktop"

---

## Troubleshooting

### Common Issues

**VS Code won't build:**
- Check Node version (need 18+)
- Run `npm cache clean --force`
- Delete `node_modules` and reinstall

**Extension not loading:**
- Check `package.json` syntax
- Verify extension is in `extensions/` folder
- Check Developer Tools console (Help > Toggle Developer Tools)

**Build takes forever:**
- First build is slow (10-30 min)
- Subsequent builds much faster
- Use `npm run watch` for development

---

## Files Created by Handover

```
ritemark-native/
├── README.md                 ✅ Created
├── .gitignore                ✅ Created
├── extensions/ritemark/      📁 Folder exists (populate in Task 4)
├── build/                    📁 Folder exists
├── branding/                 📁 Folder exists (populate in Task 3)
├── scripts/                  📁 Folder exists (populate in Task 6)
└── docs/
    └── handover/
        └── WEEK-1-WORKPLAN.md  ✅ This file
```

---

## Quick Start for Sibling Agent

```bash
# 1. Navigate to project
cd /Users/jarmotuisk/Projects/ritemark-native

# 2. Read the master plan
cat /Users/jarmotuisk/Projects/ritemark/docs/research/vscode-native-app/README.md

# 3. Start with Task 1
git submodule add https://github.com/microsoft/vscode.git vscode

# 4. Follow tasks sequentially
```

---

**Good luck, sibling agent!**

When Week 1 is complete, create `docs/handover/WEEK-2-WORKPLAN.md` for the next phase.

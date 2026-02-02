# Ritemark Native Wishlist

Future improvements and feature ideas.

---

## Data Editor

### CSV/Excel Encoding Issue

**Problem:** "Open in Excel" opens CSV files with system encoding (Windows/Macintosh) instead of UTF-8. This breaks special characters (Estonian täpitähed: ä, ö, ü, õ).

**Features to implement:**

1. **Fix "Open in Excel"** - Open CSV correctly with UTF-8 encoding
   - Excel supports UTF-8 BOM (Byte Order Mark) - adding `\uFEFF` at file start
   - Alternatively, use AppleScript to open Excel with explicit encoding parameter

2. **Add "Export to Excel"** - New option in split-button dropdown menu
   - Export directly to `.xlsx` format (native Excel, no encoding issues)
   - Libraries: `xlsx` or `exceljs` for Node.js
   - Preserves formatting and handles Unicode properly

---

## Developer Experience

### Claude Code Auto-Detection & Launch

**Feature:** On new window open, automatically detect and launch Claude Code in terminal.

**Implementation:**

1. **Detection** - Background check on window open:
   - Run `which claude` or `claude --version` silently
   - Cache result to avoid repeated checks

2. **Auto-launch** - If detected, open terminal and run Claude Code:
   - Default: `claude`
   - With flags based on user settings

3. **Settings** (Ritemark Settings UI):
   - `ritemark.claudeCode.autoLaunch`: boolean (default: false)
   - `ritemark.claudeCode.flags`: string (e.g., `--dangerously-skip-permissions`)
   - `ritemark.claudeCode.customCommand`: string (override full command)

**Example configurations:**
```json
{
  "ritemark.claudeCode.autoLaunch": true,
  "ritemark.claudeCode.flags": "--dangerously-skip-permissions"
}
```

**Notes:**
- Should respect workspace trust settings
- Consider security implications of auto-permissions flag
- Maybe show one-time prompt before enabling auto-launch

---

## Distribution

### Homebrew Cask Support

**Feature:** Allow users to install and update Ritemark via Homebrew on macOS.

**Benefits:**
- Single command install: `brew install --cask ritemark`
- Easy updates: `brew upgrade ritemark`
- Familiar workflow for developers
- Automatic cleanup of old versions

**Implementation:**
1. Create Homebrew cask formula
2. Submit to homebrew-cask repository (or maintain own tap)
3. Automate cask updates as part of release process

**Reference:** See `docs/sprints/sprint-16-auto-update/research/HOMEBREW-CASK-GUIDE.md` for detailed research

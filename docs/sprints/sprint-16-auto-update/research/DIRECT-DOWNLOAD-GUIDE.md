# Direct Download Distribution Guide

**Date:** 2026-01-13
**Use case:** Distributing before/without Apple notarization

---

## The Problem

Without notarization, macOS Gatekeeper blocks apps downloaded from the internet:
- "RiteMark.app is damaged and can't be opened"
- "Apple cannot verify the developer"

---

## Solutions for Users

### Method 1: Download via curl (Best)

**Why it works:** `curl` downloads don't receive the quarantine extended attribute.

#### User Instructions
```bash
# Download directly (no quarantine)
curl -L -o ~/Downloads/RiteMark.dmg "https://github.com/jarmo-productory/ritemark-public/releases/download/v1.0.1/RiteMark-1.0.1.dmg"

# Mount and install
open ~/Downloads/RiteMark.dmg
# Drag RiteMark to Applications
```

This is the **cleanest method** - no warnings, no extra steps.

---

### Method 2: Remove Quarantine Attribute

If user already downloaded via browser:

```bash
# Remove quarantine from DMG
xattr -d com.apple.quarantine ~/Downloads/RiteMark-1.0.1.dmg

# Or from app after mounting
xattr -d com.apple.quarantine /Volumes/RiteMark/RiteMark.app
```

---

### Method 3: System Settings Approval

#### macOS Sequoia (15+)
1. Try to open the app (will be blocked)
2. Open **System Settings → Privacy & Security**
3. Scroll down to see blocked app message
4. Click **"Open Anyway"**
5. Confirm with password
6. App will now open

#### Pre-Sequoia (macOS 14 and earlier)
1. **Right-click** (Control-click) on app
2. Select **"Open"**
3. Click **"Open"** in dialog
4. App is now trusted

---

### Method 4: Disable Gatekeeper (Not Recommended)

For power users only:

```bash
# Disable Gatekeeper entirely
sudo spctl --master-disable

# Re-enable after installing
sudo spctl --master-enable
```

**Note:** macOS Sequoia requires additional confirmation in System Settings.

---

## Recommended Website Copy

### Download Section

```markdown
## Download RiteMark

**Latest:** v1.0.1 (January 2026)

### Option A: Direct Download (Recommended)
Run this in Terminal:
\`\`\`
curl -L -o ~/Downloads/RiteMark.dmg "https://github.com/.../RiteMark-1.0.1.dmg" && open ~/Downloads/RiteMark.dmg
\`\`\`

### Option B: Browser Download
1. [Download RiteMark-1.0.1.dmg](link)
2. If blocked by Gatekeeper, see [installation help](#gatekeeper)

---

<a name="gatekeeper"></a>
## Gatekeeper Help

RiteMark is code-signed but awaiting Apple notarization.
If macOS blocks the app:

**macOS Sequoia:** System Settings → Privacy & Security → "Open Anyway"
**Earlier macOS:** Right-click app → Open → Open
```

---

## Important Notes

### Code Signing Still Matters
Even without notarization:
- **Signed app** = "from identified developer" (yellow warning)
- **Unsigned app** = "from unidentified developer" (harder to approve)

RiteMark is signed with Developer ID, so warnings are less scary.

### First-Run Only
Users only need to approve once. After that, the app opens normally.

### Quarantine Persistence
The quarantine attribute sticks to:
- Downloaded ZIP/DMG files
- Apps extracted from quarantined archives

Removing quarantine from the DMG before mounting is cleanest.

---

## Technical Details

### Check if file is quarantined
```bash
xattr -l ~/Downloads/RiteMark.dmg
# Look for: com.apple.quarantine
```

### Check app signature
```bash
codesign -dv --verbose=4 /Applications/RiteMark.app
```

### Check notarization status
```bash
spctl -a -v /Applications/RiteMark.app
# "accepted" = notarized
# "rejected" = not notarized
```

---

## Sources

- [Living with(out) notarization](https://eclecticlight.co/2024/10/01/living-without-notarization/)
- [Distributing Mac apps without notarization](https://lapcatsoftware.com/articles/without-notarization.html)
- [macOS Sequoia Gatekeeper changes](https://www.idownloadblog.com/2024/08/07/apple-macos-sequoia-gatekeeper-change-install-unsigned-apps-mac/)
- [Apple Gatekeeper documentation](https://support.apple.com/guide/security/gatekeeper-and-runtime-protection-sec5599b66df/web)

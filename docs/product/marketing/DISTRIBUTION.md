# RiteMark Native - Distribution Strategy

**Platform:** macOS (darwin-arm64, Intel coming)
**Format:** DMG installer
**Current Status:** Local builds only

---

## Distribution Channels

### Primary: Direct Download (Website)

**Recommended for launch.** Full control, best margins, direct relationship.

| Aspect | Approach |
|--------|----------|
| **Hosting** | GitHub Releases or Cloudflare R2/S3 |
| **URL** | `ritemark.app/download` or `github.com/jarmo-productory/ritemark-native/releases` |
| **Analytics** | UTM tracking + download counter |
| **Cost** | Free (GitHub) or ~$5/month (Cloudflare R2) |

**Pros:**
- 100% control over experience
- No revenue share
- Immediate availability
- Easy versioning

**Cons:**
- No built-in discovery
- Manual update notifications
- Need to handle hosting

---

### Secondary: GitHub Releases

**Use alongside website.** Developer-friendly, trust signal.

```
https://github.com/jarmo-productory/ritemark-native/releases
```

**Setup:**
1. Create public repo (or releases-only repo)
2. Upload DMG to each release
3. Tag versions semantically (v1.0.0, v1.0.1)
4. Include changelog in release notes

**Pros:**
- Free unlimited hosting
- Developers trust GitHub
- Built-in versioning
- Easy for automation

**Cons:**
- Not discoverable by non-developers
- GitHub UI not ideal for marketing

---

### Future: Mac App Store

**Consider for Phase 2-3.** Discovery, trust, enterprise.

| Aspect | Details |
|--------|---------|
| **Revenue share** | 30% (15% for small business) |
| **Review time** | 1-7 days |
| **Requirements** | Sandboxing, notarization, Apple ID |
| **Benefit** | Discovery, updates, enterprise deployment |

**Pros:**
- Discovery (search "markdown editor")
- Trust signal (Apple approved)
- Automatic updates
- Enterprise MDM deployment
- Family sharing

**Cons:**
- 30% revenue share
- Sandboxing restrictions (may break terminal features)
- Review delays
- Apple's approval process

**Recommendation:** Delay until v2.0. Focus on direct download for early adopters.

---

### Future: Homebrew Cask

**For developer audience.** Easy install, updates.

```bash
brew install --cask ritemark
```

**Setup:**
1. Create Homebrew cask formula
2. Submit to homebrew-cask repo
3. Maintain version updates

**Pros:**
- One-line install for developers
- Automatic updates via `brew upgrade`
- Developer credibility

**Cons:**
- Only reaches Homebrew users
- Maintenance overhead
- Review process for new casks

**Recommendation:** Add in Phase 2 after launch stabilizes.

---

## Technical Requirements

### Code Signing

**Required for macOS distribution.** Without it, users see "unidentified developer" warning.

| Option | Cost | Difficulty |
|--------|------|------------|
| **Apple Developer Account** | $99/year | Easy |
| **Self-signed** | Free | Users must bypass Gatekeeper |
| **None** | Free | Users must disable Gatekeeper |

**Recommendation:** Get Apple Developer account ($99/year). Essential for trust.

**Signing command:**
```bash
codesign --deep --force --verify --verbose \
  --sign "Developer ID Application: Your Name (TEAMID)" \
  RiteMark.app
```

---

### Notarization

**Required for Gatekeeper approval.** Apple scans for malware.

```bash
# Submit for notarization
xcrun notarytool submit RiteMark.dmg \
  --apple-id "your@email.com" \
  --team-id "TEAMID" \
  --password "@keychain:AC_PASSWORD" \
  --wait

# Staple ticket to DMG
xcrun stapler staple RiteMark.dmg
```

**Timeline:** Usually 5-15 minutes, occasionally hours.

**Requirement:** Apple Developer account + App-specific password.

---

### Universal Binary (Intel + Apple Silicon)

**Current:** Apple Silicon only (darwin-arm64)
**Target:** Universal binary for broader reach

```bash
# Build for both architectures
# Combine with lipo
lipo -create \
  RiteMark-arm64 \
  RiteMark-x86_64 \
  -output RiteMark-universal
```

**Recommendation:** Prioritize for v1.1. ~30% of Macs still Intel.

---

## Auto-Updates

### Option 1: Electron-updater (Recommended)

Already built into Electron/VS Code base. Uses GitHub Releases.

**How it works:**
1. App checks GitHub Releases for new version
2. Downloads update in background
3. Prompts user to restart
4. Installs on next launch

**Setup:**
```json
// package.json
"build": {
  "publish": {
    "provider": "github",
    "owner": "jarmo-productory",
    "repo": "ritemark-native"
  }
}
```

---

### Option 2: Sparkle Framework

macOS-native update framework. More control, native feel.

**How it works:**
1. App checks appcast.xml for updates
2. Shows native update dialog
3. Downloads and installs

**Pros:** Native macOS feel, differential updates
**Cons:** More setup, separate from Electron

---

### Option 3: Manual Updates

User downloads new version manually.

**For now:** Acceptable for early adopters. Add auto-update in v1.1.

---

## Download Page Design

### Essential Elements

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  RiteMark Native                                │
│  The text editor that speaks AI fluently        │
│                                                 │
│  [Download for macOS]  ← Primary CTA            │
│                                                 │
│  Version 1.0.0 • macOS 11+ • Apple Silicon      │
│  Intel version coming soon                      │
│                                                 │
│  ────────────────────────────────────────────   │
│                                                 │
│  ⚡ What's New in v1.0.0                        │
│  • WYSIWYG Markdown editing                     │
│  • Built-in Claude Code terminal                │
│  • Document properties (YAML)                   │
│  • Task list checkboxes                         │
│                                                 │
│  ────────────────────────────────────────────   │
│                                                 │
│  📦 Other Downloads                             │
│  • Previous versions                            │
│  • Checksums (SHA256)                           │
│                                                 │
│  🔒 Privacy: 100% local. No telemetry.         │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

### Installation Instructions

Include on download page:

```markdown
## Installation

1. Download RiteMark-1.0.0.dmg
2. Open the DMG file
3. Drag RiteMark to Applications folder
4. Launch from Applications

### First Launch

macOS may show "unidentified developer" warning.
If so: Right-click → Open → Click "Open" in dialog.

(We're working on full notarization!)
```

---

## Analytics & Tracking

### Download Metrics

Track via:
1. **GitHub Release downloads** (built-in count)
2. **UTM parameters** for source attribution
3. **Custom analytics** (simple counter API)

**UTM Example:**
```
ritemark.app/download?utm_source=producthunt&utm_medium=launch
```

### First-Run Telemetry (Optional, Opt-in)

If added:
- Installation count
- OS version
- Error reports (Sentry)
- Feature usage (anonymous)

**Important:** Opt-in only, privacy-first positioning.

---

## Version Strategy

### Semantic Versioning

```
v1.0.0 — Major.Minor.Patch

Major: Breaking changes, major features
Minor: New features, non-breaking
Patch: Bug fixes, small improvements
```

### Release Cadence

| Phase | Cadence |
|-------|---------|
| Launch (v1.0) | When ready |
| Bug fixes (v1.0.x) | Weekly as needed |
| Features (v1.x.0) | Bi-weekly to monthly |
| Major (v2.0) | When warranted |

---

## Launch Checklist (Distribution)

### Pre-Launch

- [ ] Apple Developer account ($99)
- [ ] Code signing certificate
- [ ] Notarization working
- [ ] GitHub Releases set up
- [ ] Download page live
- [ ] DMG tested on clean Mac
- [ ] SHA256 checksums generated
- [ ] Installation instructions written

### Launch Day

- [ ] Upload final DMG to GitHub Releases
- [ ] Update download page link
- [ ] Verify download works
- [ ] Test installation flow
- [ ] Monitor for issues

### Post-Launch

- [ ] Track download metrics
- [ ] Respond to installation issues
- [ ] Plan auto-update implementation
- [ ] Consider Homebrew cask
- [ ] Universal binary for Intel

---

## Cost Summary

| Item | Cost | Frequency |
|------|------|-----------|
| Apple Developer | $99 | Annual |
| GitHub hosting | Free | — |
| Domain (ritemark.app) | ~$15 | Annual |
| Cloudflare (optional) | Free-$20 | Monthly |
| **Total Year 1** | **~$115** | — |

---

## Recommended Launch Stack

| Component | Choice | Why |
|-----------|--------|-----|
| **Hosting** | GitHub Releases | Free, trusted, versioned |
| **Signing** | Apple Developer | Required for trust |
| **Notarization** | Yes | Required for Gatekeeper |
| **Updates** | Manual v1.0, auto v1.1 | Prioritize launch |
| **Download page** | Simple landing | Productory.ai or standalone |
| **Analytics** | GitHub + UTM | Simple, free |

---

## Future: Windows Distribution

When ready:

| Aspect | Approach |
|--------|----------|
| **Format** | NSIS installer (.exe) or MSIX |
| **Signing** | EV Code Signing cert (~$200-400/year) |
| **Store** | Microsoft Store (optional) |
| **Updates** | Same as macOS (electron-updater) |

**Note:** Windows code signing more expensive. Budget accordingly.

---

*Ship the DMG. Get code signing. Everything else can wait.*

# macOS Distribution Alternatives

**Date:** 2026-01-13
**Context:** Apple notarization taking 24-72h for first submission

---

## Quick Comparison

| Method | Notarization Required | User Friction | Reach | Effort |
|--------|----------------------|---------------|-------|--------|
| **GitHub Releases (notarized)** | Yes | Low | Global | Low |
| **GitHub Releases (signed only)** | No | Medium | Global | Low |
| **Homebrew Cask** | Recommended | Very Low | Developers | Medium |
| **Direct Download (curl)** | No | Medium | Technical users | Low |
| **Setapp** | Yes | Low | Setapp subscribers | High |

---

## Option 1: GitHub Releases (Current Plan)

**Status:** Blocked on notarization

### With Notarization (Ideal)
- User downloads DMG → double-click → drag to Applications → done
- No Gatekeeper warnings
- Best user experience

### Without Notarization (Fallback)
- User downloads DMG
- Gatekeeper blocks on first launch
- User must manually approve in System Settings

**Recommendation:** Wait for notarization if possible. Worth the wait for UX.

---

## Option 2: Homebrew Cask

**Best for:** Developer audience, technical users

### Pros
- One-command install: `brew install --cask ritemark`
- Auto-updates via `brew upgrade`
- Trusted by developers
- No Gatekeeper issues (Homebrew handles it)

### Cons
- Requires notability (30+ stars/forks on GitHub)
- Only reaches Homebrew users
- Maintenance overhead for updates

### Requirements
- Public GitHub repo with releases
- Stable download URL
- Meet notability threshold

**See:** [HOMEBREW-CASK-GUIDE.md](./HOMEBREW-CASK-GUIDE.md)

---

## Option 3: Direct Download (No Notarization)

**Best for:** Early adopters, beta testers, technical users

### Methods to Bypass Gatekeeper

#### A. curl download (avoids quarantine)
```bash
curl -L -o ~/Downloads/RiteMark.dmg "https://github.com/.../RiteMark.dmg"
```
Files downloaded via curl don't get quarantine attribute.

#### B. Remove quarantine manually
```bash
xattr -d com.apple.quarantine ~/Downloads/RiteMark.dmg
```

#### C. User approves in System Settings
- macOS Sequoia: System Settings → Privacy & Security → Allow

**See:** [DIRECT-DOWNLOAD-GUIDE.md](./DIRECT-DOWNLOAD-GUIDE.md)

---

## Option 4: Setapp Platform

**Best for:** Revenue generation, Mac power users

### Pros
- Access to Setapp's 1M+ subscriber base
- Revenue share model (like Spotify for apps)
- Handles distribution, updates, licensing

### Cons
- Requires Setapp Framework integration
- Revenue share (not direct sales)
- Review process
- Still requires notarization

### Requirements
- High quality app
- Setapp Framework SDK integration
- Custom URL scheme
- Review approval

**See:** [SETAPP-GUIDE.md](./SETAPP-GUIDE.md)

---

## Recommendation for RiteMark

### Short-term (Now)
1. **Wait for notarization** (up to 72h total)
2. If urgent: Offer direct download with manual instructions

### Medium-term (After v1.0.1)
1. **Submit to Homebrew Cask** once GitHub has enough stars
2. Continue GitHub Releases as primary channel

### Long-term (Future consideration)
1. **Evaluate Setapp** if targeting Mac power user market
2. Requires SDK integration effort

---

## Sources

- [Distributing Mac apps without notarization](https://lapcatsoftware.com/articles/without-notarization.html)
- [Living with(out) notarization](https://eclecticlight.co/2024/10/01/living-without-notarization/)
- [Homebrew Cask Documentation](https://docs.brew.sh/Cask-Cookbook)
- [Setapp Developer Portal](https://setapp.com/developers)
- [Distributing Mac Apps Outside App Store](https://www.rambo.codes/posts/2021-01-08-distributing-mac-apps-outside-the-app-store)

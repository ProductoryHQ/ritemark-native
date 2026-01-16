# Homebrew Cask Distribution Guide

**Date:** 2026-01-13

---

## What is Homebrew Cask?

Homebrew Cask extends Homebrew to install macOS GUI applications. Users install apps with:

```bash
brew install --cask ritemark
```

---

## Requirements for Submission

### 1. Notability Threshold
Your app must be "notable enough" to be accepted:
- **Minimum:** 30 forks, 30 watchers, OR 75 stars on GitHub
- Apps that are too obscure will be rejected

**RiteMark Status:** Check `jarmo-productory/ritemark-public` stats

### 2. Stable Download URL
Must have a permanent, versioned download URL:
```
https://github.com/jarmo-productory/ritemark-public/releases/download/v1.0.1/RiteMark-1.0.1.dmg
```

### 3. Code Signing
- App should be signed with Developer ID
- Notarization recommended but not strictly required
- Unsigned apps will show Gatekeeper warnings

---

## Cask File Format

Example cask for RiteMark:

```ruby
cask "ritemark" do
  version "1.0.1"
  sha256 "abc123..."  # SHA256 of DMG file

  url "https://github.com/jarmo-productory/ritemark-public/releases/download/v#{version}/RiteMark-#{version}.dmg"
  name "RiteMark"
  desc "Native markdown editor for focused writing"
  homepage "https://github.com/jarmo-productory/ritemark-public"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "RiteMark.app"

  zap trash: [
    "~/Library/Application Support/RiteMark",
    "~/Library/Preferences/com.ritemark.app.plist",
    "~/Library/Caches/com.ritemark.app",
  ]
end
```

---

## Submission Process

### Step 1: Fork homebrew-cask
```bash
# Fork https://github.com/Homebrew/homebrew-cask on GitHub
git clone https://github.com/YOUR-USERNAME/homebrew-cask.git
cd homebrew-cask
```

### Step 2: Create Cask File
```bash
# Create new cask
brew create --cask https://github.com/.../RiteMark-1.0.1.dmg

# Or manually create
touch Casks/r/ritemark.rb
```

### Step 3: Test Locally
```bash
# Install from local cask
brew install --cask ./Casks/r/ritemark.rb

# Verify it works
open -a RiteMark

# Audit the cask
brew audit --cask ritemark
brew style --fix ritemark
```

### Step 4: Submit PR
```bash
git checkout -b add-ritemark
git add Casks/r/ritemark.rb
git commit -m "Add ritemark"
git push origin add-ritemark
```

Then open PR to `Homebrew/homebrew-cask`

---

## Updating the Cask

When releasing new versions:

1. Update `version` and `sha256` in cask file
2. Submit PR with updated cask
3. Or use `brew bump-cask-pr ritemark --version 1.0.2`

---

## Alternative: Self-Hosted Tap

If rejected from main repo, create your own tap:

```bash
# Create tap repository
# GitHub: jarmo-productory/homebrew-ritemark

# Users install with:
brew tap jarmo-productory/ritemark
brew install ritemark
```

---

## Pros & Cons

### Pros
- Zero-friction install for Homebrew users
- Automatic updates via `brew upgrade`
- Trusted distribution channel
- No Gatekeeper issues

### Cons
- Only reaches Homebrew users (~10% of Mac users)
- Notability requirement may block initial submission
- Maintenance for each release

---

## Sources

- [Adding Software to Homebrew](https://docs.brew.sh/Adding-Software-to-Homebrew)
- [Cask Cookbook](https://docs.brew.sh/Cask-Cookbook)
- [Acceptable Casks](https://docs.brew.sh/Acceptable-Casks)
- [homebrew-cask GitHub](https://github.com/Homebrew/homebrew-cask)

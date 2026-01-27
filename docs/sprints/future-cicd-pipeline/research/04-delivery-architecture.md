# Delivery Architecture: CI/CD + Agent Integration

**Created:** 2026-01-25
**Status:** Research document for Sprint 24

---

## Overview

This document describes how automated CI/CD pipelines integrate with RiteMark's human-in-the-loop release process. The goal is to automate builds while preserving quality gates and human approval.

---

## Current vs Future State

### Current State (Manual)

```
Dev ──► Build (Mac locally) ──► Jarmo tests ──► Release
          │                         │              │
          └── build-prod.sh         └── Gate 2     └── release-manager

⚠️ Windows: NOT SUPPORTED
```

**Pain points:**
- Windows build blocked (local dev environment has errors)
- Single point of failure (Jarmo's Mac)
- No artifact history
- Manual, error-prone process

### Future State (CI + Human Gates)

```
              ┌──────────────┐
Dev ──►───────┤  CI/CD       ├─────────────────────┐
(tag push)    │  (automated) │                     │
              └──────┬───────┘                     │
                     │                             │
           ┌─────────┴─────────┐                   │
           ▼                   ▼                   │
    ┌─────────────┐     ┌─────────────┐           │
    │   macOS     │     │   Windows   │           │
    │   Build     │     │   Build     │           │
    │  (arm64)    │     │   (x64)     │           │
    └──────┬──────┘     └──────┬──────┘           │
           │                   │                   │
           ▼                   ▼                   │
    ┌──────────────────────────────────┐          │
    │       DRAFT RELEASE              │◄─────────┘
    │  (artifacts uploaded, NOT public)│
    └──────────────┬───────────────────┘
                   │
                   ▼
    ┌──────────────────────────────────┐
    │      RELEASE-MANAGER             │
    │  ┌─────────────────────────┐     │
    │  │ Gate 1: Technical       │     │ ◄── Automated checks
    │  │ - Signature check       │     │
    │  │ - Size validation       │     │
    │  │ - Extension verify      │     │
    │  └───────────┬─────────────┘     │
    │              │                    │
    │  ┌───────────▼─────────────┐     │
    │  │ Gate 2: Human           │     │ ◄── Jarmo tests
    │  │ - Downloads artifacts   │     │
    │  │ - Tests locally         │     │
    │  │ - "approved for release"│     │
    │  └───────────┬─────────────┘     │
    └──────────────┼───────────────────┘
                   │
                   ▼
    ┌──────────────────────────────────┐
    │      PRODUCT-MARKETER            │
    │  - Release notes                 │
    │  - Changelog                     │
    │  - Social copy                   │
    └──────────────┬───────────────────┘
                   │
                   ▼
    ┌──────────────────────────────────┐
    │      PUBLISHED RELEASE           │
    │  - GitHub Release (public)       │
    │  - Stable download URLs          │
    └──────────────────────────────────┘
```

---

## Agent Responsibilities

| Agent | Responsibility | Automated? | Trigger |
|-------|----------------|------------|---------|
| **CI/CD (workflows)** | Build artifacts, create draft release | ✅ Fully | Tag push or manual |
| **release-manager** | Quality gates, publish decision | 🟡 Semi | User invokes |
| **product-marketer** | Content creation (notes, changelog) | 🟡 Semi | release-manager hands off |
| **Jarmo** | Gate 2 testing, final approval | ❌ Manual | Downloads artifacts |

### Handoff Chain

```
CI/CD ──► release-manager ──► product-marketer ──► Published
  │              │                   │
  │              │                   └── Creates: changelog, release notes, social
  │              │
  │              └── Validates: signatures, sizes, extension integrity
  │                  Coordinates: Gate 2 with Jarmo
  │                  Executes: Publish to GitHub
  │
  └── Produces: DMG (macOS), ZIP (Windows)
      Creates: Draft release with checksums
```

---

## Integration Points

### What CI/CD Produces

| Artifact | Platform | Format | Signed? |
|----------|----------|--------|---------|
| `RiteMark-X.Y.Z-darwin-arm64.dmg` | macOS | DMG | Level 1: No, Level 2: Yes |
| `RiteMark-X.Y.Z-win32-x64.zip` | Windows | ZIP | Level 1: No, Level 2: Yes |
| `checksums.sha256` | All | Text | N/A |

### What release-manager Needs

**Current (local builds):**
```bash
# Checks local files
ls "VSCode-darwin-arm64/RiteMark.app"
codesign -dv "VSCode-darwin-arm64/RiteMark.app"
```

**Future (CI builds):**
```bash
# Downloads from draft release
gh release download vX.Y.Z --repo jarmo-productory/ritemark-native \
  --pattern "*.dmg" --dir /tmp/release-verify/

# Then runs same verification
hdiutil attach /tmp/release-verify/RiteMark-*.dmg
# ... verification checks ...
```

### Adaptation Required

The release-manager agent needs to support TWO modes:

| Mode | When | Source |
|------|------|--------|
| **Local** | Dev iteration, quick fixes | `VSCode-darwin-arm64/` |
| **CI** | Production releases | GitHub draft release artifacts |

---

## Signing Strategy

### macOS Code Signing & Notarization

| Level | Build | Sign | Notarize | Who |
|-------|-------|------|----------|-----|
| **Level 1 (MVP)** | CI | Local | Local | Jarmo |
| **Level 2** | CI | CI | CI | Automated |
| **Level 3** | CI | CI | CI + staple | Automated |

**Level 1 Workflow:**
```
CI builds unsigned DMG
       │
       ▼
Jarmo downloads DMG
       │
       ▼
Local: codesign + notarize + staple
       │
       ▼
Upload signed DMG to release
```

**Level 2+ Workflow:**
```
CI builds + signs + notarizes
       │
       ▼
Artifacts ready for testing
       │
       ▼
Jarmo tests, approves
       │
       ▼
Publish (no manual signing needed)
```

**Secrets Required for Level 2:**
- `APPLE_DEVELOPER_ID_APPLICATION` - Code signing certificate
- `APPLE_DEVELOPER_ID_INSTALLER` - Installer signing certificate
- `APPLE_ID` - For notarization
- `APPLE_APP_SPECIFIC_PASSWORD` - For notarization
- `APPLE_TEAM_ID` - Team identifier

### Windows Code Signing

| Level | Approach | Cost | User Experience |
|-------|----------|------|-----------------|
| **Level 1 (MVP)** | Unsigned | Free | SmartScreen warning |
| **Level 2** | EV Certificate | ~$200-400/year | No warning |
| **Level 3** | Azure SignTool in CI | Same + CI setup | No warning, automated |

**SmartScreen Workaround Documentation:**

For Level 1, release notes must include:
```markdown
## Windows Installation Note

Windows may show a SmartScreen warning because the app is new and unsigned.
To install:
1. Click "More info"
2. Click "Run anyway"

This is normal for new applications. We're working on code signing for future releases.
```

---

## Release Types with CI

### Full App Release (Both Platforms)

```yaml
# Triggered by: git tag v1.2.0 && git push --tags

Workflow: release.yml
  │
  ├── build-macos.yml (parallel)
  │   └── Produces: RiteMark-1.2.0-darwin-arm64.dmg
  │
  ├── build-windows.yml (parallel)
  │   └── Produces: RiteMark-1.2.0-win32-x64.zip
  │
  └── Creates draft release with both artifacts
```

### Extension-Only Release

```yaml
# Triggered by: git tag v1.2.0-ext.1 && git push --tags

Workflow: ci.yml (fast validation only)
  │
  └── Extension files created locally
      └── release-manager uploads to GitHub
```

**Note:** Extension-only releases don't need CI builds - the extension files are platform-agnostic JavaScript.

---

## Quality Gates in CI vs Agent

| Check | CI (Automated) | release-manager |
|-------|----------------|-----------------|
| TypeScript compiles | ✅ | - |
| Webview bundle size > 500KB | ✅ | ✅ (re-verify) |
| Extension.js exists | ✅ | ✅ (re-verify) |
| App launches | ❌ (no GUI in CI) | ✅ (Jarmo tests) |
| .md files open correctly | ❌ | ✅ (Jarmo tests) |
| Code signature valid | Level 2+ | ✅ |
| Notarization accepted | Level 2+ | ✅ |
| node_modules present | ✅ | ✅ (re-verify) |
| Version numbers match | ✅ | ✅ |

### Why Duplicate Checks?

1. **CI checks catch problems early** - Fast feedback, blocks broken builds
2. **release-manager re-verifies** - Defense in depth, catches CI bugs
3. **Jarmo tests real UX** - Automated can't catch "feels wrong"

---

## End-to-End Release Workflow

### Step-by-Step (Level 1)

```
1. DEVELOPMENT COMPLETE
   └── Sprint work done, code reviewed, merged to main

2. VERSION BUMP
   └── Update version in:
       - extensions/ritemark/package.json
       - branding/product.json (ritemarkVersion)

3. TAG & PUSH
   └── git tag v1.2.0 && git push --tags

4. CI BUILDS (automatic, ~45 min)
   ├── macOS arm64 build
   ├── Windows x64 build
   └── Draft release created with artifacts

5. JARMO NOTIFIED
   └── "Draft release v1.2.0 ready for testing"

6. JARMO DOWNLOADS & TESTS
   ├── Downloads macOS DMG from draft release
   ├── Downloads Windows ZIP (or tests in VM)
   └── Tests core functionality

7. LOCAL SIGNING (Level 1 only)
   ├── Jarmo runs: ./scripts/sign-and-notarize.sh
   └── Uploads signed DMG, replacing unsigned

8. INVOKE RELEASE-MANAGER
   └── User: "release v1.2.0"
   └── Agent runs Gate 1 checks on artifacts

9. GATE 2 APPROVAL
   └── Jarmo: "tested locally, approved for release"

10. PUBLISH
    └── release-manager changes draft → published

11. MARKETING HANDOFF
    └── release-manager invokes product-marketer
    └── Creates changelog, release notes, social copy

12. DONE
    └── Public release available at stable URL
```

---

## Decision Log

### Decision 1: Draft Releases First

**Choice:** CI creates DRAFT releases, not published

**Rationale:**
- Preserves human-in-the-loop safety
- Allows testing before public exposure
- Easy to delete failed builds
- Matches existing release-manager workflow

### Decision 2: Hybrid Signing (Level 1)

**Choice:** CI builds unsigned, local signs

**Rationale:**
- Simpler secret management
- Jarmo already has signing setup
- Can upgrade to CI signing later
- Unblocks Windows (no signing needed for MVP)

### Decision 3: Parallel Platform Builds

**Choice:** macOS and Windows build in parallel

**Rationale:**
- Faster total time (45 min vs 90 min sequential)
- Independent - one failure doesn't block other
- Matrix strategy handles this cleanly

### Decision 4: release-manager Stays Manual

**Choice:** Don't automate release-manager

**Rationale:**
- Gate 2 requires human judgment
- Content (release notes) needs human review
- Risk of accidental public release
- Current workflow works well

---

## Future Improvements (Level 2+)

### Automated Signing in CI

```yaml
# Future: macOS signing in CI
- name: Import signing certificate
  uses: apple-actions/import-codesign-certs@v2
  with:
    p12-file-base64: ${{ secrets.APPLE_CERT_P12 }}
    p12-password: ${{ secrets.APPLE_CERT_PASSWORD }}

- name: Sign app
  run: codesign --force --deep --sign "$IDENTITY" RiteMark.app

- name: Notarize
  run: xcrun notarytool submit RiteMark.dmg --wait ...
```

### Smoke Tests in CI

```yaml
# Future: Headless app launch test
- name: Smoke test (macOS)
  run: |
    open -a RiteMark.app --args --smoke-test
    # App writes success marker and exits
    test -f /tmp/ritemark-smoke-ok
```

### Auto-Publish on Approval

```yaml
# Future: PR approval triggers publish
on:
  pull_request_review:
    types: [submitted]

jobs:
  publish:
    if: github.event.review.state == 'approved'
    runs-on: ubuntu-latest
    steps:
      - name: Publish draft release
        run: gh release edit $TAG --draft=false
```

---

## Summary

The key insight is that **CI/CD automates the BUILD, not the RELEASE**.

| Automated (CI) | Human-in-the-loop |
|----------------|-------------------|
| Compilation | Testing judgment |
| Packaging | UX verification |
| Artifact upload | Release approval |
| Draft creation | Publishing decision |
| Basic validation | Content creation |

This hybrid approach gives us:
- **Reproducible builds** - Same result every time
- **Multi-platform support** - Windows without Windows machine
- **Quality preservation** - Human gates remain
- **Audit trail** - All builds tracked in GitHub
- **Rollback capability** - Keep old artifacts

The agents (release-manager, product-marketer) remain essential for quality and content - CI just removes the manual build burden.

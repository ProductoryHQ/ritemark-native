# Update Feed Contract (Sprint 42)

## Purpose

This document defines the proposed v1 contract for Ritemark's compatibility-aware update feed.

The goal is simple:

- the client must be able to compute the **correct next action**
- the client must not depend on `releases/latest` being the correct answer
- full app updates and extension-only updates must use one shared metadata model

## Design Goals

- deterministic resolution
- minimal infrastructure
- compatible with current GitHub-based release flow
- explicit compatibility rules
- enough metadata for good UX

## Non-Goals

- native silent updater protocol
- phased rollout logic
- account-aware entitlements
- third-party CLI distribution

## Core Model

The feed should describe **available update targets**, not just the newest release tag.

The client sends or knows:

- current app version
- current extension version
- platform
- architecture
- channel

The feed provides:

- compatible full update targets
- compatible extension-only targets
- metadata for download, integrity, and UX

## Proposed Feed Shape

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-03-08T09:00:00Z",
  "channel": "stable",
  "fullReleases": [
    {
      "version": "1.5.0",
      "releaseDate": "2026-03-08T08:00:00Z",
      "notesSummary": "Bug fixes and update center improvements",
      "platforms": [
        {
          "platform": "darwin",
          "arch": "arm64",
          "assetName": "Ritemark-arm64.dmg",
          "downloadUrl": "https://example.invalid/Ritemark-arm64.dmg",
          "size": 412000000,
          "sha256": "..."
        },
        {
          "platform": "darwin",
          "arch": "x64",
          "assetName": "Ritemark-x64.dmg",
          "downloadUrl": "https://example.invalid/Ritemark-x64.dmg",
          "size": 417000000,
          "sha256": "..."
        },
        {
          "platform": "win32",
          "arch": "x64",
          "assetName": "Ritemark-Setup.exe",
          "downloadUrl": "https://example.invalid/Ritemark-Setup.exe",
          "size": 388000000,
          "sha256": "..."
        }
      ]
    }
  ],
  "extensionReleases": [
    {
      "version": "1.5.0-ext.1",
      "appVersion": "1.5.0",
      "minimumAppVersion": "1.5.0",
      "releaseDate": "2026-03-08T08:30:00Z",
      "notesSummary": "Fixes update notification copy",
      "extensionDirName": "ritemark-1.5.0-ext.1",
      "files": [
        {
          "path": "out/extension.js",
          "downloadUrl": "https://example.invalid/extension.js",
          "size": 123456,
          "sha256": "..."
        }
      ]
    }
  ]
}
```

## Resolver Rules

Given:

- current app version
- current extension version
- platform
- arch

The resolver must produce one of:

- `none`
- `extension`
- `full`
- `error`

### Rule 1: Prefer the best compatible action

The resolver should not ask:

> "What is the newest tag?"

It should ask:

> "What is the newest compatible improvement for this install?"

### Rule 2: Extension updates only apply within a compatible base

An extension release is eligible only when:

- `current app version >= minimumAppVersion`
- base app version matches the extension track

Practical rule for v1:

- base(`current extension version`) or base(`current app version`) must equal `appVersion` of the extension release

### Rule 3: If extension release is newer but incompatible, look for a full release

This is the key fix for the current architecture.

Example:

- current app: `1.4.0`
- newest extension release: `1.5.0-ext.1`
- newest full release: `1.5.0`

Correct action:

- `full`, target `1.5.0`

Not:

- `none`

### Rule 4: Full release compatibility is platform-specific

A full release is only eligible when it contains a matching asset for:

- current platform
- current architecture

### Rule 5: Downgrades are never offered

If target version is not newer than current applicable version, resolution returns `none`.

## Component Policy

| Component | Managed By | Feed Coverage | Client Behavior |
| --- | --- | --- | --- |
| App | Ritemark | Yes | Offer full installer update |
| Extension | Ritemark | Yes | Offer lightweight update if compatible |
| Voice model | Ritemark | Not in v1 feed | Show local status only in Sprint 42 |
| Claude Code CLI | User | No | Status only, no update action |
| Codex CLI | User | No | Status only, no update action |

## Asset Naming Recommendation

For user-facing stable assets, use one canonical name per platform/arch:

- `Ritemark-arm64.dmg`
- `Ritemark-x64.dmg`
- `Ritemark-Setup.exe`

For versioned build artifacts in CI or archives, versioned file names are still fine, but the feed should point to canonical stable names or explicitly versioned URLs consistently.

The important thing is:

- the client should not guess names
- docs should not contradict scripts
- one asset identity per platform should exist

## Integrity Requirements

For all Ritemark-managed downloadable assets described by the feed:

- size required
- SHA-256 required
- URL required

For Sprint 42, SHA-256 is sufficient.

Longer-term:

- sign the root feed or manifest
- add provenance checks

## Hosting Recommendation for Sprint 42

Use a stable static JSON feed outside `releases/latest`.

Why:

- simplest path to deterministic client behavior
- no need to build a full service yet
- compatible with GitHub-based releases

Longer-term options:

- GitHub Pages
- static file in a public repo
- Cloudflare Worker in front of release metadata

## Expected Client UX Inputs from Feed

The feed should contain enough information to render:

- target version
- update type
- short release summary
- platform-specific download size
- actionable CTA

That keeps product copy accurate without hardcoding version logic into notifications.

## Sprint 42 Decision

For Sprint 42, the contract should be considered successful if it enables:

1. correct full-vs-extension resolution
2. stable manual check behavior
3. better update messaging in Settings and notifications
4. removal of the "latest tag is always the answer" assumption

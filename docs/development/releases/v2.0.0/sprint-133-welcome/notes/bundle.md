# The webview bundles (E4, #107)

| When | Commit | `media/webview.js` | `media/office-preview.js` |
|---|---|---|---|
| Before (the sprint's start) | `de2b7d6b` (main) | 8,491,726 bytes | 2,543,326 bytes |
| After (the PR's head) | `sprint-133-welcome` | 8,537,375 bytes (+45,649, +0.54%) | 2,550,577 bytes (+7,251, +0.29%) |

The technical plan's figure (8,478,880) is from `d781a0e1`, Sprint 132's merge 1; merge 2 and #450/#451 added 12,846 bytes.

The header illustration is a separate file under `media/welcome/`, not inlined (E4): `welcome-hero.jpg` 95,078 bytes (1280 wide), `ritemark-logo-white.svg` 16,936 bytes, and Space Grotesk's Latin subset 22,288 bytes with its OFL licence, loaded by the welcome panel's own `@font-face`.

What grew `webview.js` is the welcome's page (`components/welcome/`, lazy-loaded inside the one IIFE), the Settings section and the landing's chat. `office-preview.js` grew only by the Tailwind classes the new components use, since Tailwind scans every source into both bundles.

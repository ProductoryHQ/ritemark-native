# Sprint 177 spike: a deck's first slide in Finder and Quick Look

**Issue:** #953 (in 2.4 since 25 November 2026)<br>
**Date:** 25 November 2026<br>
**Worktree:** `plan/sprint-177-quick-look` at `origin/main` fb003435<br>
**What this is:** research only. No code changed, nothing built that ships, nothing committed. The local checks were read-only or ran in the session's scratchpad.

## The answer in short

**Recommendation: option (b).** Two small macOS app extensions inside `Ritemark.app/Contents/PlugIns/`, one for Finder's thumbnail and one for the space-bar preview. Each reads the `.rtms` file itself and draws it with Ritemark's own slide code: a JavaScript bundle built from the same TypeScript the editor and the published page use, laid out in an offscreen `WKWebView`. The thumbnail is a snapshot of the first slide that isn't skipped. The preview is the same web view, showing every slide that isn't skipped, one under another, with no handout.

**Option (c) is not the only workable path.** A picture written by Ritemark on save works only for decks opened and saved in Ritemark on this Mac. It is lost through git, e-mail and most cloud folders, and it can show words that a later edit removed. It is the weakest of the three for the decks people receive from others.

**Fallbacks, in order.** If the theme file or a picture can't be found beside the deck, the slide is drawn as the editor draws it then: the project's Evening theme or the built-in one, and "Picture not found" over the file's name. If the thumbnail can't be drawn within its deadline (about 2 seconds), the extension answers with no thumbnail and Finder keeps the system's deck icon, the page with the badge and DECK. There is never a placeholder card.

**Three things only a runner can prove**, before a sprint plan is approved: that WebKit draws inside the *thumbnail* extension's sandbox on each macOS we support; that the thumbnail extension can read the theme file and pictures beside the deck with a read-only exception; and whether macOS turns a new thumbnail extension on by itself. The proof is a harness workflow on throwaway GitHub runners, as Sprint 172's deck type proof was (§6).

**One decision only Jarmo can make** is in §7: whether the extensions may read files on the Mac, read-only and with no network, so a thumbnail can draw the deck's own theme, logo and pictures.

## 1. What macOS offers

### Two extensions, two bundles

macOS asks for thumbnails and previews through two different extension points, so they are two `.appex` bundles. Each has one `NSExtensionPointIdentifier`.

| | Thumbnail (Finder's icon view, Open panels, iCloud) | Preview (space bar, Finder's preview column, Spotlight) |
|---|---|---|
| Framework and class | QuickLookThumbnailing, `QLThumbnailProvider`, answering with `QLThumbnailReply` | QuickLookUI, `QLPreviewingController` on an `NSViewController` (view-based), or `QLPreviewProvider` returning a `QLPreviewReply` (data-based) |
| Extension point | `com.apple.quicklook.thumbnail` | `com.apple.quicklook.preview` |
| Info.plist keys under `NSExtensionAttributes` | `QLSupportedContentTypes`, `QLThumbnailMinimumDimension` | `QLSupportedContentTypes`, `QLSupportsSearchableItems` (false), `QLIsDataBasedPreview` (true only for the data-based kind) |
| Bundle type | `CFBundlePackageType` = `XPC!`, wrapper `.appex` | the same |
| Apple's minimum macOS | 10.15 | 12.0 (Apple's pages for `QLPreviewingController`, `QLPreviewProvider` and `QLPreviewReply`) |
| System sandbox profile (read on this Mac) | `quicklook-thumbnail.sb` | `quicklook-preview.sb` |

Xcode 26.6's own templates confirm the keys (`Thumbnail Extension.xctemplate` and `Quick Look Preview Extension.xctemplate` under `Xcode.app/.../Templates/Project Templates/macOS/Application Extension/`): both set `ENABLE_APP_SANDBOX = YES` and `ENABLE_USER_SELECTED_FILES = readonly`, the thumbnail template sets `QLThumbnailMinimumDimension` to 0, and the preview template sets `QLIsDataBasedPreview` to false.

`QLSupportedContentTypes` must name the exact type. Apple: Quick Look uses the extension only if the listed identifier matches the file's type, and listing a parent type is not enough. Ours is `ai.productory.ritemark.deck`, the exported type that `scripts/stamp-deck-document-type.sh:36` stamps into the release build's Info.plist (`:206-217`, conforming to `public.plain-text`).

The thumbnail reply has three forms: drawing into the current context, drawing into a `CGContext`, or an image file. It also has `extensionBadge`, a short word Finder may draw on the icon thumbnail. The preview's view-based form shows our own view; the data-based form returns HTML, a PDF, an image or a drawing, and HTML may carry attachments addressed as `cid:`.

### Sandbox and entitlements

Every app extension must be sandboxed. An appex signed without `com.apple.security.app-sandbox` is refused at registration with "plug-ins must be sandboxed" (Apple forums, thread 718589). The containing app may stay unsandboxed: Apple DTS calls a non-sandboxed Developer ID app with sandboxed extensions "a common approach" (thread 776568). Ritemark stays as it is.

The system's sandbox profiles on this Mac (macOS 26.5.1, `/System/Library/Sandbox/Profiles/`, read-only) say more than Apple's documentation:

- Both `quicklook-thumbnail.sb` (lines 233-238) and `quicklook-preview.sb` (lines 286-290) honour `com.apple.security.temporary-exception.files.absolute-path.read-only` and `...home-relative-path.read-only`. A path ending in `/` becomes a subpath rule (`select-filter`, `safe-subpath` in `appsandbox-common.sb:781`), so `/` means the whole disk, read-only.
- Only the preview profile names WebKit: `(webkit-support)` and `(webkit-xpc-services)` at `quicklook-preview.sb:68-69`. The thumbnail profile has neither. It is a `(version 1)` profile, and `system.sb:21-23` still allows any XPC service lookup for version 1 "for backward-compatibility", which is how a `WKWebView` reaches its WebContent process from a thumbnail extension today. This is the biggest technical risk (§5).
- Both profiles allow reading `/Applications` (`quicklook-thumbnail.sb:150`) and an app group's container when the extension has `com.apple.security.application-groups`.

The public thumbnail extension point is defined in `/System/Library/ExtensionKit/ExtensionPoints/com.apple.quicklook.thumbnail.appexpt` with `EXDefaultUserElection = false` and `EXSandboxProfileName = quicklook-thumbnail`. Whether "false" means a new thumbnail extension starts switched off until the person turns it on in System Settings ▸ General ▸ Login Items & Extensions ▸ Quick Look is not documented; the runner proof must answer it without running `pluginkit -e use` first (§6).

**Network is not needed.** A Big Sur WebKit regression made `WKWebView` hang inside Quick Look previews; it was fixed in WebKit r271895 on 26 January 2021 (WebKit bug 219632), before our minimum macOS. A WebKit engineer said there that `com.apple.security.network.client` does nothing for Quick Look extensions. So the extensions get no network entitlement and a page policy that loads nothing from the web: they can read, but they cannot send anything anywhere.

### Minimum macOS

Ritemark's minimum is macOS 12.0: `LSMinimumSystemVersion` in the installed 2.3.0 app's Info.plist (`/Applications/Ritemark.app/Contents/Info.plist`, lines 1410-1411, read-only), the same value as the stand-in bundle in `.github/workflows/deck-type-proof.yml:74`. The installed app carries Electron 43.8.6; Electron dropped macOS 11 at version 38. Every API above exists on 12.0.

### Time limits

Apple documents no time limit for either extension. Open-source extensions set their own: one uses 2.5 seconds and then answers with no thumbnail, so the system shows its icon; another uses 18 seconds. Finder asks for many thumbnails at once in a folder, so ours should answer within about 2 seconds and keep one web view alive for the next request.

### WebKit inside each extension

- **Preview:** supported by the profile, and used widely. A view-based preview hosts our `WKWebView` in its `NSViewController`.
- **Thumbnail:** works in practice; three open-source macOS thumbnail extensions snapshot an offscreen `WKWebView` hosted in an offscreen borderless window (an offscreen web view only paints inside a window). It works through the legacy rule above, not through a rule made for it.
- **The data-based preview** returns HTML that Quick Look draws itself. Apple's pages don't say whether its scripts run, and our slides need a script: the words' fit (`webview/src/components/decks/blocks/slideFit.ts:1-12, 131`) is measured in the laid-out page. So the preview should be view-based, with our own web view.

### Without an Xcode project for the main app

Yes. The appex is a folder with `Contents/Info.plist`, `Contents/MacOS/<executable>` and `Contents/Resources/`, placed in `Ritemark.app/Contents/PlugIns/` before the app is signed. Nothing in the Electron app's Info.plist changes. Xcode builds an app extension as an executable whose entry point is Foundation's `_NSExtensionMain` (`LD_ENTRY_POINT = "_NSExtensionMain"` in Xcode 26.6's `DarwinProductTypes.xcspec`, product type `com.apple.product-type.app-extension`), and `swiftc` can do the same.

**Proven here:** a 25-line `ThumbnailProvider` that subclasses `QLThumbnailProvider` and drives a `WKWebView` in an offscreen window compiled with

```
swiftc -parse-as-library -application-extension -module-name RitemarkDeckThumbnail \
  -target arm64-apple-macos12.0 -O -Xlinker -e -Xlinker _NSExtensionMain \
  -framework QuickLookThumbnailing -framework WebKit -framework AppKit ThumbnailProvider.swift
```

for `arm64` and `x86_64` (cross-compiled from this arm64 Mac), joined by `lipo`. `otool` shows `minos 12.0`, `LC_MAIN` on `_NSExtensionMain`, and the Swift runtime taken from `/usr/lib/swift` (part of macOS since 10.14.4, so nothing to embed). An ad-hoc-signed copy carried the sandbox entitlements and the runtime flag. No `.app` or `.appex` folder was made, so nothing could be registered. A public precedent ships exactly this shape: an unsandboxed app with two sandboxed Quick Look extensions, built with Swift Package Manager and a script, signed inside-out with Developer ID and notarized.

### Registration

PlugInKit finds extensions through LaunchServices. When an app with an appex is launched, LaunchServices adds it to its database and PlugInKit rediscovers every appex for that extension point; the thumbnail service (`com.apple.quicklook.ThumbnailsAgent`) can use it almost at once. One report saw a Quick Look extension registered only after its app had run once. In practice: a new install shows deck thumbnails after Ritemark's first launch; an update shows them after the relaunch. `pluginkit -m -v -p com.apple.quicklook.thumbnail` lists what is registered; `pluginkit -a <path>` registers by hand, never on Jarmo's Mac with a dev or test build (§6).

## 2. How to draw the first slide

### What our code already gives us

- `src/decks/page/publicDeck.ts:1-30` decides what of a deck is public: no notes, no comments, no skipped slides (`:435`). Its rule matches the Experience lead's: skipped slides are left out, as Present does.
- `src/decks/page/pageHtml.ts:1-31`: the published page draws every slide once as static HTML with `slideMarkup` (the deck view's own drawing), and is pure: the same input gives the same bytes. Its only Node import is `createHash` (`:32`), which a browser bundle would replace.
- `webview/src/components/decks/slide/slideMarkup.ts`, `src/decks/blocks/slideRenderer.ts` and `webview/src/components/decks/theme/themeVars.ts` are pure TypeScript with `marked` as their one outside dependency.
- `slideFit.ts` (above) is the one fit measure every view shares: the stage, the strip, the wall and Publish.
- The fonts are in `extensions/ritemark/media/fonts/` (all twelve `woff2` files together are 484 KB) and the slide's CSS is `webview/src/components/decks/slide/slide.css` (65 KB).
- The theme: a deck names a theme file by its path in the project, `Slide library/Themes/<name>.theme.md` (`src/decks/deckTheme.ts:266-267`, `themePathOf` at `:432-435`). The editor reads it from the project folder, or the deck's own folder when there is none (`src/decks/deckPages.ts:873-875`); a missing theme falls back to the project's Evening file, then the built-in Evening (`:770-775`). A missing picture is drawn as "Picture not found" over its name (`src/decks/blocks/slideRenderer.ts:165`). The deck's look, Card or Borderless, is in its front matter (`src/decks/deckFormat.ts:605`).
- Copy as picture already draws one slide at 1920 × 1080 (`webview/src/components/decks/slidePictureSvg.ts:5-23`), which is what option (c) would reuse.

### The three ways compared

| | (a) Swift draws it natively | (b) our slide code in an offscreen `WKWebView` | (c) Ritemark writes a picture on save |
|---|---|---|---|
| Looks like our own slide | Only as far as a second renderer copies the first: nine kinds, block slides with Markdown, columns, tabs, agenda, code, buttons, icons, logos, picture focus, Card and Borderless, and the fit. Every Decks change needs a Swift twin and a parity test. | The same code, CSS, fonts and fit as the editor. Differences: pictures from the web aren't drawn (no network), and the copy inside the extension changes only with a shell release (§5). | Exact, at the moment of saving. Stale after any edit made outside Ritemark (an AI, a colleague, git). |
| Speed | Fastest, an estimated tens of milliseconds | Measured here: about 650 ms for the first slide in a fresh process (web view start, page, fonts, snapshot), then about 5 ms for the next (§6). Pictures and fit add to it. | Reading a small image: a few milliseconds |
| Sandbox fit | Needs only the deck file, plus the exception for the theme and pictures | The same, plus WebKit in the thumbnail profile (the risk in §5) | The thumbnail extension can't read a sidecar file or the app's cache without an exception or an app group; an attribute on the deck itself is readable |
| A deck never opened in Ritemark (downloaded, synced, cloned, e-mailed) | Drawn | Drawn | **No picture.** Finder shows the deck icon, or the text picture it shows today. |
| Work | Large, and it never ends | Medium: one bundle entry, two small Swift files, the build and signing steps | Medium, and it needs a place to keep pictures (below) |

### Where option (c) would keep its picture

| Kept in | Finder copy | iCloud Drive | OneDrive, Google Drive | git | e-mail | Comment |
|---|---|---|---|---|---|---|
| An extended attribute on the deck | kept | only names ending in `#S`, about 32 KiB per file in total, so a slide picture won't fit | not checked here; assume lost | lost | lost (kept only inside a zip) | A hidden copy of slide words travels with the file and outlives the words |
| A sidecar file beside the deck | kept | kept | kept | kept if committed | lost unless attached | Clutter in the person's folder and in every AI's view of it; the extension needs the exception to read it anyway |
| A cache in an app group container | not copied | no | no | no | no | Local to one Mac; the main app needs the app group entitlement too (a Team ID-prefixed group avoids macOS 15's prompt) |

Apple's own page adds one point for (b): with a thumbnail extension, iCloud can make a thumbnail alongside the file, so other devices show it after syncing.

### Recommendation and fallbacks

Take **(b)** for both extensions. **Fallback 1:** draw what the editor draws when the theme or a picture can't be found. **Fallback 2:** when the thumbnail can't be drawn in time, or WebKit fails in the thumbnail sandbox, answer with no thumbnail, so Finder keeps the system's deck icon. Option (a) is not worth a second renderer. Option (c) could later serve as a cache, but nothing in this spike needs one: after the first deck, the measured cost is milliseconds.

### How this meets the Experience lead's answers (decks README, ritemark-dev 5cda373)

- **Finder thumbnail:** the first slide that isn't skipped, from `publicDeck`, in the deck's theme and look, laid out at 960 × 540 and snapshotted at the size Finder asks for (`request.maximumSize` × `request.scale`), 16:9 inside it.
- **Space-bar preview:** the same web view lists every slide that isn't skipped, in order, one under another, at the window's width. No handout, no notes, no comments.
- **A deck never opened in Ritemark:** drawn from the file. If nothing can be drawn, the system's deck icon stays. No placeholder card.
- **Theme or picture not found beside the deck:** drawn as the editor draws it.

One question for the runner (§6): when our thumbnail extension answers with nothing, does Finder draw the deck icon, as one open-source extension says, or fall back to the plain-text picture, because the type conforms to plain text?

### Finding the theme and the pictures

The extension doesn't know the project folder the editor uses. It walks up from the deck's folder until it finds a folder that holds the theme's path (`Slide library/Themes/<name>.theme.md`), stopping at the home folder or the disk's top, and then applies the editor's own rules: the file inside that folder once links are followed, at most 64 KB (`deckPages.ts:758`), the logo beside the theme, and pictures relative to the deck's folder. The walk agrees with the editor except when a nearer folder has a theme file of the same name, a case the lead may want to rule on.

Reading the theme and pictures needs the read-only exception (§1). Without it the extension can read only the deck itself, and every deck with a theme of its own would be drawn in Evening, which is wrong while the theme file is there. That is Jarmo's decision (§7). If the runner shows the thumbnail extension can't read beside the deck even with the exception (one open-source project says so in a code comment; the system profile says it should work), the preview is still right, and the thumbnail's choices are Evening, or Ritemark writing the deck's theme text (a few hundred bytes) as an attribute on the file when it saves. That second choice puts something hidden in the person's file, so it goes to the lead and Jarmo, not to the plan.

## 3. Building it in our pipeline

### Where the parts go (a suggestion for the plan)

- `macos/quicklook/`: `Shared/DeckRenderer.swift` (one offscreen web view, its window, the deadline, reading the theme and pictures), `Thumbnail/ThumbnailProvider.swift`, `Preview/PreviewViewController.swift`, two `Info.plist` files and two `.entitlements` files (sandbox, user-selected read-only, the read exception if Jarmo agrees, nothing else).
- `extensions/ritemark/src/decks/quickLook/quickLookDeck.ts`: the bundle entry. It turns a deck's text, its theme text, its look and the pictures that exist into the slides' HTML, then fits them with `slideFit`. Bundled by esbuild into one file, with `slide.css` inlined as the page already does (`src/decks/page/pageAssets.ts:1-32`), `node:crypto` replaced, and the twelve fonts and `OFL.txt` copied beside it. Each appex carries its own copy (about 1 MB each).
- `scripts/build-quicklook.sh <target> <App.app>` builds both, and `--check <App.app>` checks them.

### Build

`build-quicklook.sh` runs `swiftc` for the target's one architecture (`arm64-apple-macos12.0` or `x86_64-apple-macos12.0`), as proven in §1, with its intermediate files under `$TMPDIR`. It runs esbuild for the renderer from the lockfile-installed `node_modules` that Step 1 of `build-prod.sh` already installs, and assembles `Contents/PlugIns/RitemarkDeckThumbnail.appex` and `RitemarkDeckPreview.appex`. Their bundle identifiers start with the app's (`ai.productory.ritemark.deck-thumbnail`, `ai.productory.ritemark.deck-preview`), and their versions are `ritemarkVersion`, stamped as the app's are. No SwiftPM `.build/` folder and no Xcode DerivedData: both would be build state outside the release's control.

In `scripts/build-prod.sh` it runs right after the deck type stamp (`:356`) and before Step 6's provenance (`:495-527`). In `.github/workflows/build-macos-x64.yml` it is a step after "Stamp the deck file type" (`:287-289`) and before "Embed and verify build provenance" (`:291`), so it is inside the tarball (`:421`). The x64 extension is compiled on the Intel runner (`:10`, `macos-15-intel`), so the product bytes still come from CI. The workflow has no Xcode step today; it needs one that picks a fixed Xcode with `xcode-select` and prints `swiftc --version` and the SDK into the log.

### Signing (`scripts/codesign-app.sh`)

Nothing in the script signs a `PlugIns` folder today. Its signers find files by name (`:319-520`), and its discovery list (`:251-276`) only counts. Without a new step, Step 6 (`:529-539`) would fail loudly, because the main app's signature requires its nested code to be signed first. The changes:

- Before signing anything (Step 3, `:220-245`), verify the extensions' pre-sign digest, as the extension's is verified.
- A new step 5f, after the helper apps (`:509-520`) and before the main app: `codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" --entitlements macos/quicklook/<kind>.entitlements <appex>` for each appex. Signing the bundle signs its executable and seals its resources. No `--deep`, and never the app's own `branding/entitlements.plist` (JIT, unsigned memory and library-validation exceptions have no place in a sandboxed extension).
- Step 7b's unsigned scan (`:555-580`) then covers the extensions' executables as it is. A new 7e reads each appex's entitlements back: sandbox true, no `get-task-allow`, none of the app's `cs.` exceptions, our Team ID, the runtime flag.
- No app group: nothing in (b) needs one, so `branding/entitlements.plist` stays as it is.

### Notarization and the DMG

`scripts/notarize-app.sh` zips the whole app with `ditto` (`:127-128`) and checks it with `codesign --verify --deep --strict` (`:111`); `scripts/create-dmg.sh:98` checks it the same way. Both cover nested extensions unchanged. Apple's list of notarization failures is a Developer ID signature, a secure timestamp, the hardened runtime, no `get-task-allow` and an SDK of 10.9 or later; sandbox exceptions are not on it (Mac App Store review would refuse them, and Ritemark isn't sold there). Nothing is expected to block notarization.

### Provenance, validation and the source gate

- `scripts/build-provenance.mjs` hashes the extension and five input files (`:173-201`; the release-commit path `:255-280`). It would not notice the extensions at all. Add the source folder's digest (`sha256Directory` and `sha256DirectoryAtCommit`, as for `patches/vscode`), a pre-sign digest of `Contents/PlugIns` written beside `ritemark-extension-pre-sign.sha256`, and the Swift toolchain and SDK versions as a build-machine note.
- `scripts/validate-build-output.sh` would flag nothing either: its architecture check reads only `*.node` files (`:542-586`). Add a Check 5h that runs `build-quicklook.sh --check` (keys, identifiers, versions, `LSMinimumSystemVersion`, the type list holding exactly `ai.productory.ritemark.deck`, resources with size floors, executable architecture) next to Check 5g, the deck type (`:698-720`).
- `scripts/verify-release-source.sh` needs no change as long as the build writes nothing in the tree outside `VSCode-<target>/`: it refuses untracked files (`:146-151`) and an existing build output (`:199-206`).
- The CI workflow's own validation step (`build-macos-x64.yml`, "Validate build") gets the same `--check`.

### Shell-tier files

Changed, already on `CLAUDE.md`'s list:

- `scripts/build-prod.sh`
- `.github/workflows/build-macos-x64.yml`
- `scripts/codesign-app.sh`
- `scripts/build-provenance.mjs`
- `scripts/validate-build-output.sh`
- maybe `scripts/extract-macos-x64-artifact.sh`, if its provenance check passes the new digest
- maybe `scripts/release-preflight.sh`, to check that the x64 workflow builds the extensions, as it checks provenance (`:303-313`)

New, to be added to the list in `CLAUDE.md` and in `scripts/release-extension-preflight.sh`'s `SHELL_TIER_PATHS` (`:77-105`) in the same commit:

- `macos/quicklook/`
- `scripts/build-quicklook.sh`
- `extensions/ritemark/src/decks/quickLook/`, whose bundle ships only inside the extensions

Unchanged: `patches/`, `vscode`, `branding/product.json`, `scripts/stamp-deck-document-type.sh`, `scripts/create-dmg.sh`, `scripts/verify-release-source.sh`, `scripts/tree-sha256.mjs`, and everything for Windows. A gap already there: `branding/entitlements.plist` is not on the list. This plan doesn't touch it.

## 4. Spotlight and plain text

Nothing changes for search. Spotlight indexes a file through its importer, chosen by the type's conformance to `public.plain-text`; Quick Look extensions take no part in indexing, and `QLSupportsSearchableItems` stays false. Spotlight's own preview of a found deck will show the slides instead of the text.

Only decks reach the extensions, because the type must match exactly: `.txt`, `.md` and older `*.deck.md` decks keep the system's text preview and thumbnail (this Mac's `qlmanage -m` maps `public.plain-text` to `Text.qlgenerator`). For a `.rtms` that doesn't read as a deck, the preview should show its text in the same web view instead of failing, since a failed preview shows only the file's icon and details; the thumbnail answers nothing and the deck icon stays.

## 5. Risks

1. **WebKit in the thumbnail sandbox.** On macOS 26.5 the thumbnail profile allows WebKit only through a rule kept "for backward-compatibility"; the preview profile allows it by name. If Apple tightens it, thumbnails fall back to the deck icon while previews keep working. Prove on every runner macOS (14, 15, 26); macOS 12 and 13 have no GitHub runner left, so they stay untested before release.
2. **Reading beside the deck.** The theme, the logo and the pictures need the read-only exception (Jarmo's call). The sandbox profile says the thumbnail extension honours it; one open-source project says it was denied. Theme files in OneDrive or iCloud that are online-only may also download slowly or not at all inside the deadline, and such a deck is drawn in Evening until they are local.
3. **Registration, election and caches.** The extensions exist only after Ritemark has run once since the install or update. A person who quits with an update pending and never reopens Ritemark keeps the old app. `EXDefaultUserElection = false` may mean the thumbnail extension starts switched off. Finder's thumbnail cache may keep today's text pictures of existing decks until a deck changes; `qlmanage -r cache` clears it, but asking people to run it is not a plan. Developers report a reboot sometimes needed before a new thumbnail extension is used.
4. **The Finder picture follows shell releases.** An extension release changes the editor's drawing, but the renderer copy inside the extensions changes only with a shell release, so the two can differ for a while.
5. **Two registered copies.** A release candidate built in a worktree is an app bundle with the extensions in it, and LaunchServices may register it beside `/Applications/Ritemark.app`. Gate 2 should check `pluginkit -m -v` paths, and old candidates should be cleaned with the worktree hygiene tool.
6. **The Intel CI runner.** `macos-15-intel` is the last Intel image; the build now also depends on the Xcode versions it carries.
7. **Notarization.** No expected blocker. Mistakes that would block: an appex without the sandbox (refused at registration), `get-task-allow`, or an appex signed with the app's entitlements. Unsigned nested code makes Step 6 fail loudly, before notarization.

## 6. What was checked here, and what a runner must prove

### Checked on this Mac (read-only, or in the scratchpad)

- Xcode 26.6 (17F113), macOS SDK 26.5, Swift 6.3.3, macOS 26.5.1 on arm64.
- The throwaway thumbnail extension binary (§1), built for arm64 and x86_64 and ad-hoc signed with the sandbox entitlements. Files: `/private/tmp/claude-501/-Users-jarmotuisk-Projects-ritemark-dev-ritemark-native/cd7c0cab-c6e8-4bfa-817a-671f23a98a00/scratchpad/ql-spike/`.
- A timing probe in the same folder: a command-line Swift program, not an extension and not sandboxed, with an offscreen borderless window, no Dock icon and two of our woff2 fonts. It loaded a 960 × 540 slide, waited for the fonts and took a snapshot: 646 ms the first time (612 ms of it starting the page), then 5-6 ms for each of the next three. The snapshot drew both fonts correctly. One detail for the real page: without `<meta charset="utf-8">` a "·" came out as "Â·".
- Xcode's extension templates and build spec, the system's Quick Look sandbox profiles and the thumbnail extension point definition (§1).
- `pluginkit` lists no third-party thumbnail extensions on this Mac and eighteen preview extensions. `qlmanage -m` maps `public.plain-text` to `Text.qlgenerator`.
- The installed `/Applications/Ritemark.app` 2.3.0: `LSMinimumSystemVersion` 12.0, no `PlugIns` folder, Team ID JKBSC3ZDT5, runtime flag. Read only; not launched, not changed.

### Runner proof, before the plan is approved

The same pattern as Sprint 172's deck type proof (`.github/workflows/deck-type-proof.yml`; the reason is in `docs/development/releases/v2.3.0/sprint-172-deck-extension/research/rtms-audit.md:101-105`: no dev or test build ever registers on Jarmo's Mac). A `workflow_dispatch` harness workflow, not a `build-` one, on throwaway `macos-14`, `macos-15` and `macos-26` runners: build the two extensions with `build-quicklook.sh`, put them in the stand-in bundle, stamp it, ad-hoc sign them with the planned entitlements, register with `lsregister`, and without `pluginkit -e use`:

1. Is the thumbnail extension used by default? (`pluginkit -m -v`, then `QLThumbnailGenerator` from a Swift script, and `qlmanage -t`.)
2. Does WebKit draw inside it, and how long do the first and the tenth deck take?
3. Can it read the theme file and a picture beside the deck, with the exception and without it?
4. What does Finder get when the extension answers nothing: the deck icon or the text picture?
5. Does the preview extension draw all the slides, and does its text fallback work for a file that isn't a deck?

The thumbnails come back as PNG artifacts, as Sprint 172's did. Developer ID signing and notarization are proven later, on the first release candidate.

## 7. Decisions

### Only Jarmo

1. **Take #953 into 2.4 as a shell-tier sprint.** It adds a native part to the Mac build: two Swift extensions, built by `swiftc` on the release Mac and on the Intel CI runner, signed with the app and notarized with it.
2. **Let the Quick Look extensions read files on the Mac, read-only.** They have no network, so nothing can leave the Mac. It is what lets a thumbnail draw the deck's own theme, logo and pictures. A narrower choice is the home folder only: decks on external disks then draw in Evening, without pictures. Without either, every deck with a theme of its own draws in Evening in Finder. Apple calls these exceptions temporary, and the Mac App Store would refuse them; Ritemark isn't sold there.

### For the Experience lead and the manager

- The project-folder walk (§2) when a nearer folder has a theme of the same name.
- Whether the thumbnail carries `extensionBadge` "DECK", and the smallest size it draws (`QLThumbnailMinimumDimension`); below it the deck icon stays.
- Pictures from the web are not drawn in Finder.
- If the runner says the thumbnail can't read beside the deck: Evening in Finder, or the theme text as an attribute on the file (the second needs Jarmo too).

## Sources

Apple:

- [QLThumbnailProvider](https://developer.apple.com/documentation/quicklookthumbnailing/qlthumbnailprovider) and [QLThumbnailReply](https://developer.apple.com/documentation/quicklookthumbnailing/qlthumbnailreply) (macOS 10.15)
- [Providing Thumbnails of Your Custom File Types](https://developer.apple.com/documentation/quicklookthumbnailing/providing-thumbnails-of-your-custom-file-types) (exact type match, minimum dimension, iCloud thumbnails)
- [QLPreviewingController](https://developer.apple.com/documentation/quicklookui/qlpreviewingcontroller), [QLPreviewProvider](https://developer.apple.com/documentation/quicklookui/qlpreviewprovider) and [QLPreviewReply](https://developer.apple.com/documentation/quicklookui/qlpreviewreply) (macOS 12.0, `QLIsDataBasedPreview`)
- [Resolving common notarization issues](https://developer.apple.com/documentation/security/resolving-common-notarization-issues)
- Apple Developer Forums:
  - [718589](https://developer.apple.com/forums/thread/718589): "plug-ins must be sandboxed"
  - [776568](https://developer.apple.com/forums/thread/776568): a non-sandboxed app with sandboxed extensions
  - [124208](https://developer.apple.com/forums/thread/124208), [758129](https://developer.apple.com/forums/thread/758129), [773050](https://developer.apple.com/forums/thread/773050): files beside the previewed file
  - [784488](https://developer.apple.com/forums/thread/784488): testing a thumbnail extension; reboots
  - [762639](https://developer.apple.com/forums/thread/762639): Team ID-prefixed app groups on macOS 15
- [WebKit bug 219632](https://bugs.webkit.org/show_bug.cgi?id=219632): `WKWebView` in a Quick Look preview, fixed in r271895
- On this Mac, read-only:
  - `/System/Library/Sandbox/Profiles/quicklook-thumbnail.sb`, `quicklook-preview.sb`, `appsandbox-common.sb`, `system.sb`
  - `/System/Library/ExtensionKit/ExtensionPoints/com.apple.quicklook.thumbnail.appexpt`
  - Xcode 26.6's `Thumbnail Extension.xctemplate`, `Quick Look Preview Extension.xctemplate` and `DarwinProductTypes.xcspec`

Others:

- Open-source Quick Look extensions with offscreen `WKWebView` thumbnails:
  - [sethbang/markee](https://github.com/sethbang/markee): SwiftPM, `NSExtensionMain`, inside-out signing, notarized
  - [Architeuthis-Flux/KiCadQuickLook](https://github.com/Architeuthis-Flux/KiCadQuickLook): entitlements, the comment on files beside the previewed file
  - [edunascimentt/excaliview](https://github.com/edunascimentt/excaliview)
  - [sbarex/QLMarkdown](https://github.com/sbarex/QLMarkdown): launch once; read-only access to the whole system
- Eclectic Light:
  - [How PlugInKit enables app extensions](https://eclecticlight.co/2025/04/16/how-pluginkit-enables-app-extensions/)
  - [How Sequoia has changed QuickLook](https://eclecticlight.co/2024/10/31/how-sequoia-has-changed-quicklook-and-its-thumbnails/)
  - [iCloud Drive changes extended attributes](https://eclecticlight.co/2023/07/21/icloud-drive-changes-extended-attributes/)
  - [What gets synced in iCloud Drive?](https://eclecticlight.co/2026/05/12/what-gets-synced-in-icloud-drive/)

Our repository: the file and line references above, at `origin/main` fb003435.

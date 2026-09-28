---
name: release
description: Procedural commands and gotchas for Ritemark Native releases — version bump, signing, DMG creation, notarization, GitHub Actions toggling, update feed publication, release closeout (verify published assets, archive evidence, reclaim the release worktree). Use when the release-manager agent needs concrete commands or when the user is performing release steps directly.
allowed-tools: Read, Bash, Glob, Grep
metadata:
  version: 1.1.0
---

# Release Skill — Procedural Reference

Companion skill to `release-manager` agent. The agent owns workflow + gate enforcement; this skill owns the concrete commands.

## When to use

- A release-manager run reaches a step that needs exact bash commands.
- The user is doing release steps without invoking the agent.
- Notarization, signing, or GitHub Release commands need to be looked up.
- GitHub Actions Windows build needs the public/private repo toggle.
- A published release's worktree is still on disk holding build output (Step 10, closeout).

## Release Types

| Type | Trigger | Version Format |
|---|---|---|
| Full release | VS Code core / patches / branding changed | `X.Y.Z` (e.g. `1.7.0`) |
| Extension-only | Changes confined to `extensions/ritemark/` | `X.Y.Z-ext.N` (e.g. `1.7.0-ext.1`) |


## DLC Planning Precheck

Before Step 0 for any full or extension-only release, check the parent release plan and milestone:

```bash
test -f docs/development/releases/vX.Y.Z/release-plan.md
gh api repos/ProductoryHQ/ritemark-native/milestones --paginate --jq '.[].title' | grep -qx 'vX.Y.Z'
```

Do not start version bumps, tags, packaging, or GitHub release work until the release plan says the release is feature complete or a release candidate.

## Two rules that govern the whole sequence

Both were learned the expensive way in v1.11.0. Neither is obvious from the
step list, and breaking either invalidates work already done.

### ⛔ Prove CI green BEFORE cutting a candidate

Dispatch `build-windows.yml` and `build-macos-x64.yml` and get them green
*first*, on throwaway runs if necessary. Only then build the arm64 candidate.

A CI fix is a commit; a commit moves `main`; and a moved `main` invalidates
every artifact already built (see the next rule). In v1.11.0 three latent CI
defects surfaced one after another, and each one discarded a completed arm64
build — one of which had already been notarized, spending an Apple submission
on bookkeeping.

### ⛔ `main` is FROZEN from the first candidate until publish

`verify-release-source.sh` does not merely check that the build uses an
approved commit. It checks that the commit **is `origin/main`'s tip right
now**, and it refuses a named branch outright:

```
FAIL  HEAD 9e963596… does not match origin/main 897e61f3…
FAIL  release builds may only use main or a detached origin/main commit
      (found: release/v1.11.0-candidate)
```

So merging **anything** — including the release notes, the test checklist, or
the candidate record — invalidates the candidate. Pushing a branch at the
frozen commit does not help; that is the case the gate explicitly rejects.

Hold those PRs open and merge them in the closeout (Step 9/10). This does not
contradict D1: the harness may advance *after* publication, not between a
candidate and its CI builds.

## Workflow — Full release (DMG)

### ⛔⛔ TWO HARD RULES THAT GOVERN NOTARIZATION ORDER ⛔⛔

These override the convenience of doing sign+DMG+notarize in one shot. Notarization is a limited Apple resource (a team-eligibility hold once cost weeks — case 102892219755). Never spend a submission on an untested or unsettled build.

1. **Jarmo tests the UN-notarized build, never the notarized one.** Gate 1 (arm64) and Gate 2 (x64/Windows) happen on the signed-but-not-notarized DMG. Notarization is the LAST step before publish, run only after the relevant gate has passed. By the time anything is notarized, it is already approved — so Jarmo never tests a notarized app.
2. **60-minute hardening period between DMG build and notarization.** After a DMG is built, wait ≥60 min before notarizing it — even if Gate approval comes sooner. This settling window is to let late bugs surface. If a bug surfaces in the window, rebuild and reset both the clock and the gate. The build timestamp starts the clock; Gate-approval time does not.

Sequence: **build DMG → Jarmo tests un-notarized → ≥60 min hardening (no new bugs) → notarize → publish.**

### Step 0 — Pre-flight

> Read **Two rules that govern the whole sequence** above first. Cutting a
> candidate before CI is green, or merging anything to `main` afterwards,
> throws away everything built from this point on.

```bash
node ./scripts/worktree-hygiene.mjs --check
./scripts/create-release-worktree.sh
# cd to the new path printed by the command
./scripts/release-preflight.sh
(cd extensions/ritemark && npm run check:anthropic-models)   # Sprint 127 R10
```

`check:anthropic-models` checks that the bundled Claude Code still supports every model in Anthropic's Claude Code catalog. An `ALERT` stops the release; see **Claude Code and model currency** below.

Review the hygiene report before `--clean`. The release worktree must be new,
detached at the exact `origin/main` commit, and contain a physical pristine VS
Code submodule. Preflight hard-blocks local patches, shared dependencies, old
output, and any source drift. If the release source gate fails, discard the RC
worktree and recreate it; do not repair it in place.

### Step 1 — Version bump (no tag yet)

**Six files carry the version, not two.** Two of them have drifted at every
recent release — v1.10.1 bumped four of six, and the v1.10.0 bump found
`BRANDING.json` at 1.5.4 and `VERSION` at 1.6.2. Check all six and bump all six:

| File | Key |
|---|---|
| `branding/product.json` | `ritemarkVersion` |
| `branding/BRANDING.json` | `version` |
| `branding/VERSION` | the whole file |
| `extensions/ritemark/package.json` | `version` |
| `extensions/ritemark/package-lock.json` | `version` **and** `packages[""].version` |
| `installer/windows/ritemark.iss` | `#define AppVersion` |

The installer default is overridable with `/DAppVersion` and CI passes it, so a
drifted `.iss` is harmless in CI — but a *local* installer build from a drifted
tree is mislabelled.

1. Make the version changes on a dedicated release-prep branch.
2. Bump all six entries above. Use targeted replacement, not a JSON round-trip:
   reformatting a release input is not something to do incidentally.
3. Verify: the diff should be **7 insertions, 7 deletions across 6 files**.
4. Commit, push, and merge through the normal protected-main workflow.
5. Fetch `origin/main`; the previous preflight worktree is now invalid.

This is the **last** merge to `main` until publish — see the freeze rule above.

**Do NOT create the tag yet** — tag push triggers CI; we wait until Gate 1 passes.

### Step 2 — Build macOS arm64 (local)

```bash
node ./scripts/worktree-hygiene.mjs --check
./scripts/create-release-worktree.sh
# cd to the new path, then:
./scripts/release-preflight.sh
arch -arm64 /bin/zsh -c 'source ~/.nvm/nvm.sh && nvm use "$(cat vscode/.nvmrc)" && ./scripts/build-prod.sh 2>&1'
```

This second fresh worktree is mandatory because the version commit changed
`origin/main`. `build-prod.sh` uses `npm ci`, applies canonical patches itself,
requires empty output, and embeds `ritemark-build-provenance.json`. Run as a
background task with `timeout: 600000` (10 min cap). Never pipe through
`tail`/`head` — buffering hangs background mode.

⛔ **A release worktree is single-use per build attempt.** `build-prod.sh`
applies the patches into `vscode/`, so afterwards the submodule is no longer
pristine and the source gate refuses the next build with *"use a new release
worktree"*. Clearing `VSCode-*/` and `dist/` does **not** restore it. Every
retry needs a fresh worktree:

```bash
./scripts/create-release-worktree.sh --path .worktrees/release-<commit>-2
```

Budget disk for this: each spent attempt holds ~8 GB (mostly the physical
`vscode` submodule — clearing build output only recovers ~2.5 GB of it), and
removal is Jarmo's call, not yours.

⚠️ `.signing-config` is git-ignored, so a fresh worktree does not have it.
Copy it from the main checkout before Step 3 or `codesign-app.sh` stops with
`APPLE_TEAM_ID not set`.

⚠️ **Google OAuth client (since v1.12, Sprint 119).** `build-prod.sh` loads
`RITEMARK_GOOGLE_CLIENT_ID` / `RITEMARK_GOOGLE_CLIENT_SECRET` from the
environment or from `~/.config/ritemark/release.env`. That file is outside every
worktree, mode 600, and needs no copy. The script sets
`RITEMARK_REQUIRE_GOOGLE_OAUTH=1`, so the extension compile **refuses** to
build without the client, and `scripts/check-google-oauth-build.mjs` then
confirms that the bundle carries it. No value is ever printed. The CI build
workflows take the same two values from repository secrets of the same names.
An extension-tier release compiles with those variables set, and
`release-extension.sh` refuses a bundle without the client. Gate testing should
include Settings → Google Docs → Connect on the candidate, because that is the
first run against the production client.

Generate test checklist in `docs/releases/vX.Y.Z/TEST-CHECKLIST.md`.

### Step 3 — Sign + DMG arm64 (NO notarization yet)

```bash
./scripts/codesign-app.sh
./scripts/create-dmg.sh
```

⛔ **If one component fails to sign, rebuild — do not hand-sign it.** A single
failure among ~52 is almost always a transient `--timestamp` round-trip to
Apple; re-running the whole script usually comes back 52/0. But signing an
inner file after the bundle is sealed **breaks the outer seal**, and re-running
`codesign-app.sh` over an already-signed tree then fails the provenance gate
(correctly — the first pass changed extension bytes). At that point the only
way out is a fresh worktree and a fresh build. In v1.11.0 that cost two dead
builds.

⚠️ **`create-dmg` cannot drive Finder from a non-interactive session** — it
dies with AppleScript `-1743` (or `-1712`/`-1728`). This is normal here, not a
broken machine. Fall back to the v1.8.1 path, which v1.10.1 and v1.11.0 both
used:

```bash
mkdir -p dist                       # create-dmg.sh would have made this
STAGE=$(mktemp -d)
ditto "VSCode-darwin-arm64/Ritemark.app" "$STAGE/Ritemark.app"
ln -s /Applications "$STAGE/Applications"
cp branding/icons/icon.icns "$STAGE/.VolumeIcon.icns" && SetFile -a C "$STAGE"
hdiutil create -srcfolder "$STAGE" -volname "Ritemark" -fs HFS+ -format UDRW -ov dist/rw.dmg
hdiutil convert dist/rw.dmg -format UDZO -imagekey zlib-level=9 -o dist/Ritemark-X.Y.Z-darwin-arm64.dmg -ov
rm -f dist/rw.dmg; rm -rf "$STAGE"
codesign --force --sign "<Developer ID hash>" dist/Ritemark-X.Y.Z-darwin-arm64.dmg
shasum -a 256 dist/Ritemark-X.Y.Z-darwin-arm64.dmg | awk '{print $1}' > dist/Ritemark-X.Y.Z-darwin-arm64.dmg.sha256
```

Sign with the identity **hash** from `security find-identity -v -p codesigning`;
`"Developer ID Application: <TEAM_ID>"` is not a resolvable identity string.

Output: `dist/Ritemark-X.Y.Z-darwin-arm64.dmg` (signed Developer ID, **NOT notarized, NOT stapled**).

⛔ **DO NOT run `notarize-dmg.sh` here.** Notarization happens only AFTER Gate 1 passes (see HARD RULE below). Record the DMG build timestamp — the 60-min hardening clock starts now.

### ⛔ Gate 1 — Jarmo tests the UNNOTARIZED signed DMG

**Jarmo always tests the un-notarized build.** Notarized binaries are never the thing Jarmo tests — by the time we notarize, the build is already approved.

Surface to user: "Signed (un-notarized) arm64 DMG ready at `dist/Ritemark-X.Y.Z-darwin-arm64.dmg`. Please install and test. Because it isn't notarized yet, Gatekeeper will warn — right-click the app → **Open**, or run `xattr -dr com.apple.quarantine '/Applications/Ritemark.app'` after copying it in."

Wait for: "approved", "DMG approved", "GATE 1 passed".

### Step 4 — Hardening period + notarize arm64

⛔ **HARD RULE — hardening period (min 60 min between DMG build and notarization).** After the DMG is built (Step 3), wait **at least 60 minutes** before notarizing — even after Gate 1 approval. This window lets late-surfacing bugs appear before we spend an Apple notarization submission. If Gate 1 takes longer than 60 min, the window is already satisfied; if Jarmo approves fast, **still wait out the remainder of the hour.** If ANY bug surfaces during the window → rebuild, and the clock + Gate 1 reset.

Why: Apple notarization submissions are a limited/rate-sensitive resource and a long team-eligibility hold (case 102892219755, lifted 2026-05-29) cost weeks. Never burn a submission on a build that hasn't been tested and allowed to settle.

Only once **(a)** Gate 1 has passed AND **(b)** ≥60 min have elapsed since the DMG build with no new bugs:

```bash
./scripts/notarize-dmg.sh dist/Ritemark-X.Y.Z-darwin-arm64.dmg
```

This notarizes AND staples. Verify staple + Gatekeeper acceptance before proceeding.

### Step 5 — Dispatch CI builds (Windows + macOS x64)

> **Changed in v1.8.2:** CI no longer auto-triggers on tag push. `build-windows.yml` and `build-macos-x64.yml` are `workflow_dispatch`-only. Dispatch them explicitly against the release ref. The build version is read from `branding/product.json`, **not** the git ref, so any ref (branch, tag, or commit) works — you do NOT need to create the tag to build. Create the tag later, at publish time (Step 8).

**Toggle repo to private first** — public repos cannot use larger Windows runners:

```bash
gh repo edit ProductoryHQ/ritemark-native --visibility private --accept-visibility-change-consequences
```

Dispatch both builds against **`main`** — not a SHA (`--ref` takes a branch or
tag; a raw commit gives `HTTP 422: No ref found`) and not a release branch (the
source gate rejects any named branch). `build-windows.yml` additionally
requires the exact commit as an input:

```bash
C=$(git rev-parse origin/main)          # must equal the built candidate
gh workflow run build-macos-x64.yml --ref main
gh workflow run build-windows.yml  --ref main -f source_commit="$C"
```

Verify `git rev-parse origin/main` equals the commit your arm64 candidate was
built from, immediately before dispatching. If it does not, `main` moved and
the freeze rule was broken — every artifact must be rebuilt from one commit,
because artifacts that disagree about their source commit cannot be signed
against a single `RITEMARK_RELEASE_COMMIT`.

`<ref>` must resolve to the exact already-approved `origin/main` source commit.
Both workflows independently initialize the recorded VS Code gitlink, use
frozen installs, run the clean-source gate, and embed provenance.

After the Windows build completes (Step 6), toggle back:

```bash
gh repo edit ProductoryHQ/ritemark-native --visibility public --accept-visibility-change-consequences
```

### Step 6 — Download + sign macOS x64 (NO notarization yet)

Wait for `build-macos-x64.yml` to finish:

```bash
gh run list --workflow=build-macos-x64.yml --limit 3
gh run download <run-id> --name ritemark-darwin-x64 --dir dist/x64-ci
./scripts/extract-macos-x64-artifact.sh
export RITEMARK_RELEASE_COMMIT=<approved 40-char source commit>
./scripts/codesign-app.sh darwin-x64
./scripts/create-dmg.sh x64
```

`RITEMARK_RELEASE_COMMIT` is mandatory for a CI-built artifact. The x64 app was
built on another machine, so its embedded provenance is verified against the
approved release commit's git objects (`build-provenance.mjs --release-commit`)
instead of this checkout's working tree — a working-tree comparison can never
match across machines (CI copies the extension into `vscode/extensions`; a
worktree links it). Run these steps from any clean **harness worktree** whose
`vscode` submodule is initialized; the product source is the release commit,
not the worktree's HEAD. Record the harness commit next to the artifact hash.

Output: `dist/Ritemark-X.Y.Z-darwin-x64.dmg` (signed, **NOT notarized**). Same rule as arm64 — record the DMG build timestamp; **do NOT notarize until Gate 2 passes AND ≥60 min hardening have elapsed.**

### ⛔ Gate 2 — Jarmo tests UNNOTARIZED x64 DMG + Windows installer

```bash
gh run list --workflow=build-windows.yml --limit 3
# Download the Windows artifact next to the x64 one, then stage the installer for Step 8
gh run download <windows-run-id> --name ritemark-windows-installer --dir dist/win-ci
cp dist/win-ci/Ritemark-Setup.exe dist/Ritemark-Setup.exe
# dist/win-ci/ also holds Ritemark-Setup.sha256.txt (sha256, source_commit,
# workflow_commit, store_url) and roundtrip-evidence/ — Step 10 archives both
# Jarmo downloads Windows artifact + the signed (un-notarized) x64 DMG, tests both
```

Same as Gate 1: Jarmo tests the **un-notarized** x64 build (Gatekeeper right-click → Open). Wait for: "x64 approved", "Windows approved", "GATE 2 passed".

### Step 7 — Hardening period + notarize x64

Apply the same ⛔ **60-min hardening rule** as Step 4. Only after Gate 2 passes AND ≥60 min have elapsed since the x64 DMG build with no new bugs:

```bash
./scripts/notarize-dmg.sh dist/Ritemark-X.Y.Z-darwin-x64.dmg
```

Notarizes + staples. Verify before proceeding to Step 8.

### Step 8 — GitHub Release + update feed

```bash
cp dist/Ritemark-X.Y.Z-darwin-arm64.dmg dist/Ritemark-arm64.dmg
cp dist/Ritemark-X.Y.Z-darwin-x64.dmg   dist/Ritemark-x64.dmg

gh release create vX.Y.Z --repo jarmo-productory/ritemark-public \
  --title "Ritemark vX.Y.Z" \
  --notes-file <prepared body> \
  dist/Ritemark-arm64.dmg \
  dist/Ritemark-x64.dmg \
  installer/windows/Ritemark-X.Y.Z-win32-x64-setup.exe
```

**Preparing the body — two traps, both hit in v1.10.0:**

1. **Take the notes from `origin/main`, not from the release worktree.** The
   release worktree is pinned to the frozen product source commit, so any notes
   correction merged after it was created is missing there. Publishing from it
   silently reverts those corrections:
   `git show origin/main:docs/releases/vX.Y.Z/release-notes.md > /tmp/body.md`.
2. **Rewrite relative image paths to absolute URLs.** A release body is rendered
   standalone, so `![](screenshots/foo.png)` renders as a broken link even
   though it is correct inside the repo. Copy the referenced images into
   `images/` in `jarmo-productory/ritemark-public`, push, and rewrite the body
   (leave the repo document's relative paths alone):

```bash
sed -E 's#\]\(screenshots/#](https://raw.githubusercontent.com/jarmo-productory/ritemark-public/main/images/#g' \
  /tmp/body.md > /tmp/release-body.md
```

Afterwards, verify against the live release: every image reports
`complete && naturalWidth > 0`, every URL returns 200, and the body differs
from `origin/main`'s notes only by the image rewrite.

**Update feed (MANDATORY):** regenerate canonical update metadata, verify it matches the published assets, publish to canonical location.

⛔ **Always pass `--existing-feed-url` naming the PREVIOUS release.** The
generator seeds from `releases/latest/download/update-feed.json`, but the
release you just published *is* `latest` and has no feed attached yet, so that
URL 404s, the seed comes back empty, and the generated feed silently contains
only the new version — wiping every older per-platform entry:

```bash
node ./scripts/generate-update-feed.mjs --mode full --version X.Y.Z \
  --output dist/update-feed.json \
  --existing-feed-url https://github.com/jarmo-productory/ritemark-public/releases/download/v<PREV>/update-feed.json \
  --notes-file docs/releases/vX.Y.Z/release-notes.md \
  --asset "dist/Ritemark-arm64.dmg|darwin|arm64|Ritemark-arm64.dmg" \
  --asset "dist/Ritemark-x64.dmg|darwin|x64|Ritemark-x64.dmg" \
  --asset "dist/Ritemark-Setup.exe|win32|x64|Ritemark-Setup.exe"
```

Before uploading, confirm `fullReleases` grew by exactly one and that each
platform SHA-256 matches the published asset. After uploading, the
`latest/download/` URL needs ~20-40 s of CDN propagation before it returns 200 —
retry rather than assuming the upload failed. Contract: `docs/development/sprints/sprint-42-unified-update-platform/research/update-feed-contract.md`.

If feed/metadata is stale or missing, the release is BLOCKED — even if binaries are uploaded.

### Step 9 — Post-release

1. Surface to user: "Recommend invoking `product-marketer` for changelog, release notes, landing-page copy."
2. **Issue sweep.** `gh issue list --repo ProductoryHQ/ritemark-native --state open`; map every open issue against the shipped scope; verify that each `Fixes #NNN` auto-close actually happened; close what the release genuinely resolved with a comment naming the version. Do not close partial or reputation-dependent issues (Windows Smart App Control, #130, is the standing example) — surface those to Jarmo.
3. Run the release closeout (Step 10). A release whose worktree is still `BLOCKED` for build output is not finished.
4. **Model catalog feed.** Refresh the feed only if it was edited by hand since the last release; see **Claude Code and model currency** below.

### Step 10 — Release closeout (reclaim the release worktree)

A shell release leaves the release worktree holding everything it built. For
v1.10.1 that was 15.7 GB four days after publication: `dist/` 3.2 GB,
`VSCode-darwin-arm64/` 2.0 GB, `VSCode-darwin-x64/` 2.1 GB, and the physical
`vscode/` submodule 6.6 GB. `worktree-hygiene.mjs` classifies any worktree with
a non-empty `dist/` or `VSCode-<target>/` as `BLOCKED — build output present …
publish or move it before removing`, and that verdict never lifts on its own.
The closeout is the "publish or move" the classifier asks for: prove the
published copies are the built bytes, keep the evidence that exists only on
this disk, then delete the output. Removing the worktree itself stays Jarmo's
call, and `--clean` is not part of this step.

Run it after Step 9 for every full release, on the Mac that built it (the
commands use BSD `stat -f%z`). It needs `gh` authenticated as
`jarmo-productory`.

#### 10.1 Verify every published asset against local `dist/`

GitHub computes a SHA-256 digest for every release asset, so nothing has to be
downloaded again. Recompute the local hashes — never trust the sidecars alone —
and diff the two lists. An empty diff is the pass condition.

```bash
cd .worktrees/release-<commit>          # the release worktree, not the main checkout
V=X.Y.Z; TAG=v$V; REPO=jarmo-productory/ritemark-public
T=$(mktemp -d)

# Published: GitHub's own digest + size per asset
gh api repos/$REPO/releases/tags/$TAG \
  --jq '.assets[] | "\(.digest | ltrimstr("sha256:"))  \(.size)  \(.name)"' | sort -k3 > "$T/published.txt"

# Local: recomputed from the bytes in dist/
for f in Ritemark-arm64.dmg Ritemark-x64.dmg Ritemark-Setup.exe update-feed.json; do
  printf '%s  %s  %s\n' "$(shasum -a 256 "dist/$f" | cut -d' ' -f1)" "$(stat -f%z "dist/$f")" "$f"
done | sort -k3 > "$T/local.txt"

diff "$T/published.txt" "$T/local.txt"        # must print nothing

# Canonical feed: the per-version copy must name exactly these hashes and sizes
curl -fsSL "https://github.com/$REPO/releases/download/$TAG/update-feed.json" -o "$T/feed-versioned.json"
node -e 'const f=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
  const r=f.fullReleases.find(x=>x.version===process.argv[2]);
  if(!r){console.error("version missing from feed");process.exit(1)}
  for(const p of r.platforms)console.log(`${p.sha256}  ${p.size}  ${p.assetName}`)' \
  "$T/feed-versioned.json" "$V" | sort -k3 > "$T/feed.txt"
diff "$T/feed.txt" <(grep -v ' update-feed.json$' "$T/local.txt")   # must print nothing
cmp dist/update-feed.json "$T/feed-versioned.json"                    # must print nothing
gh api repos/$REPO/releases/latest --jq .tag_name                     # this tag, unless a newer release shipped since

# Build-time sidecars — CROSS-CHECK ONLY, not a gate. create-dmg.sh writes each
# .dmg.sha256 BEFORE notarize-dmg.sh staples the ticket into the DMG, and
# stapling changes the DMG's bytes — so on the standard flow the sidecars are
# pre-staple and will NOT match the published (stapled) DMG. A "differs" line
# here is expected, not a block. The Windows *-setup.sha256.txt is PowerShell
# CRLF, so strip CR before comparing.
cmp dist/win-ci/Ritemark-Setup.exe dist/Ritemark-Setup.exe        # the staged installer is the CI artifact
for h in $(cut -d' ' -f1 dist/*.dmg.sha256 | tr -d '\r') $(sed -n 's/^sha256=//p' dist/win-ci/Ritemark-Setup.sha256.txt | tr -d '\r'); do
  grep -q "^$h " "$T/local.txt" && echo "matches published    $h" || echo "differs (pre-staple?) $h"
done
```

The **blocking** checks are the three diffs: local `dist/` vs GitHub's published
digests, the canonical feed vs local, and `dist/update-feed.json` vs the
published feed. Any non-empty diff, a `cmp` difference, or a version absent from
the feed means the published release is not the built release — stop, report,
and clear nothing; the local copy may be the only correct one. A `null` digest
means GitHub has not computed one for that asset yet: download it and hash it
locally instead of skipping the check.

The sidecar loop is only a cross-check. Because create-dmg.sh writes the sidecar
before notarize-dmg.sh staples, a `differs` line on the standard flow is normal
and never blocks — the digest and feed diffs above already prove the published
bytes equal the local bytes. (v1.10.1, built the non-standard `ditto`/`hdiutil`
way, happened to match on 2026-09-14 with every blocking diff empty and the feed
byte-identical.)

`published.txt` is the authoritative published-hash record; keep `$T` until 10.2
has copied it.

#### 10.2 Archive the evidence that exists only locally

Durable location: **`docs/releases/vX.Y.Z/evidence/`, tracked in Git.** The
files are a few dozen kilobytes of hashes, JSON results, and the feed. A
Git-ignored archive directory was considered and rejected: it would recreate
the problem being solved (one copy, one disk, invisible to `git status`).
Nothing in these files is secret, and the repository is periodically public,
so keep it that way — no logs carrying machine-specific paths, no personal
data (`docs/microsoft-store-submission/evidence/README.md` has the standing
rule).

Commit from the **main checkout on a docs branch**, never from the release
worktree — it is detached at the frozen source commit and is about to be
deleted.

```bash
W=<absolute path of the release worktree>
E=docs/releases/v$V/evidence
mkdir -p "$E/win32-roundtrip"
cp "$W/dist/update-feed.json" "$E/"
cp "$W"/dist/*.dmg.sha256 "$E/"                                          # build-time (pre-staple) hashes
cp "$W/dist/win-ci/Ritemark-Setup.sha256.txt" "$E/Ritemark-$V-win32-x64-setup.sha256.txt"
cp "$W"/dist/win-ci/roundtrip-evidence/*result.json "$E/win32-roundtrip/"
cp "$W/VSCode-darwin-arm64/ritemark-extension-pre-sign.sha256" "$E/darwin-arm64-extension-pre-sign.sha256"
cp "$W/VSCode-darwin-x64/ritemark-extension-pre-sign.sha256"   "$E/darwin-x64-extension-pre-sign.sha256"
cp "$T/published.txt" "$E/published-assets.txt"   # authoritative post-staple published hashes
```

What is deliberately left out:

- The DMGs and the installer — the GitHub Release is their archive, and 10.1
  just proved it holds the same bytes. Partner Center and `getritemark.com`
  take that same file; neither needs the local copy.
- `win-ci/roundtrip-evidence/*.log` — about 9 MB of Inno Setup install and
  uninstall logs, Git-ignored by `*.log`. Their outcomes are in the
  `.result.json` files, and the `ritemark-windows-installer` CI artifact keeps
  the full set for 30 days after the run.
- `x64-ci/` — empty once `extract-macos-x64-artifact.sh` has run.

Add `docs/releases/vX.Y.Z/evidence/closeout.md` recording, in a few lines: the
worktree path and source commit, the release URL and publish date, the Windows
CI run id, the 10.1 result (all diffs empty), and — added in 10.3 — the
post-clear verdict. Open the PR and **push before 10.3**: the evidence must
exist on `origin` before the local copy is deleted.

#### 10.3 Clear the build output, then re-audit

Only when 10.1 printed nothing and the 10.2 commit is pushed. Delete exactly
the output directories the `BLOCKED` line named — the two kinds of Git-ignored
output the classifier looks for — by name, inside the release worktree. This
deletes output, not the worktree.

```bash
cd "$W"
rm -rf dist VSCode-darwin-arm64 VSCode-darwin-x64
cd <main checkout>
node ./scripts/worktree-hygiene.mjs --check --no-sizes
```

Expected line for the release worktree:

```
REVIEW   …/.worktrees/release-<commit> — verified disposable release worktree ((detached))
```

That verdict needs the release marker (`ritemark-release-worktree.json` under
`.git/worktrees/<name>/`, written by `create-release-worktree.sh`) to name the
worktree's HEAD, the superproject to be clean, and HEAD to be an ancestor of
`origin/main`. If the line says anything else — still `BLOCKED`, or `KEEP` —
stop and report the reason verbatim. Do not pass `--force`, do not delete the
directory, do not argue with the classifier: a wrong verdict is a bug in
`scripts/worktree-hygiene.mjs`. Record the verdict line in `closeout.md` on
the open PR and merge it.

#### 10.4 Hand over — removal is Jarmo's

Report to Jarmo: the release worktree now classifies `REVIEW`, how much the
clear freed, and that `--clean` will also remove every other `REVIEW` entry in
the same audit (list them). Then wait.

- `node ./scripts/worktree-hygiene.mjs --clean` runs only after Jarmo says
  go. It calls `git worktree remove` on the exact path (`--force` only because
  the physical `vscode/` submodule requires it) and reclaims the remaining
  ~6.6 GB.
- Never run `--clean` yourself, never run it while another release is
  mid-flight, never override `BLOCKED`, never `rm -rf` or `git worktree
  remove` a worktree by hand.

## Workflow — Extension-only release (Sprint 93)

For changes confined to `extensions/ritemark/` — i.e. extension-tier per `CLAUDE.md`'s "Release Tiers" section. This codebase does **not** use `vsce`/`.vsix` packaging anywhere — that text was stale/aspirational from an earlier draft. The real mechanism is a per-file manifest + canonical update feed, matching `src/update/userExtensionInstaller.ts`'s download-per-file model.

1. Bump version in `extensions/ritemark/package.json` to `X.Y.Z-ext.N`.
2. `./scripts/release-extension.sh X.Y.Z-ext.N` — runs `release-extension-preflight.sh` first (clean tree, release-tier guard, `engines.vscode` check, compile-clean, webview-freshness, unshipped changes), then builds the manifest + files into `release-staging/upload/` and generates the canonical update feed via `generate-update-feed.mjs --mode extension`.
   If the preflight lists changes an extension release cannot deliver (a file outside the shipped set, or a package that loads from the app's `node_modules`), tell Jarmo in plain words that they arrive with the next full release and ask whether to ship without them. Only after his yes, re-run with `--allow-unshipped`, and name those changes in the release report.
3. Review `release-staging/upload/` — the script prints (does not auto-run) the exact `gh release create` command to publish.
   Also run `(cd extensions/ritemark && npm run check:anthropic-models)`. An extension release cannot change the bundled Claude Code, so an `ALERT` here does not block this release, but it goes to Jarmo in the release report. A Claude Code that has fallen behind needs a full release.
4. **Light gate, not the full Gate 1/Gate 2 process below:** Jarmo tests via the in-app "Relaunch to update" flow (or a local dev install pointed at the staged files) on the changed surfaces only, then gives the approval phrase. No notarization, no 60-min hardening wait, no Windows CI dispatch, no repo-visibility toggle — none of those apply to an extension-only release.
5. Only after Jarmo's approval: run the `gh release create` command the script printed, uploading the individual files from `release-staging/upload/` (never a `.vsix`).
6. No closeout step: an extension release is built in the main checkout and leaves no release worktree or multi-GB output behind.

See `docs/development/RELEASING.md` for the plain-language version Jarmo can follow without engineering background.

## Claude Code and model currency (Sprint 127)

Anthropic ties each new model to a minimum Claude Code version, and publishes both in its Claude Code model catalog. The catalog is at `https://downloads.claude.ai/model-catalog/v1/catalog.json`; Anthropic has not documented it. New Claude models therefore reach Ritemark users with a bundled Claude Code that supports them. Sprint 127 decision D4 is recorded in `docs/development/releases/v1.12.0/sprint-127-day-zero-models/research/anthropic-served-catalog.md`.

**1. The pre-release check** runs in every release: Step 0, and step 3 of the extension-only release.

```bash
cd extensions/ritemark && npm run check:anthropic-models
```

| Output | Meaning | What to do |
|---|---|---|
| `OK` | The bundled Claude Code supports every model in Anthropic's list. | Continue. |
| `WARNING: … not in Ritemark's bundled lineup` | Anthropic has a new `main` model that Ritemark's menu does not curate. | Add its id to `src/ai/modelConfig.ts` and a row to `bundledCatalog.ts` in this release, or tell Jarmo why not. |
| `ALERT: … needs Claude Code X or newer` | The bundled Claude Code is too old for a current model. | A full release updates Claude Code (step 2) or Jarmo defers explicitly. An extension release reports it. |
| `ALERT: … could not be read` / `not in the expected format` / `expired` | The catalog moved or changed. Users are not affected, because the app never reads it. | Fix `src/ai/modelCatalog/anthropicCatalogCheck.ts` and its test, or Jarmo accepts shipping without the check. |

**2. Updating the bundled Claude Code** is shell-tier, so it happens only in a full release. The worked example is the Sprint 127 2.1.281 section in `docs/development/agent-runtime-compatibility.md`.
- Pick npm `latest` of `@anthropic-ai/claude-code` and the Agent SDK patch with the same number (`2.1.N` ↔ `0.3.N`).
- Update the three `claude/runtime` rows in `extensions/ritemark/binaries/agents/manifest.json`: `version`, `sourceUrl`, `archiveFilename`, `npmIntegrity`, `sha256` and `installedSha256`. Measure every value from the npm tarballs; never type one in.
- Update the approved snapshots in `scripts/validate-agent-runtime-manifest.mjs` and its test.
- Run `npm install --save-exact @anthropic-ai/claude-agent-sdk@0.3.N` in `extensions/ritemark`.
- Verify:
  - `node scripts/validate-agent-runtime-manifest.mjs`
  - `node scripts/fetch-agent-runtimes.mjs --platform darwin --arch arm64 --agent claude --all-platforms`
  - `tsc` and the full `npm test`
  - the Sprint 127 probes (`research/probes/model-picker-probe.mjs`, `request-capture.mjs`)
  - `./scripts/verify-agent-runtimes.sh` on the release Mac
- Record the results in the compatibility matrix. Pre-commit check 11 requires it.

**3. Hand edits to the feed.** `feeds/model-catalog.json` in `jarmo-productory/ritemark-public` is optional and edited by hand. It adds or hides models without a release; it is the only remote channel for OpenAI, Gemini, Codex and OpenCode.
- Start every edit from the current lineup, so older apps that take a fresher feed as a whole stay correct:

  ```bash
  cd extensions/ritemark
  npx tsx scripts/export-bundled-model-catalog.ts --merge <ritemark-public>/feeds/model-catalog.json > /tmp/model-catalog.json
  cp /tmp/model-catalog.json <ritemark-public>/feeds/model-catalog.json
  ```

  Never redirect straight onto the file being merged, because the shell empties it before it is read. Bump `updatedAt` with every edit.
- To hide a model everywhere, set `"retired": true` on its row, and keep the row.
- A row may declare a model to Claude Code (`claudeCode.inject`) only when Anthropic's catalog gives that model no `min_claude_code_version`, or one the bundled Claude Code meets.

v1.12.0 gate: the check passes on the release source, and the build bundles Claude Code 2.1.281 with SDK 0.3.281.

## Gotchas

### Notarize DMG, not .app

`./scripts/notarize-dmg.sh` is the canonical script. `notarize-app.sh` is **deprecated** — using it bypasses Gatekeeper for DMG installs.

### Windows builds — public/private repo toggle

GitHub does NOT allow larger runners (windows-8core) on public repos. Before dispatching `build-windows.yml` (Step 5, `gh workflow run`), switch repo to private. After the Windows build completes, switch back to public. Without the toggle, the Windows build fails with a billing/permissions error. (A separate `windows-canary.yml` runs weekly on the FREE `windows-latest` standard runner — no toggle needed — to catch runner-image toolchain breakage early; see W4.)

### Node version + architecture

Production builds require **arm64 Node at the version pinned by `vscode/.nvmrc`**. A machine default or Rosetta/x64 Node is not a release input. Always use the `arch -arm64 /bin/zsh` invocation and `nvm use "$(cat vscode/.nvmrc)"`.

### x64 from CI, never cross-compiled

x64 macOS builds come from GitHub Actions (`build-macos-x64.yml`), not from cross-compiling on arm64. Cross-compiling produces broken arm64-tainted x64 binaries.

### Build output buffering

NEVER pipe `./scripts/build-prod.sh` through `| tail` or `| head` — buffering hangs in background mode. Run as background task with full timeout.

### `gulp vscode-darwin-arm64` is not enough

Direct `gulp` skips the extension copy step → broken app. ALWAYS use `./scripts/build-prod.sh`.

### Extension-only hot-copy (skips full rebuild)

For changes confined to extension code:

```bash
cp -R extensions/ritemark/out/* "VSCode-darwin-arm64/Ritemark Native.app/Contents/Resources/app/extensions/ritemark/out/"
```

This is development-only. A hot-copied app has invalid provenance and must
never be signed, packaged, or described as an RC.

### Release worktree holds the only copy of the artifacts — until closeout

Between the DMG build and the GitHub Release, `dist/` in the release worktree
holds the only copies of the notarized DMGs and the signed Windows installer.
`worktree-hygiene.mjs` accounts for that: a non-empty `dist/` or
`VSCode-<target>/` classifies the worktree `BLOCKED — build output present …
publish or move it before removing`, whatever `git status` says. (During the
v1.10.0 publish the classifier still reported such a worktree as removable;
that was fixed, and the removable verdict is now spelled `REVIEW`.) The block
does not lift by itself — Step 10 is what verifies the published copies,
archives the evidence, and clears the output, after which the same worktree
classifies `REVIEW — verified disposable release worktree`.

Nothing scheduled ever runs `--clean`. The weekly `ritemark-worktree-report`
task and the `worktree-janitor` agent run `--report` and deliver it; removal
happens only after Jarmo has read a report and said so
(`docs/development/release-process/BUILD-AND-WORKTREE-HYGIENE.md`). **Never
run `--clean` while a release is mid-flight** — it removes every `REVIEW`
worktree in the audit, not only the one you meant — and never get past a
`BLOCKED` verdict by deleting the directory yourself.

### Clean build and worktree contract

The authoritative contract is
`docs/development/release-process/BUILD-AND-WORKTREE-HYGIENE.md`.

- Audit after merge/close, at sprint close, before RC creation, and weekly:
  `node ./scripts/worktree-hygiene.mjs --check`.
- `--clean` is human-authorized: Jarmo reads the report and says go. Never
  override `BLOCKED`, never recurse-delete a worktree by hand.
- A published release worktree is reclaimed through Step 10 (closeout), never
  by deleting it directly.
- Every RC begins with `./scripts/create-release-worktree.sh`.
- `codesign-app.sh` and `create-dmg.sh` refuse missing or mismatched provenance.
- Any source change or rebuild creates a new candidate and resets the relevant gate.

## Past incidents (institutional memory)

### v1.0.1 — broken DMG (2026-01-14)

Three root causes compounded:

1. **`node_modules` stripped from extension during DMG copy** → TipTap webview wouldn't load. When copying the extension to the app bundle, only remove `webview/node_modules` and `webview/src`. NEVER remove `extensions/ritemark/node_modules` — those are runtime dependencies. Hard check 7 (node_modules has 100+ packages) catches this regression.
2. ~~**`Info.plist` version not updated**~~ — **RETRACTED (2026-05-12).** `Info.plist CFBundleShortVersionString` always shows the VS Code base version (e.g. `1.117.0`) for ALL Ritemark releases — this is expected and correct. Ritemark's version is authoritative only in `product.json` (`ritemarkVersion`). The About dialog and update system (`versionService.ts`) both read from `product.json`, not `Info.plist`. Do NOT run PlistBuddy to patch the bundle version; do NOT flag this in release audits.
3. **0-byte source file corruption** (random source files became 0 bytes — TS, SVG, configs, even node_modules type defs). Detection: `find extensions/ritemark/src -name "*.ts" -size 0`. Fix: `git checkout HEAD -- extensions/ritemark/`, reinstall node_modules, rebuild webview. Root cause unconfirmed (disk / sync tool / system process).

### v1.7.1 — corruption + incremental tsc trap (2026-05-25)

Rebuilding v1.7.1 after the same 0-byte corruption pattern produced a DMG that installed cleanly but the editor was blank — Ritemark extension failed to activate with `'ritemark.ritemark' failed: Invalid or unexpected token`.

Root cause: when corruption zeroes `.js` files in `extensions/ritemark/out/`, **`git checkout HEAD -- extensions/ritemark/` does not restore them** because `out/` is gitignored. The subsequent build then runs `tsc -p ./` in incremental mode (`.tsbuildinfo` cache). tsc sees the `.ts` source unchanged vs. the cache, decides nothing needs recompilation, and leaves the 0-byte `.js` files in place. `build-prod.sh` copies the broken extension into the app bundle. Pre-flight only checks `extension.js` and `ritemarkEditor.js` sizes, not the deep tree, so the broken DMG passes Gate 1's automated checks.

At runtime, VS Code loads `extension.js` (non-empty), which `require()`s `./codex/codexManager` (0 bytes) → V8 throws "Invalid or unexpected token" → entire Ritemark extension fails to activate → editor pane blank.

**Detection (run after any corruption restore, before rebuild):**

```bash
find extensions/ritemark/out -type f -size 0 -name "*.js" | wc -l    # should be 0
find VSCode-darwin-arm64/Ritemark.app/Contents/Resources/app/extensions/ritemark/out -type f -size 0 -name "*.js" | wc -l    # should be 0 after build
```

**Fix:**

```bash
cd extensions/ritemark && rm -rf out && npm run compile    # forces tsc to rebuild every .js
```

Then re-run `build-prod.sh`. Don't trust tsc incremental after a corruption event — the `.tsbuildinfo` cache is now lying.

**Rule:** any time you've restored corrupted files via `git checkout`, treat `extensions/ritemark/out/` as poisoned and force a clean recompile before the production build.

### Quick comparison test

When TipTap doesn't load, mount the working previous DMG and the broken new DMG side-by-side, then `diff` the extension folder listings:

```bash
hdiutil attach dist/Ritemark-1.0.0-darwin-arm64.dmg -mountpoint /tmp/v100
hdiutil attach dist/Ritemark-1.0.1-darwin-arm64.dmg -mountpoint /tmp/v101
diff <(ls /tmp/v100/Ritemark.app/Contents/Resources/app/extensions/ritemark/) \
     <(ls /tmp/v101/Ritemark.app/Contents/Resources/app/extensions/ritemark/)
hdiutil detach /tmp/v100; hdiutil detach /tmp/v101
```

### Key takeaways

1. Never strip `node_modules` from the extension — runtime, not dev-only.
2. Always update `Info.plist` version (Finder reads it, not product.json).
3. Compare with the last working build when debugging — diff reveals missing pieces fast.
4. Watch for 0-byte files (corruption signal); restore from git.
5. Test the actual DMG, not just the source app bundle.
6. After any corruption restore: `rm -rf extensions/ritemark/out && npm run compile` before `build-prod.sh`. Incremental tsc will silently keep 0-byte `.js` artifacts otherwise (v1.7.1).

### v1.11.0 — three latent CI defects, and a self-inflicted fourth (2026-09-16)

None of the three came from the release's own content. All three would have
hit the next Windows release whatever shipped in it; v1.11.0 was simply the
first Windows build after the runner image and the signing path had moved.

| # | Defect | Where the lesson already was |
|---|---|---|
| 1 | `file(1)` said "8 sections"; the manifest pattern was an exact substring | This skill's catalogue, from v1.6.3 — described, never enforced |
| 2 | `validate-build-output.sh` used `verify /pa`; the PowerShell verifier used `/pa /all` | Nowhere |
| 3 | Git Bash rewrote `/pa` and `/all` into file paths | `ritemark-visual-regression` skill — the **wrong skill**, so the release path never saw it |

The fourth was mine: merging the candidate record to `main` between the build
and the CI dispatch, which invalidated a completed, **already notarized** arm64
candidate. Hence the freeze rule at the top of this document.

Two things are worth carrying forward beyond the individual fixes.

**A lesson written in the wrong place is not written down.** Defect 3 had been
documented for months, in a skill about visual-regression testing. Release work
never loads that skill. It is now in this catalogue *and* enforced in code.

**Describing a pitfall is weaker than enforcing it.** Defects 1 and 3 were both
described somewhere and both still happened. They are now a test and an
environment variable respectively; defect 2's root cause was only findable
because the failure stopped swallowing stderr.

## CI workflow editing — pre-push audit (HARD RULE)

Before editing ANY GitHub Actions workflow file (`.github/workflows/*.yml`), follow this checklist. Skipping it costs 20–30 min per CI iteration; v1.6.3 burned ~5 hours across 5 commits because the checklist wasn't followed.

### Mandatory pre-edit audit

1. **Read the ENTIRE workflow file end-to-end first.** Not just the failing step. Map every step:
   - Does the step run **inline shell** in YAML, or call **a script** in `scripts/`?
   - Is similar logic **duplicated** between inline YAML and a script? (Hidden drift hazard.)
2. **Compare cross-platform workflow pairs.** When changing one workflow, also read the sibling. Differences between `build-macos-x64.yml` and `build-windows.yml` are often where bugs hide:
   - macOS step succeeds where Windows fails because Mac runner is more lenient (symlinks, line endings, `file(1)` format).
   - x64 macOS workflow may be missing a step the arm64 build does locally.
3. **For every fix:** before pushing, answer aloud "What code path runs in the failing step?" then verify your edit lands in that exact file. If the failing step is `inline:`, editing a `scripts/` file fixes nothing.
4. **Bash + YAML syntax checks before commit:**
   ```bash
   bash -n scripts/foo.sh
   python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build-windows.yml'))"
   ```
5. **Where possible, run the same command path locally.** E.g. `./scripts/validate-build-output.sh win32-x64` works on Mac (it's cross-host pre-flight aware) — surfaces script bugs before the 25-min CI run does.

### Cross-platform CI pitfalls catalogue (Windows vs macOS runners)

| Pitfall | Symptom | Fix |
|---|---|---|
| **Python `print()` emits CRLF on Windows pipes** | `bash read -r IFS="|"` reads `tar.gz\r` (length 7) → `case` doesn't match | `sys.stdout.reconfigure(newline="\n")` after `import sys`, AND strip `${var%$'\r'}` on bash side (belt-and-braces) |
| **Git Bash `cp -R` cannot replicate macOS symlinks** | `cp: cannot create symbolic link '...libggml-base.0.dylib'` | Strip `binaries/darwin-*/` BEFORE `cp -R` on Windows runners. NEVER remove that line without solving symlinks first. |
| **`file(1)` output format drift across MSYS / Git Bash / libmagic versions** | `grep -qF "PE32+ …"` misses runner output `"PE32+ executable for MS Windows 6.00 (console), x86-64, 7 sections"` — v1.11.0 saw the same runner say **8 sections** | **ENFORCED (v1.11.0):** `architectureTokens()` in `scripts/fetch-agent-runtimes.mjs` requires only the format and architecture tokens, in any order, with a magic-byte fallback. `scripts/fetch-agent-runtimes.test.mjs` carries the real runner output from both incidents plus negative cases, so the next drift fails a test rather than a release. |
| **`stat -f%z` (BSD) returns 0 on Git Bash; GNU expects `-c%s`** | size gates fail on valid build outputs | `file_size()` helper trying `-f%z` then `-c%s` then `wc -c`. |
| **`python3` not always on Windows PATH; only `python`** | `command not found` mid-script | Probe `for py in python3 python; do ...; done` and use the first hit. |
| **Inline YAML duplicates a script's logic** | Fix to script doesn't reach CI because workflow inlines its own copy | Single source of truth: delete inline, call the script. Two places = drift. |
| **Two scripts verifying the same thing in different languages** | v1.11.0: `verify-windows-signatures.ps1` passed with `signtool verify /pa /all` while `validate-build-output.sh` called `verify /pa` and reported every executable unsigned | The row above, one layer down. Align the invocations, or have the bash side call the PowerShell one. |
| **Git Bash rewrites arguments that look like POSIX paths** | v1.11.0: `signtool verify /pa /all` arrived as `… C:/Program Files/Git/pa C:/Program Files/Git/all`; with the policy flag eaten, signtool fell back to the stricter driver policy and rejected the Azure Trusted Signing chain, so correctly-signed binaries all read as unsigned | **ENFORCED (v1.11.0):** `MSYS_NO_PATHCONV=1` on the signtool call in `validate-build-output.sh` — the only bash caller of a Windows tool with slash flags. Prefix any new one. |
| **Discarding a verification tool's stderr** | `signtool … > /dev/null 2>&1` turned "the flags were eaten and the chain is untrusted" into "not signed or invalid signature" — indistinguishable from a genuinely unsigned binary, costing a full diagnosis cycle | Never swallow a verification tool's output on the failure path. Print it. The fix for the row above was found the moment the real message appeared. |
| **Tag `--force` retriggers ALL `tag: 'v*'` workflows** | Earlier in-progress runs become wasted artifacts | Plan tag moves: only re-tag once per commit you actually want shipped. |
| **gh auth account drift** | `HTTP 404 Not Found` on a repo that exists | `gh auth status` to check active account. Switch with `gh auth switch --user <handle>`. ProductoryHQ repos need `jarmo-productory`. |

### Architecture rule: validation lives in scripts, not YAML

Validation logic for a build artifact (size checks, manifest cross-refs, arch verification, signing checks) MUST live in `scripts/validate-build-output.sh` (or a sibling). Workflows call the script. Workflows do not duplicate the logic inline.

Why: when the validation rule changes (e.g. `file(1)` format drift), the fix is one commit in one file. If the logic is duplicated inline in YAML, the fix may land in the script while CI still runs the stale inline copy — exact failure mode that cost 4 commits in v1.6.3.

When you find inline validation in a workflow, the right move is **replace inline with `./scripts/validate-build-output.sh <target>`** — preserves Layer 2 fallbacks, single source of truth, smaller workflow file.

### v1.6.3 post-mortem (for future reference)

| Commit | Intent | What broke after | Lesson |
|---|---|---|---|
| A `956665b` | Strip foreign agent platforms from .app | Removed `rm -rf binaries/darwin-arm64` thinking it was a buggy dictation strip; it was actually a Windows symlink workaround | Don't remove "looks wrong" lines without testing on the platform that step actually runs on |
| B `f7cbe10` | Fix CRLF in Python→bash pipe | Hit the symlink regression from Commit A | Always read end-to-end before pushing — would have caught both at once |
| C `82174be` | Restore Windows symlink-strip with comment | Hit `file(1)` format drift in arch check | Reading full workflow earlier would have flagged inline arch check |
| D `7dc66e5` | Add Layer 2 fallback in `validate-build-output.sh` | Windows CI didn't call the script — has its own inline check | Always verify the fix lands in the failing code path |
| E `ef99417` | Replace inline arch check with script call | ✅ Both runs green | Single source of truth |

If v1.6.3 had run the pre-edit audit, Commits A→D would have collapsed into a single first-pass commit that read both workflows fully, identified all the platform-specific quirks, and shipped one consolidated fix.

## References

- Update feed contract: `docs/development/sprints/sprint-42-unified-update-platform/research/update-feed-contract.md`
- Test checklist template: `docs/releases/vX.Y.Z/TEST-CHECKLIST.md` (per-release)
- Pre-flight script: `scripts/release-preflight.sh`
- Build script: `scripts/build-prod.sh`
- Sign + DMG + notarize: `scripts/codesign-app.sh`, `scripts/create-dmg.sh`, `scripts/notarize-dmg.sh`
- Validation script: `scripts/validate-build-output.sh` (cross-platform aware: `darwin-arm64` / `darwin-x64` / `win32-x64`)
- Release closeout evidence: `docs/releases/vX.Y.Z/evidence/` (per-release, written by Step 10)
- Worktree hygiene contract: `docs/development/release-process/BUILD-AND-WORKTREE-HYGIENE.md`

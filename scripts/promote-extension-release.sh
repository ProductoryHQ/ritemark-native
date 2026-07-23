#!/bin/bash
#
# promote-extension-release.sh - Move a verified extension release from the canary
# ring to the public feed, or take one back out.
#
# Sprint 98 (issue #142). Ext releases publish as a GitHub PRERELEASE and land in
# the canary feed only. The public `latest` feed is untouched until this script
# runs — so "published" and "rolled out" are two separate, human-gated events.
#
# HARD RULE: this script NEVER deletes a GitHub release, in either direction. The
# 1.8.3-ext.1 incident is the reason — a withdrawn release still carries data
# (download counts, the exact assets users have on disk) that is needed to support
# the people affected by it. Rollback removes the FEED ENTRY, nothing else.
#
# Usage:
#   ./scripts/promote-extension-release.sh <version> [--force] [--dry-run]
#   ./scripts/promote-extension-release.sh --rollback <version> [--dry-run]
#
#   <version>     e.g. 1.8.5-ext.1 (no leading v)
#   --force       promote even if the public feed already has this version
#   --dry-run     show the resulting feed and the gh command; upload nothing
#
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

REPO_OWNER="jarmo-productory"
REPO_NAME="ritemark-public"
REPO="$REPO_OWNER/$REPO_NAME"

VERSION=""
MODE="promote"
FORCE=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rollback) MODE="rollback"; shift ;;
    --force) FORCE=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help) sed -n '2,22p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) echo -e "${RED}Unknown argument: $1${NC}"; exit 1 ;;
    *) VERSION="$1"; shift ;;
  esac
done

fail() {
  echo -e "${RED}FAILED${NC}: $1"
  exit 1
}
ok() {
  echo -e "${GREEN}OK${NC}: $1"
}

[[ -n "$VERSION" ]] || fail "version argument required (e.g. 1.8.5-ext.1)"
VERSION="${VERSION#v}"
command -v gh >/dev/null 2>&1 || fail "gh CLI not found"

echo "========================================"
if [[ "$MODE" == "promote" ]]; then
  echo "Promote extension release v$VERSION → public feed"
else
  echo "Roll back extension release v$VERSION from public feed"
fi
echo "========================================"
echo "Repo: $REPO"
echo ""

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ritemark-promote.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT INT TERM

# -----------------------------------------------------------------------------
# The current `latest` release is where the PUBLIC feed asset lives. Resolve it
# rather than hardcoding a tag — it moves with every full release.
# -----------------------------------------------------------------------------
LATEST_TAG=$(gh release view --repo "$REPO" --json tagName -q .tagName 2>/dev/null || true)
[[ -n "$LATEST_TAG" ]] || fail "could not resolve the current 'latest' release of $REPO"
ok "public feed lives on release $LATEST_TAG"

PUBLIC_FEED="$WORK_DIR/public-feed.json"
CANARY_FEED="$WORK_DIR/canary-feed.json"
OUTPUT_FEED="$WORK_DIR/update-feed.json"

fetch_feed() {
  # $1 = url OR local path (local paths are a testing hook, see below), $2 = dest
  if [[ -f "$1" ]]; then
    cp "$1" "$2"
    return 0
  fi
  curl -fsSL -H 'User-Agent: Ritemark-Release' -o "$2" "$1"
}

# Feed URLs come from generate-update-feed.mjs so the two never drift apart.
# RITEMARK_{STABLE,CANARY}_FEED_URL accept a URL or a local file path and exist
# so this script's merge logic can be exercised against fixtures without
# touching the live feeds.
PUBLIC_URL="${RITEMARK_STABLE_FEED_URL:-$(node --input-type=module -e "
  const { CHANNELS } = await import('file://$SCRIPT_DIR/generate-update-feed.mjs');
  console.log(CHANNELS.stable);
")}"
CANARY_URL="${RITEMARK_CANARY_FEED_URL:-$(node --input-type=module -e "
  const { CHANNELS } = await import('file://$SCRIPT_DIR/generate-update-feed.mjs');
  console.log(CHANNELS.canary);
")}"

fetch_feed "$PUBLIC_URL" "$PUBLIC_FEED" || fail "could not fetch the public feed at $PUBLIC_URL"
ok "public feed fetched"

if [[ "$MODE" == "promote" ]]; then
  fetch_feed "$CANARY_URL" "$CANARY_FEED" || fail "could not fetch the canary feed at $CANARY_URL — has an ext release been published to the canary ring yet?"
  ok "canary feed fetched"
else
  echo '{"extensionReleases":[]}' > "$CANARY_FEED"
fi

# -----------------------------------------------------------------------------
# Merge / remove. Everything the feed already contains is preserved verbatim;
# only the one extensionReleases entry moves.
# -----------------------------------------------------------------------------
node --input-type=module -e "
  import fs from 'fs';
  const { sortByVersionDesc } = await import('file://$SCRIPT_DIR/generate-update-feed.mjs');

  const mode = '$MODE';
  const version = '$VERSION';
  const force = $FORCE;

  const publicFeed = JSON.parse(fs.readFileSync('$PUBLIC_FEED', 'utf-8'));
  const canaryFeed = JSON.parse(fs.readFileSync('$CANARY_FEED', 'utf-8'));

  publicFeed.extensionReleases = publicFeed.extensionReleases ?? [];
  const already = publicFeed.extensionReleases.find(r => r.version === version);

  if (mode === 'promote') {
    const entry = (canaryFeed.extensionReleases ?? []).find(r => r.version === version);
    if (!entry) {
      console.error(\`  ✗ v\${version} is not in the canary feed. Publish it to the canary ring first — promotion is never the first place a release appears.\`);
      process.exit(2);
    }
    if (already && !force) {
      console.error(\`  ✗ v\${version} is already in the public feed. Re-run with --force if you intend to overwrite the entry.\`);
      process.exit(2);
    }
    if (!Array.isArray(entry.files) || entry.files.length === 0) {
      console.error(\`  ✗ canary entry for v\${version} lists no files — refusing to promote an empty release.\`);
      process.exit(2);
    }
    publicFeed.extensionReleases = sortByVersionDesc([
      entry,
      ...publicFeed.extensionReleases.filter(r => r.version !== version)
    ]);
    console.error(\`  promoting v\${version} (\${entry.files.length} files)\`);
  } else {
    if (!already) {
      console.error(\`  ✗ v\${version} is not in the public feed — nothing to roll back.\`);
      process.exit(2);
    }
    publicFeed.extensionReleases = publicFeed.extensionReleases.filter(r => r.version !== version);
    console.error(\`  removing v\${version} from the public feed\`);
  }

  publicFeed.schemaVersion = publicFeed.schemaVersion ?? 1;
  publicFeed.channel = 'stable';
  publicFeed.generatedAt = new Date().toISOString();
  publicFeed.fullReleases = publicFeed.fullReleases ?? [];

  fs.writeFileSync('$OUTPUT_FEED', JSON.stringify(publicFeed, null, 2) + '\n');
" || fail "feed merge refused (see reason above)"

ok "new public feed written"
echo ""
echo "extensionReleases in the new public feed:"
node -pe "JSON.parse(require('fs').readFileSync('$OUTPUT_FEED','utf-8')).extensionReleases.map(r => '  - ' + r.version).join('\n') || '  (none)'"
echo ""

# -----------------------------------------------------------------------------
# Publish. `gh release upload --clobber` replaces the asset in place.
# No release is created, edited, or deleted.
# -----------------------------------------------------------------------------
UPLOAD_CMD=(gh release upload "$LATEST_TAG" --repo "$REPO" --clobber "$OUTPUT_FEED")

if [[ "$DRY_RUN" == "true" ]]; then
  echo -e "${YELLOW}--dry-run: nothing uploaded.${NC}"
  echo "Would run: ${UPLOAD_CMD[*]}"
  echo "Resulting feed:"
  sed 's/^/  /' "$OUTPUT_FEED"
  exit 0
fi

echo "Uploading update-feed.json to $LATEST_TAG..."
"${UPLOAD_CMD[@]}" || fail "gh release upload failed — the public feed is unchanged"

echo ""
echo "========================================"
if [[ "$MODE" == "promote" ]]; then
  echo -e "${GREEN}PROMOTED: v$VERSION is now in the public feed${NC}"
else
  echo -e "${GREEN}ROLLED BACK: v$VERSION removed from the public feed${NC}"
  echo "The GitHub release itself was NOT deleted (deliberate — history and"
  echo "download counts are needed to support anyone who already installed it)."
fi
echo "========================================"
exit 0

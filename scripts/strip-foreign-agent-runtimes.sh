#!/usr/bin/env bash
# strip-foreign-agent-runtimes.sh — allowlist-based foreign-platform agent stripper
#
# Removes platform-arch directories under <ext-root>/binaries/agents/ that don't
# match the keep-platform/keep-arch combo. Allowlist-based: only well-known
# platform-arch dirs are eligible for deletion. Anything else (manifest.json,
# README, sidecar files, the dictation dylib tree at <ext-root>/binaries/<arch>/)
# is left untouched.
#
# Why this exists: Sprint 64 introduced bundled agent runtimes for all
# supported platforms in extensions/ritemark/binaries/agents/<platform>-<arch>/.
# When building for one target, foreign trees would otherwise be copied into
# the .app/installer, bloating the build by hundreds of MB.
#
# Usage:
#   ./scripts/strip-foreign-agent-runtimes.sh <ext-root> <keep-platform> <keep-arch>
#
# Example:
#   ./scripts/strip-foreign-agent-runtimes.sh \
#     VSCode-darwin-arm64/Ritemark.app/Contents/Resources/app/extensions/ritemark \
#     darwin arm64
#
# Idempotent: running again is a no-op. Missing dirs are not errors.

set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "usage: $0 <ext-root> <keep-platform> <keep-arch>" >&2
  echo "  keep-platform: darwin | win32" >&2
  echo "  keep-arch:     arm64  | x64" >&2
  exit 1
fi

EXT_ROOT="$1"
KEEP_PLATFORM="$2"
KEEP_ARCH="$3"

# Validate keep args (defence in depth — wrong args would silently leave
# nothing or strip everything).
case "${KEEP_PLATFORM}" in
  darwin|win32) ;;
  *)
    echo "ERROR: keep-platform must be 'darwin' or 'win32' (got: ${KEEP_PLATFORM})" >&2
    exit 1
    ;;
esac
case "${KEEP_ARCH}" in
  arm64|x64) ;;
  *)
    echo "ERROR: keep-arch must be 'arm64' or 'x64' (got: ${KEEP_ARCH})" >&2
    exit 1
    ;;
esac

KEEP_DIR="${KEEP_PLATFORM}-${KEEP_ARCH}"
AGENTS_DIR="${EXT_ROOT}/binaries/agents"

# Allowlist of known platform-arch dirs eligible for deletion. New targets must
# be added here explicitly — we never glob-delete unknown dirs.
KNOWN_TARGETS=(darwin-arm64 darwin-x64 win32-x64)

# Verify the keep-target is one we actually know about.
keep_known=false
for t in "${KNOWN_TARGETS[@]}"; do
  [[ "$t" == "${KEEP_DIR}" ]] && keep_known=true
done
if [[ "${keep_known}" != true ]]; then
  echo "ERROR: keep-target '${KEEP_DIR}' is not in the known-targets allowlist:" >&2
  printf '  %s\n' "${KNOWN_TARGETS[@]}" >&2
  exit 1
fi

# Missing agents/ dir is not an error — pre-Sprint-64 builds, or trees that
# never had bundled agents, simply have nothing to strip.
if [[ ! -d "${AGENTS_DIR}" ]]; then
  echo "strip-foreign-agent-runtimes: ${AGENTS_DIR} not present — nothing to strip"
  exit 0
fi

REMOVED_COUNT=0
KEPT_COUNT=0

for target in "${KNOWN_TARGETS[@]}"; do
  candidate="${AGENTS_DIR}/${target}"
  if [[ "${target}" == "${KEEP_DIR}" ]]; then
    if [[ -d "${candidate}" ]]; then
      echo "keep:   ${candidate}"
      KEPT_COUNT=$((KEPT_COUNT + 1))
    fi
    continue
  fi
  if [[ -d "${candidate}" ]]; then
    rm -rf "${candidate}"
    echo "strip:  ${candidate}"
    REMOVED_COUNT=$((REMOVED_COUNT + 1))
  fi
done

echo "strip-foreign-agent-runtimes: kept ${KEPT_COUNT} target(s), removed ${REMOVED_COUNT} foreign target(s)"

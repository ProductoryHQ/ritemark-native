#!/usr/bin/env bash
# fetch-agent-runtimes.sh — deterministic, manifest-driven agent runtime fetcher
# Reads extensions/ritemark/binaries/agents/manifest.json, downloads, sha256-verifies,
# extracts, and validates the agent runtime binaries for the target platform/arch.
#
# Usage:
#   ./scripts/fetch-agent-runtimes.sh [options]
#
# Options:
#   --platform <darwin|win32>   Target platform (default: host)
#   --arch <arm64|x64>          Target arch     (default: host)
#   --agent <codex|claude>      Filter to one agent (default: all)
#   --verify-only               Re-verify sha256 sidecars without re-downloading
#   --all-platforms             Iterate every manifest entry regardless of host
#   --help                      Show this usage message

set -euo pipefail

# ---------------------------------------------------------------------------
# Repo root — the script lives in scripts/, so parent is repo root
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MANIFEST="${REPO_ROOT}/extensions/ritemark/binaries/agents/manifest.json"

# ---------------------------------------------------------------------------
# Detect actual host platform/arch (always — used for cross-platform detection)
# ---------------------------------------------------------------------------
_uname_s="$(uname -s)"
case "${_uname_s}" in
  Darwin) HOST_PLATFORM="darwin" ;;
  MINGW*|MSYS*|CYGWIN*) HOST_PLATFORM="win32" ;;
  *)
    case "${OSTYPE:-}" in
      msys*|cygwin*|win32) HOST_PLATFORM="win32" ;;
      *) HOST_PLATFORM="darwin" ;;
    esac
    ;;
esac

_uname_m="$(uname -m)"
case "${_uname_m}" in
  arm64|aarch64) HOST_ARCH="arm64" ;;
  x86_64|amd64)  HOST_ARCH="x64"   ;;
  *)
    echo "ERROR: unsupported host arch: ${_uname_m}" >&2
    exit 1
    ;;
esac

# ---------------------------------------------------------------------------
# Defaults (target == host unless overridden)
# ---------------------------------------------------------------------------
TARGET_PLATFORM="${HOST_PLATFORM}"
TARGET_ARCH="${HOST_ARCH}"
OPT_AGENT=""
OPT_VERIFY_ONLY=false
OPT_ALL_PLATFORMS=false

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --platform)
      TARGET_PLATFORM="${2:-}"
      shift 2
      ;;
    --arch)
      TARGET_ARCH="${2:-}"
      shift 2
      ;;
    --agent)
      OPT_AGENT="${2:-}"
      shift 2
      ;;
    --verify-only)
      OPT_VERIFY_ONLY=true
      shift
      ;;
    --all-platforms)
      OPT_ALL_PLATFORMS=true
      shift
      ;;
    --help|-h)
      cat <<'USAGE'
fetch-agent-runtimes.sh — manifest-driven agent runtime fetcher

Usage:
  ./scripts/fetch-agent-runtimes.sh [options]

Options:
  --platform <darwin|win32>   Target platform (default: auto-detect from host)
  --arch <arm64|x64>          Target arch    (default: auto-detect from host)
  --agent <codex|claude>      Fetch only the named agent (default: all)
  --verify-only               Re-verify sha256 sidecars; fail if mismatched
  --all-platforms             Iterate every manifest entry (ignores platform/arch filter)
  --help                      Show this message

Examples:
  ./scripts/fetch-agent-runtimes.sh
  ./scripts/fetch-agent-runtimes.sh --agent codex
  ./scripts/fetch-agent-runtimes.sh --verify-only
  ./scripts/fetch-agent-runtimes.sh --platform win32 --arch x64 --agent codex
  ./scripts/fetch-agent-runtimes.sh --all-platforms
USAGE
      exit 0
      ;;
    *)
      echo "ERROR: unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Validate manifest exists
# ---------------------------------------------------------------------------
if [[ ! -f "${MANIFEST}" ]]; then
  echo "ERROR: manifest not found: ${MANIFEST}" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Python interpreter detection
# ---------------------------------------------------------------------------
# Windows runners and many Git Bash / PowerShell setups expose only `python`,
# not `python3`. macOS / Linux / Homebrew typically have both. Resolve once
# so manifest parsing works on every host the build runs on.
# (Codex review on PR #57: the Windows packaging gate would otherwise abort
# before fetching a single binary on a Windows host.)
PYTHON=""
for py in python3 python; do
  if command -v "$py" >/dev/null 2>&1; then
    PYTHON="$py"
    break
  fi
done
if [[ -z "${PYTHON}" ]]; then
  echo "ERROR: neither python3 nor python found in PATH" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# sha256 tool detection
# ---------------------------------------------------------------------------
if command -v shasum >/dev/null 2>&1; then
  SHA256_CMD="shasum -a 256"
elif command -v sha256sum >/dev/null 2>&1; then
  SHA256_CMD="sha256sum"
else
  echo "ERROR: neither shasum nor sha256sum found in PATH" >&2
  exit 1
fi

sha256_of_file() {
  local file="$1"
  ${SHA256_CMD} "${file}" | awk '{print $1}' | tr '[:upper:]' '[:lower:]'
}

# ---------------------------------------------------------------------------
# Temp dir with cleanup trap
# ---------------------------------------------------------------------------
TMPDIR_RUN="$(mktemp -d /tmp/fetch-agent-runtimes.XXXXXX)"
trap 'rm -rf "${TMPDIR_RUN}"' EXIT

# ---------------------------------------------------------------------------
# Parse manifest with python3 into a pipe-delimited stream for shell iteration
# Fields: agent|platform|arch|sourceUrl|archiveFilename|sha256|archivePath|
#         installName|validationArgs|expectedFileArchPattern|archiveFormat
# validationArgs is space-joined (e.g. "--help" or "--version")
# ---------------------------------------------------------------------------
ENTRIES_TSV="$("${PYTHON}" - "${MANIFEST}" <<'PYEOF'
import json, sys

manifest_path = sys.argv[1]
with open(manifest_path) as f:
    data = json.load(f)

for rt in data["runtimes"]:
    validation_args = " ".join(rt.get("validationArgs", []))
    row = "|".join([
        rt["agent"],
        rt["platform"],
        rt["arch"],
        rt["sourceUrl"],
        rt["archiveFilename"],
        rt["sha256"],
        rt["archivePath"],
        rt["installName"],
        validation_args,
        rt.get("expectedFileArchPattern", ""),
        rt.get("archiveFormat", "tar.gz"),
    ])
    print(row)
PYEOF
)"

if [[ -z "${ENTRIES_TSV}" ]]; then
  echo "ERROR: manifest parsed to empty entry list" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Process each entry
# ---------------------------------------------------------------------------
EXIT_CODE=0

while IFS="|" read -r \
    entry_agent entry_platform entry_arch \
    entry_source_url entry_archive_filename entry_sha256 \
    entry_archive_path entry_install_name \
    entry_validation_args entry_expected_arch_pattern entry_archive_format
do
  # --- Platform/arch filters ---
  if [[ "${OPT_ALL_PLATFORMS}" == false ]]; then
    [[ "${entry_platform}" == "${TARGET_PLATFORM}" ]] || continue
    [[ "${entry_arch}"     == "${TARGET_ARCH}"     ]] || continue
  fi
  if [[ -n "${OPT_AGENT}" ]]; then
    [[ "${entry_agent}" == "${OPT_AGENT}" ]] || continue
  fi

  LABEL="[${entry_agent}/${entry_platform}-${entry_arch}]"
  INSTALL_DIR="${REPO_ROOT}/extensions/ritemark/binaries/agents/${entry_platform}-${entry_arch}"
  INSTALL_DEST="${INSTALL_DIR}/${entry_install_name}"
  SIDECAR="${INSTALL_DEST}.sha256"

  # Cross-platform: compare entry against actual host (not requested target)
  IS_CROSS=false
  if [[ "${entry_platform}" != "${HOST_PLATFORM}" ]] || [[ "${entry_arch}" != "${HOST_ARCH}" ]]; then
    IS_CROSS=true
  fi

  # --- verify-only mode ---
  if [[ "${OPT_VERIFY_ONLY}" == true ]]; then
    echo "${LABEL} verifying installed binary..."
    if [[ ! -f "${INSTALL_DEST}" ]]; then
      echo "ERROR: ${LABEL} binary not installed at ${INSTALL_DEST} — run without --verify-only first" >&2
      EXIT_CODE=1
      continue
    fi
    if [[ ! -f "${SIDECAR}" ]]; then
      echo "ERROR: ${LABEL} sidecar missing at ${SIDECAR} — run without --verify-only first" >&2
      EXIT_CODE=1
      continue
    fi
    expected_binary_sha="$(awk '{print $1}' "${SIDECAR}" | tr '[:upper:]' '[:lower:]')"
    actual_binary_sha="$(sha256_of_file "${INSTALL_DEST}")"
    if [[ "${actual_binary_sha}" != "${expected_binary_sha}" ]]; then
      echo "ERROR: ${LABEL} sha256 mismatch" >&2
      echo "  expected (sidecar): ${expected_binary_sha}" >&2
      echo "  actual (on-disk):   ${actual_binary_sha}" >&2
      EXIT_CODE=1
    else
      echo "${LABEL} sha256 ok (${actual_binary_sha})"
    fi
    continue
  fi

  # --- Idempotence: skip if already installed with matching sidecar ---
  if [[ -f "${INSTALL_DEST}" ]] && [[ -f "${SIDECAR}" ]]; then
    stored_sha="$(awk '{print $1}' "${SIDECAR}" | tr '[:upper:]' '[:lower:]')"
    current_sha="$(sha256_of_file "${INSTALL_DEST}")"
    if [[ "${current_sha}" == "${stored_sha}" ]]; then
      echo "${LABEL} already installed and sha256 matches — skipping download"
      continue
    else
      echo "${LABEL} sha256 mismatch on existing binary — re-fetching..."
    fi
  fi

  # --- Download ---
  echo "${LABEL} downloading ${entry_archive_filename}..."
  DL_ARCHIVE="${TMPDIR_RUN}/${entry_archive_filename}"
  if ! curl -fL --retry 3 --retry-delay 2 -o "${DL_ARCHIVE}" "${entry_source_url}"; then
    echo "ERROR: ${LABEL} download failed for ${entry_source_url}" >&2
    EXIT_CODE=1
    continue
  fi

  # --- sha256 verification of archive ---
  echo "${LABEL} verifying archive sha256..."
  actual_archive_sha="$(sha256_of_file "${DL_ARCHIVE}")"
  expected_archive_sha="$(echo "${entry_sha256}" | tr '[:upper:]' '[:lower:]')"
  if [[ "${actual_archive_sha}" != "${expected_archive_sha}" ]]; then
    echo "ERROR: ${LABEL} archive sha256 mismatch" >&2
    echo "  expected: ${expected_archive_sha}" >&2
    echo "  actual:   ${actual_archive_sha}" >&2
    EXIT_CODE=1
    continue
  fi
  echo "${LABEL} archive sha256 ok"

  # --- Extraction ---
  echo "${LABEL} extracting..."
  TMP_EXTRACT="${TMPDIR_RUN}/extract-${entry_agent}-${entry_platform}-${entry_arch}"
  mkdir -p "${TMP_EXTRACT}"

  case "${entry_archive_format}" in
    tar.gz|tgz)
      tar -xzf "${DL_ARCHIVE}" -C "${TMP_EXTRACT}"
      ;;
    *)
      echo "ERROR: ${LABEL} unsupported archiveFormat: ${entry_archive_format}" >&2
      EXIT_CODE=1
      continue
      ;;
  esac

  # Locate extracted binary
  EXTRACTED_BIN="${TMP_EXTRACT}/${entry_archive_path}"
  if [[ ! -f "${EXTRACTED_BIN}" ]]; then
    echo "ERROR: ${LABEL} expected binary not found after extraction at ${EXTRACTED_BIN}" >&2
    echo "  archive contents:" >&2
    find "${TMP_EXTRACT}" -maxdepth 3 >&2 || true
    EXIT_CODE=1
    continue
  fi

  # --- Install ---
  mkdir -p "${INSTALL_DIR}"
  mv "${EXTRACTED_BIN}" "${INSTALL_DEST}"
  echo "${LABEL} installed at ${INSTALL_DEST}"

  # --- Write sidecar ---
  installed_sha="$(sha256_of_file "${INSTALL_DEST}")"
  echo "${installed_sha}  ${entry_install_name}" > "${SIDECAR}"

  # --- Post-install validation ---

  # chmod +x for POSIX targets
  if [[ "${entry_platform}" != "win32" ]]; then
    chmod +x "${INSTALL_DEST}"
    if [[ ! -x "${INSTALL_DEST}" ]]; then
      echo "ERROR: ${LABEL} chmod +x failed — binary is not executable" >&2
      EXIT_CODE=1
      continue
    fi
  fi

  # --- file(1) arch check ---
  if command -v file >/dev/null 2>&1; then
    FILE_OUT="$(file "${INSTALL_DEST}" 2>/dev/null || true)"
    if [[ -n "${entry_expected_arch_pattern}" ]]; then
      if echo "${FILE_OUT}" | grep -qF "${entry_expected_arch_pattern}"; then
        echo "${LABEL} arch check ok (${FILE_OUT})"
      else
        # Windows PE on macOS: file(1) may report "data" — fall back to MZ magic bytes
        if [[ "${entry_platform}" == "win32" ]]; then
          MAGIC="$(od -An -N2 -tx1 "${INSTALL_DEST}" | tr -d ' \n')"
          if [[ "${MAGIC}" == "4d5a" ]] || [[ "${MAGIC}" == "4d 5a" ]]; then
            echo "${LABEL} arch check: file(1) output '${FILE_OUT}' — confirmed PE via MZ magic bytes"
          else
            echo "ERROR: ${LABEL} file output does not match '${entry_expected_arch_pattern}' and MZ magic bytes missing" >&2
            echo "  file output: ${FILE_OUT}" >&2
            echo "  magic bytes: ${MAGIC}" >&2
            EXIT_CODE=1
            continue
          fi
        else
          echo "ERROR: ${LABEL} file output does not match expected pattern '${entry_expected_arch_pattern}'" >&2
          echo "  expected pattern: ${entry_expected_arch_pattern}" >&2
          echo "  file output:      ${FILE_OUT}" >&2
          EXIT_CODE=1
          continue
        fi
      fi
    fi
  else
    # file(1) unavailable — Windows PE MZ fallback
    if [[ "${entry_platform}" == "win32" ]]; then
      MAGIC="$(od -An -N2 -tx1 "${INSTALL_DEST}" | tr -d ' \n')"
      if [[ "${MAGIC}" == "4d5a" ]] || [[ "${MAGIC}" == "4d 5a" ]]; then
        echo "${LABEL} arch check: file(1) unavailable — confirmed PE via MZ magic bytes"
      else
        echo "ERROR: ${LABEL} file(1) unavailable and MZ magic bytes missing (got: ${MAGIC})" >&2
        EXIT_CODE=1
        continue
      fi
    else
      echo "${LABEL} WARNING: file(1) not available — skipping arch pattern check"
    fi
  fi

  # --- Smoke test (native binaries only; skip for cross-platform) ---
  if [[ "${IS_CROSS}" == true ]]; then
    echo "${LABEL} cross-platform fetch — skipping binary smoke test"
  else
    if [[ -n "${entry_validation_args}" ]]; then
      echo "${LABEL} validating with: ${entry_install_name} ${entry_validation_args}..."
      if "${INSTALL_DEST}" ${entry_validation_args} >/dev/null 2>&1; then
        echo "${LABEL} smoke test ok"
      else
        echo "ERROR: ${LABEL} smoke test failed: ${INSTALL_DEST} ${entry_validation_args} exited non-zero" >&2
        EXIT_CODE=1
        continue
      fi
    fi
  fi

  echo "${LABEL} done"

done <<< "${ENTRIES_TSV}"

if [[ ${EXIT_CODE} -eq 0 ]]; then
  echo "fetch-agent-runtimes: all done"
else
  echo "fetch-agent-runtimes: completed with errors (see above)" >&2
fi

exit ${EXIT_CODE}

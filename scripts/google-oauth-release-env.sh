# shellcheck shell=bash
# =============================================================================
# google-oauth-release-env.sh — Google OAuth client for release compiles
# (Sprint 119, Google Docs publishing). Sourced by the local release build
# scripts; the CI workflows pass the same variables from repository secrets.
#
#   source "$ROOT/scripts/google-oauth-release-env.sh"
#   ritemark_load_google_oauth_env
#
# Order: values already in the environment win (CI secrets); otherwise the two
# keys are read from $RITEMARK_RELEASE_ENV, default ~/.config/ritemark/release.env
# (outside every repo, mode 600). Only RITEMARK_GOOGLE_CLIENT_ID and
# RITEMARK_GOOGLE_CLIENT_SECRET are read — the file is never executed — and no
# value is ever printed. Sets RITEMARK_REQUIRE_GOOGLE_OAUTH=1, so the extension
# compile refuses to build without them.
# =============================================================================

ritemark_load_google_oauth_env() {
  local file="${RITEMARK_RELEASE_ENV:-$HOME/.config/ritemark/release.env}"
  local line key value

  if [ -z "${RITEMARK_GOOGLE_CLIENT_ID:-}" ] || [ -z "${RITEMARK_GOOGLE_CLIENT_SECRET:-}" ]; then
    if [ -f "$file" ]; then
      while IFS= read -r line || [ -n "$line" ]; do
        line="${line%$'\r'}"
        case "$line" in
          RITEMARK_GOOGLE_CLIENT_ID=*|RITEMARK_GOOGLE_CLIENT_SECRET=*)
            key="${line%%=*}"
            value="${line#*=}"
            # Trim surrounding whitespace and one pair of optional quotes.
            value="${value#"${value%%[![:space:]]*}"}"
            value="${value%"${value##*[![:space:]]}"}"
            case "$value" in
              \"*\") value="${value#\"}"; value="${value%\"}" ;;
              \'*\') value="${value#\'}"; value="${value%\'}" ;;
            esac
            if [ -z "${!key:-}" ]; then
              export "$key=$value"
            fi
            ;;
        esac
      done < "$file"
    fi
  fi

  export RITEMARK_REQUIRE_GOOGLE_OAUTH=1

  if [ -n "${RITEMARK_GOOGLE_CLIENT_ID:-}" ] && [ -n "${RITEMARK_GOOGLE_CLIENT_SECRET:-}" ]; then
    echo "Google OAuth client: provided (values not shown)"
  else
    echo "Google OAuth client: MISSING — set it in $file (see docs/development/RELEASING.md)" >&2
  fi
}

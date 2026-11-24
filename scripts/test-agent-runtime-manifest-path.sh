#!/usr/bin/env bash
set -euo pipefail

scripts="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fixture="$(mktemp -d)"
trap 'rm -rf "$fixture"' EXIT

# Exercise the verifier's shell function without launching any native runtimes.
sed -n '/^manifest_version() {/,/^}/p' "$scripts/verify-agent-runtimes.sh" > "$fixture/function.sh"
source "$fixture/function.sh"
export EXT="/d/Ritemark checkout/extensions/ritemark"
export FIXTURE_MANIFEST="$fixture/Node's manifest.json"
cat > "$fixture/cygpath" <<'SH'
#!/usr/bin/env bash
[[ "$1" == "-m" && "$2" == "$EXT/binaries/agents/manifest.json" ]] || exit 1
echo "$FIXTURE_MANIFEST"
SH
chmod +x "$fixture/cygpath"
export PATH="$fixture:$PATH"
cat > "$FIXTURE_MANIFEST" <<'JSON'
{"runtimes":[{"agent":"claude","component":"runtime","version":"1.2.3"},{"agent":"codex","version":"4.5.6","members":[{"component":"exec-server","version":"7.8.9"}]}]}
JSON
[[ "$(manifest_version claude runtime)" == "1.2.3" ]] || { echo "FAIL: runtime manifest lookup" >&2; exit 1; }
[[ "$(manifest_version codex exec-server)" == "7.8.9" ]] || { echo "FAIL: member manifest lookup" >&2; exit 1; }
echo "Git Bash manifest path passes both runtime and member versions to Node"

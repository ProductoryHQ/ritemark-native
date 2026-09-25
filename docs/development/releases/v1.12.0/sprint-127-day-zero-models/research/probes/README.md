# Sprint 127 probes

Re-runnable evidence for [model-visibility-audit.md](../model-visibility-audit.md). Every probe uses an isolated `HOME`/`CLAUDE_CONFIG_DIR` and no real credentials; the request capture answers every API call from a local server.

## Fetch the exact packages Ritemark bundles

The versions come from `extensions/ritemark/binaries/agents/manifest.json` and `extensions/ritemark/package.json`. Linux packages carry the same CLI code as the macOS and Windows builds.

```bash
mkdir -p /tmp/s127 && cd /tmp/s127
npm pack @anthropic-ai/claude-code-linux-x64@2.1.270 && tar xzf anthropic-ai-claude-code-linux-x64-2.1.270.tgz && mv package cli-2.1.270
npm pack @anthropic-ai/claude-agent-sdk@0.3.270 && tar xzf anthropic-ai-claude-agent-sdk-0.3.270.tgz && mv package sdk
```

Run the probes with a clean environment so the caller's Claude login cannot leak in:

```bash
P=docs/development/releases/v1.12.0/sprint-127-day-zero-models/research/probes
SDK=/tmp/s127/sdk/sdk.mjs CLI=/tmp/s127/cli-2.1.270/claude
```

## 1. Resolver reproduction (no packages needed)

```bash
npx -y tsx $P/resolver-repro.ts          # from the repository root
```

Output: [evidence/resolver-repro.txt](../evidence/resolver-repro.txt).

## 2. What the CLI lists — with and without `settings.modelPicker`

```bash
env -i PATH="$PATH" node $P/model-picker-probe.mjs --sdk $SDK --cli $CLI
env -i PATH="$PATH" node $P/model-picker-probe.mjs --sdk $SDK --cli $CLI \
  --picker '[{"model":"claude-opus-5-5","label":"Opus 5.5"}]'
```

Output: [evidence/supported-models-probes.json](../evidence/supported-models-probes.json).

## 3. Which request the CLI builds for a model it does not know

```bash
env -i PATH="$PATH" node $P/request-capture.mjs --sdk $SDK --cli $CLI --model claude-opus-5-5
env -i PATH="$PATH" node $P/request-capture.mjs --sdk $SDK --cli $CLI --model claude-opus-5-5 --max-output 64000
```

Output: [evidence/request-capture.json](../evidence/request-capture.json).

## 4. Which CLI version knows which model

```bash
for v in 2.1.270 2.1.278 2.1.280 2.1.281; do
  npm pack @anthropic-ai/claude-code-linux-x64@$v >/dev/null && tar xzf anthropic-ai-claude-code-linux-x64-$v.tgz
  printf '%s ' $v; grep -a -o 'claude-opus-5-5' package/claude | wc -l
  grep -a -o 'latest_per_family:{[^}]*}' package/claude | head -1
  rm -rf package anthropic-ai-claude-code-linux-x64-$v.tgz
done
```

Output: [evidence/cli-model-identity-scan.json](../evidence/cli-model-identity-scan.json).

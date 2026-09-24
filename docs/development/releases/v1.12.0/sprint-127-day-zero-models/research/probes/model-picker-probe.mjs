// Sprint 127 probe: what does the bundled CLI's supportedModels() return, with
// and without an SDK-injected `settings.modelPicker`?
//
//   node model-picker-probe.mjs --sdk <sdk.mjs> --cli <claude> \
//     [--picker '[{"model":"claude-opus-5-5","label":"Opus 5.5"}]']
//
// Runs unauthenticated in an isolated home: supportedModels() is answered from
// the CLI's own model table, so no API call is made.

import { isolatedEnv, loadSdk, parseArgs, pickerSettings, withTimeout } from './sdk-probe-common.mjs';

const args = parseArgs(process.argv.slice(2));
const { query } = await loadSdk(args.sdk);
const { home, env } = isolatedEnv();
const settings = pickerSettings(args.picker);

async function* noPrompt() {
  await new Promise(() => {});
}

const stream = query({
  prompt: noPrompt(),
  options: {
    cwd: home,
    pathToClaudeCodeExecutable: args.cli,
    settingSources: [],
    permissionMode: 'default',
    env,
    ...(settings ? { settings } : {}),
  },
});

try {
  const models = await withTimeout(stream.supportedModels(), 30_000, 'supportedModels');
  console.log(JSON.stringify({
    picker: settings?.modelPicker.options ?? null,
    rows: models.map((m) => ({
      value: m.value,
      resolvedModel: m.resolvedModel,
      displayName: m.displayName,
      supportedEffortLevels: m.supportedEffortLevels ?? null,
      supportsAdaptiveThinking: m.supportsAdaptiveThinking ?? false,
    })),
  }, null, 2));
} finally {
  stream.close?.();
}
process.exit(0);

// Sprint 127 probe: which /v1/messages request does the bundled CLI build for a
// given model id? A local HTTP server stands in for the API, records each
// request, and answers 400 — nothing leaves the machine and no real key is used.
//
//   node request-capture.mjs --sdk <sdk.mjs> --cli <claude> --model claude-opus-5-5 \
//     [--picker '[{"model":"claude-opus-5-5","label":"Opus 5.5","behavesAs":"claude-opus-5"}]'] \
//     [--max-output 64000]

import http from 'http';
import { isolatedEnv, loadSdk, parseArgs, pickerSettings } from './sdk-probe-common.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args.model) throw new Error('--model is required');
const { query } = await loadSdk(args.sdk);
const settings = pickerSettings(args.picker);

const captured = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    if (req.method === 'POST' && req.url.startsWith('/v1/messages') && !req.url.includes('count_tokens')) {
      try {
        const json = JSON.parse(body);
        captured.push({
          model: json.model,
          thinking: json.thinking ?? null,
          output_config: json.output_config ?? null,
          tool_choice: json.tool_choice ?? null,
          max_tokens: json.max_tokens,
          tools: (json.tools ?? []).length,
          betas: String(req.headers['anthropic-beta'] ?? '').split(',').filter(Boolean),
        });
      } catch {
        captured.push({ unparsed: body.slice(0, 200) });
      }
    }
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'captured by Sprint 127 probe' } }));
  });
});
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const port = server.address().port;

const { home, env } = isolatedEnv({
  ANTHROPIC_API_KEY: 'sk-ant-probe-not-a-real-key',
  ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`,
  // Keep first-party model handling even though the base URL is local.
  _CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL: '1',
  CLAUDE_CODE_MAX_RETRIES: '0',
  ...(args['max-output'] ? { CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(args['max-output']) } : {}),
});

const stream = query({
  prompt: 'Say hi.',
  options: {
    cwd: home,
    pathToClaudeCodeExecutable: args.cli,
    settingSources: [],
    permissionMode: 'default',
    model: args.model,
    maxTurns: 1,
    env,
    ...(settings ? { settings } : {}),
  },
});

const deadline = setTimeout(() => finish('timeout'), 60_000);
function finish(reason) {
  clearTimeout(deadline);
  console.log(JSON.stringify({
    model: args.model,
    picker: settings?.modelPicker.options ?? null,
    maxOutputEnv: args['max-output'] ?? null,
    reason,
    requests: captured,
  }, null, 2));
  try { stream.close?.(); } catch { /* best effort */ }
  server.close();
  process.exit(0);
}

try {
  for await (const message of stream) {
    if (message.type === 'result') break;
  }
} catch {
  // Expected: every captured request is answered with 400.
}
finish('done');

// Sprint 160 probe (#686): a local stand-in for the Gemini API that answers every call with Google's 429
// RESOURCE_EXHAUSTED body, so OpenCode's retries and Ritemark's card can be seen with no real key and
// nothing leaving the machine. Each request is logged as one JSON line (time, method, path, and only
// whether a key header came, never its value).
//
//   node fake-google-429.mjs --port 8790 --log /tmp/fake-google.jsonl [--no-time] [--retry-after 41]
//
// Point OpenCode at it with OPENCODE_CONFIG_CONTENT={"provider":{"google":{"options":{"baseURL":"http://127.0.0.1:8790/v1beta"}}}}.
// --no-time leaves out "Please retry in 41s." and RetryInfo; --retry-after adds an HTTP Retry-After header.

import fs from 'fs';
import http from 'http';

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const port = Number(value('--port', '8790'));
const log = value('--log', '');
const withTime = !args.includes('--no-time');
const retryAfter = value('--retry-after', '');

function body(model) {
  return JSON.stringify({
    error: {
      code: 429,
      message: 'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/usage?tab=rate-limit. \n'
        + `* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 10, model: ${model}`
        + (withTime ? '\nPlease retry in 41.143481245s.' : ''),
      status: 'RESOURCE_EXHAUSTED',
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
          violations: [{
            quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
            quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier',
            quotaDimensions: { location: 'global', model },
            quotaValue: '10',
          }],
        },
        { '@type': 'type.googleapis.com/google.rpc.Help', links: [{ description: 'Learn more about Gemini API quotas', url: 'https://ai.google.dev/gemini-api/docs/rate-limits' }] },
        ...(withTime ? [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '41s' }] : []),
      ],
    },
  });
}

const started = Date.now();
const server = http.createServer((req, res) => {
  req.resume();
  req.on('end', () => {
    const model = /models\/([^:/?]+)/.exec(req.url ?? '')?.[1] ?? 'unknown';
    const entry = {
      at: new Date().toISOString(),
      sinceStartMs: Date.now() - started,
      method: req.method,
      path: (req.url ?? '').replace(/([?&]key=)[^&]*/, '$1<redacted>'),
      keyHeader: Boolean(req.headers['x-goog-api-key']),
    };
    if (log) fs.appendFileSync(log, `${JSON.stringify(entry)}\n`);
    else console.log(JSON.stringify(entry));
    res.writeHead(429, {
      'content-type': 'application/json; charset=UTF-8',
      ...(retryAfter ? { 'retry-after': retryAfter } : {}),
    });
    res.end(body(model));
  });
});
server.listen(port, '127.0.0.1', () => console.log(`fake Google 429 on http://127.0.0.1:${port}/v1beta (${withTime ? 'with' : 'without'} a time)`));

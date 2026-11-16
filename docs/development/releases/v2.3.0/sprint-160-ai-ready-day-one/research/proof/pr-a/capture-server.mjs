// Sprint 160, PR A: a local stand-in for the Anthropic API (the pattern of Sprint 127's request-capture.mjs).
//
//   node capture-server.mjs --port 18765 --out <requests.jsonl> [--placeholder sk-ant-test-...]
//
// A dev instance started with ANTHROPIC_BASE_URL=http://127.0.0.1:<port> sends Claude Code's requests here. Each one
// is recorded as a line: the time, method and path, and which key it carried: `placeholder` (the one the run saved,
// not a credential), `other`, or `none`. No other header value or body is kept besides the model's name. Every
// request under /v1/ is answered as Anthropic answers a wrong key: 401, authentication_error, "invalid x-api-key".
// Nothing leaves the machine.

import fs from 'node:fs';
import http from 'node:http';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const port = Number(option('port', '18765'));
const out = option('out');
const placeholder = option('placeholder', 'sk-ant-test-placeholder-0000');
if (!out) throw new Error('--out is required');

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    const key = req.headers['x-api-key'];
    let model = null;
    try { model = JSON.parse(body).model ?? null; } catch { /* not JSON */ }
    const line = {
      at: new Date().toISOString(),
      method: req.method,
      path: (req.url ?? '').split('?')[0],
      xApiKey: key === undefined ? 'none' : key === placeholder ? 'placeholder' : 'other',
      authorization: req.headers.authorization ? 'present' : 'none',
      userAgent: String(req.headers['user-agent'] ?? '').split(' ')[0],
      model,
    };
    fs.appendFileSync(out, `${JSON.stringify(line)}\n`);
    if ((req.url ?? '').startsWith('/v1/')) {
      res.writeHead(401, { 'content-type': 'application/json', 'request-id': 'req_sprint160_capture' });
      res.end(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' }, request_id: 'req_sprint160_capture' }));
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end('{}');
  });
});
server.listen(port, '127.0.0.1', () => console.log(`capture on http://127.0.0.1:${port}, recording to ${out}`));

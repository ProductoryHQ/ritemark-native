// A local stand-in for the Anthropic API (the pattern of Sprint 160 PR A's capture-server.mjs), for the current-slide proof.
//
//   node capture-server.mjs --port 18766 --out <requests.jsonl> [--placeholder sk-ant-test-...]
//
// A dev instance started with ANTHROPIC_BASE_URL=http://127.0.0.1:<port> sends Claude Code's requests here. Each
// `POST /v1/messages` is recorded as one line: the time, the path, which key it carried (`placeholder`, `other` or
// `none`), and from the last user message only its context lines, the ones starting `[Currently editing:` or
// `[Current slide:`, plus the person's own words after them. No other header or body text is kept. Every /v1/ request
// is answered as Anthropic answers a wrong key (401), so nothing leaves the machine.

import fs from 'node:fs';
import http from 'node:http';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const port = Number(option('port', '18766'));
const out = option('out');
const placeholder = option('placeholder', 'sk-ant-test-placeholder-0000');
if (!out) throw new Error('--out is required');

/** The text of the last user message's text blocks. */
function lastUserText(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const user = [...messages].reverse().find((message) => message.role === 'user');
  if (!user) return '';
  if (typeof user.content === 'string') return user.content;
  return (Array.isArray(user.content) ? user.content : []).filter((block) => block.type === 'text').map((block) => block.text).join('\n');
}

const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    const path = (req.url ?? '').split('?')[0];
    if (req.method === 'POST' && path === '/v1/messages') {
      let body = null;
      try { body = JSON.parse(raw); } catch { /* not JSON */ }
      const text = lastUserText(body);
      const contextLines = text.split('\n').filter((line) => line.startsWith('[Currently editing:') || line.startsWith('[Current slide:'));
      const key = req.headers['x-api-key'];
      const line = {
        at: new Date().toISOString(),
        path,
        xApiKey: key === undefined ? 'none' : key === placeholder ? 'placeholder' : 'other',
        model: body?.model ?? null,
        contextLines,
        endsWith: text.trim().split('\n').slice(-1)[0] ?? '',
      };
      fs.appendFileSync(out, `${JSON.stringify(line)}\n`);
    }
    if (path.startsWith('/v1/')) {
      res.writeHead(401, { 'content-type': 'application/json', 'request-id': 'req_current_slide_capture' });
      res.end(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' }, request_id: 'req_current_slide_capture' }));
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end('{}');
  });
});
server.listen(port, '127.0.0.1', () => console.log(`capture on http://127.0.0.1:${port}, recording to ${out}`));

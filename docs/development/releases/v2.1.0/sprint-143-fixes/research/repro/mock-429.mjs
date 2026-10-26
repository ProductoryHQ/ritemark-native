// A local Responses endpoint that always answers 429 with Retry-After, to see
// what Codex's app-server tells its client while it waits (#544).
import http from 'node:http';
const port = Number(process.argv[2] ?? 18544);
const retryAfter = process.argv[3] ?? '20';
let hits = 0;
http.createServer((req, res) => {
  hits += 1;
  console.log(new Date().toISOString(), req.method, req.url, 'hit', hits);
  req.resume();
  res.writeHead(429, { 'content-type': 'application/json', 'retry-after': retryAfter });
  res.end(JSON.stringify({ error: { message: 'Rate limit reached for requests', type: 'requests', code: 'rate_limit_exceeded' } }));
}).listen(port, '127.0.0.1', () => console.log('listening', port));

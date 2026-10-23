/**
 * Tests for the Ritemark tools IPC server's socket path and a real round trip.
 *
 * 2.0.0 regression: on a Mac the path was `os.tmpdir()` (48 bytes) +
 * `ritemark-tools-<uuid>.sock`, 105 bytes in all, past `sun_path`'s 104
 * (with the NUL). Node 24 rejects that with `listen EINVAL`, so every
 * OpenCode turn failed.
 *
 * Run: npx tsx src/runtime/RitemarkIpcServer.test.ts
 */

import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as net from 'node:net';
import { MAX_UNIX_SOCKET_PATH_BYTES, RitemarkIpcServer, ritemarkIpcSocketPath } from './RitemarkIpcServer';
import type { RitemarkIpcResponse } from './RitemarkIpcServer';

/** A real macOS `os.tmpdir()`: always `/var/folders/<2>/<28>/T`, 48 bytes. */
const MAC_TMPDIR = '/var/folders/yb/4jdxnp1159zd8jh7b2gx4lmm0000gn/T';
const SESSION_A = 'a65154ce-9e12-48a6-8eb1-5051490c4f86';
const SESSION_B = '0f7e2b9c-3d41-4c8a-9b6e-1a2b3c4d5e6f';

function bytes(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function roundTrip(socketPath: string, line: string): Promise<RitemarkIpcResponse> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(socketPath);
    let buffer = '';
    client.on('connect', () => client.write(line + '\n'));
    client.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const newline = buffer.indexOf('\n');
      if (newline >= 0) {
        client.end();
        resolve(JSON.parse(buffer.slice(0, newline)) as RitemarkIpcResponse);
      }
    });
    client.on('error', reject);
  });
}

async function main(): Promise<void> {
  // The path the 2.0.0 build made was over the limit; the test's tmpdir is the real one.
  assert.equal(bytes(MAC_TMPDIR), 48);
  assert.equal(bytes(`${MAC_TMPDIR}/ritemark-tools-${SESSION_A}.sock`), 105);

  // Unix: well under the limit for a UUID session id in a 48-byte tmpdir.
  for (const platform of ['darwin', 'linux'] as const) {
    const a = ritemarkIpcSocketPath(SESSION_A, platform, MAC_TMPDIR);
    const b = ritemarkIpcSocketPath(SESSION_B, platform, MAC_TMPDIR);
    assert.ok(bytes(a) <= MAX_UNIX_SOCKET_PATH_BYTES, `${a} is ${bytes(a)} bytes`);
    assert.ok(bytes(b) <= MAX_UNIX_SOCKET_PATH_BYTES, `${b} is ${bytes(b)} bytes`);
    assert.ok(a.startsWith(MAC_TMPDIR + '/'), 'stays in the tmpdir when it fits');
    assert.match(a, /\/rmt-[0-9a-f]{12}\.sock$/);
    assert.notEqual(a, b, 'two sessions get two sockets');
    assert.equal(ritemarkIpcSocketPath(SESSION_A, platform, MAC_TMPDIR), a, 'the same session gets the same path');
  }
  assert.ok(MAX_UNIX_SOCKET_PATH_BYTES < 104, 'the guard leaves room under macOS sun_path (104 with the NUL)');

  // A TMPDIR too long for any name falls back to /tmp.
  const longTmpdir = '/Users/someone/' + 'x'.repeat(90);
  const fallback = ritemarkIpcSocketPath(SESSION_A, 'darwin', longTmpdir);
  assert.ok(fallback.startsWith('/tmp/rmt-'), fallback);
  assert.ok(bytes(fallback) <= MAX_UNIX_SOCKET_PATH_BYTES);
  assert.equal(fallback.slice('/tmp/'.length), ritemarkIpcSocketPath(SESSION_A, 'darwin', MAC_TMPDIR).slice(MAC_TMPDIR.length + 1));

  // Windows: the named pipe is unchanged.
  assert.equal(ritemarkIpcSocketPath(SESSION_A, 'win32', 'C:\\Users\\someone\\AppData\\Local\\Temp'), `\\\\.\\pipe\\ritemark-tools-${SESSION_A}`);

  // The server uses this path, and on this machine's real tmpdir it fits.
  const server = new RitemarkIpcServer(SESSION_A);
  assert.equal(server.socketPath, ritemarkIpcSocketPath(SESSION_A));
  if (process.platform !== 'win32') {
    assert.ok(bytes(server.socketPath) <= MAX_UNIX_SOCKET_PATH_BYTES, `${server.socketPath} is ${bytes(server.socketPath)} bytes`);
  }

  // A real listen and connect: a UUID session id, as AcpRuntime makes one.
  const live = new RitemarkIpcServer(randomUUID());
  await live.start(async (req) => {
    if (req.op === 'list') {
      return { tools: [{ name: `${req.group}_tool`, description: 'test', inputSchema: { type: 'object' } }] };
    }
    throw new Error(`no tool ${req.tool}`);
  });
  try {
    const listed = await roundTrip(live.socketPath, JSON.stringify({ id: '1', op: 'list', group: 'board' }));
    assert.deepEqual(listed, { id: '1', tools: [{ name: 'board_tool', description: 'test', inputSchema: { type: 'object' } }] });
    const failed = await roundTrip(live.socketPath, JSON.stringify({ id: '2', op: 'call', group: 'board', tool: 'nope', params: {} }));
    assert.deepEqual(failed, { id: '2', error: 'no tool nope' });
  } finally {
    live.stop();
  }
  if (process.platform !== 'win32') {
    assert.equal(fs.existsSync(live.socketPath), false, 'stop removes the socket file');
  }

  console.log('runtime/RitemarkIpcServer: all assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

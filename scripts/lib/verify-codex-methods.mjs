// Probe the same outbound JSONL requests as Ritemark, against the binary on disk.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

export function collectMethods() {
  const ts = createRequire(new URL('../../extensions/ritemark/package.json', import.meta.url))('typescript');
  const client = new URL('../../extensions/ritemark/src/codex/codexAppServer.ts', import.meta.url);
  const source = ts.createSourceFile('codexAppServer.ts', readFileSync(client, 'utf8'), ts.ScriptTarget.Latest);
  const methods = new Set();
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.expression.kind === ts.SyntaxKind.ThisKeyword && node.expression.name.text === 'rpc') {
      const [method] = node.arguments;
      if (!method || !ts.isStringLiteralLike(method)) throw new Error('Expected a literal method in this.rpc()');
      methods.add(method.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!methods.delete('initialize') || !methods.size) throw new Error('Could not discover the app-server handshake and requests');
  return ['initialize', ...methods];
}

function probeParams(method) {
  if (method === 'initialize') return {
    clientInfo: { name: 'ritemark-native', title: 'Ritemark Native', version: '1.4.0' },
    capabilities: { experimentalApi: true },
  };
  // {} is a valid thread/start. Force a parameter error before a session can start.
  return method === 'thread/start' ? { cwd: false } : {};
}

function probeEnvironment(home) {
  // Omit inherited credentials and route any background HTTP traffic to a closed local port.
  const env = { CODEX_HOME: home, HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1' };
  for (const name of ['HOME', 'PATH', 'SystemRoot', 'USERPROFILE', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TMPDIR']) {
    if (process.env[name]) env[name] = process.env[name];
  }
  return env;
}

// 0.171.0 uses -32600 for BOTH unknown methods and ordinary parameter errors.
// Its dispatcher names the rejected method and supplies its accepted method list.
// A parameter error can mention an unknown enum variant within a valid method.
function dispatcherRejects(method, { code, message }) {
  const quotedMethod = '`' + method + '`';
  const prefix = 'Invalid request: unknown variant ' + quotedMethod + ', expected one of ';
  if (code !== -32600 || !message.startsWith(prefix)) return false;
  const accepted = message.slice(prefix.length);
  return accepted.includes('`initialize`') && !accepted.includes(quotedMethod);
}

export async function probeMethods(binary, methods, {
  args = ['-c', 'cli_auth_credentials_store="file"', '-c', 'analytics.enabled=false'],
  timeoutMs = 10000, log = console.log,
} = {}) {
  const home = mkdtempSync(path.join(tmpdir(), 'ritemark-codex-methods-'));
  let child, reader, closed, failure;
  function stop(error) {
    failure ??= error;
    child?.kill('SIGKILL');
    reader?.close();
  }
  const interrupt = () => stop(new Error('interrupted'));
  let index = 0;
  try {
    child = spawn(binary, args, { cwd: home, env: probeEnvironment(home), stdio: ['pipe', 'pipe', 'ignore'] });
    closed = new Promise(resolve => child.once('close', resolve));
    child.on('error', stop);
    child.stdin.on('error', stop);
    process.on('SIGINT', interrupt);
    process.on('SIGTERM', interrupt);
    reader = createInterface({ input: child.stdout, crlfDelay: Infinity });
    const lines = reader[Symbol.asyncIterator]();
    const send = message => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');

    async function request(id, method) {
      const timer = setTimeout(() => stop(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs);
      try {
        send({ id, method, params: probeParams(method) });
        for (;;) {
          const { value, done } = await lines.next();
          if (failure) throw failure;
          if (done) throw new Error('app-server closed stdout before replying');
          const reply = JSON.parse(value);
          if (reply.id === id && !('method' in reply)) return reply;
        }
      } finally {
        clearTimeout(timer);
      }
    }

    let ok = true;
    for (; index < methods.length; index++) {
      const method = methods[index];
      const reply = await request(index + 1, method);
      if ('result' in reply && !('error' in reply)) {
        if (method === 'initialize') send({ method: 'initialized' });
        log(`  ${method} PRESENT (result)`);
        continue;
      }
      if ('result' in reply || !Number.isInteger(reply.error?.code) || typeof reply.error.message !== 'string') {
        throw new Error('invalid response: expected a result or JSON-RPC error');
      }
      const { code, message } = reply.error;
      const rejectedByDispatcher = dispatcherRejects(method, reply.error);
      const missing = code === -32601 || rejectedByDispatcher;
      if (method === 'initialize' && !missing) throw new Error(`handshake rejected (${code}: ${message})`);
      const reason = rejectedByDispatcher ? 'absent from app-server dispatch list' : message;
      log(`  ${method} ${missing ? 'MISSING' : 'PRESENT'} (${code}: ${reason})`);
      if (method === 'initialize') {
        index++;
        throw new Error('could not initialize app-server');
      }
      if (missing) ok = false;
    }
    return ok;
  } catch (error) {
    for (const method of methods.slice(index)) log(`  ${method} FAIL (${error.message})`);
    return false;
  } finally {
    try {
      child?.kill('SIGKILL');
      child?.stdout.destroy();
      child?.stdin.destroy();
      await closed;
      rmSync(home, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
    } finally {
      process.off('SIGINT', interrupt);
      process.off('SIGTERM', interrupt);
    }
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const binary = process.argv[2];
  if (!binary) throw new Error('usage: verify-codex-methods.mjs <codex-app-server>');
  if (!await probeMethods(path.resolve(binary), collectMethods())) process.exitCode = 1;
}

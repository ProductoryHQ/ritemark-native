// Canary: can the Claude Code version Ritemark bundles run a new model when
// the model is declared to it the way the Ritemark client declares it?
//
// One short, tool-less turn through the Claude Agent SDK with
// settings.modelPicker and the declared output budget, in an isolated home.
// Passing means: the CLI lists the model after injection, the session init
// reports it, the API answers as that model, and the turn completes with text.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PROMPT = 'Reply with the single word OK.';
const LIST_TIMEOUT_MS = 30_000;
const TURN_TIMEOUT_MS = 180_000;

/** Download a package with npm, check it against the registry's integrity, unpack it. */
function fetchPackage(spec, destination) {
  const integrity = JSON.parse(execFileSync('npm', ['view', spec, 'dist.integrity', '--json'], { encoding: 'utf8' }));
  const scratch = mkdtempSync(join(tmpdir(), 'catalog-pack-'));
  execFileSync('npm', ['pack', spec, '--silent', '--pack-destination', scratch], { encoding: 'utf8' });
  const tarball = readdirSync(scratch).find((name) => name.endsWith('.tgz'));
  if (!tarball) throw new Error(`npm pack produced no tarball for ${spec}`);
  const actual = `sha512-${createHash('sha512').update(readFileSync(join(scratch, tarball))).digest('base64')}`;
  if (actual !== integrity) throw new Error(`integrity mismatch for ${spec}`);
  mkdirSync(destination, { recursive: true });
  execFileSync('tar', ['xzf', join(scratch, tarball), '-C', destination, '--strip-components=1']);
}

/** The pinned Linux CLI (the same JavaScript as the macOS and Windows builds) and the SDK. */
export function prepareRuntime({ cliVersion, sdkVersion, cacheDir }) {
  const cliDir = join(cacheDir, `claude-code-${cliVersion}`);
  const sdkDir = join(cacheDir, `claude-agent-sdk-${sdkVersion}`);
  if (!existsSync(join(cliDir, 'claude'))) fetchPackage(`@anthropic-ai/claude-code-linux-x64@${cliVersion}`, cliDir);
  if (!existsSync(join(sdkDir, 'sdk.mjs'))) fetchPackage(`@anthropic-ai/claude-agent-sdk@${sdkVersion}`, sdkDir);
  return { cliPath: join(cliDir, 'claude'), sdkPath: join(sdkDir, 'sdk.mjs') };
}

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms); }),
  ]);
}

/** The API may answer with a dated snapshot of the requested id. */
function sameModel(served, requested) {
  return served === requested || served.startsWith(`${requested}-`);
}

/** The canary proper, against an already-loaded SDK `query`, so tests can stub the SDK. */
export async function canaryWithQuery({ query, cliPath, modelId, label, maxOutputTokens, apiKey, timeoutMs = TURN_TIMEOUT_MS }) {
  const started = Date.now();
  const home = mkdtempSync(join(tmpdir(), 'catalog-canary-'));
  const outcome = (ok, reason, extra = {}) => ({ ok, ...(reason ? { reason } : {}), durationMs: Date.now() - started, ...extra });

  // Streaming input, as in the Sprint 127 probes: list the models first, then
  // send the one prompt, and keep the input open until the turn has ended.
  let sendPrompt;
  const promptReady = new Promise((resolve) => { sendPrompt = resolve; });
  let endInput;
  const inputEnded = new Promise((resolve) => { endInput = resolve; });
  async function* input() {
    await promptReady;
    yield { type: 'user', message: { role: 'user', content: PROMPT }, parent_tool_use_id: null, session_id: '' };
    await inputEnded;
  }

  const stream = query({
    prompt: input(),
    options: {
      cwd: home,
      pathToClaudeCodeExecutable: cliPath,
      settingSources: [],
      permissionMode: 'default',
      model: modelId,
      maxTurns: 1,
      tools: [],
      canUseTool: async () => ({ behavior: 'deny', message: 'Model-catalog canary: tools are not allowed.' }),
      settings: { modelPicker: { options: [{ model: modelId, label }] } },
      env: {
        PATH: process.env.PATH,
        HOME: home,
        CLAUDE_CONFIG_DIR: join(home, '.claude'),
        ANTHROPIC_API_KEY: apiKey,
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
        ...(maxOutputTokens ? { CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(maxOutputTokens) } : {}),
      },
    },
  });

  let timedOut = false;
  const deadline = setTimeout(() => {
    timedOut = true;
    endInput();
    try { stream.close?.(); } catch { /* best effort */ }
  }, timeoutMs);
  try {
    const rows = await withTimeout(stream.supportedModels(), LIST_TIMEOUT_MS, 'supportedModels');
    if (!rows.some((row) => row.value === modelId)) return outcome(false, 'the CLI did not list the model after injection');

    sendPrompt();
    let initModel = null;
    const servedModels = new Set();
    let final = null;
    for await (const message of stream) {
      if (message.type === 'system' && message.subtype === 'init') {
        initModel = message.model ?? null;
      } else if (message.type === 'assistant' && typeof message.message?.model === 'string' && message.message.model !== '<synthetic>') {
        servedModels.add(message.message.model);
      } else if (message.type === 'result') {
        final = message;
        break;
      }
    }

    if (timedOut) return outcome(false, `the turn did not finish within ${timeoutMs} ms`);
    if ((initModel ?? '').replace(/\[1m\]$/i, '') !== modelId) return outcome(false, `session init reported ${initModel ?? 'no model'}`);
    const other = [...servedModels].find((served) => !sameModel(served, modelId));
    if (other) return outcome(false, `the API answered as ${other}`);
    if (!final || final.subtype !== 'success' || final.is_error === true || typeof final.result !== 'string' || final.result.trim() === '') {
      return outcome(false, `the turn did not complete (${final?.subtype ?? 'no result'})`);
    }
    return outcome(true, undefined, { costUsd: typeof final.total_cost_usd === 'number' ? final.total_cost_usd : null });
  } catch (error) {
    if (timedOut) return outcome(false, `the turn did not finish within ${timeoutMs} ms`);
    return outcome(false, `exception: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(deadline);
    endInput();
    try { stream.close?.(); } catch { /* best effort */ }
  }
}

export async function runCanary({ modelId, label, maxOutputTokens, cliVersion, sdkVersion, apiKey, cacheDir }) {
  const started = Date.now();
  try {
    const { cliPath, sdkPath } = prepareRuntime({ cliVersion, sdkVersion, cacheDir });
    const { query } = await import(pathToFileURL(sdkPath).href);
    return { cliVersion, ...(await canaryWithQuery({ query, cliPath, modelId, label, maxOutputTokens, apiKey })) };
  } catch (error) {
    // A runtime that cannot be fetched is a failed canary, not a crashed run.
    const reason = `runtime setup failed: ${error instanceof Error ? error.message : String(error)}`;
    return { cliVersion, ok: false, reason, durationMs: Date.now() - started };
  }
}

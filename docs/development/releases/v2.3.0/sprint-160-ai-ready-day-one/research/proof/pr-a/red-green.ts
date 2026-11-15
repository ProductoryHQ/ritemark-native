/**
 * Sprint 160, PR A: the faults on main, then fixed on the branch, with the same script for both trees.
 *
 * Run from `extensions/ritemark` (for its node_modules), once per tree:
 *   npx tsx <this file> <tree>/extensions/ritemark/src
 * where <tree> is this branch, or an export of origin/main (`git archive origin/main extensions/ritemark/src`).
 *
 * It never reads the real Keychain, the real Claude or a real key: Claude and cmdkey are fakes first on PATH, the CLI
 * always answers (so main's Keychain fallback never runs on macOS) or runs as on Windows, and the key is a placeholder.
 * Each line is PASS or FAIL with what was expected and what came back.
 */

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { delimiter, join, relative } from 'path';

const src = process.argv[2];
if (!src) throw new Error('usage: red-green.ts <tree>/extensions/ritemark/src');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const setup = require(join(src, 'agent', 'setup')) as Record<string, (...args: unknown[]) => unknown>;
const PLACEHOLDER_KEY = 'sk-ant-test-placeholder-0000';
const lines: string[] = [];
const report = (id: string, expected: string, actual: string) => {
  lines.push(`${expected === actual ? 'PASS' : 'FAIL'}  ${id}: expected ${expected}, got ${actual}`);
};

/** Say a key is saved, the way each tree can: the key reader (branch) or the flag (main). */
function saveKey(saved: boolean): void {
  if (typeof setup.registerAnthropicKeyReader === 'function') {
    setup.registerAnthropicKeyReader(saved ? async () => PLACEHOLDER_KEY : null);
  } else {
    setup.setAnthropicKeyAvailable(saved);
  }
  setup.clearSetupCache();
}

const FAKE_CLAUDE = [
  '#!/bin/sh',
  'case "$1" in',
  '  --version) echo "2.1.999 (Claude Code)" ;;',
  '  auth) cat "$RITEMARK_FAKE_DIR/auth" ;;',
  'esac',
  '',
].join('\n');

const FAKE_CMD_EXE = [
  '#!/bin/sh',
  'command=$(printf \'%s\' "$4" | sed \'s/^"//; s/"$//\')',
  'exec /bin/sh -c "$command"',
  '',
].join('\n');

async function main() {
  const dir = mkdtempSync(join(tmpdir(), 'ritemark-pr-a-proof-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'claude'), FAKE_CLAUDE, { mode: 0o755 });
  // cmdkey's real output on a PC with no Claude credential: the filter in the header, "* NONE *", exit 0.
  writeFileSync(join(bin, 'cmdkey'), [
    '#!/bin/sh',
    'echo "$*" >> "$RITEMARK_FAKE_DIR/cmdkey-calls"',
    "printf '\\r\\nCurrently stored credentials for Claude*:\\r\\n\\r\\n* NONE *\\r\\n'",
    '',
  ].join('\n'), { mode: 0o755 });
  // Node runs a shell command on Windows as `cmd.exe /d /s /c "<command>"`; this stand-in runs it with sh.
  writeFileSync(join(bin, 'cmd.exe'), FAKE_CMD_EXE, { mode: 0o755 });
  const windowsClaude = join(dir, 'Programs', 'Claude', 'claude.exe');
  mkdirSync(join(dir, 'Programs', 'Claude'), { recursive: true });
  writeFileSync(windowsClaude, FAKE_CLAUDE, { mode: 0o755 });
  writeFileSync(join(dir, 'cmdkey-calls'), '');

  const originalPath = process.env.PATH;
  process.env.PATH = `${bin}${delimiter}${originalPath}`;
  process.env.RITEMARK_FAKE_DIR = dir;
  delete process.env.ANTHROPIC_API_KEY;
  const quiet = console.warn;
  console.warn = () => undefined;
  try {
    // #541: the CLI says signed out, a key is saved in Ritemark.
    writeFileSync(join(dir, 'auth'), '{"loggedIn":false,"authMethod":"none","apiProvider":"firstParty"}');
    saveKey(true);
    const onKey = await setup.getSetupStatus() as { state: string; authMethod: string | null };
    report('#541 signed-out CLI + saved key', 'ready/api-key', `${onKey.state}/${onKey.authMethod}`);
    saveKey(false);

    // #703: Windows, Claude at its install path answers with no JSON, cmdkey says NONE.
    writeFileSync(join(dir, 'auth'), 'Welcome to Claude Code');
    const platform = process.platform;
    const env = { LOCALAPPDATA: process.env.LOCALAPPDATA, APPDATA: process.env.APPDATA, USERPROFILE: process.env.USERPROFILE };
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    process.env.LOCALAPPDATA = dir;
    process.env.APPDATA = dir;
    process.env.USERPROFILE = dir;
    setup.clearSetupCache();
    let windows: { state: string; authMethod: string | null; binaryPath?: string; diagnostics: string[] };
    try {
      // On Windows the fake Claude is found at its install path; `claude` on PATH is only for the macOS cases.
      windows = await setup.getSetupStatus() as typeof windows;
    } finally {
      Object.defineProperty(process, 'platform', { value: platform, configurable: true });
      for (const [name, value] of Object.entries(env)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
    report('#703 Windows: no usable answer, cmdkey "* NONE *"', 'needs-auth/null', `${windows.state}/${windows.authMethod}`);
    report('#703 Windows: cmdkey asked', 'no', readFileSync(join(dir, 'cmdkey-calls'), 'utf-8') ? 'yes' : 'no');
    report(
      '#703 the reason in the diagnostics',
      'no-json',
      windows.diagnostics.find((line) => line.includes('gave no usable answer'))?.match(/: (\S+) \(/)?.[1] ?? 'none',
    );
  } finally {
    console.warn = quiet;
    process.env.PATH = originalPath;
    delete process.env.RITEMARK_FAKE_DIR;
    rmSync(dir, { recursive: true, force: true });
  }

  // #696: who writes Claude's signing-in flag.
  const files: string[] = [];
  const walk = (folder: string) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) files.push(path);
    }
  };
  walk(src);
  const writers = files
    .filter((file) => /\bsetClaudeLoginInProgress\(/.test(readFileSync(file, 'utf-8').replace(/export function setClaudeLoginInProgress\(/, '')))
    .map((file) => relative(src, file))
    .sort();
  report('#696 writers of the signing-in flag', 'agent/claudeLogin.ts', writers.join(', '));

  // #541: a Flow's Claude step hands the saved key to runAgent, and runAgent to the CLI.
  const runner = readFileSync(join(src, 'agent', 'AgentRunner.ts'), 'utf-8');
  const oneShot = runner.slice(runner.indexOf('export async function runAgent('), runner.indexOf('export class AgentSession'));
  report('#541 runAgent passes a key to claudeRuntimeOptions', 'yes', oneShot.includes('claudeRuntimeOptions(anthropicApiKey') ? 'yes' : 'no');
  const step = readFileSync(join(src, 'flows', 'nodes', 'ClaudeCodeNodeExecutor.ts'), 'utf-8');
  report('#541 the Flow step passes anthropicApiKey', 'yes', /anthropicApiKey:\s*claudeApiKey\(/.test(step) ? 'yes' : 'no');

  console.log(lines.join('\n'));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

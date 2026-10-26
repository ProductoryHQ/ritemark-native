/**
 * Check a candidate model feed against every release that reads it (Sprint 141, R9).
 *
 *   cd extensions/ritemark
 *   npm run check:model-feed -- --candidate /tmp/model-catalog.json \
 *     [--current <ritemark-public>/feeds/model-catalog.json] [--refs v1.12.0,v2.0.0] \
 *     [--accept <ref|legacy>:<provider>] [--out report.md]
 *
 * Every Ritemark from 1.8.1 reads `feeds/model-catalog.json` from ritemark-public,
 * with its own resolver: 1.8.1–1.11.0 take the feed whole, 1.12.0 and later merge it
 * row by row. For each release this script takes that release's own `schema.ts`,
 * `resolver.ts`, `bundledCatalog.ts` and (from 1.12.0) `runtimeDeclarations.ts` with
 * `git archive`, resolves the current and the candidate feed with them, and prints
 * what changes: rows, each surface's default, and the Claude models declared to
 * Claude Code. It resolves with no live probe and no cache, the case of a person
 * whose probe is unavailable.
 *
 * It exits 1 when a release's validator rejects the candidate, when a provider
 * resolves to no rows, or when a default that resolved before falls back to the
 * first row or names a row the release can't see (unless `--accept` names that
 * release and provider; `legacy` means 1.8.1–1.11.0). Needs the release tags:
 * `git fetch --tags`. Not part of the extension bundle.
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const DEFAULT_REFS = [
  'v1.8.1', 'v1.8.3', 'v1.8.4', 'v1.8.5', 'v1.8.6', 'v1.9.0', 'v1.10.0', 'v1.10.1', 'v1.11.0',
  'v1.12.0', 'v1.13.0', 'v1.14.0', 'v2.0.0',
  // 2.0.1 shipped from this commit; the repository has no v2.0.1 tag.
  '7810385d',
];
const LEGACY_REFS = new Set(['v1.8.1', 'v1.8.3', 'v1.8.4', 'v1.8.5', 'v1.8.6', 'v1.9.0', 'v1.10.0', 'v1.10.1', 'v1.11.0']);
const WORKING_TREE = 'working tree';
const PROVIDERS = ['anthropic', 'openai', 'gemini', 'codex', 'opencode'] as const;
type ProviderName = typeof PROVIDERS[number];
const SURFACE: Record<ProviderName, string | undefined> = {
  anthropic: 'claude-code', openai: 'flow-llm', gemini: 'flow-llm', codex: 'codex', opencode: undefined,
};

interface Row { id: string; label?: string; order?: number; deprecated?: boolean; hidden?: boolean; resolvedModel?: string; aliases?: string[] }
interface Resolved { models: Row[]; defaults: Record<string, string | undefined> }
type DefaultRule = 'listed-or-first' | 'configured-or-first';

interface Release {
  ref: string;
  appVersion: string;
  rule: DefaultRule;
  validateCatalog: (raw: unknown) => unknown;
  resolveAll: (discovery: object, remote: unknown, cache: unknown, bundled: unknown, appVersion: string) => Record<string, Resolved>;
  bundled: unknown;
  declare?: (feed: unknown) => string[];
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`--${name} needs a value`);
  return value;
}

function options(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((arg, index) => {
    if (arg === `--${name}` && process.argv[index + 1]) out.push(process.argv[index + 1]);
  });
  return out;
}

const extensionRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(extensionRoot, '..', '..');

function git(args: string[]): string {
  return execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** The `getDefault` rule of a release's `index.ts` (the app reads defaults through it). */
function defaultRuleOf(indexSource: string): DefaultRule {
  const body = /export function getDefault\([^)]*\)[^{]*\{([\s\S]*?)\n\}/.exec(indexSource)?.[1] ?? '';
  if (/findModelEntry\(|models\.find\(/.test(body)) return 'listed-or-first';
  if (/rp\.defaults\[surface\]\s*\?\?/.test(body)) return 'configured-or-first';
  throw new Error(`unknown getDefault rule:\n${body}`);
}

async function loadRelease(ref: string, scratch: string): Promise<Release> {
  let catalogDir: string;
  let pkgPath: string;
  if (ref === WORKING_TREE) {
    catalogDir = path.join(extensionRoot, 'src', 'ai', 'modelCatalog');
    pkgPath = path.join(extensionRoot, 'package.json');
  } else {
    const dir = path.join(scratch, ref.replace(/[^\w.-]/g, '_'));
    fs.mkdirSync(dir, { recursive: true });
    const wanted = ['extensions/ritemark/src/ai', 'extensions/ritemark/src/runtime/thinkingEffort.ts', 'extensions/ritemark/package.json'];
    const present = wanted.filter((p) => git(['ls-tree', '--name-only', ref, '--', p]).trim().length > 0);
    const tar = execFileSync('git', ['-C', repoRoot, 'archive', '--format=tar', ref, '--', ...present], { maxBuffer: 256 * 1024 * 1024 });
    execFileSync('tar', ['-x', '-C', dir], { input: tar });
    catalogDir = path.join(dir, 'extensions', 'ritemark', 'src', 'ai', 'modelCatalog');
    pkgPath = path.join(dir, 'extensions', 'ritemark', 'package.json');
  }
  const appVersion = (JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version: string }).version;
  const schema = await import(path.join(catalogDir, 'schema.ts'));
  const resolver = await import(path.join(catalogDir, 'resolver.ts'));
  const bundled = (await import(path.join(catalogDir, 'bundledCatalog.ts'))).BUNDLED_CATALOG;
  const rule = defaultRuleOf(fs.readFileSync(path.join(catalogDir, 'index.ts'), 'utf8'));
  const release: Release = {
    ref, appVersion, rule,
    validateCatalog: schema.validateCatalog,
    resolveAll: resolver.resolveAll,
    bundled,
  };
  const declarationsPath = path.join(catalogDir, 'runtimeDeclarations.ts');
  if (fs.existsSync(declarationsPath) && typeof resolver.resolveStaticModels === 'function') {
    const declarations = await import(declarationsPath);
    release.declare = (feed: unknown) => {
      let rows = resolver.resolveStaticModels('anthropic', feed, null, bundled, appVersion);
      if (typeof declarations.withBundledDeclarations === 'function') {
        rows = declarations.withBundledDeclarations(rows, (bundled as { providers: Record<string, { models: Row[] }> }).providers.anthropic?.models ?? []);
      }
      return declarations.buildClaudeRuntimeDeclarations(rows).pickerOptions.map((o: { model: string }) => o.model);
    };
  }
  return release;
}

function findListed(models: Row[], id: string | undefined): Row | undefined {
  if (!id) return undefined;
  return models.find((m) => m.id === id || m.resolvedModel === id || m.aliases?.includes(id));
}

interface DefaultOutcome { id: string; state: 'listed' | 'first-row' | 'not-listed' | 'none' }

function effectiveDefault(rule: DefaultRule, resolved: Resolved, surface: string): DefaultOutcome {
  const configured = resolved.defaults[surface];
  if (findListed(resolved.models, configured)) return { id: findListed(resolved.models, configured)!.id, state: 'listed' };
  if (rule === 'configured-or-first' && configured) return { id: configured, state: 'not-listed' };
  // No default at all (the resolver dropped one it couldn't see) falls to the first row too.
  const first = resolved.models[0]?.id;
  return first ? { id: first, state: 'first-row' } : { id: '', state: 'none' };
}

function describeRow(row: Row): string {
  return `${row.label ?? row.id}${row.deprecated ? ', deprecated' : ''}${row.hidden ? ', hidden' : ''}, order ${row.order}`;
}

interface Problem { ref: string; provider: string; message: string }

async function main(): Promise<number> {
  const candidatePath = option('candidate');
  if (!candidatePath) throw new Error('--candidate <feed.json> is required');
  const candidate: unknown = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
  const currentPath = option('current');
  const current: unknown = currentPath ? JSON.parse(fs.readFileSync(currentPath, 'utf8')) : undefined;
  const refs = [...(option('refs')?.split(',').map((r) => r.trim()).filter(Boolean) ?? DEFAULT_REFS), WORKING_TREE];
  const accepted = new Set(options('accept').flatMap((entry) => {
    const [ref, provider] = entry.split(':');
    return ref === 'legacy' ? [...LEGACY_REFS].map((r) => `${r}:${provider}`) : [`${ref}:${provider}`];
  }));

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-feed-check-'));
  const lines: string[] = ['# Model feed check', '', `Candidate: \`${candidatePath}\`. Current: ${currentPath ? `\`${currentPath}\`` : 'none'}.`, ''];
  const problems: Problem[] = [];
  try {
    for (const ref of refs) {
      const release = await loadRelease(ref, scratch);
      lines.push(`## ${ref} (app ${release.appVersion}, getDefault: ${release.rule})`, '');
      let candidateDoc: unknown;
      try {
        candidateDoc = release.validateCatalog(candidate);
      } catch (err) {
        problems.push({ ref, provider: '*', message: `its validator rejects the candidate: ${err instanceof Error ? err.message : String(err)}` });
        lines.push(`**Rejected by this release's validator.**`, '');
        continue;
      }
      let currentDoc: unknown = null;
      if (current !== undefined) {
        try { currentDoc = release.validateCatalog(current); } catch { currentDoc = null; }
      }
      const before = release.resolveAll({}, currentDoc, null, release.bundled, release.appVersion);
      const after = release.resolveAll({}, candidateDoc, null, release.bundled, release.appVersion);
      lines.push('| Provider | Default before | Default after | Rows added | Rows removed | Rows changed |', '|---|---|---|---|---|---|');
      for (const provider of PROVIDERS) {
        const b = before[provider];
        const a = after[provider];
        if (!a) continue;
        if (a.models.length === 0) problems.push({ ref, provider, message: 'resolves to no rows' });
        const surface = SURFACE[provider];
        let beforeDefault = '—';
        let afterDefault = '—';
        if (surface) {
          const db = effectiveDefault(release.rule, b, surface);
          const da = effectiveDefault(release.rule, a, surface);
          beforeDefault = `${db.id || '—'}${db.state === 'listed' ? '' : ` (${db.state})`}`;
          afterDefault = `${da.id || '—'}${da.state === 'listed' ? '' : ` (${da.state})`}`;
          if (db.state === 'listed' && da.state !== 'listed' && !accepted.has(`${ref}:${provider}`)) {
            problems.push({ ref, provider, message: `the ${surface} default now resolves as ${da.state}: ${da.id}` });
          }
        } else {
          beforeDefault = `first row ${b?.models[0]?.id ?? '—'}`;
          afterDefault = `first row ${a.models[0]?.id ?? '—'}`;
        }
        const beforeById = new Map((b?.models ?? []).map((m) => [m.id, m]));
        const afterById = new Map(a.models.map((m) => [m.id, m]));
        const added = a.models.filter((m) => !beforeById.has(m.id)).map((m) => m.id);
        const removed = (b?.models ?? []).filter((m) => !afterById.has(m.id)).map((m) => m.id);
        const changed = a.models
          .filter((m) => beforeById.has(m.id) && describeRow(beforeById.get(m.id)!) !== describeRow(m))
          .map((m) => `${m.id}: ${describeRow(beforeById.get(m.id)!)} → ${describeRow(m)}`);
        lines.push(`| ${provider} | ${beforeDefault} | ${afterDefault} | ${added.join(', ') || '—'} | ${removed.join(', ') || '—'} | ${changed.join('; ') || '—'} |`);
      }
      if (release.declare) {
        const declaredBefore = currentDoc ? release.declare(currentDoc) : [];
        const declaredAfter = release.declare(candidateDoc);
        lines.push('', `Declared to Claude Code: before ${declaredBefore.join(', ') || 'none'}; after ${declaredAfter.join(', ') || 'none'}.`);
      } else {
        lines.push('', 'Declared to Claude Code: this release has no runtime declarations.');
      }
      lines.push('');
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }

  lines.push('## Result', '');
  if (problems.length === 0) lines.push('OK: every release accepts the candidate, and no default that resolved before falls back.');
  for (const p of problems) lines.push(`- **${p.ref}, ${p.provider}:** ${p.message}`);
  if (accepted.size > 0) lines.push('', `Accepted fallbacks: ${[...accepted].sort().join(', ')}.`);
  const report = `${lines.join('\n')}\n`;
  const outPath = option('out');
  if (outPath) fs.writeFileSync(outPath, report);
  process.stdout.write(report);
  return problems.length === 0 ? 0 : 1;
}

main().then((code) => process.exit(code), (err) => {
  console.error(`check-model-feed failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

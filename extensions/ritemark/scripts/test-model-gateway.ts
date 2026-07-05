/**
 * Manual local test harness for the Sprint 89 Model Gateway (GH #109).
 *
 * Exercises the REAL resolver + bundled baseline, and — if you export provider
 * API keys — the REAL live probes, WITHOUT needing the VS Code host.
 *
 * Run (offline, bundled floor only):
 *   cd extensions/ritemark && npx tsx scripts/test-model-gateway.ts
 *
 * Run (live — proves Sonnet 5 flows in from /v1/models):
 *   ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/test-model-gateway.ts
 *   (optional also: OPENAI_API_KEY=... GEMINI_API_KEY=...)
 *
 * Your key is read from the environment only — it is never printed or stored.
 */

import { resolveAll, type DiscoveryResults } from '../src/ai/modelCatalog/resolver';
import { BUNDLED_CATALOG } from '../src/ai/modelCatalog/bundledCatalog';
import type { ModelEntry, Provider } from '../src/ai/modelCatalog/schema';

const APP_VERSION = '1.9.0';

function entry(id: string, label: string, order: number): ModelEntry {
  return { id, label, description: '', tier: 'medium', deprecated: false, order };
}

// Inlined copies of the /v1/models + models.list probes (the extension's
// providerDiscovery pulls in vscode transitively, so we replicate the REST call here).
async function probeAnthropic(apiKey: string): Promise<ModelEntry[] | null> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=1000', {
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    });
    if (!res.ok) return console.error(`  anthropic /v1/models HTTP ${res.status}`), null;
    const json = (await res.json()) as { data?: Array<{ id?: string; display_name?: string }> };
    const data = (json.data ?? []).filter((m): m is { id: string; display_name?: string } => typeof m.id === 'string');
    return data.length ? data.map((m, i) => entry(m.id, m.display_name ?? m.id, i)) : null;
  } catch (e) {
    return console.error('  anthropic probe error:', (e as Error).message), null;
  }
}

async function probeOpenAI(apiKey: string): Promise<ModelEntry[] | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) return console.error(`  openai models.list HTTP ${res.status}`), null;
    const json = (await res.json()) as { data?: Array<{ id?: string }> };
    const EXCLUDE = /instruct|vision|audio|realtime|tts|whisper|embedding|davinci|babbage|search|image/;
    const ids = (json.data ?? []).map((m) => m.id).filter((id): id is string => !!id).filter((id) => /gpt|o1|o3/.test(id) && !EXCLUDE.test(id)).sort();
    return ids.length ? ids.map((id, i) => entry(id, id, i)) : null;
  } catch (e) {
    return console.error('  openai probe error:', (e as Error).message), null;
  }
}

function printProvider(name: Provider, resolved: ReturnType<typeof resolveAll>) {
  const rp = resolved[name];
  console.log(`\n▸ ${name}  (source: ${rp.source.toUpperCase()})  default=${JSON.stringify(rp.defaults)}`);
  for (const m of rp.models) {
    console.log(`    ${m.deprecated ? '⊘' : '•'} ${m.id.padEnd(42)} ${m.label}`);
  }
}

async function main() {
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? null;
  const openaiKey = process.env.OPENAI_API_KEY ?? null;

  console.log('=== Model Gateway — local resolution test ===');
  console.log(`app version ${APP_VERSION} · keys: anthropic=${anthropicKey ? 'yes' : 'no'} openai=${openaiKey ? 'yes' : 'no'}\n`);

  const discovery: DiscoveryResults = {};
  if (anthropicKey) { console.log('probing Anthropic /v1/models …'); discovery.anthropic = await probeAnthropic(anthropicKey); }
  if (openaiKey) { console.log('probing OpenAI models.list …'); discovery.openai = await probeOpenAI(openaiKey); }

  // No remote/cache here (that path needs vscode globalState); bundled is the floor.
  const resolved = resolveAll(discovery, null, null, BUNDLED_CATALOG, APP_VERSION);

  for (const p of ['anthropic', 'openai', 'gemini', 'codex', 'opencode'] as Provider[]) printProvider(p, resolved);

  // Headline assertion: is the current Sonnet in the resolved Claude list?
  const claude = resolved.anthropic;
  const hasSonnet5 = claude.models.some((m) => m.id === 'claude-sonnet-5');
  const sonnet5Curated = claude.models.find((m) => m.id === 'claude-sonnet-5');
  console.log('\n=== headline checks ===');
  console.log(`  claude source            : ${claude.source}  ${claude.source === 'live' ? '(live /v1/models won)' : '(no key → catalog floor)'}`);
  console.log(`  claude-sonnet-5 present   : ${hasSonnet5 ? 'YES' : 'NO'}`);
  console.log(`  claude-sonnet-5 label     : ${sonnet5Curated?.label ?? '(absent)'}  ${claude.source === 'live' && sonnet5Curated?.label === 'Sonnet 5' ? '(curated label applied to live id ✓)' : ''}`);
  console.log(`  claude default (claude-code): ${claude.defaults['claude-code']}`);
  console.log(`  stale claude-sonnet-4-5?  : ${claude.models.some((m) => m.id === 'claude-sonnet-4-5') ? 'present' : 'ABSENT ✓'}`);
}

void main();

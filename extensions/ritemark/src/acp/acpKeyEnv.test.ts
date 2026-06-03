/**
 * Tests for the BYOK key → spawn-env mapping — Sprint 76 R3a.
 *
 * Run: npx tsx src/acp/acpKeyEnv.test.ts
 *
 * Uses fake key values only (no real secrets). Verifies the provider→env-var
 * mapping (incl. the Google fan-out to GEMINI_API_KEY + GOOGLE_GENERATIVE_AI_
 * API_KEY) and the provider-configured booleans the webview is allowed to see.
 */

import assert from 'assert';
import { buildByokEnv, byokProviderFlags, BYOK_SECRET_KEYS } from './acpKeyEnv';

function run(): void {
  // ── full mapping ──
  {
    const env = buildByokEnv({
      google: 'g-fake',
      openai: 'o-fake',
      anthropic: 'a-fake',
      openrouter: 'r-fake',
    });
    assert.strictEqual(env.GEMINI_API_KEY, 'g-fake');
    assert.strictEqual(env.GOOGLE_GENERATIVE_AI_API_KEY, 'g-fake', 'google fans out to both env vars');
    assert.strictEqual(env.OPENAI_API_KEY, 'o-fake');
    assert.strictEqual(env.ANTHROPIC_API_KEY, 'a-fake');
    assert.strictEqual(env.OPENROUTER_API_KEY, 'r-fake');
  }

  // ── only present keys produce entries ──
  {
    const env = buildByokEnv({ openai: 'o-fake' });
    assert.deepStrictEqual(Object.keys(env).sort(), ['OPENAI_API_KEY']);
    assert.ok(!('GEMINI_API_KEY' in env), 'unset google leaves gemini env untouched');
    assert.ok(!('ANTHROPIC_API_KEY' in env));
    assert.ok(!('OPENROUTER_API_KEY' in env));
  }

  // ── empty / whitespace keys are treated as absent ──
  {
    const env = buildByokEnv({ google: '', openai: '   ', anthropic: undefined });
    assert.deepStrictEqual(env, {}, 'blank keys produce no env vars');
  }

  // ── no keys at all ──
  {
    assert.deepStrictEqual(buildByokEnv({}), {});
  }

  // ── provider booleans (the only key-derived data sent to the webview) ──
  {
    const flags = byokProviderFlags({ google: 'g', anthropic: ' ' });
    assert.deepStrictEqual(flags, {
      google: true,
      openai: false,
      anthropic: false, // whitespace-only → not configured
      openrouter: false,
    });
  }

  // ── booleans never leak the key value ──
  {
    const flags = byokProviderFlags({ openrouter: 'super-secret' });
    const serialized = JSON.stringify(flags);
    assert.ok(!serialized.includes('super-secret'), 'flags must not contain key values');
    assert.strictEqual(flags.openrouter, true);
  }

  // ── SecretStorage names match the Settings cards (Sprint 78 stretch) ──
  // UnifiedViewProvider uses this list to refresh provider flags on key
  // changes; a rename here or in RitemarkSettings must stay in sync.
  {
    assert.deepStrictEqual(
      [...BYOK_SECRET_KEYS].sort(),
      ['anthropic-api-key', 'google-ai-key', 'openai-api-key', 'openrouter-api-key'],
      'BYOK secret names must cover exactly the four provider cards'
    );
  }

  console.log('acpKeyEnv.test.ts: all tests passed');
}

run();

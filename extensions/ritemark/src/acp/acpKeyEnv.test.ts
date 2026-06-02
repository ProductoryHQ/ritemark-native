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
import { buildByokEnv, byokProviderFlags } from './acpKeyEnv';

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

  console.log('acpKeyEnv.test.ts: all tests passed');
}

run();

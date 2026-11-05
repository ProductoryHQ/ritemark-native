/**
 * Tests for secretScan.ts (Sprint 149, R4, S14): each rule finds its own kind of key, and none is dead weight.
 *
 * Every key-shaped fixture is assembled here at run time from harmless parts, so no string in the repository looks
 * like a key (and no scanner flags this file). The values are fake: random-looking letters, never a real key.
 *
 * The mutation check at the end removes each rule in turn and requires its fixture to go unseen: a rule whose fixture
 * another rule would catch anyway isn't proven by its test, and fails here.
 */

import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { gatherPage } from './gather';
import { isText, RULES, scanText } from './secretScan';

/** A deterministic run of letters and digits: looks random enough for a key's shape, means nothing. */
function run(n: number, alphabet = 'Ab3Cd5Ef7Gh9Jk2Mn4Pq6Rs8Tu'): string {
  let s = '';
  for (let i = 0; i < n; i++) s += alphabet[(i * 7 + 3) % alphabet.length];
  return s;
}
const UPPER = 'QWERTYUPASDFGHJKLZXCVBNM234567';
const HEX = '0123456789abcdef';
const j = (...parts: string[]) => parts.join('');

/** One fixture per rule: a line of a page or script holding that kind of key, and nothing another rule would catch. */
const FIXTURES: Record<string, string> = {
  'private-key': j('-----BEGIN ', 'RSA ', 'PRIVATE', ' KEY-----'),
  anthropic: j('const k = ', '"', 'sk', '-ant-', 'api03-', run(40), '";'),
  openai: j('client(', "'", 'sk', '-proj-', run(48), "');"),
  'google-api': j('maps.js?key=', 'AI', 'za', 'Sy', run(33), '&callback=init'),
  'google-oauth-secret': j('<code>', 'GOC', 'SPX-', run(28), '</code>'),
  'aws-access-key': j('id: ', 'AK', 'IA', run(16, UPPER)),
  'aws-secret': j('aws_secret', '_access_key = ', run(40)),
  github: j('git clone https://', 'gh', 'p_', run(36), '@github.com/x/y'),
  'slack-token': j('<pre>', 'xo', 'xb-', '1234-', run(20), '</pre>'),
  'slack-webhook': j('post("https://', 'hooks.slack', '.com/services/', 'T0', run(8, UPPER), '/B0', run(8, UPPER), '/', run(24), '")'),
  stripe: j('<p>', 'sk', '_live_', run(24), '</p>'),
  cloudflare: j('CLOUDFLARE', '_API_TOKEN=', run(40)),
  bearer: j('headers: { Authorization: `', 'Bear', 'er ', run(32), '` }'),
  jwt: j('<td>', 'ey', 'J', run(16), '.ey', 'J', run(20), '.', run(24), '</td>'),
  assignment: j('const ', 'pass', 'word', ' = "', run(16), '";'),
  'query-key': j('<img src="https://api.example.com/x.png?', 'api', '_key=', run(24), '">'),
};

let passed = 0;
function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  return (async () => {
    try {
      await fn();
      passed++;
    } catch (e) {
      console.error(`FAIL ${name}`);
      throw e;
    }
  })();
}

async function main(): Promise<void> {
  await check('every rule has a fixture, and every fixture a rule', () => {
    assert.deepEqual(Object.keys(FIXTURES).sort(), RULES.map((r) => r.id).sort());
  });

  for (const rule of RULES) {
    await check(`${rule.id}: found, on its line`, () => {
      const text = `<!doctype html>\n<p>Hello</p>\n${FIXTURES[rule.id]}\n<p>Bye</p>`;
      const hits = scanText(text);
      assert.deepEqual(hits, [{ line: 3, rule: rule.id }], `${rule.id}: ${JSON.stringify(hits)}`);
    });
  }

  await check('a hit carries no value', () => {
    for (const fixture of Object.values(FIXTURES)) {
      for (const hit of scanText(fixture)) assert.deepEqual(Object.keys(hit).sort(), ['line', 'rule']);
    }
  });

  await check('ordinary pages are quiet: placeholders, password fields, prose about keys, CSS, a publishable key', () => {
    const quiet = [
      '<input type="password" name="password" autocomplete="current-password">',
      'const apiKey = "YOUR_API_KEY_HERE";',
      'password: "<your password>",',
      'const token = process.env.TOKEN;',
      'fetch(url, { headers: { Authorization: `Bearer ${token}` } });',
      '<p>Your API key starts with sk- and is shown once.</p>',
      '.task-list-item { color: var(--ink); } .sk-loader { width: 12px }',
      j('Stripe(', "'", 'pk', '_live_', run(24), "');"),
      '<a href="?page=2&sort=asc">Next</a>',
      'const secret = "";',
      'let passwordHint = "at least eight characters";',
      'background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==);',
    ].join('\n');
    assert.deepEqual(scanText(quiet), []);
  });

  await check('several on different lines, in line order; one per line', () => {
    const text = [FIXTURES.stripe, 'x', j(FIXTURES.anthropic, ' ', FIXTURES.assignment), FIXTURES.github].join('\n');
    assert.deepEqual(scanText(text).map((h) => h.line), [1, 3, 4]);
  });

  await check('binary bytes are not text', () => {
    assert.equal(isText(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01])), false);
    assert.equal(isText(Buffer.from('plain', 'utf8')), true);
  });

  await check('S14: the gather scans the page and every text file that goes, by file and line', async () => {
    const project = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'publish-scan-')));
    try {
      fs.mkdirSync(path.join(project, 'js'));
      const script = Array.from({ length: 11 }, (_, i) => `// line ${i + 1}`).concat([FIXTURES.anthropic]).join('\n');
      fs.writeFileSync(path.join(project, 'js', 'script.js'), script);
      fs.writeFileSync(path.join(project, 'pic.png'), Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0]), Buffer.from(FIXTURES.stripe)]));
      fs.writeFileSync(path.join(project, 'page.html'), `<script src="js/script.js"></script><img src="pic.png">\n${FIXTURES.jwt}`);
      const plan = await gatherPage(path.join(project, 'page.html'), project, { gitIgnored: async () => new Set() });
      assert.deepEqual(
        plan.keyHits.map((h) => [h.projectPath, h.line, h.rule]),
        [['page.html', 2, 'jwt'], ['js/script.js', 12, 'anthropic']],
        'a binary picture is not scanned',
      );
      assert.ok(!JSON.stringify(plan).includes(run(40)), 'no value anywhere in the plan');
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  // Mutation check: without each rule, its fixture goes unseen. Proves no rule is shadowed by another.
  for (const rule of RULES) {
    await check(`mutation: without ${rule.id}, its fixture is missed`, () => {
      const others = RULES.filter((r) => r !== rule);
      assert.deepEqual(scanText(FIXTURES[rule.id], others), [], `${rule.id} is shadowed by another rule`);
    });
  }

  console.log(`secretScan.test: ${passed} passed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

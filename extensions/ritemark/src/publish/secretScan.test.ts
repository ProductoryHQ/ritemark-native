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
import { isPlaceholder, isText, RULES, scanText } from './secretScan';

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
  // letters only: an unquoted value with digits is also an unquoted assignment (round 4); this rule knows the shape
  'aws-secret': j('aws_secret', '_access_key = ', run(40, 'AbCdEfGh+JkLmNoPqRsTu/VwXyZ')),
  github: j('git clone https://', 'gh', 'p_', run(36), '@github.com/x/y'),
  'slack-token': j('<pre>', 'xo', 'xb-', '1234-', run(20), '</pre>'),
  'slack-webhook': j('post("https://', 'hooks.slack', '.com/services/', 'T0', run(8, UPPER), '/B0', run(8, UPPER), '/', run(24), '")'),
  stripe: j('<p>', 'sk', '_live_', run(24), '</p>'),
  // the global key's header: an unquoted CLOUDFLARE_API_TOKEN=… is also an unquoted assignment (round 4), so the
  // fixture that proves this rule is the form only it knows
  cloudflare: j('headers: { "X-Auth', '-Key": "', run(37, HEX), '" }'),
  bearer: j('headers: { Authorization: `', 'Bear', 'er ', run(32), '` }'),
  jwt: j('<td>', 'ey', 'J', run(16), '.ey', 'J', run(20), '.', run(24), '</td>'),
  assignment: j('const ', 'pass', 'word', ' = "', run(16), '";'),
  'query-key': j('<img src="https://api.example.com/x.png?', 'api', '_key=', run(24), '">'),
  huggingface: j('login(', '"', 'hf', '_', run(34), '")'),
  gitlab: j('git clone https://oauth2:', 'gl', 'pat-', run(20), '@gitlab.com/x/y.git'),
  'stripe-webhook': j('<code>', 'wh', 'sec_', run(32), '</code>'),
  'query-token': j('<img src="https://cdn.example.com/x.png?', 'tok', 'en=', run(24), '">'),
  'token-assignment': j('const ', 'tok', 'en', ' = "', run(24), '";'),
  'telegram-bot': j('BOT', '_TOKEN', " = '", '123456789', ':', 'AA', 'F', run(32), "'"),
  'assignment-unquoted': j('DB_', 'PASS', 'WORD', '=', 'Sunrise', 'Harbour', '12345'),
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
      assert.deepEqual(hits.map((h) => ({ line: h.line, rule: h.rule })), [{ line: 3, rule: rule.id }], `${rule.id}: ${JSON.stringify(hits)}`);
      const fixture = FIXTURES[rule.id];
      assert.ok(hits[0].column >= 0 && hits[0].endColumn > hits[0].column && hits[0].endColumn <= fixture.length, `${rule.id}: the key's columns lie on its line`);
    });
  }

  await check('a hit carries no value', () => {
    for (const fixture of Object.values(FIXTURES)) {
      for (const hit of scanText(fixture)) assert.deepEqual(Object.keys(hit).sort(), ['column', 'endColumn', 'line', 'rule']);
    }
  });

  await check('A2: the Cloudflare rule finds quoted values: a constant, a JSON key, a camel-case property', () => {
    const lines = [
      j('const ', 'CF', '_API_TOKEN', ' = "', run(40), '";'),
      j('{"', 'CLOUDFLARE', '_API_TOKEN', '": "', run(40), '"}'),
      j('  ', 'cloudflare', 'ApiToken', ": '", run(40), "',"),
    ];
    assert.deepEqual(scanText(lines.join('\n')).map((h) => [h.line, h.rule]), [[1, 'cloudflare'], [2, 'cloudflare'], [3, 'cloudflare']]);
  });

  await check('minor 3: a real password that contains "sample" or "your" is still found; whole placeholders stay quiet', () => {
    const found = [
      j('const ', 'pass', 'word', ' = "', 'MySample', run(10), '";'),
      j('pass', 'word', ': "', 'Yours4Ever', run(8), '",'),
      j('api_', 'key', ' = "', 'example', run(14), '"'),
      j('pass', 'word', ': "', 'SampleHarbourGate', '",'),
      j('sec', 'ret', ' = "', 'YourGreyHeronMarsh', '";'),
    ];
    assert.deepEqual(scanText(found.join('\n')).map((h) => [h.line, h.rule]), [[1, 'assignment'], [2, 'assignment'], [3, 'assignment'], [4, 'assignment'], [5, 'assignment']]);
    for (const p of ['your-password-here', 'sample_api_key', 'changeme_changeme', 'YOUR_API_KEY_HERE', '<your password>', 'xxxxxxxxxxxx', 'insert-your-token-here', 'Your Password Goes Here']) {
      assert.equal(isPlaceholder(p), true, p);
    }
    for (const p of ['MySampleP4ssw0rd', 'yourmum1234567', 'example123456789', 'Sunrise-Harbour-Gate']) assert.equal(isPlaceholder(p), false, p);
  });

  await check('Open selects the key: its columns on the line, the value only for a named assignment', () => {
    const key = j('sk', '-ant-', 'api03-', run(40));
    const [hit] = scanText(j('x\n  const k = "', key, '";'));
    assert.deepEqual([hit.line, hit.column, hit.endColumn], [2, 13, 13 + key.length]);
    const value = run(16);
    const [assign] = scanText(j('const ', 'pass', 'word', ' = "', value, '";'));
    assert.deepEqual([assign.column, assign.endColumn], [18, 18 + value.length], 'the value, not its name');
    const [cf] = scanText(j('{"', 'CLOUDFLARE', '_API_TOKEN', '": "', run(40), '"}'));
    assert.deepEqual([cf.column, cf.endColumn], [26, 66]);
    const [bom] = scanText(j('\ufeff', key));
    assert.deepEqual([bom.line, bom.column, bom.endColumn], [1, 0, key.length], 'a byte-order mark the editor drops is not counted');
    const [crlf] = scanText(j('a\r\n', 'pass', 'word', ' = "', value, '"\r\n'));
    assert.deepEqual([crlf.line, crlf.column, crlf.endColumn], [2, 12, 12 + value.length]);
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
      // the new rules' near misses (minor 3): camel-case page tokens, short or letter-only values, prose about prefixes
      j('const csrf', 'Token = "', run(24), '";'),
      j('next', 'Page', 'Token: "', run(24), '",'),
      '<a href="/share?token=abc123">share</a>',
      j('tok', 'en: "', 'abcdefghijklmnopqrstuvwxyz', '",'),
      j('"tok', 'en": "${', 'TOKEN}"'),
      '<p>A Hugging Face token starts with hf_ and a GitLab one with glpat-; a webhook secret with whsec_.</p>',
      '.hf_header_footer_wrapper_container_block_inner { margin: 0 }',
      '<a href="?page_token=2">More</a>',
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
      const plan = await gatherPage(path.join(project, 'page.html'), project, { gitIgnored: async () => ({ ignored: new Set(), unchecked: new Set() }) });
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

  await check("A3's kinds of page are quiet: fonts, dashboards with data, slides, a prototype", () => {
    const pages = [
      '<link href="https://fonts.googleapis.com/css2?family=Sofia+Sans:wght@400;600&display=swap" rel="stylesheet">',
      '<script>const users = [{ name: "Mari", url: "https://github.com/mari", id: "a1b2c3d4e5f6a7b8c9d0" }];</script>',
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js" integrity="sha512-WFN04846sdKMIP5LKNphMaWzU7YpMyCU245etK3g/2ARYbPK9Ub18eG+ljU96qKRCWh+quCY7yefSmlkQw1ANQ==" crossorigin="anonymous"></script>',
      '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/></svg>',
      '<img src="hero.webp?v=3f9a1c2b7d4e5f60" alt="">',
      '<meta name="google-site-verification" content="verification-for-the-site">',
      '<script>const state = { sessionId: "s-2026-11-05", step: 3, version: "2.2.0-rc.1" };</script>',
    ];
    assert.deepEqual(scanText(pages.join('\n')), []);
  });

  await check('round 3: an Anthropic placeholder is quiet; a real-shaped key still fires', () => {
    const quiet = [
      j('const k = "', 'sk', '-ant-', 'your-key-here-', 'x'.repeat(24), '";'),
      j('ANTHROPIC_API_KEY=', 'sk', '-ant-', 'api03-', 'your-api-key-goes-here'),
      j('"', 'sk', '-ant-', 'replace-with-your-own-key', '"'),
    ];
    assert.deepEqual(scanText(quiet.join('\n')), []);
    const found = [
      j('const k = "', 'sk', '-ant-', 'api03-', run(40), '";'),
      j('"', 'sk', '-ant-', 'your-key-', run(24), '"'),
    ];
    assert.deepEqual(scanText(found.join('\n')).map((h) => [h.line, h.rule]), [[1, 'anthropic'], [2, 'anthropic']], 'a value with a digit is a key, whatever words it has');
  });

  await check('round 3: a Telegram bot token is found as an assignment and bare; a time or a port is not', () => {
    const found = [
      j('BOT', '_TOKEN', " = '", '123456789', ':', 'AA', 'F', run(32), "'"),
      j('https://api.telegram.org/bot', '7012345678', ':', 'AA', 'H', run(32), '/sendMessage'),
    ];
    assert.deepEqual(scanText(found.join('\n')).map((h) => [h.line, h.rule]), [[1, 'telegram-bot'], [2, 'telegram-bot']]);
    const [hit] = scanText(found[0]);
    assert.deepEqual([hit.column, hit.endColumn], [13, 13 + 9 + 1 + 35], 'Open selects the token itself');
    const quiet = ['<time>2026-11-05 12:30:45</time>', 'http://localhost:8080/index.html', 'id: 12345678:short', j('12345678', ':', run(34))];
    assert.deepEqual(scanText(quiet.join('\n')), []);
  });

  await check('round 4: unquoted secret assignments in .env, .ini, YAML, a connection string and a URL query are found', () => {
    const lines = [
      // .env
      j('PASS', 'WORD', '=', 'Sunrise', 'Harbour', '12345'),
      j('export ', 'API', '_KEY=', run(20)),
      j('GITHUB', '_TOKEN=', run(24), ' # deploy'),
      // .ini
      '[database]',
      j('pass', 'word = ', 'Sunrise12345', 'Harbour', ' ; set by ops'),
      j('api', 'key=', run(14)),
      // YAML without quotes
      'service:',
      j('  sec', 'ret: ', run(18)),
      j('  access', '_key: ', run(16)),
      j('  private', '_key: ', run(30)),
      j('  db', 'Password: ', 'Harbour', '2026', 'Gate'),
      // a connection string; Java properties
      j('Server=db;User Id=app;', 'Pass', 'word=', 'Sunrise', '12345x', ';'),
      j('db.', 'pass', 'wd=', 'Sunrise', '12345', 'Harbour'),
      // a URL query: 12 to 15 characters, with letters and digits
      j('https://example.com/login?user=mari&', 'pass', 'word=', 'Sunrise', '12345'),
      j('<a href="/cb?code=1&', 'client', '_secret=', run(14), '">'),
      // HTML that shows an env file
      j('<pre><code>', 'STRIPE', '_SECRET=', run(20), '</code></pre>'),
    ];
    const hits = scanText(lines.join('\n'));
    assert.deepEqual(hits.map((h) => [h.line, h.rule]), [
      [1, 'assignment-unquoted'], [2, 'assignment-unquoted'], [3, 'assignment-unquoted'],
      [5, 'assignment-unquoted'], [6, 'assignment-unquoted'],
      [8, 'assignment-unquoted'], [9, 'assignment-unquoted'], [10, 'assignment-unquoted'], [11, 'assignment-unquoted'],
      [12, 'assignment-unquoted'], [13, 'assignment-unquoted'],
      [14, 'query-key'], [15, 'query-key'],
      [16, 'assignment-unquoted'],
    ]);
    // Open selects the value only, never its name or what follows it
    const [env] = scanText(lines[0]);
    assert.deepEqual([env.column, env.endColumn], [9, 9 + 'SunriseHarbour12345'.length]);
    const [ini] = scanText(lines[4]);
    assert.deepEqual([ini.column, ini.endColumn], [11, 11 + 'Sunrise12345Harbour'.length]);
    const [conn] = scanText(lines[11]);
    assert.equal(lines[11].slice(conn.column, conn.endColumn), j('Sunrise', '12345x'));
    const [query] = scanText(lines[13]);
    assert.equal(lines[13].slice(query.column, query.endColumn), j('Sunrise', '12345'));
  });

  await check('round 4: unquoted near misses stay quiet: prose, placeholders, variables, URLs, paths, words, page tokens', () => {
    const quiet = [
      'password = the one you chose',
      'Password: use at least 12 characters, with a digit',
      'The secret: practise every day.',
      j('PASS', 'WORD=', 'changeme_changeme'),
      j('API', '_KEY=', 'your-api-key-here'),
      j('SEC', 'RET=', '<your-secret-here>'),
      j('PASS', 'WORD=', '${DB_PASSWORD_2}'),
      j('tok', 'en: ', '$GITHUB_TOKEN_2'),
      j('PASS', 'WORD=', '%DB_PASS_2%'),
      j('PASS', 'WORD=', 'SunriseHarbourGate'),
      j('pass', 'word=', 'abc123'),
      j('pass', 'word=', '123456789012345'),
      j('pass', 'word_hint=', 'remember2fa-device'),
      j('tok', 'en_url: ', 'https://github.com/login/oauth/access_token2'),
      j('private', '_key: ', './keys/server2048.pem'),
      j('csrf', '_token=', 'abc123def456ghi'),
      j('next', '_page', '_token=', 'CAoQAA12345678'),
      j('const pass', 'word = ', 'process.env.DB_PASSWORD;'),
      j('tok', 'en_expiry: ', '2026-11-05T12:00:00Z'),
      j('pass', 'word=$(cat ', 'secret2.txt)'),
      j('sec', 'ret: !vault |'),
      j('pass', 'word:'),
      j('tok', 'enizer: ', 'gpt2-tokenizer-v12'),
      j('.pass', 'word-input:focus { outline: 2px solid var(--ink) }'),
      j('--sec', 'ret-bg: #a1b2c3d4e5f6a7;'),
      j('api', '_key_name: ', 'maps-browser-2026'),
      j('Secret::', 'KeyManager2026'),
      // a date, a call, a query value under 16 characters with no digit or no letter
      j('pass', 'word_changed: ', '2026-11-05T12:00:00Z'),
      j('const pass', 'word = ', 'readSecret2026x(user);'),
      j('<a href="/login?', 'pass', 'word=', 'forgottenpass', '">'),
      j('<a href="/x?', 'sec', 'ret=', '1234567890123', '">'),
    ];
    assert.deepEqual(scanText(quiet.join('\n')).map((h) => [h.line, h.rule]), []);
  });

  await check('a long run of letters and dashes scans in linear time: four times the text takes about four times as long', () => {
    // bounded name parts keep this linear; an unbounded `[\w.-]*` before a word made it quadratic, and a minified
    // script is exactly such a run. Timing two sizes (best of three each) asks for growth, not for a fast machine
    const text = (n: number) => j('ab-'.repeat(n), 'x-tok', 'en', '-', 'a.b'.repeat(n));
    const best = (n: number): number => {
      const t = text(n);
      let min = Infinity;
      for (let i = 0; i < 3; i++) {
        const start = process.hrtime.bigint();
        scanText(t);
        min = Math.min(min, Number(process.hrtime.bigint() - start) / 1e6);
      }
      return min;
    };
    best(2_000); // warm the regex engine
    const small = Math.max(best(10_000), 1);
    const large = best(40_000);
    assert.ok(large / small < 8, `4x the text took ${(large / small).toFixed(1)}x as long (${small.toFixed(1)} ms, ${large.toFixed(1)} ms); linear is ~4, quadratic ~16`);
  });

  await check('round 4: a long run of name:name:… with no end scans in linear time (the unquoted value is bounded)', () => {
    const text = (n: number) => j('x:'.repeat(n), '(');
    const best = (n: number): number => {
      const t = text(n);
      let min = Infinity;
      for (let i = 0; i < 3; i++) {
        const start = process.hrtime.bigint();
        scanText(t);
        min = Math.min(min, Number(process.hrtime.bigint() - start) / 1e6);
      }
      return min;
    };
    best(1_000);
    const small = Math.max(best(5_000), 1);
    const large = best(20_000);
    assert.ok(large / small < 8, `4x the text took ${(large / small).toFixed(1)}x as long (${small.toFixed(1)} ms, ${large.toFixed(1)} ms); linear is ~4, quadratic ~16`);
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

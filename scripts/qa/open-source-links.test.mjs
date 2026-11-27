import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const product = JSON.parse(readFileSync(new URL('../../branding/product.json', import.meta.url), 'utf8'));
const helpPatch = readFileSync(new URL('../../patches/vscode/015-ritemark-help-menu-policy.patch', import.meta.url), 'utf8');

test('link protection trusts the Ritemark repository and its subpages only on GitHub', () => {
  const githubEntries = product.linkProtectionTrustedDomains.filter(domain => /github\.com|^\*$/.test(domain));
  assert.deepEqual(githubEntries, ['https://github.com/ProductoryHQ/ritemark-native']);
});

test('the Help GitHub links have distinct mnemonics alongside Support, Getting started, and Send feedback', () => {
  const mnemonicTitle = key => helpPatch.match(new RegExp(`^\\+.*key: '${key}',.*"([^"\\n]+)"`, 'm'))?.[1];
  const github = mnemonicTitle('miRitemarkGitHub');
  const discussions = mnemonicTitle('miRitemarkDiscussions');
  assert.equal(github, 'Ritemark on Git&&Hub');
  assert.equal(discussions, '&&Discussions');
  const titles = [mnemonicTitle('miSupport'), mnemonicTitle('miRitemarkGettingStarted'), mnemonicTitle('miRitemarkSendFeedback'), github, discussions];
  const mnemonics = titles.map(title => title.match(/&&([a-z])/i)?.[1].toUpperCase());
  assert.ok(mnemonics.every(Boolean));
  assert.equal(new Set(mnemonics).size, titles.length);
});

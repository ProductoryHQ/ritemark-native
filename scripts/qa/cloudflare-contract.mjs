#!/usr/bin/env node
// cloudflare-contract.mjs — Sprint 149's A4: the live measurements M1–M10 on the Cloudflare test account, through
// Ritemark's own client, host and upload path (extensions/ritemark/src/publish/), never a second implementation.
//
//   RITEMARK_BUILD_CHANNEL=test RITEMARK_TEST_PROFILE=/private/tmp/rm-a4 \
//     scripts/qa/with-test-keys.sh --require cloudflare,cloudflare-account-id \
//       -- node scripts/qa/cloudflare-contract.mjs --user-data-dir=/private/tmp/rm-a4 [--register-subdomain <name>]
//
//   node scripts/qa/cloudflare-contract.mjs --fake --user-data-dir=<folder>   # the same run against the 127.0.0.1 fake
//
// What it does, in order (technical-plan.md, A4): M1 the account from the token; M10 the token may publish; M2 the
// workers.dev name (registered only with --register-subdomain, and never over an existing one); M3–M5 a first
// publish of a three-file page as a Worker named `ritemark-a4-<random>`; M6 the time to the first 200; M7 noindex on
// `/`, `/index.html`, a picture and a 404; M8 an update (only the changed file uploads; a dropped file is gone); M9
// Unpublish and the time until the address stops answering. M11 (the Workers Admin role) is read in Cloudflare's
// dashboard, not here. Every Worker it creates is deleted in `finally`, and the run ends by listing any
// `ritemark-a4-*` Worker still on the account (none, or it fails).
//
// The token comes only from CLOUDFLARE_API_TOKEN (with-test-keys.sh puts it there) and goes only into the client's
// Authorization header. Every line printed or written is redacted (the token, the account ID, any JWT). Results go to
// <user-data-dir>/cloudflare-contract.json. Exit 0 only when every measurement passed.

import { createRequire } from 'node:module';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXT = path.join(ROOT, 'extensions', 'ritemark');
const args = process.argv.slice(2);
const fake = args.includes('--fake');
const dirArg = args.find((a) => a.startsWith('--user-data-dir='))?.slice('--user-data-dir='.length);
const registerIndex = args.indexOf('--register-subdomain');
const registerName = registerIndex >= 0 ? args[registerIndex + 1] : undefined;
if (!dirArg) {
	console.error('usage: cloudflare-contract.mjs [--fake] --user-data-dir=<folder> [--register-subdomain <name>]');
	process.exit(2);
}

// The product's TypeScript, loaded through the extension's own tsx
const require = createRequire(path.join(EXT, 'package.json'));
const tsx = require('tsx/cjs/api');
const load = async (rel) => tsx.require(path.join(EXT, rel), fileURLToPath(import.meta.url));
const { CloudflareAccount } = await load('src/publish/cloudflare/account.ts');
const { CloudflareClient } = await load('src/publish/cloudflare/client.ts');
const { CloudflareHost } = await load('src/publish/cloudflare/CloudflareHost.ts');
const { redact } = await load('src/publish/cloudflare/redact.ts');
const { readVerifiedUpload } = await load('src/publish/host.ts');
const { testProject } = await load('src/publish/cloudflare/testing/pages.ts');

let fakeServer;
let token = process.env.CLOUDFLARE_API_TOKEN ?? '';
let expectedAccount = process.env.CLOUDFLARE_ACCOUNT_ID ?? '';
if (fake) {
	const { FakeCloudflare } = await load('src/publish/cloudflare/testing/fakeCloudflare.ts');
	fakeServer = await new FakeCloudflare().start();
	token = `fake${Math.random().toString(36).slice(2)}${'x'.repeat(24)}`;
	fakeServer.tokens.set(token, 'ok');
	expectedAccount = fakeServer.accounts[0].id;
}
if (!token) {
	console.error('CLOUDFLARE_API_TOKEN is not set: run this through scripts/qa/with-test-keys.sh --require cloudflare,cloudflare-account-id');
	process.exit(2);
}

const secrets = () => [token, expectedAccount];
const say = (line) => console.log(redact(line, secrets()));
const logLines = [];
const results = [];
const record = (id, pass, detail) => {
	results.push({ id, pass, detail: redact(detail, secrets()) });
	say(`${pass ? 'PASS' : 'FAIL'} ${id}: ${detail}`);
};

const memory = new Map();
const account = new CloudflareAccount({
	secrets: { get: async (k) => memory.get(k), store: async (k, v) => { memory.set(k, v); }, delete: async (k) => { memory.delete(k); } },
	makeClient: (t) => new CloudflareClient({
		fetch: (url, init) => fetch(url, init),
		token: t,
		...(fake ? { apiBase: fakeServer.apiBase, addressBase: fakeServer.base, sleep: async () => {} } : {}),
		log: (l) => logLines.push(l),
	}),
});
const host = new CloudflareHost(account, { log: (l) => logLines.push(l), ...(fake ? { sleep: async () => {}, pollMs: 0 } : { unpublishDeadlineMs: 300_000 }) });
const publicFetch = (address, init) => (fake
	? fetch(`${fakeServer.base}/__site/${new URL(address).hostname}${new URL(address).pathname}`, init)
	: fetch(address, { ...init, redirect: 'manual', headers: { 'Cache-Control': 'no-cache' } }));

const siteName = `ritemark-a4-${Math.random().toString(16).slice(2, 8).padEnd(6, '0')}`;
let project;
let published;
const started = Date.now();
try {
	// M1 + M10: the token alone gives the account and may publish (the product's own connect)
	const outcome = await account.connectWithToken(token);
	const accountId = account.accountId();
	record('M1+M10 connect', outcome === 'connected' && accountId === expectedAccount,
		`token check "${outcome}"; account ${accountId === expectedAccount ? 'matches CLOUDFLARE_ACCOUNT_ID' : 'does NOT match CLOUDFLARE_ACCOUNT_ID'}; name "${account.snapshot().accountName}"`);
	if (outcome !== 'connected') throw new Error('not connected: nothing else can be measured');

	// M2: the workers.dev name
	let subdomain = await host.refreshSubdomain();
	record('M2 read', true, subdomain ? `the account has a workers.dev name: ${subdomain}` : 'the account has no workers.dev name (10007)');
	if (!subdomain && registerName) {
		subdomain = await host.chooseSubdomain(registerName);
		record('M2 register', subdomain === registerName, `registered ${subdomain}`);
	}
	if (!subdomain) throw new Error('no workers.dev name: run again with --register-subdomain <name> to measure the rest');

	// M3–M5: a first publish of a real three-file page, through PR 3's gather and the bytes-by-hash read
	project = await testProject();
	const plan = await project.gather();
	const first = Date.now();
	published = await host.publish(siteName, await readVerifiedUpload(plan), { replacing: false });
	record('M3+M4+M5 deploy', true, `${siteName} deployed in ${Date.now() - first} ms at ${published.address} (sha256 asset keys accepted; metadata-only PUT; previews off asked)`);

	// M6: the time to the first 200
	const waitStart = Date.now();
	let status = 0;
	while (Date.now() - waitStart < 180_000) {
		status = (await publicFetch(published.address).catch(() => ({ status: 0 }))).status;
		if (status === 200) break;
		await new Promise((r) => setTimeout(r, fake ? 0 : 1_000));
	}
	record('M6 first 200', status === 200, `${status === 200 ? 'answered' : `still ${status}`} after ${Date.now() - waitStart} ms`);

	// M7: noindex on /, /index.html, a picture and a 404
	const checks = [['/', 200], ['/index.html', null], ['/img/a.png', 200], ['/nothing-here.png', 404]];
	for (const [p, want] of checks) {
		const res = await publicFetch(new URL(p, published.address).toString());
		const robots = res.headers.get('x-robots-tag');
		record(`M7 noindex ${p}`, /noindex/i.test(robots ?? '') && (want === null || res.status === want), `HTTP ${res.status}, X-Robots-Tag: ${robots ?? 'none'}`);
	}

	// M8: an update sends only the changed file, keeps the address, and a dropped file is gone
	await project.write('Harbour programme.html', '<link rel="stylesheet" href="style.css"><h1>Harbour, updated</h1>');
	const before = logLines.length;
	const again = await host.publish(siteName, await readVerifiedUpload(await project.gather()), { replacing: true });
	const uploadedLine = logLines.slice(before).find((l) => /deployed, \d+ of \d+ files uploaded/.test(l)) ?? '';
	const dropped = await publicFetch(new URL('/img/a.png', published.address).toString());
	record('M8 update', again.address === published.address && /deployed, 1 of 2 files uploaded/.test(uploadedLine) && dropped.status === 404,
		`same address: ${again.address === published.address}; ${uploadedLine.replace(/^\[publish\] /, '') || 'no upload line'}; the dropped picture answers ${dropped.status}`);

	// M9: Unpublish, and the time until the address stops answering
	const down = Date.now();
	let slowAt = null;
	await host.unpublish(siteName, published.address, { onSlow: () => { slowAt = Date.now() - down; } });
	published = null;
	record('M9 unpublish', true, `the address stopped answering ${Date.now() - down} ms after the delete${slowAt !== null ? ` ("still taking the page down" at ${slowAt} ms)` : ''}`);
} catch (error) {
	record('run', false, String(error?.message ?? error));
} finally {
	if (published) {
		await account.client().deleteScript(account.accountId(), siteName).then(
			() => say(`cleanup: deleted ${siteName}`),
			(e) => say(`cleanup: COULD NOT delete ${siteName}: ${e?.message ?? e}`),
		);
	}
	try {
		const left = account.accountId() ? await listLeftovers() : [];
		record('cleanup', left.length === 0, left.length === 0 ? 'no ritemark-a4-* Worker left on the account' : `left on the account: ${left.join(', ')}`);
	} catch (e) {
		record('cleanup', false, `could not list the account's Workers: ${e?.message ?? e}`);
	}
	await project?.cleanup();
	await fakeServer?.stop();
	say('M11 (Workers Admin role) and the token template link (M10\'s second half) are read in Cloudflare\'s dashboard; note them in qa-evidence.md.');
	await fs.mkdir(dirArg, { recursive: true });
	await fs.writeFile(path.join(dirArg, 'cloudflare-contract.json'), redact(JSON.stringify({ fake, siteName, ms: Date.now() - started, results, log: logLines }, null, 2), secrets()));
	const failed = results.filter((r) => !r.pass).length;
	say(`${results.length - failed}/${results.length} passed; results in ${path.join(dirArg, 'cloudflare-contract.json')}`);
	process.exitCode = failed ? 1 : 0;
}

async function listLeftovers() {
	// Every run's Workers, this one's and any earlier one's
	return (await account.client().scriptNames(account.accountId())).filter((n) => n.startsWith('ritemark-a4-'));
}

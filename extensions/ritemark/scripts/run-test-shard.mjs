#!/usr/bin/env node
// Runs one shard of the extension's `npm test` chain, so CI can split the full set across
// several machines. The chain stays defined in one place, package.json's "test" script;
// this file only splits it at " && " and runs every Nth command.
//
//   node scripts/run-test-shard.mjs <index> <count>     e.g. 0 4, 1 4, 2 4, 3 4
//
// Every command in the shard runs, even after a failure, so one red run names every failing
// test file. Exits 1 if any failed.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const [index, count] = process.argv.slice(2).map(Number);
if (!Number.isInteger(index) || !Number.isInteger(count) || count < 1 || index < 0 || index >= count) {
	console.error('usage: run-test-shard.mjs <index> <count>');
	process.exit(2);
}

const chain = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts.test;
const commands = chain.split(' && ').map((c) => c.trim()).filter(Boolean);
const mine = commands.filter((_, i) => i % count === index);
const failed = [];

console.log(`shard ${index + 1}/${count}: ${mine.length} of ${commands.length} commands`);
for (const command of mine) {
	console.log(`\n▶ ${command}`);
	const started = Date.now();
	const result = spawnSync(command, { shell: true, stdio: 'inherit' });
	const seconds = ((Date.now() - started) / 1000).toFixed(1);
	if (result.status !== 0) {
		failed.push(command);
		console.log(`✖ FAILED (${seconds}s): ${command}`);
	} else {
		console.log(`✓ ${seconds}s`);
	}
}

console.log(`\nshard ${index + 1}/${count}: ${mine.length - failed.length} passed, ${failed.length} failed`);
for (const command of failed) console.log(`✖ FAILED: ${command}`);
process.exit(failed.length ? 1 : 0);

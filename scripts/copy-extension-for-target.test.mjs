import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { copyExtensionForTarget } from './copy-extension-for-target.mjs';

function write(root, relative, contents = relative) {
	const target = path.join(root, relative);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, contents);
}

function snapshot(root) {
	const entries = [];
	const walk = current => {
		for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
			const absolute = path.join(current, entry.name);
			const relative = path.relative(root, absolute).split(path.sep).join('/');
			if (entry.isDirectory()) {
				entries.push([relative, 'directory']);
				walk(absolute);
			} else if (entry.isSymbolicLink()) {
				entries.push([relative, 'symlink', fs.readlinkSync(absolute)]);
			} else {
				entries.push([relative, 'file', fs.readFileSync(absolute, 'hex')]);
			}
		}
	};
	walk(root);
	return entries;
}

function fixture() {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-extension-copy-'));
	const source = path.join(root, 'source');
	fs.mkdirSync(source);
	write(source, 'package.json', '{"name":"ritemark-test"}\n');
	write(source, '.hidden', 'kept');
	write(source, 'src/extension.ts', 'export {};');
	write(source, 'binaries/README.md', 'shared');
	write(source, 'binaries/agents/manifest.json', '{"runtimes":[]}');
	for (const target of ['darwin-arm64', 'darwin-x64', 'win32-x64']) {
		write(source, `binaries/agents/${target}/agent`, target);
	}
	write(source, 'binaries/darwin-arm64/libwhisper.1.dylib', 'native');
	try {
		fs.symlinkSync('libwhisper.1.dylib', path.join(source, 'binaries/darwin-arm64/libwhisper.dylib'));
	} catch {
		write(source, 'binaries/darwin-arm64/libwhisper.dylib', 'symlink-placeholder');
	}
	return { root, source };
}

test('target copy is immutable and filters foreign native payloads', () => {
	const { root, source } = fixture();
	try {
		const before = snapshot(source);
		for (const target of ['darwin-arm64', 'darwin-x64', 'win32-x64']) {
			const destination = path.join(root, `copy-${target}`);
			copyExtensionForTarget({ source, destination, target });
			assert.equal(fs.readFileSync(path.join(destination, '.hidden'), 'utf8'), 'kept');
			assert.ok(fs.existsSync(path.join(destination, 'binaries/agents', target, 'agent')));
			for (const foreign of ['darwin-arm64', 'darwin-x64', 'win32-x64'].filter(value => value !== target)) {
				assert.equal(fs.existsSync(path.join(destination, 'binaries/agents', foreign)), false);
			}
			assert.equal(
				fs.existsSync(path.join(destination, 'binaries/darwin-arm64')),
				target === 'darwin-arm64',
			);
			assert.deepEqual(snapshot(source), before);
		}
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test('copy refuses overlapping source and destination paths', () => {
	const { root, source } = fixture();
	try {
		assert.throws(
			() => copyExtensionForTarget({ source, destination: path.join(source, 'nested-copy'), target: 'win32-x64' }),
			/must not overlap/,
		);
		assert.throws(
			() => copyExtensionForTarget({ source, destination: root, target: 'win32-x64' }),
			/must not overlap/,
		);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test('command-line entrypoint performs a target copy', () => {
	const { root, source } = fixture();
	try {
		const destination = path.join(root, 'cli-copy');
		const script = fileURLToPath(new URL('./copy-extension-for-target.mjs', import.meta.url));
		execFileSync(process.execPath, [
			script,
			'--source', source,
			'--destination', destination,
			'--target', 'win32-x64',
		]);
		assert.ok(fs.existsSync(path.join(destination, 'binaries/agents/win32-x64/agent')));
		assert.equal(fs.existsSync(path.join(destination, 'binaries/darwin-arm64')), false);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test('release callers use the immutable target copier', () => {
	const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
	const callers = [
		['.github/workflows/build-macos-x64.yml', 'darwin-x64'],
		['.github/workflows/build-windows.yml', 'win32-x64'],
		['scripts/build-prod-windows.sh', 'win32-x64'],
		['scripts/build-windows-local.ps1', 'win32-x64'],
	];
	for (const [relative, target] of callers) {
		const contents = fs.readFileSync(path.join(projectRoot, relative), 'utf8');
		const fetchIndex = contents.indexOf('fetch-agent-runtimes.sh');
		const copyIndex = contents.indexOf('copy-extension-for-target.mjs');
		assert.notEqual(fetchIndex, -1, `${relative} must fetch the target runtime`);
		assert.ok(fetchIndex < copyIndex, `${relative} must fetch the target runtime before copying`);
		assert.match(contents, /copy-extension-for-target\.mjs/);
		assert.match(contents, new RegExp(`--target ${target}`));
		assert.doesNotMatch(contents, /rm -rf extensions\/ritemark\/binaries\/darwin-arm64/);
		assert.doesNotMatch(contents, /Rename-Item[^\r\n]*darwin/i);
	}
});

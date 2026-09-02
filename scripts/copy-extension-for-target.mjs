#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const supportedTargets = new Set(['darwin-arm64', 'darwin-x64', 'win32-x64']);
const platformDirectoryPattern = /^(?:darwin|win32|linux)-(?:arm64|x64)$/;

function usage() {
	console.log(`Usage: node scripts/copy-extension-for-target.mjs \\
  --source PATH --destination PATH --target darwin-arm64|darwin-x64|win32-x64`);
}

function isInside(parent, candidate) {
	const relative = path.relative(parent, candidate);
	return relative === '' || (!path.isAbsolute(relative) && relative.split(path.sep)[0] !== '..');
}

function shouldCopy(sourceRoot, target, candidate) {
	const relative = path.relative(sourceRoot, candidate);
	if (!relative) return true;

	const segments = relative.split(path.sep);
	if (segments[0] !== 'binaries') return true;

	// Platform-specific extension binaries (currently macOS dictation) are
	// copied only into a matching target. Filtering the directory before fs.cp
	// descends into it avoids Windows trying to materialize macOS dylib symlinks.
	if (platformDirectoryPattern.test(segments[1] || '')) {
		return segments[1] === target;
	}

	// Agent manifests/readmes are shared, but runtime payloads are target-only.
	if (segments[1] === 'agents' && platformDirectoryPattern.test(segments[2] || '')) {
		return segments[2] === target;
	}

	return true;
}

export function copyExtensionForTarget({ source, destination, target }) {
	if (!supportedTargets.has(target)) {
		throw new Error(`unsupported target: ${target}`);
	}

	const sourceRoot = path.resolve(source);
	const destinationRoot = path.resolve(destination);
	if (!fs.statSync(sourceRoot, { throwIfNoEntry: false })?.isDirectory()) {
		throw new Error(`extension source is not a directory: ${sourceRoot}`);
	}
	if (isInside(sourceRoot, destinationRoot) || isInside(destinationRoot, sourceRoot)) {
		throw new Error('extension source and destination must not overlap');
	}

	fs.rmSync(destinationRoot, { recursive: true, force: true });
	fs.mkdirSync(path.dirname(destinationRoot), { recursive: true });
	fs.cpSync(sourceRoot, destinationRoot, {
		recursive: true,
		dereference: false,
		preserveTimestamps: true,
		filter: candidate => shouldCopy(sourceRoot, target, candidate),
	});

	if (!fs.existsSync(path.join(destinationRoot, 'package.json'))) {
		throw new Error('copied extension is missing package.json');
	}
	if (!fs.existsSync(path.join(destinationRoot, 'binaries', 'agents', target))) {
		throw new Error(`copied extension is missing the ${target} agent runtime directory`);
	}

	const agentsRoot = path.join(destinationRoot, 'binaries', 'agents');
	const foreignAgents = fs.readdirSync(agentsRoot, { withFileTypes: true })
		.filter(entry => entry.isDirectory() && platformDirectoryPattern.test(entry.name) && entry.name !== target)
		.map(entry => entry.name);
	if (foreignAgents.length > 0) {
		throw new Error(`copied extension contains foreign agent runtimes: ${foreignAgents.join(', ')}`);
	}
	if (target !== 'darwin-arm64' && fs.existsSync(path.join(destinationRoot, 'binaries', 'darwin-arm64'))) {
		throw new Error(`copied ${target} extension contains darwin-arm64 native binaries`);
	}

	console.log(`Extension copied for ${target}: ${sourceRoot} -> ${destinationRoot}`);
}

const args = process.argv.slice(2);
const options = {};
for (let index = 0; index < args.length; index += 1) {
	const arg = args[index];
	if (arg === '--source') options.source = args[++index];
	else if (arg === '--destination') options.destination = args[++index];
	else if (arg === '--target') options.target = args[++index];
	else if (arg === '-h' || arg === '--help') {
		usage();
		process.exit(0);
	} else {
		console.error(`ERROR: unknown argument: ${arg}`);
		usage();
		process.exit(2);
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	try {
		if (!options.source || !options.destination || !options.target) {
			throw new Error('--source, --destination, and --target are required');
		}
		copyExtensionForTarget(options);
	} catch (error) {
		console.error(`EXTENSION COPY BLOCKED: ${error.message}`);
		process.exit(1);
	}
}

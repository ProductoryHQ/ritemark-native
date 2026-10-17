#!/usr/bin/env node
/**
 * check-patch-stacking.mjs - No patch may build on another patch's lines.
 *
 * Usage: node ./scripts/check-patch-stacking.mjs [--verbose]
 *
 * Each patch in patches/vscode/ should apply to upstream VS Code lines only, so
 * that a VS Code update regenerates each patch on its own. A patch "stacks" on
 * an earlier one when one of its hunks removes, or uses as context, a line that
 * the earlier patch adds to the same file. Then the later patch has to be
 * regenerated every time the earlier one changes.
 *
 * This check compares, for every hunk of every patch, its removed and context
 * lines with the lines that earlier patches (in file-name order) add to the same
 * file. Blank lines and lines of punctuation only are ignored: they match by
 * chance. It fails on any stacked pair that is not on the known list below.
 *
 * Text only: it reads the patch files and nothing else, so it runs without the
 * vscode/ submodule (pre-commit Check 14, Sprint 132, E1).
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PATCHES_DIR = join(ROOT, 'patches', 'vscode');

// Pairs that stack today and are allowed to: "earlier>later" by patch number.
// 009 → 010: the browser action bridge builds on the context bridge.
// 001 → 016 → 017: the Getting Started page's policy and launch-check fixes.
// 003 ↔ 015: the menu bar and the actions list (menu cleanup, Help menu policy).
const KNOWN_PAIRS = new Set(['009>010', '001>016', '001>017', '016>017', '003>015']);

const verbose = process.argv.includes('--verbose');

/** A line too plain to tell one patch's text from upstream's. */
function isTrivial(text) {
	const trimmed = text.trim();
	return trimmed.length < 4 || /^[\s{}()[\];,.:'"`]*$/.test(trimmed);
}

/** Parse a unified diff into { file -> { added: string[], hunks: [{ header, lines: [{ kind, text }] }] } }. */
function parsePatch(text) {
	const files = new Map();
	let current;
	let hunk;
	for (const line of text.split('\n')) {
		if (line.startsWith('diff --git ')) {
			const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
			const file = match ? match[2] : line;
			current = { added: [], hunks: [] };
			files.set(file, current);
			hunk = undefined;
			continue;
		}
		if (!current) {
			continue; // the patch's header
		}
		if (line.startsWith('@@')) {
			hunk = { header: line, lines: [] };
			current.hunks.push(hunk);
			continue;
		}
		if (!hunk || line.startsWith('+++') || line.startsWith('---') || line.startsWith('\\')) {
			continue;
		}
		const kind = line[0];
		const body = line.slice(1);
		if (kind === '+') {
			current.added.push(body);
			hunk.lines.push({ kind, text: body });
		} else if (kind === '-' || kind === ' ') {
			hunk.lines.push({ kind, text: body });
		}
	}
	return files;
}

const patches = readdirSync(PATCHES_DIR)
	.filter(name => /^\d{3}-.*\.patch$/.test(name))
	.sort()
	.map(name => ({ name, number: name.slice(0, 3), files: parsePatch(readFileSync(join(PATCHES_DIR, name), 'utf8')) }));

const unknown = [];
const known = new Map();

patches.forEach((later, index) => {
	for (const [file, { hunks }] of later.files) {
		for (const earlier of patches.slice(0, index)) {
			const earlierFile = earlier.files.get(file);
			if (!earlierFile) {
				continue;
			}
			const added = new Set(earlierFile.added.filter(text => !isTrivial(text)));
			if (added.size === 0) {
				continue;
			}
			for (const hunk of hunks) {
				const hits = hunk.lines.filter(({ kind, text }) => (kind === '-' || kind === ' ') && added.has(text));
				if (hits.length === 0) {
					continue;
				}
				const pair = `${earlier.number}>${later.number}`;
				const hit = { pair, file, hunk: hunk.header, lines: hits.map(({ kind, text }) => `${kind}${text}`) };
				if (KNOWN_PAIRS.has(pair)) {
					known.set(pair, (known.get(pair) ?? 0) + 1);
				} else {
					unknown.push(hit);
				}
			}
		}
	}
});

if (verbose && known.size) {
	for (const [pair, count] of known) {
		console.log(`known  ${pair.replace('>', ' -> ')}: ${count} hunk(s)`);
	}
}

if (unknown.length) {
	console.error(`Patch stacking: ${unknown.length} hunk(s) build on another patch's lines:`);
	for (const hit of unknown) {
		const [earlier, later] = hit.pair.split('>');
		console.error(`\n  ${later} builds on ${earlier} in ${hit.file}`);
		console.error(`  ${hit.hunk}`);
		for (const line of hit.lines.slice(0, 5)) {
			console.error(`    ${line}`);
		}
	}
	console.error('\nMove the line into the patch that owns the file, or regenerate the hunk so it does not touch the other patch\'s lines (Sprint 132, E1).');
	process.exit(1);
}

console.log(`Patch stacking OK: ${patches.length} patches, no hunk builds on another patch's lines outside the known pairs.`);

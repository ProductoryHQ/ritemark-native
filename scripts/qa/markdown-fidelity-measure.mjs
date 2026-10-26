#!/usr/bin/env node
/**
 * markdown-fidelity-measure.mjs — what open and save does to a folder of Markdown files (Sprint 137, R9).
 *
 * Usage (from the repository root; tsx loads the editor's TypeScript):
 *   extensions/ritemark/node_modules/.bin/tsx scripts/qa/markdown-fidelity-measure.mjs [--harness <module>]
 *       [--list] [--json] <folder|file> [...]
 *
 * Every `.md` file under the folders (no `node_modules`, `.git` or dot-folders), and every file named on the command
 * line, is opened and saved twice through
 * the editor's own load and save code, outside the app (`webview/src/utils/markdownFidelity.ts`: the host's front
 * matter split, `markdownToEditorHTML`, TipTap's schema, `getHTML()`, `editorHTMLToMarkdown`, the host's join).
 * `--harness` points at another copy of that module, to measure another tree's pipeline (`main` before a change).
 *
 * It prints counts only: how many files come back byte for byte, change again on a second save, lose links or
 * images, or gain trailing whitespace, and how many touch each kind of rewrite. No file is copied and no text is
 * printed; with --list it adds the paths of the files in each class (never their contents). It is a QA tool, not
 * a gate: the classes come from a line classifier and are approximate.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const option = name => {
	const index = args.indexOf(`--${name}`);
	return index === -1 ? undefined : args[index + 1];
};
const list = args.includes('--list');
const json = args.includes('--json');
const harnessPath = option('harness');
const folders = args.filter((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--harness');
if (folders.length === 0) {
	console.error('usage: tsx scripts/qa/markdown-fidelity-measure.mjs [--harness <module>] [--list] [--json] <folder> ...');
	process.exit(2);
}

const here = dirname(fileURLToPath(import.meta.url));
const defaultHarness = resolve(here, '../../extensions/ritemark/webview/src/utils/markdownFidelity.ts');
const harness = await import(pathToFileURL(resolve(harnessPath ?? defaultHarness)).href);
harness.installTestDocument();

function markdownFiles(folder, out = []) {
	try {
		if (statSync(folder).isFile()) {
			out.push(folder);
			return out;
		}
	} catch {
		return out;
	}
	let entries;
	try {
		entries = readdirSync(folder);
	} catch {
		return out;
	}
	for (const name of entries) {
		if (name === 'node_modules' || name.startsWith('.')) {
			continue;
		}
		const path = join(folder, name);
		let stats;
		try {
			stats = statSync(path);
		} catch {
			continue;
		}
		if (stats.isDirectory()) {
			markdownFiles(path, out);
		} else if (/\.md$/i.test(name)) {
			out.push(path);
		}
	}
	return out;
}

// ── The classifier: what a save changed, by kind ──

const count = (text, pattern) => (text.match(pattern) || []).length;
const outsideFences = text => text.replace(/^(\s*)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1\2[^\n]*$/gm, '');
const frontMatter = text => (/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)\n*/.exec(text) || [''])[0];
const listLine = /^\s*(?:[-*+]|\d{1,9}[.)])\s+\S/;

function adjacentListLines(text) {
	const lines = outsideFences(text).split('\n');
	let pairs = 0;
	for (let index = 1; index < lines.length; index++) {
		if (listLine.test(lines[index]) && listLine.test(lines[index - 1])) {
			pairs++;
		}
	}
	return pairs;
}
function textThenList(text) {
	const lines = outsideFences(text).split('\n');
	let pairs = 0;
	for (let index = 1; index < lines.length; index++) {
		if (/^\s*[-*+]\s+\S/.test(lines[index]) && lines[index - 1].trim() && !listLine.test(lines[index - 1]) && !/^\s*[#>|]/.test(lines[index - 1])) {
			pairs++;
		}
	}
	return pairs;
}

const CLASSES = [
	['A blank line holding spaces', (a, b) => count(b, /^[ \t]+$/gm) > count(a, /^[ \t]+$/gm)],
	['A tight list made loose', (a, b) => adjacentListLines(b) < adjacentListLines(a)],
	['A bullet padded to `-   item`', (a, b) => count(b, /^\s*[-*+] {3}\S/gm) > count(a, /^\s*[-*+] {3}\S/gm)],
	['A soft line break written as two trailing spaces', (a, b) => count(outsideFences(b), /\S {2}$/gm) > count(outsideFences(a), /\S {2}$/gm)],
	['An ordered item padded to `1.  item`', (a, b) => count(b, /^\s*\d+\. {2}\S/gm) > count(a, /^\s*\d+\. {2}\S/gm)],
	['A table delimiter row rewritten', (a, b) => {
		const rows = text => (outsideFences(text).match(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/gm) || []).join('\n');
		return rows(a) !== rows(b);
	}],
	['A blank line added between a line of text and the list under it', (a, b) => textThenList(b) < textThenList(a)],
	['A thematic break `---` written as `* * *`', (a, b) => count(b, /^\* \* \*$/gm) > count(a, /^\* \* \*$/gm)],
	['A number escaped (`1\\.`)', (a, b) => count(b, /\d\\[.)]/g) > count(a, /\d\\[.)]/g)],
	['`*`, `+`, `-` or `#` escaped', (a, b) => count(b, /\\[*+\-#]/g) > count(a, /\\[*+\-#]/g)],
	['Inline or block HTML dropped', (a, b) => count(outsideFences(b), /<[a-z!/][^>]*>/gi) < count(outsideFences(a), /<[a-z!/][^>]*>/gi)],
	['An underscore escaped inside a word', (a, b) => count(b, /[\p{L}\p{N}]\\_[\p{L}\p{N}]/gu) > count(a, /[\p{L}\p{N}]\\_[\p{L}\p{N}]/gu)],
	['A bare or `<…>` address written as `[url](url)`', (a, b) => count(b, /\[((?:https?:|mailto:)?[^\]\s]+)\]\((?:mailto:)?\1\)/g) > count(a, /\[((?:https?:|mailto:)?[^\]\s]+)\]\((?:mailto:)?\1\)/g)],
	['A square bracket escaped', (a, b) => count(b, /\\[[\]]/g) > count(a, /\\[[\]]/g)],
	['A `*` or `+` bullet changed to `-`', (a, b) => count(b, /^\s*[*+]\s+\S/gm) < count(a, /^\s*[*+]\s+\S/gm)],
	['A code fence given a language (`plaintext`)', (a, b) => count(b, /^\s*`{3,}plaintext/gm) > count(a, /^\s*`{3,}plaintext/gm)],
	['Front matter rewritten', (a, b) => frontMatter(a) !== '' && frontMatter(a) !== frontMatter(b)],
	['A setext heading changed to `#`', (a, b) => count(b, /^[=-]{2,}\s*$/gm) < count(a, /^[=-]{2,}\s*$/gm) && count(b, /^#{1,2} /gm) > count(a, /^#{1,2} /gm)],
];

// ── The run ──

const files = folders.flatMap(folder => markdownFiles(resolve(folder)));
const results = {
	files: 0,
	failed: 0,
	identical: 0,
	changesOnSecondSave: 0,
	fewerLinks: 0,
	fewerImages: 0,
	newTrailingWhitespace: 0,
	classes: Object.fromEntries(CLASSES.map(([name]) => [name, 0])),
};
const listed = Object.fromEntries([...CLASSES.map(([name]) => name), 'not byte-identical', 'changes on a second save', 'fewer links', 'fewer images', 'new trailing whitespace'].map(name => [name, []]));

for (const path of files) {
	let original;
	try {
		original = readFileSync(path, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
	} catch {
		continue;
	}
	results.files++;
	let first;
	let second;
	let after;
	try {
		const opened = harness.openDocument(original);
		first = harness.saveDocument(opened);
		const reopened = harness.openDocument(first);
		second = harness.saveDocument(reopened);
		after = harness.inventory(harness.openDocument(second).doc);
	} catch (error) {
		results.failed++;
		if (list) {
			console.error(`could not open and save: ${path}: ${error instanceof Error ? error.message.split('\n')[0] : error}`);
		}
		continue;
	}
	if (first === original) {
		results.identical++;
	} else {
		listed['not byte-identical'].push(path);
	}
	if (second !== first) {
		results.changesOnSecondSave++;
		listed['changes on a second save'].push(path);
	}
	// Against what the file holds: a link the editor drops on open is lost too.
	const source = harness.sourceInventory(original);
	if (after.links.length < source.links.length) {
		results.fewerLinks++;
		listed['fewer links'].push(path);
	}
	if (after.images.length < source.images.length) {
		results.fewerImages++;
		listed['fewer images'].push(path);
	}
	if (harness.trailingWhitespaceLines(first).length > harness.trailingWhitespaceLines(original).length) {
		results.newTrailingWhitespace++;
		listed['new trailing whitespace'].push(path);
	}
	for (const [name, test] of CLASSES) {
		if (test(original, first)) {
			results.classes[name]++;
			listed[name].push(path);
		}
	}
}

const percent = value => results.files ? `${Math.round((value / results.files) * 100)}%` : '–';
if (json) {
	console.log(JSON.stringify(results, null, 2));
} else {
	console.log(`Files: ${results.files}${results.failed ? ` (${results.failed} could not be opened and saved)` : ''}`);
	console.log('');
	console.log('| | Files | Share |');
	console.log('|---|---|---|');
	console.log(`| Byte-identical after one open and save | ${results.identical} | ${percent(results.identical)} |`);
	console.log(`| Changes again on a second save | ${results.changesOnSecondSave} | ${percent(results.changesOnSecondSave)} |`);
	console.log(`| Fewer links after two saves | ${results.fewerLinks} | ${percent(results.fewerLinks)} |`);
	console.log(`| Fewer images after two saves | ${results.fewerImages} | ${percent(results.fewerImages)} |`);
	console.log(`| New trailing whitespace | ${results.newTrailingWhitespace} | ${percent(results.newTrailingWhitespace)} |`);
	console.log('');
	console.log('| Kind of rewrite (a file can be in several) | Files | Share |');
	console.log('|---|---|---|');
	for (const [name] of CLASSES) {
		console.log(`| ${name} | ${results.classes[name]} | ${percent(results.classes[name])} |`);
	}
}
if (list) {
	for (const [name, paths] of Object.entries(listed)) {
		if (paths.length) {
			console.log(`\n## ${name} (${paths.length})\n${paths.join('\n')}`);
		}
	}
}

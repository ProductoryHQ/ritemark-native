/**
 * control-states-baseline.mjs - the approved images that no state of the catalogue captures any more (Sprint 146, R4;
 * Codex on #621). Used by control-states.mjs and tested by
 * extensions/ritemark/webview/src/components/catalogue/controlStatesScript.test.ts.
 *
 * A state deleted or renamed in the catalogue leaves its approved PNG behind, and a comparison that walks only the
 * catalogue's cells would pass without it. So a full run also fails on an approved image no cell made.
 */

import { readdirSync } from 'node:fs';

/**
 * The PNGs in `folder` that this run expected to capture but has no cell for, sorted. `expected` is the run's file
 * names (`<theme>-<cell>.png`). A run of named rows (`--only`) checks nothing: the other rows' images are rightly
 * absent from it. A run of some themes (`--themes`) checks only those themes' images; a run of every theme checks
 * every PNG.
 */
export function unmatchedApprovedImages(folder, expected, { themes, allThemes, only = [] }) {
	if (only.length) {
		return [];
	}
	const wanted = new Set(expected);
	const everyTheme = allThemes.every(name => themes.includes(name));
	return readdirSync(folder)
		.filter(file => file.endsWith('.png') && !wanted.has(file))
		.filter(file => everyTheme || themes.some(name => file.startsWith(`${name}-`)))
		.sort();
}

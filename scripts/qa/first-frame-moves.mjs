/**
 * first-frame-moves.mjs - what moved in a first-frame run (Sprint 152, R8), decided from every sample.
 *
 * `project-check.mjs --first-frame` samples the frame every 50 ms from the window's first moment. A box moved when it
 * took more than one place over the run: a box that shifts during the start and comes back to its first-frame place
 * moved too, though its first and last samples agree (Codex's review of #632). Content inside a box may change; only
 * the box is compared.
 *
 * Pure, so `first-frame-moves.test.mjs` runs it on fixture timelines with `node --test`.
 */

/**
 * @typedef {[number, number, number, number] | null} Box  x, y, width, height in CSS px, or null when not shown
 * @typedef {{ t: number, boxes: Record<string, Box> }} Sample
 * @typedef {{ name: string, steps: { box: Box, t: number }[], returned: boolean }} Move
 */

/**
 * Every box that took more than one place over the run, with each place it took and when, in order. A key missing
 * from a sample counts as not shown. `returned` is true when the box ended where it started.
 * @param {Sample[]} timeline
 * @returns {Move[]}
 */
export function frameMoves(timeline) {
	const names = new Set(timeline.flatMap(sample => Object.keys(sample.boxes)));
	const moves = [];
	for (const name of names) {
		const steps = [];
		for (const sample of timeline) {
			const box = sample.boxes[name] ?? null;
			if (steps.length === 0 || JSON.stringify(steps[steps.length - 1].box) !== JSON.stringify(box)) {
				steps.push({ box, t: sample.t });
			}
		}
		if (steps.length > 1) {
			moves.push({ name, steps, returned: JSON.stringify(steps[0].box) === JSON.stringify(steps[steps.length - 1].box) });
		}
	}
	return moves;
}

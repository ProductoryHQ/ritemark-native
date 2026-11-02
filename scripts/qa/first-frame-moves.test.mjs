/**
 * Sprint 152 (R8): the first-frame check decides movement from every sample (Codex's review of #632).
 * Run: node --test scripts/qa/first-frame-moves.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { frameMoves } from './first-frame-moves.mjs';

const desk = [256, 0, 784, 868];
const wider = [256, 0, 1184, 868];

test('a box that moves during the start and comes back is a move', () => {
	const timeline = [
		{ t: 2300, boxes: { 'the desk': desk, 'the AI column': [1040, 0, 400, 868] } },
		{ t: 2350, boxes: { 'the desk': wider, 'the AI column': null } },
		{ t: 2900, boxes: { 'the desk': desk, 'the AI column': [1040, 0, 400, 868] } },
		{ t: 5000, boxes: { 'the desk': desk, 'the AI column': [1040, 0, 400, 868] } },
	];
	// What comparing only the first and the last sample saw: nothing (the check before this fix passed it)
	const first = timeline[0].boxes;
	const last = timeline[timeline.length - 1].boxes;
	assert.deepEqual(Object.keys(first).filter(name => JSON.stringify(first[name]) !== JSON.stringify(last[name])), []);
	// Every sample: both moved, and both came back
	assert.deepEqual(frameMoves(timeline), [
		{ name: 'the desk', returned: true, steps: [{ box: desk, t: 2300 }, { box: wider, t: 2350 }, { box: desk, t: 2900 }] },
		{ name: 'the AI column', returned: true, steps: [{ box: [1040, 0, 400, 868], t: 2300 }, { box: null, t: 2350 }, { box: [1040, 0, 400, 868], t: 2900 }] },
	]);
});

test('a box that moves once, comes, or goes is a move that does not return', () => {
	const timeline = [
		{ t: 100, boxes: { 'the desk': [40, 0, 1400, 868], 'the side places bar': [0, 0, 40, 876] } },
		{ t: 380, boxes: { 'the desk': [0, 0, 1440, 868], 'tab 1 (Welcome)': [132, 8, 119, 36] } },
	];
	assert.deepEqual(frameMoves(timeline), [
		{ name: 'the desk', returned: false, steps: [{ box: [40, 0, 1400, 868], t: 100 }, { box: [0, 0, 1440, 868], t: 380 }] },
		{ name: 'the side places bar', returned: false, steps: [{ box: [0, 0, 40, 876], t: 100 }, { box: null, t: 380 }] },
		{ name: 'tab 1 (Welcome)', returned: false, steps: [{ box: null, t: 100 }, { box: [132, 8, 119, 36], t: 380 }] },
	]);
});

test('a frame that keeps every box in place has no move', () => {
	const timeline = [100, 150, 200].map(t => ({ t, boxes: { 'the desk': desk, 'head row 1': [8, 136, 240, 32] } }));
	assert.deepEqual(frameMoves(timeline), []);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { choosePlace } from './frame-places.mjs';

test('prefers the visible places row when a name appears in both', () => {
	assert.equal(choosePlace(['Tasks', 'More'], ['Tasks'], 'Tasks'), 'row');
});

test('chooses More when the requested place overflows', () => {
	assert.equal(choosePlace(['Slide library', 'More'], ['Transcribe'], 'Transcribe'), 'more');
});

test('names both locations when the requested place is missing', () => {
	assert.throws(
		() => choosePlace(['Tasks', 'More'], ['Transcribe'], 'Agents'),
		/Agents.*places row.*More places menu/,
	);
});

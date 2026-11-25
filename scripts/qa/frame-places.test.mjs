import assert from 'node:assert/strict';
import { test } from 'node:test';
import { choosePlace, placeName } from './frame-places.mjs';

test('prefers the visible places row when a name appears in both', () => {
	assert.equal(choosePlace(['Tasks', 'More'], ['Tasks'], 'Tasks'), 'row');
});

test('chooses More when the requested place overflows', () => {
	assert.equal(choosePlace(['Slide library', 'More'], ['Transcribe'], 'Transcribe'), 'more');
});

test('matches a badged place in the row or More', () => {
	const tasks = placeName('Tasks - 1 task needs you');
	assert.equal(tasks, 'Tasks');
	assert.equal(choosePlace([tasks, 'More'], [], 'Tasks'), 'row');
	assert.equal(choosePlace(['More'], [tasks], 'Tasks'), 'more');
});

test('strips a trailing keyboard shortcut', () => {
	assert.equal(placeName('Transcribe (⌥T)'), 'Transcribe');
});

test('does not match a longer place name with the same prefix', () => {
	const rowNames = ['Tasks Archive - 1 task needs you', 'More'].map(placeName);
	assert.equal(choosePlace(rowNames, ['Tasks'], 'Tasks'), 'more');
});

test('names both locations when the requested place is missing', () => {
	assert.throws(
		() => choosePlace(['Tasks', 'More'], ['Transcribe'], 'Agents'),
		/Agents.*places row.*More places menu/,
	);
});

test('strips a shortcut and a badge together', () => {
	assert.equal(placeName('Documents (⇧⌘E) - 1 unsaved file'), 'Documents');
});

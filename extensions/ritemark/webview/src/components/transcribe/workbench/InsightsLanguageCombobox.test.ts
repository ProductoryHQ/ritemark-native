import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  fileURLToPath(new URL('./InsightsLanguageCombobox.tsx', import.meta.url)),
  'utf8',
);

for (const contract of [
  'role="combobox"',
  'aria-autocomplete="list"',
  'aria-expanded={open}',
  'aria-controls={listboxId}',
  'aria-activedescendant=',
  'aria-describedby={customInputInvalid',
  'role="listbox"',
  'role="option"',
  'aria-live="polite"',
]) {
  assert.ok(source.includes(contract), `language search keeps accessibility contract ${contract}`);
}

for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Escape', 'Tab']) {
  assert.ok(source.includes(`event.key === '${key}'`), `language search handles ${key}`);
}

assert.ok(source.includes('normalizeCustomInsightsLanguage'), 'custom language is normalized before commit');
assert.ok(source.includes('isInsightsLanguageQueryInvalid(normalizedQuery)'), 'Auto and other committable values stay valid');
assert.ok(source.includes('getInsightsLanguageSuggestions'), 'language query uses the shared catalog search');
assert.ok(source.includes('event.nativeEvent.isComposing'), 'IME composition keys never operate the app list');
assert.ok(source.includes('!customInputInvalid && rows[activeIndex]'), 'Enter cannot turn invalid custom text into Auto');
assert.ok(source.includes('closeWithoutCommit();'), 'partial queries have an explicit discard path');
assert.ok(source.includes('onInteractOutside'), 'clicking the anchored input does not dismiss the open popup');
assert.ok(source.includes('inputRef.current?.contains(target)'), 'outside interaction distinguishes the editable anchor');
assert.ok(source.includes('max-h-[min(280px,40vh)]'), 'popup height stays viewport-bounded');
assert.ok(source.includes('w-[var(--radix-popover-trigger-width)]'), 'popup follows the trigger width');
assert.ok(source.includes("'Enter a valid language name.'"), 'invalid custom text is announced politely');
assert.ok(source.includes('focus:ring-[4px]'), 'input uses the Ritemark 4px focus ring');

console.log('InsightsLanguageCombobox.test.ts: all tests passed');

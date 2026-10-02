/**
 * What opens from the composer has to fit beside the thread rail.
 *
 * The composer sits in the conversation column, 56 px narrower than the side
 * bar, and the rail paints over anything on a lower layer. In v1.12.0 the model
 * and permission menus collided against the whole webview at z-50, so at the
 * default 300 px side bar the rail covered their right ends (descriptions cut
 * mid-word, the check mark gone); the `/` and `@` popups were wider than the
 * column and were cut off at its edge; and the footer switched to its labelled
 * layout at a width where the model name had 8 px left ("Cod…").
 *
 * The geometry needs a layout engine: `composer-menus-check.mjs` in the
 * ritemark-visual-regression skill measures it in a running app at a 300 px
 * side bar. These assertions hold the wiring that produces it.
 *
 * Run: npx tsx webview/src/components/ai-sidebar/composerMenus.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
  clear(): void { this.data.clear(); }
  key(index: number): string | null { return Array.from(this.data.keys())[index] ?? null; }
  get length(): number { return this.data.size; }
}

(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();

const { useAISidebarStore } = await import('./store');
const React = await import('react');
(globalThis as typeof globalThis & { React: typeof React }).React = React;
const { createElement } = React;
const { renderToStaticMarkup } = await import('react-dom/server');
const { ThreadRail } = await import('./ThreadRail');
const { SlashCommandPopup } = await import('./SlashCommandPopup');
const { AgentMentionPopup } = await import('./AgentMentionPopup');

const source = (file: string): string => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf-8');
const chatInput = source('./ChatInput.tsx');
const effortControl = source('./ThinkingEffortControl.tsx');
const sidebar = source('./AISidebar.tsx');

// ── The rail the composer shares the side bar with ──

const railClasses = renderToStaticMarkup(createElement(ThreadRail)).match(/^<aside class="([^"]*)"/)?.[1].split(' ') ?? [];
const railWidth = Number(railClasses.join(' ').match(/(?:^| )w-\[(\d+)px\]/)?.[1]);
const railLayer = Number(railClasses.join(' ').match(/(?:^| )z-\[(\d+)\]/)?.[1]);
assert.equal(railWidth, 56, 'The thread rail is 56 px wide');
assert.equal(railLayer, 60, 'The thread rail paints on layer 60');

// ── Model and permission menus ──

const composerMenu = chatInput.match(/const COMPOSER_MENU = '([^']*)';/)?.[1].split(' ') ?? [];
assert.ok(
  composerMenu.includes('max-w-[var(--radix-select-content-available-width)]'),
  'A composer menu is no wider than the room its collision boundary gives it',
);
const menuLayer = Number(composerMenu.join(' ').match(/(?:^| )z-\[(\d+)\]/)?.[1]);
assert.ok(
  menuLayer > railLayer,
  'A composer menu paints above the thread rail, so the part that cannot fit the column in a very narrow side bar stays visible',
);

const menus = chatInput.split('<SelectContent').slice(1).map((rest) => rest.slice(0, rest.search(/<Select(?:Group|Item|Label|Separator)/)));
assert.equal(menus.length, 2, 'The composer has two menus: model and permission mode');
for (const [index, menu] of menus.entries()) {
  const which = index === 0 ? 'The model menu' : 'The permission mode menu';
  assert.ok(menu.includes('collisionBoundary={menuBoundary}'), `${which} collides against the conversation column, not the whole webview`);
  assert.ok(menu.includes('COMPOSER_MENU'), `${which} takes the composer menu width and layer`);
}
assert.ok(
  sidebar.includes('ref={setConversationColumn}') && sidebar.includes('menuBoundary={conversationColumn}'),
  'The side bar hands the composer the conversation column as its menu boundary',
);

// At the default 300 px side bar the webview is 299 px and the column 243 px:
// with Radix's 10 px margin on each side a menu has 223 px, which is more than
// the 8rem a menu is never narrower than — so it is placed inside the column.
const DEFAULT_SIDE_BAR = 300;
const columnAtDefault = DEFAULT_SIDE_BAR - 1 - railWidth;
assert.ok(columnAtDefault - 2 * 10 >= 128, 'At the default 300 px side bar a composer menu fits inside the conversation column');

// ── Footer row: one breakpoint, where the labelled layout fits in every state ──

const breakpoints = new Set(
  [...chatInput.matchAll(/max-\[(\d+)px\]:/g), ...effortControl.matchAll(/max-\[(\d+)px\]:/g)].map((match) => Number(match[1])),
);
assert.deepEqual(
  [...breakpoints],
  [531],
  'The footer is compact up to a 531 px webview in ChatInput and ThinkingEffortControl alike: its labelled layout is 450 px at its widest ("Plan only", "Effort · Medium") and the composer is 82 px narrower than the webview',
);
const modelButton = chatInput.match(/<SelectTrigger\s+className="([^"]*)"\s+title=\{runtimeFooterLabel\}/)?.[1].split(' ') ?? [];
assert.ok(modelButton.includes('max-[531px]:w-auto'), 'The compact model button is as wide as the model name');
// (Spelled as a suffix on purpose: Tailwind scans this file too, and a literal
// class name here would put the very rule being ruled out into the bundle.)
assert.ok(
  !modelButton.some((name) => name.endsWith(':flex-1')),
  'The compact model button does not stretch over the free part of the row, which would push the mode and effort icons against Send',
);

// ── `/` and `@` popups ──

const longDescription = 'Reads every document in this project and writes a short summary of what each one says, with the open questions listed at the end.';
// A server render reads the store's initial state, not what setState wrote.
Object.assign(useAISidebarStore.getInitialState(), {
  discoveredCommands: [{
    id: 'a-command-with-a-rather-long-name',
    name: 'A command with a rather long name',
    description: longDescription,
    source: 'skills',
    filePath: '/project/.claude/skills/a-command-with-a-rather-long-name/SKILL.md',
  }],
  discoveredAgents: [{
    id: 'research-helper',
    name: 'Research Helper With A Rather Long Name',
    description: longDescription,
    filePath: '/project/.claude/agents/research-helper.md',
  }],
});

const noop = () => {};
const position = { top: 0, left: 0 };
const popups: Array<[string, string]> = [
  ['The slash command popup', renderToStaticMarkup(createElement(SlashCommandPopup, { query: '', onSelect: noop, onClose: noop, position }))],
  ['The empty slash command popup', renderToStaticMarkup(createElement(SlashCommandPopup, { query: 'no-such-command', onSelect: noop, onClose: noop, position }))],
  ['The @ mention popup', renderToStaticMarkup(createElement(AgentMentionPopup, { query: '', onSelect: noop, onClose: noop, position }))],
  ['The empty @ mention popup', renderToStaticMarkup(createElement(AgentMentionPopup, { query: 'no-such-agent', onSelect: noop, onClose: noop, position }))],
];
for (const [popup, markup] of popups) {
  const root = markup.match(/^<div class="([^"]*)" style="([^"]*)"/);
  assert.ok(root, `${popup} renders`);
  const classes = root[1].split(' ');
  const style = root[2];
  assert.ok(/(?:^|;)left:0/.test(style) && /(?:^|;)right:0/.test(style), `${popup} is held between the composer's left and right edges`);
  assert.ok(classes.includes('mx-3'), `${popup} lines up with the composer's card, 12 px in from each edge`);
  assert.ok(!classes.some((name) => name.startsWith('min-w-')), `${popup} has no minimum width that could push it past the conversation column`);
}
const [, commandsMarkup] = popups[0];
const [, agentsMarkup] = popups[2];
const classesOf = (markup: string, element: RegExp, what: string): string[] => {
  const match = markup.match(element);
  assert.ok(match, `The popup renders ${what}`);
  return match[1].split(' ');
};
const longText = longDescription.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
assert.ok(
  classesOf(commandsMarkup, /<span class="([^"]*)">\/(?:<!-- -->)?a-command-with-a-rather-long-name<\/span>/, 'a command name').includes('truncate'),
  'A long command name is shortened with an ellipsis',
);
assert.ok(
  classesOf(commandsMarkup, new RegExp(`<div class="([^"]*)">${longText}</div>`), 'a command description').includes('truncate'),
  'A long command description is shortened with an ellipsis instead of widening the popup',
);
assert.ok(
  classesOf(agentsMarkup, /<div class="([^"]*)">Research Helper With A Rather Long Name<\/div>/, 'an agent name').includes('truncate'),
  'A long agent name is shortened with an ellipsis',
);
assert.ok(
  classesOf(agentsMarkup, new RegExp(`<div class="([^"]*)">${longText}</div>`), 'an agent description').includes('truncate'),
  'A long agent description is shortened with an ellipsis instead of widening the popup',
);

console.log('composerMenus.test.ts: all assertions passed');

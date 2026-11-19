/**
 * Tests for the shared agent capability context (Sprint 101, #154).
 *
 * Run: npx tsx src/ai/capabilityContext.test.ts
 *
 * Pure module — no vscode stub needed. Covers spec scenarios S1.1, S2.1, S3.1,
 * S3.2, S4.1, S4.3, S5.1, and the single-source guards S7.1/S7.2.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import {
  renderCapabilityContext,
  capabilityDescriptorFor,
  CLAUDE_DESCRIPTOR,
  CODEX_DESCRIPTOR,
  ACP_DESCRIPTOR,
} from './capabilityContext';
import { SLIDE_ICON_ALIASES, SLIDE_ICON_NAMES } from '../../webview/src/components/decks/slide/iconSet';

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log('capabilityContext');

const claude = renderCapabilityContext(CLAUDE_DESCRIPTOR);
const codex = renderCapabilityContext(CODEX_DESCRIPTOR);
const acp = renderCapabilityContext(ACP_DESCRIPTOR);

// ── R1: apply-directly framing (S1.1) ──────────────────────────────────────
test('every runtime carries the markdown-editor apply-directly framing', () => {
  for (const text of [claude, codex, acp]) {
    assert.ok(/markdown editor/i.test(text), 'names the markdown-editor role');
    assert.ok(text.includes('apply the change directly'), 'says apply directly');
    assert.ok(text.includes('Do NOT paraphrase'), 'says do not paraphrase');
  }
});

// ── R3: comment carriers, footnote & /// ruled out (S3.1, S3.2) ─────────────
test('names the on-disk comment carriers', () => {
  for (const text of [claude, codex, acp]) {
    assert.ok(text.includes('<!-- note text -->'), 'standalone HTML comment carrier');
    assert.ok(text.includes('<!-- {id:…} note text -->'), 'the identity-carrying form of the same carrier');
    assert.ok(text.includes('<mark data-comment='), 'anchored mark carrier');
    assert.ok(text.includes('@claude') && text.includes('@chatgpt') && text.includes('@codex') && text.includes('@opencode'), 'assignment aliases');
  }
});

test('rules out footnotes and /// as comment carriers', () => {
  for (const text of [claude, codex, acp]) {
    assert.ok(text.includes('[^1]'), 'mentions the footnote form it rules out');
    assert.ok(/Do NOT use a Markdown footnote/i.test(text), 'explicitly rules out footnote');
    assert.ok(text.includes('///'), 'mentions ///');
    assert.ok(/live-editor input shortcut/i.test(text), 'explains /// is a live-editor rule');
  }
});

test('states the comment-preservation rule', () => {
  for (const text of [claude, codex, acp]) {
    assert.ok(/preserve any existing/i.test(text), 'preservation instruction present');
    assert.ok(text.includes('data-comment-id') && text.includes('data-agent'), 'names the attributes to keep');
    // Sprint 117 gave standalone notes a durable identity carried in the
    // Markdown as a leading `{id:…}` token. An agent that strips it while
    // rewriting prose detaches the note from the task already running on it,
    // so the preservation rule has to name it explicitly.
    assert.ok(text.includes('{id:…}'), 'names the standalone identity token to keep');
  }
});

test('tells agents not to mint or copy a comment identity', () => {
  for (const text of [claude, codex, acp]) {
    assert.ok(/Never invent an/i.test(text), 'rules out inventing an identity');
    assert.ok(/never copy one from another comment/i.test(text), 'rules out copying one');
    assert.ok(/a note you write yourself simply has none/i.test(text), 'says what to do instead');
  }
});

// ── R2: selection window (S2.1) ─────────────────────────────────────────────
test('states the selection-window rule with sentinels', () => {
  for (const text of [claude, codex, acp]) {
    assert.ok(text.includes('<<<SELECTION>>>'), 'names the selection sentinel');
    assert.ok(/not the bare selected word/i.test(text), 'warns against the bare token');
  }
});

// ── R4: capability coverage (S4.1) ──────────────────────────────────────────
test('covers internal links with the workspace-containment rule', () => {
  for (const text of [claude, codex, acp]) {
    assert.ok(text.includes('[label](./other-file.md)'), 'relative-path link form');
    assert.ok(/stay inside the workspace/i.test(text), 'workspace containment');
    assert.ok(text.includes('javascript:') && text.includes('data:') && text.includes('file:'), 'forbidden schemes');
  }
});

test('labels the user-only features and existing diagrams', () => {
  for (const text of [claude, codex, acp]) {
    assert.ok(/USER-ONLY FEATURES/i.test(text), 'user-only section present');
    assert.ok(text.includes('/diagram') && text.includes('/image'), 'diagram + image');
    assert.ok(/Sending a copy as PDF or Word/i.test(text), 'Share (once export) labelled user-only');
    assert.ok(text.includes('.drawio.svg'), 'existing diagram assets referenced');
  }
});

test('covers file-op safety bounds', () => {
  for (const text of [claude, codex, acp]) {
    assert.ok(text.includes('node_modules') && text.includes('*.pem') && text.includes('secrets*'), 'excluded paths');
  }
});

// ── R5: honest fallback (S5.1) ──────────────────────────────────────────────
test('instructs honest fallback', () => {
  for (const text of [claude, codex, acp]) {
    assert.ok(/say so plainly/i.test(text), 'honesty instruction');
    assert.ok(/inventing or claiming a capability/i.test(text), 'no invented capabilities');
    // Sprint 140 (R1, #497): every AI says which files it could not open
    assert.ok(/say which files you could not open/i.test(text), 'the honesty line about unread files');
    // Sprint 140 (R5): "About this project" is the root's AGENTS.md, for every AI
    assert.ok(/"About this project" is the `AGENTS\.md` file at the project's root/.test(text), 'About this project named as AGENTS.md');
  }
});

// ── R4/R6: browser hint follows the browser tools, for every runtime (S4.3) ──
// OpenCode has been handed the browser tools (the `ritemark_browser` stdio MCP
// adapter) since Sprint 79, but its descriptor said it had none, so its context
// never mentioned them. Every runtime now takes the hint from the same flag that
// hands it the tools — including the one that used to be left out.
test('browser guidance appears exactly when a runtime has the browser tools', () => {
  const runtimes = [
    ['claude-code', 'Write/Edit'],
    ['codex', 'apply_patch'],
    ['opencode', 'file-writing tool'],
  ] as const;
  for (const [runtime, editTool] of runtimes) {
    const withTools = renderCapabilityContext(capabilityDescriptorFor(runtime, { browser: true, board: false }));
    const withoutTools = renderCapabilityContext(capabilityDescriptorFor(runtime, { browser: false, board: false }));
    assert.ok(/integrated browser/i.test(withTools), `${runtime} with browser tools gets the hint`);
    assert.ok(!/integrated browser/i.test(withoutTools), `${runtime} without browser tools omits it`);
    assert.ok(
      withTools.includes(editTool) && withoutTools.includes(editTool),
      `${runtime} keeps its own edit-tool binding`,
    );
  }
});

// ── Sprint 130 W5: the TASK BOARD section follows the board tools ───────────
test('task board guidance appears exactly when a runtime has the board tools', () => {
  for (const runtime of ['claude-code', 'codex', 'opencode'] as const) {
    const withBoard = renderCapabilityContext(capabilityDescriptorFor(runtime, { browser: false, board: true }));
    const withoutBoard = renderCapabilityContext(capabilityDescriptorFor(runtime, { browser: false, board: false }));
    assert.ok(withBoard.includes('TASK BOARD'), `${runtime} with the board gets the section`);
    assert.ok(withBoard.includes("A card's id is for the tools only"), `${runtime} is told to keep card ids out of replies (#709)`);
    assert.ok(!withoutBoard.includes('TASK BOARD'), `${runtime} without a board omits it`);
    // What the agent must do on a card: the tools, report_result with things to
    // check, decisions before long work, and never finishing or editing files.
    for (const needle of ['ritemark_board', 'report_result', 'up to three', 'ask_user', 'Before long work', 'Done when', 'Only the user marks a card done', '.ritemark/tasks/']) {
      assert.ok(withBoard.includes(needle), `${runtime}: ${needle}`);
    }
  }
});

// ── Sprint 157: the DECKS section follows the deck tools ─────────────────────
test('deck guidance appears exactly when a runtime has the deck tools', () => {
  for (const runtime of ['claude-code', 'codex', 'opencode'] as const) {
    const withDecks = renderCapabilityContext(capabilityDescriptorFor(runtime, { browser: false, board: false, deck: true }));
    const withoutDecks = renderCapabilityContext(capabilityDescriptorFor(runtime, { browser: false, board: false }));
    assert.ok(withDecks.includes('DECKS'), `${runtime} with decks gets the section`);
    assert.ok(!withoutDecks.includes('DECKS'), `${runtime} without decks omits it`);
    // Sprint 161 (PR 2): block slides, written like text; comments for anything private (no speaker-notes field).
    for (const needle of ['ritemark_decks', 'insert_slides', 'from:', 'Never change anything in `Slide library/` unless the user asks', 'update_library_slide', '```slide <kind>', '```` ```slide ```` (the word `slide` alone)', ':::: columns', '::: column', ':::: boxes', '::: steps', '`deck: 2`', 'a Ritemark comment, `<!-- … -->`', 'There is no speaker-notes field', 'made from the deck when it is published: to change the page, change the deck', 'The handout is a Text document', "changing a slide\'s title never changes its heading", 'A new slide is always a new slide block', 'never put `***` or `---` between slides', '`handout: text`', 'never put a list number in front of a heading']) {
      assert.ok(withDecks.includes(needle), `${runtime}: ${needle}`);
    }
  }
});

// ── #850 (Sprint 166 PR 9): the icon names a box may carry, for every AI with the deck tools ──────────────────────────
test('deck guidance lists every icon name a box can draw, and says an unknown one draws a dashed circle', () => {
  // The names the slide draws (iconSet.ts): every one, and every other name for one, must be in the line.
  const names = [...SLIDE_ICON_NAMES];
  const aliases = [...SLIDE_ICON_ALIASES];
  assert.ok(names.length > 0 && aliases.length > 0);
  for (const runtime of ['claude-code', 'codex', 'opencode'] as const) {
    const text = renderCapabilityContext(capabilityDescriptorFor(runtime, { browser: false, board: false, deck: true }));
    const line = text.split('\n').find((entry) => entry.startsWith("- A box's `icon` is one of these names:"));
    assert.ok(line, `${runtime}: the icon line`);
    for (const name of [...names, ...aliases]) assert.ok(line.includes(`\`${name}\``), `${runtime}: ${name}`);
    assert.ok(line.includes("a name Ritemark doesn't know draws a dashed circle"), `${runtime}: what an unknown name does`);
  }
});

// ── Sprint 163 PR 5: prompts as code blocks, Tabs, Button and the exercise's layout, for every AI with the deck tools ──
test('deck guidance teaches prompts, Tabs, Button and the exercise layout', () => {
  for (const runtime of ['claude-code', 'codex', 'opencode'] as const) {
    const withDecks = renderCapabilityContext(capabilityDescriptorFor(runtime, { browser: false, board: false, deck: true }));
    for (const needle of [
      'A prompt to copy goes in a code block with no language', 'Copy and ↗ Open in', 'in square brackets, `[the client\'s name]`',
      '`::: {.panel-tabset}` with a `## ` heading per tab', '"put these four prompts in tabs" means one Tabs block',
      'Never put Tabs inside Tabs, a box, a step or a table cell',
      '`[Open the sample](https://…){.button}`', 'Only a full https address', 'never copy a file into the project',
      'An exercise slide is one Columns block, with no title above it', '`{.column width="35%"}`', 'holds its Label (`[Exercise · 1 / 2]{.label}`), then `# ` the title and right under it its `::: steps`', 'opens and closes with four backticks, ```` ````slide ````', 'the material\'s Button right under it',
    ]) {
      assert.ok(withDecks.includes(needle), `${runtime}: ${needle}`);
    }
  }
});

// ── Sprint 164 PR 3: the DECKS instructions teach the Label block, never the Steps pill, for every AI with the deck tools ──
test('deck guidance teaches the Label block in place of the Steps pill', () => {
  for (const runtime of ['claude-code', 'codex', 'opencode'] as const) {
    const withDecks = renderCapabilityContext(capabilityDescriptorFor(runtime, { browser: false, board: false, deck: true }));
    for (const needle of [
      'A Label is a short line drawn as a pill', '`[Exercise · 1 / 2]{.label}`, with a blank line after it',
      'over the title, in a column, in a box or in a tab\'s pane', 'nothing counts for them', 'a `::: steps` block has none unless you write it',
      'write it as a Label over the heading above the steps', 'take `tag` off the line',
    ]) {
      assert.ok(withDecks.includes(needle), `${runtime}: ${needle}`);
    }
    for (const gone of ['the pill above it saying "Exercise"', '`::: {.steps tag="Harjutus"}` for other words', 'Write `tag` only when', 'the pill draws above the title']) {
      assert.ok(!withDecks.includes(gone), `${runtime}: no longer "${gone}"`);
    }
  }
});

// ── 17 November: "this slide", "here" or "siin" is the slide the person is on, for every AI with the deck tools ──
test('deck guidance says what "this slide" means', () => {
  for (const runtime of ['claude-code', 'codex', 'opencode'] as const) {
    const withDecks = renderCapabilityContext(capabilityDescriptorFor(runtime, { browser: false, board: false, deck: true }));
    for (const needle of ['`[Current slide: …]`', '"This slide", "here" or "siin" means that slide', 'finding its block by its `id:`']) {
      assert.ok(withDecks.includes(needle), `${runtime}: ${needle}`);
    }
  }
});

// ── Sprint 162 PR 5: themes, taught the same way to every AI with the deck tools ──
test('deck guidance teaches themes: the folder, the fields, the six fonts and the contrast rule', () => {
  const renders = (['claude-code', 'codex', 'opencode'] as const).map((runtime) => renderCapabilityContext(capabilityDescriptorFor(runtime, { browser: false, board: false, deck: true })));
  const themeLines = (text: string) => text.split('\n').filter((line) => line.startsWith('- ') && /set_deck_theme|`theme:` line|brand|this deck or all/.test(line));
  for (const text of renders) {
    for (const needle of [
      '`<Name>.theme.md` file in `Slide library/Themes/`', '`theme:` line',
      '`background`', '`headings`', '`text`', '`accent`', '`soft-light`', '`heading-font`', '`text-font`', '`corners` (square, soft or round)', '`boxes` (filled or outline)',
      'Sofia Sans, Inter, IBM Plex Sans, Space Grotesk, Source Serif 4, Fraunces',
      '4.5 : 1', '3 : 1', 'change the theme file, never individual slides',
      'only with set_deck_theme: never write a theme file', 'read_pptx_theme', 'check_theme_colours', 'set_theme_draft_colours',
      '"Fernhollow\'s guide uses Futura; the closest here is Space Grotesk."', '"this deck or all of them?"',
    ]) {
      assert.ok(text.includes(needle), needle);
    }
  }
  // The same words for every runtime, and short: four lines, under 1,700 characters
  const lines = themeLines(renders[0]);
  assert.ok(renders.every((text) => themeLines(text).join('\n') === lines.join('\n')), 'the same theme lines for every runtime');
  assert.strictEqual(lines.length, 4, 'four theme lines');
  assert.ok(lines.join('\n').length < 1700, `theme lines are short (${lines.join('\n').length} characters)`);
  if (process.env.PRINT) console.log(lines.join('\n'));
  // Every field named is one the parser reads
  const parser = fs.readFileSync(path.join(__dirname, '../decks/deckTheme.ts'), 'utf8');
  for (const key of ['background', 'headings', 'text', 'accent', 'soft-light', 'heading-font', 'text-font', 'corners', 'boxes']) {
    assert.ok(parser.includes(`top['${key}']`) || parser.includes(`top.${key}`), `the parser reads ${key}`);
  }
});

// ── R7: per-runtime edit-tool binding, not per-capability content ────────────
test('edit-tool naming is bound per runtime', () => {
  assert.ok(claude.includes('Write/Edit'), 'Claude edit tool');
  assert.ok(codex.includes('apply_patch'), 'Codex edit tool');
  assert.ok(acp.includes('file-writing tool'), 'ACP edit tool');
});

// ── R7: single source — runtime files carry no capability prose (S7.1) ──────
test('runtime files do not duplicate capability prose (single source)', () => {
  const here = __dirname; // extensions/ritemark/src/ai
  const runtimeFiles = [
    path.join(here, '..', 'codex', 'CodexRuntime.ts'),
    path.join(here, '..', 'acp', 'AcpRuntime.ts'),
    path.join(here, '..', 'agent', 'AgentRunner.ts'),
    path.join(here, '..', 'views', 'UnifiedViewProvider.ts'),
  ];
  for (const file of runtimeFiles) {
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(
      !src.includes('<mark data-comment='),
      `${path.basename(file)} must not carry its own comment-carrier prose — it belongs to capabilityContext.ts`,
    );
    assert.ok(
      !src.includes('USER-ONLY FEATURES'),
      `${path.basename(file)} must not carry its own capability listing`,
    );
  }
});

// The reply on a comment is not something the agent writes into the file — the
// host lifts the turn's final text, strips it and caps it at MAX_SUMMARY_CHARS
// (280). An agent that ends with a code block or "Done." therefore produces a
// useless comment reply through no fault of its own, unless it is told.
test('tells agents their closing message becomes the comment reply', () => {
  for (const text of [claude, codex, acp]) {
    assert.ok(/FINAL message of that turn becomes the reply/.test(text), 'names where the reply comes from');
    assert.ok(text.includes('280'), 'gives the real character budget');
    assert.ok(/not a bare `Done`/.test(text), 'rules out the empty closing line');
    assert.ok(/Clearing a comment is the user's action/.test(text), 'leaves resolution to the user');
  }
});

// ── R7: single-source structural property (S7.2) ────────────────────────────
// The three renders differ ONLY in the edit-tool name; every capability section
// flows to all of them from one function, so a new section reaches all runtimes.
test('every runtime shares every capability section (edit-tool aside)', () => {
  const normalize = (t: string) => t.replace(/your Write\/Edit tools|apply_patch|your file-writing tool/g, 'EDIT_TOOL');
  assert.strictEqual(
    normalize(codex),
    normalize(claude),
    'Codex capability context is identical to Claude\'s modulo the edit-tool binding',
  );
  assert.strictEqual(
    normalize(acp),
    normalize(claude),
    'OpenCode capability context is identical to Claude\'s modulo the edit-tool binding',
  );
});

console.log(`\ncapabilityContext: ${passed} passed`);

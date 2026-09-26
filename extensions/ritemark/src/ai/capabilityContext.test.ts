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
    assert.ok(text.includes('@claude') && text.includes('@codex') && text.includes('@opencode'), 'assignment aliases');
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
    assert.ok(/Exporting to PDF or DOCX/i.test(text), 'export labelled user-only');
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
    const withTools = renderCapabilityContext(capabilityDescriptorFor(runtime, true));
    const withoutTools = renderCapabilityContext(capabilityDescriptorFor(runtime, false));
    assert.ok(/integrated browser/i.test(withTools), `${runtime} with browser tools gets the hint`);
    assert.ok(!/integrated browser/i.test(withoutTools), `${runtime} without browser tools omits it`);
    assert.ok(
      withTools.includes(editTool) && withoutTools.includes(editTool),
      `${runtime} keeps its own edit-tool binding`,
    );
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

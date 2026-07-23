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

// ── R4/R6: browser hint reaches browser-capable runtimes, not ACP (S4.3) ────
test('browser guidance is present for Claude and Codex, absent for ACP', () => {
  assert.ok(/integrated browser/i.test(claude), 'Claude gets the browser hint');
  assert.ok(/integrated browser/i.test(codex), 'Codex gets the browser hint (regression guard vs. Claude-only)');
  assert.ok(!/integrated browser/i.test(acp), 'ACP (no browser tools) omits it');
});

test('a descriptor with hasBrowserTools:false omits the browser section', () => {
  const noBrowserClaude = renderCapabilityContext({ ...CLAUDE_DESCRIPTOR, hasBrowserTools: false });
  assert.ok(!/integrated browser/i.test(noBrowserClaude), 'browser section gated on hasBrowserTools');
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

// ── R7: single-source structural property (S7.2) ────────────────────────────
// Claude and Codex renders differ ONLY in the edit-tool name; every capability
// section flows to both from one function, so a new section reaches all runtimes.
test('Claude and Codex share every capability section (edit-tool aside)', () => {
  const normalize = (t: string) => t.replace(/your Write\/Edit tools|apply_patch/g, 'EDIT_TOOL');
  assert.strictEqual(
    normalize(claude),
    normalize(codex),
    'Claude and Codex capability context is identical modulo the edit-tool binding',
  );
});

console.log(`\ncapabilityContext: ${passed} passed`);

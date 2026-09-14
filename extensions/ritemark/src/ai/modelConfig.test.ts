import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CLAUDE_MODEL_IDS,
  CODEX_MODEL_IDS,
  DEFAULT_MODELS,
  GEMINI_IMAGE_MODEL_IDS,
  GEMINI_IMAGE_MODELS,
  GEMINI_MODEL_IDS,
  GEMINI_LLM_MODELS,
  OPENAI_IMAGE_MODEL_IDS,
  OPENAI_IMAGE_MODELS,
  OPENAI_MODEL_IDS,
  OPENAI_LLM_MODELS,
  OPENROUTER_MODEL_IDS,
} from './modelConfig';

function assertSelectableDefault(id: string, models: Array<{ id: string; deprecated?: boolean }>): void {
  const model = models.find(candidate => candidate.id === id);
  assert.ok(model, `default ${id} must exist in its canonical list`);
  assert.notEqual(model.deprecated, true, `default ${id} must not be deprecated`);
}

assertSelectableDefault(DEFAULT_MODELS.assistant, OPENAI_LLM_MODELS);
assertSelectableDefault(DEFAULT_MODELS.flowLLM, OPENAI_LLM_MODELS);
assertSelectableDefault(DEFAULT_MODELS.flowLLMGemini, GEMINI_LLM_MODELS);
assertSelectableDefault(DEFAULT_MODELS.flowImage, OPENAI_IMAGE_MODELS);
assertSelectableDefault(DEFAULT_MODELS.flowImageGemini, GEMINI_IMAGE_MODELS);

for (const models of [OPENAI_LLM_MODELS, GEMINI_LLM_MODELS, OPENAI_IMAGE_MODELS, GEMINI_IMAGE_MODELS]) {
  assert.equal(new Set(models.map(model => model.id)).size, models.length, 'canonical model IDs must be unique');
}

assert.equal(GEMINI_IMAGE_MODELS.some(model => model.id.startsWith('imagen-4.0-')), false);
assert.equal(GEMINI_LLM_MODELS.some(model => model.id === 'gemini-3-pro-preview'), false);
assert.equal(OPENAI_IMAGE_MODELS.find(model => model.id === 'gpt-image-1.5')?.deprecated, true);

const canonicalIds = new Set([
  ...Object.values(CLAUDE_MODEL_IDS),
  ...Object.values(CODEX_MODEL_IDS),
  ...Object.values(GEMINI_IMAGE_MODEL_IDS),
  ...Object.values(GEMINI_MODEL_IDS),
  ...Object.values(OPENAI_IMAGE_MODEL_IDS),
  ...Object.values(OPENAI_MODEL_IDS),
  ...Object.values(OPENROUTER_MODEL_IDS),
]);
const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const canonicalSource = path.join(extensionRoot, 'src', 'ai', 'modelConfig.ts');
const productionRoots = [path.join(extensionRoot, 'src'), path.join(extensionRoot, 'webview', 'src')];
const violations: string[] = [];
const walk = (directory: string): void => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name) || entry.name.endsWith('.test.ts') || fullPath === canonicalSource) continue;
    const source = fs.readFileSync(fullPath, 'utf8');
    for (const id of canonicalIds) {
      if (source.includes(id)) violations.push(`${path.relative(extensionRoot, fullPath)} duplicates ${id}`);
    }
  }
};
for (const root of productionRoots) walk(root);
assert.deepEqual(violations, [], 'canonical model IDs must not be duplicated outside modelConfig.ts');

console.log('modelConfig.test.ts passed');

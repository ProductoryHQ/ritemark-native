#!/usr/bin/env npx tsx
/**
 * CLI script to run a specific flow test
 * Usage: npx tsx scripts/run-flow-test.ts <flow-file>
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import OpenAI from 'openai';

// Load .env_local file synchronously
import { readFileSync } from 'fs';

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env_local');
  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=');
      if (key && value) {
        process.env[key] = value;
      }
    }
    console.log('📁 Loaded .env_local');
  } catch {
    // File doesn't exist, continue with environment variables
  }
}

loadEnvLocal();

const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY || API_KEY === 'sk-xxx') {
  console.error('ERROR: OPENAI_API_KEY not set in .env_local');
  console.error('Edit extensions/ritemark/.env_local and add your API key');
  process.exit(1);
}

interface FlowNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

interface Flow {
  id: string;
  name: string;
  nodes: FlowNode[];
  edges: Array<{ source: string; target: string }>;
  _test?: {
    inputs: Record<string, string>;
    expectations: Record<string, unknown>;
  };
}

// Text file extensions that can be read
const TEXT_FILE_EXTENSIONS = new Set([
  '.md', '.markdown', '.txt', '.text',
  '.json', '.xml', '.yaml', '.yml',
  '.csv', '.tsv', '.html', '.css',
  '.js', '.ts', '.py', '.java',
]);

function isTextFilePath(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  if (!value.startsWith('/')) return false;
  const ext = path.extname(value).toLowerCase();
  return TEXT_FILE_EXTENSIONS.has(ext);
}

async function resolveFileContent(value: string): Promise<string> {
  if (!isTextFilePath(value)) return value;
  try {
    const content = await fs.readFile(value, 'utf-8');
    console.log(`  📄 Read file: ${path.basename(value)} (${content.length} chars)`);
    return content;
  } catch {
    return value;
  }
}

async function interpolateVariables(
  template: string,
  inputs: Record<string, string>,
  outputs: Map<string, unknown>
): Promise<string> {
  let result = template;

  // Replace {Label} patterns
  const pattern = /\{([^{}]+)\}/g;
  const matches = [...template.matchAll(pattern)];

  for (const match of matches) {
    const [fullMatch, label] = match;
    const trimmedLabel = label.trim();

    // Find value in inputs (case insensitive)
    let rawValue: string | undefined;
    for (const [key, value] of Object.entries(inputs)) {
      if (key.toLowerCase() === trimmedLabel.toLowerCase()) {
        rawValue = value;
        break;
      }
    }

    if (rawValue) {
      const resolved = await resolveFileContent(rawValue);
      result = result.replace(fullMatch, resolved);
    }
  }

  return result;
}

async function executeLLMNode(
  node: FlowNode,
  inputs: Record<string, string>,
  outputs: Map<string, unknown>
): Promise<string> {
  const data = node.data as {
    provider?: string;
    model?: string;
    systemPrompt?: string;
    userPrompt?: string;
    temperature?: number;
    maxTokens?: number;
  };

  const systemPrompt = data.systemPrompt
    ? await interpolateVariables(data.systemPrompt, inputs, outputs)
    : '';
  const userPrompt = await interpolateVariables(data.userPrompt || '', inputs, outputs);

  const provider = data.provider || 'openai';
  const model = data.model || (provider === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o-mini');

  console.log(`  🤖 Calling ${provider}/${model}...`);
  console.log(`  📝 Prompt preview: "${userPrompt.slice(0, 100)}..."`);

  if (provider === 'gemini') {
    return executeGeminiLLM(model, systemPrompt, userPrompt, data.temperature, data.maxTokens);
  } else {
    return executeOpenAILLM(model, systemPrompt, userPrompt, data.temperature, data.maxTokens);
  }
}

async function executeOpenAILLM(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature?: number,
  maxTokens?: number
): Promise<string> {
  const openai = new OpenAI({ apiKey: API_KEY });

  const messages: OpenAI.ChatCompletionMessageParam[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: userPrompt });

  const completion = await openai.chat.completions.create({
    model,
    messages,
    temperature: temperature ?? 0.7,
    max_tokens: maxTokens ?? 2000,
  });

  return completion.choices[0]?.message?.content || '';
}

async function executeGeminiLLM(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature?: number,
  maxTokens?: number
): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_KEY;
  if (!apiKey || apiKey === 'AIza-xxx') {
    throw new Error('GOOGLE_AI_KEY not set in .env_local');
  }

  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: temperature ?? 0.7,
        maxOutputTokens: maxTokens ?? 2000,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
  }

  const result = await response.json();
  return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function executeSaveFileNode(
  node: FlowNode,
  inputs: Record<string, string>,
  outputs: Map<string, unknown>,
  workspacePath: string
): Promise<{ path: string; success: boolean }> {
  const data = node.data as {
    filename?: string;
    folder?: string;
    content?: string;
  };

  // Interpolate content (may reference other nodes)
  let content = data.content || '';

  // Replace node label references like {Content Writer}
  const labelPattern = /\{([^{}]+)\}/g;
  let match;
  while ((match = labelPattern.exec(data.content || '')) !== null) {
    const label = match[1].trim();
    // Find node output by label
    for (const [nodeId, output] of outputs.entries()) {
      // We don't have label mapping here, so check if output exists
      if (outputs.has(label)) {
        content = content.replace(match[0], String(outputs.get(label)));
      }
    }
    // Also try direct node ID
    if (outputs.has(label)) {
      content = content.replace(match[0], String(outputs.get(label)));
    }
  }

  // For simplicity, also do input interpolation
  content = await interpolateVariables(content, inputs, outputs);

  // Generate filename with timestamp
  let filename = data.filename || 'output.md';
  filename = filename.replace('{timestamp}', Date.now().toString());

  // Build full path
  const folder = data.folder || '.flows/outputs';
  const folderPath = path.join(workspacePath, folder);
  const filePath = path.join(folderPath, filename);

  // Create folder if needed
  await fs.mkdir(folderPath, { recursive: true });

  // Write file
  await fs.writeFile(filePath, content, 'utf-8');

  console.log(`  💾 Saved: ${filePath}`);
  console.log(`  📄 Content: ${content.slice(0, 80)}...`);

  return { path: filePath, success: true };
}

async function runTest(flowPath: string) {
  console.log('═'.repeat(60));
  console.log('  Flow Test Runner - LIVE MODE');
  console.log('═'.repeat(60));
  console.log();

  // Load flow
  const content = await fs.readFile(flowPath, 'utf-8');
  const flow: Flow = JSON.parse(content);

  console.log(`📋 Flow: ${flow.name}`);
  console.log(`📁 File: ${path.basename(flowPath)}`);
  console.log();

  const testConfig = flow._test;
  if (!testConfig) {
    console.error('ERROR: No _test configuration in flow file');
    process.exit(1);
  }

  console.log('📥 Inputs:');
  for (const [key, value] of Object.entries(testConfig.inputs)) {
    const display = value.length > 50 ? value.slice(0, 50) + '...' : value;
    console.log(`   ${key}: ${display}`);
  }
  console.log();

  // Build execution order (simple: trigger first, then rest)
  const outputs = new Map<string, unknown>();

  // Build node label → id map
  const nodeLabels = new Map<string, string>();
  for (const node of flow.nodes) {
    const label = (node.data as { label?: string }).label;
    if (label) {
      nodeLabels.set(label, node.id);
    }
  }

  // Find non-trigger nodes and sort by edges (simple topological order)
  const executableNodes = flow.nodes.filter(n => n.type !== 'trigger');

  console.log('🚀 Executing nodes...');
  console.log();

  const startTime = Date.now();
  // flowPath: /workspace/.flows/tests/test.flow.json -> workspace: /workspace
  const workspacePath = path.dirname(path.dirname(path.dirname(flowPath)));

  for (const node of executableNodes) {
    const label = (node.data as { label?: string }).label || node.id;
    console.log(`▶ Node: ${label} (${node.type})`);

    try {
      let output: unknown;

      if (node.type === 'llm-prompt') {
        output = await executeLLMNode(node, testConfig.inputs, outputs);
      } else if (node.type === 'save-file') {
        output = await executeSaveFileNode(node, testConfig.inputs, outputs, workspacePath);
      } else {
        console.log(`  ⚠️ Skipping unsupported node type: ${node.type}`);
        continue;
      }

      outputs.set(node.id, output);
      // Also store by label for easier lookup
      if (label) {
        outputs.set(label, output);
      }

      // Show output preview
      const outputStr = String(output);
      console.log(`  ✅ Output: "${outputStr.slice(0, 100)}${outputStr.length > 100 ? '...' : ''}"`);
      console.log();

      // Check expectations
      const expectation = testConfig.expectations[node.id] as {
        type?: string;
        minLength?: number;
        contains?: string;
      } | undefined;

      if (expectation) {
        if (expectation.type === 'string' && typeof output !== 'string') {
          throw new Error(`Expected string, got ${typeof output}`);
        }
        if (expectation.minLength && outputStr.length < expectation.minLength) {
          throw new Error(`Output too short: ${outputStr.length} < ${expectation.minLength}`);
        }
        if (expectation.contains && !outputStr.toLowerCase().includes(expectation.contains.toLowerCase())) {
          throw new Error(`Output doesn't contain "${expectation.contains}"`);
        }
        console.log(`  ✓ Expectations passed`);
      }
    } catch (err) {
      console.error(`  ❌ Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  }

  const duration = Date.now() - startTime;

  console.log();
  console.log('─'.repeat(60));
  console.log(`✅ Test passed in ${duration}ms`);
  console.log('─'.repeat(60));
}

// Main
const flowFile = process.argv[2];
if (!flowFile) {
  console.log('Usage: npx tsx scripts/run-flow-test.ts <flow-file>');
  console.log('Example: npx tsx scripts/run-flow-test.ts ../.flows/tests/test-file-content-reading.flow.json');
  process.exit(1);
}

const fullPath = path.resolve(flowFile);
runTest(fullPath).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

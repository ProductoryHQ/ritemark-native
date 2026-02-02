/**
 * LLM Node Executor
 *
 * Executes LLM prompt nodes using OpenAI or Google Gemini API.
 * Supports variable interpolation from execution context.
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import OpenAI from 'openai';
import { getAPIKeyManager } from '../../ai/apiKeyManager';
import { usesResponsesAPI, getReasoningEffort, DEFAULT_MODELS, GEMINI_LLM_MODELS } from '../../ai/modelConfig';
import type { FlowNode, ExecutionContext } from '../types';

/**
 * Text file extensions that can be read and included in prompts
 */
const TEXT_FILE_EXTENSIONS = new Set([
  '.md', '.markdown', '.txt', '.text',
  '.json', '.xml', '.yaml', '.yml',
  '.csv', '.tsv',
  '.html', '.htm', '.css',
  '.js', '.ts', '.jsx', '.tsx',
  '.py', '.java', '.c', '.cpp', '.h', '.hpp',
  '.go', '.rs', '.rb', '.php', '.swift',
  '.sh', '.bash', '.zsh',
  '.sql', '.graphql',
  '.env', '.ini', '.conf', '.config',
  '.log',
]);

/**
 * LLM Node configuration
 */
interface LLMNodeData {
  label: string;
  provider: 'openai' | 'gemini';
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Check if a value looks like a file path to a text file
 */
function isTextFilePath(value: string): boolean {
  if (!value || typeof value !== 'string') return false;

  // Must start with / (absolute path) or be a relative workspace path
  if (!value.startsWith('/') && !value.includes('/')) return false;

  // Check extension
  const ext = path.extname(value).toLowerCase();
  return TEXT_FILE_EXTENSIONS.has(ext);
}

/**
 * Read file contents if the value is a text file path
 * Returns the file contents or the original value if not a file
 */
async function resolveFileContent(value: string): Promise<string> {
  if (!isTextFilePath(value)) {
    return value;
  }

  try {
    const content = await fs.readFile(value, 'utf-8');
    return content;
  } catch {
    // File doesn't exist or can't be read - return original value
    return value;
  }
}

/**
 * Replace template variables with values from context
 * Automatically reads file contents for file-type inputs
 *
 * Supports two syntaxes:
 * 1. New simple: {Label} - matches by input label or node label
 * 2. Legacy: {{inputs.key}}, {{nodeId}} - matches by ID
 */
async function interpolateVariables(
  template: string,
  context: ExecutionContext,
  inputLabels?: Map<string, string>, // label -> value
  nodeLabels?: Map<string, string>   // label -> nodeId
): Promise<string> {
  let result = template;

  // Collect all matches first, then resolve async
  const matches: Array<{ match: string; value: Promise<string> }> = [];

  // New simple syntax: {Label} - try input labels first, then node labels
  const simpleLabelPattern = /\{([^{}]+)\}/g;
  let simpleMatch;
  while ((simpleMatch = simpleLabelPattern.exec(template)) !== null) {
    const [fullMatch, label] = simpleMatch;
    const trimmedLabel = label.trim();

    let rawValue: string | undefined;

    // Check input labels first
    if (inputLabels?.has(trimmedLabel)) {
      rawValue = inputLabels.get(trimmedLabel);
    }
    // Check node labels
    else if (nodeLabels?.has(trimmedLabel)) {
      const nodeId = nodeLabels.get(trimmedLabel)!;
      const value = context.outputs.get(nodeId);
      rawValue = value !== undefined ? String(value) : undefined;
    }
    // Try direct lookup by input key (case insensitive)
    else {
      for (const [key, value] of Object.entries(context.inputs)) {
        if (key.toLowerCase() === trimmedLabel.toLowerCase()) {
          rawValue = String(value);
          break;
        }
      }
    }

    if (rawValue !== undefined) {
      matches.push({
        match: fullMatch,
        value: resolveFileContent(rawValue),
      });
    }
  }

  // Resolve all file reads in parallel
  const resolved = await Promise.all(
    matches.map(async (m) => ({
      match: m.match,
      value: await m.value,
    }))
  );

  // Apply replacements
  for (const { match, value } of resolved) {
    result = result.replace(match, value);
  }

  // Legacy syntax: {{inputs.key}} - also check for file content
  const inputPattern = /\{\{inputs\.(\w+)\}\}/g;
  let inputMatch;
  while ((inputMatch = inputPattern.exec(result)) !== null) {
    const [fullMatch, key] = inputMatch;
    const value = context.inputs[key];
    if (value !== undefined) {
      const resolvedValue = await resolveFileContent(String(value));
      result = result.replace(fullMatch, resolvedValue);
    }
  }

  // Legacy syntax: {{nodeId}}
  const outputPattern = /\{\{([a-zA-Z0-9_-]+)(?:\.output)?\}\}/g;
  result = result.replace(outputPattern, (match, nodeId) => {
    const value = context.outputs.get(nodeId);
    return value !== undefined ? String(value) : match;
  });

  return result;
}

/**
 * Get extension context for secret storage access
 */
let extensionContext: vscode.ExtensionContext | null = null;

export function setExtensionContext(context: vscode.ExtensionContext) {
  extensionContext = context;
}

// Reasoning effort is now imported from modelConfig.ts

/**
 * Execute LLM with OpenAI Responses API
 * Uses the newer Responses API for better GPT-5 support
 */
async function executeWithOpenAI(
  data: LLMNodeData,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const apiKeyManager = getAPIKeyManager();
  const apiKey = await apiKeyManager.getAPIKey();

  if (!apiKey) {
    throw new Error(
      'OpenAI API key not configured. Go to Ritemark Settings to add your API key.'
    );
  }

  const openai = new OpenAI({ apiKey });
  const model = data.model || DEFAULT_MODELS.flowLLM;

  // Build input with system prompt if provided
  const input = systemPrompt
    ? `${systemPrompt}\n\n${userPrompt}`
    : userPrompt;

  // Check model config to determine which API to use
  const useResponses = usesResponsesAPI(model);

  let outputText: string;

  if (!useResponses) {
    // Use Chat Completions API for GPT-4 models
    const messages: OpenAI.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userPrompt });

    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature: data.temperature ?? 0.7,
      max_tokens: data.maxTokens ?? 2000,
    });

    outputText = completion.choices[0]?.message?.content || '';
  } else {
    // Use Responses API for GPT-5+ models
    const reasoningEffort = getReasoningEffort(model);

    const response = await openai.responses.create({
      model,
      input,
      // Only include reasoning config if effort is not 'none'
      ...(reasoningEffort !== 'none' && {
        reasoning: {
          effort: reasoningEffort as 'low' | 'medium' | 'high',
        },
      }),
    });

    outputText = response.output_text;
  }

  if (!outputText) {
    console.error('[LLMNodeExecutor] Empty response for model:', model);
    throw new Error('No response from OpenAI API');
  }

  return outputText;
}

/**
 * Execute LLM with Google Gemini
 */
async function executeWithGemini(
  data: LLMNodeData,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  if (!extensionContext) {
    throw new Error('Extension context not initialized');
  }

  const apiKey = await extensionContext.secrets.get('google-ai-key');

  if (!apiKey) {
    throw new Error(
      'Google AI API key not configured. Go to Ritemark Settings to add your API key.'
    );
  }

  // Build the prompt - Gemini uses a different format
  const fullPrompt = systemPrompt
    ? `${systemPrompt}\n\n${userPrompt}`
    : userPrompt;

  // Use Gemini REST API (v1beta for preview models like Gemini 3)
  const model = data.model || DEFAULT_MODELS.flowLLMGemini;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: fullPrompt }],
        },
      ],
      generationConfig: {
        temperature: data.temperature ?? 0.7,
        maxOutputTokens: data.maxTokens ?? 2000,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error?.message || `Gemini API error: ${response.status}`
    );
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('No response from Gemini API');
  }

  return text;
}

/**
 * Execute LLM prompt node
 */
export async function executeLLMNode(
  node: FlowNode,
  context: ExecutionContext
): Promise<string> {
  const data = node.data as unknown as LLMNodeData;

  // Validate configuration
  if (!data.userPrompt) {
    throw new Error('LLM node missing user prompt');
  }

  // Interpolate variables in prompts (async - reads file contents)
  const systemPrompt = data.systemPrompt
    ? await interpolateVariables(data.systemPrompt, context, context.inputLabels, context.nodeLabels)
    : '';
  const userPrompt = await interpolateVariables(data.userPrompt, context, context.inputLabels, context.nodeLabels);

  const provider = data.provider || 'openai';

  try {
    let response: string;

    if (provider === 'gemini') {
      response = await executeWithGemini(data, systemPrompt, userPrompt);
    } else {
      response = await executeWithOpenAI(data, systemPrompt, userPrompt);
    }

    return response;
  } catch (err) {
    if (err instanceof Error) {
      // Handle specific errors
      if (err.message.includes('rate_limit')) {
        throw new Error('API rate limit exceeded. Please wait and try again.');
      }
      if (err.message.includes('invalid_api_key') || err.message.includes('API_KEY_INVALID')) {
        throw new Error('Invalid API key. Please check your settings.');
      }
      if (err.message.includes('insufficient_quota')) {
        throw new Error('API quota exceeded. Please check your billing.');
      }
      throw new Error(`LLM error: ${err.message}`);
    }
    throw new Error(`LLM node execution failed: ${String(err)}`);
  }
}

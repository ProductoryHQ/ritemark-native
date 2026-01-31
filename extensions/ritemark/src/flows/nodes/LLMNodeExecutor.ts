/**
 * LLM Node Executor
 *
 * Executes LLM prompt nodes using OpenAI API.
 * Supports variable interpolation from execution context.
 */

import OpenAI from 'openai';
import { getAPIKeyManager } from '../../ai/apiKeyManager';
import type { FlowNode, ExecutionContext } from '../types';

/**
 * LLM Node configuration
 */
interface LLMNodeData {
  label: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Replace template variables with values from context
 * Supports: {{inputs.variableName}}, {{nodeId.output}}
 */
function interpolateVariables(
  template: string,
  context: ExecutionContext
): string {
  let result = template;

  // Replace {{inputs.key}} with input values
  const inputPattern = /\{\{inputs\.(\w+)\}\}/g;
  result = result.replace(inputPattern, (match, key) => {
    const value = context.inputs[key];
    return value !== undefined ? String(value) : match;
  });

  // Replace {{nodeId}} with node output values
  const outputPattern = /\{\{([a-zA-Z0-9_-]+)(?:\.output)?\}\}/g;
  result = result.replace(outputPattern, (match, nodeId) => {
    const value = context.outputs.get(nodeId);
    return value !== undefined ? String(value) : match;
  });

  return result;
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

  // Get API key
  const apiKeyManager = getAPIKeyManager();
  const apiKey = await apiKeyManager.getAPIKey();

  if (!apiKey) {
    throw new Error(
      'OpenAI API key not configured. Use Command Palette → "RiteMark: Configure OpenAI API Key"'
    );
  }

  // Interpolate variables in prompts
  const systemPrompt = data.systemPrompt
    ? interpolateVariables(data.systemPrompt, context)
    : '';
  const userPrompt = interpolateVariables(data.userPrompt, context);

  console.log('[LLMNodeExecutor] Executing node:', node.id);
  console.log('[LLMNodeExecutor] System prompt:', systemPrompt);
  console.log('[LLMNodeExecutor] User prompt:', userPrompt);

  // Call OpenAI API
  const openai = new OpenAI({ apiKey });

  try {
    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: userPrompt,
    });

    const completion = await openai.chat.completions.create({
      model: data.model || 'gpt-4o-mini',
      messages,
      temperature: data.temperature ?? 0.7,
      max_tokens: data.maxTokens ?? 2000,
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      throw new Error('No response from OpenAI API');
    }

    console.log('[LLMNodeExecutor] Response length:', response.length, 'chars');

    return response;
  } catch (err) {
    if (err instanceof Error) {
      // Handle specific OpenAI errors
      if (err.message.includes('rate_limit')) {
        throw new Error('OpenAI rate limit exceeded. Please wait and try again.');
      }
      if (err.message.includes('invalid_api_key')) {
        throw new Error('Invalid OpenAI API key. Please reconfigure.');
      }
      if (err.message.includes('insufficient_quota')) {
        throw new Error('OpenAI API quota exceeded. Please check your billing.');
      }
      throw new Error(`OpenAI API error: ${err.message}`);
    }
    throw new Error(`LLM node execution failed: ${String(err)}`);
  }
}

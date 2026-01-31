/**
 * OpenAI Client for AI-powered text editing
 * Adapted from ritemark-app for VS Code extension context
 *
 * Key differences from ritemark-app:
 * - No `dangerouslyAllowBrowser` flag (runs in Node.js)
 * - Plain text passed directly (no TipTap editor dependency)
 * - API key from VS Code SecretStorage
 */

import * as vscode from 'vscode';
import OpenAI from 'openai';
import TurndownService from 'turndown';
import { tables } from 'turndown-plugin-gfm';
import { getAPIKeyManager } from './apiKeyManager';
import { DEFAULT_MODELS, usesResponsesAPI, getReasoningEffort } from './modelConfig';

/**
 * Initialize TurndownService for HTML to Markdown conversion
 */
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**'
});
turndownService.use(tables);

/**
 * Editor selection context
 */
export interface EditorSelection {
  text: string;
  isEmpty: boolean;
  from: number;
  to: number;
}

/**
 * AI Command Result
 */
export interface AICommandResult {
  success: boolean;
  message?: string;
  error?: string;
  toolCall?: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

/**
 * Conversation message for OpenAI API
 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Partial tool call being buffered during streaming
 */
interface PartialToolCall {
  name: string;
  arguments: string;
}

/**
 * Tool call buffer for reconstructing complete tool calls from stream chunks
 */
class ToolCallBuffer {
  private calls: Map<number, PartialToolCall> = new Map();

  addChunk(chunk: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall): void {
    const index = chunk.index ?? 0;
    const existing = this.calls.get(index) || { name: '', arguments: '' };

    if (chunk.function?.name) {
      existing.name += chunk.function.name;
    }

    if (chunk.function?.arguments) {
      existing.arguments += chunk.function.arguments;
    }

    this.calls.set(index, existing);
  }

  hasToolCalls(): boolean {
    return this.calls.size > 0;
  }

  getFirstToolCall(): { name: string; arguments: Record<string, unknown> } | null {
    if (this.calls.size === 0) return null;

    const firstCall = this.calls.get(0);
    if (!firstCall || !firstCall.name) return null;

    try {
      const parsedArgs = firstCall.arguments ? JSON.parse(firstCall.arguments) : {};
      return {
        name: firstCall.name,
        arguments: parsedArgs
      };
    } catch (error) {
      console.error('[ToolCallBuffer] Failed to parse tool arguments:', error);
      return null;
    }
  }
}

/**
 * Tool specifications for OpenAI function calling
 */
const rephraseTextTool: OpenAI.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'rephraseText',
    description:
      'Rephrase/rewrite the SELECTED text. Use when user wants to modify selected text (make longer, shorter, simpler, more formal, etc). ONLY works when text is selected.',
    parameters: {
      type: 'object',
      properties: {
        newText: {
          type: 'string',
          description: 'The rephrased/rewritten version of the selected text'
        },
        style: {
          type: 'string',
          description: 'Style applied to the text',
          enum: ['longer', 'shorter', 'simpler', 'formal', 'casual', 'professional']
        }
      },
      required: ['newText']
    }
  }
};

const findAndReplaceAllTool: OpenAI.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'findAndReplaceAll',
    description: 'Find ALL occurrences of text and replace with new text. Shows preview before execution.',
    parameters: {
      type: 'object',
      properties: {
        searchPattern: {
          type: 'string',
          description: 'Text to search for (will find ALL occurrences)'
        },
        replacement: {
          type: 'string',
          description: 'Replacement text'
        },
        options: {
          type: 'object',
          properties: {
            matchCase: { type: 'boolean', description: 'Case-sensitive search (default: false)' },
            wholeWord: { type: 'boolean', description: 'Match whole words only (default: false)' },
            preserveCase: { type: 'boolean', description: 'Preserve original case (default: true)' }
          }
        }
      },
      required: ['searchPattern', 'replacement']
    }
  }
};

const insertTextTool: OpenAI.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'insertText',
    description: 'Insert NEW text at a specific position in the document.',
    parameters: {
      type: 'object',
      properties: {
        position: {
          type: 'object',
          description: 'Where to insert the text',
          properties: {
            type: { type: 'string', enum: ['absolute', 'relative', 'selection'] },
            location: { type: 'string', enum: ['start', 'end'] },
            anchor: { type: 'string', description: 'Text to search for as reference point' },
            placement: { type: 'string', enum: ['before', 'after'] }
          }
        },
        content: {
          type: 'string',
          description: 'The text to insert. Use markdown formatting: ## for headings, **bold**, *italic*, - for lists'
        }
      },
      required: ['position', 'content']
    }
  }
};

/**
 * Create OpenAI client with API key from SecretStorage
 */
async function createOpenAIClient(): Promise<OpenAI | null> {
  const apiKeyManager = getAPIKeyManager();
  const apiKey = await apiKeyManager.getAPIKey();

  if (!apiKey) {
    console.error('[OpenAI] No API key configured');
    return null;
  }

  return new OpenAI({ apiKey });
}

/**
 * Get configured AI model from VS Code settings
 */
function getConfiguredModel(): string {
  const config = vscode.workspace.getConfiguration('ritemark');
  return config.get('ai.model', DEFAULT_MODELS.assistant);
}

/**
 * Execute a user command using OpenAI function calling
 *
 * @param prompt - User's natural language command
 * @param plainText - Full document text (rendered)
 * @param selection - Current editor selection context
 * @param conversationHistory - Previous messages for context
 * @param onStreamUpdate - Callback for progressive content updates
 * @param abortSignal - Optional AbortSignal for cancellation
 */
export async function executeCommand(
  prompt: string,
  plainText: string,
  selection: EditorSelection,
  conversationHistory: ConversationMessage[] = [],
  onStreamUpdate?: (content: string) => void,
  abortSignal?: AbortSignal
): Promise<AICommandResult> {
  const openai = await createOpenAIClient();
  if (!openai) {
    return {
      success: false,
      error: 'OpenAI API key not configured. Use Command Palette → "RiteMark: Configure OpenAI API Key"'
    };
  }

  if (!prompt || prompt.trim().length === 0) {
    return { success: false, error: 'Please provide a command' };
  }

  try {
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;

    // Build system message
    const systemMessage: OpenAI.ChatCompletionSystemMessageParam = {
      role: 'system',
      content: `You are editing a document.

**Full Document Content** (${wordCount} words):
\`\`\`
${plainText}
\`\`\`

**Currently Selected Text**: ${selection.isEmpty ? 'None' : `"${selection.text}"`}

**Available Tools**:
1. **rephraseText** - Rephrase SELECTED text (only when text is selected)
2. **findAndReplaceAll** - Find and replace ALL occurrences
3. **insertText** - Add NEW content at a position

**When to Use Tools vs Conversational Response**:
- Use tools ONLY when user explicitly wants to EDIT the document
- Respond conversationally for questions, brainstorming, advice

**If unclear whether user wants to edit or discuss, PREFER CONVERSATIONAL RESPONSE.**`
    };

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => controller.abort());
    }

    try {
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        systemMessage,
        ...conversationHistory,
        { role: 'user', content: prompt }
      ];

      // Get model from settings
      const model = getConfiguredModel();
      const useResponses = usesResponsesAPI(model);

      console.log(`[OpenAI] Using model: ${model}, API: ${useResponses ? 'Responses' : 'Chat Completions'}`);

      // For tool calling, we need Chat Completions API
      // Responses API doesn't support function calling in the same way
      // GPT-5 models also work with Chat Completions API
      const stream = await openai.chat.completions.create(
        {
          model,
          messages,
          tools: [rephraseTextTool, findAndReplaceAllTool, insertTextTool],
          tool_choice: 'auto',
          stream: true
        },
        { signal: controller.signal }
      );

      // Process stream
      const toolCallBuffer = new ToolCallBuffer();
      let contentBuffer = '';
      let lastUpdateTime = Date.now();
      const UPDATE_INTERVAL_MS = 50;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          contentBuffer += delta.content;
          const now = Date.now();
          if (onStreamUpdate && now - lastUpdateTime >= UPDATE_INTERVAL_MS) {
            onStreamUpdate(contentBuffer);
            lastUpdateTime = now;
          }
        }

        if (delta?.tool_calls) {
          for (const toolCallChunk of delta.tool_calls) {
            toolCallBuffer.addChunk(toolCallChunk);
          }
        }
      }

      // Flush final content update
      if (onStreamUpdate && contentBuffer) {
        onStreamUpdate(contentBuffer);
      }

      clearTimeout(timeoutId);

      // Check for tool call
      const toolCall = toolCallBuffer.getFirstToolCall();

      if (!toolCall) {
        // Conversational response
        return {
          success: true,
          message: contentBuffer || "I can help you edit your document. What would you like to do?"
        };
      }

      // Return tool call for widget handling
      return {
        success: true,
        toolCall: {
          name: toolCall.name,
          arguments: toolCall.arguments
        }
      };

    } catch (error) {
      clearTimeout(timeoutId);

      const errorMessage = (error as Error)?.message?.toLowerCase() || '';
      if (errorMessage.includes('abort')) {
        if (abortSignal?.aborted) {
          return { success: false, error: '__USER_STOPPED__' };
        }
        return { success: false, error: 'Request timed out (90s). Please try a simpler command.' };
      }

      throw error;
    }

  } catch (error: unknown) {
    const apiError = error as { status?: number; message?: string };

    if (apiError?.status === 401) {
      return { success: false, error: 'Invalid API key. Please check your API key configuration.' };
    }

    if (apiError?.status === 429) {
      return { success: false, error: 'Rate limit exceeded. Please try again in a moment.' };
    }

    console.error('[OpenAI] Unexpected error:', error);
    return {
      success: false,
      error: apiError?.message || 'An unexpected error occurred. Please try again.'
    };
  }
}

/**
 * Test OpenAI connection
 */
export async function testConnection(): Promise<AICommandResult> {
  const openai = await createOpenAIClient();
  if (!openai) {
    return { success: false, error: 'OpenAI API key not configured.' };
  }

  try {
    const model = getConfiguredModel();
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 5
    });

    if (response.choices[0]?.message?.content) {
      return { success: true, message: `Connected with ${model}` };
    }

    return { success: false, error: 'Unexpected response from OpenAI' };
  } catch (error: unknown) {
    const apiError = error as { message?: string };
    return { success: false, error: apiError?.message || 'Connection test failed' };
  }
}

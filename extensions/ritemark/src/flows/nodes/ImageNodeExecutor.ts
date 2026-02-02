/**
 * Image Node Executor
 *
 * Executes image generation nodes using OpenAI GPT Image 1.5 API.
 * Images are auto-downloaded to .flows/images/ per Jarmo's decision.
 *
 * Supports providers:
 * - openai: GPT Image 1.5 (default, uses existing API key)
 * - gemini: Nano Banana Pro (requires Google AI API key) - future
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import OpenAI from 'openai';
import { getAPIKeyManager } from '../../ai/apiKeyManager';
import { DEFAULT_MODELS } from '../../ai/modelConfig';
import type { FlowNode, ExecutionContext } from '../types';

/**
 * Extension context for secret storage access
 */
let extensionContext: vscode.ExtensionContext | null = null;

export function setImageNodeExtensionContext(context: vscode.ExtensionContext) {
  extensionContext = context;
}

/**
 * Image Node configuration
 */
interface ImageNodeData {
  label: string;
  provider: 'openai' | 'gemini';
  model: string;
  prompt: string;
  // Image input sources (node IDs or input labels that provide images)
  inputImages: string[];
  // Action: auto (model decides), generate (new image), edit (modify input)
  action: 'auto' | 'generate' | 'edit';
  // Input fidelity for preserving faces/logos from input images
  inputFidelity: 'low' | 'high';
  size: '1024x1024' | '1792x1024' | '1024x1792';
  quality: 'standard' | 'hd';
  style: 'natural' | 'vivid';
}

/**
 * Image generation result
 */
interface ImageResult {
  url: string;
  localPath: string;
  revisedPrompt?: string;
}

/**
 * Replace template variables with values from context
 *
 * Supports two syntaxes:
 * 1. New simple: {Label} - matches by input label or node label
 * 2. Legacy: {{inputs.key}}, {{nodeId}} - matches by ID
 */
function interpolateVariables(
  template: string,
  context: ExecutionContext
): string {
  let result = template;

  // New simple syntax: {Label} - try input labels first, then node labels
  const simpleLabelPattern = /\{([^{}]+)\}/g;
  result = result.replace(simpleLabelPattern, (match, label) => {
    const trimmedLabel = label.trim();

    // Check input labels first
    if (context.inputLabels?.has(trimmedLabel)) {
      return context.inputLabels.get(trimmedLabel) || match;
    }

    // Check node labels
    if (context.nodeLabels?.has(trimmedLabel)) {
      const nodeId = context.nodeLabels.get(trimmedLabel)!;
      const value = context.outputs.get(nodeId);
      return value !== undefined ? String(value) : match;
    }

    // Try direct lookup by input key (case insensitive)
    for (const [key, value] of Object.entries(context.inputs)) {
      if (key.toLowerCase() === trimmedLabel.toLowerCase()) {
        return String(value);
      }
    }

    return match;
  });

  // Legacy syntax: {{inputs.key}}
  const inputPattern = /\{\{inputs\.(\w+)\}\}/g;
  result = result.replace(inputPattern, (match, key) => {
    const value = context.inputs[key];
    return value !== undefined ? String(value) : match;
  });

  // Legacy syntax: {{nodeId}}
  const outputPattern = /\{\{([a-zA-Z0-9_-]+)(?:\.output)?\}\}/g;
  result = result.replace(outputPattern, (match, nodeId) => {
    const value = context.outputs.get(nodeId);
    return value !== undefined ? String(value) : match;
  });

  return result;
}

/**
 * Ensure .flows/images directory exists
 */
async function ensureImagesDirectory(workspacePath: string): Promise<string> {
  const imagesDir = path.join(workspacePath, '.flows', 'images');
  try {
    await fs.access(imagesDir);
  } catch {
    await fs.mkdir(imagesDir, { recursive: true });
  }
  return imagesDir;
}

/**
 * Resolve image sources to file paths or base64 data
 * Sources can be:
 * - "input:Label" - file input from trigger
 * - "node:nodeId" - output from upstream image node
 */
async function resolveImageSources(
  sources: string[],
  context: ExecutionContext
): Promise<string[]> {
  const resolvedImages: string[] = [];

  for (const source of sources) {
    if (source.startsWith('input:')) {
      // File input from trigger
      const inputLabel = source.substring(6);
      // Try to find by label first
      const value = context.inputLabels?.get(inputLabel);
      if (value) {
        // Value should be a file path
        resolvedImages.push(value);
      }
    } else if (source.startsWith('node:')) {
      // Output from upstream image node
      const nodeId = source.substring(5);
      const output = context.outputs.get(nodeId);
      if (output && typeof output === 'object' && 'localPath' in output) {
        resolvedImages.push((output as { localPath: string }).localPath);
      }
    }
  }

  return resolvedImages;
}

/**
 * Read image file and convert to base64
 */
async function imageToBase64(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return buffer.toString('base64');
}

/**
 * Download image from URL to local file
 */
async function downloadImage(
  url: string,
  filename: string,
  imagesDir: string
): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const localPath = path.join(imagesDir, filename);
  await fs.writeFile(localPath, buffer);

  return localPath;
}

/**
 * Generate image using OpenAI image models
 */
async function generateWithOpenAI(
  prompt: string,
  options: {
    model: string;
    inputImages: string[];
    action: 'auto' | 'generate' | 'edit';
    inputFidelity: 'low' | 'high';
    size: string;
    quality: string;
    style: string;
  },
  imagesDir: string
): Promise<ImageResult> {
  const apiKeyManager = getAPIKeyManager();
  const apiKey = await apiKeyManager.getAPIKey();

  if (!apiKey) {
    throw new Error(
      'OpenAI API key not configured. Use Command Palette → "Ritemark: Configure OpenAI API Key"'
    );
  }

  const openai = new OpenAI({ apiKey });

  const model = options.model || 'gpt-image-1.5';
  const hasInputImages = options.inputImages.length > 0;

  // Check if using GPT Image models vs DALL-E
  const isGptImageModel = model.includes('gpt-image');
  const isDallE3 = model.includes('dall-e-3');

  // Map quality values: UI uses standard/hd, GPT Image uses low/medium/high/auto
  let quality: string;
  if (isGptImageModel) {
    quality = options.quality === 'hd' ? 'high' : 'medium';
  } else {
    quality = options.quality || 'standard';
  }

  // Map size values: GPT Image uses different landscape/portrait sizes
  let size: string = options.size || '1024x1024';
  if (isGptImageModel) {
    if (size === '1792x1024') size = '1536x1024';
    if (size === '1024x1792') size = '1024x1536';
  }

  let response;

  if (hasInputImages && isGptImageModel) {
    // Use edit endpoint for GPT Image models with input images
    // Convert images to base64 for the API
    let imageData: string | undefined;

    if (options.inputImages.length > 0) {
      try {
        const base64 = await imageToBase64(options.inputImages[0]);
        const ext = path.extname(options.inputImages[0]).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
        imageData = `data:${mimeType};base64,${base64}`;
      } catch {
        // Image file not found or couldn't be read - continue without it
      }
    }

    // GPT Image models always return base64, not URL
    response = await openai.images.generate({
      model,
      prompt,
      n: 1,
      size: size as '1024x1024' | '1792x1024' | '1024x1792',
      quality: quality as 'low' | 'medium' | 'high' | 'auto',
      ...(imageData && { image: imageData }),
      ...(imageData && { input_fidelity: options.inputFidelity }),
    });
  } else if (isGptImageModel) {
    // GPT Image model without input images - always returns base64
    response = await openai.images.generate({
      model,
      prompt,
      n: 1,
      size: size as '1024x1024' | '1792x1024' | '1024x1792',
      quality: quality as 'low' | 'medium' | 'high' | 'auto',
    });
  } else if (isDallE3) {
    // DALL-E 3 supports style parameter
    response = await openai.images.generate({
      model,
      prompt,
      n: 1,
      size: size as '1024x1024' | '1792x1024' | '1024x1792',
      quality: (options.quality || 'standard') as 'standard' | 'hd',
      style: options.style as 'natural' | 'vivid',
      response_format: 'url',
    });
  } else {
    // DALL-E 2 or other models
    response = await openai.images.generate({
      model,
      prompt,
      n: 1,
      size: size as '256x256' | '512x512' | '1024x1024',
      response_format: 'url',
    });
  }

  const imageResponseData = response.data?.[0];
  const revisedPrompt = imageResponseData?.revised_prompt;

  // Generate unique filename
  const timestamp = Date.now();
  const filename = `image-${timestamp}.png`;
  const localPath = path.join(imagesDir, filename);

  // Handle both base64 (GPT Image models) and URL (DALL-E) responses
  if (imageResponseData?.b64_json) {
    // GPT Image models return base64 - save directly
    const buffer = Buffer.from(imageResponseData.b64_json, 'base64');
    await fs.writeFile(localPath, buffer);

    return {
      url: `file://${localPath}`,
      localPath,
      revisedPrompt,
    };
  } else if (imageResponseData?.url) {
    // DALL-E models return URL - download
    const downloadedPath = await downloadImage(imageResponseData.url, filename, imagesDir);

    return {
      url: imageResponseData.url,
      localPath: downloadedPath,
      revisedPrompt,
    };
  } else {
    throw new Error('No image data in response (neither URL nor base64)');
  }
}

/**
 * Generate image using Google Gemini (Imagen 4 or Nano Banana)
 */
async function generateWithGemini(
  prompt: string,
  options: {
    model: string;
    size: string;
    quality: string;
  },
  imagesDir: string
): Promise<ImageResult> {
  if (!extensionContext) {
    throw new Error('Extension context not initialized');
  }

  const apiKey = await extensionContext.secrets.get('google-ai-key');

  if (!apiKey) {
    throw new Error(
      'Google AI API key not configured. Go to Ritemark Settings to add your API key.'
    );
  }

  const model = options.model || DEFAULT_MODELS.flowImageGemini;
  const isImagen = model.includes('imagen');
  const isNanoBanana = model.includes('gemini') && model.includes('image');

  let imageBase64: string;

  if (isImagen) {
    // Use Imagen API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: options.size === '1024x1024' ? '1:1' :
                       options.size === '1792x1024' || options.size === '1536x1024' ? '16:9' : '9:16',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.error?.message || `Imagen API error: ${response.status}`
      );
    }

    const result = await response.json();
    const prediction = result.predictions?.[0];

    if (!prediction?.bytesBase64Encoded) {
      throw new Error('No image data in Imagen response');
    }

    imageBase64 = prediction.bytesBase64Encoded;
  } else if (isNanoBanana) {
    // Use Gemini generateContent with image output
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.error?.message || `Gemini Image API error: ${response.status}`
      );
    }

    const result = await response.json();
    const parts = result.candidates?.[0]?.content?.parts || [];

    // Find the image part
    const imagePart = parts.find((p: { inlineData?: { data: string } }) => p.inlineData?.data);

    if (!imagePart?.inlineData?.data) {
      throw new Error('No image generated in Gemini response');
    }

    imageBase64 = imagePart.inlineData.data;
  } else {
    throw new Error(`Unknown Gemini image model: ${model}`);
  }

  // Save image to file
  const timestamp = Date.now();
  const filename = `image-${timestamp}.png`;
  const localPath = path.join(imagesDir, filename);

  const buffer = Buffer.from(imageBase64, 'base64');
  await fs.writeFile(localPath, buffer);

  return {
    url: `file://${localPath}`,
    localPath,
  };
}

/**
 * Execute image generation node
 */
export async function executeImageNode(
  node: FlowNode,
  context: ExecutionContext
): Promise<ImageResult> {
  const data = node.data as unknown as ImageNodeData;

  // Validate configuration
  if (!data.prompt) {
    throw new Error('Image node missing prompt');
  }

  // Interpolate variables in prompt
  const prompt = interpolateVariables(data.prompt, context);

  // Ensure images directory exists
  const imagesDir = await ensureImagesDirectory(context.workspacePath);

  // Resolve input images if any
  const inputImages = data.inputImages?.length
    ? await resolveImageSources(data.inputImages, context)
    : [];

  // Generate based on provider
  switch (data.provider || 'openai') {
    case 'openai':
      return await generateWithOpenAI(
        prompt,
        {
          model: data.model || 'gpt-image-1.5',
          inputImages,
          action: data.action || 'auto',
          inputFidelity: data.inputFidelity || 'low',
          size: data.size || '1024x1024',
          quality: data.quality || 'standard',
          style: data.style || 'natural',
        },
        imagesDir
      );

    case 'gemini':
      return await generateWithGemini(
        prompt,
        {
          model: data.model || DEFAULT_MODELS.flowImageGemini,
          size: data.size || '1024x1024',
          quality: data.quality || 'standard',
        },
        imagesDir
      );

    default:
      throw new Error(`Unknown image provider: ${data.provider}`);
  }
}

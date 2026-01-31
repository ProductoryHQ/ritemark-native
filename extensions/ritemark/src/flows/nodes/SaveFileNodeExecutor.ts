/**
 * Save File Node Executor
 *
 * Saves flow outputs to files in the workspace.
 * Supports markdown, CSV, and image formats.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { FlowNode, ExecutionContext } from '../types';

/**
 * Save File Node configuration
 */
interface SaveFileNodeData {
  label: string;
  filename: string;
  format: 'markdown' | 'csv' | 'image';
  sourceNodeId: string;
}

/**
 * Save file result
 */
interface SaveResult {
  path: string;
  size: number;
}

/**
 * Replace template variables in filename
 */
function interpolateFilename(
  template: string,
  context: ExecutionContext
): string {
  let result = template;

  // Replace {{inputs.key}} with input values
  const inputPattern = /\{\{inputs\.(\w+)\}\}/g;
  result = result.replace(inputPattern, (match, key) => {
    const value = context.inputs[key];
    if (value === undefined) return match;
    // Sanitize for filename
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
  });

  // Replace {{nodeId}} with node output values (sanitized)
  const outputPattern = /\{\{([a-zA-Z0-9_-]+)(?:\.output)?\}\}/g;
  result = result.replace(outputPattern, (match, nodeId) => {
    const value = context.outputs.get(nodeId);
    if (value === undefined) return match;
    // For filenames, just use first 20 chars of output, sanitized
    const strValue = String(value).slice(0, 20);
    return strValue.replace(/[^a-zA-Z0-9_-]/g, '_');
  });

  // Replace {{timestamp}} with current timestamp
  result = result.replace(/\{\{timestamp\}\}/g, Date.now().toString());

  // Replace {{date}} with YYYY-MM-DD
  result = result.replace(/\{\{date\}\}/g, new Date().toISOString().slice(0, 10));

  return result;
}

/**
 * Get file extension for format
 */
function getExtension(format: string): string {
  switch (format) {
    case 'markdown':
      return '.md';
    case 'csv':
      return '.csv';
    case 'image':
      return '.png'; // Default, actual extension from source
    default:
      return '.txt';
  }
}

/**
 * Ensure output directory exists
 */
async function ensureOutputDirectory(outputPath: string): Promise<void> {
  const dir = path.dirname(outputPath);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
    console.log('[SaveFileNodeExecutor] Created directory:', dir);
  }
}

/**
 * Execute save file node
 */
export async function executeSaveFileNode(
  node: FlowNode,
  context: ExecutionContext
): Promise<SaveResult> {
  const data = node.data as unknown as SaveFileNodeData;

  // Validate configuration
  if (!data.filename) {
    throw new Error('Save file node missing filename');
  }

  if (!data.sourceNodeId) {
    throw new Error('Save file node missing source node ID');
  }

  // Get source output
  const sourceOutput = context.outputs.get(data.sourceNodeId);
  if (sourceOutput === undefined) {
    throw new Error(`Source node "${data.sourceNodeId}" has no output`);
  }

  // Interpolate filename
  let filename = interpolateFilename(data.filename, context);

  // Ensure extension matches format
  const format = data.format || 'markdown';
  const expectedExt = getExtension(format);
  if (!filename.toLowerCase().endsWith(expectedExt)) {
    // Handle image format specially - check source for actual extension
    if (format === 'image' && typeof sourceOutput === 'object') {
      const imageResult = sourceOutput as { localPath?: string };
      if (imageResult.localPath) {
        const sourceExt = path.extname(imageResult.localPath);
        if (!filename.includes('.')) {
          filename += sourceExt || expectedExt;
        }
      } else if (!filename.includes('.')) {
        filename += expectedExt;
      }
    } else if (!filename.includes('.')) {
      filename += expectedExt;
    }
  }

  // Determine output path (relative to workspace)
  const outputPath = path.isAbsolute(filename)
    ? filename
    : path.join(context.workspacePath, filename);

  // Ensure directory exists
  await ensureOutputDirectory(outputPath);

  // Write content based on format
  let size: number;

  switch (format) {
    case 'markdown':
    case 'csv': {
      const content = String(sourceOutput);
      await fs.writeFile(outputPath, content, 'utf-8');
      size = Buffer.byteLength(content, 'utf-8');
      break;
    }

    case 'image': {
      // Image source should have localPath from ImageNodeExecutor
      if (typeof sourceOutput === 'object' && sourceOutput !== null) {
        const imageResult = sourceOutput as { localPath?: string };
        if (imageResult.localPath) {
          // Copy image to output location
          const sourceBuffer = await fs.readFile(imageResult.localPath);
          await fs.writeFile(outputPath, sourceBuffer);
          size = sourceBuffer.length;
        } else {
          throw new Error('Image source has no local path');
        }
      } else if (typeof sourceOutput === 'string') {
        // Source is a URL - download it
        const response = await fetch(sourceOutput);
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.statusText}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        await fs.writeFile(outputPath, buffer);
        size = buffer.length;
      } else {
        throw new Error('Invalid image source');
      }
      break;
    }

    default:
      throw new Error(`Unknown save format: ${format}`);
  }

  console.log('[SaveFileNodeExecutor] Saved file:', outputPath, `(${size} bytes)`);

  return {
    path: outputPath,
    size,
  };
}

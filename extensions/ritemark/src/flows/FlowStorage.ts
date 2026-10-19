/**
 * Flow Storage Service
 *
 * CRUD operations for .flow.json files in the workspace.
 * Flows are stored in .ritemark/flows/ directory at workspace root.
 *
 * Listing creates nothing (Sprint 134, R13): the scheduler lists flows at
 * start and every 30 s, so a listing that made `.ritemark/flows` gave every
 * project an empty one and brought back a project folder that was deleted
 * while it was open. Only a save makes the folder, and only while the
 * project's folder is there (`ensureProjectSubfolder`).
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ensureProjectSubfolder } from '../projects/projectFolderGuard';
import type { Flow } from './types';

const FLOWS_FOLDER = '.ritemark/flows';

/**
 * Sanitize a string for use in a filename
 */
function sanitizeForFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '')     // Remove leading/trailing hyphens
    .slice(0, 30);               // Limit length
}

/**
 * Generate a short random suffix for uniqueness
 */
function shortId(): string {
  return Math.random().toString(36).slice(2, 6);
}

export class FlowStorage {
  private readonly projectRoot: string;
  private flowsDir: string;

  constructor(workspacePath: string) {
    this.projectRoot = workspacePath;
    this.flowsDir = path.join(workspacePath, ...FLOWS_FOLDER.split('/'));
  }

  /**
   * Make .ritemark/flows for a save. Refuses, and makes nothing, when the
   * project's folder itself is not there (R13).
   */
  async ensureFlowsDirectory(): Promise<void> {
    await ensureProjectSubfolder(this.projectRoot, FLOWS_FOLDER);
  }

  /**
   * List all flows. Creates nothing: no .ritemark/flows means no flows.
   */
  async listFlows(): Promise<Flow[]> {
    try {
      let files: string[];
      try {
        files = await fs.readdir(this.flowsDir);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'ENOENT' || code === 'ENOTDIR') return [];
        throw err;
      }
      const flowFiles = files.filter((f) => f.endsWith('.flow.json'));

      const flows: Flow[] = [];
      for (const file of flowFiles) {
        try {
          const flow = await this.loadFlow(path.basename(file, '.flow.json'));
          flows.push(flow);
        } catch (err) {
          console.error(`[FlowStorage] Failed to load ${file}:`, err);
          // Skip invalid flows
        }
      }

      return flows.sort((a, b) => b.modified.localeCompare(a.modified));
    } catch (err) {
      console.error('[FlowStorage] Failed to list flows:', err);
      return [];
    }
  }

  /**
   * Load a single flow by ID
   */
  async loadFlow(id: string): Promise<Flow> {
    const flowPath = path.join(this.flowsDir, `${id}.flow.json`);

    try {
      const content = await fs.readFile(flowPath, 'utf-8');
      const flow = JSON.parse(content) as Flow;

      // Validate basic structure
      if (!flow.id || !flow.name || !flow.nodes || !flow.edges) {
        throw new Error('Invalid flow structure');
      }

      return flow;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Flow not found: ${id}`);
      }
      throw new Error(`Failed to load flow: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Save a flow
   */
  async saveFlow(flow: Flow): Promise<void> {
    await this.ensureFlowsDirectory();

    const flowPath = path.join(this.flowsDir, `${flow.id}.flow.json`);

    // Update modified timestamp
    flow.modified = new Date().toISOString();

    try {
      await fs.writeFile(flowPath, JSON.stringify(flow, null, 2), 'utf-8');
    } catch (err) {
      throw new Error(`Failed to save flow: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Delete a flow
   */
  async deleteFlow(id: string): Promise<void> {
    const flowPath = path.join(this.flowsDir, `${id}.flow.json`);

    try {
      await fs.unlink(flowPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Flow not found: ${id}`);
      }
      throw new Error(`Failed to delete flow: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Check if a flow exists
   */
  async flowExists(id: string): Promise<boolean> {
    const flowPath = path.join(this.flowsDir, `${id}.flow.json`);
    try {
      await fs.access(flowPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the full path to a flow file
   */
  getFlowPath(id: string): string {
    return path.join(this.flowsDir, `${id}.flow.json`);
  }

  /**
   * Create a new flow with defaults
   * ID format: sanitized-name-xxxx (e.g., my-blog-post-x4k9)
   */
  createNewFlow(name: string, description: string = ''): Flow {
    const now = new Date().toISOString();
    const sanitizedName = sanitizeForFilename(name) || 'flow';
    const id = `${sanitizedName}-${shortId()}`;
    const triggerId = `node-${Date.now()}`;
    const inputId = `input-${Date.now()}`;

    return {
      id,
      name,
      description,
      version: 1,
      created: now,
      modified: now,
      inputs: [
        {
          id: inputId,
          type: 'text',
          label: 'Input',
          required: true,
          defaultValue: '',
        },
      ],
      nodes: [
        {
          id: triggerId,
          type: 'trigger',
          position: { x: 250, y: 50 },
          data: {
            label: 'Trigger',
            inputs: [
              {
                id: inputId,
                type: 'text',
                label: 'Input',
                required: true,
                defaultValue: '',
              },
            ],
          },
        },
      ],
      edges: [],
    };
  }

  /**
   * Generate a flow ID from a name
   */
  static generateFlowId(name: string): string {
    const sanitizedName = sanitizeForFilename(name) || 'flow';
    return `${sanitizedName}-${shortId()}`;
  }
}

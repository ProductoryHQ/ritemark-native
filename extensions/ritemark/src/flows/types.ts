/**
 * Flow Type Definitions
 *
 * Defines the structure of flows and their components.
 */

/**
 * Flow definition stored in .flow.json files
 */
export interface Flow {
  id: string;
  name: string;
  description: string;
  version: number;
  created: string; // ISO 8601 timestamp
  modified: string; // ISO 8601 timestamp
  inputs: FlowInput[];
  schedule?: FlowSchedule;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/**
 * ISO 8601 weekday numbering for scheduled runs.
 * Monday=1 ... Sunday=7
 */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Supported recurrence types for flow scheduling.
 */
export type FlowScheduleType =
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'hourly'
  | 'interval';

/**
 * Flow-level schedule config stored in the flow file.
 * Runtime state is intentionally kept outside the flow JSON.
 */
export interface FlowSchedule {
  enabled: boolean;
  type: FlowScheduleType;
  /** Local time in 24-hour HH:mm format, used by daily/weekdays/weekly */
  time?: string;
  /** ISO 8601 weekdays used only for weekly schedules */
  days?: IsoWeekday[];
  /** Minute past the hour, used only for hourly schedules */
  minuteOfHour?: number;
  /** Repeat interval in minutes, used only for interval schedules */
  intervalMinutes?: number;
}

/**
 * Input definitions for flow execution
 */
export interface FlowInput {
  id: string;
  type: 'text' | 'file';
  label: string;
  required: boolean;
  defaultValue?: string;
}

/**
 * Node in the flow graph
 */
export interface FlowNode {
  id: string;
  type: 'trigger' | 'llm-prompt' | 'image-prompt' | 'save-file' | 'claude-code' | 'codex';
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

/**
 * Edge connecting nodes
 */
export interface FlowEdge {
  id: string;
  source: string;
  target: string;
}

/**
 * Execution context passed through the flow
 */
export interface ExecutionContext {
  inputs: Record<string, unknown>;
  outputs: Map<string, unknown>;
  workspacePath: string;
  /** Map of input label -> input value (for {Label} syntax) */
  inputLabels: Map<string, string>;
  /** Map of node label -> node ID (for {Label} syntax) */
  nodeLabels: Map<string, string>;
}

/**
 * Execution result
 */
export interface ExecutionResult {
  success: boolean;
  outputs: Record<string, unknown>;
  error?: string;
}

/**
 * Progress callback data
 */
export interface ExecutionProgress {
  step: number;
  total: number;
  currentNode: string;
  currentNodeLabel?: string;
}

/**
 * Claude Code specific progress updates
 */
export interface ClaudeCodeProgress {
  type: 'init' | 'tool_use' | 'thinking' | 'text' | 'done';
  message: string;
  tool?: string;
  file?: string;
}

/**
 * Progress callback function type
 */
export type ProgressCallback = (progress: ClaudeCodeProgress) => void;

/**
 * Node execution function signature
 */
export type NodeExecutor = (
  node: FlowNode,
  context: ExecutionContext
) => Promise<unknown>;

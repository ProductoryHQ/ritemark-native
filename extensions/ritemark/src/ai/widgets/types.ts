/**
 * Widget Plugin System - Core Types
 * Copied from ritemark-app
 *
 * Widgets are interactive UI components that preview and execute AI operations.
 */

/**
 * Widget execution result
 */
export interface WidgetResult {
  success: boolean;
  message: string;
  changes?: number;
  errors?: string[];
}

/**
 * Widget preview information
 * Shows user what will happen before execution
 */
export interface WidgetPreview {
  count: number;           // How many items found/affected
  samples?: string[];      // Sample matches (first 3-5)
  estimatedChanges?: {
    additions?: number;
    deletions?: number;
    modifications?: number;
  };
}

/**
 * Widget state during lifecycle
 */
export type WidgetState =
  | 'initializing'   // Loading preview
  | 'ready'          // Preview ready, waiting for user action
  | 'executing'      // Currently executing
  | 'completed'      // Successfully completed
  | 'cancelled'      // User cancelled
  | 'error';         // Error occurred

/**
 * Widget display mode
 */
export type WidgetDisplayMode = 'inline' | 'modal';

/**
 * Rephrase tool arguments
 */
export interface RephraseArgs {
  newText: string;
  style?: 'longer' | 'shorter' | 'simpler' | 'formal' | 'casual' | 'professional';
}

/**
 * Find and replace tool arguments
 */
export interface FindReplaceArgs {
  searchPattern: string;
  replacement: string;
  options?: {
    matchCase?: boolean;
    wholeWord?: boolean;
    preserveCase?: boolean;
  };
}

/**
 * Insert text tool arguments
 */
export interface InsertTextArgs {
  position: {
    type: 'absolute' | 'relative' | 'selection';
    location?: 'start' | 'end';
    anchor?: string;
    placement?: 'before' | 'after';
  };
  content: string;
}

/**
 * Widget data sent to webview for rendering
 */
export interface WidgetData {
  id: string;
  type: 'rephrase' | 'findReplace' | 'insert';
  state: WidgetState;
  displayMode: WidgetDisplayMode;
  actionLabel: string;
  preview: WidgetPreview | null;
  args: RephraseArgs | FindReplaceArgs | InsertTextArgs;
  // Additional data for specific widgets
  originalText?: string;  // For rephrase
  matches?: Array<{ text: string; position: number }>;  // For findReplace
}

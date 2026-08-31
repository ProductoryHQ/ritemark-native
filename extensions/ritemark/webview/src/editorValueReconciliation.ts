export interface EditorValueReconciliationInput {
  initialMount: boolean;
  incomingValue: string;
  currentMarkdown: string;
  lastOnChangeValue: string;
  imageMappingsChanged: boolean;
}

/**
 * Decide whether an incoming React value must replace the current TipTap doc.
 *
 * An empty structural block is not the same thing as an absent editor value:
 * immediately after `# `, TipTap holds an empty heading while Turndown still
 * serializes it as an empty string. Replacing every empty Markdown projection
 * would therefore erase the heading input rule before the title is typed.
 */
export function shouldApplyIncomingEditorValue(input: EditorValueReconciliationInput): boolean {
  const externalValueChanged = input.incomingValue !== input.currentMarkdown
    && input.incomingValue !== input.lastOnChangeValue;
  return input.initialMount || externalValueChanged || input.imageMappingsChanged;
}

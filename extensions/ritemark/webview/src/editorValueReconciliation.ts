export interface EditorValueReconciliationInput {
  initialMount: boolean;
  incomingValue: string;
  currentMarkdown: string;
  lastOnChangeValue: string;
  imageMappingsChanged: boolean;
}

export interface EditorChangePublicationInput {
  nextMarkdown: string;
  canonicalBaseline: string;
}

/**
 * Only user-visible semantic changes may leave the editor.
 *
 * Callers are responsible for deriving both values through the same
 * serializer. This makes the decision independent of render timing and of
 * source-byte details such as a trailing newline.
 */
export function shouldPublishEditorChange(input: EditorChangePublicationInput): boolean {
  return input.nextMarkdown !== input.canonicalBaseline;
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

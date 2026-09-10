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
  const incoming = canonicalMarkdownProjection(input.incomingValue);
  const externalValueChanged = incoming !== canonicalMarkdownProjection(input.currentMarkdown)
    && incoming !== canonicalMarkdownProjection(input.lastOnChangeValue);
  return input.initialMount || externalValueChanged || input.imageMappingsChanged;
}

/**
 * The form in which this view and the host compare Markdown content: the
 * editor's own projection. Turndown never emits a leading or trailing newline
 * and always uses LF; the persisted body carries a trailing newline and, behind
 * front matter, may start with one, and follows the document's line endings.
 * None of that is content, so none of it may make a host payload look like an
 * external change. Byte-identical twin of `canonicalMarkdownProjection` in
 * `src/editorSync/state.ts`; both test files share the same vector table.
 */
export function canonicalMarkdownProjection(content: string): string {
  return content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/^\n+/, '').replace(/\n+$/, '');
}

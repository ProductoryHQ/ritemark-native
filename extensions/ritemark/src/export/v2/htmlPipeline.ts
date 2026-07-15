import type { DocumentProperties } from '../../ritemarkEditor';

export interface ExportTemplateStyle {
  bodyFont: string;
  headingFont: string;
  codeFont: string;
  bodySize: number;
  codeSize: number;
  lineGap: number;
  paragraphGap: number;
  headingColor: string;
  textColor: string;
  mutedColor: string;
  codeBackground: string;
  borderColor: string;
}

export interface NormalizedExportHtml {
  html: string;
  metadata: {
    title: string;
    author: string;
    date: string;
  };
  templateId: string;
  style: ExportTemplateStyle;
}

const TEMPLATE_STYLES: Record<string, ExportTemplateStyle> = {
  default: {
    bodyFont: 'Helvetica',
    headingFont: 'Helvetica-Bold',
    codeFont: 'Courier',
    bodySize: 11,
    codeSize: 9.5,
    lineGap: 3,
    paragraphGap: 6,
    headingColor: '#111111',
    textColor: '#222222',
    mutedColor: '#666666',
    codeBackground: '#f5f7fb',
    borderColor: '#cfd7e3',
  },
  clean: {
    bodyFont: 'Helvetica',
    headingFont: 'Helvetica-Bold',
    codeFont: 'Courier',
    bodySize: 11,
    codeSize: 9,
    lineGap: 3,
    paragraphGap: 7,
    headingColor: '#000000',
    textColor: '#1a1a1a',
    mutedColor: '#5a5a5a',
    codeBackground: '#f8f8f8',
    borderColor: '#d9d9d9',
  },
};

function stripUnsafeTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '');
}

function normalizeTableMarkup(html: string): string {
  return html
    .replace(/\sdata-colwidth="[^"]*"/g, '')
    .replace(/<colgroup[\s\S]*?<\/colgroup>/gi, '');
}

/**
 * Sprint 94 (#81): comments are editor-only and must never appear in any export.
 * Standalone `<ritemark-comment>` notes are removed whole; anchored
 * `<mark data-comment>` highlights are unwrapped so the underlying text survives
 * without the comment. Runs at the single shared PDF/Word chokepoint so neither
 * exporter can leak a note.
 *
 * NOTE (audit H2): the export input is `editor.getHTML()`, whose HTML serializer
 * escapes only `&`, `"`, and nbsp in attribute values — a literal `>` CAN appear
 * inside `data-comment`. So the tag matcher must be quote-aware: `(?:"[^"]*"|[^">])*`
 * consumes either a full double-quoted value (which may contain `>`) or any
 * non-`"`/`>` char, stopping only at the real closing `>`.
 */
function stripComments(html: string): string {
  return html
    .replace(/<ritemark-comment\b(?:"[^"]*"|[^">])*>[\s\S]*?<\/ritemark-comment>/gi, '')
    .replace(/<mark\b(?:"[^"]*"|[^">])*\bdata-comment=(?:"[^"]*"|[^">])*>([\s\S]*?)<\/mark>/gi, '$1');
}

function normalizeHtml(html: string): string {
  const source = html || '';
  const safe = normalizeTableMarkup(stripUnsafeTags(stripComments(source)));
  return safe.trim() ? safe : '<p></p>';
}

export function buildNormalizedExportHtml(
  html: string,
  properties: DocumentProperties,
  templateId = 'default'
): NormalizedExportHtml {
  const effectiveTemplate = TEMPLATE_STYLES[templateId] ? templateId : 'default';

  return {
    html: normalizeHtml(html),
    metadata: {
      title: String(properties.title || ''),
      author: String(properties.author || ''),
      date: String(properties.date || ''),
    },
    templateId: effectiveTemplate,
    style: TEMPLATE_STYLES[effectiveTemplate],
  };
}


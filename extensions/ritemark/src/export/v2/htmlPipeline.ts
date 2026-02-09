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

function normalizeHtml(html: string): string {
  const source = html || '';
  const safe = normalizeTableMarkup(stripUnsafeTags(source));
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


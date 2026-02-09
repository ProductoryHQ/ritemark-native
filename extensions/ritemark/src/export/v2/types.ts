import type { DocumentProperties } from '../../ritemarkEditor';

export interface ExportV2Request {
  html: string;
  markdownFallback: string;
  properties: DocumentProperties;
  templateId?: string;
}


import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { marked } from 'marked';
import type { DocumentProperties } from '../ritemarkEditor';

/**
 * Export markdown content to PDF
 *
 * Uses VS Code's webview + browser print-to-PDF workflow:
 * 1. Show save dialog to get destination
 * 2. Convert markdown to styled HTML
 * 3. Create hidden webview
 * 4. Use webview's print-to-PDF capability
 * 5. Save PDF file
 */
export async function exportToPDF(
  markdown: string,
  properties: DocumentProperties,
  documentUri: vscode.Uri
): Promise<void> {
  try {
    // Get default filename from document
    const docName = path.basename(documentUri.fsPath, path.extname(documentUri.fsPath));
    const defaultUri = vscode.Uri.file(
      path.join(path.dirname(documentUri.fsPath), `${docName}.pdf`)
    );

    // Show save dialog
    const saveUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: {
        'PDF Files': ['pdf']
      },
      title: 'Export as PDF'
    });

    if (!saveUri) {
      // User cancelled
      return;
    }

    // Convert markdown to HTML
    const html = await marked.parse(markdown, { breaks: true, gfm: true });

    // Create styled HTML document for PDF
    const styledHtml = createStyledHTML(html, properties);

    // For now, show a message that PDF export is coming soon
    // Full implementation requires either:
    // - Electron's printToPDF (not available in VS Code webview)
    // - Puppeteer (heavy dependency)
    // - External tool like wkhtmltopdf
    vscode.window.showInformationMessage(
      'PDF export is under development. For now, you can use File > Print to create a PDF.'
    );

    // Write HTML as fallback for testing
    const htmlUri = vscode.Uri.file(saveUri.fsPath.replace('.pdf', '.html'));
    fs.writeFileSync(htmlUri.fsPath, styledHtml, 'utf-8');

    // TODO: Implement actual PDF generation
    // Options:
    // 1. Use VS Code's built-in print functionality
    // 2. Integrate with system print-to-PDF
    // 3. Add Puppeteer dependency for headless Chrome

  } catch (error) {
    console.error('PDF export error:', error);
    vscode.window.showErrorMessage(
      `Failed to export PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Create styled HTML document for PDF export
 */
function createStyledHTML(htmlContent: string, properties: DocumentProperties): string {
  const title = (properties.title as string) || 'Document';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      margin: 2cm;
      size: A4;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }

    h1 {
      font-size: 24pt;
      font-weight: 600;
      margin: 24pt 0 12pt 0;
      page-break-after: avoid;
    }

    h2 {
      font-size: 18pt;
      font-weight: 600;
      margin: 18pt 0 9pt 0;
      page-break-after: avoid;
    }

    h3 {
      font-size: 14pt;
      font-weight: 600;
      margin: 14pt 0 7pt 0;
      page-break-after: avoid;
    }

    h4, h5, h6 {
      font-size: 12pt;
      font-weight: 600;
      margin: 12pt 0 6pt 0;
      page-break-after: avoid;
    }

    p {
      margin: 0 0 12pt 0;
      orphans: 3;
      widows: 3;
    }

    ul, ol {
      margin: 0 0 12pt 0;
      padding-left: 24pt;
    }

    li {
      margin: 4pt 0;
    }

    code {
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 10pt;
      background: #f5f5f5;
      padding: 2pt 4pt;
      border-radius: 3pt;
    }

    pre {
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 10pt;
      background: #f5f5f5;
      padding: 12pt;
      border-radius: 6pt;
      overflow-x: auto;
      margin: 12pt 0;
      page-break-inside: avoid;
    }

    pre code {
      background: none;
      padding: 0;
    }

    blockquote {
      border-left: 4pt solid #ddd;
      padding-left: 12pt;
      margin: 12pt 0;
      color: #666;
      font-style: italic;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12pt 0;
      page-break-inside: avoid;
    }

    th, td {
      border: 1pt solid #ddd;
      padding: 8pt;
      text-align: left;
    }

    th {
      background: #f5f5f5;
      font-weight: 600;
    }

    a {
      color: #0066cc;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    img {
      max-width: 100%;
      height: auto;
      page-break-inside: avoid;
    }

    /* Prevent widows and orphans */
    h1, h2, h3, h4, h5, h6 {
      page-break-after: avoid;
    }

    /* Keep tables together */
    table {
      page-break-inside: avoid;
    }

    /* Print-specific */
    @media print {
      body {
        font-size: 11pt;
      }
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

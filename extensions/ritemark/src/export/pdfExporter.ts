import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import PDFDocument from 'pdfkit';
import type { DocumentProperties } from '../ritemarkEditor';

// Font constants (Helvetica is visually identical to Arial in PDF)
const FONT_REGULAR = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const FONT_ITALIC = 'Helvetica-Oblique';
const FONT_MONO = 'Courier';

/**
 * Export markdown content to PDF using pdfkit
 *
 * Converts markdown to a clean, styled PDF document with:
 * - Title from properties or filename
 * - Author and date if available
 * - Proper heading hierarchy
 * - Paragraph text with proper spacing
 * - Lists (bullet and numbered)
 * - Code blocks
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
      return; // User cancelled
    }

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: 72,
        bottom: 72,
        left: 72,
        right: 72
      },
      info: {
        Title: (properties.title as string) || docName,
        Author: (properties.author as string) || '',
        CreationDate: new Date()
      }
    });

    // Pipe output to file
    const writeStream = fs.createWriteStream(saveUri.fsPath);
    doc.pipe(writeStream);

    // Render content
    renderMarkdownToPDF(doc, markdown, properties);

    // Finalize PDF
    doc.end();

    // Wait for file to be written
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    vscode.window.showInformationMessage(`PDF exported to ${path.basename(saveUri.fsPath)}`);

  } catch (error) {
    console.error('PDF export error:', error);
    vscode.window.showErrorMessage(
      `Failed to export PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Render markdown content to PDF document
 */
function renderMarkdownToPDF(
  doc: PDFKit.PDFDocument,
  markdown: string,
  properties: DocumentProperties
): void {
  // Font sizes
  const FONT_SIZES = {
    h1: 24,
    h2: 18,
    h3: 14,
    h4: 12,
    body: 11,
    code: 10
  };

  // Add title from properties if available
  const title = properties.title as string;
  if (title) {
    doc.fontSize(FONT_SIZES.h1)
       .font(FONT_BOLD)
       .text(title, { align: 'left' });
    doc.moveDown(0.5);
  }

  // Add author and date if available
  const author = properties.author as string;
  const date = properties.date as string;
  if (author || date) {
    doc.fontSize(FONT_SIZES.body)
       .font(FONT_REGULAR)
       .fillColor('#666666');

    if (author) {
      doc.text(`By ${author}`, { continued: !!date });
      if (date) {
        doc.text(` • ${date}`);
      }
    } else if (date) {
      doc.text(date);
    }

    doc.fillColor('#000000');
    doc.moveDown(1);
  }

  // Parse and render markdown
  const lines = markdown.split('\n');
  let inCodeBlock = false;
  let codeBlockContent = '';
  let listDepth = 0;
  let orderedListCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        renderCodeBlock(doc, codeBlockContent.trim(), FONT_SIZES.code);
        codeBlockContent = '';
        inCodeBlock = false;
      } else {
        // Start code block
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent += line + '\n';
      continue;
    }

    // Skip empty lines (but add spacing)
    if (line.trim() === '') {
      doc.moveDown(0.3);
      listDepth = 0;
      orderedListCounter = 0;
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      doc.moveDown(0.5);
      doc.fontSize(FONT_SIZES.h1)
         .font(FONT_BOLD)
         .text(cleanInlineFormatting(line.substring(2)));
      doc.moveDown(0.3);
      continue;
    }

    if (line.startsWith('## ')) {
      doc.moveDown(0.5);
      doc.fontSize(FONT_SIZES.h2)
         .font(FONT_BOLD)
         .text(cleanInlineFormatting(line.substring(3)));
      doc.moveDown(0.3);
      continue;
    }

    if (line.startsWith('### ')) {
      doc.moveDown(0.4);
      doc.fontSize(FONT_SIZES.h3)
         .font(FONT_BOLD)
         .text(cleanInlineFormatting(line.substring(4)));
      doc.moveDown(0.2);
      continue;
    }

    if (line.startsWith('#### ')) {
      doc.moveDown(0.3);
      doc.fontSize(FONT_SIZES.h4)
         .font(FONT_BOLD)
         .text(cleanInlineFormatting(line.substring(5)));
      doc.moveDown(0.2);
      continue;
    }

    // Unordered lists
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.+)/);
    if (bulletMatch) {
      const indent = bulletMatch[1].length;
      const content = bulletMatch[2];
      const bulletIndent = 20 + (indent / 2) * 15;

      doc.fontSize(FONT_SIZES.body)
         .font(FONT_REGULAR)
         .text('•', { indent: bulletIndent - 10, continued: true })
         .text(' ' + cleanInlineFormatting(content));
      continue;
    }

    // Ordered lists
    const orderedMatch = line.match(/^(\s*)\d+\.\s+(.+)/);
    if (orderedMatch) {
      const indent = orderedMatch[1].length;
      const content = orderedMatch[2];
      const listIndent = 20 + (indent / 2) * 15;
      orderedListCounter++;

      doc.fontSize(FONT_SIZES.body)
         .font(FONT_REGULAR)
         .text(`${orderedListCounter}.`, { indent: listIndent - 15, continued: true })
         .text(' ' + cleanInlineFormatting(content));
      continue;
    }

    // Task lists
    const taskMatch = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.+)/);
    if (taskMatch) {
      const checked = taskMatch[2].toLowerCase() === 'x';
      const content = taskMatch[3];
      const checkbox = checked ? '☑' : '☐';

      doc.fontSize(FONT_SIZES.body)
         .font(FONT_REGULAR)
         .text(checkbox, { indent: 20, continued: true })
         .text(' ' + cleanInlineFormatting(content));
      continue;
    }

    // Blockquotes
    if (line.startsWith('>')) {
      const quoteContent = line.replace(/^>\s*/, '');
      doc.fontSize(FONT_SIZES.body)
         .font(FONT_ITALIC)
         .fillColor('#666666')
         .text(cleanInlineFormatting(quoteContent), { indent: 20 });
      doc.fillColor('#000000');
      continue;
    }

    // Horizontal rule
    if (line.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
      doc.moveDown(0.5);
      const y = doc.y;
      doc.moveTo(72, y)
         .lineTo(doc.page.width - 72, y)
         .strokeColor('#cccccc')
         .stroke();
      doc.strokeColor('#000000');
      doc.moveDown(0.5);
      continue;
    }

    // Regular paragraph
    doc.fontSize(FONT_SIZES.body)
       .font(FONT_REGULAR)
       .text(cleanInlineFormatting(line), { align: 'left' });
  }
}

/**
 * Render a code block with background
 */
function renderCodeBlock(
  doc: PDFKit.PDFDocument,
  code: string,
  fontSize: number
): void {
  doc.moveDown(0.3);

  // Calculate height needed
  const lineHeight = fontSize * 1.4;
  const lines = code.split('\n');
  const blockHeight = lines.length * lineHeight + 20;

  // Check if we need a new page
  if (doc.y + blockHeight > doc.page.height - 72) {
    doc.addPage();
  }

  // Draw background
  const startY = doc.y;
  doc.rect(72, startY, doc.page.width - 144, blockHeight)
     .fill('#f5f5f5');

  // Draw code text
  doc.fillColor('#333333')
     .fontSize(fontSize)
     .font(FONT_MONO)
     .text(code, 82, startY + 10, {
       width: doc.page.width - 164
     });

  doc.fillColor('#000000');
  doc.y = startY + blockHeight;
  doc.moveDown(0.3);
}

/**
 * Clean inline markdown formatting (bold, italic, links, etc.)
 * Returns plain text for PDF
 */
function cleanInlineFormatting(text: string): string {
  return text
    // Remove backslash escapes (e.g., 1\. -> 1.)
    .replace(/\\([.!#\-*_\[\](){}])/g, '$1')
    // Remove bold
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    // Remove italic
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // Remove inline code
    .replace(/`(.+?)`/g, '$1')
    // Remove links, keep text
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    // Remove images
    .replace(/!\[.*?\]\(.+?\)/g, '[Image]')
    // Remove strikethrough
    .replace(/~~(.+?)~~/g, '$1');
}

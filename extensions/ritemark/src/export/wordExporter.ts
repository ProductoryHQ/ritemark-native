import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ExternalHyperlink,
} from 'docx';
import type { DocumentProperties } from '../ritemarkEditor';

/**
 * Export markdown content to Word (.docx)
 *
 * Converts markdown to docx format using the 'docx' library.
 * Supports:
 * - Headings (H1-H6)
 * - Paragraphs
 * - Bold, italic
 * - Lists (bullet, ordered)
 * - Links
 * - Code blocks (monospace)
 * - Tables
 */
export async function exportToWord(
  markdown: string,
  properties: DocumentProperties,
  documentUri: vscode.Uri
): Promise<void> {
  try {
    // Get default filename from document
    const docName = path.basename(documentUri.fsPath, path.extname(documentUri.fsPath));
    const defaultUri = vscode.Uri.file(
      path.join(path.dirname(documentUri.fsPath), `${docName}.docx`)
    );

    // Show save dialog
    const saveUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: {
        'Word Documents': ['docx']
      },
      title: 'Export as Word'
    });

    if (!saveUri) {
      // User cancelled
      return;
    }

    // Parse markdown to structured content
    const paragraphs = parseMarkdownToDocx(markdown);

    // Create docx document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs
        }
      ]
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);

    // Write to file
    fs.writeFileSync(saveUri.fsPath, buffer);

    // Show success message
    const filename = path.basename(saveUri.fsPath);
    vscode.window.showInformationMessage(`Exported to ${filename}`);

  } catch (error) {
    console.error('Word export error:', error);
    vscode.window.showErrorMessage(
      `Failed to export Word: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Parse markdown to docx paragraphs
 */
function parseMarkdownToDocx(markdown: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = markdown.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (!line.trim()) {
      paragraphs.push(new Paragraph({ text: '' }));
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const headingLevels = [
        HeadingLevel.HEADING_1,
        HeadingLevel.HEADING_2,
        HeadingLevel.HEADING_3,
        HeadingLevel.HEADING_4,
        HeadingLevel.HEADING_5,
        HeadingLevel.HEADING_6
      ];
      paragraphs.push(
        new Paragraph({
          text: text,
          heading: headingLevels[level - 1]
        })
      );
      i++;
      continue;
    }

    // Code blocks
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++; // Skip opening ```
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```

      // Add code block as monospace paragraph
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: codeLines.join('\n'),
              font: 'Courier New',
              size: 20 // 10pt
            })
          ],
          shading: {
            fill: 'F5F5F5'
          }
        })
      );
      continue;
    }

    // Bullet lists
    if (line.match(/^[-*+]\s+/)) {
      const listItems = [];
      while (i < lines.length && lines[i].match(/^[-*+]\s+/)) {
        const itemText = lines[i].replace(/^[-*+]\s+/, '');
        listItems.push(itemText);
        i++;
      }

      for (const item of listItems) {
        paragraphs.push(
          new Paragraph({
            text: item,
            bullet: {
              level: 0
            }
          })
        );
      }
      continue;
    }

    // Ordered lists
    if (line.match(/^\d+\.\s+/)) {
      const listItems = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        const itemText = lines[i].replace(/^\d+\.\s+/, '');
        listItems.push(itemText);
        i++;
      }

      for (const item of listItems) {
        paragraphs.push(
          new Paragraph({
            text: item,
            numbering: {
              reference: 'default-numbering',
              level: 0
            }
          })
        );
      }
      continue;
    }

    // Task lists (checkboxes)
    const taskMatch = line.match(/^-\s+\[([ x])\]\s+(.+)$/);
    if (taskMatch) {
      const isChecked = taskMatch[1] === 'x';
      const taskText = taskMatch[2];
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: isChecked ? '☑ ' : '☐ '
            }),
            new TextRun({
              text: taskText
            })
          ]
        })
      );
      i++;
      continue;
    }

    // Regular paragraph with inline formatting
    const runs = parseInlineFormatting(line);
    paragraphs.push(
      new Paragraph({
        children: runs
      })
    );
    i++;
  }

  return paragraphs;
}

/**
 * Parse inline formatting (bold, italic, code, links)
 */
function parseInlineFormatting(text: string): (TextRun | ExternalHyperlink)[] {
  const runs: (TextRun | ExternalHyperlink)[] = [];

  // Simple regex-based parser
  // This is a basic implementation - a full parser would use a proper markdown AST

  let remaining = text;
  const patterns = [
    // Links: [text](url)
    { regex: /\[([^\]]+)\]\(([^)]+)\)/, type: 'link' },
    // Bold: **text**
    { regex: /\*\*([^*]+)\*\*/, type: 'bold' },
    // Italic: *text*
    { regex: /\*([^*]+)\*/, type: 'italic' },
    // Code: `text`
    { regex: /`([^`]+)`/, type: 'code' },
  ];

  while (remaining.length > 0) {
    let earliestMatch: { index: number; length: number; type: string; content: string; url?: string } | null = null;

    // Find the earliest match
    for (const pattern of patterns) {
      const match = remaining.match(pattern.regex);
      if (match && (earliestMatch === null || match.index! < earliestMatch.index)) {
        earliestMatch = {
          index: match.index!,
          length: match[0].length,
          type: pattern.type,
          content: match[1],
          url: match[2]
        };
      }
    }

    if (earliestMatch) {
      // Add text before match
      if (earliestMatch.index > 0) {
        runs.push(new TextRun({ text: remaining.substring(0, earliestMatch.index) }));
      }

      // Add formatted content
      switch (earliestMatch.type) {
        case 'link':
          runs.push(
            new ExternalHyperlink({
              children: [
                new TextRun({
                  text: earliestMatch.content,
                  style: 'Hyperlink'
                })
              ],
              link: earliestMatch.url!
            })
          );
          break;
        case 'bold':
          runs.push(new TextRun({ text: earliestMatch.content, bold: true }));
          break;
        case 'italic':
          runs.push(new TextRun({ text: earliestMatch.content, italics: true }));
          break;
        case 'code':
          runs.push(
            new TextRun({
              text: earliestMatch.content,
              font: 'Courier New',
              shading: { fill: 'F5F5F5' }
            })
          );
          break;
      }

      // Move to next part
      remaining = remaining.substring(earliestMatch.index + earliestMatch.length);
    } else {
      // No more formatting - add remaining text
      runs.push(new TextRun({ text: remaining }));
      break;
    }
  }

  return runs;
}

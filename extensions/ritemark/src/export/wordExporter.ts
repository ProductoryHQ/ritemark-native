import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  ExternalHyperlink,
  NumberFormat,
  LevelFormat,
} from 'docx';
import type { DocumentProperties } from '../ritemarkEditor';

/**
 * Export markdown content to Word (.docx)
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
      return; // User cancelled
    }

    // Parse markdown to structured content
    const paragraphs = parseMarkdownToDocx(markdown, properties);

    // Create docx document with numbering definitions and default font
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: 'Arial',
              size: 24, // 12pt
            },
          },
          heading1: {
            run: {
              font: 'Arial',
              size: 48, // 24pt
              bold: true,
            },
          },
          heading2: {
            run: {
              font: 'Arial',
              size: 36, // 18pt
              bold: true,
            },
          },
          heading3: {
            run: {
              font: 'Arial',
              size: 28, // 14pt
              bold: true,
            },
          },
        },
      },
      numbering: {
        config: [
          {
            reference: 'ordered-list',
            levels: [
              {
                level: 0,
                format: LevelFormat.DECIMAL,
                text: '%1.',
                alignment: 'start' as const,
              },
            ],
          },
        ],
      },
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
function parseMarkdownToDocx(markdown: string, properties: DocumentProperties): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Add title from properties if available
  const title = properties.title as string;
  if (title) {
    paragraphs.push(
      new Paragraph({
        text: cleanText(title),
        heading: HeadingLevel.TITLE
      })
    );
  }

  // Add author and date
  const author = properties.author as string;
  const date = properties.date as string;
  if (author || date) {
    const metaText = [author, date].filter(Boolean).join(' • ');
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: metaText,
            color: '666666',
            size: 22 // 11pt
          })
        ]
      })
    );
    paragraphs.push(new Paragraph({ text: '' })); // Spacer
  }

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
      const text = cleanText(headingMatch[2]);
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
          ]
        })
      );
      continue;
    }

    // Task lists (checkboxes) - check before bullet lists
    const taskMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (taskMatch) {
      const isChecked = taskMatch[1].toLowerCase() === 'x';
      const taskText = cleanText(taskMatch[2]);
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

    // Bullet lists
    if (line.match(/^[-*+]\s+/)) {
      const itemText = cleanText(line.replace(/^[-*+]\s+/, ''));
      paragraphs.push(
        new Paragraph({
          text: '• ' + itemText
        })
      );
      i++;
      continue;
    }

    // Ordered lists
    if (line.match(/^\d+\.\s+/)) {
      const itemText = cleanText(line.replace(/^\d+\.\s+/, ''));
      paragraphs.push(
        new Paragraph({
          text: itemText,
          numbering: {
            reference: 'ordered-list',
            level: 0
          }
        })
      );
      i++;
      continue;
    }

    // Blockquotes
    if (line.startsWith('>')) {
      const quoteText = cleanText(line.replace(/^>\s*/, ''));
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: quoteText,
              italics: true,
              color: '666666'
            })
          ],
          indent: {
            left: 720 // 0.5 inch
          }
        })
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (line.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '────────────────────────────────────────',
              color: 'CCCCCC'
            })
          ]
        })
      );
      i++;
      continue;
    }

    // Regular paragraph with inline formatting
    const runs = parseInlineFormatting(cleanText(line));
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
 * Clean text: remove backslash escapes
 */
function cleanText(text: string): string {
  return text.replace(/\\([.!#\-*_\[\](){}])/g, '$1');
}

/**
 * Parse inline formatting (bold, italic, code, links)
 */
function parseInlineFormatting(text: string): (TextRun | ExternalHyperlink)[] {
  const runs: (TextRun | ExternalHyperlink)[] = [];

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
                  color: '0066CC',
                  underline: {}
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
              font: 'Courier New' // Keep monospace for code
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

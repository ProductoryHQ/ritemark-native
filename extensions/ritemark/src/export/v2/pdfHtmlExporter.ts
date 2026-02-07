import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import PDFDocument from 'pdfkit';
import { parse, HTMLElement, type Node as HtmlNode, TextNode } from 'node-html-parser';
import { buildNormalizedExportHtml, type ExportTemplateStyle } from './htmlPipeline';
import type { ExportV2Request } from './types';

const PAGE_MARGIN = 72;
const HEADER_Y = 30;
const FOOTER_Y_OFFSET = 36;
const RESERVED_FOOTER_SPACE = 24;

function isElement(node: HtmlNode): node is HTMLElement {
  return node instanceof HTMLElement;
}

function getNodeText(node: HtmlNode): string {
  if (node instanceof TextNode) {
    return node.rawText || '';
  }

  if (!isElement(node)) {
    return '';
  }

  if (node.tagName === 'BR') {
    return '\n';
  }

  return node.childNodes.map(getNodeText).join('');
}

function compactText(text: string): string {
  return text.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\s+\n/g, '\n').trim();
}

function getImmediateChildren(node: HTMLElement, tagNames: string[]): HTMLElement[] {
  const wanted = new Set(tagNames.map(tag => tag.toUpperCase()));
  return node.childNodes.filter(child => isElement(child) && wanted.has(child.tagName)) as HTMLElement[];
}

function tryLoadImage(imagePath: string, documentUri: vscode.Uri): Buffer | null {
  try {
    let normalizedPath = imagePath.trim();
    if (normalizedPath.startsWith('vscode-file://')) normalizedPath = normalizedPath.replace('vscode-file://', '');
    if (normalizedPath.startsWith('file://')) normalizedPath = normalizedPath.replace('file://', '');
    if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) return null;

    const absolutePath = path.isAbsolute(normalizedPath)
      ? normalizedPath
      : path.resolve(path.dirname(documentUri.fsPath), normalizedPath);

    if (!fs.existsSync(absolutePath)) {
      return null;
    }
    return fs.readFileSync(absolutePath);
  } catch {
    return null;
  }
}

function ensurePageRoom(doc: PDFKit.PDFDocument, minimumHeight: number): void {
  const bottomLimit = doc.page.height - PAGE_MARGIN - RESERVED_FOOTER_SPACE;
  if (doc.y + minimumHeight > bottomLimit) {
    doc.addPage();
  }
}

function renderHighlightedCodeLine(
  doc: PDFKit.PDFDocument,
  line: string,
  style: ExportTemplateStyle
): void {
  const tokenRegex = /(\b(?:const|let|var|function|return|if|else|for|while|class|import|from|export|async|await|try|catch|new|public|private|protected|interface|type)\b|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\/.*$)/g;
  const parts = line.split(tokenRegex).filter(Boolean);

  parts.forEach((token, index) => {
    let color = style.textColor;
    if (/^\b(?:const|let|var|function|return|if|else|for|while|class|import|from|export|async|await|try|catch|new|public|private|protected|interface|type)\b$/.test(token)) {
      color = '#0b57d0';
    } else if (/^\/\/.*$/.test(token)) {
      color = '#4d8b31';
    } else if (/^"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`$/.test(token)) {
      color = '#9b2c2c';
    }

    doc.fillColor(color).text(token, { continued: index < parts.length - 1, lineGap: 0 });
  });
}

function renderCodeBlock(doc: PDFKit.PDFDocument, code: string, style: ExportTemplateStyle): void {
  const lines = code.split('\n');
  const width = doc.page.width - PAGE_MARGIN * 2;
  const lineHeight = style.codeSize * 1.5;
  const blockHeight = Math.max(1, lines.length) * lineHeight + 14;

  ensurePageRoom(doc, blockHeight + 8);
  const startY = doc.y;

  doc.rect(PAGE_MARGIN, startY, width, blockHeight).fill(style.codeBackground);
  doc.fillColor(style.textColor).font(style.codeFont).fontSize(style.codeSize);

  let y = startY + 8;
  lines.forEach(line => {
    doc.x = PAGE_MARGIN + 8;
    doc.y = y;
    renderHighlightedCodeLine(doc, line, style);
    doc.text(''); // terminate continued chain
    y += lineHeight;
  });

  doc.font(style.bodyFont).fontSize(style.bodySize).fillColor(style.textColor);
  doc.y = startY + blockHeight + 6;
}

function renderTable(doc: PDFKit.PDFDocument, table: HTMLElement, style: ExportTemplateStyle): void {
  const rows = table.querySelectorAll('tr');
  if (rows.length === 0) return;

  const rowCells = rows.map(row => getImmediateChildren(row, ['th', 'td']));
  const columnCount = Math.max(...rowCells.map(cells => cells.length), 1);
  const usableWidth = doc.page.width - PAGE_MARGIN * 2;
  const colWidth = usableWidth / columnCount;

  rowCells.forEach((cells, rowIndex) => {
    const cellTexts = Array.from({ length: columnCount }, (_, cellIndex) =>
      compactText(cells[cellIndex] ? getNodeText(cells[cellIndex]) : '')
    );

    const heights = cellTexts.map(text =>
      Math.max(
        style.bodySize * 1.6,
        doc.heightOfString(text || ' ', {
          width: colWidth - 10,
          lineGap: 1,
        }) + 8
      )
    );
    const rowHeight = Math.max(...heights);

    ensurePageRoom(doc, rowHeight + 2);
    const y = doc.y;

    for (let col = 0; col < columnCount; col++) {
      const x = PAGE_MARGIN + col * colWidth;
      const text = cellTexts[col];

      if (rowIndex === 0) {
        doc.rect(x, y, colWidth, rowHeight).fill('#eef3fb');
      }
      doc.rect(x, y, colWidth, rowHeight).lineWidth(0.5).strokeColor(style.borderColor).stroke();

      doc.font(rowIndex === 0 ? style.headingFont : style.bodyFont)
        .fontSize(style.bodySize)
        .fillColor(style.textColor)
        .text(text || ' ', x + 5, y + 4, {
          width: colWidth - 10,
          lineGap: 1,
        });
    }

    doc.y = y + rowHeight;
  });

  doc.moveDown(0.4);
}

function renderList(doc: PDFKit.PDFDocument, listNode: HTMLElement, ordered: boolean, depth: number, style: ExportTemplateStyle): void {
  const items = getImmediateChildren(listNode, ['li']);
  items.forEach((item, index) => {
    const prefix = ordered ? `${index + 1}. ` : '• ';
    const indent = 16 + depth * 14;
    const text = compactText(getNodeText(item));
    ensurePageRoom(doc, style.bodySize * 1.8);
    doc.font(style.bodyFont)
      .fontSize(style.bodySize)
      .fillColor(style.textColor)
      .text(prefix + text, PAGE_MARGIN + indent, doc.y, {
        width: doc.page.width - PAGE_MARGIN * 2 - indent,
        lineGap: style.lineGap,
      });

    const nestedUl = getImmediateChildren(item, ['ul'])[0];
    const nestedOl = getImmediateChildren(item, ['ol'])[0];
    if (nestedUl) renderList(doc, nestedUl, false, depth + 1, style);
    if (nestedOl) renderList(doc, nestedOl, true, depth + 1, style);
  });
  doc.moveDown(0.25);
}

function renderNode(doc: PDFKit.PDFDocument, node: HtmlNode, documentUri: vscode.Uri, style: ExportTemplateStyle): void {
  if (!isElement(node)) return;

  const tag = node.tagName;
  const text = compactText(getNodeText(node));

  if (!text && tag !== 'HR' && tag !== 'IMG' && tag !== 'TABLE') return;

  switch (tag) {
    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6': {
      const sizes: Record<string, number> = { H1: 24, H2: 20, H3: 16, H4: 14, H5: 12, H6: 11 };
      ensurePageRoom(doc, sizes[tag] * 1.7);
      doc.moveDown(0.3);
      doc.font(style.headingFont).fontSize(sizes[tag]).fillColor(style.headingColor).text(text, {
        lineGap: style.lineGap,
      });
      doc.moveDown(0.2);
      return;
    }

    case 'P':
      ensurePageRoom(doc, style.bodySize * 1.8);
      doc.font(style.bodyFont).fontSize(style.bodySize).fillColor(style.textColor).text(text, {
        lineGap: style.lineGap,
      });
      doc.moveDown(0.2);
      return;

    case 'BLOCKQUOTE':
      ensurePageRoom(doc, style.bodySize * 2);
      doc.fillColor(style.mutedColor).font(style.bodyFont).fontSize(style.bodySize).text(text, PAGE_MARGIN + 16, doc.y, {
        width: doc.page.width - PAGE_MARGIN * 2 - 16,
        lineGap: style.lineGap,
      });
      doc.fillColor(style.textColor);
      doc.moveDown(0.25);
      return;

    case 'PRE':
      renderCodeBlock(doc, node.textContent || '', style);
      return;

    case 'CODE':
      renderCodeBlock(doc, node.textContent || '', style);
      return;

    case 'UL':
      renderList(doc, node, false, 0, style);
      return;

    case 'OL':
      renderList(doc, node, true, 0, style);
      return;

    case 'TABLE':
      renderTable(doc, node, style);
      return;

    case 'HR': {
      ensurePageRoom(doc, 12);
      const y = doc.y + 3;
      doc.moveTo(PAGE_MARGIN, y).lineTo(doc.page.width - PAGE_MARGIN, y).lineWidth(1).strokeColor(style.borderColor).stroke();
      doc.moveDown(0.5);
      return;
    }

    case 'IMG': {
      const src = node.getAttribute('src');
      if (!src) return;
      const img = tryLoadImage(src, documentUri);
      if (!img) return;

      ensurePageRoom(doc, 180);
      const maxWidth = doc.page.width - PAGE_MARGIN * 2;
      doc.image(img, PAGE_MARGIN, doc.y, { fit: [maxWidth, 320], align: 'center' });
      doc.moveDown(0.5);
      return;
    }
  }

  node.childNodes.forEach(child => renderNode(doc, child, documentUri, style));
}

function applyHeaderFooter(
  doc: PDFKit.PDFDocument,
  title: string,
  style: ExportTemplateStyle
): void {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    const pageNo = i + 1;
    const totalPages = range.count;

    doc.font(style.bodyFont).fontSize(9).fillColor(style.mutedColor)
      .text(title, PAGE_MARGIN, HEADER_Y, {
        width: doc.page.width - PAGE_MARGIN * 2 - 100,
        align: 'left',
      })
      .text(`${pageNo} / ${totalPages}`, PAGE_MARGIN, doc.page.height - FOOTER_Y_OFFSET, {
        width: doc.page.width - PAGE_MARGIN * 2,
        align: 'right',
      });
  }
}

export async function exportToPDFV2(
  request: ExportV2Request,
  documentUri: vscode.Uri
): Promise<void> {
  try {
    const normalized = buildNormalizedExportHtml(request.html, request.properties, request.templateId);
    const docName = path.basename(documentUri.fsPath, path.extname(documentUri.fsPath));
    const defaultUri = vscode.Uri.file(path.join(path.dirname(documentUri.fsPath), `${docName}.pdf`));

    const saveUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: { 'PDF Files': ['pdf'] },
      title: 'Export as PDF',
    });
    if (!saveUri) return;

    const pdf = new PDFDocument({
      size: 'A4',
      margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
      bufferPages: true,
      info: {
        Title: normalized.metadata.title || docName,
        Author: normalized.metadata.author || '',
        CreationDate: new Date(),
      },
    });

    const out = fs.createWriteStream(saveUri.fsPath);
    pdf.pipe(out);

    const root = parse(normalized.html);
    const nodes = root.querySelector('body')?.childNodes ?? root.childNodes;

    if (normalized.metadata.title) {
      pdf.font(normalized.style.headingFont).fontSize(26).fillColor(normalized.style.headingColor).text(normalized.metadata.title);
      pdf.moveDown(0.4);
    }
    if (normalized.metadata.author || normalized.metadata.date) {
      const line = [normalized.metadata.author, normalized.metadata.date].filter(Boolean).join(' • ');
      pdf.font(normalized.style.bodyFont).fontSize(10).fillColor(normalized.style.mutedColor).text(line);
      pdf.moveDown(0.5);
    }

    nodes.forEach(node => renderNode(pdf, node, documentUri, normalized.style));
    applyHeaderFooter(pdf, normalized.metadata.title || docName, normalized.style);
    pdf.end();

    await new Promise<void>((resolve, reject) => {
      out.on('finish', resolve);
      out.on('error', reject);
    });

    vscode.window.showInformationMessage(`PDF exported to ${path.basename(saveUri.fsPath)}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to export PDF (V2): ${msg}`);
  }
}

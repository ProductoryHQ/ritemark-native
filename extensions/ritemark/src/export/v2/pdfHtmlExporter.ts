import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import PDFDocument from 'pdfkit';
import { parse, HTMLElement, type Node as HtmlNode, TextNode } from 'node-html-parser';
import { buildNormalizedExportHtml, type ExportTemplateStyle } from './htmlPipeline';
import { tryLoadImageSource } from './imageSource';
import type { ExportV2Request } from './types';

const PAGE_MARGIN = 72;
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
  doc.x = PAGE_MARGIN;
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

  doc.x = PAGE_MARGIN;
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
  doc.x = PAGE_MARGIN;
  doc.moveDown(0.25);
}

function renderNode(doc: PDFKit.PDFDocument, node: HtmlNode, documentUri: vscode.Uri, style: ExportTemplateStyle): void {
  if (!isElement(node)) return;

  // Always reset x to left margin before rendering any element
  doc.x = PAGE_MARGIN;

  const tag = node.tagName;
  const text = compactText(getNodeText(node));

  if (!text && tag !== 'HR' && tag !== 'IMG' && tag !== 'TABLE' && tag !== 'FIGURE') return;

  switch (tag) {
    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6': {
      const sizes: Record<string, number> = { H1: 24, H2: 20, H3: 16, H4: 14, H5: 12, H6: 11 };
      const spaceBefore: Record<string, number> = { H1: 0.7, H2: 0.6, H3: 0.5, H4: 0.4, H5: 0.35, H6: 0.3 };
      const spaceAfter: Record<string, number> = { H1: 0.3, H2: 0.25, H3: 0.2, H4: 0.15, H5: 0.15, H6: 0.1 };
      // Ensure heading + at least one line of following content stays together
      ensurePageRoom(doc, sizes[tag] * 2.5 + style.bodySize * 2);
      doc.moveDown(spaceBefore[tag]);
      doc.font(style.headingFont).fontSize(sizes[tag]).fillColor(style.headingColor).text(text, {
        lineGap: style.lineGap,
      });
      doc.moveDown(spaceAfter[tag]);
      return;
    }

    case 'P':
      ensurePageRoom(doc, style.bodySize * 2.5);
      doc.font(style.bodyFont).fontSize(style.bodySize).fillColor(style.textColor).text(text, {
        lineGap: style.lineGap,
      });
      doc.moveDown(0.3);
      return;

    case 'BLOCKQUOTE': {
      ensurePageRoom(doc, style.bodySize * 2.5);
      const bqStartY = doc.y;
      doc.font(style.bodyFont).fontSize(style.bodySize).fillColor(style.mutedColor);
      doc.text(text, PAGE_MARGIN + 18, doc.y, {
        width: doc.page.width - PAGE_MARGIN * 2 - 18,
        lineGap: style.lineGap,
      });
      const bqEndY = doc.y;
      // Draw left border line
      doc.moveTo(PAGE_MARGIN + 6, bqStartY)
        .lineTo(PAGE_MARGIN + 6, bqEndY)
        .lineWidth(2.5)
        .strokeColor(style.borderColor)
        .stroke();
      doc.fillColor(style.textColor);
      doc.x = PAGE_MARGIN;
      doc.moveDown(0.3);
      return;
    }

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
      ensurePageRoom(doc, 20);
      doc.moveDown(0.3);
      const hrY = doc.y;
      doc.moveTo(PAGE_MARGIN, hrY).lineTo(doc.page.width - PAGE_MARGIN, hrY).lineWidth(0.5).strokeColor(style.borderColor).stroke();
      doc.moveDown(0.5);
      return;
    }

    case 'IMG': {
      // TipTap stores original relative path in title, webview URI in src
      const title = node.getAttribute('title');
      const src = node.getAttribute('src');
      const imagePath = title || src;
      if (!imagePath) return;
      const imgBuffer = tryLoadImageSource(imagePath, documentUri);
      if (!imgBuffer) return;

      const usableWidth = doc.page.width - PAGE_MARGIN * 2;
      const usableHeight = doc.page.height - PAGE_MARGIN * 2 - RESERVED_FOOTER_SPACE;
      // Cap images to ~50% of page height so they don't dominate the layout.
      // Wide/landscape images get full width; tall/portrait images get constrained.
      const maxHeight = Math.min(usableHeight * 0.55, 400);
      // Get actual image dimensions for proper scaling
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfImage = (doc as any).openImage(imgBuffer);
      const scale = Math.min(usableWidth / pdfImage.width, maxHeight / pdfImage.height, 1);
      const renderWidth = pdfImage.width * scale;
      const renderHeight = pdfImage.height * scale;

      ensurePageRoom(doc, renderHeight + 8);
      doc.image(pdfImage, PAGE_MARGIN, doc.y, { width: renderWidth, height: renderHeight });
      doc.y += renderHeight + 6;
      return;
    }
  }

  node.childNodes.forEach(child => renderNode(doc, child, documentUri, style));
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

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  HeadingLevel,
  ExternalHyperlink,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  type ISectionOptions,
} from 'docx';
import { parse, HTMLElement, type Node as HtmlNode, TextNode } from 'node-html-parser';
import { buildNormalizedExportHtml, type ExportTemplateStyle } from './htmlPipeline';
import type { ExportV2Request } from './types';

type DocChild = Paragraph | Table;

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

function getImageDimensions(data: Buffer): { width: number; height: number } | null {
  try {
    // PNG: signature 0x89504E47, dimensions in IHDR chunk
    if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
      return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
    }
    // JPEG: scan for SOF0 (0xFFC0) or SOF2 (0xFFC2) marker
    if (data[0] === 0xFF && data[1] === 0xD8) {
      let offset = 2;
      while (offset < data.length - 9) {
        if (data[offset] !== 0xFF) break;
        const marker = data[offset + 1];
        if (marker === 0xC0 || marker === 0xC2) {
          return { width: data.readUInt16BE(offset + 7), height: data.readUInt16BE(offset + 5) };
        }
        offset += 2 + data.readUInt16BE(offset + 2);
      }
    }
  } catch { /* ignore parse errors */ }
  return null;
}

interface InlineStyleState {
  bold?: boolean;
  italics?: boolean;
  code?: boolean;
}

function isElement(node: HtmlNode): node is HTMLElement {
  return node instanceof HTMLElement;
}

function compactText(text: string): string {
  return text.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ');
}

function getImmediateChildren(node: HTMLElement, tagNames: string[]): HTMLElement[] {
  const wanted = new Set(tagNames.map(tag => tag.toUpperCase()));
  return node.childNodes.filter(child => isElement(child) && wanted.has(child.tagName)) as HTMLElement[];
}

function mergeInlineState(base: InlineStyleState, patch: InlineStyleState): InlineStyleState {
  return { ...base, ...patch };
}

function collectInlineRuns(
  node: HtmlNode,
  style: ExportTemplateStyle,
  state: InlineStyleState = {}
): (TextRun | ExternalHyperlink)[] {
  if (node instanceof TextNode) {
    const text = compactText(node.rawText || '');
    if (!text) return [];
    return [
      new TextRun({
        text,
        bold: !!state.bold,
        italics: !!state.italics,
        font: state.code ? style.codeFont : style.bodyFont,
      }),
    ];
  }

  if (!isElement(node)) return [];

  const tag = node.tagName;
  if (tag === 'BR') return [new TextRun({ break: 1 })];

  if (tag === 'A') {
    const href = node.getAttribute('href') || '';
    const children = node.childNodes.flatMap(child =>
      collectInlineRuns(child, style, mergeInlineState(state, { bold: false }))
    );
    if (!href) return children;
    return [
      new ExternalHyperlink({
        children: children.length > 0 ? children : [new TextRun({ text: href })],
        link: href,
      }),
    ];
  }

  const nextState = (() => {
    switch (tag) {
      case 'STRONG':
      case 'B':
        return mergeInlineState(state, { bold: true });
      case 'EM':
      case 'I':
        return mergeInlineState(state, { italics: true });
      case 'CODE':
        return mergeInlineState(state, { code: true });
      default:
        return state;
    }
  })();

  return node.childNodes.flatMap(child => collectInlineRuns(child, style, nextState));
}

function paragraphFromNode(node: HTMLElement, style: ExportTemplateStyle): Paragraph {
  const runs = node.childNodes.flatMap(child => collectInlineRuns(child, style));
  return new Paragraph({
    children: runs.length > 0 ? runs : [new TextRun({ text: '' })],
    spacing: { after: 120 },
  });
}

function parseList(node: HTMLElement, style: ExportTemplateStyle, ordered: boolean, depth: number): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const items = getImmediateChildren(node, ['li']);
  items.forEach((item, index) => {
    const prefix = ordered ? `${index + 1}. ` : '• ';
    const inlineChildren = item.childNodes
      .filter(child => !(isElement(child) && (child.tagName === 'UL' || child.tagName === 'OL')))
      .flatMap(child => collectInlineRuns(child, style));

    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: prefix }), ...(inlineChildren.length ? inlineChildren : [new TextRun({ text: '' })])],
      indent: { left: depth * 360 },
      spacing: { after: 90 },
    }));

    const nestedUl = getImmediateChildren(item, ['ul'])[0];
    const nestedOl = getImmediateChildren(item, ['ol'])[0];
    if (nestedUl) paragraphs.push(...parseList(nestedUl, style, false, depth + 1));
    if (nestedOl) paragraphs.push(...parseList(nestedOl, style, true, depth + 1));
  });
  return paragraphs;
}

function parseTable(node: HTMLElement, style: ExportTemplateStyle): Table | null {
  const trNodes = node.querySelectorAll('tr');
  if (trNodes.length === 0) return null;

  const rows = trNodes.map((tr, rowIndex) => {
    const cells = getImmediateChildren(tr, ['th', 'td']);
    return new TableRow({
      children: cells.map(cell => new TableCell({
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: style.borderColor.replace('#', '') },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: style.borderColor.replace('#', '') },
          left: { style: BorderStyle.SINGLE, size: 1, color: style.borderColor.replace('#', '') },
          right: { style: BorderStyle.SINGLE, size: 1, color: style.borderColor.replace('#', '') },
        },
        children: [
          new Paragraph({
            children: rowIndex === 0
              ? [new TextRun({ text: compactText(cell.textContent || ''), bold: true, font: style.bodyFont })]
              : collectInlineRuns(cell, style),
          }),
        ],
      })),
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
}

function parseBlocks(node: HtmlNode, style: ExportTemplateStyle, documentUri: vscode.Uri): DocChild[] {
  if (!isElement(node)) return [];
  const tag = node.tagName;

  switch (tag) {
    case 'P':
      return [paragraphFromNode(node, style)];
    case 'H1':
      return [new Paragraph({ children: collectInlineRuns(node, style), heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 160 }, keepNext: true })];
    case 'H2':
      return [new Paragraph({ children: collectInlineRuns(node, style), heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 140 }, keepNext: true })];
    case 'H3':
      return [new Paragraph({ children: collectInlineRuns(node, style), heading: HeadingLevel.HEADING_3, spacing: { before: 240, after: 120 }, keepNext: true })];
    case 'H4':
      return [new Paragraph({ children: collectInlineRuns(node, style), heading: HeadingLevel.HEADING_4, spacing: { before: 200, after: 100 }, keepNext: true })];
    case 'H5':
      return [new Paragraph({ children: collectInlineRuns(node, style), heading: HeadingLevel.HEADING_5, spacing: { before: 160, after: 80 }, keepNext: true })];
    case 'H6':
      return [new Paragraph({ children: collectInlineRuns(node, style), heading: HeadingLevel.HEADING_6, spacing: { before: 160, after: 80 }, keepNext: true })];
    case 'BLOCKQUOTE':
      return [new Paragraph({
        children: collectInlineRuns(node, style, { italics: true }),
        indent: { left: 480 },
        spacing: { after: 120 },
        border: { left: { style: BorderStyle.SINGLE, size: 6, color: style.borderColor.replace('#', '') } },
      })];
    case 'PRE':
      return [new Paragraph({
        children: [new TextRun({ text: node.textContent || '', font: style.codeFont })],
        spacing: { after: 120 },
      })];
    case 'UL':
      return parseList(node, style, false, 0);
    case 'OL':
      return parseList(node, style, true, 0);
    case 'TABLE': {
      const table = parseTable(node, style);
      return table ? [table, new Paragraph({ text: '' })] : [];
    }
    case 'HR':
      return [new Paragraph({
        children: [new TextRun({ text: '' })],
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: style.borderColor.replace('#', '') } },
        spacing: { before: 120, after: 120 },
      })];
    case 'IMG': {
      // TipTap stores original relative path in title, webview URI in src
      const title = node.getAttribute('title');
      const src = node.getAttribute('src');
      const imagePath = title || src;
      if (!imagePath) return [];
      const imgData = tryLoadImage(imagePath, documentUri);
      if (!imgData) return [];

      const dims = getImageDimensions(imgData);
      const maxWidth = 580; // ~6 inches at 96 DPI
      let imgWidth = dims?.width || 580;
      let imgHeight = dims?.height || 400;
      if (imgWidth > maxWidth) {
        const scale = maxWidth / imgWidth;
        imgHeight = Math.round(imgHeight * scale);
        imgWidth = maxWidth;
      }

      return [new Paragraph({
        children: [new ImageRun({
          data: imgData,
          transformation: { width: imgWidth, height: imgHeight },
        })],
        spacing: { after: 120 },
      })];
    }
    default:
      return node.childNodes.flatMap(child => parseBlocks(child, style, documentUri));
  }
}

function buildSection(children: DocChild[]): ISectionOptions {
  return {
    properties: {},
    children,
  };
}

export async function exportToWordV2(
  request: ExportV2Request,
  documentUri: vscode.Uri
): Promise<void> {
  try {
    const normalized = buildNormalizedExportHtml(request.html, request.properties, request.templateId);
    const docName = path.basename(documentUri.fsPath, path.extname(documentUri.fsPath));
    const defaultUri = vscode.Uri.file(path.join(path.dirname(documentUri.fsPath), `${docName}.docx`));

    const saveUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: { 'Word Documents': ['docx'] },
      title: 'Export as Word',
    });
    if (!saveUri) return;

    const root = parse(normalized.html);
    const nodes = root.querySelector('body')?.childNodes ?? root.childNodes;
    const children: DocChild[] = [];

    if (normalized.metadata.title) {
      children.push(new Paragraph({ text: normalized.metadata.title, heading: HeadingLevel.TITLE }));
    }
    if (normalized.metadata.author || normalized.metadata.date) {
      children.push(new Paragraph({
        children: [new TextRun({ text: [normalized.metadata.author, normalized.metadata.date].filter(Boolean).join(' • ') })],
        spacing: { after: 180 },
      }));
    }

    nodes.forEach(node => {
      children.push(...parseBlocks(node, normalized.style, documentUri));
    });

    const doc = new Document({
      creator: normalized.metadata.author || 'Ritemark',
      title: normalized.metadata.title || docName,
      sections: [buildSection(children)],
      styles: {
        default: {
          document: {
            run: {
              font: normalized.style.bodyFont,
              size: normalized.style.bodySize * 2,
            },
          },
        },
      },
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(saveUri.fsPath, buffer);
    vscode.window.showInformationMessage(`Word exported to ${path.basename(saveUri.fsPath)}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to export Word (V2): ${msg}`);
  }
}

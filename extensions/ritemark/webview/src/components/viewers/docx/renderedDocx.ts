/**
 * Sprint 124 (#284) — working with the document docx-preview has drawn.
 * DOM helpers: page elements, page numbers, text for search.
 */
import { NUMPAGES_FIELD_MARK, PAGE_FIELD_MARK } from './docxXml';
import type { TextChunk } from '../documentSearch';

/** The rendered pages, in order. */
export function renderedPages(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('.docx-wrapper > section.docx'));
}

/** Defect 3: write each page's own number, and the page count, over the field marks. */
export function fillPageNumbers(root: ParentNode): number {
  const pages = renderedPages(root);
  const total = String(pages.length);
  pages.forEach((page, index) => {
    const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.nodeValue ?? '';
      if (text.includes('')) {
        node.nodeValue = text.split(PAGE_FIELD_MARK).join(String(index + 1)).split(NUMPAGES_FIELD_MARK).join(total);
      }
    }
  });
  return pages.length;
}

const BLOCK = 'p, td, th, li, h1, h2, h3, h4, h5, h6, header, footer, article, section';

/** The document's text nodes and their text, marking where a new paragraph or cell begins. */
export function textChunks(root: ParentNode): { nodes: Text[]; chunks: TextChunk[] } {
  const nodes: Text[] = [];
  const chunks: TextChunk[] = [];
  let previousBlock: Element | null = null;
  for (const page of renderedPages(root)) {
    const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (node.parentElement?.closest('style, script') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const block = node.parentElement?.closest(BLOCK) ?? null;
      nodes.push(node as Text);
      chunks.push({ text: node.nodeValue ?? '', newBlock: block !== previousBlock });
      previousBlock = block;
    }
  }
  return { nodes, chunks };
}

function isListParagraph(paragraph: string): boolean {
  return paragraph
    .split('\n')
    .some((line) => /^(\s*[-*+]\s+|\s*\d+\.\s+)/.test(line.trimStart()));
}

function isHeadingParagraph(paragraph: string): boolean {
  return /^#{1,6}\s+/.test(paragraph.trimStart());
}

export function extractPlanDisplayText(planText: string): string {
  const normalized = planText.trim();
  if (!normalized) {
    return '';
  }

  const paragraphs = normalized.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    if (isListParagraph(paragraphs[i]) || isHeadingParagraph(paragraphs[i])) {
      return paragraphs.slice(i).join('\n\n');
    }
  }

  if (paragraphs.length > 2) {
    return paragraphs.slice(-2).join('\n\n');
  }

  return normalized;
}

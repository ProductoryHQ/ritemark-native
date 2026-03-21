import { renderMermaid, renderMermaidToPngDataUrl } from './mermaid'

const MERMAID_BLOCK_REGEX = /<pre\b[^>]*>\s*<code\b([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi

function htmlToText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(span|div|p|code|pre)[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function isMermaidCodeTagAttributes(attributes: string): boolean {
  return /\blanguage-mermaid\b/i.test(attributes)
}

export async function inlineMermaidDiagramsForExport(
  html: string,
  renderDiagramToDataUrl: (source: string) => Promise<string> = async (source) => {
    const id = `export-mermaid-${Math.random().toString(36).slice(2)}`
    const svg = await renderMermaid(id, source)
    return renderMermaidToPngDataUrl(svg)
  }
): Promise<string> {
  const source = html || ''
  const matches = Array.from(source.matchAll(MERMAID_BLOCK_REGEX))

  if (matches.length === 0) {
    return source
  }

  let output = source

  for (const match of matches) {
    const [fullMatch, codeAttrs = '', codeHtml = ''] = match
    if (!isMermaidCodeTagAttributes(codeAttrs)) {
      continue
    }

    const mermaidSource = htmlToText(codeHtml).trim()
    if (!mermaidSource) {
      continue
    }

    try {
      const dataUrl = await renderDiagramToDataUrl(mermaidSource)
      output = output.replace(
        fullMatch,
        `<figure class="mermaid-export-block"><img src="${dataUrl}" alt="Mermaid diagram" /></figure>`
      )
    } catch (error) {
      console.error('Failed to inline mermaid export diagram:', error)
    }
  }

  return output
}

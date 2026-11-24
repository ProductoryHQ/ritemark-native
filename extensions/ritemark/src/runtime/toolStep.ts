import { documentReadWarnings, type DocumentReadReason } from '../documents/documentRead';

/** Display data shared by the runtime progress events and the sidebar. */
export interface ToolStep {
  id: string;
  kind: 'read' | 'folder' | 'shell';
  path?: string;
  command?: string;
  listing?: string[];
  status?: 'completed' | 'failed';
  warning?: string;
  units?: string;
}

export const isDocumentReadTool = (name?: string): boolean =>
  /^(?:read_document|mcp__ritemark_documents__read_document|ritemark_documents(?:__|[_./])read_document)$/.test(name ?? '');

export function documentStepKind(path: string) {
  const extension = path.match(/\.[^.\\/]+$/)?.[0].toLowerCase();
  if (extension === '.docx' || extension === '.doc') return 'word';
  if (extension === '.pdf') return 'pdf';
  if (extension === '.pptx' || extension === '.ppt') return 'powerpoint';
}

/** Tool transports expose strings or text blocks. Never forward the document body to the sidebar. */
function toolOutputText(output: unknown): string {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return output.map(toolOutputText).filter(Boolean).join('\n');
  if (!output || typeof output !== 'object') return '';
  const block = output as { text?: unknown; content?: unknown; output?: unknown; type?: string };
  if (block.type && block.type !== 'text' && block.type !== 'content') return '';
  return typeof block.text === 'string' ? block.text : toolOutputText(block.content ?? block.output);
}

export function documentReadReasonOf(output: unknown): DocumentReadReason | undefined {
  if (!output || typeof output !== 'object') return;
  const reason = (output as { _meta?: { documentReadReason?: unknown } })._meta?.documentReadReason;
  if (typeof reason === 'string' && Object.prototype.hasOwnProperty.call(documentReadWarnings, reason)) return reason as DocumentReadReason;
}

export function toolStepResult(step: ToolStep, output: unknown, failed: boolean, documentTool = false, reason?: DocumentReadReason): ToolStep {
  const status = failed ? 'failed' : 'completed';
  if (step.kind === 'shell' || (step.kind === 'read' && !documentTool && failed)) return { ...step, status };
  if (step.kind === 'read' && reason) return { ...step, status: 'failed', warning: documentReadWarnings[reason] };
  const text = toolOutputText(output);
  const directory = step.kind === 'read' && !documentTool && text.includes('<type>directory</type>');
  if ((step.kind === 'folder' || directory) && !failed) {
    // Glob returns one file per line. OpenCode's Read directory lists entries
    // inside an <entries> block. Ignore status lines and non-document entries.
    const entries = text.match(/<entries>\s*([\s\S]*?)\s*<\/entries>/)?.[1] ?? text;
    const listing = entries.split(/\r?\n/).map((line) => line.trim()).filter((line) =>
      line && !line.startsWith('<') && documentStepKind(line) && !/[*?]/.test(line));
    const paths = listing.map((file) => file.replace(/\\/g, '/'));
    const firstSlash = paths[0]?.lastIndexOf('/') ?? -1;
    const parent = firstSlash > 0 ? paths[0].slice(0, firstSlash) : undefined;
    const path = step.path ?? (parent && paths.every((file) => file.slice(0, file.lastIndexOf('/')) === parent) ? parent : undefined);
    return { ...step, kind: 'folder', path, status, listing: [...new Set(paths)] };
  }
  if (step.kind !== 'read' || !documentTool) return { ...step, status };
  const line = text.trimStart().split(/\r?\n/, 1)[0];
  const header = / · (?:Word|PDF|PowerPoint) · (\d+ (?:blocks?|pages?|slides?)) · (?:whole text|cut |pages? |slides? )/.exec(line);
  if (!failed && header) {
    return { ...step, status, units: header[1].includes('block') ? undefined : header[1] };
  }
  // Some providers only relay the plain tool result. The wording comes from
  // read_document's own responses, not from the AI's answer.
  const knownWording = [
    [/it has a password/i, documentReadWarnings.password],
    [/scan with no text/i, documentReadWarnings.scan],
    [/may be damaged/i, documentReadWarnings.damaged],
    [/too (?:big|large)/i, documentReadWarnings.size],
    [/kept online only/i, documentReadWarnings.online],
    [/older (?:Word|PowerPoint) format/i, documentReadWarnings.legacy],
    [/no readable text/i, documentReadWarnings.empty],
    [/inside the project folder|only read project documents/i, documentReadWarnings.outside],
    [/could not be found or opened|Check that the file is still/i, documentReadWarnings.unavailable],
    [/Ritemark couldn't (?:finish reading|read) this file/i, documentReadWarnings.worker],
  ] as const;
  const file = step.path?.split(/[/\\]/).pop();
  const wording = file && line.includes(file) ? line.replace(file, '') : line;
  const warning = knownWording.find(([pattern]) => pattern.test(wording))?.[1];
  if (!failed && !warning && !text) return step;
  return { ...step, status: 'failed', warning };
}

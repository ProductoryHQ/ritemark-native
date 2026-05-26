export type LinkTargetKind = 'external' | 'internal' | 'empty' | 'dangerous';

export interface LinkTargetClassification {
  kind: LinkTargetKind;
  href: string;
}

const DANGEROUS_PROTOCOL_RE = /^(javascript|data|vbscript|file):/i;
const PROTOCOL_RE = /^[a-z][a-z0-9+.-]*:/i;

export function isSafeRelativePath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (DANGEROUS_PROTOCOL_RE.test(trimmed)) return false;
  if (PROTOCOL_RE.test(trimmed)) return false;
  if (trimmed.startsWith('//')) return false;
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return false;
  if (trimmed.startsWith('#')) return true;
  if (trimmed.startsWith('/')) return false;
  return true;
}

export function normalizeExternalUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^HTTPS?:\/\//i, match => match.toLowerCase());
  }
  return `https://${trimmed}`;
}

export function classifyLinkTarget(value: string): LinkTargetClassification {
  const trimmed = value.trim();
  if (!trimmed) return { kind: 'empty', href: '' };
  if (DANGEROUS_PROTOCOL_RE.test(trimmed)) return { kind: 'dangerous', href: trimmed };

  if (/^https?:\/\//i.test(trimmed)) {
    return { kind: 'external', href: normalizeExternalUrl(trimmed) };
  }

  if (!PROTOCOL_RE.test(trimmed) && !trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    if (looksLikeExternalHost(trimmed)) {
      return { kind: 'external', href: normalizeExternalUrl(trimmed) };
    }

    if (isSafeRelativePath(trimmed)) {
      return { kind: 'internal', href: trimmed };
    }
  }

  return { kind: 'dangerous', href: trimmed };
}

export function canOpenExternally(value: string): boolean {
  return classifyLinkTarget(value).kind === 'external';
}

// Known file extensions that should NEVER be treated as external-host shorthand,
// even when the input "looks like" `name.ext`. Common-file-only extensions only —
// we intentionally do NOT list ambiguous ones (.io, .dev, .app, .ai, .co) because
// those are far more often typed as TLDs than as file extensions in markdown text.
//
// Sprint 72 (2026-05-26) expanded this list with code / config extensions after
// the workspace search allowlist was removed. Without these entries, picking a
// `.js` / `.ts` / `.py` file from `@`-search would reintroduce the
// "external-open icon shown for relative path" defect we just fixed.
const KNOWN_FILE_EXTENSIONS = new Set([
  // Documents
  'md', 'markdown', 'mdx', 'txt', 'rtf', 'log',
  'pdf', 'doc', 'docx', 'odt', 'epub',
  'xls', 'xlsx', 'csv', 'tsv', 'ods',
  'ppt', 'pptx', 'odp', 'key',
  // Images
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'tiff', 'ico', 'avif',
  // Audio
  'mp3', 'wav', 'ogg', 'flac', 'm4a',
  // Video
  'mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v',
  // Archives
  'zip', 'tar', 'gz', 'tgz', 'bz2', '7z', 'rar', 'xz',
  // Data / config
  'json', 'yml', 'yaml', 'toml', 'xml', 'sql', 'ini', 'conf', 'env',
  'properties', 'lock', 'mod', 'sum',
  // Web
  'html', 'htm', 'css', 'scss', 'less',
  // Code (added 2026-05-26 — see Sprint 72 R1)
  'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'php',
  'c', 'h', 'cpp', 'hpp', 'cs', 'lua',
  'sh', 'bash', 'zsh', 'fish', 'ps1',
]);

function looksLikeExternalHost(value: string): boolean {
  if (value.includes(' ')) return false;
  if (value.startsWith('.') || value.startsWith('..')) return false;
  if (value.startsWith('./') || value.startsWith('../')) return false;
  if (value.includes('/')) return false;
  if (!/^[^\s@/]+\.[^\s@/]+/.test(value)) return false;

  // Reject bare `name.<known-file-ext>` patterns even though they superficially
  // look like `host.tld`. This is conservative — we only exclude extensions that
  // are essentially never used as TLDs in linked text.
  const lastDot = value.lastIndexOf('.');
  if (lastDot > 0 && lastDot < value.length - 1) {
    const ext = value.slice(lastDot + 1).toLowerCase();
    if (KNOWN_FILE_EXTENSIONS.has(ext)) return false;
  }
  return true;
}

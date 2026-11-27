/** Check the original visible words before bounding or forwarding a card quote. */
export function isSafeFeedbackQuotePart(part: string): boolean {
  // Scan the original words, including URL paths and query strings, before truncation.
  const localPath = /\/(?:users|home|volumes|private|tmp|var|mnt|media|root|etc|opt|srv|usr|workspaces?)\/|…\/documents\/|~\/|\b[a-z]:[\\/]|\\\\[^\s\\/]+\\|\b(?:file|smb):/i;
  const credentials = /\/\/[^/\s?#@]+@|[?&](?:key|api_key|apikey|token|access_token|sig|signature|password|secret)=/i;
  // Any other absolute path that names a file (`/a/b/c.docx`), outside web addresses (Codex's review of #1135).
  const webAddress = /\b[a-z][a-z\d+.-]*:\/\/[^\s"'“”‘’«»<>()[\]{},;]+/giu;
  const filePath = /(?:^|[^\p{L}\p{N}_.-])\/(?:[^\s/\\"'“”‘’«»<>()[\]{},;]+\/)+[^\s/\\"'“”‘’«»<>()[\]{},;]*[^\s/\\"'“”‘’«»<>()[\]{},;.]\.[a-z][a-z\d]{0,7}(?![\p{L}\p{N}])/iu;
  return Boolean(part.trim()) && !localPath.test(part) && !credentials.test(part) && !filePath.test(part.replace(webAddress, ' '));
}

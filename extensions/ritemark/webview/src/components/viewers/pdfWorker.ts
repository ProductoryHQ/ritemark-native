import { pdfjs } from 'react-pdf'

/**
 * pdf.js's worker, started from its script's text (Sprint 135).
 *
 * pdf.js loads its worker by URL. A webview's origin is opaque, so pdf.js always starts a small worker from a blob that
 * imports the script, and that import is a request made by a worker. From VS Code 1.142 a webview's service worker no
 * longer answers requests from the page's own workers (upstream dropped that route), so a PDF stayed on "Loading PDF…".
 * The host sends the script's text with the PDF, and a worker started from it needs no request at all.
 */
let port: Worker | undefined

/** Makes pdf.js use a worker started from `source`, once per page; pdf.js uses it for every document after. */
export function startPdfWorker(source: string): void {
  if (port) return
  // The blob is read when the worker is made, so its URL can go at once (office-preview does the same)
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
  try {
    port = new Worker(url, { type: 'module' })
  } finally {
    URL.revokeObjectURL(url)
  }
  pdfjs.GlobalWorkerOptions.workerPort = port
}

// Sprint 148 (A2): pdf.js's parser module, which ships no types of its own. The
// search worker only hands it to pdf.js through `globalThis.pdfjsWorker`.
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
  export const WorkerMessageHandler: unknown;
}

// Minimal `vscode` stand-in so a Phase 0 canary can call the real Word exporter
// outside the extension host. Research only; never shipped.
import path from 'node:path'

let saveTarget = process.env.CANARY_DOCX_OUT || '/tmp/canary.docx'
export const _setSaveTarget = (p) => { saveTarget = p }

export const Uri = {
  file: (p) => ({ fsPath: p, scheme: 'file', path: p, toString: () => 'file://' + p, with: () => Uri.file(p) }),
  parse: (s) => Uri.file(s.replace(/^file:\/\//, '')),
  joinPath: (base, ...parts) => Uri.file(path.join(base.fsPath, ...parts)),
}

export const window = {
  showSaveDialog: async () => Uri.file(saveTarget),
  showInformationMessage: (m) => { console.log('[vscode.info]', m); return Promise.resolve(undefined) },
  showErrorMessage: (m) => { console.log('[vscode.error]', m); return Promise.resolve(undefined) },
  showWarningMessage: (m) => { console.log('[vscode.warn]', m); return Promise.resolve(undefined) },
  createOutputChannel: () => ({ appendLine() {}, show() {}, dispose() {} }),
}

export const workspace = {
  fs: {},
  getConfiguration: () => ({ get: (_k, d) => d }),
  workspaceFolders: [],
  asRelativePath: (p) => (typeof p === 'string' ? p : p.fsPath),
}

export const env = { openExternal: async () => true, clipboard: { writeText: async () => {} } }
export const commands = { executeCommand: async () => undefined, registerCommand: () => ({ dispose() {} }) }
export const ProgressLocation = { Notification: 15, Window: 10 }
export const ViewColumn = { One: 1, Two: 2 }
export class EventEmitter { constructor() { this.event = () => ({ dispose() {} }) } fire() {} dispose() {} }
export default { Uri, window, workspace, env, commands, ProgressLocation, ViewColumn, EventEmitter }

// Node module hook: resolve the bare `vscode` specifier to the canary stub.
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const STUB = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'vscode-stub.mjs')).href

export async function resolve(specifier, context, next) {
  if (specifier === 'vscode') return { url: STUB, shortCircuit: true }
  return next(specifier, context)
}

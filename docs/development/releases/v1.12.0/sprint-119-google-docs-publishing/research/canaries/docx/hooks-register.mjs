// Registers the `vscode` -> stub resolver for the DOCX canary.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
register(pathToFileURL(path.join(here, 'hooks.mjs')).href)

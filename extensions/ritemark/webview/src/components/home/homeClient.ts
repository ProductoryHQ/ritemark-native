/**
 * Home's and the projects list's side of their protocol (Sprint 134, E2):
 * typed requests to the host, which decodes every field (`src/projects/protocol.ts`).
 */

import { vscode } from '../../lib/vscode'
import type { HomeRequest, ProjectsRequest } from '../../../../src/projects/protocol'

export function send(request: HomeRequest): void {
  vscode.postMessage(request)
}

export function sendProjects(request: ProjectsRequest): void {
  vscode.postMessage(request)
}

/**
 * The welcome page's side of its protocol (Sprint 133, E2): typed requests to
 * the host. The host decodes every field (`src/welcome/protocol.ts`).
 */

import { vscode } from '../../lib/vscode'
import type { WelcomeRequest } from '../../../../src/welcome/protocol'

export function send(request: WelcomeRequest): void {
  vscode.postMessage(request)
}

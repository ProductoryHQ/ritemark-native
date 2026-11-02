/**
 * The results view's side of its protocol (Sprint 148, PR 2): typed messages to
 * the host, which decodes every one (`src/search/protocol.ts`).
 */

import { vscode } from '../../lib/vscode'
import type { SearchViewToHostMessage } from '../../../../src/search/protocol'

export function sendSearch(message: SearchViewToHostMessage): void {
  vscode.postMessage(message)
}

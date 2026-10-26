/**
 * Sprint 139 (#417, R6): the model substitution a turn names, once, before it
 * runs. Pure: the host passes the catalog's lookups.
 *
 * A chat's own saved model that the catalog no longer offers, replaced by the
 * model the turn runs on, for Claude, ChatGPT and OpenCode alike. A chat with
 * no saved model (a new chat, or one saved by 2.0) keeps Sprint 127 R6's check
 * against Claude's app-wide pick, passed in as `appWideSubstitution`.
 */

import type { AgentId } from '../agent/types';

export interface CatalogLookup {
  /** The catalog's id for a model, or undefined when the catalog doesn't offer it. */
  idOf(modelId: string): string | undefined;
}

export function modelSubstitutionForTurn(input: {
  runtimeId: AgentId;
  chatSavedModel: string | undefined;
  turnModel: string | undefined;
  catalog: CatalogLookup;
  /** Sprint 127 R6's answer for Claude's app-wide pick, used only when the chat saved no model. */
  appWideSubstitution?: () => { from: string; to: string } | undefined;
}): { from: string; to: string } | undefined {
  const { chatSavedModel, turnModel, catalog } = input;
  if (chatSavedModel) {
    if (!turnModel || catalog.idOf(chatSavedModel)) return undefined;
    const identity = (id: string): string => catalog.idOf(id) ?? id;
    return identity(turnModel) === identity(chatSavedModel) ? undefined : { from: chatSavedModel, to: turnModel };
  }
  return input.runtimeId === 'claude-code' ? input.appWideSubstitution?.() : undefined;
}
